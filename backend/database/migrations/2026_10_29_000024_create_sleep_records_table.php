<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Uyqu: bola va sana uchun ko'pi bilan bitta faol yozuv.
     * ended_at bo'sh — bola hali uxlayapti.
     */
    public function up(): void
    {
        Schema::create('sleep_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date');
            $table->time('started_at');
            $table->time('ended_at')->nullable();
            $table->string('note', 255)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'date']);
            $table->index(['group_id', 'date']);
        });

        DB::statement('CREATE UNIQUE INDEX sleep_records_child_date_active_unique ON sleep_records (child_id, date) WHERE deleted_at IS NULL');
        DB::statement('ALTER TABLE sleep_records ADD CONSTRAINT sleep_records_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('sleep_records');
    }
};
