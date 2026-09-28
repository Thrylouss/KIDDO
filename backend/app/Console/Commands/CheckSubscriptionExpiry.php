<?php

namespace App\Console\Commands;

use App\Services\SubscriptionService;
use Illuminate\Console\Command;

class CheckSubscriptionExpiry extends Command
{
    protected $signature = 'subscriptions:check-expiry';

    protected $description = 'Mark expired and past-due subscriptions based on their end dates';

    public function handle(SubscriptionService $service): int
    {
        $affected = $service->checkExpiry();

        $this->info("Subscription expiry check complete. Affected: {$affected}");

        return Command::SUCCESS;
    }
}
