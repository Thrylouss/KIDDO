<?php

namespace App\Http\Controllers\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Services\AttendanceService;
use App\Services\ChildPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends AdminController
{
    public function summary(Request $request, AttendanceService $attendance, ChildPaymentService $payments): JsonResponse
    {
        $orgId = $this->orgId($request);

        $org = Organization::find($orgId);

        return response()->json([
            'bogcha'             => $org ? [
                'id' => $org->id, 'name' => $org->name, 'address' => $org->address, 'phone' => $org->phone,
                'district' => $org->district, 'number' => $org->number, 'mfy' => $org->mfy, 'capacity' => $org->capacity,
                'director_name' => $org->director_name, 'director_phone' => $org->director_phone,
            ] : null,
            'bolalar_soni'       => Child::forOrganization($orgId)->count(),
            'faol_bolalar_soni'  => Child::forOrganization($orgId)->active()->count(),
            'guruhlar_soni'      => Group::forOrganization($orgId)->active()->count(),
            'tarbiyachilar_soni' => TeacherProfile::forOrganization($orgId)->active()->count(),
            'ota_onalar_soni'    => ParentProfile::forOrganization($orgId)->count(),
            'bugungi_davomat'    => $attendance->organizationSummary($orgId, AttendanceService::today()),
            // Joriy oy to'lov holati (jadval bo'lmagan eski bazada — null)
            'tolovlar'           => \Illuminate\Support\Facades\Schema::hasTable('child_payments')
                ? $payments->organizationSummary($orgId, ChildPaymentService::monthStart(null)) : null,
            // So'nggi faoliyatlar — shu bog'cha guruhlaridagi oxirgi 5 ta kundalik mashg'ulot yozuvi
            'songgi_faoliyatlar' => GroupActivity::forOrganization($orgId)
                ->with('group:id,name')
                ->orderByDesc('date')->orderByDesc('id')
                ->limit(5)
                ->get(['id', 'group_id', 'date', 'title', 'direction', 'starts_at'])
                ->map(fn (GroupActivity $a) => [
                    'id' => $a->id, 'title' => $a->title, 'direction' => $a->direction,
                    'date' => $a->date->toDateString(), 'starts_at' => $a->starts_at ? substr($a->starts_at, 0, 5) : null,
                    'group' => $a->group ? ['id' => $a->group->id, 'name' => $a->group->name] : null,
                ])->values(),
        ]);
    }
}
