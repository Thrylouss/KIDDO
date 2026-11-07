<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Audit HIGH: billing yopiqligi, scheduler himoyasi, Super Admin bildirishnomalari sahifalanishi. */
class HighPriorityFixesTest extends TestCase
{
    use RefreshDatabase;

    private const BILLING_ENDPOINTS = [
        ['GET', '/api/v1/super-admin/plans'],
        ['POST', '/api/v1/super-admin/plans'],
        ['GET', '/api/v1/super-admin/subscriptions'],
        ['GET', '/api/v1/super-admin/subscriptions/metrics'],
        ['GET', '/api/v1/super-admin/payments'],
        ['POST', '/api/v1/super-admin/payments/1/verify'],
        ['GET', '/api/v1/super-admin/invoices'],
        ['POST', '/api/v1/super-admin/invoices'],
        ['POST', '/api/v1/super-admin/organizations/1/renew'],
        ['GET', '/api/v1/super-admin/organizations/1/payments'],
        ['GET', '/api/v1/super-admin/dashboard/revenue'],
        ['GET', '/api/v1/super-admin/dashboard/expiring'],
        ['GET', '/api/v1/super-admin/reports/overview'],
        ['GET', '/api/v1/super-admin/reports/revenue'],
        ['GET', '/api/v1/super-admin/reports/subscriptions'],
    ];

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    public function test_billing_ochiq_bolmasa_billing_endpointlari_404(): void
    {
        config(['kiddo.billing.enabled' => false]);
        $sa = $this->superAdmin();

        foreach (self::BILLING_ENDPOINTS as [$method, $uri]) {
            $this->actingAs($sa, 'sanctum')->json($method, $uri)
                ->assertNotFound()
                ->assertJsonPath('message', "Bu bo'lim hozircha o'chirilgan.");
        }

        // Billing'ga aloqasi yo'q Super Admin bo'limlari ishlashda davom etadi
        foreach (['/api/v1/super-admin/dashboard', '/api/v1/super-admin/organizations', '/api/v1/super-admin/reports/organizations',
                  '/api/v1/super-admin/reports/users', '/api/v1/super-admin/notifications', '/api/v1/super-admin/activity-logs',
                  '/api/v1/super-admin/demo-requests'] as $uri) {
            $this->actingAs($sa, 'sanctum')->getJson($uri)->assertOk();
        }
    }

    public function test_billing_yoqilganda_endpointlar_ochiladi_va_rollar_saqlanadi(): void
    {
        config(['kiddo.billing.enabled' => true]);
        $this->actingAs($this->superAdmin(), 'sanctum')->getJson('/api/v1/super-admin/plans')->assertOk();

        // Middleware tartibi: billing yopiq bo'lsa ham boshqa rol 404 emas, 403 oladi (rol tekshiruvi birinchi)
        config(['kiddo.billing.enabled' => false]);
        $this->app['auth']->forgetGuards();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/super-admin/plans')->assertForbidden();
    }

    public function test_scheduler_vazifalari_takroriy_ishga_tushishdan_himoyalangan(): void
    {
        \Illuminate\Support\Facades\Artisan::all(); // withSchedule callback Artisan ishga tushganda ro'yxatga olinadi
        $events = collect(app(Schedule::class)->events())->keyBy(fn ($e) => trim(preg_replace('/^.*artisan[\'"]?\s+/', '', $e->command)));

        foreach (['kiddo:demo-requests:retry-telegram', 'tokens:prune-expired --hours=24', 'subscriptions:check-expiry'] as $cmd) {
            $this->assertTrue($events->has($cmd), "Rejada yo'q: {$cmd}");
            $this->assertTrue($events[$cmd]->withoutOverlapping, "withoutOverlapping yo'q: {$cmd}");
            $this->assertTrue($events[$cmd]->onOneServer, "onOneServer yo'q: {$cmd}");
        }
        $this->assertSame('*/15 * * * *', $events['kiddo:demo-requests:retry-telegram']->expression);

        // Obuna muddati tekshiruvi billing o'chiq bo'lsa ishlamaydi
        config(['kiddo.billing.enabled' => false]);
        $this->assertFalse($events['subscriptions:check-expiry']->filtersPass($this->app));
        config(['kiddo.billing.enabled' => true]);
        $this->assertTrue($events['subscriptions:check-expiry']->filtersPass($this->app));
    }

    public function test_super_admin_bildirishnomalari_sahifalanadi(): void
    {
        $sa = $this->superAdmin();
        for ($i = 1; $i <= 120; $i++) {
            AppNotification::create(['recipient_type' => 'super_admin', 'title' => "N{$i}", 'message' => 'm', 'type' => 'info']);
        }

        $first = $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/notifications')
            ->assertOk()
            ->assertJsonPath('meta.total', 120)
            ->assertJsonPath('meta.per_page', 50)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('unread_count', 120)
            ->assertJsonCount(50, 'data');
        $this->assertSame('N120', $first->json('data.0.title')); // eng yangisi birinchi

        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/notifications?per_page=100&page=2')
            ->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.current_page', 2);
        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/notifications?per_page=1000')
            ->assertOk()->assertJsonPath('meta.per_page', 100);
    }

    public function test_bogchalar_royxati_per_page_100_gacha(): void
    {
        $sa = $this->superAdmin();
        \App\Models\Organization::factory()->count(30)->create();

        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/organizations?per_page=100&sort=name')
            ->assertOk()->assertJsonCount(30, 'data')->assertJsonPath('meta.last_page', 1);
        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/organizations?per_page=500')
            ->assertOk()->assertJsonPath('meta.per_page', 100);
    }
}
