<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Qurilma ↔ bola (yoki xodim) biriktirish tarixi: faol biriktirish — unassigned_at IS NULL. */
    public function up(): void
    {
        if (Schema::hasTable('iot_device_assignments')) {
            return;
        }

        Schema::create('iot_device_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('iot_device_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();   // xodim belgisi
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamp('unassigned_at')->nullable();
            $table->timestamps();

            $table->index(['iot_device_id', 'unassigned_at']);
            $table->index(['child_id', 'unassigned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('iot_device_assignments');
    }
};
