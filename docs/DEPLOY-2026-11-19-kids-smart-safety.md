# Server yangilash — KIDDO Kids + Smart xavfsizlik 2.0 (DEMO)

Sana: 2026-11-19 · `main` (`724a145` → shu reliz) · Server: `/opt/kiddo`, `docker-compose.prod.yml`.
Batafsil: `docs/RELEASE-2026-11-kiddo-kids.md`, `docs/RELEASE-2026-11-smart-safety.md`.

## Nima o'zgaradi

- **KIDDO Kids** — rahbar uchun kontent kutubxonasi, tarbiyachi uchun «Ta'lim va hordiq» sahifasi.
- **Smart xavfsizlik 2.0** — faqat **DEMO** (brauzerdagi simulyatsiya, «Tez kunda» belgisi), rahbar, tarbiyachi va Super Admin panellarida.
  Haqiqiy hardware integratsiyasi **o'chiq** (`SMART_SAFETY_ENABLED=false` → `/api/v1/smart-safety/*`, `/api/v1/iot/ingest` = 404).
- **9 ta yangi migratsiya**, hammasi faqat yangi jadval yaratadi (`educational_*` ×4, `iot_*` ×3, `safety_zones`, `safety_incidents`).
  Mavjud jadvallar va ma'lumotlar o'zgarmaydi. Seed yo'q.

## Taqiqlangan

`migrate:fresh`, `migrate:refresh`, `db:wipe`, `db:seed`, `git reset --hard`, `git push --force`, mavjud bog'chalarni o'zgartirish.

## 0. Tayyorgarlik

```bash
cd /opt/kiddo
git status --short                    # bo'sh bo'lishi kerak
echo "PREV=$(git rev-parse HEAD)" | tee /var/backups/kiddo-prev-commit.txt
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep -c Pending   # 0 bo'lishi kutiladi
```

## 1. Backup (majburiy)

```bash
TS=$(date +%Y%m%d-%H%M)
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /var/backups/kiddo-pre-$TS.dump
tar -czf /var/backups/kiddo-storage-pre-$TS.tar.gz -C /opt/kiddo/backend/storage app
chmod 600 /var/backups/kiddo-pre-$TS.*
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < /var/backups/kiddo-pre-$TS.dump | head -3
docker compose -f docker-compose.prod.yml exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from organizations where deleted_at is null"' \
  | tee /var/backups/kiddo-pre-$TS.counts    # bog'chalar soni — yozib qo'ying
```

Backup'ni server tashqarisiga ham nusxalang.

## 2. Kod

```bash
git fetch origin
git log --oneline HEAD..origin/main   # kutilgan commitlar
git pull --ff-only                    # fast-forward bo'lmasa — TO'XTANG
```

## 3. Konfiguratsiya (mavjud qiymatlarni o'chirmang, faqat qo'shing)

Root `.env`:
```
NEXT_PUBLIC_SMART_SAFETY_DEMO=true
```

`backend/.env`:
```
SMART_SAFETY_ENABLED=false
# KIDDO Kids (ixtiyoriy; bo'sh bo'lsa video ma'lumoti qo'lda kiritiladi)
YOUTUBE_API_KEY=
```

Tekshirish (qiymat chiqadi, parol chiqmaydi):
```bash
docker compose -f docker-compose.prod.yml config | grep -E 'NEXT_PUBLIC_(SMART_SAFETY_DEMO|DEMO_MODE)'
# NEXT_PUBLIC_DEMO_MODE: "false"
# NEXT_PUBLIC_SMART_SAFETY_DEMO: "true"
```

## 4. Build

```bash
docker compose -f docker-compose.prod.yml build php frontend
```

## 5. Migratsiya

```bash
docker compose -f docker-compose.prod.yml exec php php artisan migrate --pretend   # faqat CREATE TABLE bo'lishi kerak
docker compose -f docker-compose.prod.yml exec php php artisan migrate --force
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep -c Pending   # 0
```

## 6. Ishga tushirish

```bash
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
docker compose -f docker-compose.prod.yml restart php scheduler
docker compose -f docker-compose.prod.yml ps
```

## 7. Tekshiruv

```bash
curl -s https://api.kiddo-sad.uz/api/health                                                         # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' https://kiddo-sad.uz/login                                  # 200
curl -s -o /dev/null -w '%{http_code}\n' https://kiddo-sad.uz/smart-safety                           # 200
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/json' https://api.kiddo-sad.uz/api/v1/admin/kids/contents   # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Accept: application/json' https://api.kiddo-sad.uz/api/v1/iot/ingest   # 404 (hardware o'chiq)
docker compose -f docker-compose.prod.yml exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from organizations where deleted_at is null"'   # 1-qadamdagi son bilan bir xil
docker compose -f docker-compose.prod.yml logs --since=10m php frontend | grep -iE 'error|exception' | head
```

Brauzerda: rahbar, tarbiyachi, Super Admin bilan kirib, sidebar'da «Smart xavfsizlik» guruhini oching — har sahifada
«DEMO · Tez kunda» belgisi bo'lishi kerak. Rahbar paneli → «KIDDO Kids» kutubxonasi ochilishi kerak.

## Orqaga qaytarish

Tez (faqat Smart xavfsizlikni yashirish): root `.env` → `NEXT_PUBLIC_SMART_SAFETY_DEMO=false`, keyin
`docker compose -f docker-compose.prod.yml build frontend && docker compose -f docker-compose.prod.yml up -d frontend`.

To'liq (kod):
```bash
cd /opt/kiddo
PREV=$(cut -d= -f2 /var/backups/kiddo-prev-commit.txt)
git checkout "$PREV"
docker compose -f docker-compose.prod.yml build php frontend
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
```

Yangi jadvallar qolsa, eski kodga zarar yetmaydi. Ularni olib tashlash shart emas. Kerak bo'lsa, faqat kelishilgan holda
`php artisan migrate:rollback --step=9` ishlating. Ma'lumot tiklash faqat 1-qadamdagi backup'dan (`pg_restore`) bajariladi.
