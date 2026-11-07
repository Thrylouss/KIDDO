<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Telegram Bot API orqali xabar yuborish (faqat backend). Token faqat konfiguratsiyada; xato matnlaridan
 * token har doim olib tashlanadi — bazaga yoki logga tushmaydi.
 */
class TelegramNotifier
{
    public function configured(): bool
    {
        return $this->token() !== '' && $this->chatId() !== '';
    }

    /** @return array{ok: bool, error: ?string} */
    public function send(string $text): array
    {
        if (! $this->configured()) {
            return ['ok' => false, 'error' => 'Telegram sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).'];
        }

        try {
            $response = Http::asJson()->acceptJson()->timeout(8)->connectTimeout(4)
                ->post("https://api.telegram.org/bot{$this->token()}/sendMessage", [
                    'chat_id'                  => $this->chatId(),
                    'text'                     => $text,
                    'disable_web_page_preview' => true,
                ]);

            if ($response->successful() && $response->json('ok') === true) {
                return ['ok' => true, 'error' => null];
            }

            $description = (string) ($response->json('description') ?? 'Nomaʼlum xato');

            return ['ok' => false, 'error' => $this->scrub("HTTP {$response->status()}: {$description}")];
        } catch (Throwable $e) {
            // cURL 6 = «Could not resolve host» (Node'da ENOTFOUND): server DNS/internetga chiqa olmayapti
            if (str_contains($e->getMessage(), 'cURL error 6') || str_contains($e->getMessage(), 'Could not resolve host')) {
                return ['ok' => false, 'error' => 'api.telegram.org manzili topilmadi (DNS / ENOTFOUND): server internetga yoki DNS ga chiqa olmayapti.'];
            }

            return ['ok' => false, 'error' => $this->scrub(class_basename($e) . ': ' . $e->getMessage())];
        }
    }

    /** Tokenni (va bot URL'ini) xato matnidan olib tashlaydi; uzunlikni cheklaydi. */
    public function scrub(string $message): string
    {
        $token = $this->token();
        if ($token !== '') {
            $message = str_replace($token, '***', $message);
        }
        $message = preg_replace('#bot\d+:[A-Za-z0-9_-]+#', 'bot***', $message);

        return mb_substr($message, 0, 480);
    }

    private function token(): string
    {
        return trim((string) config('kiddo.telegram.bot_token'));
    }

    private function chatId(): string
    {
        return trim((string) config('kiddo.telegram.chat_id'));
    }
}
