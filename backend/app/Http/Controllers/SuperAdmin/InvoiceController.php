<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends SuperAdminController
{
    // ── List ──────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['organization:id,name', 'subscription:id,plan_id'])->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'ilike', "%{$search}%")
                  ->orWhereHas('organization', fn($o) => $o->where('name', 'ilike', "%{$search}%"));
            });
        }

        if ($orgId = $request->query('organization_id')) {
            $query->where('organization_id', $orgId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $paginated = $query->paginate(min((int) $request->query('per_page', 20), 100));

        $response = [
            'data' => $paginated->map(fn($i) => $this->formatInvoice($i))->values(),
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

    // ── Detail ────────────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $invoice = Invoice::with([
            'organization:id,name',
            'subscription:id,status,ends_at,plan_id',
            'payments',
        ])->findOrFail($id);

        return response()->json(['data' => $this->formatInvoiceDetail($invoice)]);
    }

    // ── Store ─────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organization_id' => 'required|exists:organizations,id',
            'subscription_id' => 'nullable|exists:subscriptions,id',
            'amount'          => 'required|numeric|min:0',
            'currency'        => 'nullable|string|max:10',
            'status'          => 'nullable|in:draft,pending',
            'due_at'          => 'nullable|date',
            'notes'           => 'nullable|string|max:1000',
        ]);

        $invoice = Invoice::create([
            'organization_id' => $data['organization_id'],
            'subscription_id' => $data['subscription_id'] ?? null,
            'amount'          => $data['amount'],
            'currency'        => $data['currency'] ?? 'UZS',
            'status'          => $data['status'] ?? 'pending',
            'due_at'          => $data['due_at'] ?? null,
            'notes'           => $data['notes'] ?? null,
        ]);

        ActivityLog::record(
            'invoice.created',
            "Invoice yaratildi: {$invoice->invoice_number} org #{$invoice->organization_id}",
            $request->user()->id,
            $invoice->organization_id,
            ['invoice_id' => $invoice->id, 'amount' => $invoice->amount],
            $request->ip()
        );

        return response()->json(['data' => $this->formatInvoice($invoice)], 201);
    }

    // ── Mark Paid ─────────────────────────────────────────────────

    public function markPaid(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        if ($invoice->status === 'paid') {
            return response()->json(['message' => "Bu invoice allaqachon to'langan."], 422);
        }

        if ($invoice->status === 'cancelled') {
            return response()->json(['message' => "Bekor qilingan invoiceni to'langan deb belgilash mumkin emas."], 422);
        }

        $invoice->update(['status' => 'paid', 'paid_at' => now()]);

        ActivityLog::record(
            'invoice.marked_paid',
            "Invoice to'langan: {$invoice->invoice_number} org #{$invoice->organization_id}",
            $request->user()->id,
            $invoice->organization_id,
            ['invoice_id' => $invoice->id, 'amount' => $invoice->amount],
            $request->ip()
        );

        $invoice->load('organization:id,name');

        return response()->json(['data' => $this->formatInvoice($invoice)]);
    }

    // ── Cancel ────────────────────────────────────────────────────

    public function cancel(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        if ($invoice->status === 'paid') {
            return response()->json(['message' => "To'langan invoiceni bekor qilib bo'lmaydi."], 422);
        }

        if ($invoice->status === 'cancelled') {
            return response()->json(['message' => "Invoice allaqachon bekor qilingan."], 422);
        }

        $data = $request->validate(['reason' => 'nullable|string|max:500']);
        $invoice->update([
            'status' => 'cancelled',
            'notes'  => $data['reason'] ?? $invoice->notes,
        ]);

        ActivityLog::record(
            'invoice.cancelled',
            "Invoice bekor qilindi: {$invoice->invoice_number} org #{$invoice->organization_id}",
            $request->user()->id,
            $invoice->organization_id,
            ['invoice_id' => $invoice->id, 'reason' => $data['reason'] ?? null],
            $request->ip()
        );

        $invoice->load('organization:id,name');

        return response()->json(['data' => $this->formatInvoice($invoice)]);
    }

    // ── Format ────────────────────────────────────────────────────

    private function formatInvoice(Invoice $i): array
    {
        return [
            'id'              => $i->id,
            'invoice_number'  => $i->invoice_number,
            'organization'    => $i->organization ? [
                'id'   => $i->organization->id,
                'name' => $i->organization->name,
            ] : null,
            'subscription_id' => $i->subscription_id,
            'amount'          => $i->amount,
            'currency'        => $i->currency,
            'status'          => $i->status,
            'due_at'          => $i->due_at,
            'paid_at'         => $i->paid_at,
            'notes'           => $i->notes,
            'created_at'      => $i->created_at,
        ];
    }

    private function formatInvoiceDetail(Invoice $i): array
    {
        return array_merge($this->formatInvoice($i), [
            'subscription' => $i->subscription ? [
                'id'      => $i->subscription->id,
                'status'  => $i->subscription->status,
                'ends_at' => $i->subscription->ends_at,
                'plan_id' => $i->subscription->plan_id,
            ] : null,
            'payments' => $i->payments->map(fn($p) => [
                'id'             => $p->id,
                'amount'         => $p->amount,
                'currency'       => $p->currency,
                'status'         => $p->status,
                'payment_method' => $p->payment_method,
                'paid_at'        => $p->paid_at,
                'created_at'     => $p->created_at,
            ])->values()->all(),
        ]);
    }

    // ── Summary ───────────────────────────────────────────────────

    private function getSummary(): array
    {
        return [
            'total'                => Invoice::count(),
            'draft'                => Invoice::where('status', 'draft')->count(),
            'pending'              => Invoice::where('status', 'pending')->count(),
            'paid'                 => Invoice::where('status', 'paid')->count(),
            'overdue'              => Invoice::where('status', 'overdue')->count(),
            'cancelled'            => Invoice::where('status', 'cancelled')->count(),
            'total_pending_amount' => (float) Invoice::where('status', 'pending')->sum('amount'),
            'total_paid_amount'    => (float) Invoice::where('status', 'paid')->sum('amount'),
            'total_overdue_amount' => (float) Invoice::where('status', 'overdue')->sum('amount'),
        ];
    }
}
