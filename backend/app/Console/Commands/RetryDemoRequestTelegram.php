<?php

namespace App\Console\Commands;

use App\Services\DemoRequestService;
use App\Services\TelegramNotifier;
use Illuminate\Console\Command;

class RetryDemoRequestTelegram extends Command
{
    protected $signature = 'kiddo:demo-requests:retry-telegram';

    protected $description = "Telegramga yuborilmagan DEMO arizalarini qayta yuboradi";

    public function handle(DemoRequestService $service, TelegramNotifier $telegram): int
    {
        if (! $telegram->configured()) {
            $this->warn('Telegram sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). Hech narsa yuborilmadi.');

            return self::SUCCESS;
        }

        $result = $service->retryPending((int) config('kiddo.telegram.max_attempts', 5));
        $this->info("Yuborildi: {$result['sent']}, xato: {$result['failed']}");

        return self::SUCCESS;
    }
}
