<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Lokal frontend (http://localhost:3000) login so'roviga CORS ruxsati; begona origin yopiq. */
class CorsTest extends TestCase
{
    private function preflight(string $origin)
    {
        return $this->call('OPTIONS', '/api/v1/login', [], [], [], [
            'HTTP_ORIGIN'                         => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD'  => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,accept',
        ]);
    }

    public function test_lokal_frontend_originiga_ruxsat(): void
    {
        $this->preflight('http://localhost:3000')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_begona_origin_rad_etiladi(): void
    {
        // Bitta ruxsat etilgan origin bo'lsa kutubxona doim o'shani qaytaradi — brauzer uni begona origin uchun rad etadi
        $allowed = $this->preflight('http://evil.example')->headers->get('Access-Control-Allow-Origin');
        $this->assertNotSame('http://evil.example', $allowed);
        $this->assertNotSame('*', $allowed);
    }
}
