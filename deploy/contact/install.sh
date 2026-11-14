#!/usr/bin/env bash
# Install or update the contact relay on the VPS. Usage: ./deploy/contact/install.sh
# Idempotent. Keeps the webhook URL and secret already in /etc/dpmo-contact.
set -euo pipefail

HOST="${DEPLOY_HOST:-vex-vps}"
cd "$(dirname "$0")"

scp -q contact_relay.py dpmo-contact.service "$HOST:/tmp/"
ssh "$HOST" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
id dpmo-contact >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin dpmo-contact
install -d -o root -g root -m 755 /opt/dpmo-contact
install -o root -g root -m 644 /tmp/contact_relay.py /opt/dpmo-contact/contact_relay.py
install -o root -g root -m 644 /tmp/dpmo-contact.service /etc/systemd/system/dpmo-contact.service
rm -f /tmp/contact_relay.py /tmp/dpmo-contact.service
install -d -o root -g root -m 700 /etc/dpmo-contact
[ -e /etc/dpmo-contact/webhook-secret ] || install -o root -g root -m 600 /dev/null /etc/dpmo-contact/webhook-secret
[ -e /etc/dpmo-contact/env ] || install -o root -g root -m 600 /dev/null /etc/dpmo-contact/env
systemctl daemon-reload
systemctl enable --quiet dpmo-contact
systemctl restart dpmo-contact
sleep 1
systemctl is-active dpmo-contact
journalctl -u dpmo-contact -n 3 --no-pager -o cat
REMOTE
