# KIDDO — Claude Code Yo'riqnomasi

## Loyiha haqida

KIDDO — O'zbekistondagi bog'chalar uchun oddiy SaaS platforma. Laravel API backend + Next.js frontend, Docker bilan.

## Foydalanuvchi rollari

| Rol     | Tavsif                       |
|---------|------------------------------|
| admin   | Bog'cha ma'muri              |
| teacher | Tarbiyachi                   |
| parent  | Ota-ona                      |

## Muhim arxitektura qarorlari

- Har bir bog'cha (`kindergarten`) to'liq izolyatsiya qilingan — boshqa bog'cha ma'lumotlari hech qachon oshkor etilmasin.
- Foydalanuvchiga ko'rinadigan barcha matnlar O'ZBEK TILIDA bo'lishi shart.
- Til infratuzilmasi keyinchalik kengaytirish uchun tayyorlansin, lekin hozir til tanlash UI ko'rsatilmasin.
- Laravel Sanctum — API autentifikatsiya uchun.
- Har bir DB o'zgarishi migration orqali amalga oshirilsin.
- RESTful API: `/api/v1/...` formatida.

## Kodlash qoidalari

### Backend (Laravel)
- Controllers faqat HTTP so'rov/javob bilan shug'ullanadi — biznes mantiq Service yoki Model ichida bo'lsin.
- `App\Models\User::ROLE_*` konstantalaridan foydalaning.
- Policy yoki Gate orqali RBAC ni tekshiring, controller ichida `if ($user->role ===)` yozmang.
- Migration fayllarda `softDeletes()` ni foydalaning (muhim jadvallar uchun).
- `kindergarten_id` scope ni barcha relevant so'rovlarda qo'llang.

### Frontend (Next.js)
- App Router arxitekturasi.
- Server Components asosiy, Client Components faqat interaktivlik kerak bo'lganda.
- `src/app/` — sahifalar, `src/components/` — UI komponentlar, `src/lib/` — yordamchi funksiyalar.
- API so'rovlari `src/lib/api.ts` orqali.
- Barcha UI matnlari `src/i18n/uz.ts` lug'atidan olinsin (hozir faqat uz).

## MVP Modullari (navbatma-navbat quring)

- [ ] Auth (login/logout, token)
- [ ] Kindergartens (CRUD, admin)
- [ ] Groups (CRUD)
- [ ] Children (CRUD)
- [ ] Parents (CRUD, children bilan bog'liq)
- [ ] Teachers (CRUD, groups bilan bog'liq)
- [ ] Attendance (kunlik, guruh bo'yicha)
- [ ] Daily Activities (faoliyat yozuvlari)
- [ ] Meals (ovqatlanish)
- [ ] Sleep Records (uyqu)
- [ ] Photos/Media (rasm yuklash)
- [ ] Messaging (xabar almashish)
- [ ] Payment Status (to'lov holati)
- [ ] Dashboard (statistika)

## Buyruqlar

```bash
make setup         # Birinchi marta o'rnatish
make up            # Ishga tushirish
make down          # To'xtatish
make migrate       # Migratsiya
make test          # Testlar
make shell-php     # PHP shell
make logs          # Loglar
```

## API sog'liq tekshiruvi

`GET /api/health` — dastur ishlayotganini tekshiradi.

## Muhit

- Backend: `backend/.env` (backend/.env.example dan nusxa)
- Root: `.env` (Docker Compose uchun)

## Yangi modul qo'shish tartibi

1. Migration → Model → Controller → Route → Policy → Test
2. `routes/api.php` ga `v1` prefix bilan qo'shing
3. OpenAPI annotatsiya qo'shing (keyinchalik)
4. Frontend: API funksiyasi `src/lib/api.ts` → Page/Component → i18n matni

## Qoidalar eslatmasi

- Ortiqcha murakkablashmaing.
- Faqat MVP spetsifikatsiyasidagi xususiyatlarni quring.
- Ishlaydigan kodni qayta yozmang.
- Parollarni tekst ko'rinishida saqlamang.
- Sirlarni environment variable orqali saqlang.
