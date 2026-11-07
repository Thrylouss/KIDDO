<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * «Sababli» davomat uchun sabab kategoriyasi (kasallik, oilaviy, boshqa).
     * Izohning o'zi mavjud `note` ustunida saqlanadi. Faqat qo'shimcha nullable ustun.
     */
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->string('excuse_reason', 20)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn('excuse_reason');
        });
    }
};
