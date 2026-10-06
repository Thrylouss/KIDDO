<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class OrganizationController extends SuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = Organization::with('subscription.plan')
            ->withCount(['groups', 'children']);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $status = $request->query('status');
        if ($status) {
            $latestStatusSql = '(SELECT status FROM subscriptions WHERE organization_id = organizations.id ORDER BY created_at DESC LIMIT 1)';

            match ($status) {
                'active'          => $query->where('is_active', true),
                'inactive'        => $query->where('is_active', false),
                'trial'           => $query->whereRaw("{$latestStatusSql} = 'trial'"),
                'paid'            => $query->whereRaw("{$latestStatusSql} = 'active'"),
                'payment_overdue' => $query->whereRaw("{$latestStatusSql} = 'past_due'"),
                'expired'         => $query->whereRaw("{$latestStatusSql} = 'expired'"),
                'cancelled'       => $query->whereRaw("{$latestStatusSql} = 'cancelled'"),
                default           => null,
            };
        }

        $sort = $request->query('sort', 'newest');
        match ($sort) {
            'oldest'              => $query->oldest(),
            'name'                => $query->orderBy('name'),
            'subscription_expiry' => $query->orderByRaw(
                '(SELECT ends_at FROM subscriptions WHERE organization_id = organizations.id ORDER BY created_at DESC LIMIT 1) ASC NULLS LAST'
            ),
            default               => $query->latest(),
        };

        $perPage   = min((int) ($request->query('per_page', 20)), 100);
        $paginated = $query->paginate($perPage);

        $orgIds       = collect($paginated->items())->pluck('id');
        $adminsByOrg  = User::where('role', User::ROLE_ADMIN)
            ->whereIn('organization_id', $orgIds)
            ->select('id', 'name', 'phone', 'organization_id')
            ->orderBy('id')
            ->get()
            ->groupBy('organization_id');

        return response()->json([
            'data' => collect($paginated->items())->map(function ($org) use ($adminsByOrg) {
                $admin = $adminsByOrg->get($org->id)?->first();
                return $this->formatOrg($org, $admin);
            })->values(),
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
        $org = Organization::with('subscription.plan')
            ->withCount(['groups', 'children', 'teacherProfiles', 'parentProfiles'])
            ->findOrFail($id);

        $admins = User::where('organization_id', $id)
            ->where('role', User::ROLE_ADMIN)
            ->select('id', 'name', 'phone', 'email', 'is_active')
            ->get();

        return response()->json([
            'data' => [
                ...$this->formatOrg($org, $admins->first()),
                'admins'                 => $admins,
                'groups_count'           => $org->groups_count,
                'children_count'         => $org->children_count,
                'teacher_profiles_count' => $org->teacher_profiles_count,
                'parent_profiles_count'  => $org->parent_profiles_count,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                => 'required|string|max:255',
            'phone'               => 'nullable|string|max:30',
            'address'             => 'nullable|string|max:500',
            'admin_name'          => 'nullable|string|max:255',
            'admin_phone'         => 'nullable|string|max:30|unique:users,phone',
            'admin_email'         => 'nullable|email|max:255|unique:users,email',
            'admin_password'      => 'required_with:admin_name,admin_phone|string|min:8',
            'plan_id'             => 'nullable|exists:plans,id',
            'subscription_status' => ['nullable', Rule::in(['active', 'trial', 'past_due'])],
            'starts_at'           => 'nullable|date',
            'ends_at'             => 'nullable|date|after_or_equal:starts_at',
            'payment_status'      => ['nullable', Rule::in(['paid', 'pending', 'overdue'])],
        ]);

        $result = DB::transaction(function () use ($data, $request) {
            $org = Organization::create([
                'name'      => $data['name'],
                'phone'     => $data['phone'] ?? null,
                'address'   => $data['address'] ?? null,
                'is_active' => true,
            ]);

            if (!empty($data['admin_name']) && !empty($data['admin_phone'])) {
                User::create([
                    'name'            => $data['admin_name'],
                    'phone'           => $data['admin_phone'],
                    'email'           => $data['admin_email'] ?? null,
                    'password'        => Hash::make($data['admin_password']),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $org->id,
                    'is_active'       => true,
                ]);
            }

            if (!empty($data['plan_id'])) {
                $plan    = Plan::findOrFail($data['plan_id']);
                $service = app(SubscriptionService::class);
                $service->createSubscription($org, $plan, [
                    'status'         => $data['subscription_status'] ?? Subscription::STATUS_TRIAL,
                    'starts_at'      => $data['starts_at'] ?? now(),
                    'ends_at'        => $data['ends_at'] ?? null,
                    'payment_status' => $data['payment_status'] ?? 'pending',
                    'user_id'        => $request->user()->id,
                    'ip'             => $request->ip(),
                ]);
            }

            ActivityLog::record(
                'organization.created',
                "Yangi bog'cha yaratildi: {$org->name}",
                $request->user()->id,
                $org->id,
                ['org_name' => $org->name],
                $request->ip()
            );

            return $org;
        });

        return response()->json([
            'message' => "Bog'cha muvaffaqiyatli yaratildi.",
            'data'    => ['id' => $result->id],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        $data = $request->validate([
            'name'    => ['sometimes', 'string', 'max:255'],
            'phone'   => ['nullable', 'string', 'max:30', Rule::unique('organizations', 'phone')->ignore($id)],
            'address' => 'nullable|string|max:500',
        ]);

        $org->update($data);

        ActivityLog::record(
            'organization.updated',
            "Bog'cha ma'lumotlari o'zgartirildi: {$org->name}",
            $request->user()->id,
            $org->id,
            ['fields' => array_keys($data)],
            $request->ip()
        );

        return response()->json(['message' => "Bog'cha yangilandi.", 'data' => $org]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        $org->update(['is_active' => true]);

        ActivityLog::record(
            'organization.activated',
            "Bog'cha faollashtirildi: {$org->name}",
            $request->user()->id,
            $org->id,
            [],
            $request->ip()
        );

        return response()->json(['message' => "Bog'cha faollashtirildi."]);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        $org->update(['is_active' => false]);

        // Revoke all active Sanctum tokens for every user in this org so that
        // deactivation takes effect immediately — no stale sessions survive.
        $org->users()->each(fn (User $user) => $user->tokens()->delete());

        ActivityLog::record(
            'organization.deactivated',
            "Bog'cha faolsizlantirildi: {$org->name}",
            $request->user()->id,
            $org->id,
            [],
            $request->ip()
        );

        return response()->json(['message' => "Bog'cha faolsizlantirildi."]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $org  = Organization::findOrFail($id);
        $name = $org->name;
        $org->delete();

        ActivityLog::record(
            'organization.deleted',
            "Bog'cha o'chirildi: {$name}",
            $request->user()->id,
            null,
            ['org_name' => $name],
            $request->ip()
        );

        return response()->json(['message' => "Bog'cha o'chirildi."]);
    }

    public function enter(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        ActivityLog::record(
            'organization.entered',
            "Super Admin bog'cha paneliga kirdi: {$org->name}",
            $request->user()->id,
            $org->id,
            [],
            $request->ip()
        );

        return response()->json(['message' => 'OK', 'data' => ['organization_id' => $org->id]]);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        Organization::findOrFail($id);

        $data = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $admin = User::where('organization_id', $id)
            ->where('role', User::ROLE_ADMIN)
            ->orderBy('id')
            ->firstOrFail();

        $admin->update(['password' => Hash::make($data['password'])]);

        // Revoke tokens so any stolen session is terminated immediately — the
        // whole point of an emergency password reset is to kick out an attacker.
        $admin->tokens()->delete();

        ActivityLog::record(
            'admin.password_reset',
            "Admin paroli yangilandi: {$admin->name}",
            $request->user()->id,
            $id,
            ['admin_id' => $admin->id],
            $request->ip()
        );

        return response()->json(['message' => 'Admin paroli muvaffaqiyatli yangilandi.']);
    }

    public function payments(int $id): JsonResponse
    {
        Organization::findOrFail($id);

        $payments = Payment::where('organization_id', $id)
            ->with(['subscription.plan', 'invoice:id,invoice_number'])
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn($p) => [
                'id'             => $p->id,
                'amount'         => $p->amount,
                'currency'       => $p->currency,
                'status'         => $p->status,
                'payment_method' => $p->payment_method,
                'transaction_id' => $p->transaction_id,
                'invoice_number' => $p->invoice?->invoice_number,
                'paid_at'        => $p->paid_at,
                'notes'          => $p->notes,
                'created_at'     => $p->created_at,
                'plan_name'      => $p->subscription?->plan?->name,
            ]);

        return response()->json(['data' => $payments]);
    }

    public function activityLogs(int $id): JsonResponse
    {
        Organization::findOrFail($id);

        $logs = ActivityLog::where('organization_id', $id)
            ->with(['user:id,name'])
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn($log) => [
                'id'          => $log->id,
                'action'      => $log->action,
                'description' => $log->description,
                'created_at'  => $log->created_at,
                'user'        => $log->user
                    ? ['id' => $log->user->id, 'name' => $log->user->name]
                    : null,
            ]);

        return response()->json(['data' => $logs]);
    }

    public function renewSubscription(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        $data = $request->validate([
            'plan_id'        => 'required|exists:plans,id',
            'ends_at'        => 'required|date|after:today',
            'payment_status' => ['required', Rule::in(['paid', 'pending', 'overdue'])],
            'notes'          => 'nullable|string|max:500',
        ]);

        $plan    = Plan::findOrFail($data['plan_id']);
        $sub     = $org->subscription;
        $service = app(SubscriptionService::class);

        if ($sub) {
            $service->renewSubscription($sub, $plan, [
                'ends_at'        => $data['ends_at'],
                'payment_status' => $data['payment_status'],
                'notes'          => $data['notes'] ?? null,
                'user_id'        => $request->user()->id,
                'ip'             => $request->ip(),
            ]);
        } else {
            $service->createSubscription($org, $plan, [
                'status'         => Subscription::STATUS_ACTIVE,
                'ends_at'        => $data['ends_at'],
                'payment_status' => $data['payment_status'],
                'notes'          => $data['notes'] ?? null,
                'user_id'        => $request->user()->id,
                'ip'             => $request->ip(),
            ]);
        }

        return response()->json(['message' => 'Obuna muvaffaqiyatli uzaytirildi.']);
    }

    private function formatOrg(Organization $org, ?User $admin = null): array
    {
        $sub = $org->subscription;
        return [
            'id'           => $org->id,
            'name'         => $org->name,
            'phone'        => $org->phone,
            'address'      => $org->address,
            'is_active'    => $org->is_active,
            'created_at'   => $org->created_at,
            'admin'        => $admin ? [
                'id'    => $admin->id,
                'name'  => $admin->name,
                'phone' => $admin->phone,
            ] : null,
            'subscription' => $sub ? [
                'id'             => $sub->id,
                'status'         => $sub->status,
                'ends_at'        => $sub->ends_at,
                'trial_ends_at'  => $sub->trial_ends_at,
                'days_remaining' => $sub->daysRemaining(),
                'plan'           => $sub->plan ? [
                    'id'            => $sub->plan->id,
                    'name'          => $sub->plan->name,
                    'price_monthly' => $sub->plan->price_monthly,
                ] : null,
            ] : null,
        ];
    }
}
