#!/usr/bin/env bash
# KIDDO'ni serverdagi mavjud Caddy ortida ishga tushirish (boshqa loyihalarga tegmaydi).
# Avval scripts/server-setup.sh 5-qadamgacha bajarilgan bo'lishi kerak (.env, composer, migratsiya).
#   cd /opt/kiddo && sudo bash scripts/caddy-setup.sh
set -euo pipefail
trap 'echo; echo "XATO: $LINENO-qatorda to‘xtadi: $BASH_COMMAND"' ERR

DOMAIN="kiddo-sad.uz"
PORT=8088
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DC="docker compose -f $APP_DIR/docker-compose.prod.yml -f $APP_DIR/docker-compose.caddy.yml"
cd "$APP_DIR"

echo "==> 1/5 Caddy tekshiruvi"
if ! systemctl is-active --quiet caddy; then
  echo "XATO: 'caddy' systemd servisi ishlamayapti (Caddy Docker ichida bo'lishi mumkin)."
  echo "Quyidagini yuboring: sudo docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' ; systemctl status caddy --no-pager | head -5"
  exit 1
fi
CADDYFILE=$(systemctl cat caddy | grep -oP -- '--config\s+\K\S+' | head -1 || true)
CADDYFILE=${CADDYFILE:-/etc/caddy/Caddyfile}
[ -f "$CADDYFILE" ] || { echo "XATO: Caddyfile topilmadi: $CADDYFILE"; exit 1; }
echo "Caddyfile: $CADDYFILE"
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN && ! $DC ps nginx 2>/dev/null | grep -q Up; then
  echo "XATO: $PORT-port boshqa dastur tomonidan band. scripts/caddy-setup.sh va docker-compose.caddy.yml dagi portni o'zgartiring."; exit 1
fi

echo "==> 2/5 KIDDO konteynerlari (nginx faqat 127.0.0.1:$PORT da)"
$DC up -d
sleep 8
$DC ps

echo "==> 3/5 Ichki tekshiruv"
curl -fsS -H "Host: api.$DOMAIN" "http://127.0.0.1:$PORT/api/health" && echo
curl -fsS -o /dev/null -w "frontend: %{http_code}\n" -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/"

echo "==> 4/5 Caddy konfiguratsiyasi"
if grep -q "$DOMAIN" "$CADDYFILE"; then
  echo "Caddyfile'da $DOMAIN allaqachon bor — o'zgartirilmadi."
else
  BACKUP="$CADDYFILE.bak-$(date +%F-%H%M%S)"
  cp "$CADDYFILE" "$BACKUP"
  echo "Zaxira nusxa: $BACKUP"
  cat >> "$CADDYFILE" <<CADDY

# ─── KIDDO (kiddo-sad.uz) — /opt/kiddo, docker nginx 127.0.0.1:$PORT ───
$DOMAIN, api.$DOMAIN {
	reverse_proxy 127.0.0.1:$PORT
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
CADDY
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
    cp "$BACKUP" "$CADDYFILE"
    echo "XATO: Caddy konfiguratsiyasi noto'g'ri — eski holat tiklandi. Sabab:"; tail -5 /tmp/caddy-validate.log; exit 1
  fi
fi
systemctl reload caddy

echo "==> 5/5 HTTPS tekshiruvi (Caddy sertifikat oladi, 10-60 soniya)"
for i in $(seq 1 12); do
  if curl -fsS "https://api.$DOMAIN/api/health" >/dev/null 2>&1; then break; fi; sleep 5
done
curl -sS "https://api.$DOMAIN/api/health" || true; echo
curl -sS -o /dev/null -w "https://$DOMAIN -> %{http_code}\n" "https://$DOMAIN/" || true
echo
echo "TAYYOR: https://$DOMAIN"
echo "Super Admin: cd $APP_DIR && sudo $DC exec -it php php artisan kiddo:super-admin:create +998XXXXXXXXX --name=\"Ism\" --force"
