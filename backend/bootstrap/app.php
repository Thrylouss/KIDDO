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
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => RoleMiddleware::class,
        ]);
        $middleware->appendToGroup('api', TokenFromCookieMiddleware::class);

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
        $schedule->command('subscriptions:check-expiry')->daily();
        // Remove DB rows for tokens that expired more than 24 h ago.
        $schedule->command('sanctum:prune-expired --hours=24')->daily();
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

        // ValidationException — Laravel o'zi 422 qaytaradi, lekin xabarni o'zbeklashtirish uchun
        $exceptions->render(function (ValidationException $e) {
            return response()->json([
                'message' => 'Kiritilgan ma\'lumotlar noto\'g\'ri.',
                'errors'  => $e->errors(),
            ], 422);
        });
    })->create();
