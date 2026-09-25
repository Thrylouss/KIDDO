# KIDDO

Bog'cha boshqaruv platformasi — O'zbekiston bog'chalari uchun oddiy va tez SaaS.

## Texnologiyalar

| Qatlam      | Texnologiya                |
|-------------|----------------------------|
| Backend     | Laravel 11, PHP 8.2        |
| Ma'lumotlar | PostgreSQL 16              |
| Frontend    | Next.js 15, TypeScript     |
| Stil        | Tailwind CSS               |
| Autentifikatsiya | Laravel Sanctum       |
| Docker      | PHP-FPM, Nginx, PostgreSQL |

## Foydalanuvchi rollari

- **ADMIN** — Bog'cha administratori
- **TEACHER** — Tarbiyachi
- **PARENT** — Ota-ona

## Boshlash

### Talablar

- Docker Desktop (ishga tushirilgan)
- Node.js 22+ (frontend uchun)
- GNU Make

### O'rnatish

```bash
# Loyihani clone qiling
git clone <repo-url> kiddo
cd kiddo

# To'liq sozlash (birinchi marta)
make setup
```

### Xizmatlar

| Xizmat    | URL                        |
|-----------|---------------------------|
| Frontend  | http://localhost:3000      |
| API       | http://localhost:8000/api  |
| pgAdmin   | http://localhost:5050      |

pgAdmin faqat `make tools` bilan ishga tushadi.

### Foydali buyruqlar

```bash
make up            # Barcha xizmatlarni ishga tushirish
make down          # To'xtatish
make logs          # Loglarni kuzatish
make migrate       # Migratsiyalarni bajarish
make test          # Testlarni ishga tushirish
make shell-php     # PHP konteyneriga kirish
make cache-clear   # Keshni tozalash
```

### API sog'liq tekshiruvi

```bash
curl http://localhost:8000/api/health
# {"status":"ok","app":"KIDDO","time":"..."}
```

## Papka tuzilmasi

```
kiddo/
├── backend/          # Laravel API
│   ├── app/
│   │   ├── Exceptions/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   └── Middleware/
│   │   ├── Models/
│   │   └── Providers/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── routes/
│   │   └── api.php
│   └── tests/
├── frontend/         # Next.js PWA
│   └── src/
│       └── app/
├── docker/
│   ├── nginx/
│   └── php/
├── docker-compose.yml
└── Makefile
```

## Muhit o'zgaruvchilari

`backend/.env.example` faylini `backend/.env` ga nusxalang va quyidagilarni sozlang:

```env
APP_KEY=         # php artisan key:generate bilan yaratiladi
DB_HOST=postgres
DB_DATABASE=kiddo
DB_USERNAME=kiddo
DB_PASSWORD=secret
```

## Litsenziya

Xususiy — barcha huquqlar himoyalangan.
