<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Vaqtinchalik parol bilan yaratilgan akkaunt birinchi kirishda parolni almashtiradi (must_change_password).
     * Tarbiyachi telefon raqamisiz (faqat username bilan) ham yaratilishi mumkin — teacher_profiles.phone ixtiyoriy.
     * Faqat qo'shimcha ustun va NOT NULL cheklovini yumshatish — mavjud yozuvlar o'zgarmaydi.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_change_password')->default(false)->after('password');
        });

        Schema::table('teacher_profiles', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('must_change_password');
        });
        // teacher_profiles.phone NOT NULL ga qaytarilmaydi: telefonsiz tarbiyachilar bo'lishi mumkin
    }
};
