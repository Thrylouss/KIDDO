<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ota-ona telefon raqamisiz (faqat username bilan) ham yaratilishi mumkin — parent_profiles.phone ixtiyoriy.
     * Faqat NOT NULL cheklovini yumshatish — mavjud yozuvlar o'zgarmaydi.
     */
    public function up(): void
    {
        Schema::table('parent_profiles', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        // NOT NULL ga qaytarilmaydi: telefonsiz ota-onalar bo'lishi mumkin
    }
};
