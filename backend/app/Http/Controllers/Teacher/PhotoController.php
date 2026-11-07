<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\GroupPhotoRequest;
use App\Models\GroupPhoto;
use App\Models\TeacherProfile;
use App\Services\AttendanceService;
use App\Services\GroupPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Tarbiyachi: faqat o'ziga biriktirilgan guruhlar fotogalereyasi; o'chirish — faqat o'zi yuklagan rasm. */
class PhotoController extends Controller
{
    public function __construct(private GroupPhotoService $photos) {}

    public function index(Request $request): JsonResponse
    {
        $groups  = $this->groups($request);
        $groupId = $request->integer('group_id') ?: null;
        abort_if($groupId && ! $groups->contains('id', $groupId), 404, "Guruh topilmadi.");

        $page = GroupPhoto::whereIn('group_id', $groupId ? [$groupId] : $groups->pluck('id'))
            ->with(['group:id,name', 'uploader:id,name'])
            ->orderByDesc('taken_on')->orderByDesc('id')
            ->paginate(24);

        return response()->json([
            'data'   => collect($page->items())->map(fn ($p) => $this->photos->resource($p, 'teacher') + ['can_delete' => $p->uploaded_by === $request->user()->id])->values(),
            'meta'   => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'groups' => $groups->values(),
        ]);
    }

    public function store(GroupPhotoRequest $request): JsonResponse
    {
        $group = $this->profile($request)->groups()->where('groups.organization_id', $request->user()->organization_id)
            ->find($request->integer('group_id'));
        abort_if(! $group, 404, "Guruh topilmadi.");

        $photo = $this->photos->store($group, $request->file('photo'), $request->input('caption'),
            $request->input('taken_on') ?: AttendanceService::today()->toDateString(), $request->user(), $request->ip());

        return response()->json(['message' => "Rasm yuklandi.", 'data' => $this->photos->resource($photo->load('group', 'uploader'), 'teacher') + ['can_delete' => true]], 201);
    }

    public function file(Request $request, int $id): BinaryFileResponse
    {
        return $this->photos->response($this->findPhoto($request, $id));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $photo = $this->findPhoto($request, $id);
        abort_unless($photo->uploaded_by === $request->user()->id, 403, "Faqat o'zingiz yuklagan rasmni o'chira olasiz.");
        $this->photos->delete($photo, $request->user(), $request->ip());

        return response()->json(['message' => "Rasm o'chirildi."]);
    }

    private function findPhoto(Request $request, int $id): GroupPhoto
    {
        return GroupPhoto::whereIn('group_id', $this->groups($request)->pluck('id'))->findOrFail($id);
    }

    private function profile(Request $request): TeacherProfile
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
        abort_if(! $profile || ! $profile->is_active, 403, 'Tarbiyachi profili topilmadi.');

        return $profile;
    }

    private function groups(Request $request)
    {
        $profile = $this->profile($request);

        return $profile->groups()->where('groups.organization_id', $profile->organization_id)
            ->orderBy('groups.name')->get(['groups.id', 'groups.name']);
    }
}
