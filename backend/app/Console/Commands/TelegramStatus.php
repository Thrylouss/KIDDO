<?php

namespace App\Console\Commands;

use App\Services\TelegramNotifier;
use Illuminate\Console\Command;

/**
 * Telegram sozlamasini tekshirish. Token va chat ID hech qachon chop etilmaydi —
 * faqat «sozlangan / sozlanmagan». --send-test bilan sinov xabari yuboriladi.
 */
class TelegramStatus extends Command
{
    protected $signature = 'kiddo:telegram:status {--send-test : Sozlangan chatga sinov xabarini yuborish}';

    protected $description = "Telegram bot sozlamasini tekshiradi (token ko'rsatilmaydi)";

    public function handle(TelegramNotifier $telegram): int
    {
        $this->line('TELEGRAM_BOT_TOKEN: ' . (filled(config('kiddo.telegram.bot_token')) ? 'berilgan' : "yo'q"));
        $this->line('TELEGRAM_CHAT_ID:   ' . (filled(config('kiddo.telegram.chat_id')) ? 'berilgan' : "yo'q"));

        if (! $telegram->configured()) {
            $this->warn("Telegram sozlanmagan — DEMO arizalari faqat bazada saqlanadi va Super Admin panelida ko'rinadi.");

            return self::SUCCESS;
        }

        if (! $this->option('send-test')) {
            $this->info("Sozlangan. Sinov xabari uchun: php artisan kiddo:telegram:status --send-test");

            return self::SUCCESS;
        }

        $result = $telegram->send("✅ KIDDO: Telegram bot sozlamasi tekshirildi (" . now()->format('d.m.Y H:i') . ')');
        if ($result['ok']) {
            $this->info('Sinov xabari yuborildi.');

            return self::SUCCESS;
        }

        $this->error('Yuborilmadi: ' . $result['error']); // xato matni TelegramNotifier::scrub orqali tokendan tozalangan

        return self::FAILURE;
    }
}
