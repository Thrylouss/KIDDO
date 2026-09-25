<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('child_parent', function (Blueprint $table) {
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_profile_id')->constrained('parent_profiles')->cascadeOnDelete();
            $table->string('relation_type');     // "ona", "ota", "vasiy"
            $table->boolean('is_primary')->default(false); // asosiy vakil

            $table->primary(['child_id', 'parent_profile_id']);
            $table->index('parent_profile_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('child_parent');
    }
};
