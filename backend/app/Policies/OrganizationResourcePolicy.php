<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

/**
 * Bog'chaga tegishli resurslar (bola, guruh, ota-ona, tarbiyachi) uchun umumiy qoidalar.
 *
 * - Bog'cha admini faqat o'z bog'chasidagi yozuvlarni boshqaradi.
 * - Super-admin faqat impersonatsiya orqali ishlaydi: bog'cha X-Impersonated-Org
 *   sarlavhasidan AdminController::orgId() da aniqlanadi va yozuv shu bog'cha
 *   doirasida (forOrganization) topilgan bo'ladi.
 * - Tarbiyachi va ota-ona bu resurslarni admin API orqali boshqara olmaydi.
 */
abstract class OrganizationResourcePolicy
{
    public function viewAny(User $user): Response
    {
        // Bog'chasiz admin bo'sh ro'yxat oladi (so'rovlar forOrganization bilan cheklanadi)
        return $this->result($user->isAdmin() || $user->isSuperAdmin());
    }

    public function create(User $user): Response
    {
        return $this->result($user->isSuperAdmin() || ($user->isAdmin() && $user->organization_id !== null));
    }

    public function view(User $user, Model $model): Response
    {
        return $this->result($this->sameOrganization($user, $model));
    }

    public function update(User $user, Model $model): Response
    {
        return $this->result($this->sameOrganization($user, $model));
    }

    public function delete(User $user, Model $model): Response
    {
        return $this->result($this->sameOrganization($user, $model));
    }

    protected function result(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny("Bu amalni bajarishga ruxsatingiz yo'q.");
    }

    protected function sameOrganization(User $user, Model $model): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->isAdmin()
            && $user->organization_id !== null
            && (int) $user->organization_id === (int) $model->organization_id;
    }
}
