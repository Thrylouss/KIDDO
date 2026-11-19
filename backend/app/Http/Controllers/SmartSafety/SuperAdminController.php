<?php

namespace App\Http\Controllers\SmartSafety;

use App\Http\Controllers\Controller;
use App\Models\IotDevice;
use App\Models\Organization;
use App\Models\SafetyIncident;
use Illuminate\Http\JsonResponse;

/** Super Admin: global ko'rinish — faqat agregatsiyalangan sonlar, bolalar haqidagi shaxsiy ma'lumotsiz. */
class SuperAdminController extends Controller
{
    public function overview(): JsonResponse
    {
        $devices = IotDevice::selectRaw("organization_id, count(*) as total, sum(case when status = 'online' then 1 else 0 end) as online,
                sum(case when battery_level is not null and battery_level <= ? then 1 else 0 end) as low_battery", [(int) config('kiddo.smart_safety.battery_low_percent', 15)])
            ->groupBy('organization_id')->get()->keyBy('organization_id');
        $incidents = SafetyIncident::unresolved()->selectRaw('organization_id, count(*) as open')->groupBy('organization_id')->pluck('open', 'organization_id');
        $orgs = Organization::whereIn('id', $devices->keys()->merge($incidents->keys())->unique())->orderBy('name')->get(['id', 'name']);

        return response()->json([
            'data' => $orgs->map(fn ($o) => [
                'organization' => ['id' => $o->id, 'name' => $o->name],
                'devices'      => (int) ($devices[$o->id]->total ?? 0),
                'online'       => (int) ($devices[$o->id]->online ?? 0),
                'low_battery'  => (int) ($devices[$o->id]->low_battery ?? 0),
                'open_incidents' => (int) ($incidents[$o->id] ?? 0),
            ])->values(),
            'totals' => [
                'devices' => (int) $devices->sum('total'), 'online' => (int) $devices->sum('online'),
                'open_incidents' => (int) $incidents->sum(),
            ],
        ]);
    }
}
