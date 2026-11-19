# Reliz: KIDDO Smart Safety & IoT (Tez kunda · DEMO)

Holat: **taqdimot uchun to'liq ishlaydigan simulyatsiya + uskunaga tayyor backend qatlami**. Haqiqiy uskuna ulanmagan.
Ikkala qism ham feature flag bilan **standart o'chiq** — deploy qilinganda hech narsa ko'rinmaydi va hech qanday endpoint ochilmaydi.

## Feature flaglar

| Flag | Joyi | Standart | Ta'siri |
|---|---|---|---|
| `NEXT_PUBLIC_SMART_SAFETY_DEMO` | root `.env` (frontend build) | yo'q (= o'chiq) | `true` — sidebar bandlari, `/smart-safety` taqdimot sahifasi, landing'dagi «Tez kunda» bo'limi |
| `SMART_SAFETY_ENABLED` | `backend/.env` | `false` | `true` — `/api/v1/smart-safety/*` va `/api/v1/iot/ingest` ochiladi (aks holda 404) |

Taqdimot (frontend simulyator) backend flag'iga bog'liq emas: u **faqat brauzerdagi sintetik ma'lumot** bilan ishlaydi,
hech qanday API'ga murojaat qilmaydi, haqiqiy davomatga yozmaydi va ota-onalarga hech narsa yubormaydi.

## Database (5 ta yangi jadval, qaytariladigan)

| Migratsiya | Jadval |
|---|---|
| `2026_11_19_000047_create_iot_devices_table` | `iot_devices` (soft delete; gateway tokeni faqat sha256 xeshi) |
| `2026_11_19_000048_create_iot_device_assignments_table` | `iot_device_assignments` |
| `2026_11_19_000049_create_safety_zones_table` | `safety_zones` |
| `2026_11_19_000050_create_iot_events_table` | `iot_events` (`dedup_key` unique) |
| `2026_11_19_000051_create_safety_incidents_table` | `safety_incidents` |

Mavjud jadvallarga `ALTER/DROP/UPDATE/DELETE` yo'q; rasmiy `attendances` jadvaliga yozilmaydi.
Dev bazasi nusxasida sinaldi: oldin/keyin ma'lumot snapshot'i bir xil; qayta ishga tushirish — «Nothing to migrate»;
`migrate:rollback --step=5` faqat shu 5 jadvalni olib tashlaydi.

## Yangi endpointlar (hammasi `smart_safety` feature flag ortida)

| Metod | Yo'l | Rol |
|---|---|---|
| GET | `/api/v1/smart-safety/status` | admin, teacher, super_admin |
| GET/POST | `/api/v1/smart-safety/director/devices` | admin (o'z bog'chasi) |
| DELETE | `/api/v1/smart-safety/director/devices/{id}` | admin |
| PUT/DELETE | `/api/v1/smart-safety/director/devices/{id}/assignment` | admin |
| POST | `/api/v1/smart-safety/director/devices/{id}/token` | admin (gateway tokeni bir marta ko'rsatiladi) |
| GET/POST | `/api/v1/smart-safety/director/zones` | admin |
| PUT/DELETE | `/api/v1/smart-safety/director/zones/{id}` | admin |
| GET | `/api/v1/smart-safety/director/incidents` | admin |
| PATCH | `/api/v1/smart-safety/director/incidents/{id}/acknowledge` · `/resolve` | admin |
| GET | `/api/v1/smart-safety/director/events` | admin (IoT audit) |
| GET | `/api/v1/smart-safety/teacher/incidents` | teacher (faqat o'z guruhlari) |
| PATCH | `/api/v1/smart-safety/teacher/incidents/{id}/acknowledge` · `/resolve` | teacher |
| GET | `/api/v1/smart-safety/super-admin/overview` | super_admin (faqat agregat sonlar) |
| POST | `/api/v1/iot/ingest` | gateway (`Authorization: Bearer <token>`), `throttle:120,1` |

Insident qoidasi: **qabul qilish yopmaydi**; yechish faqat qabul qilingandan keyin va izoh bilan. Eskalatsiya — scheduler
(har daqiqa, faqat flag yoqilganda), qabul qilinmagan ochiq insident `SMART_SAFETY_ESCALATION_MINUTES` (3) dan keyin.

## Uskuna integratsiyasiga tayyorlik

- `app/Iot`: `DeviceProvider` interfeysi, `Transport` (http_push · rest_pull · websocket · mqtt), `NormalizedEvent`,
  `EventQueue` (vaqt tartibi — gateway buferi), `EventDeduplicator`, `LocationEngine` (koordinata yoki ankerlar RSSI bo'yicha
  og'irlikli markaz — taxminiy), `GeofenceEngine`, `AttendanceDeduplicator`, `NotificationDispatcher` (standart — faqat log).
- Provayderlar: **Demo** (ishlaydi, faqat HTTP push), **BlueIOT / MOKOSmart / Minew** — interfeys bor, `isAvailable()=false`;
  endpoint, autentifikatsiya va format **taxmin qilinmagan**, rasmiy hujjat va kalitlar kelgach yoziladi.
- Real o'rnatishda mahalliy mustaqil ovozli signal (gateway/sirena) majburiy — brauzer signali yagona kanal emas.

## Staging → production tartibi

1. **Staging'ga** deploy (`RELEASE-2026-11-kiddo-kids.md` dagi 0–6-qadamlar bilan bir xil: backup, `git pull --ff-only`,
   build, `migrate --pretend` → faqat `create table iot_*/safety_*` (+ oldingi relizlarniki), `migrate --force`, cache, restart).
2. Staging'da flaglarni yoqib (`SMART_SAFETY_ENABLED=true`, `NEXT_PUBLIC_SMART_SAFETY_DEMO=true` + frontend rebuild) taqdimotni tekshirish.
3. Production'ga — faqat ruxsatdan keyin, **flaglar o'chiq** holatda (migratsiyalar bo'sh jadval yaratadi, xatti-harakat o'zgarmaydi).
4. Taqdimot kerak bo'lsa: faqat frontend flag (`NEXT_PUBLIC_SMART_SAFETY_DEMO=true`, `docker compose ... build frontend && up -d frontend`).
   Backend flag faqat real uskuna sinovi uchun.

Tekshiruv: `curl -s -o /dev/null -w '%{http_code}' https://api.kiddo-sad.uz/api/v1/smart-safety/status` → flag o'chiq bo'lsa `404`.

## Rollback

- Ko'rinishni o'chirish (eng tez): `NEXT_PUBLIC_SMART_SAFETY_DEMO` ni olib tashlash → frontend rebuild; `SMART_SAFETY_ENABLED=false` → `config:cache`.
- Jadvallarni olib tashlash (faqat Smart Safety ma'lumotlari yo'qoladi): yangi kod ishlab turganda
  `php artisan migrate:rollback --step=5 --force` (oldingi relizlar migratsiyalari ham shu partiyada bo'lsa — avval `migrate:status` bilan tekshiring).
- Kodni qaytarish: oldingi commit'ga `git checkout` + build + restart (`RELEASE-2026-11-kiddo-kids.md` → Rollback).

## Ma'lum cheklovlar

- Real uskuna ulanmagan; joylashuv aniqligi, batareya va sertifikat bo'yicha hech qanday da'vo yo'q.
- Taqdimot holati brauzerda (localStorage + BroadcastChannel) — bitta brauzer tablari sinxron; turli qurilmalar o'rtasida emas.
- Backend API uchun frontend UI hali ulanmagan (taqdimot simulyatorda ishlaydi) — real uskuna bosqichida ulanadi.
- Ota-ona mobil ilovasi — faqat responsive DEMO (native ilova alohida bosqich).
- Biometrik ma'lumot yig'ilmaydi; Smart Health — hamshira qo'lda kiritadigan demo.
