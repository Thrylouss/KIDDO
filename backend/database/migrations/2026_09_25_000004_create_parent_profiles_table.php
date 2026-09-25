<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parent_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone');
            $table->string('relation_type'); // "ona", "ota", "vasiy"
            $table->timestamps();

            $table->unique('user_id'); // bir user faqat bitta ota-ona profili
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parent_profiles');
    }
};
