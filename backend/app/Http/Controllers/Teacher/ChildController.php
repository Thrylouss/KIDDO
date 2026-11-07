<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChildPhotoRequest;
use App\Models\Child;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Services\AttendanceService;
use App\Services\ChildPhotoService;
use App\Services\DailyRecordService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * /v1/teacher/children — faqat tarbiyachiga biriktirilgan guruh(lar)dagi bolalar.
 * Boshqa guruh yoki bog'cha bolasi ID orqali ham ochilmaydi (404).
 */
class ChildController extends Controller
{
    /** Bola tarixi uchun eng uzun davr (kun). */
    const HISTORY_MAX_DAYS = 62;

    public function __construct(private ChildPhotoService $photos) {}

    /** GET /v1/teacher/children?group_id= */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['group_id' => ['nullable', 'integer']]);

        $profile = $this->profile($request);
        $groups  = $this->groups($profile);
        $ids     = isset($data['group_id']) ? $groups->where('id', (int) $data['group_id'])->pluck('id') : $groups->pluck('id');
        abort_if(isset($data['group_id']) && $ids->isEmpty(), 404, 'Guruh topilmadi.');

        $children = Child::forOrganization($profile->organization_id)
            ->whereIn('group_id', $ids)
            ->with(['group:id,name,age_category', 'parentProfiles:id,first_name,last_name,phone'])
            ->orderBy('last_name')->orderBy('first_name')
            ->get();

        return response()->json([
            'groups' => $groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name, 'age_category' => $g->age_category, 'capacity' => $g->capacity])->values(),
            'data'   => $children->map(fn (Child $c) => $this->summary($c))->values(),
        ]);
    }

    /** GET /v1/teacher/children/{id} — profil (tibbiy ma'lumotlar bilan). */
    public function show(Request $request, int $id): JsonResponse
    {
        $child = $this->findChild($request, $id, ['group:id,name,age_category', 'parentProfiles:id,first_name,last_name,phone,relation_type']);

        return response()->json(['data' => $this->summary($child) + [
            'admitted_at'   => $child->admitted_at?->toDateString(),
            'medical_notes' => $child->medical_notes,
            'parents'       => $child->parentProfiles
                ->sortByDesc(fn (ParentProfile $p) => (int) $p->pivot->is_primary)
                ->map(fn (ParentProfile $p) => [
                    'id'            => $p->id,
                    'first_name'    => $p->first_name,
                    'last_name'     => $p->last_name,
                    'phone'         => $p->phone,
                    'relation_type' => $p->pivot->relation_type,
                    'is_primary'    => (bool) $p->pivot->is_primary,
                ])->values(),
        ]]);
    }

    /** GET /v1/teacher/children/{id}/photo — rasm fayli (faqat ruxsat bilan). */
    public function photo(Request $request, int $id): BinaryFileResponse
    {
        return $this->photos->response($this->findChild($request, $id));
    }

    /** POST /v1/teacher/children/{id}/photo — yuklash yoki almashtirish (multipart: photo). */
    public function uploadPhoto(ChildPhotoRequest $request, int $id): JsonResponse
    {
        $child = $this->findChild($request, $id);
        $this->photos->store($child, $request->file('photo'), $request->user(), $request->ip());

        return response()->json(['message' => 'Rasm saqlandi.', 'photo_url' => $this->photoUrl($child->fresh())]);
    }

    /** DELETE /v1/teacher/children/{id}/photo */
    public function deletePhoto(Request $request, int $id): JsonResponse
    {
        $child = $this->findChild($request, $id);
        abort_unless($this->photos->delete($child, $request->user(), $request->ip()), 404, "Rasm topilmadi.");

        return response()->json(['message' => "Rasm o'chirildi.", 'photo_url' => null]);
    }

    /** GET /v1/teacher/children/{id}/history?from=&to= — kunlik tarix (standart: oxirgi 14 kun). */
    public function history(Request $request, int $id, DailyRecordService $daily): JsonResponse
    {
        $data  = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to'   => ['nullable', 'date_format:Y-m-d'],
        ]);
        $child = $this->findChild($request, $id);

        $to   = AttendanceService::parseDate($data['to'] ?? null);
        $from = isset($data['from']) ? AttendanceService::parseDate($data['from']) : $to->subDays(13);
        if ($to->greaterThan(AttendanceService::today()) || $from->greaterThan($to) || $from->diffInDays($to) >= self::HISTORY_MAX_DAYS) {
            throw ValidationException::withMessages([
                'from' => ["Sana oralig'i noto'g'ri (ko'pi bilan " . self::HISTORY_MAX_DAYS . " kun, kelajak sanasisiz)."],
            ]);
        }

        return response()->json($daily->childHistory($child, $from, $to));
    }

    /** Faqat tarbiyachining hozirgi guruh(lar)idagi bola; aks holda 404, keyin Policy. */
    private function findChild(Request $request, int $id, array $with = []): Child
    {
        $profile = $this->profile($request);
        $child   = Child::forOrganization($profile->organization_id)
            ->whereIn('group_id', $this->groups($profile)->pluck('id'))
            ->with($with)
            ->findOrFail($id);

        Gate::authorize('viewAsTeacher', $child);

        return $child;
    }

    private function photoUrl(Child $c): ?string
    {
        $version = $this->photos->version($c);

        return $version ? url("/api/v1/teacher/children/{$c->id}/photo") . "?v={$version}" : null;
    }

    private function summary(Child $c): array
    {
        $primary = $c->parentProfiles->firstWhere('pivot.is_primary', true) ?? $c->parentProfiles->first();

        return [
            'id'          => $c->id,
            'first_name'  => $c->first_name,
            'last_name'   => $c->last_name,
            'middle_name' => $c->middle_name,
            'birth_date'  => $c->birth_date?->toDateString(),
            'gender'      => $c->gender,
            'is_active'   => $c->is_active,
            // Yopiq diskdagi rasm faqat ruxsatli endpoint orqali; yo'q bo'lsa frontend bosh harflarni ko'rsatadi
            'photo_url'   => $this->photoUrl($c),
            'group'       => $c->group ? ['id' => $c->group->id, 'name' => $c->group->name, 'age_category' => $c->group->age_category] : null,
            'contact'     => $primary ? [
                'name'  => trim("{$primary->last_name} {$primary->first_name}"),
                'phone' => $primary->phone,
            ] : null,
        ];
    }

    private function profile(Request $request): TeacherProfile
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)
                                 ->forOrganization((int) $user->organization_id)
                                 ->first();

        abort_if(! $profile, 403, 'Tarbiyachi profili topilmadi.');
        abort_if(! $profile->is_active, 403, 'Tarbiyachi profili faol emas.');

        return $profile;
    }

    private function groups(TeacherProfile $profile): Collection
    {
        return $profile->groups()
                       ->where('groups.organization_id', $profile->organization_id)
                       ->orderByDesc('teacher_group.is_primary')
                       ->orderBy('groups.name')
                       ->get(['groups.id', 'groups.name', 'groups.age_category', 'groups.capacity']);
    }
}
