<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\OrganizationStatusChange;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Super Admin → Bog'chalar moduli biznes mantig'i: ro'yxat (qidiruv/filtr/saralash), statistika,
 * yaratish (rahbar akkaunti bilan, bitta tranzaksiyada), tahrirlash, faollik holati va arxivlash.
 * Bolalar/guruhlar/tarbiyachilar soni har doim real jadvallardan hisoblanadi.
 */
class OrganizationService
{
    /** Ro'yxatda ustun bo'yicha saralash mumkin bo'lgan maydonlar → SQL ifodasi. */
    private const SORTABLE = [
        'name'           => 'organizations.name',
        'type'           => 'organizations.type',
        'district'       => 'organizations.district',
        'status'         => 'organizations.status',
        'created_at'     => 'organizations.created_at',
        'children_count' => 'children_count',
        'groups_count'   => 'groups_count',
        'teachers_count' => 'teacher_profiles_count',
    ];

    /** Tahrirlashda audit logga eski → yangi qiymati yoziladigan maydonlar. */
    private const AUDITED = ['name', 'type', 'official_code', 'phone', 'region', 'district', 'mfy', 'address',
        'director_name', 'director_phone'];

    public function __construct(private AccountProvisioningService $accounts) {}

    /**
     * Ro'yxat va eksport uchun umumiy so'rov.
     *
     * @param array<string, mixed> $f search, type, status, district, region, created_from, created_to,
     *                                children_min, children_max, turi (real|demo|all), ids[], sort, direction
     */
    public function query(array $f): Builder
    {
        $query = Organization::query()
            ->with('subscription.plan')
            ->withCount([
                'children'        => fn ($q) => $q->where('is_active', true),
                'groups'          => fn ($q) => $q->active(),
                'teacherProfiles' => fn ($q) => $q->active(),
            ]);

        // turi: real (standart) — haqiqiy; demo — test (DEV); all — hammasi
        match ($f['turi'] ?? 'real') {
            'demo'  => $query->demo(),
            'all'   => null,
            default => $query->real(),
        };

        if (! empty($f['ids'])) {
            $query->whereIn('organizations.id', array_map('intval', (array) $f['ids']));
        }

        if (($search = trim((string) ($f['search'] ?? ''))) !== '') {
            $digits = preg_replace('/\D/', '', $search);
            $query->where(function (Builder $q) use ($search, $digits) {
                foreach (['name', 'director_name', 'address', 'district', 'mfy', 'region', 'official_code', 'number'] as $col) {
                    $q->orWhere("organizations.{$col}", 'ilike', "%{$search}%");
                }
                // Telefon: «90 123-45-67» ham «+998901234567» ni topadi
                if (strlen($digits) >= 3) {
                    foreach (['phone', 'director_phone'] as $col) {
                        $q->orWhereRaw("regexp_replace(coalesce(organizations.{$col}, ''), '\\D', '', 'g') like ?", ["%{$digits}%"]);
                    }
                }
            });
        }

        if (in_array($f['type'] ?? null, Organization::TYPES, true)) {
            $query->where('organizations.type', $f['type']);
        }

        // Faollik holati. Standart ro'yxatda arxivlanganlar ko'rsatilmaydi — faqat «Arxivlangan» filtri bilan.
        $status = $f['status'] ?? null;
        if (in_array($status, Organization::STATUSES, true)) {
            $query->where('organizations.status', $status);
        } else {
            $query->notArchived();
            $this->applyLegacySubscriptionFilter($query, $status);
        }

        if (($district = trim((string) ($f['district'] ?? ''))) !== '') {
            $query->whereRaw('lower(organizations.district) = ?', [mb_strtolower($district)]);
        }
        if (($region = trim((string) ($f['region'] ?? ''))) !== '') {
            $query->whereRaw('lower(organizations.region) = ?', [mb_strtolower($region)]);
        }
        if (($mfy = trim((string) ($f['mfy'] ?? ''))) !== '') {
            $query->where('organizations.mfy', 'ilike', "%{$mfy}%");
        }
        if (! empty($f['created_from'])) {
            $query->whereDate('organizations.created_at', '>=', $f['created_from']);
        }
        if (! empty($f['created_to'])) {
            $query->whereDate('organizations.created_at', '<=', $f['created_to']);
        }

        // Bolalar soni oralig'i — faol bolalar (ro'yxatdagi ustun bilan bir xil)
        $childrenSql = '(select count(*) from children where children.organization_id = organizations.id and children.is_active = true and children.deleted_at is null)';
        if (isset($f['children_min']) && $f['children_min'] !== '') {
            $query->whereRaw("{$childrenSql} >= ?", [(int) $f['children_min']]);
        }
        if (isset($f['children_max']) && $f['children_max'] !== '') {
            $query->whereRaw("{$childrenSql} <= ?", [(int) $f['children_max']]);
        }

        // Guruhlar soni oralig'i — faol guruhlar (ustun bilan bir xil)
        $groupsSql = '(select count(*) from groups where groups.organization_id = organizations.id and groups.is_active = true and groups.deleted_at is null)';
        if (isset($f['groups_min']) && $f['groups_min'] !== '') {
            $query->whereRaw("{$groupsSql} >= ?", [(int) $f['groups_min']]);
        }
        if (isset($f['groups_max']) && $f['groups_max'] !== '') {
            $query->whereRaw("{$groupsSql} <= ?", [(int) $f['groups_max']]);
        }

        $this->applySort($query, (string) ($f['sort'] ?? 'newest'), (string) ($f['direction'] ?? ''));

        return $query;
    }

    /**
     * Faollik holatlari bo'yicha sonlar — Dashboard, Hisobotlar va Bog'chalar sahifasi uchun yagona manba.
     * total = arxivlanmaganlar (active + inactive + suspended); archived — alohida.
     *
     * @return array{total:int, active:int, inactive:int, suspended:int, archived:int, not_active:int}
     */
    public function statusCounts(string $turi = 'real'): array
    {
        $base = Organization::query();
        match ($turi) {
            'demo'  => $base->demo(),
            'all'   => null,
            default => $base->real(),
        };
        $by = $base->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $n  = fn (string $s) => (int) ($by[$s] ?? 0);

        return [
            'total'      => $n(Organization::STATUS_ACTIVE) + $n(Organization::STATUS_INACTIVE) + $n(Organization::STATUS_SUSPENDED),
            'active'     => $n(Organization::STATUS_ACTIVE),
            'inactive'   => $n(Organization::STATUS_INACTIVE),
            'suspended'  => $n(Organization::STATUS_SUSPENDED),
            'archived'   => $n(Organization::STATUS_ARCHIVED),
            // Dashboard «Nofaol» kartasi: faol emas + vaqtincha to'xtatilgan (arxivsiz)
            'not_active' => $n(Organization::STATUS_INACTIVE) + $n(Organization::STATUS_SUSPENDED),
        ];
    }

    /** Statistika kartochkalari: real (yoki tanlangan turi) tashkilotlar bo'yicha. */
    public function stats(string $turi = 'real'): array
    {
        $base = Organization::query();
        match ($turi) {
            'demo'  => $base->demo(),
            'all'   => null,
            default => $base->real(),
        };

        $counts   = $this->statusCounts($turi);
        $byType   = (clone $base)->notArchived()->selectRaw("coalesce(type, '') as t, count(*) as c")->groupBy('t')->pluck('c', 't');

        $recent = (clone $base)->notArchived()->latest('id')->limit(5)
            ->get(['id', 'name', 'type', 'district', 'status', 'created_at'])
            ->map(fn (Organization $o) => [
                'id' => $o->id, 'name' => $o->name, 'type' => $o->type, 'district' => $o->district,
                'status' => $o->status, 'created_at' => $o->created_at,
            ]);

        return [
            // «Jami» — arxivlanmaganlar (arxiv alohida ko'rsatiladi); statusCounts() bilan bir xil
            'total'      => $counts['total'],
            'davlat'     => (int) ($byType[Organization::TYPE_DAVLAT] ?? 0),
            'xususiy'    => (int) ($byType[Organization::TYPE_XUSUSIY] ?? 0),
            'turi_yoq'   => (int) ($byType[''] ?? 0),
            'active'     => $counts['active'],
            'inactive'   => $counts['inactive'],
            'suspended'  => $counts['suspended'],
            'archived'   => $counts['archived'],
            'recent'     => $recent,
        ];
    }

    /** Filtrlar uchun tanlov qiymatlari — faqat bazadagi mavjud ma'lumotlardan (to'qima qiymat yo'q). */
    public function filterOptions(): array
    {
        // Rasmiy ma'lumotnoma yuklangan bo'lsa — undan, aks holda bazadagi mavjud qiymatlardan (source maydoni)
        return app(TerritoryDirectory::class)->options();
    }

    /**
     * Bog'cha (+ ixtiyoriy rahbar akkaunti) — hammasi bitta tranzaksiyada: akkaunt yaratilmasa, bog'cha ham saqlanmaydi.
     *
     * @return array{organization: Organization, admin: ?array{id:int, name:string, username:string, temporary_password:string}}
     */
    public function create(array $data, User $by, ?string $ip): array
    {
        return DB::transaction(function () use ($data, $by, $ip) {
            $org = Organization::create([
                ...collect($data)->only($this->profileFields())->all(),
                'status' => Organization::STATUS_ACTIVE,
            ]);

            ActivityLog::record('organization.created', "Yangi bog'cha yaratildi: {$org->name}", $by->id, $org->id,
                ['org_name' => $org->name, 'type' => $org->type], $ip);

            // Eski klientlar: rahbar telefon + Super Admin bergan parol bilan (hash qilinadi)
            if (empty($data['admin_username']) && ! empty($data['admin_name']) && ! empty($data['admin_phone'])) {
                User::create([
                    'name'            => $data['admin_name'],
                    'phone'           => $data['admin_phone'],
                    'email'           => $data['admin_email'] ?? null,
                    'password'        => Hash::make($data['admin_password']),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $org->id,
                    'is_active'       => true,
                ]);
            }

            // Obuna — faqat billing yoqilgan bo'lsa (MVP'da yashirin)
            if (! empty($data['plan_id']) && config('kiddo.billing.enabled')) {
                app(SubscriptionService::class)->createSubscription($org, Plan::findOrFail($data['plan_id']), [
                    'status'         => $data['subscription_status'] ?? Subscription::STATUS_TRIAL,
                    'starts_at'      => $data['starts_at'] ?? now(),
                    'ends_at'        => $data['ends_at'] ?? null,
                    'payment_status' => $data['payment_status'] ?? 'pending',
                    'user_id'        => $by->id,
                    'ip'             => $ip,
                ]);
            }

            $admin = null;
            if (! empty($data['admin_username'])) {
                $result = $this->accounts->createOrganizationAdmin(
                    $org,
                    $data['admin_username'],
                    ($data['admin_name'] ?? null) ?: ($org->director_name ?: "{$org->name} rahbari"),
                    $by,
                    $ip,
                );
                $admin = [
                    'id'                 => $result['user']->id,
                    'name'               => $result['user']->name,
                    'username'           => $result['user']->username,
                    'temporary_password' => $result['temporary_password'],
                ];
            }

            return ['organization' => $org, 'admin' => $admin];
        });
    }

    public function update(Organization $org, array $data, User $by, ?string $ip): Organization
    {
        $fields = collect($data)->only($this->profileFields())->all();
        $org->fill($fields);
        $dirty = $org->getDirty();
        if (! $dirty) {
            return $org;
        }

        $changes = [];
        foreach (self::AUDITED as $key) {
            if (array_key_exists($key, $dirty)) {
                $changes[$key] = ['old' => $org->getOriginal($key), 'new' => $dirty[$key]];
            }
        }

        DB::transaction(function () use ($org, $dirty, $changes, $by, $ip) {
            $org->save();
            ActivityLog::record('organization.updated', "Bog'cha ma'lumotlari o'zgartirildi: {$org->name}", $by->id, $org->id,
                ['fields' => array_keys($dirty), 'changes' => $changes], $ip);
        });

        return $org->refresh();
    }

    /**
     * Faollik holatini o'zgartirish. Faol bo'lmagan holatga o'tganda bog'cha foydalanuvchilarining barcha
     * sessiyalari darhol bekor qilinadi (User::canAuthenticate ham is_active orqali yangi kirishni to'xtatadi).
     * Arxivlash ma'lumotlarni o'chirmaydi.
     */
    public function changeStatus(Organization $org, string $status, ?string $reason, ?CarbonImmutable $suspendedUntil, User $by, ?string $ip): Organization
    {
        if (! in_array($status, Organization::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ["Noto'g'ri holat."]]);
        }
        if ($status === $org->status && $status !== Organization::STATUS_SUSPENDED) {
            throw ValidationException::withMessages(['status' => ["Bog'cha allaqachon shu holatda."]]);
        }

        $from = $org->status;

        DB::transaction(function () use ($org, $status, $reason, $suspendedUntil, $by, $ip, $from) {
            $org->forceFill([
                'status'            => $status,
                'status_reason'     => $reason,
                'suspended_until'   => $status === Organization::STATUS_SUSPENDED ? $suspendedUntil : null,
                'status_changed_at' => now(),
                'status_changed_by' => $by->id,
            ])->save();

            OrganizationStatusChange::create([
                'organization_id' => $org->id,
                'from_status'     => $from,
                'to_status'       => $status,
                'reason'          => $reason,
                'suspended_until' => $status === Organization::STATUS_SUSPENDED ? $suspendedUntil : null,
                'changed_by'      => $by->id,
            ]);

            if ($status !== Organization::STATUS_ACTIVE) {
                $org->users()->each(fn (User $user) => $user->tokens()->delete());
            }

            $labels = Organization::STATUS_LABELS;
            ActivityLog::record(
                $this->statusAction($status),
                "Bog'cha holati o'zgartirildi: {$org->name} — " . ($labels[$from] ?? $from) . ' → ' . $labels[$status],
                $by->id,
                $org->id,
                array_filter(['from' => $from, 'to' => $status, 'reason' => $reason,
                    'suspended_until' => $suspendedUntil?->toIso8601String()]),
                $ip,
            );
        });

        return $org->refresh();
    }

    /**
     * Ommaviy holat o'zgartirish (arxivlash / tiklash / to'xtatish) — har bir bog'cha alohida tarix va audit bilan,
     * hammasi bitta tranzaksiyada. Allaqachon shu holatdagilar o'tkazib yuboriladi. Ommaviy o'chirish yo'q.
     *
     * @param int[] $ids
     * @return array{changed: int[], skipped: int[]}
     */
    public function bulkChangeStatus(array $ids, string $status, ?string $reason, User $by, ?string $ip): array
    {
        $orgs = Organization::whereIn('id', $ids)->get();
        $changed = $skipped = [];

        DB::transaction(function () use ($orgs, $status, $reason, $by, $ip, &$changed, &$skipped) {
            foreach ($orgs as $org) {
                if ($org->status === $status) {
                    $skipped[] = $org->id;
                    continue;
                }
                $this->changeStatus($org, $status, $reason, null, $by, $ip);
                $changed[] = $org->id;
            }
        });

        return ['changed' => $changed, 'skipped' => array_values(array_merge($skipped, array_diff($ids, $orgs->pluck('id')->all())))];
    }

    /** Muddati o'tgan vaqtincha to'xtatishlarni faollashtiradi (scheduler). */
    public function resumeExpiredSuspensions(): int
    {
        $count = 0;
        Organization::where('status', Organization::STATUS_SUSPENDED)
            ->whereNotNull('suspended_until')
            ->where('suspended_until', '<=', now())
            ->get()
            ->each(function (Organization $org) use (&$count) {
                DB::transaction(function () use ($org) {
                    $org->forceFill([
                        'status'            => Organization::STATUS_ACTIVE,
                        'status_reason'     => null,
                        'suspended_until'   => null,
                        'status_changed_at' => now(),
                        'status_changed_by' => null,
                    ])->save();
                    OrganizationStatusChange::create([
                        'organization_id' => $org->id,
                        'from_status'     => Organization::STATUS_SUSPENDED,
                        'to_status'       => Organization::STATUS_ACTIVE,
                        'reason'          => "To'xtatish muddati tugadi (avtomatik).",
                    ]);
                    ActivityLog::record('organization.activated', "To'xtatish muddati tugadi, bog'cha faollashtirildi: {$org->name}",
                        null, $org->id, ['auto' => true]);
                });
                $count++;
            });

        return $count;
    }

    /**
     * Bog'chani o'chirish (soft delete). Faqat bog'langan ma'lumoti yo'q bog'cha va nomi qayta kiritilgan bo'lsa.
     * Bog'langan ma'lumotli bog'cha uchun — arxivlash.
     */
    public function delete(Organization $org, string $confirmName, User $by, ?string $ip): void
    {
        $org->loadCount(['children', 'groups', 'users', 'teacherProfiles', 'parentProfiles']);
        $linked = array_filter([
            'bolalar'          => $org->children_count,
            'guruhlar'         => $org->groups_count,
            'foydalanuvchilar' => $org->users_count,
            'tarbiyachilar'    => $org->teacher_profiles_count,
            'ota_onalar'       => $org->parent_profiles_count,
        ]);
        if ($linked) {
            throw new \App\Exceptions\OrganizationHasLinkedDataException($linked);
        }

        if (mb_strtolower(trim($confirmName)) !== mb_strtolower(trim($org->name))) {
            throw ValidationException::withMessages(['confirm_name' => ["Tasdiqlash uchun bog'cha nomini aynan kiriting."]]);
        }

        $name = $org->name;
        DB::transaction(function () use ($org, $name, $by, $ip) {
            $org->delete(); // soft delete — yozuv bazada qoladi
            ActivityLog::record('organization.deleted', "Bog'cha o'chirildi: {$name}", $by->id, null,
                ['org_name' => $name, 'org_id' => $org->id], $ip);
        });
    }

    /** API javobi (ro'yxat, kartochka va tafsilot uchun bir xil). */
    public function format(Organization $org, ?User $admin = null): array
    {
        $sub = $org->relationLoaded('subscription') ? $org->subscription : null;

        return [
            'id'              => $org->id,
            'name'            => $org->name,
            'type'            => $org->type,
            'type_label'      => Organization::TYPE_LABELS[$org->type] ?? null,
            'official_code'   => $org->official_code,
            'phone'           => $org->phone,
            'email'           => $org->email,
            'website'         => $org->website,
            'region'          => $org->region,
            'address'         => $org->address,
            'district'        => $org->district,
            'number'          => $org->number,
            'mfy'             => $org->mfy,
            'street'          => $org->street,
            'capacity'        => $org->capacity,
            'director_name'   => $org->director_name,
            'director_phone'  => $org->director_phone,
            'director_email'  => $org->director_email,
            'notes'           => $org->notes,
            'is_active'       => $org->is_active,
            'is_demo'         => (bool) $org->is_demo,
            'status'          => $org->status,
            'status_label'    => Organization::STATUS_LABELS[$org->status] ?? $org->status,
            'status_reason'   => $org->status_reason,
            'suspended_until' => $org->suspended_until,
            'status_changed_at' => $org->status_changed_at,
            'created_at'      => $org->created_at,
            'children_count'  => $org->children_count ?? null,
            'groups_count'    => $org->groups_count ?? null,
            'teachers_count'  => $org->teacher_profiles_count ?? null,
            'admin'           => $admin ? [
                'id'       => $admin->id,
                'name'     => $admin->name,
                'username' => $admin->username,
                'phone'    => $admin->phone,
            ] : null,
            'subscription'    => $sub ? [
                'id'             => $sub->id,
                'status'         => $sub->status,
                'ends_at'        => $sub->ends_at,
                'trial_ends_at'  => $sub->trial_ends_at,
                'days_remaining' => $sub->daysRemaining(),
                'plan'           => $sub->plan ? [
                    'id'            => $sub->plan->id,
                    'name'          => $sub->plan->name,
                    'price_monthly' => $sub->plan->price_monthly,
                ] : null,
            ] : null,
        ];
    }

    /** Bog'cha profili maydonlari (yaratish va tahrirlashda). Hisoblanadigan sonlar bu yerda yo'q. */
    public function profileFields(): array
    {
        return ['name', 'type', 'official_code', 'phone', 'email', 'website', 'region', 'district', 'mfy', 'street',
            'address', 'number', 'capacity', 'director_name', 'director_phone', 'director_email', 'notes'];
    }

    private function statusAction(string $status): string
    {
        return match ($status) {
            Organization::STATUS_ACTIVE    => 'organization.activated',
            Organization::STATUS_INACTIVE  => 'organization.deactivated',
            Organization::STATUS_SUSPENDED => 'organization.suspended',
            Organization::STATUS_ARCHIVED  => 'organization.archived',
        };
    }

    /** Eski klientlar: status=trial|paid|... — obuna holati bo'yicha (billing yoqilganda ishlatiladi). */
    private function applyLegacySubscriptionFilter(Builder $query, ?string $status): void
    {
        $latest = '(SELECT status FROM subscriptions WHERE organization_id = organizations.id ORDER BY created_at DESC LIMIT 1)';
        match ($status) {
            'trial'           => $query->whereRaw("{$latest} = 'trial'"),
            'paid'            => $query->whereRaw("{$latest} = 'active'"),
            'payment_overdue' => $query->whereRaw("{$latest} = 'past_due'"),
            'expired'         => $query->whereRaw("{$latest} = 'expired'"),
            'cancelled'       => $query->whereRaw("{$latest} = 'cancelled'"),
            default           => null,
        };
    }

    private function applySort(Builder $query, string $sort, string $direction): void
    {
        $dir = strtolower($direction) === 'asc' ? 'asc' : 'desc';

        if (isset(self::SORTABLE[$sort])) {
            $query->orderBy(self::SORTABLE[$sort], $direction === '' && in_array($sort, ['name', 'type', 'district'], true) ? 'asc' : $dir);
        } else {
            match ($sort) {
                'oldest'              => $query->orderBy('organizations.created_at'),
                'name', 'name_asc'    => $query->orderBy('organizations.name'),
                'name_desc'           => $query->orderByDesc('organizations.name'),
                'children_desc'       => $query->orderByDesc('children_count'),
                'children_asc'        => $query->orderBy('children_count'),
                'subscription_expiry' => $query->orderByRaw(
                    '(SELECT ends_at FROM subscriptions WHERE organization_id = organizations.id ORDER BY created_at DESC LIMIT 1) ASC NULLS LAST'
                ),
                default               => $query->orderByDesc('organizations.created_at'),
            };
        }

        // Barqaror tartib (pagination'da takror/yo'qolish bo'lmasin)
        $query->orderByDesc('organizations.id');
    }
}
