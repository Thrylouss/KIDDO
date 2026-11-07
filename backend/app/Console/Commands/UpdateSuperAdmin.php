<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\ReadsSecretPassword;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Super Admin login (telefon) va/yoki parolini o'zgartirish. Parol o'zgarsa barcha sessiyalar bekor qilinadi.
 *
 *   php artisan kiddo:super-admin:update +998XXXXXXXXX --new-phone=+998YYYYYYYYY
 *   php artisan kiddo:super-admin:update +998XXXXXXXXX --password-stdin < yangi-parol-fayli
 */
class UpdateSuperAdmin extends Command
{
    use ReadsSecretPassword;

    protected $signature = 'kiddo:super-admin:update
        {phone : Hozirgi login (telefon raqami)}
        {--new-phone= : Yangi login (+998XXXXXXXXX)}
        {--password : Yangi parolni yashirin so\'rov orqali kiritish}
        {--password-stdin : Yangi parolni standart kirishdan (birinchi qator) o\'qish}
        {--force : Production muhitida tasdiqsiz bajarish}';

    protected $description = 'Super Admin login va/yoki parolini o\'zgartirish';

    public function handle(): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('Production muhitida --force bilan ishga tushiring.');
            return Command::FAILURE;
        }

        $user = User::where('role', User::ROLE_SUPER_ADMIN)->where('phone', (string) $this->argument('phone'))->first();
        if (! $user) {
            $this->error('Bu login bilan Super Admin topilmadi.');
            return Command::FAILURE;
        }

        $newPhone       = $this->option('new-phone');
        $changePassword = $this->option('password') || $this->option('password-stdin');
        if ($newPhone === null && ! $changePassword) {
            $this->error("O'zgartirish ko'rsatilmagan: --new-phone va/yoki --password / --password-stdin.");
            return Command::FAILURE;
        }

        $changes = [];
        if ($newPhone !== null) {
            if (! $this->validPhone($newPhone)) {
                return Command::FAILURE;
            }
            if (User::where('phone', $newPhone)->whereKeyNot($user->id)->exists()) {
                $this->error('Bu telefon raqami boshqa foydalanuvchiga tegishli.');
                return Command::FAILURE;
            }
            $changes['phone'] = $newPhone;
        }

        if ($changePassword) {
            $password = $this->readPassword();
            if ($password === null) {
                return Command::FAILURE;
            }
            $changes['password'] = $password; // 'hashed' cast
        }

        $user->update($changes);

        if (isset($changes['password'])) {
            // Eski sessiyalar yangi parol bilan yashab qolmasin
            $user->tokens()->delete();
        }

        ActivityLog::record('super_admin.updated', "Super Admin ma'lumotlari o'zgartirildi (konsol): {$user->name}", null, null,
            ['user_id' => $user->id, 'fields' => array_keys($changes)]);

        $this->info("Yangilandi: #{$user->id}, login {$user->phone}" . (isset($changes['password']) ? ', parol o\'zgardi, sessiyalar bekor qilindi.' : '.'));

        return Command::SUCCESS;
    }
}
