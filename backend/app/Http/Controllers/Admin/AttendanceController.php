<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\ServesMonthlyAttendance;
use App\Http\Controllers\Teacher\AttendanceController as TeacherAttendanceController;
use App\Models\Attendance;
use App\Models\Group;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class AttendanceController extends AdminController
{
    use ServesMonthlyAttendance;

    public function __construct(private AttendanceService $attendance) {}

    /** GET /v1/admin/attendance?date=&group_id= — bog'chaning istalgan guruhi. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'     => ['nullable', 'date_format:Y-m-d'],
            'group_id' => ['nullable', 'integer'],
        ]);

        $date = AttendanceService::parseDate($data['date'] ?? null);
        if ($date->greaterThan(AttendanceService::today())) {
            throw ValidationException::withMessages(['date' => ['Kelajakdagi sana tanlanmasin.']]);
        }

        $groups = $this->groups($this->orgId($request));

        if ($groups->isEmpty()) {
            return response()->json([
                'groups'        => [],
                'group'         => null,
                'date'          => $date->toDateString(),
                'editable'      => false,
                'editable_from' => AttendanceService::editableFrom($request->user())->toDateString(),
                'children'      => [],
                'summary'       => null,
            ]);
        }

        $group = isset($data['group_id']) ? $groups->firstWhere('id', (int) $data['group_id']) : $groups->first();
        abort_if(! $group, 404, 'Guruh topilmadi.');

        return response()->json($this->payload($groups, $group, $date, $request));
    }

    /** PUT /v1/admin/attendance — tuzatish (30 kunlik oyna). */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(TeacherAttendanceController::recordRules());

        $groups = $this->groups($this->orgId($request));
        $group  = $groups->firstWhere('id', (int) $data['group_id']);
        abort_if(! $group, 404, 'Guruh topilmadi.');

        $date = AttendanceService::parseDate($data['date']);
        Gate::authorize('mark', [Attendance::class, $group, $date]);

        $this->attendance->record($group, $date, $data['records'], $request->user(), $request->ip());

        return response()->json($this->payload($groups, $group, $date, $request) + [
            'message' => 'Davomat saqlandi.',
        ]);
    }

    protected function reportGroups(Request $request): Collection
    {
        return $this->groups($this->orgId($request));
    }

    private function groups(int $orgId): Collection
    {
        return Group::forOrganization($orgId)
                    ->orderBy('name')
                    ->get(['id', 'organization_id', 'name', 'age_category', 'capacity']);
    }

    private function payload(Collection $groups, Group $group, CarbonImmutable $date, Request $request): array
    {
        return [
            'groups' => $groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values(),
        ] + $this->attendance->dayView($group, $date, $request->user());
    }
}
