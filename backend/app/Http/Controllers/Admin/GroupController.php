<?php

namespace App\Http\Controllers\Admin;

use App\Models\ActivityLog;
use App\Models\Group;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class GroupController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Group::class);

        $groups = Group::forOrganization($this->orgId($request))
                       ->withCount('children')
                       ->withCount('teacherProfiles')
                       ->orderBy('name')
                       ->get();

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Group::class);
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

    public function update(Request $request, int $id): JsonResponse
    {
        $group = Group::forOrganization($this->orgId($request))->findOrFail($id);
        Gate::authorize('update', $group);

        $data = $request->validate([
            'name'         => ['sometimes', 'required', 'string', 'max:100'],
            'age_category' => ['sometimes', 'nullable', 'string', 'max:50'],
            'capacity'     => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // Sig'im guruhdagi bolalar sonidan kam bo'lmasin
        if (isset($data['capacity']) && $data['capacity'] < $group->children()->count()) {
            throw ValidationException::withMessages([
                'capacity' => ["Sig'im guruhdagi bolalar sonidan kam bo'lishi mumkin emas."],
            ]);
        }

        $group->update($data);

        return response()->json([
            'data'    => $group->fresh()->loadCount(['children', 'teacherProfiles']),
            'message' => "Guruh yangilandi.",
        ]);
    }

    /**
     * Guruh yumshoq o'chiriladi. Bolalari bor guruh o'chirilmaydi (bolalar guruhsiz qolmasin);
     * tarbiyachi biriktirishlari olib tashlanadi, davomat tarixi saqlanadi.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $group = Group::forOrganization($this->orgId($request))->findOrFail($id);
        Gate::authorize('delete', $group);

        $result = DB::transaction(function () use ($group, $request) {
            if ($group->children()->exists()) {
                return false;
            }

            $group->teacherProfiles()->detach();
            $group->delete();

            ActivityLog::record(
                'group.deleted',
                "Guruh o'chirildi: {$group->name}",
                $request->user()->id,
                $group->organization_id,
                ['group_id' => $group->id],
                $request->ip()
            );

            return true;
        });

        if (! $result) {
            return response()->json([
                'message' => "Guruhda bolalar bor. Avval ularni boshqa guruhga o'tkazing.",
            ], 422);
        }

        return response()->json(['message' => "Guruh o'chirildi."]);
    }
}
