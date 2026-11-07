<?php

namespace App\Http\Controllers\Admin;

use App\Http\Requests\GroupPhotoRequest;
use App\Models\Group;
use App\Models\GroupPhoto;
use App\Services\AttendanceService;
use App\Services\GroupPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Rahbar: bog'chadagi barcha guruhlar fotogalereyasi. */
class PhotoController extends AdminController
{
    public function __construct(private GroupPhotoService $photos) {}

    /** GET /v1/admin/photos?group_id= */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Group::class);
        $orgId   = $this->orgId($request);
        $groupId = $request->integer('group_id') ?: null;

        $page = GroupPhoto::where('organization_id', $orgId)
            ->when($groupId, fn ($q) => $q->where('group_id', $groupId))
            ->with(['group:id,name', 'uploader:id,name'])
            ->orderByDesc('taken_on')->orderByDesc('id')
            ->paginate(24);

        return response()->json([
            'data'   => collect($page->items())->map(fn ($p) => $this->photos->resource($p, 'admin'))->values(),
            'meta'   => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'groups' => Group::forOrganization($orgId)->active()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** POST /v1/admin/photos (multipart: group_id, photo, caption?, taken_on?) */
    public function store(GroupPhotoRequest $request): JsonResponse
    {
        $group = Group::forOrganization($this->orgId($request))->findOrFail($request->integer('group_id'));
        Gate::authorize('update', $group);

        $photo = $this->photos->store($group, $request->file('photo'), $request->input('caption'),
            $request->input('taken_on') ?: AttendanceService::today()->toDateString(), $request->user(), $request->ip());

        return response()->json(['message' => "Rasm yuklandi.", 'data' => $this->photos->resource($photo->load('group', 'uploader'), 'admin')], 201);
    }

    /** GET /v1/admin/photos/{id}/file */
    public function file(Request $request, int $id): BinaryFileResponse
    {
        return $this->photos->response(GroupPhoto::where('organization_id', $this->orgId($request))->findOrFail($id));
    }

    /** DELETE /v1/admin/photos/{id} */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $photo = GroupPhoto::where('organization_id', $this->orgId($request))->findOrFail($id);
        Gate::authorize('update', $photo->group);
        $this->photos->delete($photo, $request->user(), $request->ip());

        return response()->json(['message' => "Rasm o'chirildi."]);
    }
}
