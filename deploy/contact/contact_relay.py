#!/usr/bin/env python3
"""DPMO! contact relay: donotpissmeoff.com form -> OpenBot webhook (Vex).

Caddy proxies POST /api/contact here (127.0.0.1 only). Each valid submission is
written to the spool first, then POSTed to the OpenBot webhook routine, signed
the same way as the other OpenBot webhooks on this server:

    x-openbot-signature = "sha256=" + HMAC_SHA256(secret, ts + "." + delivery_id + "." + body)

A delivered submission is removed from the spool; anything else is retried every
RETRY_SEC, so nothing is lost while OpenBot or the network is down, or before the
webhook is configured. Logs carry ids and status codes only, never form content.

Standard library only. Config (environment):
    DPMO_WEBHOOK_URL       https://signal.openbot.run/v1/webhooks/<id>  (empty = queue only)
    CREDENTIALS_DIRECTORY  set by systemd LoadCredential; holds "webhook-secret"
    DPMO_SECRET_FILE       secret file when not run by systemd
    DPMO_SPOOL             spool directory (default $STATE_DIRECTORY/spool)
    DPMO_ALLOWED_ORIGINS   comma separated (default https://donotpissmeoff.com)
    DPMO_BIND / DPMO_PORT  default 127.0.0.1:8787
"""
import collections
import datetime
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.environ.get("DPMO_BIND", "127.0.0.1")
PORT = int(os.environ.get("DPMO_PORT", "8787"))
WEBHOOK_URL = os.environ.get("DPMO_WEBHOOK_URL", "").strip()
SECRET_FILE = (os.path.join(os.environ["CREDENTIALS_DIRECTORY"], "webhook-secret")
               if os.environ.get("CREDENTIALS_DIRECTORY")
               else os.environ.get("DPMO_SECRET_FILE", "/etc/dpmo-contact/webhook-secret"))
SPOOL = os.environ.get("DPMO_SPOOL") or os.path.join(
    os.environ.get("STATE_DIRECTORY", "/var/lib/dpmo-contact"), "spool")
ORIGINS = {o.strip() for o in os.environ.get(
    "DPMO_ALLOWED_ORIGINS", "https://donotpissmeoff.com").split(",") if o.strip()}
RETRY_SEC = int(os.environ.get("DPMO_RETRY_SEC", "60"))

MAX_BODY = 16 * 1024
MIN_FILL_MS = 3000            # faster than this is a bot
PROJECT_TYPES = {"Website", "Shopify store", "Web app", "Automation", "No idea yet"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$")
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# (window seconds, max submissions) per client IP, and for everyone together
IP_LIMITS = ((600, 3), (86400, 10))
GLOBAL_LIMITS = ((3600, 20), (86400, 60))

_hits = collections.defaultdict(collections.deque)
_hits_lock = threading.Lock()
_send_lock = threading.Lock()


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(*parts):
    print(now_iso(), *parts, flush=True)


# ---------- rate limit ----------

def _over(key, limits, now):
    q = _hits[key]
    longest = max(w for w, _ in limits)
    while q and now - q[0] > longest:
        q.popleft()
    return any(sum(1 for t in q if now - t <= w) >= n for w, n in limits)


def allow(ip):
    now = time.time()
    with _hits_lock:
        if _over(("ip", ip), IP_LIMITS, now) or _over("all", GLOBAL_LIMITS, now):
            return False
        _hits[("ip", ip)].append(now)
        _hits["all"].append(now)
        return True


def forget_idle_ips():
    """Drop addresses not seen for a day. They only ever live in memory (see privacy.html)."""
    now = time.time()
    with _hits_lock:
        for k in [k for k, q in _hits.items() if k != "all" and (not q or now - q[-1] > 86400)]:
            del _hits[k]


# ---------- validation ----------

def clean(value, max_len, multiline=False):
    if not isinstance(value, str):
        return None
    value = CTRL_RE.sub("", value.replace("\r\n", "\n").replace("\r", "\n"))
    if not multiline:
        value = " ".join(value.split())
    value = value.strip()
    return value if 0 < len(value) <= max_len else None


def validate(data):
    """Return (record, None), or (None, error) with a short reason for the client."""
    name = clean(data.get("name"), 120)
    email = clean(data.get("email"), 254)
    message = clean(data.get("message"), 5000, multiline=True)
    ptype = data.get("projectType")
    if not name:
        return None, "name"
    if not email or not EMAIL_RE.match(email):
        return None, "email"
    if not message:
        return None, "message"
    if ptype is not None and ptype not in PROJECT_TYPES:
        return None, "projectType"
    if data.get("pledge") is not True:
        return None, "pledge"
    sid = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(4)
    return {
        "id": "dpmo-" + sid,
        "receivedAt": now_iso(),
        "source": "donotpissmeoff.com contact form",
        "name": name,
        "email": email,
        "projectType": ptype,
        "message": message,
    }, None


# ---------- spool + delivery ----------

def spool_write(record):
    os.makedirs(SPOOL, mode=0o700, exist_ok=True)
    path = os.path.join(SPOOL, record["id"] + ".json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    return path


def read_secret():
    try:
        with open(SECRET_FILE, encoding="utf-8") as f:
            return f.read().strip() or None
    except OSError:
        return None


def send(record):
    """POST one record to the webhook. True when OpenBot accepted it."""
    secret = read_secret()
    if not WEBHOOK_URL or not secret:
        return False
    body = json.dumps({"type": "contact.new", "occurredAt": record["receivedAt"], "data": record},
                      ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ts = str(int(time.time()))
    delivery_id = record["id"]   # stable across retries, so OpenBot can drop duplicates
    sig = "sha256=" + hmac.new(secret.encode(), ts.encode() + b"." + delivery_id.encode() + b"." + body,
                               hashlib.sha256).hexdigest()
    req = urllib.request.Request(WEBHOOK_URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "User-Agent": "dpmo-contact-relay/1",
        "x-openbot-timestamp": ts,
        "x-openbot-delivery-id": delivery_id,
        "x-openbot-signature": sig,
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            status = r.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:  # network, TLS, timeout
        log("deliver", record["id"], "error", type(e).__name__)
        return False
    log("deliver", record["id"], status)
    return status in (200, 202)


def flush():
    """Deliver everything in the spool, oldest first. One flush at a time."""
    if not _send_lock.acquire(blocking=False):
        return
    try:
        if not os.path.isdir(SPOOL):
            return
        for name in sorted(n for n in os.listdir(SPOOL) if n.endswith(".json")):
            path = os.path.join(SPOOL, name)
            try:
                with open(path, encoding="utf-8") as f:
                    record = json.load(f)
            except (OSError, ValueError):
                log("spool unreadable", name)
                continue
            if send(record):
                os.remove(path)
            else:
                break   # webhook down or not configured: keep order, retry later
    finally:
        _send_lock.release()


def retry_loop():
    warned = False
    while True:
        time.sleep(RETRY_SEC)
        try:
            forget_idle_ips()
            if not (WEBHOOK_URL and read_secret()):
                pending = len([n for n in os.listdir(SPOOL) if n.endswith(".json")]) if os.path.isdir(SPOOL) else 0
                if pending and not warned:
                    log("webhook not configured,", pending, "queued")
                    warned = True
                continue
            warned = False
            flush()
        except Exception as e:
            log("retry error", type(e).__name__)


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    server_version = "dpmo"
    sys_version = ""

    def log_message(self, *args):   # Caddy keeps the access log
        pass

    def reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(405, {"error": "method"})

    def do_POST(self):
        if self.path.split("?")[0] != "/api/contact":
            return self.reply(404, {"error": "not found"})
        if self.headers.get("Origin") not in ORIGINS:
            return self.reply(403, {"error": "origin"})
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            return self.reply(415, {"error": "type"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, {"error": "size"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"error": "json"})
        if not isinstance(data, dict):
            return self.reply(400, {"error": "json"})

        # Caddy sets X-Forwarded-For to the real client (it ignores the client's own value).
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()

        # Bots: filled the hidden field or submitted too fast. Pretend it worked.
        elapsed = data.get("elapsedMs")
        if data.get("website") or not isinstance(elapsed, (int, float)) or elapsed < MIN_FILL_MS:
            log("dropped bot")
            return self.reply(200, {"ok": True})

        record, error = validate(data)
        if error:
            return self.reply(400, {"error": error})
        if not allow(ip):
            log("rate limited")
            return self.reply(429, {"error": "rate"})
        try:
            spool_write(record)
        except OSError as e:
            log("spool write failed", type(e).__name__)
            return self.reply(500, {"error": "store"})
        log("received", record["id"])
        threading.Thread(target=flush, daemon=True).start()
        return self.reply(200, {"ok": True})


def main():
    os.makedirs(SPOOL, mode=0o700, exist_ok=True)
    log("listening on", BIND, PORT, "| webhook", "configured" if WEBHOOK_URL and read_secret() else "NOT configured")
    threading.Thread(target=retry_loop, daemon=True).start()
    threading.Thread(target=flush, daemon=True).start()
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    sys.exit(main())
