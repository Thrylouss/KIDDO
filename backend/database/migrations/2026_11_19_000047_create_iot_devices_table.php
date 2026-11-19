<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * KIDDO Smart Safety: bog'cha qurilmalari (bilaguzuk, gateway, lokatsiya ankeri, kamera, avtobus trekeri).
     * Faqat yangi jadval; down() uni to'liq olib tashlaydi (qaytariladigan).
     */
    public function up(): void
    {
        if (Schema::hasTable('iot_devices')) {
            return;
        }

        Schema::create('iot_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);                       // wristband | gateway | anchor | camera | bus_tracker | staff_badge
            $table->string('provider', 20)->default('demo');  // demo | blueiot | mokosmart | minew
            $table->string('external_id', 64);                // seriya / MAC — provayder bergan identifikator
            $table->string('label', 100)->nullable();
            $table->unsignedTinyInteger('battery_level')->nullable();
            $table->string('status', 20)->default('offline');  // online | offline | removed
            $table->string('firmware_version', 40)->nullable();
            $table->json('meta')->nullable();                 // ankerlar uchun {x, y}; maxfiy qiymatlar saqlanmaydi
            $table->string('token_hash', 64)->nullable();     // faqat gateway: sha256(token), token o'zi saqlanmaydi
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['provider', 'external_id']);
            $table->index(['organization_id', 'type']);
            $table->index('token_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('iot_devices');
    }
};
