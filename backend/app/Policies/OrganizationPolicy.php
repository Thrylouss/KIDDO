<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Super Admin → Bog'chalar moduli: tashkilotlarni boshqarish faqat Super Admin'ga ruxsat.
 * (Marshrutlar ham role:super_admin bilan himoyalangan — policy ikkinchi, mustaqil tekshiruv.)
 * Bog'cha rahbari o'z tashkiloti ma'lumotlarini faqat /admin/* (AdminController::orgId) orqali ko'radi.
 */
class OrganizationPolicy
{
    private function superAdmin(User $user): Response
    {
        return $user->isSuperAdmin() ? Response::allow() : Response::deny("Bu amal faqat Super Admin uchun.");
    }

    public function viewAny(User $user): Response { return $this->superAdmin($user); }

    public function view(User $user, Organization $org): Response { return $this->superAdmin($user); }

    public function create(User $user): Response { return $this->superAdmin($user); }

    public function update(User $user, Organization $org): Response { return $this->superAdmin($user); }

    public function changeStatus(User $user, Organization $org): Response { return $this->superAdmin($user); }

    public function delete(User $user, Organization $org): Response { return $this->superAdmin($user); }

    public function export(User $user): Response { return $this->superAdmin($user); }

    public function import(User $user): Response { return $this->superAdmin($user); }
}
