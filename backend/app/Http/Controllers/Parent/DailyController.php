<?php

namespace App\Http\Controllers\Parent;

use App\Http\Controllers\Controller;
use App\Models\MealRecord;
use App\Models\ParentProfile;
use App\Services\AttendanceService;
use App\Services\DailyRecordService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class DailyController extends Controller
{
    public function __construct(private DailyRecordService $daily) {}

    /**
     * GET /v1/parent/children/{id}/daily?date= — faqat o'qish (web va mobil token).
     * Faqat ota-onaga bog'langan, o'z bog'chasidagi farzand. Boshqa bola — 404.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $user    = $request->user();
        $profile = ParentProfile::where('user_id', $user->id)
                                ->forOrganization((int) $user->organization_id)
                                ->first();

        $child = $profile?->children()
                          ->where('children.organization_id', $profile->organization_id)
                          ->find($id);
        abort_if(! $child, 404, "Ma'lumot topilmadi.");

        Gate::authorize('viewChild', [MealRecord::class, $child]);

        $date = AttendanceService::parseDate($data['date'] ?? null);
        if ($date->greaterThan(AttendanceService::today())) {
            throw ValidationException::withMessages(['date' => ['Kelajakdagi sana tanlanmasin.']]);
        }

        return response()->json($this->daily->childDay($child, $date));
    }
}
