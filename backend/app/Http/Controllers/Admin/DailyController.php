<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\HandlesDailyRecords;
use App\Models\Group;
use App\Services\DailyRecordService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

/** /v1/admin/daily — bog'chaning barcha guruhlari, 30 kungacha orqaga. */
class DailyController extends AdminController
{
    use HandlesDailyRecords;

    public function __construct(private DailyRecordService $daily) {}

    protected function dailyGroups(Request $request): Collection
    {
        return Group::forOrganization($this->orgId($request))
                    ->orderBy('name')
                    ->get(['id', 'organization_id', 'name']);
    }

    protected function dailyOrganizationId(Request $request): int
    {
        return $this->orgId($request);
    }
}
