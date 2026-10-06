<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * H3 — Invoice Number Race Condition
 *
 * The old implementation used:
 *   $count = Invoice::whereYear('created_at', $year)->count() + 1;
 * This read-then-write pattern allows two concurrent requests to read the same
 * count, compute the same next number, and both try to insert — causing one to
 * fail with a unique constraint violation (HTTP 500).
 *
 * The fix uses a single atomic PostgreSQL statement:
 *   INSERT INTO invoice_counters (year, last_number) VALUES (?, 1)
 *   ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
 *   RETURNING last_number
 * which eliminates any TOCTOU gap at the database level.
 *
 * True parallel-process concurrency testing is not reliably achievable within a
 * single PHPUnit process (no forking, no shared DB connections across PHP threads).
 * Instead we verify:
 *   (a) The atomic counter produces strictly sequential unique values.
 *   (b) The DB UNIQUE constraint on invoice_number is present and enforced.
 *   (c) The invoice_counters table itself enforces atomicity via a primary-key
 *       conflict-update — its correctness under concurrent access is a PostgreSQL
 *       guarantee, not something we need to re-prove in application tests.
 */
class InvoiceNumberGenerationTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrg(): Organization
    {
        return Organization::factory()->create();
    }

    // ── 1. Format correctness ──────────────────────────────────────

    public function test_invoice_number_is_auto_generated_on_create(): void
    {
        $org     = $this->makeOrg();
        $invoice = Invoice::create([
            'organization_id' => $org->id,
            'amount'          => 299000,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $this->assertNotNull($invoice->invoice_number);
        $this->assertNotEmpty($invoice->invoice_number);
    }

    public function test_invoice_number_matches_kiddo_year_format(): void
    {
        $org     = $this->makeOrg();
        $invoice = Invoice::create([
            'organization_id' => $org->id,
            'amount'          => 299000,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $year = now()->year;
        $this->assertMatchesRegularExpression(
            '/^KIDDO-' . $year . '-\d{6}$/',
            $invoice->invoice_number,
            "Invoice number must match KIDDO-{$year}-NNNNNN"
        );
    }

    public function test_invoice_number_sequence_starts_at_one_for_fresh_year(): void
    {
        $org     = $this->makeOrg();
        $invoice = Invoice::create([
            'organization_id' => $org->id,
            'amount'          => 100000,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $year = now()->year;
        $this->assertEquals("KIDDO-{$year}-000001", $invoice->invoice_number);
    }

    // ── 2. Sequential uniqueness ───────────────────────────────────

    public function test_sequential_invoice_creations_produce_unique_numbers(): void
    {
        $org      = $this->makeOrg();
        $numbers  = [];
        $count    = 10;

        for ($i = 0; $i < $count; $i++) {
            $invoice   = Invoice::create([
                'organization_id' => $org->id,
                'amount'          => 299000,
                'currency'        => 'UZS',
                'status'          => 'pending',
            ]);
            $numbers[] = $invoice->invoice_number;
        }

        $this->assertCount($count, array_unique($numbers), 'All invoice numbers must be unique');
    }

    public function test_invoice_numbers_increment_strictly(): void
    {
        $org = $this->makeOrg();

        $first  = Invoice::create(['organization_id' => $org->id, 'amount' => 100, 'currency' => 'UZS', 'status' => 'pending']);
        $second = Invoice::create(['organization_id' => $org->id, 'amount' => 100, 'currency' => 'UZS', 'status' => 'pending']);
        $third  = Invoice::create(['organization_id' => $org->id, 'amount' => 100, 'currency' => 'UZS', 'status' => 'pending']);

        $year = now()->year;
        $this->assertEquals("KIDDO-{$year}-000001", $first->invoice_number);
        $this->assertEquals("KIDDO-{$year}-000002", $second->invoice_number);
        $this->assertEquals("KIDDO-{$year}-000003", $third->invoice_number);
    }

    // ── 3. Pre-set number is preserved ────────────────────────────

    public function test_preset_invoice_number_is_not_overwritten(): void
    {
        $org     = $this->makeOrg();
        $preset  = 'KIDDO-2025-099999';
        $invoice = Invoice::create([
            'organization_id' => $org->id,
            'invoice_number'  => $preset,
            'amount'          => 299000,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $this->assertEquals($preset, $invoice->invoice_number);
    }

    // ── 4. DB UNIQUE constraint ────────────────────────────────────

    public function test_unique_constraint_exists_on_invoice_number_column(): void
    {
        // The migration defines ->unique() on invoice_number. Verify it is
        // enforced by attempting a raw duplicate insert and catching the exception.
        $org = $this->makeOrg();

        Invoice::create([
            'organization_id' => $org->id,
            'invoice_number'  => 'KIDDO-2026-DUPTEST',
            'amount'          => 100,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        // Second insert with identical invoice_number must be rejected by the DB
        DB::table('invoices')->insert([
            'organization_id' => $org->id,
            'invoice_number'  => 'KIDDO-2026-DUPTEST',
            'amount'          => 200,
            'currency'        => 'UZS',
            'status'          => 'pending',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);
    }

    // ── 5. Atomic counter table ────────────────────────────────────

    public function test_invoice_counters_table_exists_and_tracks_year(): void
    {
        $org = $this->makeOrg();
        Invoice::create([
            'organization_id' => $org->id,
            'amount'          => 100,
            'currency'        => 'UZS',
            'status'          => 'pending',
        ]);

        $year    = now()->year;
        $counter = DB::table('invoice_counters')->where('year', $year)->first();

        $this->assertNotNull($counter);
        $this->assertEquals(1, $counter->last_number);
    }

    public function test_counter_increments_with_each_invoice(): void
    {
        $org = $this->makeOrg();
        $n   = 5;

        for ($i = 0; $i < $n; $i++) {
            Invoice::create([
                'organization_id' => $org->id,
                'amount'          => 100,
                'currency'        => 'UZS',
                'status'          => 'pending',
            ]);
        }

        $year    = now()->year;
        $counter = DB::table('invoice_counters')->where('year', $year)->first();

        $this->assertEquals($n, $counter->last_number);
    }

    // ── 6. Simulated concurrent uniqueness guarantee ───────────────

    /**
     * True OS-level parallel threads cannot be tested in a single PHPUnit
     * process. Instead, we verify the invariant that matters: the atomic
     * INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement on the
     * invoice_counters table guarantees each call gets a distinct last_number.
     * We call it 20 times inside a tight loop to confirm no duplicates occur
     * under rapid sequential pressure, which exercises the conflict-update path.
     */
    public function test_rapid_invoice_creation_never_produces_duplicate_numbers(): void
    {
        $org     = $this->makeOrg();
        $numbers = [];
        $n       = 20;

        for ($i = 0; $i < $n; $i++) {
            $invoice   = Invoice::create([
                'organization_id' => $org->id,
                'amount'          => 299000,
                'currency'        => 'UZS',
                'status'          => 'pending',
            ]);
            $numbers[] = $invoice->invoice_number;
        }

        $unique = array_unique($numbers);
        $this->assertCount(
            $n,
            $unique,
            'Expected ' . $n . ' unique invoice numbers, got duplicates: ' .
            implode(', ', array_diff_assoc($numbers, $unique))
        );
    }

    // ── 7. H1/H2 regression guard ─────────────────────────────────

    public function test_invoice_created_by_subscription_service_gets_unique_number(): void
    {
        // Regression guard: SubscriptionService::createSubscription (non-trial)
        // still triggers the boot hook and gets a valid invoice number.
        $org  = Organization::factory()->create();
        $plan = \App\Models\Plan::factory()->create(['price_monthly' => 299000]);

        $service = app(\App\Services\SubscriptionService::class);
        $sub     = $service->createSubscription($org, $plan, [
            'status'         => \App\Models\Subscription::STATUS_ACTIVE,
            'ends_at'        => now()->addDays(30)->toDateString(),
            'payment_status' => 'pending',
        ]);

        $invoice = \App\Models\Invoice::where('subscription_id', $sub->id)->first();
        $this->assertNotNull($invoice);
        $this->assertMatchesRegularExpression('/^KIDDO-\d{4}-\d{6}$/', $invoice->invoice_number);
    }

    public function test_trial_subscription_still_creates_no_invoice_after_h3(): void
    {
        // H2 regression guard: trial subscriptions must still produce no invoice.
        $org  = Organization::factory()->create();
        $plan = \App\Models\Plan::factory()->create(['price_monthly' => 299000]);

        $service = app(\App\Services\SubscriptionService::class);
        $service->createSubscription($org, $plan, [
            'status' => \App\Models\Subscription::STATUS_TRIAL,
        ]);

        $this->assertDatabaseMissing('invoices', ['organization_id' => $org->id]);
        $this->assertDatabaseMissing('invoice_counters', ['year' => now()->year]);
    }
}
