<?php

namespace App\Http\Controllers\Admin;

use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\MemberAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class TeacherController extends AdminController
{
    public function __construct(private MemberAccountService $members, private AccountProvisioningService $accounts) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', TeacherProfile::class);

        // Login (username) va «parolni almashtirishi kerak» holati — ro'yxatda ko'rsatish uchun
        $userColumns = array_filter(['id', AccountProvisioningService::supportsUsername() ? 'username' : null,
            AccountProvisioningService::supportsPasswordChange() ? 'must_change_password' : null, 'last_login_at']);
        $teachers = TeacherProfile::forOrganization($this->orgId($request))
                                  ->with(['groups:id,name', 'user:' . implode(',', $userColumns)])
                                  ->orderBy('last_name')
                                  ->orderBy('first_name')
                                  ->get();

        return response()->json(['data' => $teachers]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', TeacherProfile::class);
        $orgId = $this->orgId($request);

        // Login: username (yangi) va/yoki telefon (eski usul). Parol berilmasa — tizim vaqtinchalik parol yaratadi.
        if ($request->filled('username')) {
            $request->merge(['username' => mb_strtolower(trim((string) $request->input('username')))]);
        }
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'username'   => [AccountProvisioningService::supportsUsername() ? 'nullable' : 'prohibited', 'string', 'min:3', 'max:32',
                             'regex:' . User::USERNAME_PATTERN, 'unique:users,username'],
            'phone'      => ['required_without:username', 'nullable', 'string', 'max:20', 'unique:users,phone'],
            'password'   => ['nullable', 'string', 'min:8'],
            'position'   => ['nullable', 'string', 'max:100'],
        ], [
            'username.regex'         => "Login lotin harfi bilan boshlansin va faqat kichik lotin harflari, raqamlar, «.», «_», «-» dan iborat bo'lsin.",
            'username.unique'        => "Bu login band. Boshqa login tanlang.",
            'phone.required_without' => "Login yoki telefon raqamini kiriting.",
        ]);
        $temporary = empty($data['password']) ? AccountProvisioningService::temporaryPassword() : null;

        if (Organization::findOrFail($orgId)->hasReachedPlanLimit('max_teachers')) {
            return response()->json([
                'message' => "Reja limiti: tarbiyachilar soni chegarasiga yetildi.",
            ], 422);
        }

        $teacher = DB::transaction(function () use ($data, $orgId, $temporary) {
            $user = User::create([
                'name'            => "{$data['first_name']} {$data['last_name']}",
                'phone'           => $data['phone'] ?? null,
                'password'        => Hash::make($data['password'] ?? $temporary),
                'role'            => User::ROLE_TEACHER,
                'organization_id' => $orgId,
                'is_active'       => true,
                ...(! empty($data['username']) ? ['username' => $data['username']] : []),
            ]);
            if ($temporary !== null) {
                $this->accounts->requirePasswordChange($user);
            }

            return TeacherProfile::create([
                'user_id'         => $user->id,
                'organization_id' => $orgId,
                'first_name'      => $data['first_name'],
                'last_name'       => $data['last_name'],
                'phone'           => $data['phone'] ?? null,
                'position'        => $data['position'] ?? 'Tarbiyachi',
                'is_active'       => true,
            ]);
        });

        return response()->json([
            'data'    => $teacher,
            // Vaqtinchalik parol faqat shu javobda bir marta qaytariladi (bazada — faqat hash)
            'account' => array_filter([
                'username'           => $data['username'] ?? null,
                'phone'              => $data['phone'] ?? null,
                'temporary_password' => $temporary,
            ]),
            'message' => "Tarbiyachi muvaffaqiyatli qo'shildi.",
        ], 201);
    }

    /** Tarbiyachining guruhlarini to'liq almashtiradi (bo'sh ro'yxat — barchasidan ajratadi). */
    public function syncGroups(Request $request, int $id): JsonResponse
    {
        $orgId   = $this->orgId($request);
        $teacher = TeacherProfile::forOrganization($orgId)->findOrFail($id);
        Gate::authorize('update', $teacher);

        $data = $request->validate([
            'group_ids'   => ['present', 'array'],
            'group_ids.*' => ['integer', 'distinct'],
        ]);

        $groupIds = array_map('intval', $data['group_ids']);

        // Barcha guruhlar shu bog'chaga tegishli bo'lishi shart
        $found = Group::forOrganization($orgId)->whereIn('id', $groupIds)->count();
        if ($found !== count($groupIds)) {
            return response()->json(['message' => "Guruh topilmadi."], 404);
        }

        // assigned_at faqat yangi biriktirishlar uchun yoziladi
        $existing = $teacher->groups()->pluck('groups.id')->all();

        // Faol bo'lmagan tarbiyachiga yangi guruh berilmaydi (ajratish esa mumkin)
        $adding = array_diff($groupIds, $existing);
        if ($adding && (! $teacher->is_active || ! $teacher->user?->is_active)) {
            return response()->json(['message' => "Faol bo'lmagan tarbiyachini guruhga biriktirib bo'lmaydi."], 422);
        }
        $teacher->groups()->sync(
            collect($groupIds)->mapWithKeys(fn (int $groupId) => [
                $groupId => in_array($groupId, $existing, true) ? [] : ['assigned_at' => now()->toDateString()],
            ])->all()
        );

        return response()->json([
            'data'    => $teacher->load('groups:id,name'),
            'message' => "Tarbiyachi guruhlari yangilandi.",
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);

        $data = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'  => ['sometimes', 'required', 'string', 'max:100'],
            // Telefon login uchun ishlatiladi — butun tizim bo'yicha unikal (o'z akkaunti bundan mustasno)
            'phone'      => ['sometimes', 'required', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($profile->user_id)],
            'position'   => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        if (array_key_exists('position', $data)) {
            $data['position'] = $data['position'] ?: 'Tarbiyachi';
        }

        $this->members->update($profile, $data, $request->user(), $request->ip());

        return response()->json([
            'data'    => $profile->fresh()->load('groups:id,name'),
            'message' => "Tarbiyachi ma'lumotlari yangilandi.",
        ]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);
        $this->members->setActive($profile, true, $request->user(), $request->ip());

        return response()->json(['message' => "Tarbiyachi faollashtirildi."]);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);
        $this->members->setActive($profile, false, $request->user(), $request->ip());

        return response()->json(['message' => "Tarbiyachi faolsizlantirildi. Uning barcha sessiyalari yakunlandi."]);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);

        $data = $request->validate([
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        // Parol berilmasa — tizim vaqtinchalik parol yaratadi, birinchi kirishda almashtiriladi
        if (! empty($data['password'])) {
            $this->members->resetPassword($profile, $data['password'], $request->user(), $request->ip());
            $temporary = null;
        } else {
            $temporary = $this->accounts->resetPassword($profile->user, null, $request->user(), $request->ip());
        }

        return response()->json([
            'message' => "Parol yangilandi. Barcha qurilmalardagi sessiyalar yakunlandi.",
            'data'    => array_filter(['temporary_password' => $temporary]),
        ]);
    }

    /** O'z bog'chasidagi, to'g'ri rolli foydalanuvchiga bog'langan profil; aks holda 404. */
    private function findMember(Request $request, int $id): TeacherProfile
    {
        $profile = TeacherProfile::forOrganization($this->orgId($request))->with('user')->findOrFail($id);
        Gate::authorize('update', $profile);
        abort_unless($profile->user?->role === User::ROLE_TEACHER, 404, "Ma'lumot topilmadi.");

        return $profile;
    }
}
