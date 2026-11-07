<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * Namoyish uchun sun'iy (to'qima) ma'lumotlar: har bir haqiqiy bog'chaga turli hajmda guruhlar, bolalar,
 * tarbiyachilar, ota-onalar, rahbar akkaunti, davomat, kundalik yozuvlar va oylik to'lov holati.
 *
 * - Faqat DEV TEST MODE (APP_ENV=local, KIDDO_DEV_TEST_MODE=true, baza = KIDDO_DEV_TEST_DATABASE).
 * - Idempotent: har bog'cha uchun deterministik generatsiya (o'z seed'i) + tabiiy kalitlar bo'yicha firstOrCreate;
 *   qayta ishga tushirilganda takror yaratilmaydi, mavjud akkauntlarning paroli o'zgartirilmaydi.
 * - Har bir demo yozuv `demo_records` ga yoziladi; --purge faqat ularni olib tashlaydi (bog'chalarga tegilmaydi).
 * - Demo bo'lmagan ma'lumoti (guruh, bola, foydalanuvchi) bor bog'cha o'tkazib yuboriladi — real ma'lumot bilan aralashmaydi.
 * - Ismlar sun'iy; telefonlar +99800XXXXXXX (mavjud bo'lmagan operator kodi). Parol: KIDDO_DEV_TEST_PASSWORD (faqat hash).
 */
class DemoData extends Command
{
    protected $signature = 'kiddo:demo-data
        {--purge : Faqat demo yozuvlarni (demo_records) olib tashlash}
        {--days=10 : Davomat tarixi (ish kunlari soni)}';

    protected $description = "Haqiqiy bog'chalar uchun namoyish ma'lumotlari (idempotent, faqat DEV TEST MODE)";

    private const AGE_CATEGORIES = [['2-3 yosh', 2], ['3-4 yosh', 3], ['4-5 yosh', 4], ['5-6 yosh', 5], ['6-7 yosh (tayyorlov)', 6]];
    private const GROUP_NAMES    = ['Quyoshcha', 'Kamalak', 'Lolacha', 'Yulduzcha', "Bulbulcha", 'Boychechak', 'Kapalak', "G'unchalar",
                                    'Laylakcha', 'Chaqmoq', 'Shabnam', 'Sumbula', 'Nihol', 'Oydinoy', 'Ziyrak', 'Charxpalak'];
    private const MALE           = ['Ali', 'Sardor', 'Bekzod', 'Javohir', 'Doniyor', 'Jasur', 'Azizbek', 'Temur', 'Sanjar', 'Ulugbek',
                                    'Muhammad', 'Abdulloh', 'Islom', 'Shohruh', 'Firdavs', 'Behruz', 'Otabek', 'Diyor', 'Asadbek', 'Samandar'];
    private const FEMALE         = ['Malika', 'Zarina', 'Madina', 'Sevinch', 'Mohinur', 'Dilnoza', 'Gulnoza', 'Nilufar', 'Shahzoda', 'Oysha',
                                    'Mubina', 'Robiya', 'Zilola', 'Sabina', 'Kamola', 'Muslima', 'Laylo', 'Durdona', 'Hilola', 'Yasmina'];
    private const SURNAMES       = ['Karimov', 'Rahimov', 'Tursunov', 'Yusupov', 'Aliyev', 'Saidov', 'Nazarov', "Qodirov", 'Ergashev', 'Hamidov',
                                    'Sobirov', 'Ismoilov', 'Mirzayev', 'Abdullayev', 'Rustamov', 'Xolmatov', 'Umarov', 'Jurayev', 'Normatov', 'Sharipov'];
    private const ACTIVITIES     = [['Ertalabki badantarbiya', 'jismoniy'], ["Ertak o'qish", 'nutq'], ['Sanashni o\'rganamiz', 'matematika'],
                                    ['Rasm chizish: kuz', 'tasviriy'], ["Qo'shiq va raqs", 'musiqa'], ['Tabiat burchagi', 'atrof_olam'],
                                    ["Do'stlik o'yini", 'ijtimoiy'], ['Plastilin bilan ishlash', 'tasviriy'], ['Harflar bilan tanishuv', 'nutq']];

    private string $passwordHash;
    private array $created;

    public function handle(): int
    {
        if ($reason = $this->blockedReason()) {
            $this->error("DEV TEST MODE o'chiq: {$reason}");
            return Command::FAILURE;
        }

        if ($this->option('purge')) {
            return $this->purge();
        }

        $this->passwordHash = Hash::make((string) config('kiddo.dev_test_password'));
        $today = AttendanceService::today()->toImmutable();
        $days  = max(1, min(30, (int) $this->option('days')));

        $rows = [];
        foreach (Organization::real()->orderBy('id')->get() as $org) {
            if ($this->hasNonDemoData($org)) {
                $rows[] = [$org->id, $org->name, "o'tkazib yuborildi: demo bo'lmagan ma'lumot bor", '', '', '', ''];
                continue;
            }
            $this->created = ['group' => 0, 'child' => 0, 'user' => 0, 'attendance' => 0];
            $summary = DB::transaction(fn () => $this->seedOrganization($org, $today, $days));
            $rows[] = [$org->id, $org->name, ...$summary, "+{$this->created['child']} bola, +{$this->created['attendance']} davomat"];
        }

        $this->table(['#', "Bog'cha", 'Guruh', 'Bola', 'Tarbiyachi', 'Ota-ona', 'Yangi'], $rows);
        ActivityLog::record('dev.demo_data', "Namoyish ma'lumotlari tayyorlandi", null, null, ['organizations' => count($rows)]);

        return Command::SUCCESS;
    }

    /** @return array{0:int,1:int,2:int,3:int} guruh, bola, tarbiyachi, ota-ona (jami, shu bog'chada) */
    private function seedOrganization(Organization $org, CarbonImmutable $today, int $days): array
    {
        $n    = (int) $org->number ?: $org->id;
        $rand = $this->rng("org-{$org->id}");

        // Hajm bog'cha quvvatiga bog'liq va har bog'chada har xil: quvvatning 12–30%
        $childCount = max(12, (int) round(($org->capacity ?: 100) * (12 + $rand(0, 18)) / 100));
        // Guruhlar soni yosh toifalari sonidan oshmaydi (har guruh — bitta yosh toifasi)
        $groupCount = max(2, min(count(self::AGE_CATEGORIES), (int) ceil($childCount / 14)));
        $names      = $this->shuffle(self::GROUP_NAMES, "groups-{$org->id}");
        $ages       = array_slice(self::AGE_CATEGORIES, max(0, 5 - $groupCount), $groupCount);

        // Rahbar akkaunti (bog'chada rahbar bo'lmasa) — login dmtt{raqam}
        if (! User::where('organization_id', $org->id)->where('role', User::ROLE_ADMIN)->exists()) {
            $this->user($org, "dmtt{$n}", $this->personName("rahbar-{$org->id}", 'f'), User::ROLE_ADMIN);
        }

        $groups = [];
        foreach ($ages as $i => [$age, $years]) {
            $group = Group::firstOrCreate(
                ['organization_id' => $org->id, 'name' => $names[$i]],
                ['age_category' => $age, 'capacity' => (int) ceil($childCount / $groupCount) + $rand(3, 8), 'is_active' => true],
            );
            $this->track($org, 'group', $group->id, $group->wasRecentlyCreated);

            // 1 ta tarbiyachi, ba'zi guruhlarda yordamchi bilan 2 ta
            $teachers = [];
            foreach (range(1, $rand(1, 100) <= 35 ? 2 : 1) as $j) {
                $k       = $i * 2 + $j;
                $person  = $this->personName("teacher-{$org->id}-{$k}", 'f');
                $user    = $this->user($org, "dmtt{$n}.t{$k}", $person, User::ROLE_TEACHER);
                $profile = TeacherProfile::firstOrCreate(['user_id' => $user->id], [
                    'organization_id' => $org->id, 'first_name' => $person[0], 'last_name' => $person[1], 'phone' => null,
                    'position' => $j === 1 ? 'Tarbiyachi' : 'Yordamchi tarbiyachi', 'is_active' => true,
                ]);
                $this->track($org, 'teacher_profile', $profile->id, $profile->wasRecentlyCreated);
                $profile->groups()->syncWithoutDetaching([$group->id => ['assigned_at' => $today->subMonths(2)->toDateString(), 'is_primary' => $j === 1]]);
                $teachers[] = $user->id;
            }
            $groups[] = ['model' => $group, 'years' => $years, 'teacher' => $teachers[0], 'children' => []];
        }

        // Bolalar — guruhlarga navbat bilan; ism, jins, tug'ilgan sana deterministik
        $previousParent = null;
        foreach (range(1, $childCount) as $c) {
            $slot   = &$groups[($c - 1) % $groupCount];
            $female = $rand(0, 1) === 1;
            $first  = $this->pick($female ? self::FEMALE : self::MALE, "child-first-{$org->id}-{$c}");
            $last   = $this->surname($this->pick(self::SURNAMES, "child-last-{$org->id}-{$c}"), $female);
            $birth  = $today->subYears($slot['years'] + 1)->addDays($rand(0, 364))->toDateString();

            $child = Child::firstOrCreate(
                ['organization_id' => $org->id, 'first_name' => $first, 'last_name' => $last, 'birth_date' => $birth],
                ['group_id' => $slot['model']->id, 'gender' => $female ? 'ayol' : 'erkak', 'is_active' => $rand(1, 100) > 3,
                 'admitted_at' => $today->subMonths($rand(2, 14))->startOfMonth()->toDateString()],
            );
            $this->track($org, 'child', $child->id, $child->wasRecentlyCreated);
            $slot['children'][] = $child;

            // Ota-ona: ~80% bolada; ba'zilarida ikkinchi ota-ona; ~10% — oldingi bola bilan aka-uka/opa-singil
            $roll = $rand(1, 100);
            if ($roll <= 10 && $previousParent) {
                $child->linkParent($previousParent, $previousParent->relation_type, true);
            } elseif ($roll <= 80) {
                $previousParent = $this->parent($org, $n, $c, 1, $last, 'ona', $child);
                if ($rand(1, 100) <= 20) {
                    $this->parent($org, $n, $c, 2, $last, 'ota', $child);
                }
            }
            unset($slot);
        }

        $this->dailyRecords($org, $groups, $today, $days);

        return [
            Group::where('organization_id', $org->id)->count(),
            Child::where('organization_id', $org->id)->count(),
            TeacherProfile::where('organization_id', $org->id)->count(),
            ParentProfile::where('organization_id', $org->id)->count(),
        ];
    }

    /** Davomat (oxirgi ish kunlari), mashg'ulotlar, ovqatlanish va uyqu. Mavjud yozuvlar qayta yozilmaydi. */
    private function dailyRecords(Organization $org, array $groups, CarbonImmutable $today, int $days): void
    {
        $dates = [];
        for ($d = $today; count($dates) < $days; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $dates[] = $d;
            }
        }

        // Oylik to'lovlar: o'tgan oy — deyarli hammasi, joriy oy — bog'chaga qarab qisman (child_id+month unique)
        if (Schema::hasTable('child_payments')) {
            $fee  = 300000 + $this->rng("fee-{$org->id}")(0, 5) * 50000;
            $paid = [];
            foreach ([[$today->subMonthNoOverflow()->startOfMonth(), 92], [$today->startOfMonth(), 35 + $this->rng("pay-{$org->id}")(0, 50)]] as [$month, $share]) {
                foreach ($groups as $g) {
                    foreach ($g['children'] as $child) {
                        $r = $this->rng("pay-{$child->id}-{$month->format('Y-m')}")(1, 100);
                        if (! $child->is_active || $r > $share) {
                            continue;
                        }
                        $paidAt = $month->addDays(min($r % 10, max(0, $today->day - 1)));
                        $paid[] = ['organization_id' => $org->id, 'child_id' => $child->id, 'month' => $month->toDateString(),
                            'amount' => $fee, 'paid_at' => ($paidAt->greaterThan($today) ? $today : $paidAt)->toDateString(),
                            'note' => $r % 4 === 0 ? 'Naqd' : null, 'recorded_by' => null, 'created_at' => now(), 'updated_at' => now()];
                    }
                }
            }
            foreach (array_chunk($paid, 500) as $chunk) {
                DB::table('child_payments')->insertOrIgnore($chunk);
            }
        }

        // Bugun: ba'zi bog'chalarda to'liq, ba'zilarida qisman, ba'zilarida hali belgilanmagan
        $todayMode = $this->rng("today-{$org->id}")(1, 100);
        $now       = now();

        foreach ($groups as $g) {
            $rows = [];
            foreach ($dates as $date) {
                $isToday = $date->isSameDay($today);
                if ($isToday && $todayMode > 85) {
                    continue;
                }
                foreach ($g['children'] as $idx => $child) {
                    if (! $child->is_active || ($isToday && $todayMode > 60 && $idx % 2 === 1)) {
                        continue;
                    }
                    $r      = $this->rng("att-{$child->id}-{$date->toDateString()}")(1, 100);
                    $status = $r <= 84 ? Attendance::STATUS_PRESENT : ($r <= 93 ? Attendance::STATUS_ABSENT : Attendance::STATUS_EXCUSED);
                    $rows[] = [
                        'organization_id' => $org->id, 'child_id' => $child->id, 'group_id' => $g['model']->id,
                        'date' => $date->toDateString(), 'status' => $status,
                        'excuse_reason' => $status === Attendance::STATUS_EXCUSED ? ($r % 2 ? 'kasallik' : 'oilaviy') : null,
                        'note' => $status === Attendance::STATUS_EXCUSED ? ($r % 2 ? 'Shamollagan' : 'Oilaviy sabab') : null,
                        'marked_by' => $g['teacher'], 'marked_at' => $date->setTime(9, 0), 'created_at' => $now, 'updated_at' => $now,
                    ];
                }
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                $this->created['attendance'] += DB::table('attendances')->insertOrIgnore($chunk);
            }

            // Mashg'ulotlar: oxirgi 3 ish kuni, kuniga 2 ta (guruh+sana bo'yicha bir marta)
            foreach (array_slice($dates, 0, 3) as $date) {
                if (GroupActivity::where('group_id', $g['model']->id)->whereDate('date', $date)->exists()) {
                    continue;
                }
                foreach ([['09:30', '10:00'], ['11:00', '11:30']] as $a => [$start, $end]) {
                    [$title, $direction] = $this->pick(self::ACTIVITIES, "act-{$g['model']->id}-{$date->toDateString()}-{$a}");
                    GroupActivity::create([
                        'organization_id' => $org->id, 'group_id' => $g['model']->id, 'date' => $date->toDateString(),
                        'title' => $title, 'direction' => $direction, 'starts_at' => $start, 'ends_at' => $end,
                        'recorded_by' => $g['teacher'],
                    ]);
                }
            }

            // Ovqatlanish va uyqu: oxirgi 2 ish kunida kelgan bolalar uchun (guruh+sana bo'yicha bir marta)
            foreach (array_slice($dates, 0, 2) as $date) {
                if (MealRecord::where('group_id', $g['model']->id)->whereDate('date', $date)->exists()) {
                    continue;
                }
                $present = DB::table('attendances')->where('group_id', $g['model']->id)->whereDate('date', $date)
                    ->where('status', Attendance::STATUS_PRESENT)->pluck('child_id');
                $meals = $sleep = [];
                foreach ($present as $childId) {
                    $r = $this->rng("meal-{$childId}-{$date->toDateString()}")(1, 100);
                    foreach ([[MealRecord::TYPE_NONUSHTA, '08:30'], [MealRecord::TYPE_TUSHLIK, '12:30']] as [$type, $at]) {
                        $meals[] = ['organization_id' => $org->id, 'child_id' => $childId, 'group_id' => $g['model']->id,
                            'date' => $date->toDateString(), 'meal_type' => $type, 'served_at' => $at, 'ate' => $r > 8,
                            'recorded_by' => $g['teacher'], 'created_at' => $now, 'updated_at' => $now];
                    }
                    $sleep[] = ['organization_id' => $org->id, 'child_id' => $childId, 'group_id' => $g['model']->id,
                        'date' => $date->toDateString(), 'started_at' => '13:00', 'ended_at' => $r > 20 ? '15:00' : '14:30',
                        'recorded_by' => $g['teacher'], 'created_at' => $now, 'updated_at' => $now];
                }
                foreach (array_chunk($meals, 500) as $chunk) {
                    DB::table('meal_records')->insert($chunk);
                }
                foreach (array_chunk($sleep, 500) as $chunk) {
                    DB::table('sleep_records')->insert($chunk);
                }
            }
        }
    }

    private function parent(Organization $org, int $n, int $c, int $k, string $childSurname, string $relation, Child $child): ParentProfile
    {
        $female = $relation === 'ona';
        $first  = $this->pick($female ? self::FEMALE : self::MALE, "parent-{$org->id}-{$c}-{$k}");
        $last   = $this->surname(preg_replace('/a$/', '', $childSurname), $female);
        // Sun'iy telefon: +998 00 — mavjud bo'lmagan operator kodi; bog'cha (2 xona) + tartib (5 xona) — unikal
        $phone  = sprintf('+99800%02d%05d', $org->id % 100, $c * 10 + $k);
        $user   = $this->user($org, "dmtt{$n}.p{$c}" . ($k > 1 ? "b" : ''), [$first, $last], User::ROLE_PARENT, $phone);

        $profile = ParentProfile::firstOrCreate(['user_id' => $user->id], [
            'organization_id' => $org->id, 'first_name' => $first, 'last_name' => $last, 'phone' => $user->phone, 'relation_type' => $relation,
        ]);
        $this->track($org, 'parent_profile', $profile->id, $profile->wasRecentlyCreated);
        $child->linkParent($profile, $relation, $k === 1);

        return $profile;
    }

    /** Mavjud akkaunt bo'lsa — o'zgarishsiz (parol ham); yo'q bo'lsa — demo parol hash'i bilan yaratiladi. */
    private function user(Organization $org, string $username, array $person, string $role, ?string $phone = null): User
    {
        $user = User::where('username', $username)->first();
        if ($user) {
            return $user;
        }

        $user = new User([
            'name' => "{$person[0]} {$person[1]}", 'username' => $username, 'phone' => $phone,
            'role' => $role, 'organization_id' => $org->id, 'is_active' => true,
        ]);
        $user->password = $this->passwordHash; // allaqachon hash — 'hashed' cast qayta hash qilmaydi
        $user->save();
        $this->track($org, 'user', $user->id, true);

        return $user;
    }

    private function track(Organization $org, string $type, int $id, bool $isNew): void
    {
        DB::table('demo_records')->insertOrIgnore(['organization_id' => $org->id, 'model_type' => $type, 'model_id' => $id, 'created_at' => now()]);
        if ($isNew && isset($this->created[$type])) {
            $this->created[$type]++;
        }
    }

    /** Demo ro'yxatida bo'lmagan guruh, bola yoki foydalanuvchi bor bog'cha — haqiqiy foydalanishda. */
    private function hasNonDemoData(Organization $org): bool
    {
        $demo = fn (string $type) => DB::table('demo_records')->where('organization_id', $org->id)->where('model_type', $type)->select('model_id');

        return Group::withTrashed()->where('organization_id', $org->id)->whereNotIn('id', $demo('group'))->exists()
            || Child::withTrashed()->where('organization_id', $org->id)->whereNotIn('id', $demo('child'))->exists()
            || User::where('organization_id', $org->id)->whereNotIn('id', $demo('user'))->exists();
    }

    /** Faqat demo_records'dagi yozuvlar o'chiriladi (FK cascade: davomat, ovqat, uyqu, biriktirishlar). */
    private function purge(): int
    {
        $ids = fn (string $type) => DB::table('demo_records')->where('model_type', $type)->pluck('model_id');

        $counts = DB::transaction(function () use ($ids) {
            $children = $ids('child');
            $groups   = $ids('group');
            $users    = $ids('user');
            $result   = [
                'bola'         => DB::table('children')->whereIn('id', $children)->delete(),
                'guruh'        => DB::table('groups')->whereIn('id', $groups)->delete(),
                'tarbiyachi'   => DB::table('teacher_profiles')->whereIn('id', $ids('teacher_profile'))->delete(),
                'ota-ona'      => DB::table('parent_profiles')->whereIn('id', $ids('parent_profile'))->delete(),
            ];
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $users)->delete();
            $result['foydalanuvchi'] = DB::table('users')->whereIn('id', $users)->delete();
            DB::table('demo_records')->delete();

            return $result;
        });

        $this->info("Demo yozuvlar olib tashlandi: " . collect($counts)->map(fn ($v, $k) => "{$k} {$v}")->implode(', '));
        ActivityLog::record('dev.demo_data_purged', "Namoyish ma'lumotlari olib tashlandi", null, null, $counts);

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
        if (! Schema::hasTable('demo_records') || ! Schema::hasColumns('users', ['username', 'must_change_password'])) {
            return "migratsiyalar bajarilmagan (demo_records / users.username).";
        }

        return null;
    }

    // ── Deterministik tasodif ─────────────────────────────────────────

    /** Kalitga bog'langan mustaqil RNG — boshqa qismlar o'zgarsa ham natija barqaror. */
    private function rng(string $key): \Closure
    {
        $state = crc32("kiddo-demo|{$key}");

        return function (int $min, int $max) use (&$state): int {
            $state = (1103515245 * $state + 12345) & 0x7fffffff;

            return $min + ($state % ($max - $min + 1));
        };
    }

    private function pick(array $list, string $key): mixed
    {
        return $list[$this->rng($key)(0, count($list) - 1)];
    }

    private function shuffle(array $list, string $key): array
    {
        $rand = $this->rng($key);
        for ($i = count($list) - 1; $i > 0; $i--) {
            $j = $rand(0, $i);
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
        }

        return $list;
    }

    private function surname(string $base, bool $female): string
    {
        return $female ? "{$base}a" : $base;
    }

    /** @return array{0:string,1:string} [ism, familiya] */
    private function personName(string $key, string $gender): array
    {
        $female = $gender === 'f';

        return [$this->pick($female ? self::FEMALE : self::MALE, "{$key}-first"), $this->surname($this->pick(self::SURNAMES, "{$key}-last"), $female)];
    }
}
