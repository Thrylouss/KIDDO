<?php

namespace App\Http\Controllers\Admin;

use App\Models\Group;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GroupController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $groups = Group::forOrganization($this->orgId($request))
                       ->withCount('children')
                       ->withCount('teacherProfiles')
                       ->orderBy('name')
                       ->get();

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $this->orgId($request);

        $data = $request->validate([
            'name'         => ['required', 'string', 'max:100'],
            'age_category' => ['nullable', 'string', 'max:50'],
            'capacity'     => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        if (Organization::findOrFail($orgId)->hasReachedPlanLimit('max_groups')) {
            return response()->json([
                'message' => "Reja limiti: guruhlar soni chegarasiga yetildi.",
            ], 422);
        }

        $group = Group::create([
            ...$data,
            'organization_id' => $orgId,
        ]);

        return response()->json([
            'data'    => $group,
            'message' => "Guruh muvaffaqiyatli qo'shildi.",
        ], 201);
    }
}
