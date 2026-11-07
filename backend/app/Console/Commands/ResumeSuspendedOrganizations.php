<?php

namespace App\Console\Commands;

use App\Services\OrganizationService;
use Illuminate\Console\Command;

class ResumeSuspendedOrganizations extends Command
{
    protected $signature = 'kiddo:organizations:resume-suspended';

    protected $description = "To'xtatish muddati tugagan bog'chalarni avtomatik faollashtiradi";

    public function handle(OrganizationService $orgs): int
    {
        $count = $orgs->resumeExpiredSuspensions();
        $this->info("Faollashtirildi: {$count}");

        return self::SUCCESS;
    }
}
