#!/usr/bin/env bash
# Publish the site to the VPS. Usage: ./deploy.sh
# Copies only the public files into /var/www/dpmo; anything else there is removed.
set -euo pipefail

HOST="${DEPLOY_HOST:-vex-vps}"   # SSH alias from ~/.ssh/config
DEST="/var/www/dpmo/"

cd "$(dirname "$0")"

rsync -rlptz --delete --delete-excluded \
  --exclude='.DS_Store' \
  --include='/index.html' \
  --include='/404.html' \
  --include='/privacy.html' \
  --include='/favicon.ico' \
  --include='/robots.txt' \
  --include='/sitemap.xml' \
  --include='/css/***' \
  --include='/js/***' \
  --include='/assets/***' \
  --exclude='*' \
  ./ "$HOST:$DEST"

echo "Deployed to $HOST:$DEST"
