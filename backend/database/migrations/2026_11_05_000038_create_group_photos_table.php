<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Guruh fotogalereyasi (MVP «Photos/Media»): rahbar va guruh tarbiyachisi yuklaydi, shu guruh bolalarining
     * ota-onalari mobil ilovada ko'radi. Fayllar yopiq diskda — faqat ruxsat tekshiruvidan o'tgan endpoint orqali.
     */
    public function up(): void
    {
        Schema::create('group_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('caption', 255)->nullable();
            $table->date('taken_on');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['group_id', 'taken_on']);
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_photos');
    }
};
