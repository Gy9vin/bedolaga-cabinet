#!/usr/bin/env bash
# Deploy our fork of bedolaga-cabinet to /srv/cabinet (served by remnawave-nginx).
#
# Почему так:
#   remnawave-nginx раздаёт кабинет как статику из /srv/cabinet.
#   Контейнер cabinet_frontend собирает dist, но к /srv/cabinet не подключён,
#   поэтому docker compose build у локального форка не влияет на выдачу.
#   Этот скрипт собирает dist из нашего main и заменяет содержимое /srv/cabinet.
#
# Использование:
#   ./deploy.sh            # собрать из текущего кода
#   ./deploy.sh --pull     # сначала git pull, потом собрать

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET_DIR="${TARGET_DIR:-/srv/cabinet}"
NGINX_CONTAINER="${NGINX_CONTAINER:-remnawave-nginx}"

if [[ "${1:-}" == "--pull" ]]; then
  echo "→ git pull"
  git pull --ff-only
fi

echo "→ npm ci"
npm ci

echo "→ npm run build"
npm run build

if [[ ! -d dist ]]; then
  echo "✗ dist/ не создан, прерываю" >&2
  exit 1
fi

echo "→ deploying to $TARGET_DIR"
sudo rm -rf "${TARGET_DIR:?}"/*
sudo cp -r dist/. "$TARGET_DIR/"

echo "→ reloading nginx ($NGINX_CONTAINER)"
if docker ps --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
else
  echo "⚠ контейнер $NGINX_CONTAINER не запущен, перезагрузку пропустил"
fi

VERSION="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' package.json | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
echo "✔ задеплоено v$VERSION в $TARGET_DIR"
