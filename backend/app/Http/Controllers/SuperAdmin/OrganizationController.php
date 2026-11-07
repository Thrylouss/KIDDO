<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Requests\ChangeOrganizationStatusRequest;
use App\Http\Requests\OrganizationRequest;
use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\AttendanceService;
use App\Services\Export\XlsxWriter;
use App\Services\OrganizationService;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class OrganizationController extends SuperAdminController
{
    public function __construct(private OrganizationService $orgs) {}

    /** Ro'yxat: qidiruv, filtr, saralash, pagination (10/20/50/100). Table va Card ko'rinishlari uchun bir xil. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Organization::class);

        $filters   = $this->filters($request);
        $perPage   = min(max((int) $request->query('per_page', 20), 1), 100);
        $paginated = $this->orgs->query($filters)->paginate($perPage);

        $adminsByOrg = $this->adminsFor(collect($paginated->items())->pluck('id'));

        return response()->json([
            'data' => collect($paginated->items())
                ->map(fn ($org) => $this->orgs->format($org, $adminsByOrg->get($org->id)?->first()))
                ->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    /** Statistika kartochkalari (haqiqiy ma'lumotlar; demo tashkilotlar alohida). */
    public function stats(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Organization::class);

        return response()->json(['data' => $this->orgs->stats((string) $request->query('turi', 'real'))]);
    }

    /** Filtr va forma uchun tanlov qiymatlari — bazadagi mavjud tuman/viloyat/MFY lar. */
    public function filterOptions(): JsonResponse
    {
        Gate::authorize('viewAny', Organization::class);

        return response()->json(['data' => $this->orgs->filterOptions()]);
    }

    /** Excel eksport: joriy filtrlar bo'yicha yoki tanlangan bog'chalar (ids[]). */
    public function export(Request $request): BinaryFileResponse|JsonResponse
    {
        Gate::authorize('export', Organization::class);

        $query = $this->orgs->query($this->filters($request));
        $total = (clone $query)->count();
        if ($total > self::EXPORT_LIMIT) {
            return response()->json([
                'message' => "Eksport uchun natija juda ko'p ({$total}). Filtrlar bilan " . self::EXPORT_LIMIT . " tagacha qisqartiring.",
            ], 422);
        }

        $rows = [[
            '№', "Bog'cha nomi", 'Turi', 'Rasmiy kod', 'Holat', 'Viloyat', 'Tuman/shahar', 'MFY', 'Manzil', 'Telefon',
            'Elektron pochta', "Mas'ul shaxs", "Mas'ul telefoni", 'Bolalar', 'Guruhlar', 'Tarbiyachilar', 'Quvvati', "Qo'shilgan sana",
        ]];
        $i = 0;
        foreach ($query->cursor() as $org) {
            $rows[] = [
                ++$i, $org->name, Organization::TYPE_LABELS[$org->type] ?? '', $org->official_code ?? '',
                Organization::STATUS_LABELS[$org->status] ?? $org->status, $org->region ?? '', $org->district ?? '',
                $org->mfy ?? '', $org->address ?? '', $org->phone ?? '', $org->email ?? '', $org->director_name ?? '',
                $org->director_phone ?? '', (int) $org->children_count, (int) $org->groups_count,
                (int) $org->teacher_profiles_count, $org->capacity ?? '', $org->created_at?->format('d.m.Y') ?? '',
            ];
        }

        $path = (new XlsxWriter())->addSheet("Bog'chalar", $rows, [0],
            [5, 36, 10, 14, 20, 18, 20, 20, 36, 16, 24, 28, 16, 9, 9, 12, 9, 14])->save();

        ActivityLog::record('organization.exported', "Bog'chalar ro'yxati eksport qilindi ({$i} ta)", $request->user()->id, null,
            ['count' => $i], $request->ip());

        return response()->download($path, 'bogchalar-' . now()->format('Y-m-d') . '.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    public function show(int $id, AttendanceService $attendance): JsonResponse
    {
        $org = Organization::with(['subscription.plan', 'statusChanger:id,name'])
            ->withCount([
                'children'        => fn ($q) => $q->where('is_active', true),
                'parentProfiles',
                'groups'          => fn ($q) => $q->active(),
                'teacherProfiles' => fn ($q) => $q->active(),
            ])
            ->findOrFail($id);
        Gate::authorize('view', $org);

        $adminUsers = User::where('organization_id', $id)->where('role', User::ROLE_ADMIN)->orderBy('id')->get();
        $admins = $adminUsers->map(fn (User $u) => [
            'id'                   => $u->id,
            'name'                 => $u->name,
            'username'             => $u->username,
            'phone'                => $u->phone,
            'email'                => $u->email,
            'is_active'            => $u->is_active,
            'must_change_password' => (bool) $u->must_change_password,
            'last_login_at'        => $u->last_login_at,
        ]);

        return response()->json([
            'data' => [
                ...$this->orgs->format($org, $adminUsers->first()),
                'status_changed_by'      => $org->statusChanger?->name,
                'admins'                 => $admins,
                'groups_count'           => $org->groups_count,
                'children_count'         => $org->children_count,
                'teacher_profiles_count' => $org->teacher_profiles_count,
                'parent_profiles_count'  => $org->parent_profiles_count,
                // Faqat agregat sonlar — bola darajasidagi yozuvlar yo'q
                'bugungi_davomat'        => $attendance->organizationSummary($org->id, AttendanceService::today()),
            ],
        ]);
    }

    public function store(OrganizationRequest $request): JsonResponse
    {
        Gate::authorize('create', Organization::class);

        $result = $this->orgs->create($request->validated(), $request->user(), $request->ip());

        return response()->json([
            'message' => $result['admin']
                ? "Bog'cha va rahbar akkaunti yaratildi. Vaqtinchalik parol faqat hozir ko'rsatiladi."
                : "Bog'cha muvaffaqiyatli yaratildi.",
            'data'    => ['id' => $result['organization']->id, 'admin' => $result['admin']],
        ], 201);
    }

    public function update(OrganizationRequest $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('update', $org);

        $org = $this->orgs->update($org, $request->validated(), $request->user(), $request->ip());

        return response()->json(['message' => "Bog'cha ma'lumotlari saqlandi.", 'data' => $this->orgs->format($org)]);
    }

    /** Faollik holati: faol / faol emas / vaqtincha to'xtatilgan (muddat bilan) / arxivlangan. */
    public function changeStatus(ChangeOrganizationStatusRequest $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('changeStatus', $org);

        $until = $request->validated('suspended_until');
        $org = $this->orgs->changeStatus($org, $request->validated('status'), $request->validated('reason'),
            $until ? CarbonImmutable::parse($until) : null, $request->user(), $request->ip());

        return response()->json([
            'message' => "Bog'cha holati o'zgartirildi: " . Organization::STATUS_LABELS[$org->status] . '.',
            'data'    => $this->orgs->format($org),
        ]);
    }

    /** Ommaviy: tanlangan bog'chalarni arxivlash, tiklash (faollashtirish) yoki to'xtatish. O'chirish yo'q. */
    public function bulkStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'    => ['required', 'array', 'min:1', 'max:100'],
            'ids.*'  => ['integer', 'distinct'],
            'status' => ['required', Rule::in([Organization::STATUS_ARCHIVED, Organization::STATUS_ACTIVE, Organization::STATUS_SUSPENDED])],
            'reason' => [Rule::requiredIf(fn () => $request->input('status') !== Organization::STATUS_ACTIVE), 'nullable', 'string', 'min:3', 'max:500'],
        ], [
            'ids.required'    => "Kamida bitta bog'chani tanlang.",
            'ids.max'         => "Bir martada ko'pi bilan 100 ta bog'cha.",
            'status.in'       => "Ommaviy amal uchun noto'g'ri holat.",
            'reason.required' => 'Sababni kiriting.',
            'reason.min'      => 'Sabab juda qisqa.',
        ]);

        foreach (Organization::whereIn('id', $data['ids'])->get() as $org) {
            Gate::authorize('changeStatus', $org);
        }

        $result = $this->orgs->bulkChangeStatus(array_map('intval', $data['ids']), $data['status'], $data['reason'] ?? null,
            $request->user(), $request->ip());

        return response()->json([
            'message' => count($result['changed']) . " ta bog'cha holati o'zgartirildi"
                . ($result['skipped'] ? ', ' . count($result['skipped']) . " tasi o'tkazib yuborildi." : '.'),
            'data'    => $result,
        ]);
    }

    public function statusHistory(int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('view', $org);

        $history = $org->statusChanges()->with('changer:id,name')->limit(50)->get()->map(fn ($c) => [
            'id'              => $c->id,
            'from_status'     => $c->from_status,
            'to_status'       => $c->to_status,
            'from_label'      => Organization::STATUS_LABELS[$c->from_status] ?? $c->from_status,
            'to_label'        => Organization::STATUS_LABELS[$c->to_status] ?? $c->to_status,
            'reason'          => $c->reason,
            'suspended_until' => $c->suspended_until,
            'changed_by'      => $c->changer?->name,
            'created_at'      => $c->created_at,
        ]);

        return response()->json(['data' => $history]);
    }

    /** Eski endpoint (orqaga moslik) → holat: faol. */
    public function activate(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('changeStatus', $org);
        if ($org->status !== Organization::STATUS_ACTIVE) {
            $this->orgs->changeStatus($org, Organization::STATUS_ACTIVE, null, null, $request->user(), $request->ip());
        }

        return response()->json(['message' => "Bog'cha faollashtirildi."]);
    }

    /** Eski endpoint (orqaga moslik) → holat: faol emas; barcha sessiyalar bekor qilinadi. */
    public function deactivate(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('changeStatus', $org);
        if ($org->status !== Organization::STATUS_INACTIVE) {
            $this->orgs->changeStatus($org, Organization::STATUS_INACTIVE, $request->input('reason'), null, $request->user(), $request->ip());
        }

        return response()->json(['message' => "Bog'cha faolsizlantirildi."]);
    }

    /**
     * O'chirish (soft delete) — faqat bog'langan ma'lumoti yo'q bog'cha va nomi qayta kiritilgan bo'lsa.
     * Bog'langan ma'lumotli bog'cha uchun 422 — o'rniga arxivlash.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('delete', $org);

        $this->orgs->delete($org, (string) $request->input('confirm_name', ''), $request->user(), $request->ip());

        return response()->json(['message' => "Bog'cha o'chirildi."]);
    }

    /** Tafsilot: guruhlar (sig'im, bolalar soni, tarbiyachilar). */
    public function groups(int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('view', $org);

        $groups = $org->groups()
            ->withCount(['children' => fn ($q) => $q->where('is_active', true)])
            ->with(['teacherProfiles' => fn ($q) => $q->with('user:id,name')])
            ->orderByDesc('is_active')->orderBy('name')
            ->get()
            ->map(fn ($g) => [
                'id'             => $g->id,
                'name'           => $g->name,
                'age_category'   => $g->age_category,
                'capacity'       => $g->capacity,
                'is_active'      => (bool) $g->is_active,
                'children_count' => $g->children_count,
                'teachers'       => $g->teacherProfiles->map(fn ($t) => $t->user?->name)->filter()->values(),
            ]);

        return response()->json(['data' => $groups]);
    }

    /** Tafsilot: tarbiyachilar (ish aloqasi uchun ism, telefon, guruhlar). */
    public function teachers(int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('view', $org);

        $teachers = $org->teacherProfiles()
            ->with(['user:id,name,phone,username,last_login_at,is_active', 'groups:id,name'])
            ->orderByDesc('is_active')
            ->get()
            ->map(fn ($t) => [
                'id'            => $t->id,
                'name'          => $t->user?->name,
                'phone'         => $t->user?->phone,
                'username'      => $t->user?->username,
                'is_active'     => (bool) $t->is_active && (bool) $t->user?->is_active,
                'last_login_at' => $t->user?->last_login_at,
                'groups'        => $t->groups->pluck('name')->values(),
            ])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values();

        return response()->json(['data' => $teachers]);
    }

    /**
     * Tafsilot: bolalar — faqat agregat (guruh, jins, yosh bo'yicha). Super Admin'ga bolalarning
     * ism-familiyasi, tibbiy ma'lumoti va ota-onalari ko'rsatilmaydi.
     */
    public function childrenSummary(int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('view', $org);

        $children = Child::forOrganization($org->id)->get(['id', 'group_id', 'gender', 'birth_date', 'is_active']);
        $active   = $children->where('is_active', true);
        $groupNames = Group::where('organization_id', $org->id)->pluck('name', 'id');

        $ages = $active->groupBy(fn ($c) => $c->birth_date ? (string) Carbon::parse($c->birth_date)->age : '')
            ->map->count()->sortKeys();

        return response()->json(['data' => [
            'jami'       => $children->count(),
            'faol'       => $active->count(),
            'nofaol'     => $children->count() - $active->count(),
            'jins'       => [
                'ogil' => $active->where('gender', 'erkak')->count(),
                'qiz'  => $active->where('gender', 'ayol')->count(),
            ],
            'guruhlar'   => $active->groupBy('group_id')->map(fn ($g, $gid) => [
                'group' => $gid ? ($groupNames[$gid] ?? '—') : 'Guruhsiz',
                'count' => $g->count(),
            ])->values()->sortByDesc('count')->values(),
            'yosh'       => $ages->map(fn ($c, $age) => ['age' => $age === '' ? null : (int) $age, 'count' => $c])->values(),
        ]]);
    }

    /** Tafsilot: so'nggi kunlar davomati (agregat). */
    public function attendance(Request $request, int $id, AttendanceService $attendance): JsonResponse
    {
        $org = Organization::findOrFail($id);
        Gate::authorize('view', $org);

        $days  = min(max((int) $request->query('days', 14), 1), 31);
        $today = AttendanceService::today();
        $data  = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $today->subDays($i);
            if ($date->isWeekend()) {
                continue;
            }
            $data[] = $attendance->organizationSummary($org->id, $date);
        }

        return response()->json(['data' => $data]);
    }

    public function enter(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        ActivityLog::record(
            'organization.entered',
            "Super Admin bog'cha paneliga kirdi: {$org->name}",
            $request->user()->id,
            $org->id,
            [],
            $request->ip()
        );

        return response()->json(['message' => 'OK', 'data' => ['organization_id' => $org->id]]);
    }

    /**
     * Rahbar parolini yangilash. Parol berilmasa — tizim individual vaqtinchalik parol yaratadi
     * (javobda bir marta qaytariladi) va rahbar birinchi kirishda uni almashtiradi.
     */
    public function resetPassword(Request $request, int $id, AccountProvisioningService $accounts): JsonResponse
    {
        Organization::findOrFail($id);

        $data = $request->validate([
            'password' => 'nullable|string|min:8',
        ]);

        $admin = User::where('organization_id', $id)
            ->where('role', User::ROLE_ADMIN)
            ->orderBy('id')
            ->firstOrFail();

        // Eski sessiyalar darhol bekor qilinadi (o'g'irlangan sessiya ham)
        $temporary = $accounts->resetPassword($admin, $data['password'] ?? null, $request->user(), $request->ip());

        ActivityLog::record(
            'admin.password_reset',
            "Admin paroli yangilandi: {$admin->name}",
            $request->user()->id,
            $id,
            ['admin_id' => $admin->id],
            $request->ip()
        );

        return response()->json([
            'message' => 'Admin paroli muvaffaqiyatli yangilandi.',
            'data'    => array_filter([
                'username'           => $admin->username,
                'temporary_password' => $temporary,
            ]),
        ]);
    }

    /**
     * Bog'cha rahbari akkaunti (username + tizim yaratgan vaqtinchalik parol). Har bog'chada bitta rahbar akkaunti;
     * akkaunt aynan shu bog'chaga biriktiriladi. Parol faqat shu javobda bir marta qaytariladi.
     */
    public function createAdminAccount(Request $request, int $id, AccountProvisioningService $accounts): JsonResponse
    {
        $org = Organization::findOrFail($id);

        if (! AccountProvisioningService::supportsUsername() || ! AccountProvisioningService::supportsPasswordChange()) {
            return response()->json(['message' => "Baza tayyor emas: migratsiya bajarilmagan."], 422);
        }

        $request->merge(['username' => mb_strtolower(trim((string) $request->input('username')))]);
        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:32', 'regex:' . User::USERNAME_PATTERN, 'unique:users,username'],
            'name'     => ['nullable', 'string', 'max:255'],
        ], [
            'username.regex'  => "Login lotin harfi bilan boshlansin va faqat kichik lotin harflari, raqamlar, «.», «_», «-» dan iborat bo'lsin.",
            'username.unique' => "Bu login band. Boshqa login tanlang.",
        ]);

        if (User::where('organization_id', $org->id)->where('role', User::ROLE_ADMIN)->exists()) {
            return response()->json([
                'message' => "Bu bog'chada rahbar akkaunti allaqachon bor. Kerak bo'lsa, parolini yangilang.",
            ], 422);
        }

        $result = $accounts->createOrganizationAdmin(
            $org,
            $data['username'],
            ($data['name'] ?? null) ?: ($org->director_name ?: "{$org->name} rahbari"),
            $request->user(),
            $request->ip(),
        );

        return response()->json([
            'message' => "Rahbar akkaunti yaratildi. Vaqtinchalik parol faqat hozir ko'rsatiladi.",
            'data'    => [
                'id'                 => $result['user']->id,
                'name'               => $result['user']->name,
                'username'           => $result['user']->username,
                'temporary_password' => $result['temporary_password'],
            ],
        ], 201);
    }

    public function payments(int $id): JsonResponse
    {
        Organization::findOrFail($id);

        $payments = Payment::where('organization_id', $id)
            ->with(['subscription.plan', 'invoice:id,invoice_number'])
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn($p) => [
                'id'             => $p->id,
                'amount'         => $p->amount,
                'currency'       => $p->currency,
                'status'         => $p->status,
                'payment_method' => $p->payment_method,
                'transaction_id' => $p->transaction_id,
                'invoice_number' => $p->invoice?->invoice_number,
                'paid_at'        => $p->paid_at,
                'notes'          => $p->notes,
                'created_at'     => $p->created_at,
                'plan_name'      => $p->subscription?->plan?->name,
            ]);

        return response()->json(['data' => $payments]);
    }

    public function activityLogs(int $id): JsonResponse
    {
        Organization::findOrFail($id);

        $logs = ActivityLog::where('organization_id', $id)
            ->with(['user:id,name'])
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn($log) => [
                'id'          => $log->id,
                'action'      => $log->action,
                'description' => $log->description,
                'created_at'  => $log->created_at,
                'user'        => $log->user
                    ? ['id' => $log->user->id, 'name' => $log->user->name]
                    : null,
            ]);

        return response()->json(['data' => $logs]);
    }

    public function renewSubscription(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        $data = $request->validate([
            'plan_id'        => 'required|exists:plans,id',
            'ends_at'        => 'required|date|after:today',
            'payment_status' => ['required', Rule::in(['paid', 'pending', 'overdue'])],
            'notes'          => 'nullable|string|max:500',
        ]);

        $plan    = Plan::findOrFail($data['plan_id']);
        $sub     = $org->subscription;
        $service = app(SubscriptionService::class);

        if ($sub) {
            $service->renewSubscription($sub, $plan, [
                'ends_at'        => $data['ends_at'],
                'payment_status' => $data['payment_status'],
                'notes'          => $data['notes'] ?? null,
                'user_id'        => $request->user()->id,
                'ip'             => $request->ip(),
            ]);
        } else {
            $service->createSubscription($org, $plan, [
                'status'         => Subscription::STATUS_ACTIVE,
                'ends_at'        => $data['ends_at'],
                'payment_status' => $data['payment_status'],
                'notes'          => $data['notes'] ?? null,
                'user_id'        => $request->user()->id,
                'ip'             => $request->ip(),
            ]);
        }

        return response()->json(['message' => 'Obuna muvaffaqiyatli uzaytirildi.']);
    }

    /** Eksportda bir martada ko'pi bilan shuncha qator (server xotirasi uchun). */
    private const EXPORT_LIMIT = 5000;

    /** Ro'yxat va eksport uchun umumiy filtr parametrlari. */
    private function filters(Request $request): array
    {
        $ids = $request->query('ids');

        return [
            'search'       => (string) $request->query('search', ''),
            'type'         => $request->query('type'),
            'status'       => $request->query('status'),
            'district'     => $request->query('district'),
            'region'       => $request->query('region'),
            'created_from' => $this->date($request->query('created_from')),
            'created_to'   => $this->date($request->query('created_to')),
            'children_min' => is_numeric($request->query('children_min')) ? (int) $request->query('children_min') : '',
            'children_max' => is_numeric($request->query('children_max')) ? (int) $request->query('children_max') : '',
            'groups_min'   => is_numeric($request->query('groups_min')) ? (int) $request->query('groups_min') : '',
            'groups_max'   => is_numeric($request->query('groups_max')) ? (int) $request->query('groups_max') : '',
            'mfy'          => $request->query('mfy'),
            'turi'         => (string) $request->query('turi', 'real'),
            'ids'          => is_array($ids) ? array_filter($ids, 'is_numeric') : (is_string($ids) && $ids !== '' ? array_filter(explode(',', $ids), 'is_numeric') : []),
            'sort'         => (string) $request->query('sort', 'newest'),
            'direction'    => (string) $request->query('direction', ''),
        ];
    }

    private function date(mixed $v): ?string
    {
        return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }

    /** @return \Illuminate\Support\Collection<int, \Illuminate\Support\Collection<int, User>> */
    private function adminsFor($orgIds)
    {
        return User::where('role', User::ROLE_ADMIN)
            ->whereIn('organization_id', $orgIds)
            ->select(['id', 'name', 'phone', 'organization_id', ...(AccountProvisioningService::supportsUsername() ? ['username'] : [])])
            ->orderBy('id')
            ->get()
            ->groupBy('organization_id');
    }
}
