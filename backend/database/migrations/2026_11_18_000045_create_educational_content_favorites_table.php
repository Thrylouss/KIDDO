<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tarbiyachining sevimli materiallari (shaxsiy). */
    public function up(): void
    {
        if (Schema::hasTable('educational_content_favorites')) {
            return;
        }

        Schema::create('educational_content_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('educational_content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['educational_content_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('educational_content_favorites');
    }
};
