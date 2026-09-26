<?php

use App\Http\Middleware\RoleMiddleware;
use Illuminate\Auth\AuthenticationException;
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
    })
    ->withExceptions(function (Exceptions $exceptions) {
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
