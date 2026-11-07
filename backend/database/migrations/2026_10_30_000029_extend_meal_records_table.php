<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ovqatlanish: «ikkinchi nonushta» turi va bola ovqatlangan/ovqatlanmagan holati.
     * CHECK cheklovi faqat kengaytiriladi (mavjud qiymatlar saqlanadi); ate — standart true.
     */
    public function up(): void
    {
        Schema::table('meal_records', function (Blueprint $table) {
            $table->boolean('ate')->default(true)->after('served_at');
        });

        DB::statement('ALTER TABLE meal_records DROP CONSTRAINT IF EXISTS meal_records_meal_type_check');
        DB::statement("ALTER TABLE meal_records ADD CONSTRAINT meal_records_meal_type_check CHECK (meal_type IN ('nonushta', 'ikkinchi_nonushta', 'tushlik', 'peshinlik', 'kechki_ovqat'))");
    }

    public function down(): void
    {
        // Yangi turdagi yozuvlar bo'lsa, eski cheklov qo'yilmaydi — ma'lumot yo'qolmasligi uchun
        DB::statement('ALTER TABLE meal_records DROP CONSTRAINT IF EXISTS meal_records_meal_type_check');
        if (! DB::table('meal_records')->where('meal_type', 'ikkinchi_nonushta')->exists()) {
            DB::statement("ALTER TABLE meal_records ADD CONSTRAINT meal_records_meal_type_check CHECK (meal_type IN ('nonushta', 'tushlik', 'peshinlik', 'kechki_ovqat'))");
        }

        Schema::table('meal_records', function (Blueprint $table) {
            $table->dropColumn('ate');
        });
    }
};
