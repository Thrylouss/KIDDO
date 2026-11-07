<?php

namespace App\Policies;

use App\Models\Child;
use App\Models\Group;
use App\Models\User;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\Response;

/**
 * Kundalik yozuvlar (ovqat, uyqu, mashg'ulot) uchun umumiy qoidalar.
 * Rol va muddat davomat bilan bir xil (AttendanceService::isEditable); xabarlar kundalik yozuvlarga moslangan.
 * Tenant (bog'cha) bo'yicha cheklov controllerlarda forOrganization() orqali ham qo'llanadi.
 */
abstract class DailyRecordPolicy
{
    /** Guruh uchun berilgan sanadagi yozuvni yaratish, o'zgartirish yoki o'chirish. */
    public function manage(User $user, Group $group, CarbonImmutable $date): Response
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
            return Response::deny("Kundalik yozuvlarni o'zgartirishga ruxsatingiz yo'q.");
        }

        if ($date->greaterThan(AttendanceService::today())) {
            return Response::deny("Kelajakdagi sana uchun yozuv kiritib bo'lmaydi.");
        }

        if (! AttendanceService::isEditable($user, $date)) {
            return Response::deny("Bu sana uchun yozuvlarni o'zgartirish muddati tugagan.");
        }

        return Response::allow();
    }

    /** Ota-ona faqat o'ziga bog'langan, o'z bog'chasidagi farzand yozuvlarini ko'radi. */
    public function viewChild(User $user, Child $child): bool
    {
        return (new AttendancePolicy())->viewChild($user, $child);
    }
}
