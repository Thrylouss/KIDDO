<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Merge duplicate Boshlang'ich plans ─────────────────────────
        // The upgrade migration auto-generated slug 'boshlang-ich' from the name,
        // but the seeder later ran firstOrCreate(['slug' => 'boshlangich']) which
        // created a second row because the slugs didn't match.
        // Strategy: keep the older plan (boshlang-ich), move its duplicate's
        // subscriptions to it, then delete the duplicate.

        $canonical = DB::table('plans')->where('slug', 'boshlang-ich')->first();
        $duplicate = DB::table('plans')->where('slug', 'boshlangich')->first();

        if ($canonical && $duplicate) {
            DB::table('subscriptions')
                ->where('plan_id', $duplicate->id)
                ->update(['plan_id' => $canonical->id]);

            // Also update any invoices / payments that stored plan context indirectly
            // (they don't store plan_id directly — only subscription does)

            DB::table('plans')->where('id', $duplicate->id)->delete();
        }

        // ── 2. Expire stale trial subscriptions ───────────────────────────
        // An org can only have one active subscription at a time. If an org has
        // both an 'active' subscription AND a 'trial' subscription, the trial
        // was never cleaned up when the paid sub was created. Expire those now.

        DB::statement("
            UPDATE subscriptions
            SET    status = 'expired'
            WHERE  status = 'trial'
            AND    organization_id IN (
                SELECT organization_id
                FROM   subscriptions
                WHERE  status = 'active'
            )
        ");
    }

    public function down(): void
    {
        // Data-only migration; reversing would require knowing original IDs.
        // Intentionally left empty — restore from backup if needed.
    }
};
