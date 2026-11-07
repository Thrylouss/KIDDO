<?php

namespace App\Http\Controllers\Parent;

use App\Http\Controllers\Controller;
use App\Models\ParentProfile;
use App\Services\ChildPhotoService;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChildController extends Controller
{
    /**
     * Ota-onaga child_parent orqali bog'langan farzandlar.
     *
     * Profil faqat autentifikatsiyalangan foydalanuvchidan aniqlanadi —
     * so'rovdagi organization_id, child_id yoki group_id hisobga olinmaydi.
     * Bola va profil bir xil bog'chaga tegishli bo'lishi shart.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $profile = ParentProfile::where('user_id', $user->id)
                                ->forOrganization((int) $user->organization_id)
                                ->first();

        if (! $profile) {
            return response()->json(['data' => []]);
        }

        $children = $profile->children()
                            ->where('children.organization_id', $profile->organization_id)
                            ->with([
                                'group:id,name,age_category',
                                // Guruh tarbiyachilari — faqat shu bog'chadagi faol profillar, ism va lavozim (telefon/login yo'q)
                                'group.teacherProfiles' => fn ($q) => $q->where('teacher_profiles.organization_id', $profile->organization_id)
                                    ->where('teacher_profiles.is_active', true)
                                    ->orderByDesc('teacher_group.is_primary')->orderBy('teacher_profiles.last_name')
                                    ->select('teacher_profiles.id', 'teacher_profiles.first_name', 'teacher_profiles.last_name', 'teacher_profiles.position'),
                            ])
                            ->orderBy('children.last_name')
                            ->orderBy('children.first_name')
                            ->get();

        $org = $profile->organization()->first(['id', 'name', 'address', 'phone']);

        return response()->json([
            'data' => $children->map(fn ($child) => [
                'id'            => $child->id,
                'first_name'    => $child->first_name,
                'last_name'     => $child->last_name,
                'birth_date'    => $child->birth_date?->toDateString(),
                'gender'        => $child->gender,
                'is_active'     => $child->is_active,
                'relation_type' => $child->pivot->relation_type,
                'photo_url'     => app(ChildPhotoService::class)->version($child)
                    ? url("/api/v1/parent/children/{$child->id}/photo") . '?v=' . app(ChildPhotoService::class)->version($child)
                    : null,
                'group'         => $child->group ? ['id' => $child->group->id, 'name' => $child->group->name, 'age_category' => $child->group->age_category] : null,
                'organization'  => $org ? ['id' => $org->id, 'name' => $org->name, 'address' => $org->address, 'phone' => $org->phone] : null,
                'teachers'      => ($child->group?->teacherProfiles ?? collect())->map(fn ($t) => [
                    'first_name' => $t->first_name,
                    'last_name'  => $t->last_name,
                    'position'   => $t->position,
                    'is_primary' => (bool) $t->pivot->is_primary,
                ])->values(),
            ])->values(),
        ]);
    }

    /** GET /v1/parent/children/{id}/photo — faqat o'z farzandi. */
    public function photo(Request $request, int $id, ChildPhotoService $photos): BinaryFileResponse
    {
        $user    = $request->user();
        $profile = ParentProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
        $child   = $profile?->children()->where('children.organization_id', $profile->organization_id)->find($id);
        abort_if(! $child, 404, "Ma'lumot topilmadi.");

        return $photos->response($child);
    }
}
