<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TokenFromCookieMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->bearerToken() && $request->cookie('kiddo_token')) {
            $request->headers->set('Authorization', 'Bearer ' . $request->cookie('kiddo_token'));
        }

        return $next($request);
    }
}
