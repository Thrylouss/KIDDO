<?php

return [
    /*
     * DEV TEST MODE — lokal ishlab chiqish uchun umumiy test akkauntlari (kiddo:dev-accounts).
     * Faqat APP_ENV=local, KIDDO_DEV_TEST_MODE=true va baza nomi dev_test_database bilan bir xil bo'lganda ishlaydi.
     * Parol faqat muhit o'zgaruvchisida (git'ga kirmaydigan .env.dev) — kodda emas.
     */
    'dev_test_mode'     => (bool) env('KIDDO_DEV_TEST_MODE', false),
    'dev_test_database' => env('KIDDO_DEV_TEST_DATABASE', 'kiddo_dev'),
    'dev_test_password' => env('KIDDO_DEV_TEST_PASSWORD'),

    /*
     * Ixtiyoriy alohida DEV Super Admin (masalan, demo uchun oson login). Ikkalasi ham berilganda yaratiladi,
     * xuddi shu DEV TEST MODE shartlari bilan. Qiymatlar faqat .env.dev da — kod va git'da emas.
     */
    'dev_superadmin_username' => env('KIDDO_DEV_SUPERADMIN_USERNAME'),
    'dev_superadmin_password' => env('KIDDO_DEV_SUPERADMIN_PASSWORD'),

    /*
     * Landing «14 kunlik DEMO» arizalari Telegram'ga (faqat backend orqali). Token faqat .env da —
     * frontendga, bazaga yoki loglarga chiqmaydi. Berilmasa ariza bazada saqlanadi, holati «not_configured».
     */
    // KIDDO obuna/tarif/to'lov bo'limlari (MVP'da o'chiq). Frontend: src/lib/features.ts → BILLING_ENABLED
    'billing' => [
        'enabled' => (bool) env('BILLING_ENABLED', false),
    ],

    // KIDDO Smart Safety & IoT (Tez kunda). Standart — O'CHIQ: barcha endpointlar 404 qaytaradi.
    // Vendor adapterlari rasmiy API hujjati va kalitlar bo'lmaguncha ishlamaydi (faqat interfeys).
    'smart_safety' => [
        'enabled'                => (bool) env('SMART_SAFETY_ENABLED', false),
        'dedup_window_seconds'   => (int) env('SMART_SAFETY_DEDUP_SECONDS', 30),
        'escalation_minutes'     => (int) env('SMART_SAFETY_ESCALATION_MINUTES', 3),
        'offline_after_minutes'  => (int) env('SMART_SAFETY_OFFLINE_MINUTES', 5),
        'battery_low_percent'    => (int) env('SMART_SAFETY_BATTERY_LOW', 15),
        'providers' => [
            'demo'      => ['enabled' => (bool) env('SMART_SAFETY_DEMO_PROVIDER', true)],
            // Quyidagilar uchun endpoint/protokol taxmin qilinmaydi: rasmiy hujjat va kalitlar kelgach adapter yoziladi.
            'blueiot'   => ['enabled' => false],
            'mokosmart' => ['enabled' => false],
            'minew'     => ['enabled' => false],
        ],
    ],

    // KIDDO Kids: ixtiyoriy YouTube Data API kaliti (davomiylik, embeddable, madeForKids). Bo'sh bo'lsa —
    // bepul oEmbed ishlatiladi yoki rahbar ma'lumotni qo'lda kiritadi. Kalit faqat backend'da, frontend'ga chiqmaydi.
    'youtube' => [
        'api_key' => env('YOUTUBE_API_KEY'),
    ],

    'telegram' => [
        'bot_token'    => env('TELEGRAM_BOT_TOKEN'),
        'chat_id'      => env('TELEGRAM_CHAT_ID'),
        'max_attempts' => (int) env('TELEGRAM_MAX_ATTEMPTS', 5),
    ],
];
