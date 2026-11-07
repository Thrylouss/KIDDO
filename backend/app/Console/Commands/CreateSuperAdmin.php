<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\ReadsSecretPassword;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Birinchi Super Admin'ni bir martalik yaratish. Tizimda Super Admin bo'lsa — rad etadi.
 * Parol buyruq argumentida emas (shell tarixida qolmasligi uchun): --password-stdin yoki yashirin so'rov.
 * Parol hech qachon ekranga yoki logga chiqarilmaydi.
 *
 *   php artisan kiddo:super-admin:create +998XXXXXXXXX --name="..." --password-stdin < parol-fayli
 */
class CreateSuperAdmin extends Command
{
    use ReadsSecretPassword;

    protected $signature = 'kiddo:super-admin:create
        {phone : Login — telefon raqami (+998XXXXXXXXX)}
        {--name=Super Admin : Ism}
        {--password-stdin : Parolni standart kirishdan (birinchi qator) o\'qish}
        {--force : Production muhitida tasdiqsiz bajarish}';

    protected $description = 'Birinchi Super Admin akkauntini bir martalik yaratish';

    public function handle(): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('Production muhitida --force bilan ishga tushiring.');
            return Command::FAILURE;
        }

        if (User::where('role', User::ROLE_SUPER_ADMIN)->exists()) {
            $this->error("Super Admin allaqachon mavjud. O'zgartirish uchun: php artisan kiddo:super-admin:update");
            return Command::FAILURE;
        }

        $phone = (string) $this->argument('phone');
        if (! $this->validPhone($phone)) {
            return Command::FAILURE;
        }
        if (User::where('phone', $phone)->exists()) {
            $this->error('Bu telefon raqami boshqa foydalanuvchiga tegishli.');
            return Command::FAILURE;
        }

        $password = $this->readPassword();
        if ($password === null) {
            return Command::FAILURE;
        }

        $user = User::create([
            'name'            => (string) $this->option('name'),
            'phone'           => $phone,
            'password'        => $password,   // 'hashed' cast orqali bcrypt
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
            'is_active'       => true,
        ]);

        ActivityLog::record('super_admin.created', "Super Admin yaratildi (konsol): {$user->name}", null, null, ['user_id' => $user->id]);

        $this->info("Super Admin yaratildi: #{$user->id}, login {$user->phone}.");

        return Command::SUCCESS;
    }
}
