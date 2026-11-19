# Reliz: KIDDO Kids — Ta'lim va hordiq

Production: **https://kiddo-sad.uz** (API: **https://api.kiddo-sad.uz**). Asos: [`DEPLOYMENT.md`](../DEPLOYMENT.md) 10–11-bo'limlar
(u hujjatda domen `kiddo.uz` deb yozilgan — quyidagi buyruqlarda haqiqiy domen ishlatiladi).
Buyruqlar server'dagi loyiha papkasida (`DEPLOYMENT.md` bo'yicha `/opt/kiddo`) bajariladi.

> **Muhim:** 2026-11-18 holatiga ko'ra production'da oldingi reliz (Dark Mode, UZ/RU/EN, DEMO arizani o'chirish —
> [`RELEASE-2026-11-dark-mode-i18n.md`](RELEASE-2026-11-dark-mode-i18n.md)) ham hali deploy qilinmagan
> (sahifada `data-theme` atributi yo'q). Bu deploy ikkala relizni birga chiqaradi.

## Nima o'zgaradi

| Qism | O'zgarish |
|---|---|
| Rahbar paneli | **KIDDO Kids → Kontent kutubxonasi**: YouTube havolasi bilan kontent qo'shish, avtomatik (ehtiyotkor) tavsiyalar, til/kategoriya/yosh, guruhlarga biriktirish, tahrirlash, yashirish, o'chirish, foydalanish tarixi |
| Tarbiyachi paneli | **KIDDO Kids → Ta'lim va hordiq**: faqat o'z guruhiga biriktirilgan va yoshiga mos kontent, kategoriyalar, sevimlilar, YouTube embed pleyer (to'liq ekran), mashg'ulotda foydalanishni qayd etish |
| Super Admin | O'zgarish yo'q — kontentni ko'rmaydi va boshqarmaydi (API 403) |
| Xavfsizlik | Frontend CSP'ga `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com` qo'shildi |

## Database migratsiyalari (faqat yangi jadvallar)

| Migratsiya | Jadval |
|---|---|
| `2026_11_18_000043_create_educational_contents_table` | `educational_contents` (soft delete) |
| `2026_11_18_000044_create_educational_content_groups_table` | `educational_content_groups` |
| `2026_11_18_000045_create_educational_content_favorites_table` | `educational_content_favorites` |
| `2026_11_18_000046_create_educational_content_usage_logs_table` | `educational_content_usage_logs` |

- Mavjud jadvallarga `ALTER`/`DROP`/`UPDATE`/`DELETE` **yo'q**. Har bir migratsiyada `Schema::hasTable` himoyasi bor.
- Dev bazasi nusxasida sinaldi (31 bog'cha, 82 guruh, 930 foydalanuvchi, 949 bola, 8972 davomat): migratsiyadan oldin va keyin
  ma'lumot snapshot'i bir xil; qayta ishga tushirish — «Nothing to migrate»; `rollback --step=4` faqat 4 ta yangi jadvalni olib tashlaydi.
- Ehtimol `2026_11_08_000042_create_territories_table` ham Pending bo'ladi (oldingi relizdan) — u ham faqat yangi, bo'sh jadval.
- `migrate:fresh`, `migrate:refresh`, `db:wipe`, `db:seed` — **taqiqlangan**.

## Environment

- Majburiy yangi o'zgaruvchi **yo'q**.
- Ixtiyoriy: `backend/.env` ga `YOUTUBE_API_KEY=` (YouTube Data API v3). Bo'sh qolsa modul ishlaydi: nom va thumbnail
  bepul oEmbed orqali olinadi, qolganini rahbar qo'lda kiritadi. Kalit faqat backend'da ishlatiladi. Pullik servis yoqilmaydi.
- Backend server `www.youtube.com/oembed` ga chiqish (HTTPS, 443) imkoniga ega bo'lishi kerak; bo'lmasa — qo'lda kiritish.

## Deploy qadamlari

### 0. Tayyorgarlik
```bash
cd /opt/kiddo
git status --short                       # bo'sh bo'lishi kerak
git log --oneline -1                     # joriy commit
echo "PREV=$(git rev-parse HEAD)" | tee /var/backups/kiddo-prev-commit.txt
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep Pending   # hozirgi holat — yozib qo'ying
```

### 1. Backup (majburiy)
```bash
TS=$(date +%F-%H%M)
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /var/backups/kiddo-pre-$TS.dump
tar -czf /var/backups/kiddo-storage-pre-$TS.tar.gz -C /opt/kiddo/backend/storage app
chmod 600 /var/backups/kiddo-pre-$TS.dump /var/backups/kiddo-storage-pre-$TS.tar.gz
ls -lh /var/backups/kiddo-pre-$TS.dump
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < /var/backups/kiddo-pre-$TS.dump | head -3
docker compose -f docker-compose.prod.yml exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from organizations where deleted_at is null"' | tee /var/backups/kiddo-pre-$TS.counts
```
Backup'ni server tashqarisiga ham nusxalang.

### 2. Kod
```bash
git fetch origin
git log --oneline HEAD..origin/main      # kutilgan commitlar
git pull --ff-only                       # fast-forward bo'lmasa — TO'XTANG
```

### 3. Build
```bash
docker compose -f docker-compose.prod.yml build php frontend
PHP_IMAGE=$(docker compose -f docker-compose.prod.yml config --images | grep -m1 -- '-php')
docker run --rm -u "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer -v "$PWD/backend:/var/www/html" -w /var/www/html \
  "$PHP_IMAGE" composer install --no-dev --optimize-autoloader --no-interaction
```
Root `.env` dagi `NEXT_PUBLIC_API_URL` = `https://api.kiddo-sad.uz/api` ekanini tekshiring (build vaqtida yoziladi).

### 4. Migratsiya
```bash
docker compose -f docker-compose.prod.yml exec php php artisan migrate --pretend
#   Kutilgan: faqat «create table territories / educational_*» va ularning «add constraint» qatorlari.
#   Boshqa jadvalga ALTER/DROP/DELETE ko'rinsa — TO'XTANG va xabar bering.
docker compose -f docker-compose.prod.yml exec php php artisan migrate --force
docker compose -f docker-compose.prod.yml exec php php artisan migrate:status | grep -c Pending       # 0
```

### 5. Restart
```bash
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
docker compose -f docker-compose.prod.yml restart php scheduler
docker compose -f docker-compose.prod.yml ps
```

### 6. Health check
```bash
curl -s https://api.kiddo-sad.uz/api/health                                     # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' https://kiddo-sad.uz/login              # 200
curl -sI https://kiddo-sad.uz/login | grep -i content-security-policy           # frame-src ... youtube-nocookie ...
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/json' https://api.kiddo-sad.uz/api/v1/admin/kids/contents     # 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/json' https://api.kiddo-sad.uz/api/v1/teacher/kids/contents   # 401
docker compose -f docker-compose.prod.yml exec php php artisan route:list --path=kids    # 12 ta marshrut
docker compose -f docker-compose.prod.yml exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from organizations where deleted_at is null"'   # 1-qadamdagi son bilan bir xil
docker compose -f docker-compose.prod.yml logs --since=10m php frontend | grep -iE 'error|exception' | head
```

**Brauzerda (haqiqiy ma'lumotni o'zgartirmasdan):**
- [ ] Super Admin: login, bog'chalar ro'yxati ochiladi; sidebar'da KIDDO Kids yo'q
- [ ] Rahbar: asosiy panel, bolalar, guruhlar; **KIDDO Kids → Kontent kutubxonasi** ochiladi (bo'sh holat)
- [ ] Tarbiyachi: bosh sahifa, davomat; **KIDDO Kids → Ta'lim va hordiq** ochiladi
- [ ] Til (UZ/RU/EN) va mavzu (Yorug'/Qorong'i/Tizim) almashadi
- [ ] Sinov kontenti qo'shilsa — rahbar bilan kelishib, keyin o'chiriladi (soft delete, tarix saqlanadi)

## Rollback

Odatda kodni qaytarish kifoya — yangi jadvallar qolsa ham eski kod ularni ishlatmaydi.
```bash
cd /opt/kiddo
PREV=$(cut -d= -f2 /var/backups/kiddo-prev-commit.txt)
git checkout "$PREV"
docker compose -f docker-compose.prod.yml build php frontend
docker compose -f docker-compose.prod.yml up -d php frontend scheduler nginx
docker compose -f docker-compose.prod.yml exec php sh -c 'php artisan config:cache && php artisan route:cache && php artisan event:cache'
docker compose -f docker-compose.prod.yml restart php scheduler
curl -s https://api.kiddo-sad.uz/api/health
```
Yangi jadvallarni olib tashlash kerak bo'lsa (faqat KIDDO Kids ma'lumotlari yo'qoladi, qolgan ma'lumotlarga tegmaydi) —
**kod qaytarilishidan OLDIN**, yangi kod ishlab turganda:
```bash
docker compose -f docker-compose.prod.yml exec php php artisan migrate:rollback --step=4 --force
```
Bazani to'liq tiklash (`pg_restore --clean`) — faqat haqiqiy ma'lumot yo'qolgan bo'lsa va jamoa bilan kelishilgandan keyin
(backup'dan keyingi barcha o'zgarishlar yo'qoladi). Buyruq: `RELEASE-2026-11-dark-mode-i18n.md` → 7-bo'lim.

## Ma'lum cheklovlar

- Avtomatik tavsiyalar kalit so'zlar asosida taxminiy — videoning bolalar uchun xavfsizligini kafolatlamaydi (UI'da ogohlantirish bor).
- Ba'zi videolar egasi tomonidan boshqa saytlarda ko'rsatish cheklangan (YouTube 101/150 xatosi) — pleyer tushunarli xabar va
  «YouTube'da ochish» havolasini ko'rsatadi. oEmbed bunday cheklovni har doim oldindan aniqlay olmaydi.
- Davomiylik faqat `YOUTUBE_API_KEY` berilganda ko'rsatiladi.
- Ota-onalar uchun web panel yo'q (mobil ilova — alohida bosqich).
