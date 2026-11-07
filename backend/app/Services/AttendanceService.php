<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\MealRecord;
use App\Models\SleepRecord;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    /** Davomat sanalari bog'cha vaqti bo'yicha hisoblanadi. */
    const TIMEZONE = 'Asia/Tashkent';

    /** Tahrirlash oynasi: bugun va shuncha kun orqaga. */
    const TEACHER_EDIT_DAYS = 2;
    const ADMIN_EDIT_DAYS   = 30;

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TIMEZONE)->startOfDay();
    }

    public static function parseDate(?string $date): CarbonImmutable
    {
        return $date
            ? CarbonImmutable::createFromFormat('!Y-m-d', $date, self::TIMEZONE)
            : self::today();
    }

    /** Foydalanuvchi qaysi sanadan boshlab davomatni o'zgartira oladi. */
    public static function editableFrom(User $user): CarbonImmutable
    {
        $days = $user->isTeacher() ? self::TEACHER_EDIT_DAYS : self::ADMIN_EDIT_DAYS;
        return self::today()->subDays($days);
    }

    public static function isEditable(User $user, CarbonImmutable $date): bool
    {
        return $date->lessThanOrEqualTo(self::today()) && $date->greaterThanOrEqualTo(self::editableFrom($user));
    }

    /**
     * Guruhning bir kunlik davomati (belgilanmagan bo'lsa status null).
     * O'sha kun shu guruhda yozilgan bolalar (keyin boshqa guruhga o'tgan yoki nofaol bo'lgan
     * bo'lsa ham) va hozirgi faol a'zolar ko'rsatiladi; shu kun boshqa guruhda yozilgan bola — yo'q.
     */
    public function dayView(Group $group, CarbonImmutable $date, User $viewer): array
    {
        $children = Child::forOrganization($group->organization_id)
            ->whereIn('id', $this->dayChildIds($group, $date))
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name']);

        $records = Attendance::forOrganization($group->organization_id)
            ->whereIn('child_id', $children->pluck('id'))
            ->whereDate('date', $date->toDateString())
            ->get(['child_id', 'status', 'excuse_reason', 'note'])
            ->keyBy('child_id');

        $rows = $children->map(fn (Child $c) => [
            'id'         => $c->id,
            'first_name' => $c->first_name,
            'last_name'  => $c->last_name,
            'status'        => $records[$c->id]->status ?? null,
            'excuse_reason' => $records[$c->id]->excuse_reason ?? null,
            'note'          => $records[$c->id]->note ?? null,
        ])->values();

        $count = fn (?string $status) => $rows->where('status', $status)->count();

        return [
            'group'         => [
                'id'           => $group->id,
                'name'         => $group->name,
                'age_category' => $group->age_category,
                'capacity'     => $group->capacity,
            ],
            'date'          => $date->toDateString(),
            'editable'      => self::isEditable($viewer, $date),
            'editable_from' => self::editableFrom($viewer)->toDateString(),
            'children'      => $rows,
            'summary'       => [
                'total'    => $rows->count(),
                'present'  => $count(Attendance::STATUS_PRESENT),
                'absent'   => $count(Attendance::STATUS_ABSENT),
                'excused'  => $count(Attendance::STATUS_EXCUSED),
                'unmarked' => $count(null),
            ],
        ];
    }

    /**
     * Davomatni yozadi yoki tuzatadi (upsert). Har bir bola shu guruhning faol bolasi bo'lishi shart.
     * Mavjud yozuvdagi o'zgarishlar activity_logs ga yoziladi.
     *
     * @param array<int, array{child_id:int, status:string, excuse_reason?:string|null, note?:string|null}> $records
     */
    public function record(Group $group, CarbonImmutable $date, array $records, User $by, ?string $ip = null): void
    {
        $ids = collect($records)->pluck('child_id')->map(fn ($id) => (int) $id);

        DB::transaction(function () use ($group, $date, $records, $by, $ip, $ids) {
            // Bolalar qatorlari qulflanadi: bir xil bola/sana uchun parallel so'rovlar
            // ketma-ket bajariladi (yo'q yozuvga lockForUpdate hech narsani qulflamaydi,
            // ikkinchi INSERT unique xatosi bilan 500 berardi). Tartib deadlock'ning oldini oladi.
            Child::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get(['id']);

            $allowed = $this->dayChildIds($group, $date);
            if ($ids->diff($allowed)->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'records' => ["Ro'yxatdagi bolalardan biri bu guruhga tegishli emas."],
                ]);
            }

            foreach ($records as $record) {
                $childId = (int) $record['child_id'];
                $status  = $record['status'];
                $note    = $record['note'] ?? null;
                // Sabab kategoriyasi faqat «Sababli» holatida saqlanadi
                $reason  = $status === Attendance::STATUS_EXCUSED ? ($record['excuse_reason'] ?? null) : null;

                $existing = Attendance::where('child_id', $childId)
                    ->whereDate('date', $date->toDateString())
                    ->lockForUpdate()
                    ->first();

                if ($existing && $existing->status === $status && $existing->note === $note && $existing->excuse_reason === $reason) {
                    continue;
                }

                $values = [
                    'organization_id' => $group->organization_id,
                    'group_id'        => $group->id,
                    'status'          => $status,
                    'excuse_reason'   => $reason,
                    'note'            => $note,
                    'marked_by'       => $by->id,
                    'marked_at'       => now(),
                ];

                if ($existing) {
                    $old = $existing->only(['status', 'excuse_reason', 'note', 'marked_by']);
                    $existing->update($values);

                    $meta = [
                        'child_id' => $childId,
                        'group_id' => $group->id,
                        'date'     => $date->toDateString(),
                        'old'      => $old,
                        'new'      => ['status' => $status, 'excuse_reason' => $reason, 'note' => $note],
                    ];

                    // «Keldi» dan boshqa holatga o'tganda kundalik yozuvlar o'chirilmaydi —
                    // ular saqlanib qolgani audit yozuvida qayd etiladi
                    if ($old['status'] === Attendance::STATUS_PRESENT && $status !== Attendance::STATUS_PRESENT) {
                        $kept = $this->dailyRecordCounts($childId, $date);
                        if (array_sum($kept) > 0) {
                            $meta['daily_records_kept'] = $kept;
                        }
                    }

                    ActivityLog::record(
                        'attendance.updated',
                        "Davomat tuzatildi: bola #{$childId}, {$date->toDateString()}",
                        $by->id,
                        $group->organization_id,
                        $meta,
                        $ip
                    );
                } else {
                    Attendance::create($values + ['child_id' => $childId, 'date' => $date->toDateString()]);
                }
            }
        });
    }

    /**
     * Oylik davomat matritsasi: bolalar × kunlar, har bir bola va guruh bo'yicha jami.
     *
     * Bolalar: guruhning hozirgi faol a'zolari ∪ davr ichida shu guruhda davomat yozuvi bo'lganlar
     * (guruhdan chiqqan bolaning tarixi yo'qolmaydi). Yozuvlar faqat shu guruhda belgilanganlari.
     * Belgilanmagan kunlar faqat o'tgan/bugungi ish kunlari (shanba-yakshanba emas) uchun sanaladi.
     */
    public function month(Group $group, CarbonImmutable $from, CarbonImmutable $to, ?int $childId = null): array
    {
        $orgId = $group->organization_id;
        $today = self::today();

        $records = Attendance::forOrganization($orgId)
            ->where('group_id', $group->id)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get(['child_id', 'date', 'status', 'excuse_reason', 'note']);

        $ids = Child::forOrganization($orgId)->where('group_id', $group->id)->active()->pluck('id')
            ->merge($records->pluck('child_id'))
            ->unique();
        if ($childId !== null) {
            $ids = $ids->filter(fn ($id) => (int) $id === $childId);
        }

        $children = Child::forOrganization($orgId)->whereIn('id', $ids)
            ->orderBy('last_name')->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'middle_name']);

        $days = [];
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            $days[] = [
                'date'    => $d->toDateString(),
                'day'     => $d->day,
                'weekday' => $d->dayOfWeekIso,
                'weekend' => $d->isWeekend(),
                'future'  => $d->greaterThan($today),
            ];
        }
        $countable = collect($days)->filter(fn ($d) => ! $d['weekend'] && ! $d['future'])->pluck('date');

        $byChild = $records->groupBy('child_id');
        $groupTotals = ['present' => 0, 'absent' => 0, 'excused' => 0, 'unmarked' => 0];
        $notes = [];

        $rows = $children->map(function (Child $c) use ($byChild, $countable, &$groupTotals, &$notes) {
            $cells  = [];
            $totals = ['present' => 0, 'absent' => 0, 'excused' => 0, 'unmarked' => 0];

            foreach ($byChild[$c->id] ?? [] as $a) {
                $day = $a->date->toDateString();
                $cells[$day] = ['status' => $a->status, 'excuse_reason' => $a->excuse_reason, 'note' => $a->note];
                $totals[$a->status]++;
                if ($a->status === Attendance::STATUS_EXCUSED) {
                    $notes[] = [
                        'date'       => $day,
                        'child_id'   => $c->id,
                        'child_name' => "{$c->last_name} {$c->first_name}",
                        'reason'     => $a->excuse_reason,
                        'note'       => $a->note,
                    ];
                }
            }
            $totals['unmarked'] = $countable->reject(fn ($day) => isset($cells[$day]))->count();

            foreach ($totals as $k => $v) {
                $groupTotals[$k] += $v;
            }

            return [
                'id'          => $c->id,
                'first_name'  => $c->first_name,
                'last_name'   => $c->last_name,
                'middle_name' => $c->middle_name,
                'days'        => (object) $cells,
                'totals'      => $totals,
            ];
        })->values();

        usort($notes, fn ($a, $b) => [$a['date'], $a['child_name']] <=> [$b['date'], $b['child_name']]);

        $teachers = $group->teacherProfiles()->where('teacher_profiles.is_active', true)
            ->orderBy('last_name')->get(['teacher_profiles.first_name', 'teacher_profiles.last_name'])
            ->map(fn ($t) => trim("{$t->last_name} {$t->first_name}"))->values()->all();

        return [
            'organization' => ['name' => $group->organization?->name],
            'group'        => ['id' => $group->id, 'name' => $group->name],
            'teachers'     => $teachers,
            'month'        => $from->format('Y-m'),
            'from'         => $from->toDateString(),
            'to'           => $to->toDateString(),
            'days'         => $days,
            'children'     => $rows,
            'totals'       => $groupTotals + ['working_days' => $countable->count()],
            'excused_notes' => $notes,
        ];
    }

    /**
     * month=YYYY-MM va ixtiyoriy from/to (shu oy ichida) dan davrni hisoblaydi.
     * Kelajakdagi oy rad etiladi; davr oy chegarasidan chiqmaydi.
     */
    public static function monthRange(string $month, ?string $from = null, ?string $to = null): array
    {
        $start = CarbonImmutable::createFromFormat('!Y-m', $month, self::TIMEZONE)->startOfMonth();
        $end   = $start->endOfMonth()->startOfDay();

        if ($start->greaterThan(self::today())) {
            throw ValidationException::withMessages(['month' => ["Kelajakdagi oy tanlanmasin."]]);
        }

        $f = $from ? self::parseDate($from) : $start;
        $t = $to ? self::parseDate($to) : $end;
        if ($f->lessThan($start) || $t->greaterThan($end) || $f->greaterThan($t)) {
            throw ValidationException::withMessages(['from' => ["Sana oralig'i tanlangan oy ichida bo'lishi kerak."]]);
        }

        return [$f, $t];
    }

    /** Bolaning shu kundagi faol (o'chirilmagan) ovqatlanish va uyqu yozuvlari soni. */
    private function dailyRecordCounts(int $childId, CarbonImmutable $date): array
    {
        return [
            'meals' => MealRecord::where('child_id', $childId)->whereDate('date', $date->toDateString())->count(),
            'sleep' => SleepRecord::where('child_id', $childId)->whereDate('date', $date->toDateString())->count(),
        ];
    }

    /** Bog'cha bo'yicha bir kunlik umumiy davomat (dashboard kartasi uchun). */
    public function organizationSummary(int $orgId, CarbonImmutable $date): array
    {
        $total  = Child::forOrganization($orgId)->active()->count();
        $counts = Attendance::forOrganization($orgId)
            ->whereDate('date', $date->toDateString())
            ->whereHas('child', fn ($q) => $q->where('is_active', true))
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $marked = (int) $counts->sum();

        return [
            'sana'          => $date->toDateString(),
            'jami'          => $total,
            'keldi'         => (int) ($counts[Attendance::STATUS_PRESENT] ?? 0),
            'kelmadi'       => (int) ($counts[Attendance::STATUS_ABSENT] ?? 0),
            'sababli'       => (int) ($counts[Attendance::STATUS_EXCUSED] ?? 0),
            'belgilanmagan' => max(0, $total - $marked),
        ];
    }

    /**
     * Berilgan kun uchun guruhga tegishli bolalar:
     * (shu kun shu guruhda yozuvi borlar) ∪ (hozirgi faol a'zolar, shu kun boshqa guruhda yozuvi yo'qlar).
     */
    public function dayChildIds(Group $group, CarbonImmutable $date)
    {
        $day = $date->toDateString();

        $recorded = Attendance::forOrganization($group->organization_id)
            ->whereDate('date', $day)
            ->whereNotNull('group_id')
            ->get(['child_id', 'group_id']);

        $here      = $recorded->where('group_id', $group->id)->pluck('child_id');
        $elsewhere = $recorded->where('group_id', '!=', $group->id)->pluck('child_id');

        $members = Child::forOrganization($group->organization_id)
            ->where('group_id', $group->id)
            ->active()
            ->whereNotIn('id', $elsewhere)
            ->pluck('id');

        // O'chirilgan (soft delete) bolalar chiqarib tashlanadi
        $existing = Child::forOrganization($group->organization_id)->whereIn('id', $here)->pluck('id');

        return $members->merge($existing)->map(fn ($id) => (int) $id)->unique()->values();
    }
}
