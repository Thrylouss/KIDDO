<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Organization;
use App\Models\Payment;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends SuperAdminController
{
    public function summary(Request $request): JsonResponse
    {
        $totalOrgs  = Organization::count();
        $activeOrgs = Organization::where('is_active', true)->count();

        $expiringSoon = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->where('ends_at', '<=', now()->addDays(14))
            ->where('ends_at', '>', now())
            ->count();

        $pendingPayment = Payment::where('status', 'pending')
            ->distinct('organization_id')
            ->count('organization_id');

        $recentOrgs = Organization::with(['subscriptions' => function ($q) {
                $q->latest()->limit(1)->with('plan');
            }])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn($org) => [
                'id'           => $org->id,
                'name'         => $org->name,
                'phone'        => $org->phone,
                'is_active'    => $org->is_active,
                'created_at'   => $org->created_at,
                'subscription' => $org->subscriptions->first() ? [
                    'status'    => $org->subscriptions->first()->status,
                    'ends_at'   => $org->subscriptions->first()->ends_at,
                    'plan'      => $org->subscriptions->first()->plan?->name,
                ] : null,
            ]);

        $subStats = [
            'active'    => Subscription::where('status', Subscription::STATUS_ACTIVE)->count(),
            'trial'     => Subscription::where('status', Subscription::STATUS_TRIAL)->count(),
            'past_due'  => Subscription::where('status', Subscription::STATUS_PAST_DUE)->count(),
            'expired'   => Subscription::where('status', Subscription::STATUS_EXPIRED)->count(),
            'cancelled' => Subscription::where('status', Subscription::STATUS_CANCELLED)->count(),
        ];

        $subscriptionService = app(SubscriptionService::class);

        $mrr     = $subscriptionService->calculateMRR();
        $billing = [
            'mrr'             => $mrr,
            'arr'             => $mrr * 12,
            'monthly_revenue' => (float) Payment::where('status', 'paid')
                ->whereMonth('paid_at', now()->month)
                ->whereYear('paid_at', now()->year)
                ->sum('amount'),
            'pending_revenue' => (float) Payment::where('status', 'pending')->sum('amount'),
        ];

        return response()->json([
            'jami_bogchalar'   => $totalOrgs,
            'faol_bogchalar'   => $activeOrgs,
            'muddati_yaqin'    => $expiringSoon,
            'tolov_kutilmoqda' => $pendingPayment,
            'oxirgi_bogchalar' => $recentOrgs,
            'obuna_holati'     => $subStats,
            'billing'          => $billing,
        ]);
    }

    public function revenue(Request $request): JsonResponse
    {
        $period = (int) $request->query('period', 30);
        $period = min(max($period, 7), 365);  // clamp 7-365 days

        $from = now()->subDays($period - 1)->startOfDay();

        // Get daily revenue for the period
        $payments = Payment::where('status', 'paid')
            ->where('paid_at', '>=', $from)
            ->selectRaw("DATE(paid_at) as date, SUM(amount) as total")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        // Fill in missing days with 0
        $data = [];
        for ($i = $period - 1; $i >= 0; $i--) {
            $date   = now()->subDays($i)->format('Y-m-d');
            $data[] = [
                'date'  => $date,
                'total' => isset($payments[$date]) ? (float) $payments[$date]->total : 0.0,
            ];
        }

        // Also provide summary
        $total = array_sum(array_column($data, 'total'));

        return response()->json([
            'data'   => $data,
            'period' => $period,
            'total'  => $total,
        ]);
    }
}
