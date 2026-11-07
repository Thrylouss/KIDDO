<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendMessageRequest;
use App\Models\Child;
use App\Models\Message;
use App\Models\TeacherProfile;
use App\Services\MessageService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** /v1/teacher/messages — biriktirilgan guruh(lar) ota-onalariga xabarlar. */
class MessageController extends Controller
{
    public function __construct(private MessageService $messages) {}

    /** GET /v1/teacher/messages?group_id=&child_id= — yuborilgan xabarlar tarixi (oxirgi 100). */
    public function index(Request $request): JsonResponse
    {
        $data   = $request->validate(['group_id' => ['nullable', 'integer'], 'child_id' => ['nullable', 'integer']]);
        $groups = $this->groups($this->profile($request));
        $ids    = isset($data['group_id']) ? $groups->where('id', (int) $data['group_id'])->pluck('id') : $groups->pluck('id');
        abort_if(isset($data['group_id']) && $ids->isEmpty(), 404, 'Guruh topilmadi.');

        $messages = Message::forOrganization((int) $request->user()->organization_id)
            ->whereIn('group_id', $ids)
            ->when(isset($data['child_id']), fn ($q) => $q->where('child_id', (int) $data['child_id']))
            ->with(['group:id,name', 'child:id,first_name,last_name', 'sender:id,name',
                    'recipients.parentProfile:id,first_name,last_name', 'recipients.child:id,first_name,last_name'])
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json([
            'groups' => $groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values(),
            'data'   => $messages->map(fn (Message $m) => $this->messages->resource($m))->values(),
        ]);
    }

    /** POST /v1/teacher/messages */
    public function store(SendMessageRequest $request): JsonResponse
    {
        $data  = $request->validated();
        $group = $this->groups($this->profile($request))->firstWhere('id', (int) $data['group_id']);
        abort_if(! $group, 404, 'Guruh topilmadi.');
        Gate::authorize('send', [Message::class, $group]);

        $child = null;
        if ($data['audience'] === Message::AUDIENCE_CHILD) {
            $child = Child::forOrganization($group->organization_id)->where('group_id', $group->id)->find((int) $data['child_id']);
            abort_if(! $child, 404, "Bola topilmadi.");
        }

        $message = $this->messages->send($request->user(), $group, $data['audience'], $child, $data['subject'] ?? null, $data['body'], $request->ip());
        $message->load(['group:id,name', 'child:id,first_name,last_name', 'sender:id,name', 'recipients.parentProfile:id,first_name,last_name', 'recipients.child:id,first_name,last_name']);

        return response()->json(['data' => $this->messages->resource($message), 'message' => 'Xabar yuborildi.'], 201);
    }

    private function profile(Request $request): TeacherProfile
    {
        $user    = $request->user();
        $profile = TeacherProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();

        abort_if(! $profile, 403, 'Tarbiyachi profili topilmadi.');
        abort_if(! $profile->is_active, 403, 'Tarbiyachi profili faol emas.');

        return $profile;
    }

    private function groups(TeacherProfile $profile): Collection
    {
        return $profile->groups()
                       ->where('groups.organization_id', $profile->organization_id)
                       ->orderBy('groups.name')
                       ->get(['groups.id', 'groups.organization_id', 'groups.name']);
    }
}
