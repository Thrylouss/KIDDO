<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** KIDDO Smart Safety feature flag: SMART_SAFETY_ENABLED=false bo'lsa barcha endpointlar 404 (mavjudligi oshkor qilinmaydi). */
class EnsureSmartSafetyEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('kiddo.smart_safety.enabled')) {
            return response()->json(['message' => "Bu bo'lim hozircha o'chirilgan."], 404);
        }

        return $next($request);
    }
}
