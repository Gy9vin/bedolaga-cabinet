#!/usr/bin/env bash
# ============================================================================
#  Кабинет (bedolaga-cabinet) рядом с Remnawave subscription-page.
#
#  РЕЖИМЫ:
#    ./setup_cabinet.sh check     — только анализ (ничего не меняет). Покажи мне вывод.
#    ./setup_cabinet.sh install   — полная установка (создаёт/ставит всё сам).
#
#  Правь блок CONFIG ниже (домен, API бота, email). Инфра remnawave — автодетект.
# ============================================================================
set -uo pipefail

# ======================== CONFIG — правь только это ==========================
CABINET_DOMAIN="cabinet.example.ru"            # поддомен под кабинет (A-запись → на этот сервер)
BOT_API_URL="https://bot.example.ru/cabinet"   # ПУБЛИЧНЫЙ API бота (бот на другом сервере!)
BOT_USERNAME="my_bot"                          # username бота без @
APP_NAME="EasyTunel"                           # название в шапке
LE_EMAIL="you@example.com"                     # email для Let's Encrypt

CABINET_REPO="https://github.com/Gy9vin/bedolaga-cabinet.git"
CABINET_DIR="/opt/cabinet"

# Инфра — оставь пусто для автодетекта, или впиши явно если автодетект ошибётся:
NGINX_DIR=""            # напр. /opt/remnawave/nginx
NGINX_SERVICE=""        # имя сервиса nginx в его docker-compose.yml
NGINX_CONTAINER=""      # имя контейнера nginx
DOCKER_NETWORK=""       # напр. remnawave-network
# ============================================================================

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
say(){ echo -e "${GRN}==>${NC} $*"; }
warn(){ echo -e "${YEL}!! ${NC} $*"; }
err(){ echo -e "${RED}✗ $*${NC}"; }
hd(){ echo -e "\n${BLU}──── $* ────${NC}"; }
die(){ err "$*"; exit 1; }

# ---------- Автодетект инфры (без изменений на сервере) ----------
detect() {
  if [ -z "$NGINX_CONTAINER" ]; then
    NGINX_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'nginx' | grep -iE 'remna|sub|caddy' | head -1)"
    [ -z "$NGINX_CONTAINER" ] && NGINX_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'nginx' | head -1)"
  fi
  if [ -z "$DOCKER_NETWORK" ]; then
    DOCKER_NETWORK="$(docker network ls --format '{{.Name}}' 2>/dev/null | grep -iE 'remnawave-network|remnawave' | head -1)"
  fi
  if [ -z "$NGINX_DIR" ]; then
    for d in /opt/remnawave/nginx /opt/remnawave /root/remnawave/nginx /opt/remnawave-nginx; do
      [ -f "$d/docker-compose.yml" ] && grep -qiE 'nginx' "$d/docker-compose.yml" 2>/dev/null && { NGINX_DIR="$d"; break; }
    done
    # запасной поиск
    [ -z "$NGINX_DIR" ] && NGINX_DIR="$(dirname "$(grep -rilE 'remnawave-nginx|nginx:1' /opt /root 2>/dev/null --include=docker-compose.yml | head -1)" 2>/dev/null)"
  fi
  if [ -z "$NGINX_SERVICE" ] && [ -n "$NGINX_DIR" ] && [ -f "$NGINX_DIR/docker-compose.yml" ]; then
    NGINX_SERVICE="$(awk '/^services:/{f=1;next} f&&/^  [a-zA-Z0-9_-]+:/{gsub(/[ :]/,"");print;exit}' "$NGINX_DIR/docker-compose.yml")"
  fi
}

server_ip(){ curl -s --max-time 5 https://api.ipify.org 2>/dev/null || curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "?"; }
dns_ip(){ getent hosts "$1" 2>/dev/null | awk '{print $1}' | head -1; }

# ============================ РЕЖИМ CHECK ===================================
do_check() {
  detect
  hd "СИСТЕМА"
  echo "OS: $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?}")  |  $(uname -m)"
  echo "docker: $(docker --version 2>/dev/null || echo НЕТ)"
  echo "compose: $(docker compose version --short 2>/dev/null || echo НЕТ)"
  echo "certbot: $(command -v certbot >/dev/null && certbot --version 2>/dev/null || echo НЕ УСТАНОВЛЕН)"
  echo "git: $(command -v git >/dev/null && echo есть || echo НЕТ)"

  hd "АВТОДЕТЕКТ ИНФРЫ"
  echo "NGINX_DIR       = ${NGINX_DIR:-НЕ НАЙДЕН}"
  echo "NGINX_SERVICE   = ${NGINX_SERVICE:-?}"
  echo "NGINX_CONTAINER = ${NGINX_CONTAINER:-НЕ НАЙДЕН}"
  echo "DOCKER_NETWORK  = ${DOCKER_NETWORK:-НЕ НАЙДЕНА}"

  hd "DOCKER PS"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "docker недоступен"

  hd "DOCKER СЕТИ"
  docker network ls --format '{{.Name}}' 2>/dev/null

  hd "ПАПКА NGINX ($NGINX_DIR)"
  if [ -n "$NGINX_DIR" ] && [ -d "$NGINX_DIR" ]; then
    ls -la "$NGINX_DIR" 2>/dev/null
    echo "--- docker-compose.yml (ports/volumes) ---"
    grep -nE 'ports|volumes|- .*:|image|container_name|services|networks' "$NGINX_DIR/docker-compose.yml" 2>/dev/null | head -40
    echo "--- override уже есть? ---"; ls "$NGINX_DIR"/docker-compose.override.yml "$NGINX_DIR"/cabinet.conf 2>/dev/null || echo "нет (норм для первой установки)"
    echo "--- upstream'ы в nginx.conf ---"; grep -nE 'upstream|server_name|listen' "$NGINX_DIR/nginx.conf" 2>/dev/null | head -20
  else
    err "папка nginx не найдена — впиши NGINX_DIR вручную в CONFIG"
  fi

  hd "СЕРТИФИКАТЫ Let's Encrypt"
  ls -1 /etc/letsencrypt/live 2>/dev/null || echo "/etc/letsencrypt/live пуст или нет"
  systemctl is-enabled certbot.timer 2>/dev/null && echo "certbot.timer: включён" || echo "certbot.timer: НЕ включён"

  hd "ПОРТЫ 80/443 (кто слушает)"
  (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':80 |:443 ' || echo "80/443 никто не слушает на хосте"

  hd "ФАЕРВОЛ"
  (ufw status 2>/dev/null | head -8) || true
  iptables -L INPUT -n 2>/dev/null | grep -E 'dpt:80|dpt:443|ACCEPT|DROP|REJECT' | head -10 || true

  hd "DNS/ДОСТУПНОСТЬ ДОМЕНА"
  local sip did; sip="$(server_ip)"; did="$(dns_ip "$CABINET_DOMAIN")"
  echo "IP этого сервера : $sip"
  echo "$CABINET_DOMAIN → : ${did:-НЕ РЕЗОЛВИТСЯ}"
  if [ -n "$did" ] && [ "$did" = "$sip" ]; then echo -e "${GRN}DNS ок — домен указывает на этот сервер${NC}"
  elif [ -n "$did" ]; then warn "домен резолвится, но НЕ на этот сервер ($did ≠ $sip) — HTTP-01 не пройдёт"
  else warn "домен не резолвится — сделай A-запись $CABINET_DOMAIN → $sip"; fi
  echo "--- порт 80 снаружи (нужен для Let's Encrypt HTTP-01) ---"
  curl -s --max-time 6 -o /dev/null -w "http://$CABINET_DOMAIN → HTTP %{http_code}\n" "http://$CABINET_DOMAIN/" 2>/dev/null || echo "порт 80 недоступен снаружи (или домен не резолвится)"

  hd "КОНТЕЙНЕР КАБИНЕТА"
  docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -i cabinet || echo "cabinet_frontend ещё нет"

  echo -e "\n${GRN}Готово. Скопируй ВЕСЬ вывод выше и пришли мне — скажу, что подправить перед install.${NC}"
}

# ============================ РЕЖИМ INSTALL =================================
do_install() {
  [ "$CABINET_DOMAIN" != "cabinet.example.ru" ] || die "заполни CONFIG вверху (CABINET_DOMAIN, BOT_API_URL, LE_EMAIL...)"
  command -v docker >/dev/null || die "docker не найден"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 не найден"

  # git — поставим если нет
  if ! command -v git >/dev/null; then say "Ставлю git"; apt-get update -y && apt-get install -y git || die "не смог поставить git"; fi

  detect
  [ -n "$NGINX_DIR" ] && [ -f "$NGINX_DIR/docker-compose.yml" ] || die "не нашёл папку nginx remnawave — впиши NGINX_DIR вручную в CONFIG (см. вывод 'check')"
  [ -n "$NGINX_CONTAINER" ] || die "не нашёл контейнер nginx — впиши NGINX_CONTAINER вручную"
  [ -n "$NGINX_SERVICE" ] || die "не определил имя сервиса nginx — впиши NGINX_SERVICE вручную"
  [ -n "$DOCKER_NETWORK" ] || die "не нашёл docker-сеть remnawave — впиши DOCKER_NETWORK вручную"
  say "Инфра: dir=$NGINX_DIR service=$NGINX_SERVICE container=$NGINX_CONTAINER net=$DOCKER_NETWORK"

  # 1. Кабинет
  say "Исходники кабинета в $CABINET_DIR"
  if [ -d "$CABINET_DIR/.git" ]; then git -C "$CABINET_DIR" pull --ff-only || warn "git pull не удался"; else git clone "$CABINET_REPO" "$CABINET_DIR" || die "clone не удался"; fi
  cat > "$CABINET_DIR/docker-compose.yml" <<YAML
services:
  cabinet-frontend:
    build:
      context: .
      args:
        VITE_API_URL: ${BOT_API_URL}
        VITE_TELEGRAM_BOT_USERNAME: ${BOT_USERNAME}
        VITE_APP_NAME: ${APP_NAME}
    container_name: cabinet_frontend
    restart: always
    networks: [${DOCKER_NETWORK}]
networks:
  ${DOCKER_NETWORK}: { name: ${DOCKER_NETWORK}, external: true }
YAML
  say "Собираю контейнер кабинета"
  ( cd "$CABINET_DIR" && docker compose up -d --build ) || die "сборка кабинета упала"

  # 2. override + webroot
  mkdir -p "$NGINX_DIR/acme-webroot"
  cat > "$NGINX_DIR/docker-compose.override.yml" <<YAML
services:
  ${NGINX_SERVICE}:
    ports:
      - '0.0.0.0:80:80'
    volumes:
      - ./cabinet.conf:/etc/nginx/conf.d/cabinet.conf:ro
      - ./acme-webroot:/etc/nginx/acme-webroot:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
YAML

  # 3. Фаза A: :80 challenge
  say "Фаза A: nginx с ACME-challenge на :80"
  cat > "$NGINX_DIR/cabinet.conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${CABINET_DOMAIN};
    location /.well-known/acme-challenge/ { root /etc/nginx/acme-webroot; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINX
  ( cd "$NGINX_DIR" && docker compose up -d ) || die "nginx не поднялся с override — проверь, что порт 80 свободен"
  sleep 2

  # 4. certbot
  if ! command -v certbot >/dev/null; then
    say "Ставлю certbot"
    if command -v apt-get >/dev/null; then apt-get update -y && apt-get install -y certbot
    elif command -v dnf >/dev/null; then dnf install -y certbot
    elif command -v yum >/dev/null; then yum install -y certbot
    else die "не смог поставить certbot — поставь вручную"; fi
  fi
  say "Выпускаю Let's Encrypt для ${CABINET_DOMAIN}"
  certbot certonly --webroot -w "$NGINX_DIR/acme-webroot" -d "$CABINET_DOMAIN" \
    --email "$LE_EMAIL" --agree-tos --no-eff-email --non-interactive \
    --deploy-hook "docker exec ${NGINX_CONTAINER} nginx -s reload" \
    || die "certbot не выпустил серт. Обычно: порт 80 закрыт снаружи ИЛИ домен не резолвится на этот сервер. Запусти './setup_cabinet.sh check' и пришли вывод."
  [ -f "/etc/letsencrypt/live/${CABINET_DOMAIN}/fullchain.pem" ] || die "серт не появился"

  # 5. Фаза B: полный конфиг с 443
  say "Фаза B: HTTPS-блок кабинета + reload"
  cat > "$NGINX_DIR/cabinet.conf" <<NGINX
upstream bedolaga-cabinet { server cabinet_frontend:8080; }
server {
    listen 80;
    listen [::]:80;
    server_name ${CABINET_DOMAIN};
    location /.well-known/acme-challenge/ { root /etc/nginx/acme-webroot; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    server_name ${CABINET_DOMAIN};
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    ssl_certificate         "/etc/letsencrypt/live/${CABINET_DOMAIN}/fullchain.pem";
    ssl_certificate_key     "/etc/letsencrypt/live/${CABINET_DOMAIN}/privkey.pem";
    ssl_trusted_certificate "/etc/letsencrypt/live/${CABINET_DOMAIN}/fullchain.pem";
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:MozSSL:10m;
    ssl_session_tickets off;
    gzip on; gzip_vary on; gzip_comp_level 6; gzip_min_length 256;
    gzip_types text/css application/javascript application/json image/svg+xml font/woff2;
    location / {
        proxy_http_version 1.1;
        proxy_pass http://bedolaga-cabinet;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  ( cd "$NGINX_DIR" && docker compose up -d )
  docker exec "$NGINX_CONTAINER" nginx -t || die "nginx -t не прошёл (см. вывод выше)"
  docker exec "$NGINX_CONTAINER" nginx -s reload

  # 6. автопродление
  systemctl enable --now certbot.timer 2>/dev/null || warn "certbot.timer не активирован — проверь: systemctl list-timers | grep certbot"

  echo; say "ГОТОВО ✅  https://${CABINET_DOMAIN}"
  warn "На сервере БОТА в .env: CABINET_ENABLED=true и CABINET_ALLOWED_ORIGINS=https://${CABINET_DOMAIN} → рестарт бота (иначе CORS-ошибка)."
}

case "${1:-check}" in
  check)   do_check ;;
  install) do_install ;;
  *) echo "Использование: $0 [check|install]"; exit 1 ;;
esac
