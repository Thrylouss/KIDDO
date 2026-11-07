<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Production'da faqat FRONTEND_URL. Lokal/test muhitida frontend doim http://localhost:3000 —
    // FRONTEND_URL boshqa qiymatga o'rnatilgan bo'lsa ham login "tarmoq xatosi" bilan to'xtamasligi uchun.
    // (Auth cookie SameSite=Strict: frontend va API bir xil hostname'da — localhost — bo'lishi shart.)
    'allowed_origins' => array_values(array_unique(array_merge(
        [env('FRONTEND_URL', 'http://localhost:3000')],
        env('APP_ENV') === 'production' ? [] : ['http://localhost:3000'],
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
