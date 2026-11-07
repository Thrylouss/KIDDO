<?php

namespace App\Http\Controllers\Parent;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\ParentProfile;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class AttendanceController extends Controller
{
    const MAX_RANGE_DAYS = 92;

    /**
     * GET /v1/parent/children/{id}/attendance?from=&to=
     * Faqat ota-onaga bog'langan, o'z bog'chasidagi farzand. Boshqa bola — 404.
     */
    public function index(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $user    = $request->user();
        $profile = ParentProfile::where('user_id', $user->id)
                                ->forOrganization((int) $user->organization_id)
                                ->first();

        $child = $profile?->children()
                          ->where('children.organization_id', $profile->organization_id)
                          ->find($id);
        abort_if(! $child, 404, "Ma'lumot topilmadi.");

        Gate::authorize('viewChild', [Attendance::class, $child]);

        $to   = AttendanceService::parseDate($data['to'] ?? null);
        $from = isset($data['from']) ? AttendanceService::parseDate($data['from']) : $to->subDays(29);

        if ($to->greaterThan(AttendanceService::today()) || $from->greaterThan($to)
            || $from->diffInDays($to) >= self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages([
                'from' => ["Sana oralig'i noto'g'ri (ko'pi bilan " . self::MAX_RANGE_DAYS . " kun, kelajak sanasisiz)."],
            ]);
        }

        $records = Attendance::forOrganization($child->organization_id)
                             ->where('child_id', $child->id)
                             ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                             ->orderByDesc('date')
                             ->get(['date', 'status', 'note']);

        $count = fn (string $status) => $records->where('status', $status)->count();

        return response()->json([
            'child'   => ['id' => $child->id, 'first_name' => $child->first_name, 'last_name' => $child->last_name],
            'from'    => $from->toDateString(),
            'to'      => $to->toDateString(),
            'records' => $records->map(fn (Attendance $a) => [
                'date'   => $a->date->toDateString(),
                'status' => $a->status,
                'note'   => $a->note,
            ])->values(),
            'summary' => [
                'present' => $count(Attendance::STATUS_PRESENT),
                'absent'  => $count(Attendance::STATUS_ABSENT),
                'excused' => $count(Attendance::STATUS_EXCUSED),
            ],
        ]);
    }
}
