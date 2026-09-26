<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends SuperAdminController
{
    // ── List ───────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Payment::with([
            'organization:id,name',
            'subscription.plan:id,name',
            'invoice:id,invoice_number',
        ])->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('organization', function ($o) use ($search) {
                    $o->where('name',  'ilike', "%{$search}%")
                      ->orWhere('phone', 'ilike', "%{$search}%");
                })->orWhereHas('invoice', function ($i) use ($search) {
                    $i->where('invoice_number', 'ilike', "%{$search}%");
                })->orWhere('transaction_id', 'ilike', "%{$search}%");
            });
        }

        if ($orgId = $request->query('organization_id')) {
            $query->where('organization_id', $orgId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($method = $request->query('payment_method')) {
            $query->where('payment_method', $method);
        }

        if ($planId = $request->query('plan_id')) {
            $query->whereHas('subscription', fn($q) => $q->where('plan_id', $planId));
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $paginated = $query->paginate((int) $request->query('per_page', 20));

        $response = [
            'data' => $paginated->map(fn($p) => $this->formatPayment($p))->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ];

        if ($request->boolean('summary')) {
            $response['summary'] = $this->getSummary();
        }

        return response()->json($response);
    }

    // ── Detail ─────────────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $payment = Payment::with([
            'organization:id,name,phone',
            'subscription:id,status,ends_at,plan_id',
            'subscription.plan:id,name,price_monthly,currency',
            'invoice:id,invoice_number,status,due_at,paid_at',
        ])->findOrFail($id);

        return response()->json(['data' => $this->formatPaymentDetail($payment)]);
    }

    // ── Verify (pending → paid) ────────────────────────────────────

    public function verify(Request $request, int $id): JsonResponse
    {
        $payment = Payment::findOrFail($id);

        if ($payment->status !== 'pending') {
            return response()->json([
                'message' => "Faqat kutilayotgan to'lovni tasdiqlash mumkin.",
            ], 422);
        }

        $payment->update(['status' => 'paid', 'paid_at' => now()]);

        ActivityLog::record(
            'payment.verified',
            "To'lov tasdiqlandi: #{$payment->id} org #{$payment->organization_id}",
            $request->user()->id,
            $payment->organization_id,
            [
                'payment_id' => $payment->id,
                'amount'     => $payment->amount,
                'old_status' => 'pending',
                'new_status' => 'paid',
            ],
            $request->ip()
        );

        $payment->load(['organization:id,name', 'subscription.plan:id,name', 'invoice:id,invoice_number']);

        return response()->json([
            'message' => "To'lov muvaffaqiyatli tasdiqlandi.",
            'data'    => $this->formatPayment($payment),
        ]);
    }

    // ── Refund (paid → refunded) ───────────────────────────────────

    public function refund(Request $request, int $id): JsonResponse
    {
        $payment = Payment::findOrFail($id);

        if ($payment->status !== 'paid') {
            return response()->json([
                'message' => "Faqat to'langan to'lovni qaytarish mumkin.",
            ], 422);
        }

        $data = $request->validate(['reason' => 'nullable|string|max:500']);

        $payment->update([
            'status' => 'refunded',
            'notes'  => $data['reason'] ?? $payment->notes,
        ]);

        ActivityLog::record(
            'payment.refunded',
            "To'lov qaytarildi: #{$payment->id} org #{$payment->organization_id}",
            $request->user()->id,
            $payment->organization_id,
            [
                'payment_id' => $payment->id,
                'amount'     => $payment->amount,
                'reason'     => $data['reason'] ?? null,
                'old_status' => 'paid',
                'new_status' => 'refunded',
            ],
            $request->ip()
        );

        $payment->load(['organization:id,name', 'subscription.plan:id,name', 'invoice:id,invoice_number']);

        return response()->json([
            'message' => "To'lov muvaffaqiyatli qaytarildi.",
            'data'    => $this->formatPayment($payment),
        ]);
    }

    // ── Format helpers ─────────────────────────────────────────────

    private function formatPayment(Payment $p): array
    {
        return [
            'id'              => $p->id,
            'organization'    => $p->organization ? [
                'id'   => $p->organization->id,
                'name' => $p->organization->name,
            ] : null,
            'subscription_id' => $p->subscription_id,
            'invoice_id'      => $p->invoice_id,
            'invoice_number'  => $p->invoice?->invoice_number,
            'amount'          => $p->amount,
            'currency'        => $p->currency,
            'status'          => $p->status,
            'payment_method'  => $p->payment_method,
            'transaction_id'  => $p->transaction_id,
            'paid_at'         => $p->paid_at,
            'due_at'          => $p->due_at,
            'plan_name'       => $p->subscription?->plan?->name,
            'notes'           => $p->notes,
            'created_at'      => $p->created_at,
        ];
    }

    private function formatPaymentDetail(Payment $p): array
    {
        return array_merge($this->formatPayment($p), [
            'organization' => $p->organization ? [
                'id'    => $p->organization->id,
                'name'  => $p->organization->name,
                'phone' => $p->organization->phone ?? null,
            ] : null,
            'subscription' => $p->subscription ? [
                'id'      => $p->subscription->id,
                'status'  => $p->subscription->status,
                'ends_at' => $p->subscription->ends_at,
                'plan'    => $p->subscription->plan ? [
                    'id'            => $p->subscription->plan->id,
                    'name'          => $p->subscription->plan->name,
                    'price_monthly' => $p->subscription->plan->price_monthly,
                    'currency'      => $p->subscription->plan->currency,
                ] : null,
            ] : null,
            'invoice' => $p->invoice ? [
                'id'             => $p->invoice->id,
                'invoice_number' => $p->invoice->invoice_number,
                'status'         => $p->invoice->status,
                'due_at'         => $p->invoice->due_at,
                'paid_at'        => $p->invoice->paid_at,
            ] : null,
        ]);
    }

    // ── Summary ────────────────────────────────────────────────────

    private function getSummary(): array
    {
        $paidRevenue    = (float) Payment::where('status', 'paid')->sum('amount');
        $refundedAmount = (float) Payment::where('status', 'refunded')->sum('amount');

        return [
            'gross_revenue'   => $paidRevenue + $refundedAmount,
            'net_revenue'     => $paidRevenue,
            'total_revenue'   => $paidRevenue,   // backward compatibility
            'refunded_amount' => $refundedAmount,
            'today_revenue'   => (float) Payment::where('status', 'paid')
                                    ->whereDate('paid_at', today())
                                    ->sum('amount'),
            'monthly_revenue' => (float) Payment::where('status', 'paid')
                                    ->whereMonth('paid_at', now()->month)
                                    ->whereYear('paid_at', now()->year)
                                    ->sum('amount'),
            'pending_revenue' => (float) Payment::where('status', 'pending')->sum('amount'),
            'paid_count'      => Payment::where('status', 'paid')->count(),
            'pending_count'   => Payment::where('status', 'pending')->count(),
            'failed_count'    => Payment::where('status', 'failed')->count(),
            'refunded_count'  => Payment::where('status', 'refunded')->count(),
            'total_count'     => Payment::count(),
        ];
    }
}
