#!/usr/bin/env bash
# Deploy our fork of bedolaga-cabinet to /srv/cabinet (served by remnawave-nginx).
#
# Почему так:
#   remnawave-nginx раздаёт кабинет как статику из /srv/cabinet.
#   Контейнер cabinet_frontend собирает dist, но к /srv/cabinet не подключён,
#   поэтому сборка сама по себе ничего не меняет. Скрипт собирает фронт через
#   docker compose build и перекладывает статику из контейнера в /srv/cabinet.
#
# Использование:
#   ./deploy.sh                 # пересобрать контейнер и задеплоить
#   ./deploy.sh --pull          # git pull + пересобрать + задеплоить
#   ./deploy.sh --no-build      # только перелить статику из уже собранного контейнера

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET_DIR="${TARGET_DIR:-/srv/cabinet}"
NGINX_CONTAINER="${NGINX_CONTAINER:-remnawave-nginx}"
CABINET_CONTAINER="${CABINET_CONTAINER:-cabinet_frontend}"

DO_PULL=0
DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --pull)     DO_PULL=1 ;;
    --no-build) DO_BUILD=0 ;;
    *) echo "неизвестный флаг: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$DO_PULL" -eq 1 ]]; then
  echo "→ git pull"
  git pull --ff-only
fi

if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "→ docker compose build --no-cache"
  docker compose build --no-cache
  echo "→ docker compose up -d"
  docker compose up -d
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CABINET_CONTAINER}$"; then
  echo "✗ контейнер $CABINET_CONTAINER не запущен" >&2
  exit 1
fi

echo "→ deploying to $TARGET_DIR"
rm -rf "${TARGET_DIR:?}"/*
docker cp "${CABINET_CONTAINER}:/usr/share/nginx/html/." "$TARGET_DIR/"

echo "→ reloading nginx ($NGINX_CONTAINER)"
if docker ps --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
else
  echo "⚠ контейнер $NGINX_CONTAINER не запущен, перезагрузку пропустил"
fi

VERSION="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' package.json | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
echo "✔ задеплоено v$VERSION в $TARGET_DIR"
