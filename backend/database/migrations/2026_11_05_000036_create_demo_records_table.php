<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Namoyish uchun yaratilgan (sun'iy) yozuvlar ro'yxati — kiddo:demo-data. Haqiqiy ma'lumotdan aniq ajratish
     * va kerak bo'lsa faqat demo yozuvlarni olib tashlash (--purge) uchun. Yangi jadval — mavjud jadvallarga tegilmaydi.
     */
    public function up(): void
    {
        Schema::create('demo_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('model_type', 50);   // group, child, user, teacher_profile, parent_profile
            $table->unsignedBigInteger('model_id');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['model_type', 'model_id']);
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demo_records');
    }
};
