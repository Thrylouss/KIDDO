<?php

namespace App\Http\Controllers\Admin;

use App\Models\Group;
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
        $data = $request->validate([
            'name'         => ['required', 'string', 'max:100'],
            'age_category' => ['nullable', 'string', 'max:50'],
            'capacity'     => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $group = Group::create([
            ...$data,
            'organization_id' => $this->orgId($request),
        ]);

        return response()->json([
            'data'    => $group,
            'message' => "Guruh muvaffaqiyatli qo'shildi.",
        ], 201);
    }
}
