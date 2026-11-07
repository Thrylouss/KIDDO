<?php

use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\SecureHeadersMiddleware;
use App\Http\Middleware\TokenFromCookieMiddleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Exceptions\MissingAbilityException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role'      => RoleMiddleware::class,
            'super_admin.read_only' => \App\Http\Middleware\SuperAdminReadOnlyMiddleware::class,
            'password.changed'      => \App\Http\Middleware\EnsurePasswordChangedMiddleware::class,
            'abilities' => CheckAbilities::class,
            'billing'   => \App\Http\Middleware\EnsureBillingEnabled::class,
        ]);

        // Faqat API: mehmonni route('login') ga yo'naltirish yo'q (bunday route yo'q edi —
        // Accept: application/json sarlavhasisiz so'rov 401 o'rniga 500 berardi).
        // AuthenticationException quyidagi renderer orqali o'zbekcha 401 JSON qaytaradi.
        $middleware->redirectGuestsTo(fn () => null);

        // TokenFromCookieMiddleware must be global, NOT api-group-only.
        //
        // Why: same priority-sort issue as SecureHeadersMiddleware below.
        // Laravel's $middlewarePriority puts Authenticate (auth:sanctum) at
        // index 5 and SubstituteBindings at index 9.  Any middleware appended
        // to the api group after SubstituteBindings has no explicit priority,
        // so it gets sorted AFTER auth:sanctum runs.  When auth:sanctum fires
        // first, the Authorization header is still absent (the cookie has not
        // been converted yet) → 401.  Moving this middleware to the global
        // stack guarantees it runs in the outer pipeline, before any route or
        // group middleware, so the Bearer token is in place when auth:sanctum
        // eventually runs.
        $middleware->append(TokenFromCookieMiddleware::class);

        // SecureHeadersMiddleware must be global, NOT api-group-only.
        //
        // Why: Laravel's $middlewarePriority sorts Authenticate (auth:sanctum)
        // before any custom api-group middleware. That makes SecureHeaders the
        // INNERMOST pipe — so it is never reached when auth fails (401) or when
        // no route matches (404). Moving it to the global stack makes it the
        // outermost wrapper; its try-catch then catches the NotFoundHttpException
        // for 404s, and the 401 rendered inside the route pipeline is returned
        // through $next() for the global pipeline to add headers to.
        $middleware->append(SecureHeadersMiddleware::class);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Production'da docker-compose.prod.yml → «scheduler» servisi (php artisan schedule:work) ishga tushiradi.
        // withoutOverlapping — oldingi ishga tushirish tugamaguncha yangisi boshlanmaydi;
        // onOneServer — scheduler tasodifan ikki nusxada ishlasa ham vazifa bir marta bajariladi (cache lock: CACHE_STORE=database).
        $schedule->command('subscriptions:check-expiry')->daily()
            ->when(fn () => (bool) config('kiddo.billing.enabled'))
            ->withoutOverlapping()->onOneServer();
        // Remove DB rows for tokens that expired more than 24 h ago.
        // sanctum:prune-expired o'rniga: u 30 kunlik mobil refresh tokenlarni created_at bo'yicha
        // 7 kundan keyin o'chirib yuborardi (App\Console\Commands\PruneExpiredTokens).
        $schedule->command('tokens:prune-expired --hours=24')->daily()->withoutOverlapping()->onOneServer();
        // Telegramga yetib bormagan DEMO arizalarini qayta yuborish (ariza bazada saqlangan bo'ladi)
        // Vaqtincha to'xtatish muddati tugagan bog'chalar avtomatik faollashadi
        $schedule->command('kiddo:organizations:resume-suspended')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();
        $schedule->command('kiddo:demo-requests:retry-telegram')->everyFifteenMinutes()->withoutOverlapping()->onOneServer();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Only report to Sentry in non-debug mode (production/staging).
        // APP_DEBUG=true means local dev — we must never send dev noise to Sentry.
        if (! config('app.debug')) {
            \Sentry\Laravel\Integration::handles($exceptions);
        }

        $exceptions->render(function (AuthenticationException $e) {
            return response()->json(['message' => 'Tizimga kirishingiz kerak.'], 401);
        });

        $exceptions->render(function (NotFoundHttpException $e) {
            return response()->json(['message' => 'Ma\'lumot topilmadi.'], 404);
        });

        // 403 (Policy / Gate::authorize va abort(403)) — faqat xabar, ichki tafsilotsiz.
        // Policy xabarlari o'zbekcha va foydalanuvchiga mo'ljallangan.
        $exceptions->render(function (HttpException $e) {
            // 429 (throttle) va 405 — standart inglizcha xabar o'rniga o'zbekcha; Retry-After sarlavhalari saqlanadi
            if ($e->getStatusCode() === 429) {
                return response()->json(['message' => "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring."], 429, $e->getHeaders());
            }
            if ($e->getStatusCode() === 405) {
                return response()->json(['message' => "Bu amal qo'llab-quvvatlanmaydi."], 405, $e->getHeaders());
            }
            if ($e->getStatusCode() !== 403) {
                return null;
            }
            // Sanctum abilities middleware xabari inglizcha va ichki — umumiy o'zbekcha xabar
            $message = $e->getPrevious() instanceof MissingAbilityException ? '' : $e->getMessage();

            return response()->json([
                'message' => $message ?: 'Bu amalni bajarishga ruxsatingiz yo\'q.',
            ], 403);
        });

        // ValidationException — Laravel o'zi 422 qaytaradi, lekin xabarni o'zbeklashtirish uchun
        $exceptions->render(function (ValidationException $e) {
            return response()->json([
                'message' => 'Kiritilgan ma\'lumotlar noto\'g\'ri.',
                'errors'  => $e->errors(),
            ], 422);
        });

        // Kutilmagan xato (500) — production'da API javobida umumiy o'zbekcha xabar, ichki tafsilotsiz.
        // Xato baribir log/Sentry'ga yoziladi (render reportga ta'sir qilmaydi); APP_DEBUG=true da Laravel standarti.
        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (config('app.debug') || ! $request->is('api/*')
                || $e instanceof HttpException || $e instanceof \Illuminate\Http\Exceptions\HttpResponseException
                || $e instanceof AuthenticationException || $e instanceof ValidationException) {
                return null;
            }

            return response()->json(['message' => "Serverda xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring."], 500);
        });
    })->create();
