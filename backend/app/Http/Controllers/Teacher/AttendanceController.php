<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Concerns\ServesMonthlyAttendance;
use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\TeacherProfile;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AttendanceController extends Controller
{
    use ServesMonthlyAttendance;

    public function __construct(private AttendanceService $attendance) {}

    /** GET /v1/teacher/dashboard?date=&group_id= — faqat tarbiyachiga biriktirilgan guruhlar. */
    public function dashboard(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'     => ['nullable', 'date_format:Y-m-d'],
            'group_id' => ['nullable', 'integer'],
        ]);

        $profile = $this->profile($request);
        $date    = $this->pastOrToday($data['date'] ?? null);
        $groups  = $this->groups($profile);

        if ($groups->isEmpty()) {
            return response()->json([
                'teacher'       => $this->teacherResource($profile),
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

        return response()->json($this->payload($profile, $groups, $group, $date, $request));
    }

    /** PUT /v1/teacher/attendance — davomatni yozish yoki tuzatish. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->recordRules());

        $profile = $this->profile($request);
        $groups  = $this->groups($profile);
        $group   = $groups->firstWhere('id', (int) $data['group_id']);
        abort_if(! $group, 404, 'Guruh topilmadi.');

        $date = AttendanceService::parseDate($data['date']);
        Gate::authorize('mark', [Attendance::class, $group, $date]);

        $this->attendance->record($group, $date, $data['records'], $request->user(), $request->ip());

        return response()->json($this->payload($profile, $groups, $group, $date, $request) + [
            'message' => 'Davomat saqlandi.',
        ]);
    }

    public static function recordRules(): array
    {
        return [
            'date'               => ['required', 'date_format:Y-m-d'],
            'group_id'           => ['required', 'integer'],
            'records'            => ['required', 'array', 'min:1', 'max:200'],
            'records.*.child_id' => ['required', 'integer', 'distinct'],
            'records.*.status'   => ['required', Rule::in(Attendance::STATUSES)],
            // «Sababli» uchun sabab kategoriyasi va izoh majburiy (oylik hisobotda ko'rinadi)
            'records.*.excuse_reason' => ['nullable', 'required_if:records.*.status,' . Attendance::STATUS_EXCUSED, Rule::in(Attendance::EXCUSE_REASONS)],
            'records.*.note'     => ['nullable', 'required_if:records.*.status,' . Attendance::STATUS_EXCUSED, 'string', 'max:255'],
        ];
    }

    protected function reportGroups(Request $request): Collection
    {
        return $this->groups($this->profile($request));
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

    private function groups(TeacherProfile $profile): Collection
    {
        return $profile->groups()
                       ->where('groups.organization_id', $profile->organization_id)
                       ->orderByDesc('teacher_group.is_primary')
                       ->orderBy('groups.name')
                       ->get(['groups.id', 'groups.organization_id', 'groups.name', 'groups.age_category', 'groups.capacity']);
    }

    private function pastOrToday(?string $date): CarbonImmutable
    {
        $parsed = AttendanceService::parseDate($date);
        if ($parsed->greaterThan(AttendanceService::today())) {
            throw ValidationException::withMessages(['date' => ['Kelajakdagi sana tanlanmasin.']]);
        }
        return $parsed;
    }

    private function teacherResource(TeacherProfile $profile): array
    {
        return [
            'id'       => $profile->id,
            'name'     => trim("{$profile->first_name} {$profile->last_name}"),
            'position' => $profile->position,
        ];
    }

    private function payload(TeacherProfile $profile, Collection $groups, $group, CarbonImmutable $date, Request $request): array
    {
        return [
            'teacher' => $this->teacherResource($profile),
            'groups'  => $groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values(),
        ] + $this->attendance->dayView($group, $date, $request->user());
    }
}
