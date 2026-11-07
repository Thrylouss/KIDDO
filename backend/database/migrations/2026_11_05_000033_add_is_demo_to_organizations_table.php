<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Test/demo tashkilotlarini haqiqiylaridan ajratish (DEV TEST MODE, namoyish).
     * Demo tashkilotlar platforma statistikasiga qo'shilmaydi. Faqat qo'shimcha ustun, standart — false.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->boolean('is_demo')->default(false)->after('is_active');
            $table->index('is_demo');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropIndex(['is_demo']);
            $table->dropColumn('is_demo');
        });
    }
};
