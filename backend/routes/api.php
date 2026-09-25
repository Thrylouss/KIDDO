<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app'    => config('app.name'),
        'time'   => now()->toIso8601String(),
    ]);
});

/*
|--------------------------------------------------------------------------
| Authentication (ommaviy)
|--------------------------------------------------------------------------
*/
Route::prefix('v1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    /*
    |----------------------------------------------------------------------
    | Autentifikatsiya talab qilinadigan marshrутlar
    |----------------------------------------------------------------------
    */
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Admin uchun
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            // Keyingi bosqichlarda: kindergartens, users, stats
        });

        // Tarbiyachi uchun
        Route::middleware('role:admin,teacher')->prefix('teacher')->group(function () {
            // Keyingi bosqichlarda: groups, children, attendance, activities
        });

        // Ota-ona uchun
        Route::middleware('role:admin,parent')->prefix('parent')->group(function () {
            // Keyingi bosqichlarda: children, attendance, messages, payments
        });
    });
});
