<?php

namespace App\Http\Controllers\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Services\ChildPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Bolalarning oylik to'lov holati (rahbar qayd etadi). */
class PaymentController extends AdminController
{
    public function __construct(private ChildPaymentService $payments) {}

    /** GET /v1/admin/payments?month=YYYY-MM&group_id= */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Child::class);
        $orgId = $this->orgId($request);
        $data  = $request->validate(['month' => ['nullable', 'date_format:Y-m'], 'group_id' => ['nullable', 'integer']]);

        $groupId = isset($data['group_id']) ? Group::forOrganization($orgId)->findOrFail($data['group_id'])->id : null;

        return response()->json([
            ...$this->payments->overview($orgId, ChildPaymentService::monthStart($data['month'] ?? null), $groupId),
            'groups' => Group::forOrganization($orgId)->active()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** PUT /v1/admin/payments — to'langanini qayd etish yoki tahrirlash */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'child_id' => ['required', 'integer'],
            'month'    => ['required', 'date_format:Y-m'],
            'amount'   => ['required', 'integer', 'min:1', 'max:100000000'],
            'paid_at'  => ['required', 'date', 'before_or_equal:today'],
            'note'     => ['nullable', 'string', 'max:255'],
        ], [
            'amount.required'  => "Summani kiriting.",
            'amount.min'       => "Summa musbat bo'lsin.",
            'paid_at.required' => "To'lov sanasini kiriting.",
        ]);

        $child = Child::forOrganization($this->orgId($request))->findOrFail($data['child_id']);
        Gate::authorize('update', $child);

        $payment = $this->payments->record($child, ChildPaymentService::monthStart($data['month']), (int) $data['amount'],
            $data['paid_at'], $data['note'] ?? null, $request->user(), $request->ip());

        return response()->json(['message' => "To'lov qayd etildi.", 'data' => $this->payments->resource($payment)]);
    }

    /** DELETE /v1/admin/payments/{childId}/{month} — qaydni bekor qilish (to'lanmagan holatga) */
    public function destroy(Request $request, int $childId, string $month): JsonResponse
    {
        abort_unless(preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month) === 1, 404, "Ma'lumot topilmadi.");
        $child = Child::forOrganization($this->orgId($request))->findOrFail($childId);
        Gate::authorize('update', $child);

        abort_unless($this->payments->clear($child, ChildPaymentService::monthStart($month), $request->user(), $request->ip()), 404, "Ma'lumot topilmadi.");

        return response()->json(['message' => "To'lov qaydi bekor qilindi."]);
    }
}
