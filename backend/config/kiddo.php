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

    'telegram' => [
        'bot_token'    => env('TELEGRAM_BOT_TOKEN'),
        'chat_id'      => env('TELEGRAM_CHAT_ID'),
        'max_attempts' => (int) env('TELEGRAM_MAX_ATTEMPTS', 5),
    ],
];
