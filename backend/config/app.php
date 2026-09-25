<?php

return [
    'name'     => env('APP_NAME', 'KIDDO'),
    'env'      => env('APP_ENV', 'production'),
    'debug'    => (bool) env('APP_DEBUG', false),
    'url'      => env('APP_URL', 'http://localhost'),
    'timezone' => env('APP_TIMEZONE', 'Asia/Tashkent'),
    'locale'   => env('APP_LOCALE', 'uz'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'uz'),
    'faker_locale'    => env('APP_FAKER_LOCALE', 'uz_UZ'),
    'cipher'   => 'AES-256-CBC',
    'key'      => env('APP_KEY'),
    'previous_keys' => [
        ...array_filter(
            explode(',', env('APP_PREVIOUS_KEYS', ''))
        ),
    ],
    'maintenance' => ['driver' => 'file'],
    'providers' => Illuminate\Support\ServiceProvider::defaultProviders()->merge([
        App\Providers\AppServiceProvider::class,
    ])->toArray(),
];
