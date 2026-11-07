<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\SleepRecord;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Kundalik yozuvlar: ovqatlanish, uyqu (bolaga) va mashg'ulotlar (guruhga).
 *
 * Guruh tarkibi davomat bilan bir xil (AttendanceService::dayChildIds) — bola guruhini
 * almashtirsa ham o'sha kunning yozuvlari o'sha kundagi guruhda qoladi.
 * Yaratish log'ga yozilmaydi (recorded_by saqlanadi); tuzatish va o'chirish activity_logs ga.
 */
class DailyRecordService
{
    /**
     * Ovqatlanish va uyqu faqat o'sha kuni davomatda «Keldi» (present) deb belgilangan bolaga yoziladi.
     * Qolgan holatlar alohida xabar bilan rad etiladi: «Kelmadi», «Sababli» (kelmaganlik turi:
     * "keldi" hisobiga kirmaydi, izohlari "Kasal", "Shifokorda") va belgilanmagan davomat.
     */
    public const RECORDABLE_ATTENDANCE = Attendance::STATUS_PRESENT;

    /** Rad etish sabablari (null — davomat belgilanmagan). */
    public const BLOCKED_ATTENDANCE_LABELS = [
        Attendance::STATUS_ABSENT  => '«Kelmadi»',
        Attendance::STATUS_EXCUSED => '«Sababli» (bog\'chaga kelmagan)',
    ];

    public function __construct(private AttendanceService $attendance) {}

    // ── O'qish ────────────────────────────────────────────────────

    /** Tarbiyachi/admin uchun guruhning bir kunlik ko'rinishi. */
    public function dayView(Group $group, CarbonImmutable $date, User $viewer): array
    {
        $orgId = $group->organization_id;
        $day   = $date->toDateString();

        $children = Child::forOrganization($orgId)
            ->whereIn('id', $this->attendance->dayChildIds($group, $date))
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name']);
        $ids = $children->pluck('id');

        $statuses = Attendance::forOrganization($orgId)->whereIn('child_id', $ids)->whereDate('date', $day)->pluck('status', 'child_id');
        $meals    = MealRecord::forOrganization($orgId)->whereIn('child_id', $ids)->whereDate('date', $day)
                              ->orderBy('served_at')->get()->groupBy('child_id');
        $sleeps   = SleepRecord::forOrganization($orgId)->whereIn('child_id', $ids)->whereDate('date', $day)->get()->keyBy('child_id');

        return [
            'group'         => ['id' => $group->id, 'name' => $group->name],
            'date'          => $day,
            'editable'      => AttendanceService::isEditable($viewer, $date),
            'editable_from' => AttendanceService::editableFrom($viewer)->toDateString(),
            'meal_types'    => MealRecord::TYPES,
            'children'      => $children->map(fn (Child $c) => [
                'id'         => $c->id,
                'first_name' => $c->first_name,
                'last_name'  => $c->last_name,
                'attendance' => $statuses[$c->id] ?? null,
                'meals'      => ($meals[$c->id] ?? collect())->map(fn (MealRecord $m) => $this->mealResource($m, true))->values(),
                'sleep'      => isset($sleeps[$c->id]) ? $this->sleepResource($sleeps[$c->id], true) : null,
            ])->values(),
            'activities'    => $this->activities($orgId, $group->id, $day)->map(fn (GroupActivity $a) => $this->activityResource($a, true))->values(),
        ];
    }

    /**
     * Ota-ona uchun bitta farzandning bir kuni. Mashg'ulotlar — bolaning o'sha kundagi guruhidan
     * (davomat yozuvidagi guruh, bo'lmasa joriy guruh). Ichki ID va kim yozgani qaytarilmaydi.
     */
    public function childDay(Child $child, CarbonImmutable $date): array
    {
        $orgId = $child->organization_id;
        $day   = $date->toDateString();

        $attendance = Attendance::forOrganization($orgId)->where('child_id', $child->id)->whereDate('date', $day)->first();
        $groupId    = $attendance?->group_id ?? $child->group_id;
        $sleep      = SleepRecord::forOrganization($orgId)->where('child_id', $child->id)->whereDate('date', $day)->first();

        return [
            'child'      => ['id' => $child->id, 'first_name' => $child->first_name, 'last_name' => $child->last_name],
            'date'       => $day,
            'attendance' => $attendance?->status,
            'meals'      => MealRecord::forOrganization($orgId)->where('child_id', $child->id)->whereDate('date', $day)
                                      ->orderBy('served_at')->get()
                                      ->map(fn (MealRecord $m) => $this->mealResource($m, false))->values(),
            'sleep'      => $sleep ? $this->sleepResource($sleep, false) : null,
            'activities' => $groupId
                ? $this->activities($orgId, $groupId, $day)->map(fn (GroupActivity $a) => $this->activityResource($a, false, $child->id))->values()
                : [],
        ];
    }

    /**
     * Bolaning kunlar bo'yicha tarixi (yangi kunlar birinchi): davomat, ovqatlanish, uyqu, qatnashgan mashg'ulotlar.
     * Faqat yozuvi bor kunlar qaytariladi.
     */
    public function childHistory(Child $child, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $orgId = $child->organization_id;
        $range = [$from->toDateString(), $to->toDateString()];

        $attendance = Attendance::forOrganization($orgId)->where('child_id', $child->id)->whereBetween('date', $range)->get()
            ->keyBy(fn (Attendance $a) => $a->date->toDateString());
        $meals  = MealRecord::forOrganization($orgId)->where('child_id', $child->id)->whereBetween('date', $range)->orderBy('served_at')->get()
            ->groupBy(fn (MealRecord $m) => $m->date->toDateString());
        $sleeps = SleepRecord::forOrganization($orgId)->where('child_id', $child->id)->whereBetween('date', $range)->get()
            ->keyBy(fn (SleepRecord $s) => $s->date->toDateString());
        $activities = GroupActivity::forOrganization($orgId)->whereBetween('date', $range)
            ->whereHas('children', fn ($q) => $q->where('children.id', $child->id))
            ->orderBy('starts_at')->get(['id', 'date', 'title', 'starts_at'])
            ->groupBy(fn (GroupActivity $a) => $a->date->toDateString());

        $days = collect([$attendance->keys(), $meals->keys(), $sleeps->keys(), $activities->keys()])->flatten()->unique()->sortDesc()->values();

        return [
            'from' => $range[0],
            'to'   => $range[1],
            'days' => $days->map(fn (string $day) => [
                'date'          => $day,
                'attendance'    => $attendance[$day]->status ?? null,
                'excuse_reason' => $attendance[$day]->excuse_reason ?? null,
                'note'          => $attendance[$day]->note ?? null,
                'meals'         => ($meals[$day] ?? collect())->map(fn (MealRecord $m) => $this->mealResource($m, false))->values(),
                'sleep'         => isset($sleeps[$day]) ? $this->sleepResource($sleeps[$day], false) : null,
                'activities'    => ($activities[$day] ?? collect())->map(fn (GroupActivity $a) => ['title' => $a->title, 'starts_at' => self::time($a->starts_at)])->values(),
            ])->values(),
        ];
    }

    // ── Ovqatlanish ───────────────────────────────────────────────

    /**
     * Tanlangan bolalarga bir xil ovqat turi va vaqtini yozadi yoki yangilaydi (bola+sana+tur — bitta yozuv).
     *
     * @param array<int, array{child_id:int, ate?:bool, note?:string|null}> $records
     */
    public function recordMeals(Group $group, CarbonImmutable $date, string $type, string $servedAt, array $records, User $by, ?string $ip = null): void
    {
        $this->assertNotFutureTime($date, $servedAt, 'served_at');

        DB::transaction(function () use ($group, $date, $type, $servedAt, $records, $by, $ip) {
            $this->lockAndCheckChildren($group, $date, $records);
            $day = $date->toDateString();

            foreach ($records as $record) {
                $childId = (int) $record['child_id'];
                $note    = $record['note'] ?? null;
                $ate     = (bool) ($record['ate'] ?? true);

                $existing = MealRecord::where('child_id', $childId)->whereDate('date', $day)->where('meal_type', $type)->first();
                $values   = [
                    'organization_id' => $group->organization_id,
                    'group_id'        => $group->id,
                    'served_at'       => $servedAt,
                    'ate'             => $ate,
                    'note'            => $note,
                    'recorded_by'     => $by->id,
                ];

                if (! $existing) {
                    MealRecord::create($values + ['child_id' => $childId, 'date' => $day, 'meal_type' => $type]);
                    continue;
                }

                $old = ['served_at' => self::time($existing->served_at), 'ate' => (bool) $existing->ate, 'note' => $existing->note];
                $new = ['served_at' => $servedAt, 'ate' => $ate, 'note' => $note];
                if ($old === $new) {
                    continue;
                }

                $existing->update($values);
                $this->log('daily.meal.updated', "Ovqatlanish tuzatildi: bola #{$childId}, {$day}", $by, $group->organization_id, [
                    'child_id' => $childId, 'group_id' => $group->id, 'date' => $day, 'meal_type' => $type,
                    'old' => $old, 'new' => $new,
                ], $ip);
            }
        });
    }

    public function deleteMeal(MealRecord $meal, User $by, ?string $ip = null): void
    {
        DB::transaction(function () use ($meal, $by, $ip) {
            $meal->delete();
            $this->log('daily.meal.deleted', "Ovqatlanish yozuvi o'chirildi: bola #{$meal->child_id}, {$meal->date->toDateString()}", $by, $meal->organization_id, [
                'child_id' => $meal->child_id, 'group_id' => $meal->group_id, 'date' => $meal->date->toDateString(),
                'old'      => ['meal_type' => $meal->meal_type, 'served_at' => self::time($meal->served_at), 'note' => $meal->note],
            ], $ip);
        });
    }

    // ── Uyqu ──────────────────────────────────────────────────────

    /**
     * Har bir bola uchun kuniga bitta uyqu yozuvi (yozish yoki yangilash). ended_at bo'sh — hali uxlayapti.
     *
     * @param array<int, array{child_id:int, started_at:string, ended_at?:string|null, note?:string|null}> $records
     */
    public function recordSleep(Group $group, CarbonImmutable $date, array $records, User $by, ?string $ip = null): void
    {
        foreach (array_values($records) as $i => $record) {
            $end = $record['ended_at'] ?? null;
            if ($end !== null && $end <= $record['started_at']) {
                throw ValidationException::withMessages([
                    "records.{$i}.ended_at" => ["Uyg'onish vaqti uxlash boshlangan vaqtdan keyin bo'lishi kerak."],
                ]);
            }
            $this->assertNotFutureTime($date, $record['started_at'], "records.{$i}.started_at");
            if ($end !== null) {
                $this->assertNotFutureTime($date, $end, "records.{$i}.ended_at");
            }
        }

        DB::transaction(function () use ($group, $date, $records, $by, $ip) {
            $this->lockAndCheckChildren($group, $date, $records);
            $day = $date->toDateString();

            foreach ($records as $record) {
                $childId = (int) $record['child_id'];
                $new     = [
                    'started_at' => $record['started_at'],
                    'ended_at'   => $record['ended_at'] ?? null,
                    'note'       => $record['note'] ?? null,
                ];

                $existing = SleepRecord::where('child_id', $childId)->whereDate('date', $day)->first();
                $values   = $new + [
                    'organization_id' => $group->organization_id,
                    'group_id'        => $group->id,
                    'recorded_by'     => $by->id,
                ];

                if (! $existing) {
                    SleepRecord::create($values + ['child_id' => $childId, 'date' => $day]);
                    continue;
                }

                $old = [
                    'started_at' => self::time($existing->started_at),
                    'ended_at'   => self::time($existing->ended_at),
                    'note'       => $existing->note,
                ];
                if ($old === $new) {
                    continue;
                }

                $existing->update($values);
                $this->log('daily.sleep.updated', "Uyqu yozuvi tuzatildi: bola #{$childId}, {$day}", $by, $group->organization_id, [
                    'child_id' => $childId, 'group_id' => $group->id, 'date' => $day, 'old' => $old, 'new' => $new,
                ], $ip);
            }
        });
    }

    public function deleteSleep(SleepRecord $sleep, User $by, ?string $ip = null): void
    {
        DB::transaction(function () use ($sleep, $by, $ip) {
            $sleep->delete();
            $this->log('daily.sleep.deleted', "Uyqu yozuvi o'chirildi: bola #{$sleep->child_id}, {$sleep->date->toDateString()}", $by, $sleep->organization_id, [
                'child_id' => $sleep->child_id, 'group_id' => $sleep->group_id, 'date' => $sleep->date->toDateString(),
                'old'      => ['started_at' => self::time($sleep->started_at), 'ended_at' => self::time($sleep->ended_at), 'note' => $sleep->note],
            ], $ip);
        });
    }

    // ── Mashg'ulotlar ─────────────────────────────────────────────

    /**
     * Mashg'ulot yaratadi. Ishtirokchilar (child_ids) — faqat o'sha kuni guruhda «Keldi» bolalar.
     */
    public function createActivity(Group $group, CarbonImmutable $date, array $data, User $by): GroupActivity
    {
        $this->assertActivityTimes($data['starts_at'] ?? null, $data['ends_at'] ?? null);

        return DB::transaction(function () use ($group, $date, $data, $by) {
            $childIds = $this->checkParticipants($group, $date, $data['child_ids'] ?? []);

            $activity = GroupActivity::create([
                'organization_id' => $group->organization_id,
                'group_id'        => $group->id,
                'date'            => $date->toDateString(),
                'title'           => $data['title'],
                'direction'       => $data['direction'] ?? null,
                'description'     => $data['description'] ?? null,
                'result'          => $data['result'] ?? null,
                'starts_at'       => $data['starts_at'] ?? null,
                'ends_at'         => $data['ends_at'] ?? null,
                'recorded_by'     => $by->id,
            ]);
            $activity->children()->sync($childIds);

            return $activity;
        });
    }

    public function updateActivity(GroupActivity $activity, array $data, User $by, ?string $ip = null): void
    {
        $this->assertActivityTimes(
            array_key_exists('starts_at', $data) ? $data['starts_at'] : self::time($activity->starts_at),
            array_key_exists('ends_at', $data) ? $data['ends_at'] : self::time($activity->ends_at),
        );

        DB::transaction(function () use ($activity, $data, $by, $ip) {
            $old = $this->activityLog($activity);

            if (array_key_exists('child_ids', $data)) {
                $date = AttendanceService::parseDate($activity->date->toDateString());
                $activity->children()->sync($this->checkParticipants($activity->group, $date, $data['child_ids'] ?? []));
            }
            unset($data['child_ids']);

            $activity->update($data + ['recorded_by' => $by->id]);
            $new = $this->activityLog($activity->fresh());
            if ($old === $new) {
                return;
            }

            $this->log('daily.activity.updated', "Mashg'ulot tuzatildi: {$activity->title}", $by, $activity->organization_id, [
                'activity_id' => $activity->id, 'group_id' => $activity->group_id, 'date' => $activity->date->toDateString(),
                'old' => $old, 'new' => $new,
            ], $ip);
        });
    }

    public function deleteActivity(GroupActivity $activity, User $by, ?string $ip = null): void
    {
        DB::transaction(function () use ($activity, $by, $ip) {
            $activity->delete();
            $this->log('daily.activity.deleted', "Mashg'ulot o'chirildi: {$activity->title}", $by, $activity->organization_id, [
                'activity_id' => $activity->id, 'group_id' => $activity->group_id, 'date' => $activity->date->toDateString(),
                'old'         => $this->activityLog($activity),
            ], $ip);
        });
    }

    // ── Yordamchi ─────────────────────────────────────────────────

    /**
     * Bolalar qatorlari qulflanadi (parallel so'rovlar navbat bilan), keyin har bir bola shu guruhning
     * o'sha kundagi tarkibida va davomatda «Keldi» deb belgilangan bo'lishi tekshiriladi.
     */
    private function lockAndCheckChildren(Group $group, CarbonImmutable $date, array $records, string $what = 'ovqatlanish yoki uyqu'): void
    {
        $ids = collect($records)->pluck('child_id')->map(fn ($id) => (int) $id);

        Child::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get(['id']);

        if ($ids->diff($this->attendance->dayChildIds($group, $date))->isNotEmpty()) {
            throw ValidationException::withMessages([
                'records' => ["Ro'yxatdagi bolalardan biri bu guruhga tegishli emas."],
            ]);
        }

        $statuses = Attendance::forOrganization($group->organization_id)
            ->whereIn('child_id', $ids)
            ->whereDate('date', $date->toDateString())
            ->pluck('status', 'child_id');

        $blocked = $ids->reject(fn (int $id) => ($statuses[$id] ?? null) === self::RECORDABLE_ATTENDANCE)->values();

        if ($blocked->isNotEmpty()) {
            $names = Child::whereIn('id', $blocked)->get(['id', 'first_name', 'last_name'])->keyBy('id');

            throw ValidationException::withMessages([
                'records' => $blocked->map(function (int $id) use ($names, $statuses, $what) {
                    $name   = "{$names[$id]->last_name} {$names[$id]->first_name}";
                    $status = $statuses[$id] ?? null;

                    return $status === null
                        ? "{$name} uchun bu kuni davomat belgilanmagan — avval davomatda «Keldi» deb belgilang."
                        : "{$name} bu kuni davomatda " . self::BLOCKED_ATTENDANCE_LABELS[$status]
                          . " deb belgilangan — {$what} yozib bo'lmaydi.";
                })->all(),
            ]);
        }
    }

    /** Ishtirokchilar: shu guruhning o'sha kundagi «Keldi» bolalari. */
    private function checkParticipants(Group $group, CarbonImmutable $date, array $childIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $childIds)));
        if ($ids !== []) {
            $this->lockAndCheckChildren($group, $date, array_map(fn ($id) => ['child_id' => $id], $ids), "mashg'ulot ishtirokchisi sifatida");
        }

        return $ids;
    }

    private function assertActivityTimes(?string $start, ?string $end): void
    {
        if ($end !== null && ($start === null || $end <= $start)) {
            throw ValidationException::withMessages([
                'ends_at' => ["Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak."],
            ]);
        }
    }

    private function assertNotFutureTime(CarbonImmutable $date, string $time, string $field): void
    {
        if ($date->isSameDay(AttendanceService::today())
            && $time > CarbonImmutable::now(AttendanceService::TIMEZONE)->format('H:i')) {
            throw ValidationException::withMessages([
                $field => ["Bugungi sana uchun hali kelmagan vaqtni kiritib bo'lmaydi."],
            ]);
        }
    }

    private function activities(int $orgId, int $groupId, string $day): Collection
    {
        return GroupActivity::forOrganization($orgId)
            ->where('group_id', $groupId)
            ->whereDate('date', $day)
            ->with('children:id,first_name,last_name')
            ->orderByRaw('starts_at IS NULL, starts_at')
            ->orderBy('id')
            ->get();
    }

    private function mealResource(MealRecord $m, bool $withId): array
    {
        return ($withId ? ['id' => $m->id] : []) + [
            'meal_type' => $m->meal_type,
            'served_at' => self::time($m->served_at),
            'ate'       => (bool) $m->ate,
            'note'      => $m->note,
        ];
    }

    private function sleepResource(SleepRecord $s, bool $withId): array
    {
        return ($withId ? ['id' => $s->id] : []) + [
            'started_at'  => self::time($s->started_at),
            'ended_at'    => self::time($s->ended_at),
            'note'        => $s->note,
            'is_sleeping' => $s->isSleeping(),
            'status_text' => $s->isSleeping() ? 'Hali uxlayapti' : null,
        ];
    }

    /**
     * Tarbiyachi/admin uchun ($withId) — ishtirokchilar ro'yxati bilan;
     * ota-ona uchun — faqat o'z farzandi qatnashganmi ($forChild), boshqa bolalar ko'rsatilmaydi.
     */
    private function activityResource(GroupActivity $a, bool $withId, ?int $forChild = null): array
    {
        $start = self::time($a->starts_at);
        $end   = self::time($a->ends_at);

        $base = [
            'title'            => $a->title,
            'direction'        => $a->direction,
            'description'      => $a->description,
            'result'           => $a->result,
            'starts_at'        => $start,
            'ends_at'          => $end,
            'duration_minutes' => $start && $end ? (int) ((strtotime($end) - strtotime($start)) / 60) : null,
        ];

        if ($withId) {
            return ['id' => $a->id] + $base + [
                'participants' => $a->children->map(fn (Child $c) => ['id' => $c->id, 'first_name' => $c->first_name, 'last_name' => $c->last_name])->values(),
            ];
        }

        return $base + ($forChild !== null ? ['participated' => $a->children->contains('id', $forChild)] : []);
    }

    /** Audit log uchun mashg'ulot holati. */
    private function activityLog(GroupActivity $a): array
    {
        return $this->activityResource($a->loadMissing('children:id'), false) + [
            'child_ids' => $a->children->pluck('id')->sort()->values()->all(),
        ];
    }

    /** Postgres time ("12:30:00") → "12:30". */
    private static function time(?string $value): ?string
    {
        return $value === null ? null : substr($value, 0, 5);
    }

    private function log(string $action, string $description, User $by, int $orgId, array $meta, ?string $ip): void
    {
        ActivityLog::record($action, $description, $by->id, $orgId, $meta, $ip);
    }
}
