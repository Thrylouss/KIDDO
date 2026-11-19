<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mashg'ulotda foydalanilgan materiallar tarixi (tarbiyachi qayd etadi, rahbar ko'radi).
     * Kontent soft-delete qilinsa ham tarix saqlanadi.
     */
    public function up(): void
    {
        if (Schema::hasTable('educational_content_usage_logs')) {
            return;
        }

        Schema::create('educational_content_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('educational_content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->date('used_on');
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'used_on']);
            $table->index('educational_content_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('educational_content_usage_logs');
    }
};
