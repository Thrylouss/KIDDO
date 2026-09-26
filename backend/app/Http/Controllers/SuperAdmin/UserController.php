<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends SuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('organization:id,name')->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('phone', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        if ($request->has('status')) {
            $query->where('is_active', $request->query('status') === 'active');
        }

        if ($orgId = $request->query('organization_id')) {
            if ($orgId === 'none') {
                $query->whereNull('organization_id');
            } else {
                $query->where('organization_id', $orgId);
            }
        }

        $sort = $request->query('sort', 'newest');
        match ($sort) {
            'oldest'     => $query->oldest(),
            'last_login' => $query->orderByDesc('last_login_at'),
            'name'       => $query->orderBy('name'),
            default      => $query->latest(),
        };

        $paginated = $query->paginate((int) $request->query('per_page', 20));

        return response()->json([
            'data' => $paginated->map(fn($u) => $this->formatUser($u))->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $user = User::with('organization:id,name,phone')->findOrFail($id);

        $activity = ActivityLog::where('user_id', $user->id)
            ->latest()
            ->limit(10)
            ->get(['id', 'action', 'description', 'ip_address', 'created_at'])
            ->map(fn($a) => [
                'id'          => $a->id,
                'action'      => $a->action,
                'description' => $a->description,
                'ip_address'  => $a->ip_address,
                'created_at'  => $a->created_at,
            ]);

        return response()->json([
            'data' => array_merge($this->formatUser($user), [
                'recent_activity' => $activity,
            ]),
        ]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->is_active) {
            return response()->json(['message' => 'Foydalanuvchi allaqachon faol.'], 422);
        }

        $user->update(['is_active' => true]);

        ActivityLog::record(
            'user.activated',
            "Foydalanuvchi faollashtirildi: #{$user->id} {$user->name}",
            $request->user()->id,
            $user->organization_id,
            ['target_user_id' => $user->id],
            $request->ip()
        );

        return response()->json([
            'message' => 'Foydalanuvchi faollashtirildi.',
            'data'    => $this->formatUser($user->fresh()),
        ]);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'O\'zingizni faolsizlantira olmaysiz.'], 422);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Foydalanuvchi allaqachon faolsiz.'], 422);
        }

        $user->update(['is_active' => false]);

        // Revoke all tokens on deactivation
        $user->tokens()->delete();

        ActivityLog::record(
            'user.deactivated',
            "Foydalanuvchi faolsizlantirildi: #{$user->id} {$user->name}",
            $request->user()->id,
            $user->organization_id,
            ['target_user_id' => $user->id],
            $request->ip()
        );

        return response()->json([
            'message' => 'Foydalanuvchi faolsizlantirildi.',
            'data'    => $this->formatUser($user->fresh()),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $data = $request->validate([
            'name'            => 'sometimes|required|string|max:255',
            'phone'           => ['sometimes', 'required', 'string', Rule::unique('users')->ignore($user->id)],
            'email'           => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'role'            => ['sometimes', 'required', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_ADMIN, User::ROLE_TEACHER, User::ROLE_PARENT])],
            'organization_id' => 'sometimes|nullable|exists:organizations,id',
            'is_active'       => 'sometimes|boolean',
        ]);

        $user->update($data);

        ActivityLog::record(
            'user.updated',
            "Foydalanuvchi ma'lumotlari yangilandi: #{$user->id} {$user->name}",
            $request->user()->id,
            $user->organization_id,
            ['target_user_id' => $user->id, 'updated_fields' => array_keys($data)],
            $request->ip()
        );

        return response()->json([
            'message' => "Foydalanuvchi ma'lumotlari yangilandi.",
            'data'    => $this->formatUser($user->fresh(['organization'])),
        ]);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $data = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user->update(['password' => Hash::make($data['password'])]);
        $user->tokens()->delete();

        ActivityLog::record(
            'user.password_reset',
            "Foydalanuvchi paroli yangilandi: #{$user->id} {$user->name}",
            $request->user()->id,
            $user->organization_id,
            ['target_user_id' => $user->id],
            $request->ip()
        );

        return response()->json(['message' => 'Parol muvaffaqiyatli yangilandi.']);
    }

    private function formatUser(User $user): array
    {
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'phone'         => $user->phone,
            'email'         => $user->email,
            'role'          => $user->role,
            'is_active'     => $user->is_active,
            'last_login_at' => $user->last_login_at,
            'created_at'    => $user->created_at,
            'organization'  => $user->organization ? [
                'id'    => $user->organization->id,
                'name'  => $user->organization->name,
                'phone' => $user->organization->phone ?? null,
            ] : null,
        ];
    }
}
