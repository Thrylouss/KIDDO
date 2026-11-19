<?php

namespace App\Http\Controllers\SmartSafety;

use App\Http\Controllers\Controller;
use App\Models\SafetyIncident;
use App\Models\TeacherProfile;
use App\Services\SmartSafety\IncidentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Tarbiyachi: faqat o'z guruhlari bolalariga oid insidentlar; qabul qilish va yechish. */
class TeacherController extends Controller
{
    public function __construct(private IncidentService $incidents) {}

    public function index(Request $request): JsonResponse
    {
        $rows = $this->scope($request)->unresolved()->with(['child', 'device', 'zone'])->orderByDesc('opened_at')->limit(100)->get();

        return response()->json(['data' => $rows->map(fn ($i) => $this->incidents->resource($i))->values()]);
    }

    public function acknowledge(Request $request, int $id): JsonResponse
    {
        $i = $this->incidents->acknowledge($this->scope($request)->findOrFail($id), $request->user(), $request->ip());

        return response()->json(['data' => $this->incidents->resource($i->fresh(['child', 'device', 'zone']))]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500', 'not_regex:/<[^>]*>/']], ['note.*' => "Yechim izohini kiriting (3–500 belgi)."]);
        $i = $this->incidents->resolve($this->scope($request)->findOrFail($id), $request->user(), $data['note'], $request->ip());

        return response()->json(['data' => $this->incidents->resource($i->fresh(['child', 'device', 'zone']))]);
    }

    private function scope(Request $request)
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
        abort_if(! $profile || ! $profile->is_active, 403, 'Tarbiyachi profili topilmadi.');
        $groupIds = $profile->groups()->where('groups.organization_id', $profile->organization_id)->pluck('groups.id');

        return SafetyIncident::forOrganization($profile->organization_id)
            ->whereHas('child', fn ($q) => $q->whereIn('group_id', $groupIds));
    }
}
