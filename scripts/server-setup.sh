#!/usr/bin/env bash
# KIDDO — birinchi deploy (Ubuntu 24.04, root). Ishlatish:
#   cd /opt/kiddo && sudo bash scripts/server-setup.sh admin@example.com
# Takroran ishga tushirish xavfsiz: mavjud .env fayllar va sertifikat qayta yaratilmaydi.
set -euo pipefail
trap 'echo; echo "XATO: $LINENO-qatorda to‘xtadi: $BASH_COMMAND"' ERR

DOMAIN="kiddo-sad.uz"
EMAIL="${1:?Foydalanish: bash scripts/server-setup.sh <email-for-ssl>}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DC="docker compose -f $APP_DIR/docker-compose.prod.yml"
cd "$APP_DIR"

echo "==> 1/7 Paketlar (Docker, certbot, ufw)"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
apt-get update -y && apt-get install -y certbot ufw dnsutils openssl

echo "==> 2/7 Firewall: faqat 22, 80, 443"
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable

echo "==> 3/7 .env fayllar"
if [ ! -f .env ]; then
  cp .env.production.example .env
  sed -i "s#^DB_PASSWORD=.*#DB_PASSWORD=$(openssl rand -hex 24)#" .env
  sed -i "s#^NEXT_PUBLIC_API_URL=.*#NEXT_PUBLIC_API_URL=https://api.$DOMAIN/api#" .env
  chmod 600 .env
fi
if [ ! -f backend/.env ]; then
  cp backend/.env.production.example backend/.env
  sed -i "s#^APP_KEY=.*#APP_KEY=base64:$(openssl rand -base64 32)#" backend/.env
  sed -i -e "s#^APP_URL=.*#APP_URL=https://api.$DOMAIN#" \
         -e "s#^FRONTEND_URL=.*#FRONTEND_URL=https://$DOMAIN#" \
         -e "s#^SANCTUM_STATEFUL_DOMAINS=.*#SANCTUM_STATEFUL_DOMAINS=$DOMAIN#" \
         -e "s#^SESSION_DOMAIN=.*#SESSION_DOMAIN=.$DOMAIN#" \
         -e "s#^MAIL_FROM_ADDRESS=.*#MAIL_FROM_ADDRESS=\"noreply@$DOMAIN\"#" backend/.env
  chmod 600 backend/.env
fi
mkdir -p backend/storage/app backend/storage/framework/{cache,sessions,views} backend/storage/logs backend/bootstrap/cache
chown -R 1000:1000 backend/storage backend/bootstrap/cache
chown 1000:1000 backend/.env

echo "==> 4/7 Build (10-15 daqiqa olishi mumkin)"
$DC build
PHP_IMAGE=$($DC config --images 2>/dev/null | awk '/-php/ && !f {print; f=1}')
[ -n "$PHP_IMAGE" ] || PHP_IMAGE=kiddo-php
echo "PHP image: $PHP_IMAGE"
docker run --rm -u 0:0 -e COMPOSER_HOME=/tmp/composer -v "$APP_DIR/backend:/var/www/html" -w /var/www/html \
  "$PHP_IMAGE" composer install --no-dev --optimize-autoloader --no-interaction

echo "==> 5/7 Baza va ilova"
$DC up -d postgres
$DC up -d php frontend
sleep 5
$DC exec -T php php artisan migrate --force
$DC exec -T php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'

echo "==> 6/7 SSL sertifikat"
IP=$(curl -fsS4 https://ifconfig.me || hostname -I | awk '{print $1}')
for h in "$DOMAIN" "www.$DOMAIN" "api.$DOMAIN"; do
  got=$(dig +short A "$h" | tail -1)
  if [ "$got" != "$IP" ]; then
    echo "XATO: $h -> '$got', kutilgan $IP. DNS A-yozuvini tekshiring va keyinroq skriptni qayta ishga tushiring."; exit 1
  fi
done
mkdir -p /var/www/certbot
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  $DC stop nginx 2>/dev/null || true
  certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN" \
    --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
fi

echo "==> 7/7 Nginx va scheduler"
$DC up -d nginx scheduler
$DC exec -T nginx nginx -t
certbot reconfigure --cert-name "$DOMAIN" --webroot -w /var/www/certbot --non-interactive \
  --deploy-hook "docker compose -f $APP_DIR/docker-compose.prod.yml exec -T nginx nginx -s reload" || true

echo
$DC ps
echo
curl -s "https://api.$DOMAIN/api/health" || true
echo
echo "TAYYOR: https://$DOMAIN"
echo "Super Admin yaratish:  $DC exec -it php php artisan kiddo:super-admin:create +998XXXXXXXXX --name=\"Ism Familiya\" --force"
