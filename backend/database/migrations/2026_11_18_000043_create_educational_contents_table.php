<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * KIDDO Kids — bog'cha kontent kutubxonasi (faqat YouTube embed; video fayllar saqlanmaydi).
     * Har bir yozuv bitta bog'chaga tegishli (organization_id) — boshqa bog'chalar ko'rmaydi.
     * Faqat yangi jadval yaratiladi: mavjud jadvallar va ma'lumotlarga tegilmaydi.
     */
    public function up(): void
    {
        if (Schema::hasTable('educational_contents')) {
            return; // qayta ishga tushirilganda xavfsiz
        }

        Schema::create('educational_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('source_type', 20)->default('youtube');      // hozircha faqat youtube
            $table->string('youtube_video_id', 11);                     // faqat ID — URL/iframe kodi saqlanmaydi
            $table->unsignedInteger('duration_seconds')->nullable();     // YouTube API kaliti bo'lsa
            $table->boolean('embeddable')->nullable();                  // null — tekshirilmagan
            $table->string('language', 2);                              // uz | ru | en
            $table->string('category', 30);                             // lessons | cartoons | languages | music | activities
            $table->unsignedTinyInteger('min_age');
            $table->unsignedTinyInteger('max_age');
            $table->string('status', 20)->default('active');            // active | hidden
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'category']);
            $table->index(['organization_id', 'youtube_video_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('educational_contents');
    }
};
