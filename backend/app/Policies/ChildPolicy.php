<?php

namespace App\Policies;

use App\Models\Child;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ChildPolicy extends OrganizationResourcePolicy
{
    /**
     * Tarbiyachi bolaning profilini faqat bola hozir o'ziga biriktirilgan guruhda bo'lsa ko'radi
     * (tibbiy ma'lumotlar bilan). Admin huquqlari OrganizationResourcePolicy da o'zgarishsiz.
     */
    public function viewAsTeacher(User $user, Child $child): Response
    {
        $allowed = $user->isTeacher()
            && $child->group_id !== null
            && $user->teacherProfile()
                ->where('is_active', true)
                ->where('organization_id', $child->organization_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $child->group_id))
                ->exists();

        return $allowed ? Response::allow() : Response::deny("Bu bola sizga biriktirilgan guruhda emas.");
    }
}
