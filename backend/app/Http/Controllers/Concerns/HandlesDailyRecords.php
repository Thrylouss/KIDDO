<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\SleepRecord;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Tarbiyachi va admin uchun umumiy kundalik yozuv amallari.
 * Farqi faqat ruxsat etilgan guruhlar ro'yxatida: tarbiyachi — biriktirilgan guruhlar,
 * admin — bog'chaning barcha guruhlari. Ro'yxatda bo'lmagan guruh yoki yozuv — 404.
 * Klass $daily (DailyRecordService) xususiyatiga ega bo'lishi kerak.
 */
trait HandlesDailyRecords
{
    /** Foydalanuvchi ishlay oladigan guruhlar (organization_id ustuni bilan). */
    abstract protected function dailyGroups(Request $request): Collection;

    abstract protected function dailyOrganizationId(Request $request): int;

    /** GET .../daily?date=&group_id= */
    public function show(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'     => ['nullable', 'date_format:Y-m-d'],
            'group_id' => ['nullable', 'integer'],
        ]);

        $date = AttendanceService::parseDate($data['date'] ?? null);
        if ($date->greaterThan(AttendanceService::today())) {
            throw ValidationException::withMessages(['date' => ['Kelajakdagi sana tanlanmasin.']]);
        }

        $groups = $this->dailyGroups($request);
        // Aniq so'ralgan guruh ruxsat etilgan ro'yxatda bo'lmasa — ro'yxat bo'sh bo'lsa ham 404
        if ($groups->isEmpty() && ! isset($data['group_id'])) {
            return response()->json([
                'groups'        => [],
                'group'         => null,
                'date'          => $date->toDateString(),
                'editable'      => false,
                'editable_from' => AttendanceService::editableFrom($request->user())->toDateString(),
                'meal_types'    => MealRecord::TYPES,
                'children'      => [],
                'activities'    => [],
            ]);
        }

        $group = isset($data['group_id']) ? $groups->firstWhere('id', (int) $data['group_id']) : $groups->first();
        abort_if(! $group, 404, 'Guruh topilmadi.');

        return response()->json($this->dailyPayload($groups, $group, $date, $request));
    }

    /** PUT .../daily/meals */
    public function storeMeals(Request $request): JsonResponse
    {
        $data = $request->validate(self::mealRules());
        [$groups, $group, $date] = $this->writableGroup($request, $data, MealRecord::class);

        $this->daily->recordMeals($group, $date, $data['meal_type'], $data['served_at'], $data['records'], $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => 'Ovqatlanish saqlandi.']);
    }

    /** DELETE .../daily/meals/{id} */
    public function destroyMeal(Request $request, int $id): JsonResponse
    {
        $meal = MealRecord::forOrganization($this->dailyOrganizationId($request))->findOrFail($id);
        [$groups, $group, $date] = $this->recordGroup($request, $meal, MealRecord::class);

        $this->daily->deleteMeal($meal, $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => "Ovqatlanish yozuvi o'chirildi."]);
    }

    /** PUT .../daily/sleep */
    public function storeSleep(Request $request): JsonResponse
    {
        $data = $request->validate(self::sleepRules());
        [$groups, $group, $date] = $this->writableGroup($request, $data, SleepRecord::class);

        $this->daily->recordSleep($group, $date, $data['records'], $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => 'Uyqu saqlandi.']);
    }

    /** DELETE .../daily/sleep/{id} */
    public function destroySleep(Request $request, int $id): JsonResponse
    {
        $sleep = SleepRecord::forOrganization($this->dailyOrganizationId($request))->findOrFail($id);
        [$groups, $group, $date] = $this->recordGroup($request, $sleep, SleepRecord::class);

        $this->daily->deleteSleep($sleep, $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => "Uyqu yozuvi o'chirildi."]);
    }

    /** POST .../daily/activities */
    public function storeActivity(Request $request): JsonResponse
    {
        $data = $request->validate(self::activityRules());
        [$groups, $group, $date] = $this->writableGroup($request, $data, GroupActivity::class);

        $this->daily->createActivity($group, $date, $data, $request->user());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => "Mashg'ulot qo'shildi."], 201);
    }

    /** PUT .../daily/activities/{id} — guruh va sana o'zgarmaydi. */
    public function updateActivity(Request $request, int $id): JsonResponse
    {
        $activity = GroupActivity::forOrganization($this->dailyOrganizationId($request))->findOrFail($id);
        [$groups, $group, $date] = $this->recordGroup($request, $activity, GroupActivity::class);

        $data = $request->validate([
            'title'       => ['sometimes', 'required', 'string', 'max:150'],
            'direction'   => ['sometimes', 'nullable', Rule::in(GroupActivity::DIRECTIONS)],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'result'      => ['sometimes', 'nullable', 'string', 'max:1000'],
            'starts_at'   => ['sometimes', 'nullable', 'date_format:H:i'],
            'ends_at'     => ['sometimes', 'nullable', 'date_format:H:i'],
            'child_ids'   => ['sometimes', 'array', 'max:200'],
            'child_ids.*' => ['integer', 'distinct'],
        ]);

        $this->daily->updateActivity($activity, $data, $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => "Mashg'ulot yangilandi."]);
    }

    /** DELETE .../daily/activities/{id} */
    public function destroyActivity(Request $request, int $id): JsonResponse
    {
        $activity = GroupActivity::forOrganization($this->dailyOrganizationId($request))->findOrFail($id);
        [$groups, $group, $date] = $this->recordGroup($request, $activity, GroupActivity::class);

        $this->daily->deleteActivity($activity, $request->user(), $request->ip());

        return response()->json($this->dailyPayload($groups, $group, $date, $request) + ['message' => "Mashg'ulot o'chirildi."]);
    }

    // ── Validatsiya qoidalari ─────────────────────────────────────

    public static function mealRules(): array
    {
        return [
            'date'               => ['required', 'date_format:Y-m-d'],
            'group_id'           => ['required', 'integer'],
            'meal_type'          => ['required', Rule::in(MealRecord::TYPES)],
            'served_at'          => ['required', 'date_format:H:i'],
            'records'            => ['required', 'array', 'min:1', 'max:200'],
            'records.*.child_id' => ['required', 'integer', 'distinct'],
            'records.*.ate'      => ['sometimes', 'boolean'],
            'records.*.note'     => ['nullable', 'string', 'max:255'],
        ];
    }

    public static function sleepRules(): array
    {
        return [
            'date'                 => ['required', 'date_format:Y-m-d'],
            'group_id'             => ['required', 'integer'],
            'records'              => ['required', 'array', 'min:1', 'max:200'],
            'records.*.child_id'   => ['required', 'integer', 'distinct'],
            'records.*.started_at' => ['required', 'date_format:H:i'],
            'records.*.ended_at'   => ['nullable', 'date_format:H:i'],
            'records.*.note'       => ['nullable', 'string', 'max:255'],
        ];
    }

    public static function activityRules(): array
    {
        return [
            'date'        => ['required', 'date_format:Y-m-d'],
            'group_id'    => ['required', 'integer'],
            'title'       => ['required', 'string', 'max:150'],
            'direction'   => ['nullable', Rule::in(GroupActivity::DIRECTIONS)],
            'description' => ['nullable', 'string', 'max:1000'],
            'result'      => ['nullable', 'string', 'max:1000'],
            'starts_at'   => ['nullable', 'date_format:H:i'],
            'ends_at'     => ['nullable', 'date_format:H:i'],
            'child_ids'   => ['sometimes', 'array', 'max:200'],
            'child_ids.*' => ['integer', 'distinct'],
        ];
    }

    // ── Yordamchi ─────────────────────────────────────────────────

    /** So'rovdagi guruh ruxsat etilgan ro'yxatdan; keyin Policy (rol, sana, muddat). */
    private function writableGroup(Request $request, array $data, string $policyModel): array
    {
        $groups = $this->dailyGroups($request);
        $group  = $groups->firstWhere('id', (int) $data['group_id']);
        abort_if(! $group, 404, 'Guruh topilmadi.');

        $date = AttendanceService::parseDate($data['date']);
        Gate::authorize('manage', [$policyModel, $group, $date]);

        return [$groups, $group, $date];
    }

    /** Mavjud yozuvning guruhi ruxsat etilgan ro'yxatda bo'lishi va sanasi tahrirlanadigan bo'lishi shart. */
    private function recordGroup(Request $request, Model $record, string $policyModel): array
    {
        $groups = $this->dailyGroups($request);
        $group  = $groups->firstWhere('id', (int) $record->group_id);
        abort_if(! $group, 404, "Ma'lumot topilmadi.");

        $date = AttendanceService::parseDate($record->date->toDateString());
        Gate::authorize('manage', [$policyModel, $group, $date]);

        return [$groups, $group, $date];
    }

    private function dailyPayload(Collection $groups, Group $group, CarbonImmutable $date, Request $request): array
    {
        return [
            'groups' => $groups->map(fn (Group $g) => ['id' => $g->id, 'name' => $g->name])->values(),
        ] + $this->daily->dayView($group, $date, $request->user());
    }
}
