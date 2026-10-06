<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentManagementTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function makeOrg(): Organization
    {
        return Organization::factory()->create();
    }

    private function makePayment(array $attrs = []): Payment
    {
        return Payment::factory()->create($attrs);
    }

    // ── Authorization ──────────────────────────────────────────────

    public function test_guest_cannot_list_payments(): void
    {
        $this->getJson('/api/v1/super-admin/payments')->assertUnauthorized();
    }

    public function test_admin_cannot_list_payments(): void
    {
        $org   = $this->makeOrg();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/payments')
            ->assertForbidden();
    }

    public function test_guest_cannot_verify_payment(): void
    {
        $payment = $this->makePayment(['status' => 'pending', 'paid_at' => null]);
        $this->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")->assertUnauthorized();
    }

    public function test_guest_cannot_refund_payment(): void
    {
        $payment = $this->makePayment(['status' => 'paid']);
        $this->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")->assertUnauthorized();
    }

    // ── Index ──────────────────────────────────────────────────────

    public function test_super_admin_can_list_payments(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'organization', 'amount', 'currency', 'status', 'payment_method', 'created_at']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_can_filter_payments_by_status(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'paid_at' => null]);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?status=pending')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('pending', $data[0]['status']);
    }

    public function test_can_filter_payments_by_payment_method(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'payment_method' => 'payme']);
        $this->makePayment(['organization_id' => $org->id, 'payment_method' => 'manual']);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?payment_method=payme')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('payme', $data[0]['payment_method']);
    }

    public function test_can_filter_payments_by_organization(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $this->makePayment(['organization_id' => $org1->id]);
        $this->makePayment(['organization_id' => $org2->id]);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/payments?organization_id={$org1->id}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals($org1->id, $data[0]['organization']['id']);
    }

    public function test_can_filter_payments_by_date_range(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'created_at' => now()->subDays(10)]);
        $this->makePayment(['organization_id' => $org->id]);

        $dateFrom = now()->subDays(2)->format('Y-m-d');

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/payments?date_from={$dateFrom}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
    }

    // ── Summary ────────────────────────────────────────────────────

    public function test_summary_net_revenue_counts_only_paid(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid', 'amount' => 500000]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 300000, 'paid_at' => null]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(500000.0, $summary['net_revenue']);
    }

    public function test_summary_gross_includes_refunded(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid',     'amount' => 500000]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'refunded', 'amount' => 200000]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(700000.0, $summary['gross_revenue']);
        $this->assertEquals(500000.0, $summary['net_revenue']);
        $this->assertEquals(200000.0, $summary['refunded_amount']);
    }

    public function test_summary_pending_revenue_sums_pending_payments(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 400000, 'paid_at' => null]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(400000.0, $summary['pending_revenue']);
    }

    public function test_summary_today_revenue(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid', 'amount' => 600000, 'paid_at' => now()]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid', 'amount' => 100000, 'paid_at' => now()->subDays(2)]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(600000.0, $summary['today_revenue']);
    }

    public function test_summary_counts(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'pending',  'paid_at' => null]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'failed',   'paid_at' => null]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'refunded']);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(1, $summary['paid_count']);
        $this->assertEquals(1, $summary['pending_count']);
        $this->assertEquals(1, $summary['failed_count']);
        $this->assertEquals(1, $summary['refunded_count']);
        $this->assertEquals(4, $summary['total_count']);
    }

    public function test_summary_is_filter_independent(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment(['organization_id' => $org->id, 'status' => 'paid',    'amount' => 500000]);
        $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 300000, 'paid_at' => null]);

        // Filter status=pending but summary should still include all
        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?status=pending&summary=true')
            ->assertOk();

        $this->assertCount(1, $res->json('data'));
        $this->assertEquals(500000.0, $res->json('summary.net_revenue'));
        $this->assertEquals(2, $res->json('summary.total_count'));
    }

    // ── Show ───────────────────────────────────────────────────────

    public function test_super_admin_can_view_payment_detail(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/payments/{$payment->id}")
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['id', 'organization', 'amount', 'currency', 'status', 'payment_method', 'subscription', 'invoice'],
            ]);
    }

    public function test_show_returns_404_for_missing_payment(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments/9999')
            ->assertNotFound();
    }

    // ── Verify ─────────────────────────────────────────────────────

    public function test_super_admin_can_verify_pending_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
    }

    public function test_verify_sets_paid_at(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertOk();

        $this->assertNotNull($payment->fresh()->paid_at);
    }

    public function test_verify_rejects_already_paid(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertUnprocessable();
    }

    public function test_verify_rejects_failed_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'failed', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertUnprocessable();
    }

    public function test_verify_rejects_refunded_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'refunded']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertUnprocessable();
    }

    public function test_verify_logs_activity(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/verify")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'payment.verified',
            'organization_id' => $org->id,
        ]);
    }

    // ── Refund ─────────────────────────────────────────────────────

    public function test_super_admin_can_refund_paid_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk()
            ->assertJsonPath('data.status', 'refunded');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'refunded']);
    }

    public function test_refund_stores_reason_in_notes(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund", [
                'reason' => "Noto'g'ri to'lov",
            ])
            ->assertOk();

        $this->assertDatabaseHas('payments', [
            'id'    => $payment->id,
            'notes' => "Noto'g'ri to'lov",
        ]);
    }

    public function test_refund_rejects_pending_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'pending', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertUnprocessable();
    }

    public function test_refund_rejects_failed_payment(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'failed', 'paid_at' => null]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertUnprocessable();
    }

    public function test_refund_rejects_already_refunded(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'refunded']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertUnprocessable();
    }

    public function test_refund_logs_activity(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'payment.refunded',
            'organization_id' => $org->id,
        ]);
    }

    // ── H1: Refund ↔ Invoice consistency ───────────────────────────

    public function test_refund_cancels_linked_paid_invoice(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 499000]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
            'amount'          => 499000,
        ]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund", [
                'reason' => 'Test refund',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'refunded');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'refunded']);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id,  'status' => 'cancelled']);
    }

    public function test_refund_logs_invoice_cancelled_activity(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
        ]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'invoice.cancelled',
            'organization_id' => $org->id,
        ]);
    }

    public function test_refund_without_linked_invoice_succeeds(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        // invoice_id is null by default in factory
        $payment = $this->makePayment(['organization_id' => $org->id, 'status' => 'paid']);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk()
            ->assertJsonPath('data.status', 'refunded');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'refunded']);
    }

    public function test_refund_with_pending_invoice_preserves_invoice_status(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->create(['organization_id' => $org->id, 'status' => 'pending']);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
        ]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        // Invoice was never marked paid, so it stays pending
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'pending']);
    }

    public function test_invoice_summary_excludes_cancelled_invoice_after_refund(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 499000]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
            'amount'          => 499000,
        ]);

        // Before refund: invoice summary shows 1 paid invoice
        $before = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(1, $before['paid']);
        $this->assertEquals(499000.0, $before['total_paid_amount']);
        $this->assertEquals(0, $before['cancelled']);

        // Refund the payment
        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        // After refund: invoice moved to cancelled, paid amount drops to 0
        $after = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(0, $after['paid']);
        $this->assertEquals(0.0, $after['total_paid_amount']);
        $this->assertEquals(1, $after['cancelled']);
    }

    public function test_payment_summary_net_revenue_excludes_refunded_after_refund(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 499000]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
            'amount'          => 499000,
        ]);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/payments?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(0.0, $summary['net_revenue']);
        $this->assertEquals(499000.0, $summary['refunded_amount']);
    }

    public function test_repeated_refund_is_rejected_and_does_not_corrupt_invoice(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
        ]);

        // First refund succeeds
        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertOk();

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'cancelled']);

        // Second refund is rejected (payment is now 'refunded', not 'paid')
        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertUnprocessable();

        // Invoice still cancelled, not changed again
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'cancelled']);
    }

    public function test_unauthorized_refund_is_still_rejected(): void
    {
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
        ]);

        $this->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
             ->assertUnauthorized();

        // Nothing changed
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id,  'status' => 'paid']);
    }

    public function test_admin_cannot_refund_payment(): void
    {
        $org     = $this->makeOrg();
        $admin   = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);
        $payment = $this->makePayment([
            'organization_id' => $org->id,
            'invoice_id'      => $invoice->id,
            'status'          => 'paid',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/super-admin/payments/{$payment->id}/refund")
            ->assertForbidden();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id,  'status' => 'paid']);
    }
}
