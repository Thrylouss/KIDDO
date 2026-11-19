<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Xavfsizlik insidentlari: open → acknowledged → resolved. «Qabul qilindi» insidentni yopmaydi —
     * yechim alohida (resolved_by, izoh bilan) qayd etiladi. Eskalatsiya vaqti alohida saqlanadi.
     */
    public function up(): void
    {
        if (Schema::hasTable('safety_incidents')) {
            return;
        }

        Schema::create('safety_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('iot_device_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('safety_zone_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('iot_event_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 30);            // restricted_zone | sos | battery_low | device_removed | device_offline | missing
            $table->string('severity', 10);        // critical | high | warning
            $table->string('status', 15)->default('open');   // open | acknowledged | resolved
            $table->timestamp('opened_at');
            $table->timestamp('escalated_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('resolution_note', 500)->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['iot_device_id', 'type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safety_incidents');
    }
};
