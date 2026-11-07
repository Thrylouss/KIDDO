<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\DemoRequest;
use App\Services\DemoRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DemoRequestController extends SuperAdminController
{
    public function __construct(private DemoRequestService $service) {}

    public function index(Request $request): JsonResponse
    {
        $query = DemoRequest::with(['handler:id,name', 'organization:id,name'])->latest('id');

        if (in_array($status = $request->query('status'), DemoRequest::STATUSES, true)) {
            $query->where('status', $status);
        }
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->where('kindergarten_name', 'ilike', "%{$search}%")
                ->orWhere('director_name', 'ilike', "%{$search}%")
                ->orWhere('phone', 'like', '%' . preg_replace('/\D/', '', $search) . '%')
                ->orWhere('region', 'ilike', "%{$search}%"));
        }

        $page = $query->paginate(min(max((int) $request->query('per_page', 20), 1), 100));

        return response()->json([
            'data' => collect($page->items())->map(fn ($r) => $this->service->resource($r))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
                'counts'       => DemoRequest::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status'),
                'telegram_configured' => app(\App\Services\TelegramNotifier::class)->configured(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->service->resource(DemoRequest::with(['handler', 'organization'])->findOrFail($id))]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $demo = DemoRequest::findOrFail($id);
        $data = $request->validate([
            'status'          => ['sometimes', Rule::in(DemoRequest::STATUSES)],
            'internal_note'   => ['sometimes', 'nullable', 'string', 'max:2000'],
            'organization_id' => ['sometimes', 'nullable', 'integer', 'exists:organizations,id'],
        ], [
            'status.in'         => "Noto'g'ri holat.",
            'internal_note.max' => 'Ichki izoh juda uzun (2000 belgigacha).',
        ]);

        $demo = $this->service->update($demo, $data, $request->user(), $request->ip());

        return response()->json(['data' => $this->service->resource($demo->load(['handler', 'organization'])), 'message' => 'Saqlandi.']);
    }

    public function retryTelegram(int $id): JsonResponse
    {
        $demo = DemoRequest::findOrFail($id);
        $ok   = $this->service->deliver($demo);

        return response()->json([
            'data'    => $this->service->resource($demo->fresh(['handler', 'organization'])),
            'message' => $ok ? 'Telegramga yuborildi.' : 'Telegramga yuborib bo\'lmadi. Ariza saqlangan.',
        ], $ok ? 200 : 422);
    }
}
