<?php

namespace App\Providers;

use App\Models\User;
use App\Services\MobileSessionService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /** Bitta telefon + IP juftligiga daqiqasiga ruxsat etilgan login urinishlari. */
    public const LOGIN_PER_PHONE_IP = 5;

    /** Bitta telefonga barcha IP'lardan daqiqasiga (taqsimlangan parol tanlashga qarshi). */
    public const LOGIN_PER_PHONE = 10;

    /** Bitta IP'dan barcha telefonlarga daqiqasiga (password spraying'ga qarshi, NAT uchun zaxira bilan). */
    public const LOGIN_PER_IP = 30;

    /** Bitta IP'dan daqiqasiga mobil refresh so'rovlari. */
    public const MOBILE_REFRESH_PER_IP = 30;

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Controller'lar `int $id` qabul qiladi — raqam bo'lmagan qiymat TypeError (500) o'rniga 404
        Route::pattern('id', '[0-9]+');
        Route::pattern('parentId', '[0-9]+');

        RateLimiter::for('login', function (Request $request) {
            // Login (telefon yoki username) — web «login», eski klient va mobil «phone» maydoni
            $phone = mb_strtolower(preg_replace('/\s+/', '', (string) ($request->input('login') ?? $request->input('phone'))));
            $ip    = (string) $request->ip();

            // Kalitlar hash qilinadi — telefon raqami cache kalitida ochiq saqlanmaydi
            return [
                Limit::perMinute(self::LOGIN_PER_PHONE_IP)->by('login:pi:' . sha1($phone . '|' . $ip)),
                Limit::perMinute(self::LOGIN_PER_PHONE)->by('login:p:' . sha1($phone)),
                Limit::perMinute(self::LOGIN_PER_IP)->by('login:i:' . sha1($ip)),
            ];
        });

        // Landing DEMO arizasi: IP bo'yicha 5/daqiqa va 20/kun
        RateLimiter::for('demo-requests', fn (Request $request) => [
            Limit::perMinute(5)->by('demo-req-m:' . sha1((string) $request->ip())),
            Limit::perDay(20)->by('demo-req-d:' . sha1((string) $request->ip())),
        ]);

        RateLimiter::for('mobile-refresh', fn (Request $request) =>
            Limit::perMinute(self::MOBILE_REFRESH_PER_IP)->by('mobile-refresh:' . sha1((string) $request->ip()))
        );

        // Har bir token so'rovida (web va mobil):
        //  - mobil refresh token API'ga kirish uchun ishlatilmaydi (faqat /v1/mobile/token/refresh);
        //  - foydalanuvchi yoki uning bog'chasi faol bo'lmasa token qabul qilinmaydi.
        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $token, bool $isValid): bool {
            if (! $isValid || MobileSessionService::isRefreshToken($token)) {
                return false;
            }

            return $token->tokenable instanceof User && $token->tokenable->canAuthenticate();
        });
    }
}
