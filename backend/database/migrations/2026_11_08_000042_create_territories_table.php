<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hududiy ma'lumotnoma: viloyat → tuman/shahar → MFY. Faqat yangi jadval — mavjud ma'lumot o'zgarmaydi.
 * Jadval bo'sh holda yaratiladi: qiymatlar faqat tasdiqlangan rasmiy manbadan
 * `php artisan kiddo:territories:import <fayl> --source=... --apply` orqali yuklanadi.
 * Bog'chalar (organizations.region/district/mfy) matnli qiymatlari avvalgidek saqlanadi va avtomatik o'zgartirilmaydi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('territories', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20);                       // region | district | mfy
            $table->string('name');
            $table->foreignId('parent_id')->nullable()->constrained('territories')->restrictOnDelete();
            $table->string('code', 50)->nullable();           // manbadagi rasmiy kod (bo'lsa)
            $table->string('source', 255);                    // manba nomi (masalan, rasmiy hujjat/sayt)
            $table->string('source_ref', 500)->nullable();    // fayl nomi, sana yoki havola
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['kind', 'parent_id', 'name']);
            $table->index(['kind', 'is_active']);
            $table->index('parent_id');                       // FK — PostgreSQL avtomatik indekslamaydi (ichki hududlar ro'yxati)
        });

        // parent_id NULL (viloyatlar) uchun yuqoridagi unique ishlamaydi — NULL qiymatlar bir-biriga teng emas.
        // Qisman indeks bir xil nomli ikki viloyatga yo'l qo'ymaydi (barcha PostgreSQL versiyalarida va SQLite'da ishlaydi).
        DB::statement('CREATE UNIQUE INDEX territories_root_kind_name_unique ON territories (kind, name) WHERE parent_id IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('territories');
    }
};
