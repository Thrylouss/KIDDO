#!/usr/bin/env bash
# KIDDO'ni serverdagi umumiy Caddy konteyneri ortida ishga tushirish (boshqa loyihalarga tegmaydi).
# Caddy asosiy Caddyfile'i o'zgartirilmaydi — faqat sites papkasiga kiddo.caddy qo'shiladi.
#   cd /opt/kiddo && sudo bash scripts/caddy-setup.sh
set -euo pipefail
trap 'echo; echo "XATO: $LINENO-qatorda to‘xtadi: $BASH_COMMAND"' ERR

DOMAIN="kiddo-sad.uz"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> 1/5 Caddy konteynerini topish"
CADDY=$(docker ps --filter publish=443 --format '{{.Names}}' | head -1)
[ -n "$CADDY" ] || { echo "XATO: 443-portni ochgan konteyner topilmadi"; exit 1; }
NET=$(docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -v '^$' | head -1)
SITES=$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/sites"}}{{.Source}}{{end}}{{end}}')
echo "Caddy: $CADDY | tarmoq: $NET | sites: ${SITES:-topilmadi}"
[ -n "$SITES" ] || { echo "XATO: $CADDY konteynerida /etc/caddy/sites papkasi ulanmagan"; exit 1; }

if grep -q '^CADDY_NETWORK=' .env; then sed -i "s#^CADDY_NETWORK=.*#CADDY_NETWORK=$NET#" .env; else echo "CADDY_NETWORK=$NET" >> .env; fi
DC="docker compose -f $APP_DIR/docker-compose.prod.yml -f $APP_DIR/docker-compose.caddy.yml"

echo "==> 2/5 KIDDO konteynerlari"
$DC up -d
sleep 8
$DC ps

echo "==> 3/5 Ichki tekshiruv"
curl -fsS -H "Host: api.$DOMAIN" "http://127.0.0.1:8088/api/health" && echo
curl -sS -o /dev/null -w "frontend: %{http_code}\n" -H "Host: $DOMAIN" "http://127.0.0.1:8088/"
docker exec "$CADDY" wget -q -O /dev/null --header "Host: api.$DOMAIN" http://kiddo-nginx/api/health \
  && echo "Caddy -> kiddo-nginx: OK"

echo "==> 4/5 Caddy sayt fayli: $SITES/kiddo.caddy"
mkdir -p "$SITES"
cat > "$SITES/kiddo.caddy" <<CADDY
# KIDDO (kiddo-sad.uz) — /opt/kiddo, nginx konteyneri: kiddo-nginx:80
$DOMAIN, api.$DOMAIN {
	reverse_proxy kiddo-nginx:80
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
CADDY
if ! docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
  rm -f "$SITES/kiddo.caddy"
  echo "XATO: Caddy konfiguratsiyasi qabul qilinmadi — kiddo.caddy o'chirildi, boshqa saytlar o'zgarmadi. Sabab:"
  tail -5 /tmp/caddy-validate.log; exit 1
fi
docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> 5/5 HTTPS tekshiruvi (Caddy sertifikat oladi, 10-60 soniya)"
for i in $(seq 1 12); do
  curl -fsS "https://api.$DOMAIN/api/health" >/dev/null 2>&1 && break; sleep 5
done
curl -sS "https://api.$DOMAIN/api/health" || true; echo
curl -sS -o /dev/null -w "https://$DOMAIN -> %{http_code}\n" "https://$DOMAIN/" || true
echo
echo "TAYYOR: https://$DOMAIN"
echo "Super Admin: cd $APP_DIR && sudo $DC exec -it php php artisan kiddo:super-admin:create +998XXXXXXXXX --name=\"Ism\" --force"
