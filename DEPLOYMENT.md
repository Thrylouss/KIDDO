# KIDDO — VPS'ga production deploy

| | |
|---|---|
| Frontend | **https://kiddo.uz** (`www.kiddo.uz` → 301 → `kiddo.uz`) |
| Backend API | **https://api.kiddo.uz** (yo'llar: `/api/v1/...`, health: `/api/health`, `/up`) |
| Hosting | VPS, Docker Compose (`docker-compose.prod.yml`) |

Bu yo'riqnomadagi buyruqlar loyihadagi haqiqiy fayllarga asoslangan: `docker-compose.prod.yml`,
`docker/nginx/default.prod.conf`, `docker/php/Dockerfile`, `docker/php/production.ini`, `docker/frontend/Dockerfile`.
Hech qanday parol, kalit yoki sertifikat repoda yo'q va bo'lmasligi kerak.

---

## 1. Arxitektura

```
Internet ─► :80   nginx ─► 301 https://…  (+ /.well-known/acme-challenge/ — Let's Encrypt)
         └► :443  nginx ─┬─ kiddo.uz, www.kiddo.uz ─► frontend:3000  (Next.js 16, `next start`)
                         └─ api.kiddo.uz            ─► php:9000       (Laravel 11, PHP-FPM 8.2)
php, scheduler ─► postgres:5432 (PostgreSQL 16, volume `kiddo_pgdata`)
```

| Servis | Image / build | Ichki port | Internetga |
|---|---|---|---|
| nginx | `nginx:1.25-alpine` | 80, 443 | **ha — faqat shu ikkisi** |
| frontend | `docker/frontend/Dockerfile` (`node:22-alpine`) | 3000 | yo'q |
| php | `docker/php/Dockerfile` (`php:8.2-fpm-alpine`) | 9000 | yo'q |
| scheduler | php image, `php artisan schedule:work` | — | yo'q |
| postgres | `postgres:16-alpine` | 5432 | yo'q |

- Queue worker va WebSocket yo'q (kodda `ShouldQueue` vazifalar yo'q; Telegram qayta yuborish — scheduler).
- **Auth:** API `kiddo_token` cookie (`httpOnly`, `Secure`, `SameSite=Strict`, 7 kun) va mobil ilova uchun Bearer token.
  `kiddo.uz` va `api.kiddo.uz` bitta sayt (same-site) — cookie frontend'dan API'ga so'rovlarda yuboriladi.
- **CORS:** faqat `FRONTEND_URL=https://kiddo.uz`, credentials bilan; production'da `localhost` qo'shilmaydi.
- **Kod `:ro`** ulanadi; yoziladigan joylar: `backend/storage` (rasmlar — `storage/app`) va `backend/bootstrap/cache`.

## 2. Server talablari

| Dastur | Versiya | Izoh |
|---|---|---|
| OS | Ubuntu 22.04 / 24.04 LTS | boshqa Linux ham mumkin |
| Docker Engine | 24+ | |
| Docker Compose plugin | **2.20+** | `depends_on.required` uchun; `docker compose version` |
| git | 2.x | |
| certbot | 2.3+ | hostda (`apt install certbot`) |
| ufw (yoki boshqa firewall) | — | |

Resurslar (tavsiya): 2 vCPU, 4 GB RAM (frontend build ~2 GB ishlatadi), 30 GB+ disk (baza, rasmlar, image'lar).

## 3. DNS

| Turi | Nom | Qiymat |
|---|---|---|
| A | `kiddo.uz` | VPS IPv4 |
| A | `www.kiddo.uz` | VPS IPv4 (yoki CNAME → `kiddo.uz`) |
| A | `api.kiddo.uz` | VPS IPv4 |
| AAAA | yuqoridagilar | faqat serverda IPv6 sozlangan bo'lsa |

Tekshirish: `dig +short kiddo.uz www.kiddo.uz api.kiddo.uz` — uchalasi server IP'sini qaytarishi kerak (sertifikatdan oldin).

## 4. Firewall

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH          # iloji bo'lsa: sudo ufw allow from <admin-IP> to any port 22
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> Docker o'zi publish qilgan portlar uchun ufw'ni chetlab o'tadi — shuning uchun compose faylida faqat nginx 80/443
> publish qilingan; 3000, 9000, 5432 hech qachon `ports:` ga qo'shilmasin.

## 5. Environment variables (serverda, Git'ga emas)

Ikki fayl. Ikkalasi ham `.gitignore` da; `chmod 600`.

### 5.1. Root `.env` — `docker-compose.prod.yml` uchun (namuna: `.env.production.example`)

| O'zgaruvchi | Qiymat | Majburiy |
|---|---|---|
| `DB_PASSWORD` | kuchli parol (`openssl rand -base64 32`) | **ha** (bo'lmasa compose to'xtaydi) |
| `DB_DATABASE`, `DB_USERNAME` | `kiddo`, `kiddo` | standart |
| `DB_HOST`, `DB_PORT` | `postgres`, `5432` | faqat tashqi baza bo'lsa o'zgartiriladi |
| `NEXT_PUBLIC_API_URL` | `https://api.kiddo.uz/api` | **ha** — oxiridagi `/api` shart |
| `NEXT_PUBLIC_CONTACT_EMAIL/PHONE/TELEGRAM/ADDRESS` | landing aloqa ma'lumotlari | ixtiyoriy |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_GOOGLE_PLAY_URL` | faqat haqiqiy do'kon havolalari | ixtiyoriy (bo'sh — ko'rsatilmaydi) |

`NEXT_PUBLIC_*` build vaqtida JavaScript'ga yoziladi (ochiq qiymatlar) — o'zgartirilsa `frontend` qayta build qilinadi.
`NEXT_PUBLIC_DEMO_MODE` compose'da qat'iy `false`.

### 5.2. `backend/.env` — Laravel (namuna: `backend/.env.production.example`)

| O'zgaruvchi | Qiymat |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | `base64:…` — `echo "base64:$(openssl rand -base64 32)"` (bir marta; keyin o'zgartirilmaydi) |
| `APP_URL` | `https://api.kiddo.uz` |
| `FRONTEND_URL` | `https://kiddo.uz` |
| `SANCTUM_STATEFUL_DOMAINS` | `kiddo.uz` |
| `SESSION_DOMAIN` | `.kiddo.uz` |
| `BILLING_ENABLED` | `false` |
| `LOG_CHANNEL` / `LOG_LEVEL` | `stderr` / `warning` (`docker compose logs php`) |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `database` (jadvallar migratsiyalarda bor) |
| `MAIL_MAILER` | `log` (MVP email yubormaydi) |
| `SENTRY_LARAVEL_DSN` | Sentry DSN yoki bo'sh |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | DEMO arizalar uchun (ixtiyoriy) |
| `DB_*` | **bo'sh qoldiring** — root `.env` dan konteyner env'i orqali keladi va ustun turadi |

**Production'da berilmasin:** `KIDDO_DEV_TEST_MODE`, `KIDDO_DEV_TEST_PASSWORD`, `KIDDO_DEV_SUPERADMIN_*`.

## 6. Birinchi o'rnatish

```bash
# 6.1. Kod
sudo mkdir -p /opt/kiddo && sudo chown "$USER" /opt/kiddo
git clone https://github.com/said-akhi/KIDDO.git /opt/kiddo && cd /opt/kiddo

# 6.2. Environment fayllari (qiymatlarni 5-bo'lim bo'yicha to'ldiring)
cp .env.production.example .env                         && chmod 600 .env
cp backend/.env.production.example backend/.env         && chmod 600 backend/.env
echo "base64:$(openssl rand -base64 32)"                 # → backend/.env dagi APP_KEY=

# 6.3. Laravel yozadigan papkalar — konteyner foydalanuvchisi (uid 1000)
# (storage repoga kiritilmaydi — toza clone'da yaratiladi)
mkdir -p backend/storage/app backend/storage/framework/{cache,sessions,views} backend/storage/logs backend/bootstrap/cache
sudo chown -R 1000:1000 backend/storage backend/bootstrap/cache

# 6.4. Image'lar va PHP bog'liqliklari (vendor hostda — kod konteynerga :ro ulanadi)
docker compose -f docker-compose.prod.yml build
PHP_IMAGE=$(docker compose -f docker-compose.prod.yml config --images | grep -m1 -- '-php')
docker run --rm -u "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer \
  -v "$PWD/backend:/var/www/html" -w /var/www/html "$PHP_IMAGE" \
  composer install --no-dev --optimize-autoloader --no-interaction

# 6.5. Baza va ilova
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml up -d php frontend
docker compose -f docker-compose.prod.yml exec php php artisan migrate --pretend   # SQL'ni ko'rib chiqing
docker compose -f docker-compose.prod.yml exec php php artisan migrate --force     # faqat migrate: migrate:fresh / --seed EMAS
docker compose -f docker-compose.prod.yml exec php php artisan config:cache
docker compose -f docker-compose.prod.yml exec php php artisan route:cache
docker compose -f docker-compose.prod.yml exec php php artisan event:cache
```

Toza bazada 46 ta migratsiya bajariladi (`2026_11_08_000042_create_territories_table` — oxirgisi; hududlar jadvali bo'sh yaratiladi).

## 7. SSL sertifikati (Let's Encrypt)

nginx sertifikat faylisiz ishga tushmaydi — **birinchi sertifikat** nginx'dan oldin, standalone rejimda olinadi
(80-port bo'sh bo'lishi kerak):

```bash
sudo certbot certonly --standalone \
  -d kiddo.uz -d www.kiddo.uz -d api.kiddo.uz \
  --email <admin-email> --agree-tos --no-eff-email
# → /etc/letsencrypt/live/kiddo.uz/fullchain.pem va privkey.pem  (nginx konfiguratsiyasidagi yo'l)
sudo mkdir -p /var/www/certbot

cd /opt/kiddo
docker compose -f docker-compose.prod.yml up -d nginx scheduler
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

**Avtomatik yangilash** — webroot orqali (nginx ishlab turganda, `/.well-known/acme-challenge/` 80-portda ochiq):

```bash
sudo certbot reconfigure --cert-name kiddo.uz --webroot -w /var/www/certbot \
  --deploy-hook "docker compose -f /opt/kiddo/docker-compose.prod.yml exec -T nginx nginx -s reload"
sudo certbot renew --dry-run
systemctl list-timers | grep certbot      # kuniga 2 marta tekshiradi, muddatidan 30 kun oldin yangilaydi
```

TLS: faqat 1.2 va 1.3, HTTP/2, HSTS (2 yil, `includeSubDomains`). Sertifikat va `privkey.pem` faqat hostdagi
`/etc/letsencrypt` da, konteynerga `:ro` ulanadi.

## 8. Birinchi Super Admin

```bash
docker compose -f docker-compose.prod.yml exec -it php \
  php artisan kiddo:super-admin:create +998XXXXXXXXX --name="Ism Familiya" --force
# --force — production muhitida majburiy (buyruq aks holda to'xtaydi).
# parol yashirin so'raladi (argumentda emas — shell tarixida qolmaydi); kamida 12 belgi.
# Faqat bir marta ishlaydi: Super Admin allaqachon bo'lsa rad etadi. Keyingi o'zgartirish: kiddo:super-admin:update
# Production'da `db:seed` HECH QACHON ishga tushirilmasin.
```

Keyin Super Admin bog'chalarni va rahbar akkauntlarini panel orqali yaratadi.

## 9. Tekshirish

```bash
cd /opt/kiddo
docker compose -f docker-compose.prod.yml ps                       # hammasi Up, postgres (healthy)
docker compose -f docker-compose.prod.yml exec nginx nginx -t
curl -sI http://kiddo.uz | head -3                                 # 301 → https://kiddo.uz/
curl -sI https://www.kiddo.uz | grep -i location                   # https://kiddo.uz/
curl -sI https://kiddo.uz/login | grep -iE '^HTTP|strict-transport|x-powered-by'   # 200, bitta HSTS, X-Powered-By yo'q
curl -s https://api.kiddo.uz/api/health                            # {"status":"ok",...}
curl -s -H 'Accept: application/json' https://api.kiddo.uz/api/v1/me   # 401 «Tizimga kirishingiz kerak.»
curl -sI -H 'Origin: https://kiddo.uz' https://api.kiddo.uz/api/health | grep -i access-control-allow-origin
curl -s -o /dev/null -w '%{http_code}\n' https://api.kiddo.uz/.env     # 403
openssl s_client -connect kiddo.uz:443 -servername api.kiddo.uz </dev/null 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName -dates
for p in 3000 5432 9000; do nc -zvw3 kiddo.uz $p; done            # hammasi yopiq bo'lishi kerak
docker compose -f docker-compose.prod.yml exec php php artisan about --only=environment   # production, Debug OFF
docker compose -f docker-compose.prod.yml exec php php -i | grep -E 'upload_max_filesize|post_max_size|expose_php'
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep -c Pending   # 0
```

Tashqi baholash: https://www.ssllabs.com/ssltest/analyze.html?d=kiddo.uz (kutilgan: A / A+).

## 10. Zaxira nusxa (backup)

```bash
# Baza (har kuni, cron) — fayl serverda ham, server tashqarisida ham saqlansin
docker compose -f /opt/kiddo/docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /var/backups/kiddo-$(date +%F).dump
# Rasmlar (bola va guruh suratlari)
tar -czf /var/backups/kiddo-storage-$(date +%F).tar.gz -C /opt/kiddo/backend/storage app
```

Tiklash sinovini deploydan oldin bir marta bajaring (`pg_restore` boshqa, bo'sh bazaga).
Zaxira fayllarida shaxsiy ma'lumotlar bor — ruxsatlar `600`, Git'ga hech qachon qo'shilmasin.

## 11. Yangilash (keyingi deploylar)

```bash
cd /opt/kiddo
docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /var/backups/kiddo-pre-$(date +%F-%H%M).dump
git pull --ff-only
docker compose -f docker-compose.prod.yml build
docker run --rm -u "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer -v "$PWD/backend:/var/www/html" -w /var/www/html \
  "$(docker compose -f docker-compose.prod.yml config --images | grep -m1 -- '-php')" composer install --no-dev --optimize-autoloader --no-interaction
docker compose -f docker-compose.prod.yml exec php php artisan migrate --pretend
docker compose -f docker-compose.prod.yml exec php php artisan migrate --force
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
docker compose -f docker-compose.prod.yml restart php scheduler
```

`backend/.env` o'zgartirilsa — `config:cache` ni qayta bajaring. Root `.env` dagi `NEXT_PUBLIC_*` o'zgartirilsa — `build frontend`.

## 12. Deploy checklist

**Kod va repo**
- [ ] Barcha kerakli fayllar commit qilingan va GitHub'da (repo private)
- [ ] `git status` da `.env`, `backend/.env`, `storage/`, sertifikatlar yo'q

**Server**
- [ ] DNS: `kiddo.uz`, `www.kiddo.uz`, `api.kiddo.uz` → VPS IP
- [ ] Firewall: faqat 22 / 80 / 443
- [ ] Docker 24+, Compose 2.20+, certbot 2.3+

**Konfiguratsiya**
- [ ] Root `.env`: `DB_PASSWORD` (kuchli), `NEXT_PUBLIC_API_URL=https://api.kiddo.uz/api`
- [ ] `backend/.env`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY`, `APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, `BILLING_ENABLED=false`; `DB_*` bo'sh; `KIDDO_DEV_*` yo'q
- [ ] Ikkala `.env` — `chmod 600`
- [ ] `backend/storage`, `backend/bootstrap/cache` egasi `1000:1000`

**O'rnatish**
- [ ] `composer install --no-dev`
- [ ] `migrate --pretend` ko'rib chiqildi → `migrate --force` → Pending: 0
- [ ] `config:cache`, `route:cache`, `event:cache`
- [ ] Sertifikat olindi; `certbot renew --dry-run` muvaffaqiyatli; deploy-hook nginx'ni qayta yuklaydi
- [ ] Super Admin yaratildi

**Tekshiruv**
- [ ] 9-bo'limdagi barcha buyruqlar kutilgan natijani berdi
- [ ] Brauzerda: Super Admin, bog'cha rahbari, tarbiyachi bilan kirish; `/ota-ona` axborot sahifasi
- [ ] Mobil ilova `https://api.kiddo.uz/api` bilan login qiladi
- [ ] Zaxira nusxa cron'i sozlandi va tiklash bir marta sinab ko'rildi
