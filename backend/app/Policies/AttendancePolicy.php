<?php

namespace App\Policies;

use App\Models\Child;
use App\Models\Group;
use App\Models\ParentProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\Response;

/**
 * Davomat ruxsatlari. Tenant (bog'cha) bo'yicha cheklov controllerlarda
 * forOrganization() orqali qo'llanadi; bu yerda rol va sana qoidalari.
 */
class AttendancePolicy
{
    /** Guruh uchun davomatni yozish yoki tuzatish. */
    public function mark(User $user, Group $group, CarbonImmutable $date): Response
    {
        if ($user->isTeacher()) {
            $assigned = $user->teacherProfile()
                ->where('is_active', true)
                ->where('organization_id', $group->organization_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
                ->exists();

            if (! $assigned) {
                return Response::deny("Bu guruh sizga biriktirilmagan.");
            }
        } elseif ($user->isAdmin()) {
            if ($user->organization_id !== $group->organization_id) {
                return Response::deny("Bu guruh sizning bog'changizga tegishli emas.");
            }
        } elseif (! $user->isSuperAdmin()) {
            // Super-admin faqat X-Impersonated-Org orqali (bog'cha AdminController::orgId() da aniqlanadi)
            return Response::deny("Davomatni o'zgartirishga ruxsatingiz yo'q.");
        }

        if ($date->greaterThan(AttendanceService::today())) {
            return Response::deny("Kelajakdagi sana uchun davomat belgilab bo'lmaydi.");
        }

        if (! AttendanceService::isEditable($user, $date)) {
            return Response::deny("Bu sana uchun davomatni o'zgartirish muddati tugagan.");
        }

        return Response::allow();
    }

    /**
     * Guruhning davomat tarixi va hisobotini ko'rish/yuklab olish (muddat cheklovisiz, faqat o'qish).
     * Tarbiyachi — faqat o'ziga biriktirilgan guruh; admin — o'z bog'chasi; super-admin — impersonatsiya orqali.
     */
    public function viewGroup(User $user, Group $group): Response
    {
        if ($user->isTeacher()) {
            $assigned = $user->teacherProfile()
                ->where('is_active', true)
                ->where('organization_id', $group->organization_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
                ->exists();

            return $assigned ? Response::allow() : Response::deny("Bu guruh sizga biriktirilmagan.");
        }

        if ($user->isAdmin()) {
            return $user->organization_id === $group->organization_id
                ? Response::allow()
                : Response::deny("Bu guruh sizning bog'changizga tegishli emas.");
        }

        return $user->isSuperAdmin() ? Response::allow() : Response::deny("Davomat hisobotini ko'rishga ruxsatingiz yo'q.");
    }

    /** Ota-ona faqat o'ziga bog'langan, o'z bog'chasidagi farzand davomatini ko'radi. */
    public function viewChild(User $user, Child $child): bool
    {
        if (! $user->isParent()) {
            return false;
        }

        return ParentProfile::where('user_id', $user->id)
            ->where('organization_id', $child->organization_id)
            ->where('organization_id', $user->organization_id)
            ->whereHas('children', fn ($q) => $q->where('children.id', $child->id))
            ->exists();
    }
}
