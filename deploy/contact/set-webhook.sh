#!/usr/bin/env bash
# Store the OpenBot webhook URL and signing secret on the VPS, then restart the relay.
# Run it in your own terminal: ./deploy/contact/set-webhook.sh
# The secret is read without echo and sent over SSH stdin: it never lands in
# shell history, process arguments, the repo or a chat.
set -euo pipefail

HOST="${DEPLOY_HOST:-vex-vps}"

read -rp "Webhook URL (from the Vex routine panel): " url
case "$url" in
  https://signal.openbot.run/v1/webhooks/*) ;;
  *) echo "Expected https://signal.openbot.run/v1/webhooks/<id>" >&2; exit 1 ;;
esac
read -rsp "Signing secret (hidden): " secret; echo
[ -n "$secret" ] || { echo "Empty secret" >&2; exit 1; }

printf '%s\n%s\n' "$url" "$secret" | ssh "$HOST" 'sudo bash -c '\''
set -euo pipefail
umask 077
IFS= read -r url; IFS= read -r secret
printf "DPMO_WEBHOOK_URL=%s\n" "$url" > /etc/dpmo-contact/env
printf "%s" "$secret" > /etc/dpmo-contact/webhook-secret
systemctl restart dpmo-contact
sleep 2
journalctl -u dpmo-contact -n 5 --no-pager -o cat
'\'''
