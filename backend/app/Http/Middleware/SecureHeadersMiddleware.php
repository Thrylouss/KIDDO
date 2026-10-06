<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds standard HTTP security response headers to every API response.
 *
 * Placement: global middleware (not api-group-only).
 *
 * Why global:
 *   Laravel's $middlewarePriority sorts Authenticate (auth:sanctum) before any
 *   custom api-group middleware, making api-group-appended middleware the
 *   INNERMOST pipe.  When auth fails, the exception is caught inside auth's
 *   carry function and rendered as a 401 response that never reaches the
 *   innermost middleware.  Placing this middleware in the global stack makes it
 *   the outermost wrapper so it sees every response regardless of whether
 *   authentication or route-matching succeeded.
 *
 * Nginx-level hardening is applied separately:
 *   server_tokens off; — hides nginx version in the Server header.
 *   fastcgi_hide_header X-Powered-By; — strips the PHP version header at the
 *   proxy layer even if expose_php = On in php.ini.
 */
class SecureHeadersMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Suppress PHP's X-Powered-By before any output is sent.
        header_remove('X-Powered-By');

        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');
        $response->headers->remove('X-Powered-By');

        return $response;
    }
}
