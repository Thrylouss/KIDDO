# Smart xavfsizlik 2.0 — vazifaga asoslangan qo'llanuvchanlik tekshiruvi

Sana: 2026-11-19 · Muhit: lokal DEMO (`NEXT_PUBLIC_SMART_SAFETY_DEMO=true`), faqat sintetik ma'lumot.
Tekshiruvchi: ishlab chiquvchi (Claude Code) brauzerda qo'lda + avtomatik testlar. **Haqiqiy foydalanuvchilar (rahbar/tarbiyachi/ota-ona)
bilan sinov hali o'tkazilmagan** — quyidagi natijalar ularni almashtirmaydi, faqat oldindan tekshiruv.

«Bosish» — Smart xavfsizlik bosh sahifasidan vazifa bajarilguncha bosishlar soni.

## Tarbiyachi

| Vazifa | Yo'l | Bosish | Natija |
|---|---|---|---|
| Bolalar qayerda? | Bosh sahifa → «Jonli xarita» | 1 | ✅ |
| Kritik xabarga javob berish | Banner (har sahifada) → «Qabul qildim» | 1 | ✅ qabul qilish hodisani yopmaydi |
| Bolani xaritada topish | Banner → «Xaritada ko'rish» | 1 | ✅ bola va xavfli hudud belgilanadi |
| Hodisani yopish | Banner → «Hodisani yopish» → belgi + izoh → yopish | 2 (+kiritish) | ✅ belgisiz/izohsiz yopilmaydi |
| Hamma bola joyidami? | «Bolalarni sanash» → katta tugma | 2 | ✅ aniqlanmagan bola «Tekshirish kerak», «Ko'rdim — joyida» |
| Kim keldi/ketdi? | «Davomat» | 1 | ✅ «Qurilma aniqladi» ≠ «Tasdiqlangan» |
| Bolani topshirish | «Xavfsiz topshirish» → bola → shaxs → tekshirish → tasdiqlash | 1 + 3 qadam | ✅ ruxsatsiz shaxs rad etiladi |
| Quvvatlash kerak bilaguzuk | «Ogohlantirishlar» → Eslatmalar | 1 | ✅ «Asadbekning bilaguzugini quvvatlash kerak.» |
| Uyqu / ovqat | «Kunlik faollik» → karta | 2 | ✅ «tibbiy o'lchov emas» belgisi |

Texnik atamalar (IoT, API, gateway, firmware, qurilma kodlari) tarbiyachi sahifalarida yo'q — avtomatik test bilan tekshiriladi.

## Rahbar

| Vazifa | Yo'l | Bosish | Natija |
|---|---|---|---|
| Umumiy holatni bilish | Bosh sahifa (holat + 4 hisoblagich) | 0 | ✅ |
| Xarita, qidiruv, to'liq ekran | «Jonli xarita» | 1–2 | ✅ |
| Evakuatsiya va sanash | «Bolalar nazorati» → «Bolalarni sanash» → «Evakuatsiya» | 2–3 | ✅ yig'iladigan blokda |
| Qurilma muammolari | «Qurilmalar» → «E'tibor talab qiladi» | 1 | ✅ oddiy tilda |
| Bilaguzukni bolaga biriktirish | «Qurilmalar» → «Bolaga biriktirish» | 2 | ✅ |
| Texnik ma'lumot | «Qurilmalar» → «Batafsil» → «Texnik ma'lumot» | 3 | ✅ faqat kerak bo'lganda |
| Xavfsizlik hududlari | «Jonli xarita» → «Xavfsizlik hududlari» yoki «Sozlamalar» | 2 | ✅ |
| Hisobot / jurnal | «Hisobotlar» | 1 | ✅ |

## Super Admin

| Vazifa | Yo'l | Bosish | Natija |
|---|---|---|---|
| Bog'chalar holati | Bosh sahifa (4 KPI + holatlar) | 0 | ✅ bolalar haqida shaxsiy ma'lumot yo'q |
| Qurilma dasturi, ulanish, funksiyalar, jurnal | «Sozlamalar» → «Texnik boshqaruv» bloklari | 2 | ✅ jurnalda ismlar yashirilgan |

## Ota-ona (konsept)

| Vazifa | Natija |
|---|---|
| Bola keldimi? / Kim olib ketdi? / Xavfsizlik | ✅ bosh ekranda 3 ta javob kartasi |
| Boshqa bolalar ma'lumoti | ✅ ko'rinmaydi (test bilan tekshiriladi) |

## Topilgan va tuzatilgan muammolar

- Joyida turgan bolalar 2 daqiqadan keyin «Tekshirish kerak» bo'lib qolardi → simulyatsiyaga qurilma davriy signali qo'shildi.
- Ogohlantirish va holat banneri birga chiqardi → kritik holatda faqat bitta banner.
- DEMO belgisi taqdimotda ikki marta ko'rinardi → bitta.
- Kichik zonada (kirish) markerlar ustma-ust tushardi → zona atrofiga yoyiladi.
- 8-qadam hodisani avtomatik yopardi → taqdimotchi tekshiruvni jonli ko'rsatadi.

## Cheklovlar

- Mobil ko'rinish 520 px kenglikda tekshirildi (Chrome oynasi bundan torroq bo'lmadi); 390 px — keyingi sinovda.
- Yig'iladigan sidebar guruhi panel marshrutlarida unit test bilan tekshirildi, demo login orqali brauzerda alohida ko'rilmadi.
