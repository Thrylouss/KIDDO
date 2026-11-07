<?php

namespace App\Http\Controllers\Admin;

use App\Http\Requests\SendMessageRequest;
use App\Models\Child;
use App\Models\Group;
use App\Models\Message;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** /v1/admin/messages — bog'cha rahbari o'z bog'chasining istalgan guruhi ota-onalariga xabar yuboradi. */
class MessageController extends AdminController
{
    private const WITH = ['group:id,name', 'child:id,first_name,last_name', 'sender:id,name',
                          'recipients.parentProfile:id,first_name,last_name', 'recipients.child:id,first_name,last_name'];

    public function __construct(private MessageService $messages) {}

    /** GET /v1/admin/messages?group_id= — bog'cha bo'yicha yuborilgan xabarlar tarixi (oxirgi 100). */
    public function index(Request $request): JsonResponse
    {
        $data   = $request->validate(['group_id' => ['nullable', 'integer']]);
        $orgId  = $this->orgId($request);
        $groups = Group::forOrganization($orgId)->active()->orderBy('name')->get(['id', 'organization_id', 'name']);

        $messages = Message::forOrganization($orgId)
            ->when(isset($data['group_id']), fn ($q) => $q->where('group_id', (int) $data['group_id']))
            ->with(self::WITH)
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json([
            'groups' => $groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values(),
            'data'   => $messages->map(fn (Message $m) => $this->messages->resource($m))->values(),
        ]);
    }

    /** POST /v1/admin/messages */
    public function store(SendMessageRequest $request): JsonResponse
    {
        $data  = $request->validated();
        $group = Group::forOrganization($this->orgId($request))->active()->find((int) $data['group_id']);
        abort_if(! $group, 404, 'Guruh topilmadi.');
        Gate::authorize('send', [Message::class, $group]);

        $child = null;
        if ($data['audience'] === Message::AUDIENCE_CHILD) {
            $child = Child::forOrganization($group->organization_id)->where('group_id', $group->id)->find((int) $data['child_id']);
            abort_if(! $child, 404, 'Bola topilmadi.');
        }

        $message = $this->messages->send($request->user(), $group, $data['audience'], $child, $data['subject'] ?? null, $data['body'], $request->ip());
        $message->load(self::WITH);

        return response()->json(['data' => $this->messages->resource($message), 'message' => 'Xabar yuborildi.'], 201);
    }
}
