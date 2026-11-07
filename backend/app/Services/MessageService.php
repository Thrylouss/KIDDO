<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\Group;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Xabarlar: tarbiyachi → ota-onalar (bitta bola yoki butun guruh). Har bir ota-ona uchun alohida
 * qabul qiluvchi yozuvi va o'qilgan holati. Real-time/Telegram yo'q — ota-ona API orqali o'qiydi.
 */
class MessageService
{
    public function send(User $by, Group $group, string $audience, ?Child $child, ?string $subject, string $body, ?string $ip = null): Message
    {
        // ota-ona profili => shu guruhdagi bolasi (xabar konteksti uchun)
        $recipients = $audience === Message::AUDIENCE_CHILD
            ? $this->parentsOf(collect([$child]))
            : $this->parentsOf(Child::forOrganization($group->organization_id)->where('group_id', $group->id)->active()->get());

        if ($recipients->isEmpty()) {
            throw ValidationException::withMessages([
                'audience' => [$audience === Message::AUDIENCE_CHILD
                    ? "Bu bolaga hali faol ota-ona bog'lanmagan — xabar yuborib bo'lmaydi."
                    : "Guruhdagi bolalarga hali faol ota-ona bog'lanmagan."],
            ]);
        }

        return DB::transaction(function () use ($by, $group, $audience, $child, $subject, $body, $recipients, $ip) {
            $message = Message::create([
                'organization_id' => $group->organization_id,
                'group_id'        => $group->id,
                'child_id'        => $child?->id,
                'sender_id'       => $by->id,
                'audience'        => $audience,
                'subject'         => $subject,
                'body'            => $body,
            ]);

            foreach ($recipients as $parentId => $childId) {
                MessageRecipient::create(['message_id' => $message->id, 'parent_profile_id' => $parentId, 'child_id' => $childId]);
            }

            // Matn log'ga yozilmaydi — faqat metama'lumot
            ActivityLog::record('message.sent', "Xabar yuborildi: {$group->name}", $by->id, $group->organization_id, [
                'message_id' => $message->id, 'audience' => $audience, 'child_id' => $child?->id, 'recipients' => $recipients->count(),
            ], $ip);

            return $message;
        });
    }

    /** Tarbiyachi uchun xabar ko'rinishi (qabul qiluvchilar va o'qilgan holati bilan). */
    public function resource(Message $m): array
    {
        $recipients = $m->recipients;

        return [
            'id'          => $m->id,
            'audience'    => $m->audience,
            'group'       => $m->group ? ['id' => $m->group->id, 'name' => $m->group->name] : null,
            'child'       => $m->child ? ['id' => $m->child->id, 'first_name' => $m->child->first_name, 'last_name' => $m->child->last_name] : null,
            'sender'      => $m->sender?->name,
            'subject'     => $m->subject,
            'body'        => $m->body,
            'created_at'  => $m->created_at?->toIso8601String(),
            'recipients_count' => $recipients->count(),
            'read_count'  => $recipients->whereNotNull('read_at')->count(),
            'recipients'  => $recipients->map(fn (MessageRecipient $r) => [
                'name'    => $r->parentProfile ? trim("{$r->parentProfile->last_name} {$r->parentProfile->first_name}") : null,
                'child'   => $r->child ? trim("{$r->child->last_name} {$r->child->first_name}") : null,
                'read_at' => $r->read_at?->toIso8601String(),
            ])->values(),
        ];
    }

    /**
     * Bolalarning faol ota-onalari (foydalanuvchi faol, bir xil bog'cha).
     *
     * @return Collection<int, int> parent_profile_id => child_id
     */
    private function parentsOf(Collection $children): Collection
    {
        $map = collect();
        foreach ($children as $child) {
            $parents = ParentProfile::forOrganization($child->organization_id)
                ->whereHas('children', fn ($q) => $q->where('children.id', $child->id))
                ->whereHas('user', fn ($q) => $q->where('is_active', true))
                ->pluck('id');
            foreach ($parents as $pid) {
                $map->put($pid, $map->get($pid, $child->id));
            }
        }

        return $map;
    }
}
