<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Geofence zonalari (bog'cha rejasi koordinatalarida ko'pburchak): xavfsiz, cheklangan, chiqish, xona. */
    public function up(): void
    {
        if (Schema::hasTable('safety_zones')) {
            return;
        }

        Schema::create('safety_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('kind', 20);            // safe | restricted | exit | entrance
            $table->json('polygon');               // [[x,y], ...] — kamida 3 nuqta
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['organization_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safety_zones');
    }
};
