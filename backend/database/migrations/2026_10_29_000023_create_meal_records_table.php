<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ovqatlanish: bola, sana va ovqat turi uchun bitta faol yozuv.
     * Sana va vaqt Toshkent mahalliy vaqtida. group_id — o'sha kundagi guruh (tarix uchun).
     */
    public function up(): void
    {
        Schema::create('meal_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date');
            $table->enum('meal_type', ['nonushta', 'tushlik', 'peshinlik', 'kechki_ovqat']);
            $table->time('served_at');
            $table->string('note', 255)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'date']);
            $table->index(['group_id', 'date']);
        });

        // O'chirilgan (soft delete) yozuv o'rniga yangisini kiritish mumkin bo'lsin
        DB::statement('CREATE UNIQUE INDEX meal_records_child_date_type_active_unique ON meal_records (child_id, date, meal_type) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_records');
    }
};
