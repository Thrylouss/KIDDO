<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceManagementTest extends TestCase
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

    private function makeInvoice(array $attrs = []): Invoice
    {
        return Invoice::factory()->create($attrs);
    }

    // ── Authorization ──────────────────────────────────────────────

    public function test_guest_cannot_list_invoices(): void
    {
        $this->getJson('/api/v1/super-admin/invoices')->assertUnauthorized();
    }

    public function test_admin_cannot_list_invoices(): void
    {
        $org   = $this->makeOrg();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices')
            ->assertForbidden();
    }

    public function test_guest_cannot_create_invoice(): void
    {
        $this->postJson('/api/v1/super-admin/invoices', [])->assertUnauthorized();
    }

    // ── Index / Filters ────────────────────────────────────────────

    public function test_super_admin_can_list_invoices(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'invoice_number', 'organization', 'amount', 'currency', 'status', 'created_at']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_can_filter_invoices_by_status(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'cancelled']);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?status=pending')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('pending', $data[0]['status']);
    }

    public function test_can_filter_invoices_by_organization(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org1->id]);
        $this->makeInvoice(['organization_id' => $org2->id]);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/invoices?organization_id={$org1->id}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals($org1->id, $data[0]['organization']['id']);
    }

    public function test_can_filter_invoices_by_date_range(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id, 'created_at' => now()->subDays(10)]);
        $this->makeInvoice(['organization_id' => $org->id]);

        $dateFrom = now()->subDays(2)->format('Y-m-d');

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/invoices?date_from={$dateFrom}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
    }

    // ── Summary ────────────────────────────────────────────────────

    public function test_summary_returns_counts_by_status(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'paid',      'paid_at' => now()]);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'overdue']);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'cancelled']);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'draft']);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(5, $summary['total']);
        $this->assertEquals(1, $summary['pending']);
        $this->assertEquals(1, $summary['paid']);
        $this->assertEquals(1, $summary['overdue']);
        $this->assertEquals(1, $summary['cancelled']);
        $this->assertEquals(1, $summary['draft']);
    }

    public function test_summary_pending_amount(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 500000]);
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 200000]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(700000.0, $summary['total_pending_amount']);
    }

    public function test_summary_paid_amount(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 499000]);
        Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 599000]);

        $summary = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?summary=true')
            ->assertOk()
            ->json('summary');

        $this->assertEquals(1098000.0, $summary['total_paid_amount']);
    }

    public function test_summary_is_filter_independent(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending', 'amount' => 400000]);
        Invoice::factory()->paid()->create(['organization_id' => $org->id, 'amount' => 600000]);

        // Filtering by status=pending should not affect summary totals
        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?status=pending&summary=true')
            ->assertOk();

        $this->assertCount(1, $res->json('data'));
        $this->assertEquals(2, $res->json('summary.total'));
        $this->assertEquals(600000.0, $res->json('summary.total_paid_amount'));
    }

    // ── Show ───────────────────────────────────────────────────────

    public function test_super_admin_can_view_invoice_detail(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['id', 'invoice_number', 'organization', 'amount', 'status', 'subscription', 'payments'],
            ]);
    }

    public function test_show_returns_404_for_missing_invoice(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/invoices/9999')
            ->assertNotFound();
    }

    // ── Store ──────────────────────────────────────────────────────

    public function test_super_admin_can_create_invoice(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/invoices', [
                'organization_id' => $org->id,
                'amount'          => 499000,
                'due_at'          => now()->addDays(7)->format('Y-m-d'),
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseHas('invoices', [
            'organization_id' => $org->id,
            'amount'          => 499000,
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/invoices', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['organization_id', 'amount']);
    }

    public function test_store_defaults_status_to_pending(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $res = $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/invoices', [
                'organization_id' => $org->id,
                'amount'          => 299000,
            ])
            ->assertCreated();

        $this->assertEquals('pending', $res->json('data.status'));
    }

    public function test_store_allows_draft_status(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/invoices', [
                'organization_id' => $org->id,
                'amount'          => 299000,
                'status'          => 'draft',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_store_logs_activity(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/invoices', [
                'organization_id' => $org->id,
                'amount'          => 499000,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'invoice.created',
            'organization_id' => $org->id,
        ]);
    }

    // ── Mark Paid ──────────────────────────────────────────────────

    public function test_super_admin_can_mark_pending_invoice_paid(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/mark-paid")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'paid']);
    }

    public function test_mark_paid_sets_paid_at(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'overdue']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/mark-paid")
            ->assertOk();

        $this->assertNotNull($invoice->fresh()->paid_at);
    }

    public function test_mark_paid_rejects_already_paid(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/mark-paid")
            ->assertUnprocessable();
    }

    public function test_mark_paid_rejects_cancelled(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'cancelled']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/mark-paid")
            ->assertUnprocessable();
    }

    public function test_mark_paid_logs_activity(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/mark-paid")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'invoice.marked_paid',
            'organization_id' => $org->id,
        ]);
    }

    // ── Cancel ─────────────────────────────────────────────────────

    public function test_super_admin_can_cancel_pending_invoice(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'cancelled']);
    }

    public function test_cancel_stores_reason_in_notes(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel", [
                'reason' => 'Noto\'g\'ri summa',
            ])
            ->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id'    => $invoice->id,
            'notes' => 'Noto\'g\'ri summa',
        ]);
    }

    public function test_cancel_can_cancel_overdue_invoice(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'overdue']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    public function test_cancel_rejects_paid_invoice(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = Invoice::factory()->paid()->create(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel")
            ->assertUnprocessable();
    }

    public function test_cancel_rejects_already_cancelled(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'cancelled']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel")
            ->assertUnprocessable();
    }

    public function test_cancel_logs_activity(): void
    {
        $sa      = $this->superAdmin();
        $org     = $this->makeOrg();
        $invoice = $this->makeInvoice(['organization_id' => $org->id, 'status' => 'pending']);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/invoices/{$invoice->id}/cancel")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'invoice.cancelled',
            'organization_id' => $org->id,
        ]);
    }
}
