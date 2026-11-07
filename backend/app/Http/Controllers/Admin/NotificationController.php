<?php

namespace App\Http\Controllers\Admin;

use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Super Admin yuborgan bildirishnomalar — faqat o'z bog'chasiniki (recipient_type=admin). */
class NotificationController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = AppNotification::where('organization_id', $this->orgId($request))->where('recipient_type', 'admin');

        return response()->json([
            'data'         => (clone $query)->latest()->limit(50)->get(['id', 'title', 'message', 'type', 'read_at', 'created_at']),
            'unread_count' => (clone $query)->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $n = AppNotification::where('organization_id', $this->orgId($request))->where('recipient_type', 'admin')->findOrFail($id);
        $n->read_at ??= now();
        $n->save();

        return response()->json(['message' => "O'qildi."]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::where('organization_id', $this->orgId($request))->where('recipient_type', 'admin')
            ->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => "Barchasi o'qildi."]);
    }
}
