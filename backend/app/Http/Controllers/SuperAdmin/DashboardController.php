<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends SuperAdminController
{
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

    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDates($request);

        // Previous period of same length for trend comparison
        $periodSeconds = $from->diffInSeconds($to);
        $prevTo        = $from->copy()->subSecond();
        $prevFrom      = $prevTo->copy()->subSeconds($periodSeconds);

        $totalOrgs      = Organization::count();
        $activeOrgs     = Organization::where('is_active', true)->count();
        $newOrgsPeriod  = Organization::whereBetween('created_at', [$from, $to])->count();

        $expiringSoon = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->where('ends_at', '<=', now()->addDays(14))
            ->where('ends_at', '>', now())
            ->count();

        $pendingPaymentOrgs = Payment::where('status', 'pending')
            ->distinct('organization_id')
            ->count('organization_id');

        $totalUsers = User::count();

        $recentOrgs = Organization::with(['subscriptions' => function ($q) {
                $q->latest()->limit(1)->with('plan');
            }])
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn ($org) => [
                'id'           => $org->id,
                'name'         => $org->name,
                'phone'        => $org->phone,
                'is_active'    => $org->is_active,
                'created_at'   => $org->created_at,
                'subscription' => $org->subscriptions->first() ? [
                    'status'  => $org->subscriptions->first()->status,
                    'ends_at' => $org->subscriptions->first()->ends_at,
                    'plan'    => $org->subscriptions->first()->plan?->name,
                ] : null,
            ]);

        $subStats = [
            'active'    => Subscription::where('status', Subscription::STATUS_ACTIVE)->count(),
            'trial'     => Subscription::where('status', Subscription::STATUS_TRIAL)->count(),
            'past_due'  => Subscription::where('status', Subscription::STATUS_PAST_DUE)->count(),
            'expired'   => Subscription::where('status', Subscription::STATUS_EXPIRED)->count(),
            'cancelled' => Subscription::where('status', Subscription::STATUS_CANCELLED)->count(),
        ];

        $mrr = app(SubscriptionService::class)->calculateMRR();

        $billing = [
            'mrr'              => $mrr,
            'arr'              => $mrr * 12,
            'monthly_revenue'  => (float) Payment::where('status', 'paid')
                ->whereMonth('paid_at', now()->month)
                ->whereYear('paid_at', now()->year)
                ->sum('amount'),
            'pending_revenue'  => (float) Payment::where('status', 'pending')->sum('amount'),
            'period_paid'      => (float) Payment::where('status', 'paid')
                ->whereBetween('paid_at', [$from, $to])
                ->sum('amount'),
            'prev_period_paid' => (float) Payment::where('status', 'paid')
                ->whereBetween('paid_at', [$prevFrom, $prevTo])
                ->sum('amount'),
            'total_paid'       => (float) Payment::where('status', 'paid')->sum('amount'),
            'total_refunded'   => (float) Payment::where('status', 'refunded')->sum('amount'),
        ];

        return response()->json([
            'period'                  => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'jami_bogchalar'          => $totalOrgs,
            'faol_bogchalar'          => $activeOrgs,
            'nofaol_bogchalar'        => $totalOrgs - $activeOrgs,
            'yangi_bogchalar'         => $newOrgsPeriod,
            'muddati_yaqin'           => $expiringSoon,
            'tolov_kutilmoqda'        => $pendingPaymentOrgs,
            'jami_foydalanuvchilar'   => $totalUsers,
            'oxirgi_bogchalar'        => $recentOrgs,
            'obuna_holati'            => $subStats,
            'billing'                 => $billing,
        ]);
    }

    public function recent(Request $request): JsonResponse
    {
        $payments = Payment::with('organization')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn ($p) => [
                'id'             => $p->id,
                'organization'   => $p->organization
                    ? ['id' => $p->organization->id, 'name' => $p->organization->name]
                    : null,
                'amount'         => $p->amount,
                'currency'       => $p->currency,
                'status'         => $p->status,
                'payment_method' => $p->payment_method,
                'paid_at'        => $p->paid_at,
                'created_at'     => $p->created_at,
            ]);

        $invoices = Invoice::with('organization')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn ($inv) => [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'organization'   => $inv->organization
                    ? ['id' => $inv->organization->id, 'name' => $inv->organization->name]
                    : null,
                'amount'         => $inv->amount,
                'currency'       => $inv->currency,
                'status'         => $inv->status,
                'due_at'         => $inv->due_at,
                'paid_at'        => $inv->paid_at,
                'created_at'     => $inv->created_at,
            ]);

        $activity = ActivityLog::with(['user', 'organization'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($log) => [
                'id'           => $log->id,
                'action'       => $log->action,
                'description'  => $log->description,
                'created_at'   => $log->created_at,
                'user'         => $log->user
                    ? ['id' => $log->user->id, 'name' => $log->user->name]
                    : null,
                'organization' => $log->organization
                    ? ['id' => $log->organization->id, 'name' => $log->organization->name]
                    : null,
            ]);

        return response()->json([
            'payments' => $payments,
            'invoices' => $invoices,
            'activity' => $activity,
        ]);
    }

    public function revenue(Request $request): JsonResponse
    {
        $period = (int) $request->query('period', 30);
        $period = min(max($period, 7), 365);

        $from = now()->subDays($period - 1)->startOfDay();

        $payments = Payment::where('status', 'paid')
            ->where('paid_at', '>=', $from)
            ->selectRaw("DATE(paid_at) as date, SUM(amount) as total")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $data = [];
        for ($i = $period - 1; $i >= 0; $i--) {
            $date   = now()->subDays($i)->format('Y-m-d');
            $data[] = [
                'date'  => $date,
                'total' => isset($payments[$date]) ? (float) $payments[$date]->total : 0.0,
            ];
        }

        return response()->json([
            'data'   => $data,
            'period' => $period,
            'total'  => array_sum(array_column($data, 'total')),
        ]);
    }
}
