<?php

namespace App\Http\Controllers\Admin;

use App\Models\Child;
use App\Models\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChildController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $children = Child::forOrganization($this->orgId($request))
                         ->with('group:id,name')
                         ->orderBy('last_name')
                         ->orderBy('first_name')
                         ->get();

        return response()->json(['data' => $children]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $this->orgId($request);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'birth_date' => ['required', 'date', 'before:today'],
            'gender'     => ['required', Rule::in(['erkak', 'ayol'])],
            'group_id'   => ['nullable', 'integer'],
        ]);

        if (!empty($data['group_id'])) {
            $exists = Group::forOrganization($orgId)->where('id', $data['group_id'])->exists();
            if (!$exists) {
                return response()->json(['message' => "Guruh topilmadi."], 404);
            }
        }

        $child = Child::create([
            ...$data,
            'organization_id' => $orgId,
        ]);

        return response()->json([
            'data'    => $child->load('group:id,name'),
            'message' => "Bola muvaffaqiyatli qo'shildi.",
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $child = Child::forOrganization($this->orgId($request))
                      ->with('group:id,name')
                      ->findOrFail($id);

        return response()->json(['data' => $child]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $orgId = $this->orgId($request);

        $child = Child::forOrganization($orgId)->findOrFail($id);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name'  => ['sometimes', 'string', 'max:100'],
            'birth_date' => ['sometimes', 'date', 'before:today'],
            'gender'     => ['sometimes', Rule::in(['erkak', 'ayol'])],
            'group_id'   => ['nullable', 'integer'],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('group_id', $data) && $data['group_id'] !== null) {
            $exists = Group::forOrganization($orgId)->where('id', $data['group_id'])->exists();
            if (!$exists) {
                return response()->json(['message' => "Guruh topilmadi."], 404);
            }
        }

        $child->update($data);

        return response()->json([
            'data'    => $child->fresh('group:id,name'),
            'message' => "Ma'lumotlar yangilandi.",
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $child = Child::forOrganization($this->orgId($request))->findOrFail($id);
        $child->delete();

        return response()->json(['message' => "Bola o'chirildi."]);
    }
}
