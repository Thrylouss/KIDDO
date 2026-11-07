<?php

namespace App\Policies;

use App\Models\Group;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class MessagePolicy
{
    /**
     * Guruh ota-onalariga xabar yuborish — guruhga biriktirilgan faol tarbiyachi yoki shu bog'cha admini.
     * Super-admin faqat impersonatsiya orqali (guruh AdminController::orgId() doirasida topilgan).
     */
    public function send(User $user, Group $group): Response
    {
        if ($user->isSuperAdmin()) {
            return Response::allow();
        }

        if ($user->isAdmin()) {
            return $user->organization_id !== null && (int) $user->organization_id === (int) $group->organization_id
                ? Response::allow()
                : Response::deny("Bu guruh sizning bog'changizga tegishli emas.");
        }

        if (! $user->isTeacher()) {
            return Response::deny("Xabar yuborishga ruxsatingiz yo'q.");
        }

        $assigned = $user->teacherProfile()
            ->where('is_active', true)
            ->where('organization_id', $group->organization_id)
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->exists();

        return $assigned ? Response::allow() : Response::deny("Bu guruh sizga biriktirilmagan.");
    }
}
