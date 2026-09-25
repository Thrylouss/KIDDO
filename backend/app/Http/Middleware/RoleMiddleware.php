<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Foydalanuvchi roli tekshiruvi.
     * Foydalanish: ->middleware('role:admin') yoki ->middleware('role:admin,teacher')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user()) {
            return response()->json(['message' => 'Tizimga kirishingiz kerak.'], 401);
        }

        if (! in_array($request->user()->role, $roles, true)) {
            return response()->json(['message' => 'Bu sahifaga kirishga ruxsatingiz yo\'q.'], 403);
        }

        return $next($request);
    }
}
