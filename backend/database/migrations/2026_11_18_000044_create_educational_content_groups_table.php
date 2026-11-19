<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Kontent ↔ guruh biriktirish: tarbiyachi faqat o'z guruhiga biriktirilgan kontentni ko'radi. */
    public function up(): void
    {
        if (Schema::hasTable('educational_content_groups')) {
            return;
        }

        Schema::create('educational_content_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('educational_content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['educational_content_id', 'group_id']);
            $table->index('group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('educational_content_groups');
    }
};
