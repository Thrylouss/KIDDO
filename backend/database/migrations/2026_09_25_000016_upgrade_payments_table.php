<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('status');
            $table->timestamp('due_at')->nullable()->after('paid_at');
            $table->json('metadata')->nullable()->after('notes');
        });

        // Copy provider → payment_method
        DB::statement('UPDATE payments SET payment_method = provider');

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('provider');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider')->nullable();
        });

        DB::statement('UPDATE payments SET provider = payment_method');

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'due_at', 'metadata']);
        });
    }
};
