<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlanController extends SuperAdminController
{
    public function index(): JsonResponse
    {
        $plans = Plan::withCount('subscriptions')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn($p) => $this->formatPlan($p));

        return response()->json(['data' => $plans]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'slug'          => 'nullable|string|unique:plans,slug',
            'description'   => 'nullable|string',
            'price_monthly' => 'required|numeric|min:0',
            'price_yearly'  => 'nullable|numeric|min:0',
            'currency'      => 'nullable|string|max:10',
            'trial_days'    => 'nullable|integer|min:0',
            'max_children'  => 'nullable|integer|min:1',
            'max_teachers'  => 'nullable|integer|min:1',
            'max_groups'    => 'nullable|integer|min:1',
            'features'      => 'nullable|array',
            'is_active'     => 'nullable|boolean',
            'sort_order'    => 'nullable|integer|min:0',
        ]);

        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $plan = Plan::create($data);
        $plan->loadCount('subscriptions');

        return response()->json(['data' => $this->formatPlan($plan)], 201);
    }

    public function show(int $id): JsonResponse
    {
        $plan = Plan::withCount('subscriptions')->findOrFail($id);
        return response()->json(['data' => $this->formatPlan($plan)]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $data = $request->validate([
            'name'          => 'sometimes|string|max:255',
            'slug'          => ['nullable', 'string', Rule::unique('plans', 'slug')->ignore($plan->id)],
            'description'   => 'nullable|string',
            'price_monthly' => 'sometimes|numeric|min:0',
            'price_yearly'  => 'nullable|numeric|min:0',
            'currency'      => 'nullable|string|max:10',
            'trial_days'    => 'nullable|integer|min:0',
            'max_children'  => 'nullable|integer|min:1',
            'max_teachers'  => 'nullable|integer|min:1',
            'max_groups'    => 'nullable|integer|min:1',
            'features'      => 'nullable|array',
            'is_active'     => 'nullable|boolean',
            'sort_order'    => 'nullable|integer|min:0',
        ]);

        $plan->update($data);
        $plan->loadCount('subscriptions');

        return response()->json(['data' => $this->formatPlan($plan)]);
    }

    public function activate(int $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);
        $plan->update(['is_active' => true]);
        return response()->json(['message' => 'Tarif faollashtirildi.']);
    }

    public function deactivate(int $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $hasActive = Subscription::where('plan_id', $plan->id)
            ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->exists();

        if ($hasActive) {
            return response()->json([
                'message' => "Ushbu tarif faol obunalarda ishlatilmoqda",
            ], 422);
        }

        $plan->update(['is_active' => false]);

        return response()->json(['message' => 'Tarif faolsizlantirildi.']);
    }

    private function formatPlan(Plan $plan): array
    {
        return [
            'id'                  => $plan->id,
            'name'                => $plan->name,
            'slug'                => $plan->slug,
            'description'         => $plan->description,
            'price_monthly'       => $plan->price_monthly,
            'price_yearly'        => $plan->price_yearly,
            'currency'            => $plan->currency,
            'trial_days'          => $plan->trial_days,
            'max_children'        => $plan->max_children,
            'max_teachers'        => $plan->max_teachers,
            'max_groups'          => $plan->max_groups,
            'features'            => $plan->features ?? [],
            'is_active'           => $plan->is_active,
            'sort_order'          => $plan->sort_order,
            'subscriptions_count' => $plan->subscriptions_count ?? 0,
        ];
    }
}
