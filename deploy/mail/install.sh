#!/usr/bin/env bash
# Install or update the forward-only mail server. Usage:
#
#   ./deploy/mail/install.sh                          update the configuration
#   FORWARD_TO=me@example.com ./deploy/mail/install.sh   also set where mail goes
#
# privacy@, postmaster@ and abuse@donotpissmeoff.com are forwarded to FORWARD_TO.
# The destination lives only in /etc/postfix/virtual on the server. Idempotent.
set -euo pipefail

HOST="${DEPLOY_HOST:-vex-vps}"
FORWARD_TO="${FORWARD_TO:-}"
cd "$(dirname "$0")"

scp -q main.cf route.nft dpmo-mail-route.service "$HOST:/tmp/"
ssh "$HOST" "sudo FORWARD_TO='$FORWARD_TO' bash -s" <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! dpkg -s postfix postsrsd >/dev/null 2>&1; then
  echo "postfix postfix/main_mailer_type select Internet Site" | debconf-set-selections
  echo "postfix postfix/mailname string donotpissmeoff.com" | debconf-set-selections
  apt-get install -y -q postfix postsrsd >/dev/null
fi

# Inbound port 25 through the VPN client's firewall (like 80 and 443)
nordvpn allowlist add port 25 protocol TCP >/dev/null 2>&1 || true

# Outbound: SMTP from Postfix leaves from the server's own address
install -d -m 755 /etc/dpmo-mail
install -m 644 /tmp/route.nft /etc/dpmo-mail/route.nft
install -m 644 /tmp/dpmo-mail-route.service /etc/systemd/system/dpmo-mail-route.service
systemctl daemon-reload
systemctl enable --quiet dpmo-mail-route
systemctl restart dpmo-mail-route

# Sender rewriting for forwarded mail
sed -i -E 's/^domains = .*/domains = { "donotpissmeoff.com" }/' /etc/postsrsd.conf
systemctl restart postsrsd

# Postfix
install -m 644 /tmp/main.cf /etc/postfix/main.cf
if [ -n "$FORWARD_TO" ]; then
  umask 027
  printf '%s\t%s\n' \
    privacy@donotpissmeoff.com "$FORWARD_TO" \
    postmaster@donotpissmeoff.com "$FORWARD_TO" \
    abuse@donotpissmeoff.com "$FORWARD_TO" > /etc/postfix/virtual
  chgrp postfix /etc/postfix/virtual
fi
[ -e /etc/postfix/virtual ] || { echo "No /etc/postfix/virtual yet: run again with FORWARD_TO=..." >&2; exit 1; }
postmap /etc/postfix/virtual
postfix check
systemctl enable --quiet postfix
systemctl restart postfix
rm -f /tmp/main.cf /tmp/route.nft /tmp/dpmo-mail-route.service

sleep 1
systemctl is-active postfix postsrsd dpmo-mail-route
echo "Forwarding $(grep -c . /etc/postfix/virtual) addresses."
REMOTE
