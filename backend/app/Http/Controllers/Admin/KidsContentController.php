<?php

namespace App\Http\Controllers\Admin;

use App\Http\Requests\EducationalContentRequest;
use App\Models\EducationalContent;
use App\Models\EducationalContentUsageLog;
use App\Models\Group;
use App\Services\Kids\ContentSuggestionService;
use App\Services\Kids\EducationalContentService;
use App\Services\Kids\YouTubeMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** KIDDO Kids → Kontent kutubxonasi (faqat bog'cha rahbari; Super Admin bu yerga kira olmaydi — route: role:admin). */
class KidsContentController extends AdminController
{
    public function __construct(
        private EducationalContentService $service,
        private YouTubeMetadataService $meta,
        private ContentSuggestionService $suggest,
    ) {}

    /** GET /v1/admin/kids/contents?q=&language=&category=&status=&group_id=&page= */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('manage', EducationalContent::class);
        $orgId = $this->orgId($request);
        $f     = $request->validate([
            'q'        => ['nullable', 'string', 'max:100'],
            'language' => ['nullable', Rule::in(EducationalContent::LANGUAGES)],
            'category' => ['nullable', Rule::in(EducationalContent::CATEGORIES)],
            'status'   => ['nullable', Rule::in(EducationalContent::STATUSES)],
            'group_id' => ['nullable', 'integer'],
        ]);

        $page = EducationalContent::forOrganization($orgId)
            ->when($f['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w->where('title', 'ilike', '%' . addcslashes($term, '%_\\') . '%')
                ->orWhere('description', 'ilike', '%' . addcslashes($term, '%_\\') . '%')))
            ->when($f['language'] ?? null, fn ($q, $v) => $q->where('language', $v))
            ->when($f['category'] ?? null, fn ($q, $v) => $q->where('category', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['group_id'] ?? null, fn ($q, $v) => $q->whereHas('groups', fn ($g) => $g->where('groups.id', $v)))
            ->with('groups:id,name')
            ->withCount('usageLogs')
            ->orderByDesc('id')
            ->paginate(24);

        return response()->json([
            'data'   => collect($page->items())->map(fn (EducationalContent $c) => $this->service->resource($c, [
                'groups'      => $c->groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values(),
                'usage_count' => $c->usage_logs_count,
            ]))->values(),
            'meta'   => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
                'counts'       => EducationalContent::forOrganization($orgId)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status'),
                'youtube_api'  => (bool) config('kiddo.youtube.api_key'),
            ],
            'groups' => $this->groups($orgId),
        ]);
    }

    /** POST /v1/admin/kids/contents/preview {youtube_url} — video ID, metama'lumot va dastlabki tavsiyalar. */
    public function preview(Request $request): JsonResponse
    {
        Gate::authorize('manage', EducationalContent::class);
        $orgId   = $this->orgId($request);
        $request->validate(['youtube_url' => ['required', 'string', 'max:500']], ['youtube_url.required' => "YouTube havolasini kiriting."]);
        $videoId = $this->service->videoId($request->input('youtube_url'));
        $meta    = $this->meta->fetch($videoId);
        $groups  = Group::forOrganization($orgId)->active()->orderBy('name')->get();

        return response()->json([
            'video_id'    => $videoId,
            'metadata'    => $meta,
            'suggestions' => $this->suggest->suggest($meta, $groups),
            'duplicate'   => EducationalContent::forOrganization($orgId)->where('youtube_video_id', $videoId)->exists(),
            'embed_url'   => \App\Services\Kids\YouTubeVideo::embedUrl($videoId),
            'watch_url'   => \App\Services\Kids\YouTubeVideo::watchUrl($videoId),
        ]);
    }

    public function store(EducationalContentRequest $request): JsonResponse
    {
        Gate::authorize('manage', EducationalContent::class);
        $content = $this->service->create($this->orgId($request), $request->validated(), $request->user(), $request->ip());

        return response()->json(['message' => "Kontent qo'shildi.", 'data' => $this->detail($content)], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $content = $this->find($request, $id);
        Gate::authorize('update', $content);

        return response()->json(['data' => $this->detail($content)]);
    }

    public function update(EducationalContentRequest $request, int $id): JsonResponse
    {
        $content = $this->find($request, $id);
        Gate::authorize('update', $content);
        $content = $this->service->update($content, $request->validated(), $request->user(), $request->ip());

        return response()->json(['message' => "Saqlandi.", 'data' => $this->detail($content)]);
    }

    /** PATCH /v1/admin/kids/contents/{id}/status {status: active|hidden} */
    public function status(Request $request, int $id): JsonResponse
    {
        $content = $this->find($request, $id);
        Gate::authorize('update', $content);
        $data = $request->validate(['status' => ['required', Rule::in(EducationalContent::STATUSES)]], ['status.*' => "Noto'g'ri holat."]);
        $content = $this->service->setStatus($content, $data['status'], $request->user(), $request->ip());

        return response()->json(['message' => "Holat o'zgartirildi.", 'data' => $this->detail($content)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $content = $this->find($request, $id);
        Gate::authorize('delete', $content);
        $this->service->delete($content, $request->user(), $request->ip());

        return response()->json(['message' => "Kontent o'chirildi."]);
    }

    /** GET /v1/admin/kids/usage?content_id=&group_id=&from=&to= — tarbiyachilar foydalangan materiallar tarixi. */
    public function usage(Request $request): JsonResponse
    {
        Gate::authorize('manage', EducationalContent::class);
        $orgId = $this->orgId($request);
        $f     = $request->validate([
            'content_id' => ['nullable', 'integer'],
            'group_id'   => ['nullable', 'integer'],
            'from'       => ['nullable', 'date'],
            'to'         => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $page = EducationalContentUsageLog::where('organization_id', $orgId)
            ->when($f['content_id'] ?? null, fn ($q, $v) => $q->where('educational_content_id', $v))
            ->when($f['group_id'] ?? null, fn ($q, $v) => $q->where('group_id', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('used_on', '>=', $v))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('used_on', '<=', $v))
            ->with(['content:id,title,youtube_video_id,deleted_at', 'group:id,name', 'user:id,name'])
            ->orderByDesc('used_on')->orderByDesc('id')
            ->paginate(30);

        return response()->json([
            'data' => collect($page->items())->map(fn (EducationalContentUsageLog $l) => [
                'id'         => $l->id,
                'used_on'    => $l->used_on?->toDateString(),
                'note'       => $l->note,
                'content'    => $l->content ? ['id' => $l->content->id, 'title' => $l->content->title, 'deleted' => $l->content->trashed()] : null,
                'group'      => $l->group ? ['id' => $l->group->id, 'name' => $l->group->name] : null,
                'teacher'    => $l->user?->name,
                'created_at' => $l->created_at,
            ])->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    private function find(Request $request, int $id): EducationalContent
    {
        return EducationalContent::forOrganization($this->orgId($request))->findOrFail($id);
    }

    private function detail(EducationalContent $c): array
    {
        $c->loadMissing('groups:id,name');

        return $this->service->resource($c, ['groups' => $c->groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values()]);
    }

    private function groups(int $orgId): array
    {
        return Group::forOrganization($orgId)->active()->orderBy('name')->get(['id', 'name', 'age_category'])
            ->map(fn (Group $g) => ['id' => $g->id, 'name' => $g->name, 'age_category' => $g->age_category, 'age_range' => $g->ageRange()])
            ->values()->all();
    }
}
