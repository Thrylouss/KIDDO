<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vaqtinchalik parol bilan kirgan foydalanuvchi parolni almashtirmaguncha faqat
 * /me, /me/password, /logout va /mobile/logout dan foydalana oladi — qolganlari 403 (code: password_change_required).
 */
class EnsurePasswordChangedMiddleware
{
    private const ALLOWED = ['api/v1/me', 'api/v1/me/password', 'api/v1/logout', 'api/v1/mobile/logout'];

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->must_change_password && ! in_array($request->path(), self::ALLOWED, true)) {
            return response()->json([
                'message' => "Davom etish uchun vaqtinchalik parolni almashtiring.",
                'code'    => 'password_change_required',
            ], 403);
        }

        return $next($request);
    }
}
