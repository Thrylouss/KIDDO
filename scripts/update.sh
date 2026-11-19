#!/usr/bin/env bash
# KIDDO — serverni yangilash (backup → kod → .env qo'shimchalari → build → migratsiya → ishga tushirish → tekshiruv).
#   cd /opt/kiddo && sudo git pull --ff-only && sudo bash scripts/update.sh
# Hech qachon: migrate:fresh / db:wipe / db:seed. Xato bo'lsa to'xtaydi; backup /var/backups da qoladi.
set -euo pipefail
trap 'echo; echo "XATO: $LINENO-qatorda to‘xtadi: $BASH_COMMAND"' ERR

DOMAIN="kiddo-sad.uz"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
DC="docker compose -f $APP_DIR/docker-compose.prod.yml"
if [ -f docker-compose.caddy.yml ] && grep -q '^CADDY_NETWORK=' .env 2>/dev/null; then
  DC="$DC -f $APP_DIR/docker-compose.caddy.yml"
fi
add_env() { grep -q "^$2=" "$1" || { echo "$2=$3" >> "$1"; echo "  + $1: $2=$3"; }; }
count_orgs() {
  $DC exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from organizations where deleted_at is null"' | tr -d '[:space:]'
}

echo "==> 1/7 Backup"
TS=$(date +%Y%m%d-%H%M); mkdir -p /var/backups
git rev-parse HEAD > "/var/backups/kiddo-prev-commit-$TS.txt"
$DC exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "/var/backups/kiddo-pre-$TS.dump"
tar -czf "/var/backups/kiddo-storage-pre-$TS.tar.gz" -C backend/storage app
chmod 600 "/var/backups/kiddo-pre-$TS.dump" "/var/backups/kiddo-storage-pre-$TS.tar.gz"
ORGS_BEFORE=$(count_orgs)
echo "Backup: /var/backups/kiddo-pre-$TS.dump ($(du -h "/var/backups/kiddo-pre-$TS.dump" | cut -f1)), bog'chalar: $ORGS_BEFORE"

echo "==> 2/7 Kod"
git pull --ff-only
git log --oneline -3

echo "==> 3/7 Konfiguratsiya (faqat yangi qiymatlar qo'shiladi)"
add_env .env NEXT_PUBLIC_SMART_SAFETY_DEMO true
add_env backend/.env SMART_SAFETY_ENABLED false
add_env backend/.env YOUTUBE_API_KEY ""
chown 1000:1000 backend/.env
chmod 600 .env backend/.env

echo "==> 4/7 Build"
$DC build php frontend
PHP_IMAGE=$($DC config --images 2>/dev/null | awk '/-php/ && !f {print; f=1}')
PHP_IMAGE=${PHP_IMAGE:-kiddo-php}
docker run --rm -u 0:0 -e COMPOSER_HOME=/tmp/composer -v "$APP_DIR/backend:/var/www/html" -w /var/www/html \
  "$PHP_IMAGE" composer install --no-dev --optimize-autoloader --no-interaction

echo "==> 5/7 Ishga tushirish va migratsiya"
$DC up -d
sleep 5
if $DC exec -T php php artisan migrate --pretend | grep -iE 'drop table|drop column|delete from|truncate'; then
  echo "XATO: migratsiyada o'chirish amali bor — to'xtatildi (backup: /var/backups/kiddo-pre-$TS.dump)"; exit 1
fi
$DC exec -T php php artisan migrate --force
$DC exec -T php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
$DC restart php scheduler
sleep 5

echo "==> 6/7 Tekshiruv"
PENDING=$($DC exec -T php php artisan migrate:status | grep -c Pending || true)
ORGS_AFTER=$(count_orgs)
echo "Kutilmagan migratsiyalar: $PENDING | bog'chalar: $ORGS_BEFORE -> $ORGS_AFTER"
curl -s "https://api.$DOMAIN/api/health" || true; echo
for u in "https://$DOMAIN/login" "https://$DOMAIN/smart-safety"; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "$u" || true
done
curl -s -o /dev/null -w "kids API (401 kutiladi) -> %{http_code}\n" -H 'Accept: application/json' "https://api.$DOMAIN/api/v1/admin/kids/contents" || true
curl -sI -X OPTIONS "https://api.$DOMAIN/api/v1/login" -H "Origin: https://$DOMAIN" -H 'Access-Control-Request-Method: POST' | grep -i allow-origin || true

echo "==> 7/7 Xatolar (oxirgi 5 daqiqa)"
$DC logs --since=5m php frontend 2>&1 | grep -iE 'error|exception' | head -10 || true
$DC ps
echo
if [ "$ORGS_BEFORE" = "$ORGS_AFTER" ] && [ "$PENDING" = "0" ]; then echo "YANGILANDI ✅"; else echo "DIQQAT: yuqoridagi natijalarni tekshiring"; fi
