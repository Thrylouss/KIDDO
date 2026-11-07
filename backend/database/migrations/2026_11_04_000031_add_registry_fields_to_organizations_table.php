<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Davlat MTT reyestri maydonlari (Excel import uchun): tuman, raqam, MFY, quvvat, rahbar va manba qatori.
     * Rahbar — faqat ma'lumot; unga login/parol yaratilmaydi.
     * Faqat qo'shimcha nullable ustunlar — mavjud yozuvlar o'zgarmaydi.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('district', 100)->nullable()->after('address');
            $table->string('number', 20)->nullable()->after('district');
            $table->string('mfy', 150)->nullable()->after('number');
            $table->unsignedInteger('capacity')->nullable()->after('mfy');
            $table->string('director_name')->nullable()->after('capacity');
            $table->string('director_phone', 30)->nullable()->after('director_name');
            // Excel'dagi asl qiymatlar (fayl, qator, sarlavha → katak) — tozalangan qiymatlardan alohida
            $table->json('import_source')->nullable()->after('director_phone');

            // Takroriylikni tekshirish uchun (unique emas — ogohlantirish servisda)
            $table->index(['district', 'number']);
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropIndex(['district', 'number']);
            $table->dropColumn(['district', 'number', 'mfy', 'capacity', 'director_name', 'director_phone', 'import_source']);
        });
    }
};
