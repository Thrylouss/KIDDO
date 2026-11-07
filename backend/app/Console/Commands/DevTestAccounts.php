<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * DEV TEST MODE: lokal bazada umumiy test akkauntlarini tayyorlaydi (idempotent — qayta ishga tushirsa takrorlamaydi).
 *
 *   bogcha1     — «Test bog'chasi (DEV)» rahbari
 *   tarbiyachi1 — shu test bog'chasidagi «Test guruh» tarbiyachisi
 *   KIDDO_DEV_SUPERADMIN_USERNAME — DEV Super Admin (parol: KIDDO_DEV_SUPERADMIN_PASSWORD); berilmasa yaratilmaydi
 *
 * Test bog'chasi va bolalar to'qima ma'lumot: haqiqiy (import qilingan) bog'chalarga tegilmaydi.
 * Test bog'chasi is_demo=true — Super Admin platforma statistikasiga qo'shilmaydi.
 * Faqat APP_ENV=local + KIDDO_DEV_TEST_MODE=true + baza nomi KIDDO_DEV_TEST_DATABASE bo'lsa ishlaydi.
 * Parol KIDDO_DEV_TEST_PASSWORD dan olinadi va faqat hash ko'rinishida saqlanadi; ekranga chiqarilmaydi.
 */
class DevTestAccounts extends Command
{
    public const ORG_NAME   = "Test bog'chasi (DEV)";
    public const GROUP_NAME = 'Test guruh (DEV)';

    protected $signature = 'kiddo:dev-accounts';

    protected $description = 'DEV TEST MODE: lokal bazada bogcha1 / tarbiyachi1 va DEV Super Admin test akkauntlarini tayyorlash';

    public function handle(): int
    {
        if ($reason = $this->blockedReason()) {
            $this->error("DEV TEST MODE o'chiq: {$reason}");
            return Command::FAILURE;
        }

        $password = (string) config('kiddo.dev_test_password');

        $result = DB::transaction(function () use ($password) {
            $devSuperAdmin = $this->devSuperAdmin();
            if (is_string($devSuperAdmin)) {
                return $devSuperAdmin;
            }

            $org = Organization::firstOrCreate(
                ['name' => self::ORG_NAME, 'district' => null, 'number' => null],
                ['address' => "Test manzil (DEV)", 'is_active' => true, 'is_demo' => true],
            );
            // Test tashkiloti platforma statistikasiga qo'shilmasin
            if (! $org->is_demo) {
                $org->update(['is_demo' => true]);
            }
            $group = Group::firstOrCreate(
                ['organization_id' => $org->id, 'name' => self::GROUP_NAME],
                ['age_category' => '4-5 yosh', 'capacity' => 20, 'is_active' => true],
            );

            $owner = $this->account('bogcha1', User::ROLE_ADMIN, "Test Rahbar (DEV)", $org->id, $password);
            if (is_string($owner)) {
                return $owner;
            }
            $teacher = $this->account('tarbiyachi1', User::ROLE_TEACHER, "Test Tarbiyachi (DEV)", $org->id, $password);
            if (is_string($teacher)) {
                return $teacher;
            }

            $profile = TeacherProfile::firstOrCreate(
                ['user_id' => $teacher->id],
                ['organization_id' => $org->id, 'first_name' => 'Tarbiyachi', 'last_name' => 'Test', 'phone' => '-', 'position' => 'Tarbiyachi'],
            );
            $profile->groups()->syncWithoutDetaching([$group->id => ['assigned_at' => now()->toDateString(), 'is_primary' => true]]);

            // To'qima bolalar — faqat test guruhida, bir marta
            if (! Child::where('group_id', $group->id)->exists()) {
                foreach ([['Ali', 'erkak'], ['Malika', 'ayol'], ['Sardor', 'erkak'], ['Zarina', 'ayol'], ['Bekzod', 'erkak']] as $i => [$first, $gender]) {
                    Child::create([
                        'organization_id' => $org->id,
                        'group_id'        => $group->id,
                        'first_name'      => $first,
                        'last_name'       => 'Testov' . ($gender === 'ayol' ? 'a' : ''),
                        'birth_date'      => now()->subYears(4)->subMonths($i)->toDateString(),
                        'gender'          => $gender,
                        'is_active'       => true,
                    ]);
                }
            }

            ActivityLog::record('dev.test_accounts', 'DEV TEST MODE akkauntlari tayyorlandi', null, null,
                ['users' => array_values(array_filter([$devSuperAdmin?->id, $owner->id, $teacher->id])), 'organization_id' => $org->id]);

            return [$owner, $teacher, $org, $devSuperAdmin];
        });

        if (is_string($result)) {
            $this->error($result);
            return Command::FAILURE;
        }

        [$owner, $teacher, $org, $devSuperAdmin] = $result;
        $this->info("DEV TEST MODE akkauntlari tayyor (parol: KIDDO_DEV_TEST_PASSWORD):");
        $this->line("  bogcha1     → bog'cha rahbari #{$owner->id}, «{$org->name}» #{$org->id}");
        $this->line("  tarbiyachi1 → tarbiyachi #{$teacher->id}, «" . self::GROUP_NAME . "»");
        if ($devSuperAdmin) {
            $this->line("  {$devSuperAdmin->username} → Super Admin #{$devSuperAdmin->id} (parol: KIDDO_DEV_SUPERADMIN_PASSWORD)");
        }

        return Command::SUCCESS;
    }

    private function blockedReason(): ?string
    {
        if (! app()->environment('local')) {
            return 'faqat APP_ENV=local muhitida ishlaydi (hozir: ' . app()->environment() . ').';
        }
        if (! config('kiddo.dev_test_mode')) {
            return 'KIDDO_DEV_TEST_MODE=true emas.';
        }
        $db = DB::connection()->getDatabaseName();
        if ($db !== config('kiddo.dev_test_database')) {
            return "baza «{$db}», ruxsat etilgan baza «" . config('kiddo.dev_test_database') . '».';
        }
        if (mb_strlen((string) config('kiddo.dev_test_password')) < 8) {
            return 'KIDDO_DEV_TEST_PASSWORD berilmagan (kamida 8 belgi).';
        }
        if (! Schema::hasColumn('organizations', 'is_demo')) {
            return 'is_demo ustuni yo\'q — avval migratsiya bajarilishi kerak.';
        }
        if (! Schema::hasColumn('users', 'username')) {
            return 'username ustuni yo\'q — avval migratsiya bajarilishi kerak.';
        }

        return null;
    }

    /**
     * Ixtiyoriy alohida DEV Super Admin — username va parol faqat muhitdan (.env.dev).
     * Bir marta yaratiladi; keyingi ishga tushishlarda faqat mavjudligi va roli tekshiriladi.
     */
    private function devSuperAdmin(): User|string|null
    {
        $username = (string) config('kiddo.dev_superadmin_username');
        $password = (string) config('kiddo.dev_superadmin_password');
        if ($username === '' && $password === '') {
            return null;
        }
        $username = mb_strtolower(trim($username));
        if (! preg_match(User::USERNAME_PATTERN, $username) || mb_strlen($password) < 12) {
            return "KIDDO_DEV_SUPERADMIN_USERNAME (lotin harfi bilan boshlanadi) va KIDDO_DEV_SUPERADMIN_PASSWORD (kamida 12 belgi) to'g'ri berilmagan.";
        }

        $user = User::where('username', $username)->first();
        if ($user && $user->role !== User::ROLE_SUPER_ADMIN) {
            return "«{$username}» username'i boshqa roldagi foydalanuvchiga tegishli (#{$user->id}).";
        }

        $user ??= new User(['username' => $username, 'role' => User::ROLE_SUPER_ADMIN, 'name' => 'Super Admin (DEV)', 'organization_id' => null]);
        $this->applyPassword($user, $password);

        return $user;
    }

    /** Parol faqat yangi akkauntda yoki muhitdagi qiymat o'zgarganda yangilanadi (bcrypt hash, 'hashed' cast). */
    private function applyPassword(User $user, string $password): void
    {
        if (! $user->exists || ! Hash::check($password, (string) $user->password)) {
            $user->password = $password;
        }
        $user->is_active = true;
        if ($user->isDirty()) {
            $user->save();
        }
    }

    private function account(string $username, string $role, string $name, int $orgId, string $password): User|string
    {
        $user = User::where('username', $username)->first();
        if ($user && ($user->role !== $role || $user->organization_id !== $orgId)) {
            return "«{$username}» username'i boshqa rol yoki bog'chadagi foydalanuvchiga tegishli (#{$user->id}).";
        }

        $user ??= new User(['username' => $username, 'role' => $role, 'organization_id' => $orgId, 'name' => $name]);
        $this->applyPassword($user, $password);

        return $user;
    }
}
