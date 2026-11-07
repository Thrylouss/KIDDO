<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bog'cha profili va faollik holati. Faqat yangi ustunlar (nullable yoki default bilan) — mavjud ma'lumot o'chmaydi.
 *
 * - type: tashkilot turi (davlat / xususiy) — faollik holatidan alohida.
 * - status: faollik holati (active / inactive / suspended / archived). is_active (login va API tekshiruvlari)
 *   saqlanadi va Organization modelida status bilan sinxron yuritiladi: is_active = (status === 'active').
 * - Obuna (subscriptions jadvali) bu maydonlardan mustaqil.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('type', 20)->nullable()->after('name');
            $table->string('official_code', 50)->nullable()->after('type');
            $table->string('email')->nullable()->after('phone');
            $table->string('website')->nullable()->after('email');
            $table->string('region', 100)->nullable()->after('website');
            $table->string('street')->nullable()->after('mfy');
            $table->string('director_email')->nullable()->after('director_phone');
            $table->text('notes')->nullable()->after('director_email');

            $table->string('status', 20)->default('active')->after('is_active');
            $table->string('status_reason', 500)->nullable()->after('status');
            $table->timestamp('suspended_until')->nullable()->after('status_reason');
            $table->timestamp('status_changed_at')->nullable()->after('suspended_until');
            $table->foreignId('status_changed_by')->nullable()->after('status_changed_at')
                ->constrained('users')->nullOnDelete();

            $table->index('type');
            $table->index('status');
            $table->index('official_code');
            $table->index('district');
        });

        // Mavjud yozuvlar: holat is_active dan; reyestrdan (Excel) import qilinganlar — davlat MTT
        DB::table('organizations')->where('is_active', false)->update(['status' => 'inactive']);
        DB::table('organizations')->whereNotNull('import_source')->whereNull('type')->update(['type' => 'davlat']);
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('status_changed_by');
            $table->dropIndex(['type']);
            $table->dropIndex(['status']);
            $table->dropIndex(['official_code']);
            $table->dropIndex(['district']);
            $table->dropColumn(['type', 'official_code', 'email', 'website', 'region', 'street', 'director_email', 'notes',
                'status', 'status_reason', 'suspended_until', 'status_changed_at']);
        });
    }
};
