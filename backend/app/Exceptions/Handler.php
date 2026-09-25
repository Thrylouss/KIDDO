<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->renderable(function (AuthenticationException $e) {
            return response()->json(['message' => 'Tizimga kirishingiz kerak.'], 401);
        });

        $this->renderable(function (ValidationException $e) {
            return response()->json([
                'message' => 'Kiritilgan ma\'lumotlar noto\'g\'ri.',
                'errors'  => $e->errors(),
            ], 422);
        });

        $this->renderable(function (NotFoundHttpException $e) {
            return response()->json(['message' => 'Ma\'lumot topilmadi.'], 404);
        });
    }
}
