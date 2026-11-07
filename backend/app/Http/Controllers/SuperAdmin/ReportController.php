<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends SuperAdminController
{
    // ── Date helpers ───────────────────────────────────────────────

    private function parseDates(Request $request): array
    {
        $from = $request->query('date_from')
            ? Carbon::parse($request->query('date_from'))->startOfDay()
            : now()->startOfMonth();

        $to = $request->query('date_to')
            ? Carbon::parse($request->query('date_to'))->endOfDay()
            : now()->endOfDay();

        if ($from->gt($to)) {
            $from = $to->copy()->subDays(29)->startOfDay();
        }

        return [$from, $to];
    }

    // ── Overview ───────────────────────────────────────────────────

    public function overview(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        // Organizations
        $counts       = app(\App\Services\OrganizationService::class)->statusCounts();
        $totalOrgs    = $counts['total'];
        $activeOrgs   = $counts['active'];
        $newOrgs      = Organization::counted()->whereBetween('created_at', [$from, $to])->count();

        // Subscriptions
        $subCounts = Subscription::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $newSubs = Subscription::whereBetween('created_at', [$from, $to])->count();

        $mrr = app(SubscriptionService::class)->calculateMRR();

        // Revenue (all-time)
        $totalPaid     = (float) Payment::where('status', 'paid')->sum('amount');
        $totalPending  = (float) Payment::where('status', 'pending')->sum('amount');
        $totalRefunded = (float) Payment::where('status', 'refunded')->sum('amount');

        // Revenue in selected period
        $periodPaid = (float) Payment::where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        $periodPending = (float) Payment::where('status', 'pending')
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        // Orgs that have paid at least once
        $orgsWithRevenue = (int) Payment::where('status', 'paid')
            ->distinct('organization_id')
            ->count('organization_id');

        $avgRevenuePerOrg = $orgsWithRevenue > 0
            ? round($totalPaid / $orgsWithRevenue, 2)
            : 0.0;

        // Invoices (all-time)
        $invCounts = Invoice::select('status', DB::raw('count(*) as cnt'))
            ->groupBy('status')
            ->pluck('cnt', 'status');

        $invAmounts = Invoice::select('status', DB::raw('sum(amount) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'period' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
            'organizations' => [
                'total'    => $totalOrgs,
                'active'   => $activeOrgs,
                'inactive' => $counts['not_active'],
                'archived' => $counts['archived'],
                'new'      => $newOrgs,
            ],
            'subscriptions' => [
                'active'    => (int) ($subCounts['active']    ?? 0),
                'trial'     => (int) ($subCounts['trial']     ?? 0),
                'past_due'  => (int) ($subCounts['past_due']  ?? 0),
                'expired'   => (int) ($subCounts['expired']   ?? 0),
                'cancelled' => (int) ($subCounts['cancelled'] ?? 0),
                'new'       => $newSubs,
                'mrr'       => $mrr,
                'arr'       => $mrr * 12,
            ],
            'revenue' => [
                'total_paid'          => $totalPaid,
                'total_pending'       => $totalPending,
                'total_refunded'      => $totalRefunded,
                'gross_revenue'       => $totalPaid + $totalRefunded,
                'period_paid'         => $periodPaid,
                'period_pending'      => $periodPending,
                'avg_revenue_per_org' => $avgRevenuePerOrg,
            ],
            'invoices' => [
                'total'          => (int) $invCounts->sum(),
                'draft'          => (int) ($invCounts['draft']     ?? 0),
                'pending'        => (int) ($invCounts['pending']   ?? 0),
                'paid'           => (int) ($invCounts['paid']      ?? 0),
                'overdue'        => (int) ($invCounts['overdue']   ?? 0),
                'cancelled'      => (int) ($invCounts['cancelled'] ?? 0),
                'paid_amount'    => (float) ($invAmounts['paid']    ?? 0),
                'pending_amount' => (float) ($invAmounts['pending'] ?? 0)
                                  + (float) ($invAmounts['overdue'] ?? 0),
            ],
        ]);
    }

    // ── Revenue chart ──────────────────────────────────────────────

    public function revenue(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        $diffDays = $from->diffInDays($to);
        $groupBy  = $diffDays > 60 ? 'month' : 'day';

        // Time-series paid payments
        $paymentsQuery = Payment::where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to]);

        if ($groupBy === 'month') {
            $raw  = $paymentsQuery
                ->selectRaw("TO_CHAR(paid_at, 'YYYY-MM') as period, SUM(amount) as total, COUNT(*) as cnt")
                ->groupBy('period')
                ->orderBy('period')
                ->get()
                ->keyBy('period');

            $series = [];
            $cursor = $from->copy()->startOfMonth();
            while ($cursor->lte($to)) {
                $key      = $cursor->format('Y-m');
                $series[] = [
                    'period' => $key,
                    'label'  => $cursor->format('M Y'),
                    'total'  => isset($raw[$key]) ? (float) $raw[$key]->total : 0.0,
                    'count'  => isset($raw[$key]) ? (int)   $raw[$key]->cnt   : 0,
                ];
                $cursor->addMonth();
            }
        } else {
            $raw = $paymentsQuery
                ->selectRaw("DATE(paid_at) as period, SUM(amount) as total, COUNT(*) as cnt")
                ->groupBy('period')
                ->orderBy('period')
                ->get()
                ->keyBy('period');

            $series = [];
            $cursor = $from->copy();
            while ($cursor->lte($to)) {
                $key      = $cursor->format('Y-m-d');
                $series[] = [
                    'period' => $key,
                    'label'  => $cursor->format('d/m'),
                    'total'  => isset($raw[$key]) ? (float) $raw[$key]->total : 0.0,
                    'count'  => isset($raw[$key]) ? (int)   $raw[$key]->cnt   : 0,
                ];
                $cursor->addDay();
            }
        }

        // Revenue by plan (join through subscriptions)
        $byPlan = DB::table('payments')
            ->join('subscriptions', 'payments.subscription_id', '=', 'subscriptions.id')
            ->join('plans',         'subscriptions.plan_id',    '=', 'plans.id')
            ->where('payments.status', 'paid')
            ->whereBetween('payments.paid_at', [$from, $to])
            ->select('plans.name as plan_name', DB::raw('SUM(payments.amount) as total'))
            ->groupBy('plans.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn($r) => ['plan_name' => $r->plan_name, 'total' => (float) $r->total]);

        // Payment method distribution
        $byMethod = Payment::where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->select('payment_method', DB::raw('COUNT(*) as cnt, SUM(amount) as total'))
            ->groupBy('payment_method')
            ->get()
            ->map(fn($r) => [
                'method' => $r->payment_method ?? 'other',
                'count'  => (int)   $r->cnt,
                'total'  => (float) $r->total,
            ]);

        return response()->json([
            'period'   => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'group_by' => $groupBy,
            'series'   => $series,
            'total'    => (float) array_sum(array_column($series, 'total')),
            'by_plan'  => $byPlan,
            'by_method' => $byMethod,
        ]);
    }

    // ── Subscriptions report ───────────────────────────────────────

    public function subscriptions(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        $planId = $request->query('plan_id');

        // All-time status distribution
        $statusQ = Subscription::select('status', DB::raw('count(*) as count'))->groupBy('status');
        if ($planId) {
            $statusQ->where('plan_id', $planId);
        }
        $statusCounts = $statusQ->pluck('count', 'status');

        // Plan distribution (active + trial only)
        $planDist = Subscription::whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->select('plan_id', DB::raw('count(*) as count'))
            ->groupBy('plan_id')
            ->with('plan:id,name')
            ->get()
            ->map(fn($s) => [
                'plan_id'   => $s->plan_id,
                'plan_name' => $s->plan?->name ?? 'Boshqa',
                'count'     => (int) $s->count,
            ]);

        // New, cancelled, expired in period
        $newQ = Subscription::whereBetween('created_at', [$from, $to]);
        if ($planId) {
            $newQ->where('plan_id', $planId);
        }

        $cancelledQ = Subscription::where('status', Subscription::STATUS_CANCELLED)
            ->whereBetween('cancelled_at', [$from, $to]);
        if ($planId) {
            $cancelledQ->where('plan_id', $planId);
        }

        $expiredQ = Subscription::where('status', Subscription::STATUS_EXPIRED)
            ->whereBetween('ends_at', [$from, $to]);
        if ($planId) {
            $expiredQ->where('plan_id', $planId);
        }

        $expiringSoon = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->where('ends_at', '>', now())
            ->where('ends_at', '<=', now()->addDays(30))
            ->count();

        $mrr = app(SubscriptionService::class)->calculateMRR();

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'status_distribution' => [
                'active'    => (int) ($statusCounts['active']    ?? 0),
                'trial'     => (int) ($statusCounts['trial']     ?? 0),
                'past_due'  => (int) ($statusCounts['past_due']  ?? 0),
                'expired'   => (int) ($statusCounts['expired']   ?? 0),
                'cancelled' => (int) ($statusCounts['cancelled'] ?? 0),
            ],
            'plan_distribution'   => $planDist->values(),
            'new_in_period'       => $newQ->count(),
            'cancelled_in_period' => $cancelledQ->count(),
            'expired_in_period'   => $expiredQ->count(),
            'expiring_soon'       => $expiringSoon,
            'mrr'                 => $mrr,
            'arr'                 => $mrr * 12,
        ]);
    }

    // ── Organizations report ───────────────────────────────────────

    public function organizations(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        $planId = $request->query('plan_id');

        // Dashboard va Bog'chalar sahifasi bilan bir xil qoida (arxivlanganlar alohida)
        $counts       = app(\App\Services\OrganizationService::class)->statusCounts();
        $totalOrgs    = $counts['total'];
        $activeOrgs   = $counts['active'];
        $newInPeriod  = Organization::counted()->whereBetween('created_at', [$from, $to])->count();

        // Orgs with at least one pending/overdue invoice
        $withUnpaidInvoices = Organization::whereHas('subscriptions', function ($q) {
            $q->whereHas('invoices', fn($i) =>
                $i->whereIn('status', ['pending', 'overdue'])
            );
        })->count();

        // Orgs with an expired subscription
        $withExpiredSubs = Organization::whereHas('subscriptions', fn($q) =>
            $q->where('status', Subscription::STATUS_EXPIRED)
        )->count();

        // Plan distribution: orgs with active/trial subscription per plan
        $planQ = Subscription::whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->select('plan_id', DB::raw('count(distinct organization_id) as count'))
            ->groupBy('plan_id')
            ->with('plan:id,name');
        if ($planId) {
            $planQ->where('plan_id', $planId);
        }
        $planDist = $planQ->get()->map(fn($s) => [
            'plan_id'   => $s->plan_id,
            'plan_name' => $s->plan?->name ?? 'Boshqa',
            'count'     => (int) $s->count,
        ]);

        // Monthly growth: new orgs over last 12 months
        $growth = Organization::counted()->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->selectRaw("TO_CHAR(created_at, 'YYYY-MM') as period, count(*) as count")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->keyBy('period');

        $growthSeries = [];
        for ($i = 11; $i >= 0; $i--) {
            $key   = now()->subMonths($i)->format('Y-m');
            $label = now()->subMonths($i)->format('M Y');
            $growthSeries[] = [
                'period' => $key,
                'label'  => $label,
                'count'  => isset($growth[$key]) ? (int) $growth[$key]->count : 0,
            ];
        }

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'counts' => [
                'total'                => $totalOrgs,
                'active'               => $activeOrgs,
                'inactive'             => $counts['not_active'],
                'suspended'            => $counts['suspended'],
                'archived'             => $counts['archived'],
                'new_in_period'        => $newInPeriod,
                'with_unpaid_invoices' => $withUnpaidInvoices,
                'with_expired_subs'    => $withExpiredSubs,
            ],
            'plan_distribution' => $planDist->values(),
            'growth_series'     => $growthSeries,
        ]);
    }

    // ── Users report ───────────────────────────────────────────────

    public function users(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        // Dashboard bilan bir xil: test/demo bog'chalar foydalanuvchilari hisobga olinmaydi (platforma foydalanuvchilari — olinadi)
        $users = fn () => User::where(fn ($q) => $q->whereNull('organization_id')
            ->orWhereIn('organization_id', Organization::counted()->select('id')));

        $totalUsers  = $users()->count();
        $activeUsers = $users()->where('is_active', true)->count();
        $newInPeriod = $users()->whereBetween('created_at', [$from, $to])->count();

        $byRole = $users()->select('role', DB::raw('count(*) as count'))
            ->groupBy('role')
            ->pluck('count', 'role');

        // Top 10 orgs by user count
        $byOrg = $users()->whereNotNull('organization_id')
            ->select('organization_id', DB::raw('count(*) as count'))
            ->groupBy('organization_id')
            ->orderByDesc('count')
            ->limit(10)
            ->with('organization:id,name')
            ->get()
            ->map(fn($u) => [
                'organization_id'   => $u->organization_id,
                'organization_name' => $u->organization?->name ?? '—',
                'count'             => (int) $u->count,
            ]);

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'counts' => [
                'total'         => $totalUsers,
                'active'        => $activeUsers,
                'inactive'      => $totalUsers - $activeUsers,
                'new_in_period' => $newInPeriod,
            ],
            'by_role' => [
                'super_admin' => (int) ($byRole['super_admin'] ?? 0),
                'admin'       => (int) ($byRole['admin']       ?? 0),
                'teacher'     => (int) ($byRole['teacher']     ?? 0),
                'parent'      => (int) ($byRole['parent']      ?? 0),
            ],
            'by_organization' => $byOrg,
        ]);
    }
}
