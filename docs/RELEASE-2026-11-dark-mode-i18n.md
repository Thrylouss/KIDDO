# Reliz: Dark Mode, UZ/RU/EN interfeys va DEMO arizalarni o'chirish

Production deploy yo'riqnomasi (VPS, `docker-compose.prod.yml`). Asos: [`DEPLOYMENT.md`](../DEPLOYMENT.md), 10–11-bo'limlar.
Barcha buyruqlar `/opt/kiddo` papkasida bajariladi.

## Relizda nima bor

| Qism | O'zgarish | Bazaga ta'siri |
|---|---|---|
| Backend | `DELETE /api/v1/super-admin/demo-requests/{id}` (faqat Super Admin, `throttle:30,1`). Demo tashkilot bog'langan yoki demo faol bo'lsa — `409`. Faollik jurnaliga `demo_request.deleted` yoziladi | **Yangi migration yo'q.** Sxema o'zgarmaydi |
| Frontend | Light / Dark / System mavzu, UZ / RU / EN interfeys, Sozlamalar → «Interfeys» bo'limi | Yo'q (tanlov brauzerda saqlanadi) |

- Seed, `migrate:fresh`, `db:wipe` va boshqa destructive buyruqlar **ishlatilmaydi**.
- Mavjud bog'chalar, foydalanuvchilar va DEMO arizalar avtomatik o'zgartirilmaydi va o'chirilmaydi.
- `.env` fayllariga yangi o'zgaruvchi qo'shilmagan.

## 0. Oldindan

```bash
cd /opt/kiddo
git status --short                      # bo'sh bo'lishi kerak (serverda qo'lda o'zgartirish yo'q)
git log --oneline -1                    # joriy commit — ROLLBACK uchun yozib qo'ying
echo "PREV=$(git rev-parse HEAD)" | tee /var/backups/kiddo-prev-commit.txt
docker compose -f docker-compose.prod.yml ps   # hammasi Up, postgres (healthy)
```

## 1. Backup (majburiy)

```bash
TS=$(date +%F-%H%M)
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /var/backups/kiddo-pre-$TS.dump
tar -czf /var/backups/kiddo-storage-pre-$TS.tar.gz -C /opt/kiddo/backend/storage app
chmod 600 /var/backups/kiddo-pre-$TS.dump /var/backups/kiddo-storage-pre-$TS.tar.gz
ls -lh /var/backups/kiddo-pre-$TS.dump                          # hajmi 0 emasligini tekshiring
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < /var/backups/kiddo-pre-$TS.dump | head -5   # dump o'qiladi
```

Backup fayllarini server tashqarisiga ham nusxalang. Ularda shaxsiy ma'lumotlar bor — Git'ga qo'shilmasin.

## 2. Kodni yangilash

```bash
git fetch origin
git log --oneline HEAD..origin/main     # kutilgan relizning commitlari ko'rinadi
git pull --ff-only                      # fast-forward bo'lmasa — TO'XTANG va xabar bering
```

## 3. Build

```bash
docker compose -f docker-compose.prod.yml build php frontend
PHP_IMAGE=$(docker compose -f docker-compose.prod.yml config --images | grep -m1 -- '-php')
docker run --rm -u "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer \
  -v "$PWD/backend:/var/www/html" -w /var/www/html "$PHP_IMAGE" \
  composer install --no-dev --optimize-autoloader --no-interaction
```

Frontend build `NEXT_PUBLIC_*` qiymatlarini root `.env` dan oladi; `NEXT_PUBLIC_DEMO_MODE` compose'da `false`.

## 4. Migration (bu relizda bajariladigan migration yo'q)

```bash
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep -c Pending   # kutilgan: 0
docker compose -f docker-compose.prod.yml exec php php artisan migrate --pretend                   # kutilgan: «Nothing to migrate»
```

Agar `Pending` 0 dan katta bo'lsa yoki `--pretend` SQL ko'rsatsa — **to'xtang** va xabar bering:
bu reliz migration qo'shmaydi, demak server kutilmagan holatda. `migrate --force` faqat kelishilgandan keyin.

## 5. Ishga tushirish (restart)

```bash
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c \
  'php artisan config:cache && php artisan route:cache && php artisan event:cache'   # yangi DELETE marshruti uchun route:cache shart
docker compose -f docker-compose.prod.yml restart php scheduler
docker compose -f docker-compose.prod.yml ps
```

## 6. Health check

```bash
curl -s https://api.kiddo.uz/api/health                                         # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' https://kiddo.uz/                       # 200
curl -s -o /dev/null -w '%{http_code}\n' https://kiddo.uz/login                  # 200
curl -s -H 'Accept: application/json' https://api.kiddo.uz/api/v1/me            # 401
# Yangi endpoint mavjud va himoyalangan (autentifikatsiyasiz → 401, hech narsa o'chirilmaydi):
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H 'Accept: application/json' \
  https://api.kiddo.uz/api/v1/super-admin/demo-requests/999999999                 # 401
docker compose -f docker-compose.prod.yml exec php php artisan route:list --path=demo-requests   # DELETE qatori bor
docker compose -f docker-compose.prod.yml logs --since=10m php frontend | grep -iE 'error|exception' | head
```

**Brauzerda (Super Admin, bog'cha rahbari, tarbiyachi):**
- [ ] Header'dagi til tugmasi: O'zbekcha / Русский / English — sahifa qayta yuklanmasdan almashadi, tanlov saqlanadi
- [ ] Mavzu tugmasi: Yorug' / Qorong'i / Tizim; Sozlamalar → «Interfeys» bilan sinxron
- [ ] Dark rejimda jadval, modal, input, sidebar, bildirishnomalar o'qiladi
- [ ] Super Admin → DEMO arizalari: «O'chirish» tugmasi va tasdiqlash oynasi ko'rinadi.
      **Haqiqiy arizani sinov uchun o'chirmang** — tugma va oynani ko'rish kifoya (Bekor qilish)
- [ ] Mobil ilova login qiladi (API o'zgarmagan)

## 7. Rollback

Bu reliz bazani o'zgartirmaydi, shuning uchun odatda faqat kodni qaytarish kifoya.

```bash
cd /opt/kiddo
PREV=$(cut -d= -f2 /var/backups/kiddo-prev-commit.txt)
git checkout "$PREV"                         # detached HEAD — vaqtinchalik holat
docker compose -f docker-compose.prod.yml build php frontend
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c \
  'php artisan config:cache && php artisan route:cache && php artisan event:cache'
docker compose -f docker-compose.prod.yml restart php scheduler
curl -s https://api.kiddo.uz/api/health
```

Muammo tuzatilgach `main` ga qaytish: `git checkout main && git pull --ff-only` va 3–6-qadamlar.

**Bazani tiklash — faqat haqiqiy ma'lumot yo'qolgan bo'lsa** va jamoa bilan kelishilgandan keyin
(backup vaqtidan keyingi barcha o'zgarishlar yo'qoladi):

```bash
docker compose -f docker-compose.prod.yml stop php scheduler frontend
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < /var/backups/kiddo-pre-<TS>.dump
docker compose -f docker-compose.prod.yml start php scheduler frontend
```

Bitta DEMO arizasi xato o'chirilgan bo'lsa, butun bazani tiklamang — backup'dan faqat o'sha yozuvni alohida
bazaga tiklab ko'chirish mumkin (oldin xabar bering).

## 8. Ma'lum cheklovlar

- Backend'dan keladigan validatsiya va server xabarlari hozircha faqat o'zbekcha.
- Sahifa `<title>` va SEO matnlari o'zbekcha.
- DEMO arizasi butunlay o'chiriladi (soft delete yo'q); iz faollik jurnalida qoladi.
