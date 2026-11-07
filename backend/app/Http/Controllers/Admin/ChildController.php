<?php

namespace App\Http\Controllers\Admin;

use App\Http\Requests\ChildPhotoRequest;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use App\Services\ChildPhotoService;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ChildController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Child::class);

        $children = Child::forOrganization($this->orgId($request))
                         ->with('group:id,name')
                         ->orderBy('last_name')
                         ->orderBy('first_name')
                         ->get();

        return response()->json(['data' => $children]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Child::class);
        $orgId = $this->orgId($request);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'birth_date' => ['required', 'date', 'before:today'],
            'gender'     => ['required', Rule::in(['erkak', 'ayol'])],
            'group_id'   => ['nullable', 'integer'],
            'middle_name'   => ['nullable', 'string', 'max:100'],
            'admitted_at'   => ['nullable', 'date', 'before_or_equal:today'],
            'medical_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if (Organization::findOrFail($orgId)->hasReachedPlanLimit('max_children')) {
            return response()->json([
                'message' => "Reja limiti: bolalar soni chegarasiga yetildi.",
            ], 422);
        }

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
        Gate::authorize('view', $child);

        return response()->json(['data' => $child]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $orgId = $this->orgId($request);

        $child = Child::forOrganization($orgId)->findOrFail($id);
        Gate::authorize('update', $child);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name'  => ['sometimes', 'string', 'max:100'],
            'birth_date' => ['sometimes', 'date', 'before:today'],
            'gender'     => ['sometimes', Rule::in(['erkak', 'ayol'])],
            'group_id'   => ['nullable', 'integer'],
            'is_active'  => ['sometimes', 'boolean'],
            'middle_name'   => ['sometimes', 'nullable', 'string', 'max:100'],
            'admitted_at'   => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'medical_notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
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
        Gate::authorize('delete', $child);
        $child->delete();

        return response()->json(['message' => "Bola o'chirildi."]);
    }

    public function attachParent(Request $request, int $id): JsonResponse
    {
        $orgId = $this->orgId($request);
        $child = Child::forOrganization($orgId)->findOrFail($id);
        Gate::authorize('update', $child);

        $data = $request->validate([
            'parent_profile_id' => ['required', 'integer'],
            'relation_type'     => ['required', Rule::in(ParentProfile::RELATION_TYPES)],
            'is_primary'        => ['sometimes', 'boolean'],
        ]);

        // `exists:` qoidasi ishlatilmaydi — boshqa bog'chadagi profil mavjudligi oshkor bo'lmasin
        $parent = ParentProfile::forOrganization($orgId)->find($data['parent_profile_id']);
        if (!$parent) {
            return response()->json(['message' => "Ota-ona topilmadi."], 404);
        }
        Gate::authorize('view', $parent);

        $child->linkParent($parent, $data['relation_type'], (bool) ($data['is_primary'] ?? false));

        return response()->json([
            'data'    => $child->load('parentProfiles:id,first_name,last_name'),
            'message' => "Ota-ona bolaga biriktirildi.",
        ]);
    }

    /** GET /v1/admin/children/{id}/photo */
    public function photo(Request $request, int $id, ChildPhotoService $photos): BinaryFileResponse
    {
        $child = Child::forOrganization($this->orgId($request))->findOrFail($id);
        Gate::authorize('view', $child);

        return $photos->response($child);
    }

    /** POST /v1/admin/children/{id}/photo (multipart: photo) */
    public function uploadPhoto(ChildPhotoRequest $request, int $id, ChildPhotoService $photos): JsonResponse
    {
        $child = Child::forOrganization($this->orgId($request))->findOrFail($id);
        Gate::authorize('update', $child);
        $photos->store($child, $request->file('photo'), $request->user(), $request->ip());

        return response()->json(['message' => 'Rasm saqlandi.']);
    }

    /** DELETE /v1/admin/children/{id}/photo */
    public function deletePhoto(Request $request, int $id, ChildPhotoService $photos): JsonResponse
    {
        $child = Child::forOrganization($this->orgId($request))->findOrFail($id);
        Gate::authorize('update', $child);
        abort_unless($photos->delete($child, $request->user(), $request->ip()), 404, "Rasm topilmadi.");

        return response()->json(['message' => "Rasm o'chirildi."]);
    }

    public function detachParent(Request $request, int $id, int $parentId): JsonResponse
    {
        $orgId  = $this->orgId($request);
        $child  = Child::forOrganization($orgId)->findOrFail($id);
        $parent = ParentProfile::forOrganization($orgId)->findOrFail($parentId);
        Gate::authorize('update', $child);
        Gate::authorize('view', $parent);

        if ($child->parentProfiles()->detach($parent->id) === 0) {
            return response()->json(['message' => "Bog'lanish topilmadi."], 404);
        }

        return response()->json(['message' => "Ota-ona bog'lanishi olib tashlandi."]);
    }
}
