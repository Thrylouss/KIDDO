<?php

namespace App\Policies;

use App\Models\EducationalContent;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * KIDDO Kids kontent kutubxonasi: boshqaruv FAQAT o'z bog'chasining rahbarida.
 * Super Admin kontentni ko'rmaydi va boshqarmaydi (impersonatsiyada ham), tarbiyachi — faqat o'z guruhlari
 * uchun ko'radi (teacher controller'idagi so'rovlar bilan cheklanadi, boshqarish huquqi yo'q).
 */
class EducationalContentPolicy
{
    public function manage(User $user): Response
    {
        return $this->result($user->isAdmin() && $user->organization_id !== null);
    }

    public function update(User $user, EducationalContent $content): Response
    {
        return $this->result($user->isAdmin() && $user->organization_id !== null
            && (int) $user->organization_id === (int) $content->organization_id);
    }

    public function delete(User $user, EducationalContent $content): Response
    {
        return $this->update($user, $content);
    }

    private function result(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny("Bu amalni bajarishga ruxsatingiz yo'q.");
    }
}
