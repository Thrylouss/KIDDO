<?php

namespace App\Http\Controllers\Parent;

use App\Http\Controllers\Controller;
use App\Models\MessageRecipient;
use App\Models\ParentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** /v1/parent/messages — faqat o'ziga yuborilgan xabarlar (mobil ilova va web token). */
class MessageController extends Controller
{
    /** GET /v1/parent/messages */
    public function index(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $items   = $profile
            ? MessageRecipient::where('parent_profile_id', $profile->id)
                ->whereHas('message', fn ($q) => $q->where('organization_id', $profile->organization_id))
                ->with(['message.sender:id,name', 'child:id,first_name,last_name'])
                ->latest('id')->limit(100)->get()
            : collect();

        return response()->json([
            // Ro'yxat oxirgi 100 ta bilan cheklangan, o'qilmaganlar soni esa to'liq hisoblanadi
            'unread' => $profile
                ? MessageRecipient::where('parent_profile_id', $profile->id)->whereNull('read_at')
                    ->whereHas('message', fn ($q) => $q->where('organization_id', $profile->organization_id))->count()
                : 0,
            'data'   => $items->map(fn (MessageRecipient $r) => [
                'id'         => $r->id,
                'subject'    => $r->message->subject,
                'body'       => $r->message->body,
                'sender'     => $r->message->sender?->name,
                'child'      => $r->child ? ['id' => $r->child->id, 'first_name' => $r->child->first_name, 'last_name' => $r->child->last_name] : null,
                'created_at' => $r->message->created_at?->toIso8601String(),
                'read_at'    => $r->read_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /** PATCH /v1/parent/messages/{id}/read — faqat o'z qabul yozuvi; boshqasi 404. */
    public function read(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $item    = $profile ? MessageRecipient::where('parent_profile_id', $profile->id)->find($id) : null;
        abort_if(! $item, 404, "Ma'lumot topilmadi.");

        if (! $item->read_at) {
            $item->update(['read_at' => now()]);
        }

        return response()->json(['message' => "O'qildi deb belgilandi.", 'read_at' => $item->read_at->toIso8601String()]);
    }

    private function profile(Request $request): ?ParentProfile
    {
        $user = $request->user();

        return ParentProfile::where('user_id', $user->id)->forOrganization((int) $user->organization_id)->first();
    }
}
