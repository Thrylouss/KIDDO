<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Xabarlar: tarbiyachi/admin → ota-onalar (bitta bola ota-onalari yoki butun guruh).
     * Har bir qabul qiluvchi uchun alohida o'qilgan holati. Real-time yoki Telegram yo'q.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('child_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('audience', 10);          // child | group
            $table->string('subject', 150)->nullable();
            $table->text('body');
            $table->timestamps();

            $table->index(['organization_id', 'created_at']);
            $table->index(['group_id', 'created_at']);
        });

        Schema::create('message_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_profile_id')->constrained('parent_profiles')->cascadeOnDelete();
            $table->foreignId('child_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['message_id', 'parent_profile_id']);
            $table->index(['parent_profile_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_recipients');
        Schema::dropIfExists('messages');
    }
};
