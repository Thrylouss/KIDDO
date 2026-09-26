<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends SuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with(['user:id,name', 'organization:id,name'])
            ->latest();

        if ($orgId = $request->query('organization_id')) {
            $query->where('organization_id', $orgId);
        }

        if ($action = $request->query('action')) {
            $query->where('action', 'like', "%{$action}%");
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'ilike', "%{$search}%")
                  ->orWhere('action', 'ilike', "%{$search}%");
            });
        }

        $perPage = min((int) ($request->query('per_page', 30)), 100);
        $logs    = $query->paginate($perPage);

        return response()->json([
            'data' => collect($logs->items())->map(fn ($log) => [
                'id'           => $log->id,
                'action'       => $log->action,
                'description'  => $log->description,
                'ip_address'   => $log->ip_address,
                'created_at'   => $log->created_at,
                'user'         => $log->user
                    ? ['id' => $log->user->id, 'name' => $log->user->name]
                    : null,
                'organization' => $log->organization
                    ? ['id' => $log->organization->id, 'name' => $log->organization->name]
                    : null,
            ])->values(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }
}
