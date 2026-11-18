<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\EducationalContent;
use App\Models\Group;
use App\Models\TeacherProfile;
use App\Services\AttendanceService;
use App\Services\Kids\EducationalContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * KIDDO Kids → Ta'lim va hordiq (tarbiyachi). Faqat o'ziga biriktirilgan faol guruhlar; har bir guruh uchun
 * faqat shu guruhga biriktirilgan, faol va guruh yoshiga mos kontent (yosh tekshiruvi backend'da).
 * Kutubxonani boshqarish huquqi yo'q: faqat ko'rish, sevimlilar va foydalanishni qayd etish.
 */
class KidsContentController extends Controller
{
    public function __construct(private EducationalContentService $service) {}

    /** GET /v1/teacher/kids/contents?group_id=&category=&language=&q=&favorites=1&page= */
    public function index(Request $request): JsonResponse
    {
        $groups = $this->groups($request);
        $f      = $request->validate([
            'group_id'  => ['nullable', 'integer'],
            'category'  => ['nullable', Rule::in(EducationalContent::CATEGORIES)],
            'language'  => ['nullable', Rule::in(EducationalContent::LANGUAGES)],
            'q'         => ['nullable', 'string', 'max:100'],
            'favorites' => ['nullable', 'boolean'],
        ]);

        $group = isset($f['group_id']) ? $groups->firstWhere('id', (int) $f['group_id']) : $groups->first();
        abort_if(isset($f['group_id']) && ! $group, 404, "Guruh topilmadi.");

        $groupsOut = $groups->map(fn (Group $g) => ['id' => $g->id, 'name' => $g->name, 'age_category' => $g->age_category, 'age_range' => $g->ageRange()])->values();
        if (! $group) {
            return response()->json(['data' => [], 'meta' => ['current_page' => 1, 'last_page' => 1, 'total' => 0], 'groups' => $groupsOut, 'group_id' => null]);
        }

        $userId = $request->user()->id;
        $page   = $this->visible($group)
            ->when($f['category'] ?? null, fn ($q, $v) => $q->where('category', $v))
            ->when($f['language'] ?? null, fn ($q, $v) => $q->where('language', $v))
            ->when($f['q'] ?? null, fn ($q, $term) => $q->where('title', 'ilike', '%' . addcslashes($term, '%_\\') . '%'))
            ->when($request->boolean('favorites'), fn ($q) => $q->whereHas('favoritedBy', fn ($u) => $u->where('users.id', $userId)))
            ->withExists(['favoritedBy as is_favorite' => fn ($u) => $u->where('users.id', $userId)])
            ->orderByDesc('id')
            ->paginate(24);

        return response()->json([
            'data'     => collect($page->items())->map(fn (EducationalContent $c) => $this->service->resource($c, ['is_favorite' => (bool) $c->is_favorite]))->values(),
            'meta'     => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'groups'   => $groupsOut,
            'group_id' => $group->id,
        ]);
    }

    /** GET /v1/teacher/kids/contents/{id}?group_id= */
    public function show(Request $request, int $id): JsonResponse
    {
        [$content] = $this->findVisible($request, $id);

        return response()->json(['data' => $this->service->resource($content, [
            'is_favorite' => $content->favoritedBy()->where('users.id', $request->user()->id)->exists(),
        ])]);
    }

    /** PUT /v1/teacher/kids/contents/{id}/favorite {favorite: bool} */
    public function favorite(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['favorite' => ['required', 'boolean']]);
        [$content] = $this->findVisible($request, $id);
        $on = $this->service->toggleFavorite($content, $request->user(), (bool) $data['favorite']);

        return response()->json(['is_favorite' => $on]);
    }

    /** POST /v1/teacher/kids/contents/{id}/usage {group_id, used_on?, note?} */
    public function logUsage(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'group_id' => ['required', 'integer'],
            'used_on'  => ['nullable', 'date', 'before_or_equal:today', 'after_or_equal:' . now()->subDays(30)->toDateString()],
            'note'     => ['nullable', 'string', 'max:500', 'not_regex:/<[^>]*>/'],
        ], [
            'used_on.before_or_equal' => "Kelajakdagi sana tanlanmasin.",
            'used_on.after_or_equal'  => "Sana so'nggi 30 kun ichida bo'lsin.",
            'note.max'                => "Izoh 500 belgidan oshmasin.",
            'note.not_regex'          => "Izohda HTML teglari bo'lmasin.",
        ]);
        [$content, $group] = $this->findVisible($request, $id, (int) $data['group_id']);

        $log = $this->service->logUsage($content, $group, $request->user(),
            $data['used_on'] ?? AttendanceService::today()->toDateString(), $data['note'] ?? null);

        return response()->json(['message' => "Qayd etildi.", 'data' => ['id' => $log->id, 'used_on' => $log->used_on->toDateString()]], 201);
    }

    // ── Helpers ────────────────────────────────────────────────────

    private function visible(Group $group)
    {
        return EducationalContent::forOrganization($group->organization_id)->active()->visibleForGroup($group);
    }

    /**
     * Kontent tarbiyachining guruhlaridan biri uchun ko'rinadigan bo'lishi shart (aks holda 404 — mavjudligi oshkor qilinmaydi).
     *
     * @return array{0: EducationalContent, 1: Group}
     */
    private function findVisible(Request $request, int $id, ?int $groupId = null): array
    {
        $groups = $this->groups($request);
        $groupId ??= $request->integer('group_id') ?: null;
        if ($groupId !== null) {
            $groups = $groups->where('id', $groupId);
            abort_if($groups->isEmpty(), 404, "Guruh topilmadi.");
        }

        foreach ($groups as $group) {
            if ($content = $this->visible($group)->find($id)) {
                return [$content, $group];
            }
        }
        abort(404, "Material topilmadi.");
    }

    /** @return Collection<int, Group> */
    private function groups(Request $request): Collection
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
        abort_if(! $profile || ! $profile->is_active, 403, 'Tarbiyachi profili topilmadi.');

        return $profile->groups()->where('groups.organization_id', $profile->organization_id)->where('groups.is_active', true)
            ->orderBy('groups.name')->get(['groups.id', 'groups.name', 'groups.age_category', 'groups.organization_id']);
    }
}
