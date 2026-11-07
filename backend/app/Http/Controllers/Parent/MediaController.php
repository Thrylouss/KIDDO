<?php

namespace App\Http\Controllers\Parent;

use App\Http\Controllers\Controller;
use App\Models\Child;
use App\Models\GroupPhoto;
use App\Models\ParentProfile;
use App\Services\ChildPaymentService;
use App\Services\GroupPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Ota-ona (mobil ilova): faqat o'z farzandi — guruh rasmlari va oylik to'lov holati.
 * Bola, guruh va bog'cha ota-ona profilidan aniqlanadi; so'rovdagi boshqa identifikatorlarga ishonilmaydi.
 */
class MediaController extends Controller
{
    /** GET /v1/parent/children/{id}/photos */
    public function photos(Request $request, int $id, GroupPhotoService $photos): JsonResponse
    {
        $child = $this->child($request, $id);
        // Guruhsiz bola — rasm yo'q (where('group_id', null) IS NULL ga aylanib ketmasin)
        if (! $child->group_id) {
            return response()->json(['data' => [], 'meta' => ['current_page' => 1, 'last_page' => 1, 'total' => 0]]);
        }
        $page  = GroupPhoto::where('organization_id', $child->organization_id)->where('group_id', $child->group_id)
            ->with(['group:id,name', 'uploader:id,name'])->orderByDesc('taken_on')->orderByDesc('id')->paginate(24);

        return response()->json([
            'data' => collect($page->items())->map(fn ($p) => $photos->resource($p, 'parent'))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    /** GET /v1/parent/photos/{id}/file — rasm farzandlaridan birining guruhiga tegishli bo'lsa */
    public function photoFile(Request $request, int $id, GroupPhotoService $photos): BinaryFileResponse
    {
        $profile = $this->profile($request);
        $groups  = $profile?->children()->where('children.organization_id', $profile->organization_id)->pluck('children.group_id')->filter();
        abort_if(! $profile || $groups->isEmpty(), 404, "Ma'lumot topilmadi.");

        return $photos->response(GroupPhoto::where('organization_id', $profile->organization_id)->whereIn('group_id', $groups)->findOrFail($id));
    }

    /** GET /v1/parent/children/{id}/payments — oxirgi 6 oy */
    public function payments(Request $request, int $id, ChildPaymentService $payments): JsonResponse
    {
        return response()->json(['data' => $payments->history($this->child($request, $id))]);
    }

    private function profile(Request $request): ?ParentProfile
    {
        $user = $request->user();

        return ParentProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
    }

    private function child(Request $request, int $id): Child
    {
        $profile = $this->profile($request);
        $child   = $profile?->children()->where('children.organization_id', $profile->organization_id)->find($id);
        abort_if(! $child, 404, "Ma'lumot topilmadi.");

        return $child;
    }
}
