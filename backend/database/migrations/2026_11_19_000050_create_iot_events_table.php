<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Normalizatsiyalangan qurilma hodisalari (IoT audit jurnali). dedup_key — takroriy hodisalarni bloklaydi. */
    public function up(): void
    {
        if (Schema::hasTable('iot_events')) {
            return;
        }

        Schema::create('iot_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('iot_device_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('child_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('safety_zone_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 30);            // location | sos | battery | removed | offline | online | arrival | departure
            $table->decimal('x', 8, 2)->nullable();
            $table->decimal('y', 8, 2)->nullable();
            $table->json('payload')->nullable();
            $table->string('dedup_key', 64)->unique();
            $table->timestamp('occurred_at');
            $table->timestamp('received_at');
            $table->timestamps();

            $table->index(['organization_id', 'occurred_at']);
            $table->index(['child_id', 'type', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('iot_events');
    }
};
