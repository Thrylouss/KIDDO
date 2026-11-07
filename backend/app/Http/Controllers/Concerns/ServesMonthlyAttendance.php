<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Group;
use App\Services\AttendanceService;
use App\Services\Export\AttendanceReportService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Oylik davomat tarixi va eksport (tarbiyachi va admin uchun umumiy).
 * Farqi faqat ruxsat etilgan guruhlar ro'yxatida; ro'yxatda bo'lmagan guruh — 404,
 * keyin AttendancePolicy::viewGroup qo'shimcha tekshiradi.
 * Klass $attendance (AttendanceService) xususiyatiga ega bo'lishi kerak.
 */
trait ServesMonthlyAttendance
{
    /** Foydalanuvchi ko'ra oladigan guruhlar (organization_id ustuni bilan). */
    abstract protected function reportGroups(Request $request): Collection;

    /** GET .../attendance/monthly?month=YYYY-MM&group_id=&from=&to=&child_id= */
    public function monthly(Request $request): JsonResponse
    {
        [$group, $from, $to, $childId] = $this->reportScope($request);

        $month = $this->attendance->month($group, $from, $to, $childId);
        abort_if($childId !== null && $month['children']->isEmpty(), 404, "Ma'lumot topilmadi.");

        return response()->json($month + [
            'groups' => $this->reportGroups($request)->map(fn (Group $g) => ['id' => $g->id, 'name' => $g->name])->values(),
        ]);
    }

    /** GET .../attendance/export?format=xlsx|pdf&month=YYYY-MM&group_id=&from=&to= */
    public function export(Request $request, AttendanceReportService $reports): Response
    {
        $format = $request->validate(['format' => ['required', Rule::in(['xlsx', 'pdf'])]])['format'];
        [$group, $from, $to, $childId] = $this->reportScope($request);

        $month = $this->attendance->month($group, $from, $to, $childId);
        $month['children'] = $month['children']->all();
        abort_if($childId !== null && $month['children'] === [], 404, "Ma'lumot topilmadi.");

        ActivityLog::record(
            'attendance.exported',
            "Davomat hisoboti yuklab olindi: {$group->name}, {$month['month']}",
            $request->user()->id,
            $group->organization_id,
            ['group_id' => $group->id, 'from' => $month['from'], 'to' => $month['to'], 'format' => $format],
            $request->ip()
        );

        $name = $reports->filename($month, $format);

        if ($format === 'xlsx') {
            return response()->download($reports->xlsx($month), $name, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(true);
        }

        return response($reports->pdf($month), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $name . '"',
        ]);
    }

    /** @return array{0: Group, 1: \Carbon\CarbonImmutable, 2: \Carbon\CarbonImmutable, 3: int|null} */
    private function reportScope(Request $request): array
    {
        $data = $request->validate([
            'month'    => ['required', 'date_format:Y-m'],
            'group_id' => ['nullable', 'integer'],
            'from'     => ['nullable', 'date_format:Y-m-d'],
            'to'       => ['nullable', 'date_format:Y-m-d'],
            'child_id' => ['nullable', 'integer'],
        ]);

        $groups = $this->reportGroups($request);
        $group  = isset($data['group_id']) ? $groups->firstWhere('id', (int) $data['group_id']) : $groups->first();
        abort_if(! $group, 404, 'Guruh topilmadi.');

        Gate::authorize('viewGroup', [Attendance::class, $group]);

        [$from, $to] = AttendanceService::monthRange($data['month'], $data['from'] ?? null, $data['to'] ?? null);

        return [$group, $from, $to, isset($data['child_id']) ? (int) $data['child_id'] : null];
    }
}
