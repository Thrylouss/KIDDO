<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bola profili: otasining ismi, bog'chaga qabul qilingan sana va tibbiy/alohida e'tibor ma'lumotlari.
     * medical_notes faqat bog'cha admini va bolaning guruhi tarbiyachisiga ko'rsatiladi.
     * Faqat qo'shimcha nullable ustunlar.
     */
    public function up(): void
    {
        Schema::table('children', function (Blueprint $table) {
            $table->string('middle_name', 100)->nullable()->after('last_name');
            $table->date('admitted_at')->nullable()->after('birth_date');
            $table->text('medical_notes')->nullable()->after('gender');
        });
    }

    public function down(): void
    {
        Schema::table('children', function (Blueprint $table) {
            $table->dropColumn(['middle_name', 'admitted_at', 'medical_notes']);
        });
    }
};
