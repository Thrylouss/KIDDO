<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Concerns\HandlesDailyRecords;
use App\Http\Controllers\Controller;
use App\Models\TeacherProfile;
use App\Services\DailyRecordService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

/** /v1/teacher/daily — faqat tarbiyachiga biriktirilgan guruhlar, bugun va 2 kun orqaga. */
class DailyController extends Controller
{
    use HandlesDailyRecords;

    public function __construct(private DailyRecordService $daily) {}

    protected function dailyGroups(Request $request): Collection
    {
        $profile = $this->profile($request);

        return $profile->groups()
                       ->where('groups.organization_id', $profile->organization_id)
                       ->orderByDesc('teacher_group.is_primary')
                       ->orderBy('groups.name')
                       ->get(['groups.id', 'groups.organization_id', 'groups.name']);
    }

    protected function dailyOrganizationId(Request $request): int
    {
        return $this->profile($request)->organization_id;
    }

    private function profile(Request $request): TeacherProfile
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)
                                 ->forOrganization((int) $user->organization_id)
                                 ->first();

        abort_if(! $profile, 403, 'Tarbiyachi profili topilmadi.');
        abort_if(! $profile->is_active, 403, 'Tarbiyachi profili faol emas.');

        return $profile;
    }
}
