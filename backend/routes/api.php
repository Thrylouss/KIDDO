<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app'    => config('app.name'),
        'time'   => now()->toIso8601String(),
    ]);
});

/*
|--------------------------------------------------------------------------
| Authenticated routes (Sanctum)
|--------------------------------------------------------------------------
|
| Auth, kindergartens, groups, children, parents, teachers, attendance,
| daily activities, meals, sleep records, photos, messages, payments
| will be registered here as modules are built.
|
*/
