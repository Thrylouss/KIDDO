<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * sanctum:prune-expired o'rniga. Sanctum buyrug'i expires_at'dan qat'i nazar created_at
 * bo'yicha (global 7 kun) ham o'chiradi — bu 30 kunlik mobil refresh tokenlarni muddatidan
 * oldin yo'q qilardi. Bu yerda global muddat faqat expires_at bo'lmagan (web) tokenlarga qo'llanadi.
 */
class PruneExpiredTokens extends Command
{
    protected $signature = 'tokens:prune-expired {--hours=24 : Muddati shuncha soatdan ko\'proq o\'tgan tokenlar}';

    protected $description = 'Muddati o\'tgan Sanctum tokenlarini o\'chirish (mobil sessiyalarni hisobga olgan holda)';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');

        $deleted = PersonalAccessToken::where('expires_at', '<', now()->subHours($hours))->delete();

        if ($expiration = config('sanctum.expiration')) {
            $deleted += PersonalAccessToken::whereNull('expires_at')
                ->where('created_at', '<', now()->subMinutes($expiration + $hours * 60))
                ->delete();
        }

        $this->info("O'chirilgan tokenlar: {$deleted}");

        return Command::SUCCESS;
    }
}
