<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\ChildPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Oylik to'lov holati: yozuv bor — to'langan, yo'q — to'lanmagan. To'lov tizimi emas, faqat qayd.
 * Hamma so'rovlar bog'cha (organization_id) bilan cheklangan.
 */
class ChildPaymentService
{
    public static function monthStart(?string $month): CarbonImmutable
    {
        if ($month && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            return CarbonImmutable::createFromFormat('!Y-m', $month)->startOfMonth();
        }

        return AttendanceService::today()->toImmutable()->startOfMonth();
    }

    /** Oy bo'yicha bolalar va to'lov holati (faol bolalar; ixtiyoriy guruh filtri). */
    public function overview(int $orgId, CarbonImmutable $month, ?int $groupId = null): array
    {
        $children = Child::forOrganization($orgId)->active()
            ->when($groupId, fn ($q) => $q->where('group_id', $groupId))
            ->with('group:id,name')
            ->orderBy('last_name')->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'group_id']);

        $payments = ChildPayment::where('organization_id', $orgId)
            ->whereDate('month', $month->toDateString())
            ->whereIn('child_id', $children->pluck('id'))
            ->get()->keyBy('child_id');

        $rows = $children->map(fn (Child $c) => [
            'id'         => $c->id,
            'first_name' => $c->first_name,
            'last_name'  => $c->last_name,
            'group'      => $c->group ? ['id' => $c->group->id, 'name' => $c->group->name] : null,
            'payment'    => ($p = $payments->get($c->id)) ? $this->resource($p) : null,
        ])->values();

        return [
            'month'    => $month->format('Y-m'),
            'summary'  => [
                'jami'       => $rows->count(),
                'tolagan'    => $payments->count(),
                'tolanmagan' => $rows->count() - $payments->count(),
                'summa'      => (int) $payments->sum('amount'),
            ],
            'children' => $rows,
        ];
    }

    /** Bog'cha dashboardi uchun joriy oy xulosasi. */
    public function organizationSummary(int $orgId, CarbonImmutable $month): array
    {
        $active = Child::forOrganization($orgId)->active()->pluck('id');
        $paid   = ChildPayment::where('organization_id', $orgId)->whereDate('month', $month->toDateString())->whereIn('child_id', $active);

        return [
            'oy'         => $month->format('Y-m'),
            'jami'       => $active->count(),
            'tolagan'    => (clone $paid)->count(),
            'tolanmagan' => $active->count() - (clone $paid)->count(),
            'summa'      => (int) (clone $paid)->sum('amount'),
        ];
    }

    public function record(Child $child, CarbonImmutable $month, int $amount, string $paidAt, ?string $note, User $by, ?string $ip): ChildPayment
    {
        return DB::transaction(function () use ($child, $month, $amount, $paidAt, $note, $by, $ip) {
            $payment = ChildPayment::updateOrCreate(
                ['child_id' => $child->id, 'month' => $month->toDateString()],
                ['organization_id' => $child->organization_id, 'amount' => $amount, 'paid_at' => $paidAt, 'note' => $note, 'recorded_by' => $by->id],
            );
            ActivityLog::record('payment.recorded', "To'lov qayd etildi: #{$child->id}, {$month->format('Y-m')}", $by->id, $child->organization_id,
                ['child_id' => $child->id, 'month' => $month->format('Y-m'), 'amount' => $amount], $ip);

            return $payment;
        });
    }

    public function clear(Child $child, CarbonImmutable $month, User $by, ?string $ip): bool
    {
        $deleted = ChildPayment::where('child_id', $child->id)->whereDate('month', $month->toDateString())->delete() > 0;
        if ($deleted) {
            ActivityLog::record('payment.cleared', "To'lov qaydi bekor qilindi: #{$child->id}, {$month->format('Y-m')}", $by->id, $child->organization_id,
                ['child_id' => $child->id, 'month' => $month->format('Y-m')], $ip);
        }

        return $deleted;
    }

    /** Ota-ona uchun: farzandning oxirgi oylar bo'yicha holati (yozuvsiz oy — to'lanmagan). */
    public function history(Child $child, int $months = 6): array
    {
        $current  = AttendanceService::today()->toImmutable()->startOfMonth();
        $payments = ChildPayment::where('child_id', $child->id)
            ->whereDate('month', '>=', $current->subMonths($months - 1)->toDateString())
            ->get()->keyBy(fn ($p) => $p->month->format('Y-m'));

        return collect(range(0, $months - 1))->map(function ($i) use ($current, $payments) {
            $key = $current->subMonths($i)->format('Y-m');
            $p   = $payments->get($key);

            return ['oy' => $key, 'holat' => $p ? 'paid' : 'unpaid', 'payment' => $p ? $this->resource($p) : null];
        })->values()->all();
    }

    public function resource(ChildPayment $p): array
    {
        return [
            'id'      => $p->id,
            'month'   => $p->month->format('Y-m'),
            'amount'  => $p->amount,
            'paid_at' => $p->paid_at->toDateString(),
            'note'    => $p->note,
        ];
    }
}
