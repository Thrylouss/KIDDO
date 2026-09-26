<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add new columns first
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->timestamp('ends_at')->nullable()->after('starts_at');
            $table->timestamp('trial_ends_at')->nullable()->after('ends_at');
            $table->timestamp('cancelled_at')->nullable()->after('auto_renew');
            $table->text('cancelled_reason')->nullable()->after('cancelled_at');
        });

        // 2. Copy data: ends_at = expires_at
        DB::statement('UPDATE subscriptions SET ends_at = expires_at');

        // 3. Rename 'pending_payment' → 'past_due'
        DB::statement("UPDATE subscriptions SET status = 'past_due' WHERE status = 'pending_payment'");

        // 4. Drop old columns (drop index first)
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['expires_at']);
            $table->dropColumn(['expires_at', 'payment_status']);
            $table->index('ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable();
            $table->string('payment_status')->default('pending');
        });

        DB::statement('UPDATE subscriptions SET expires_at = ends_at');
        DB::statement("UPDATE subscriptions SET status = 'pending_payment' WHERE status = 'past_due'");

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['ends_at']);
            $table->dropColumn(['ends_at', 'trial_ends_at', 'cancelled_at', 'cancelled_reason']);
            $table->index('expires_at');
        });
    }
};
