<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Super Admin bog'cha paneliga (X-Impersonated-Org) faqat ko'rish uchun kiradi:
 * kundalik boshqaruv (davomat, bolalar, guruhlar, ovqat, xabarlar...) — bog'cha rahbari va tarbiyachi ishi.
 */
class SuperAdminReadOnlyMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->isSuperAdmin() && ! $request->isMethodSafe()) {
            // Ko'rish rejimida o'zgartirishga urinish ham audit logga yoziladi
            $orgId = (int) $request->header('X-Impersonated-Org');
            ActivityLog::record('super_admin.readonly_blocked',
                "Super Admin ko'rish rejimida o'zgartirishga urindi: {$request->method()} /{$request->path()}",
                $request->user()->id, $orgId > 0 && Organization::whereKey($orgId)->exists() ? $orgId : null,
                ['method' => $request->method(), 'path' => $request->path()], $request->ip());

            return response()->json([
                'message' => "Super Admin bog'cha ma'lumotlarini faqat ko'ra oladi. O'zgartirishlarni bog'cha rahbari bajaradi.",
            ], 403);
        }

        return $next($request);
    }
}
