<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SubscriptionController extends SuperAdminController
{
    public function __construct(private SubscriptionService $subscriptionService)
    {
    }

    // ── KPI metrics ────────────────────────────────────────────────

    public function metrics(): JsonResponse
    {
        $counts = Subscription::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'data' => [
                'active'    => (int) ($counts[Subscription::STATUS_ACTIVE]    ?? 0),
                'trial'     => (int) ($counts[Subscription::STATUS_TRIAL]     ?? 0),
                'past_due'  => (int) ($counts[Subscription::STATUS_PAST_DUE]  ?? 0),
                'expired'   => (int) ($counts[Subscription::STATUS_EXPIRED]   ?? 0),
                'cancelled' => (int) ($counts[Subscription::STATUS_CANCELLED] ?? 0),
                'mrr'       => $this->subscriptionService->calculateMRR(),
            ],
        ]);
    }

    // ── List ───────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Subscription::with(['organization:id,name', 'plan:id,name,price_monthly,currency'])
            ->latest();

        if ($search = $request->query('search')) {
            $query->whereHas('organization', fn($q) =>
                $q->where('name', 'ilike', "%{$search}%")
            );
        }

        if ($planId = $request->query('plan_id')) {
            $query->where('plan_id', $planId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($orgId = $request->query('organization_id')) {
            $query->where('organization_id', $orgId);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $sort = $request->query('sort', 'newest');
        if ($sort === 'oldest') {
            $query->oldest();
        } elseif ($sort === 'ending_soon') {
            $query->orderByRaw("CASE WHEN ends_at IS NULL THEN 1 ELSE 0 END, ends_at ASC");
        } else {
            $query->latest();
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 100));

        return response()->json([
            'data' => $paginated->map(fn($sub) => $this->formatSub($sub))->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    // ── Detail ─────────────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $sub = Subscription::with([
            'organization',
            'plan',
            'invoices'  => fn($q) => $q->latest()->limit(5),
            'payments'  => fn($q) => $q->latest()->limit(5),
        ])->findOrFail($id);

        $totalPaid     = (float) $sub->payments()->where('status', 'paid')->sum('amount');
        $totalPending  = (float) $sub->invoices()->whereIn('status', ['pending', 'overdue'])->sum('amount');
        $latestPayment = $sub->payments()->where('status', 'paid')->latest('paid_at')->first();

        return response()->json([
            'data' => array_merge($this->formatSub($sub), [
                'organization_detail' => $sub->organization ? [
                    'id'      => $sub->organization->id,
                    'name'    => $sub->organization->name,
                    'phone'   => $sub->organization->phone,
                    'address' => $sub->organization->address,
                ] : null,
                'plan_detail' => $sub->plan ? [
                    'id'            => $sub->plan->id,
                    'name'          => $sub->plan->name,
                    'description'   => $sub->plan->description,
                    'price_monthly' => $sub->plan->price_monthly,
                    'price_yearly'  => $sub->plan->price_yearly,
                    'currency'      => $sub->plan->currency,
                    'trial_days'    => $sub->plan->trial_days,
                    'max_children'  => $sub->plan->max_children,
                    'max_teachers'  => $sub->plan->max_teachers,
                    'max_groups'    => $sub->plan->max_groups,
                    'features'      => $sub->plan->features ?? [],
                ] : null,
                'payment_summary' => [
                    'total_paid'        => $totalPaid,
                    'total_pending'     => $totalPending,
                    'latest_payment_at' => $latestPayment?->paid_at,
                ],
                'recent_invoices' => $sub->invoices->map(fn($inv) => [
                    'id'             => $inv->id,
                    'invoice_number' => $inv->invoice_number,
                    'amount'         => $inv->amount,
                    'currency'       => $inv->currency,
                    'status'         => $inv->status,
                    'due_at'         => $inv->due_at,
                    'paid_at'        => $inv->paid_at,
                    'created_at'     => $inv->created_at,
                ]),
                'recent_payments' => $sub->payments->map(fn($pay) => [
                    'id'             => $pay->id,
                    'amount'         => $pay->amount,
                    'currency'       => $pay->currency,
                    'status'         => $pay->status,
                    'payment_method' => $pay->payment_method,
                    'paid_at'        => $pay->paid_at,
                    'created_at'     => $pay->created_at,
                ]),
            ]),
        ]);
    }

    // ── Create ─────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organization_id' => 'required|exists:organizations,id',
            'plan_id'         => 'required|exists:plans,id',
            'status'          => ['required', Rule::in([Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])],
            'ends_at'         => 'required_if:status,active|nullable|date|after:today',
            'starts_at'       => 'nullable|date',
            'payment_status'  => 'nullable|in:paid,pending',
            'auto_renew'      => 'boolean',
            'notes'           => 'nullable|string|max:500',
        ]);

        $org  = Organization::findOrFail($data['organization_id']);
        $plan = Plan::findOrFail($data['plan_id']);

        $sub = $this->subscriptionService->createSubscription($org, $plan, [
            'status'         => $data['status'],
            'starts_at'      => $data['starts_at'] ?? null,
            'ends_at'        => $data['ends_at'] ?? null,
            'payment_status' => $data['payment_status'] ?? 'pending',
            'auto_renew'     => $data['auto_renew'] ?? false,
            'notes'          => $data['notes'] ?? null,
            'user_id'        => $request->user()->id,
            'ip'             => $request->ip(),
        ]);

        $sub->load(['organization:id,name', 'plan:id,name,price_monthly,currency']);

        return response()->json([
            'message' => 'Obuna muvaffaqiyatli yaratildi.',
            'data'    => $this->formatSub($sub),
        ], 201);
    }

    // ── Toggle auto-renew ──────────────────────────────────────────

    public function toggleAutoRenew(Request $request, int $id): JsonResponse
    {
        $sub      = Subscription::findOrFail($id);
        $newValue = ! $sub->auto_renew;

        $sub->update(['auto_renew' => $newValue]);

        ActivityLog::record(
            'subscription.auto_renew_changed',
            "Avto-yangilash: org #{$sub->organization_id} → " . ($newValue ? 'yoqildi' : "o'chirildi"),
            $request->user()->id,
            $sub->organization_id,
            ['auto_renew' => $newValue],
            $request->ip()
        );

        $sub->load(['organization:id,name', 'plan:id,name,price_monthly,currency']);

        return response()->json([
            'message' => $newValue ? 'Avto-yangilash yoqildi.' : "Avto-yangilash o'chirildi.",
            'data'    => $this->formatSub($sub),
        ]);
    }

    // ── Renew ──────────────────────────────────────────────────────

    public function renew(Request $request, int $id): JsonResponse
    {
        $sub = Subscription::findOrFail($id);

        $data = $request->validate([
            'plan_id'        => 'required|exists:plans,id',
            'ends_at'        => 'required|date|after:today',
            'payment_status' => 'required|in:paid,pending',
            'notes'          => 'nullable|string|max:500',
        ]);

        $plan   = Plan::findOrFail($data['plan_id']);
        $newSub = $this->subscriptionService->renewSubscription($sub, $plan, [
            'ends_at'        => $data['ends_at'],
            'payment_status' => $data['payment_status'],
            'notes'          => $data['notes'] ?? null,
            'user_id'        => $request->user()->id,
            'ip'             => $request->ip(),
        ]);

        $newSub->load(['organization:id,name', 'plan:id,name,price_monthly,currency']);

        return response()->json([
            'message' => 'Obuna muvaffaqiyatli uzaytirildi.',
            'data'    => $this->formatSub($newSub),
        ]);
    }

    // ── Change plan ────────────────────────────────────────────────

    public function changePlan(Request $request, int $id): JsonResponse
    {
        $sub = Subscription::findOrFail($id);

        $data = $request->validate([
            'plan_id'               => 'required|exists:plans,id',
            'effective_immediately' => 'boolean',
        ]);

        $plan   = Plan::findOrFail($data['plan_id']);
        $newSub = $this->subscriptionService->changePlan($sub, $plan, [
            'effective_immediately' => $data['effective_immediately'] ?? true,
            'user_id'               => $request->user()->id,
            'ip'                    => $request->ip(),
        ]);

        $newSub->load(['organization:id,name', 'plan:id,name,price_monthly,currency']);

        return response()->json([
            'message' => "Obuna tarifi o'zgartirildi.",
            'data'    => $this->formatSub($newSub),
        ]);
    }

    // ── Cancel ─────────────────────────────────────────────────────

    public function cancel(Request $request, int $id): JsonResponse
    {
        $sub = Subscription::findOrFail($id);

        $data = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $cancelled = $this->subscriptionService->cancelSubscription(
            $sub,
            $data['reason'] ?? null,
            [
                'user_id' => $request->user()->id,
                'ip'      => $request->ip(),
            ]
        );

        $cancelled->load(['organization:id,name', 'plan:id,name,price_monthly,currency']);

        return response()->json([
            'message' => 'Obuna bekor qilindi.',
            'data'    => $this->formatSub($cancelled),
        ]);
    }

    // ── Format helper ──────────────────────────────────────────────

    private function formatSub(Subscription $sub): array
    {
        return [
            'id'               => $sub->id,
            'organization_id'  => $sub->organization_id,
            'organization'     => $sub->organization ? [
                'id'   => $sub->organization->id,
                'name' => $sub->organization->name,
            ] : null,
            'plan_id'          => $sub->plan_id,
            'plan'             => $sub->plan ? [
                'id'            => $sub->plan->id,
                'name'          => $sub->plan->name,
                'price_monthly' => $sub->plan->price_monthly,
                'currency'      => $sub->plan->currency,
            ] : null,
            'status'           => $sub->status,
            'starts_at'        => $sub->starts_at,
            'ends_at'          => $sub->ends_at,
            'trial_ends_at'    => $sub->trial_ends_at,
            'auto_renew'       => $sub->auto_renew,
            'cancelled_at'     => $sub->cancelled_at,
            'cancelled_reason' => $sub->cancelled_reason,
            'days_remaining'   => $sub->daysRemaining(),
            'is_expiring_soon' => $sub->isExpiringSoon(),
            'created_at'       => $sub->created_at,
        ];
    }
}
