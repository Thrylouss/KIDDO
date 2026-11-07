<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * KIDDO obuna/tarif/to'lov (bog'cha → platforma) API'si BILLING_ENABLED=false bo'lganda yopiq.
 * Ma'lumotlar bazasi tuzilmasi va kod saqlanadi — faqat endpointlar 404 qaytaradi.
 */
class EnsureBillingEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('kiddo.billing.enabled')) {
            return response()->json(['message' => "Bu bo'lim hozircha o'chirilgan."], 404);
        }

        return $next($request);
    }
}
