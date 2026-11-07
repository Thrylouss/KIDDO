<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\AppNotification;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends SuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        // Sahifalash: boshqa Super Admin ro'yxatlari kabi per_page (standart 50, ko'pi bilan 100)
        $perPage   = min(max((int) $request->query('per_page', 50), 1), 100);
        $paginated = AppNotification::where('recipient_type', 'super_admin')
            ->latest()
            ->orderByDesc('id')
            ->paginate($perPage);

        $notifications = collect($paginated->items())->map(fn($n) => [
            'id'         => $n->id,
            'title'      => $n->title,
            'message'    => $n->message,
            'type'       => $n->type,  // info, warning, alert, payment
            'is_read'    => !is_null($n->read_at),
            'created_at' => $n->created_at,
        ]);

        return response()->json([
            'data'         => $notifications,
            'unread_count' => AppNotification::where('recipient_type', 'super_admin')
                ->whereNull('read_at')
                ->count(),
            'meta'         => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = AppNotification::where('recipient_type', 'super_admin')
            ->findOrFail($id);
        $notification->update(['read_at' => now()]);
        return response()->json(['message' => 'OK']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::where('recipient_type', 'super_admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['message' => 'OK']);
    }

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'           => 'required|string|max:255',
            'message'         => 'required|string|max:2000',
            'type'            => ['required', Rule::in(['info', 'warning', 'alert', 'payment'])],
            'organization_id' => 'nullable|exists:organizations,id',
        ]);

        $targetOrgId = $data['organization_id'] ?? null;
        $orgIds = $targetOrgId
            ? [$targetOrgId]
            : Organization::where('is_active', true)->pluck('id')->toArray();

        foreach ($orgIds as $orgId) {
            AppNotification::create([
                'recipient_type'  => 'admin',
                'recipient_id'    => $orgId,
                'organization_id' => $orgId,
                'title'           => $data['title'],
                'message'         => $data['message'],
                'type'            => $data['type'],
                'created_by'      => $request->user()->id,
            ]);
        }

        ActivityLog::record(
            'notification.sent',
            "Xabar yuborildi: {$data['title']}",
            $request->user()->id,
            $targetOrgId,
            ['title' => $data['title'], 'recipients' => count($orgIds)],
            $request->ip()
        );

        return response()->json(['message' => 'Xabar muvaffaqiyatli yuborildi.', 'sent_to' => count($orgIds)]);
    }
}
