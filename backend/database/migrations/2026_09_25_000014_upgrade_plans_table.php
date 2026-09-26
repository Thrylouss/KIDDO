<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
            $table->decimal('price_monthly', 12, 2)->default(0)->after('max_groups');
            $table->decimal('price_yearly', 12, 2)->nullable()->after('price_monthly');
            $table->string('currency', 10)->default('UZS')->after('price_yearly');
            $table->unsignedInteger('trial_days')->default(7)->after('currency');
            $table->json('features')->nullable()->after('trial_days');
            $table->unsignedSmallInteger('sort_order')->default(0)->after('is_active');
        });

        // Copy price → price_monthly, generate slug from name
        DB::statement("UPDATE plans SET price_monthly = price, slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))");

        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['price', 'billing_period']);
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->default(0);
            $table->string('billing_period')->default('monthly');
        });

        DB::statement('UPDATE plans SET price = price_monthly');

        Schema::table('plans', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'price_monthly', 'price_yearly', 'currency', 'trial_days', 'features', 'sort_order']);
        });
    }
};
