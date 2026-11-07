<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Landing sahifadagi «14 kunlik bepul DEMO» arizalari. Ariza avval shu yerga saqlanadi, keyin Telegram'ga yuboriladi —
     * yuborish natijasi (holat, vaqt, urinishlar, xato) alohida qayd etiladi. Akkauntlar avtomatik yaratilmaydi:
     * Super Admin bog'cha bilan bog'lanib, demo tashkilotni o'zi tayyorlaydi (organization_id, demo_starts_at/ends_at).
     */
    public function up(): void
    {
        Schema::create('demo_requests', function (Blueprint $table) {
            $table->id();
            $table->string('kindergarten_name');
            $table->string('kindergarten_type', 20);          // davlat | xususiy
            $table->string('region', 100);
            $table->string('district', 100);
            $table->string('address', 500)->nullable();
            $table->string('director_name');
            $table->string('phone', 20);                       // +998XXXXXXXXX
            $table->unsignedInteger('children_count')->nullable();
            $table->unsignedSmallInteger('groups_count')->nullable();
            $table->text('comment')->nullable();
            $table->timestamp('consent_at');

            $table->string('status', 20)->default('new');      // new | contacted | preparing | active | rejected
            $table->text('internal_note')->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();

            // Kelajakdagi aktivatsiya: tayyorlangan demo tashkilot va 14 kunlik muddat
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->timestamp('demo_starts_at')->nullable();
            $table->timestamp('demo_ends_at')->nullable();

            // Telegram yetkazish holati (token hech qachon saqlanmaydi)
            $table->string('telegram_status', 20)->default('pending'); // pending | sent | failed | not_configured
            $table->unsignedSmallInteger('telegram_attempts')->default(0);
            $table->timestamp('telegram_sent_at')->nullable();
            $table->timestamp('telegram_last_attempt_at')->nullable();
            $table->string('telegram_error', 500)->nullable();

            $table->string('ip_hash', 64)->nullable();          // spam himoyasi uchun (IP'ning o'zi saqlanmaydi)
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['phone', 'created_at']);
            $table->index('telegram_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demo_requests');
    }
};
