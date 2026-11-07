<?php

namespace App\Http\Controllers\Admin;

use App\Models\Child;
use App\Models\ParentProfile;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\MemberAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ParentController extends AdminController
{
    public function __construct(private MemberAccountService $members, private AccountProvisioningService $accounts) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', ParentProfile::class);

        $parents = ParentProfile::forOrganization($this->orgId($request))
                                ->with(['children:id,first_name,last_name', 'user:' . implode(',', array_filter(['id', 'is_active',
                                    AccountProvisioningService::supportsUsername() ? 'username' : null,
                                    AccountProvisioningService::supportsPasswordChange() ? 'must_change_password' : null, 'last_login_at']))])
                                ->orderBy('last_name')
                                ->orderBy('first_name')
                                ->get();

        return response()->json(['data' => $parents]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', ParentProfile::class);
        $orgId = $this->orgId($request);

        // Login: username (mobil ilova uchun) va/yoki telefon. Parol berilmasa — tizim vaqtinchalik parol yaratadi.
        if ($request->filled('username')) {
            $request->merge(['username' => mb_strtolower(trim((string) $request->input('username')))]);
        }
        $data = $request->validate([
            'first_name'    => ['required', 'string', 'max:100'],
            'last_name'     => ['required', 'string', 'max:100'],
            'username'      => [AccountProvisioningService::supportsUsername() ? 'nullable' : 'prohibited', 'string', 'min:3', 'max:32',
                                'regex:' . User::USERNAME_PATTERN, 'unique:users,username'],
            'phone'         => ['required_without:username', 'nullable', 'string', 'max:20', 'unique:users,phone'],
            'password'      => ['nullable', 'string', 'min:8'],
            'relation_type' => ['required', Rule::in(ParentProfile::RELATION_TYPES)],
            // Ixtiyoriy: shu bog'chadagi bolaga darhol biriktirish
            'child_id'      => ['nullable', 'integer'],
            'is_primary'    => ['sometimes', 'boolean'],
        ], [
            'username.regex'         => "Login lotin harfi bilan boshlansin va faqat kichik lotin harflari, raqamlar, «.», «_», «-» dan iborat bo'lsin.",
            'username.unique'        => "Bu login band. Boshqa login tanlang.",
            'phone.required_without' => "Login yoki telefon raqamini kiriting.",
        ]);

        // `exists:` ishlatilmaydi — boshqa bog'cha bolasining mavjudligi oshkor bo'lmasin
        $child = null;
        if (! empty($data['child_id'])) {
            $child = Child::forOrganization($orgId)->find($data['child_id']);
            if (! $child) {
                return response()->json(['message' => "Bola topilmadi."], 404);
            }
            Gate::authorize('update', $child);
        }

        $temporary = empty($data['password']) ? AccountProvisioningService::temporaryPassword() : null;

        $parent = DB::transaction(function () use ($data, $orgId, $temporary, $child) {
            $user = User::create([
                'name'            => "{$data['first_name']} {$data['last_name']}",
                'phone'           => $data['phone'] ?? null,
                'password'        => Hash::make($data['password'] ?? $temporary),
                'role'            => User::ROLE_PARENT,
                'organization_id' => $orgId,
                'is_active'       => true,
                ...(! empty($data['username']) ? ['username' => $data['username']] : []),
            ]);
            if ($temporary !== null) {
                $this->accounts->requirePasswordChange($user);
            }

            $parent = ParentProfile::create([
                'user_id'         => $user->id,
                'organization_id' => $orgId,
                'first_name'      => $data['first_name'],
                'last_name'       => $data['last_name'],
                'phone'           => $data['phone'] ?? null,
                'relation_type'   => $data['relation_type'],
            ]);

            $child?->linkParent($parent, $data['relation_type'], (bool) ($data['is_primary'] ?? false));

            return $parent;
        });

        return response()->json([
            'data'    => $parent->load('children:id,first_name,last_name'),
            // Vaqtinchalik parol faqat shu javobda bir marta qaytariladi (bazada — faqat hash)
            'account' => array_filter([
                'username'           => $data['username'] ?? null,
                'phone'              => $data['phone'] ?? null,
                'temporary_password' => $temporary,
            ]),
            'message' => "Ota-ona muvaffaqiyatli qo'shildi.",
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);

        $data = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'  => ['sometimes', 'required', 'string', 'max:100'],
            // Telefon login uchun ishlatiladi — butun tizim bo'yicha unikal (o'z akkaunti bundan mustasno)
            'phone'      => ['sometimes', 'required', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($profile->user_id)],
            'relation_type' => ['sometimes', 'required', Rule::in(ParentProfile::RELATION_TYPES)],
        ]);

        $this->members->update($profile, $data, $request->user(), $request->ip());

        return response()->json([
            'data'    => $profile->fresh()->load(['children:id,first_name,last_name', 'user:id,is_active']),
            'message' => "Ota-ona ma'lumotlari yangilandi.",
        ]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);
        $this->members->setActive($profile, true, $request->user(), $request->ip());

        return response()->json(['message' => "Ota-ona faollashtirildi."]);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);
        $this->members->setActive($profile, false, $request->user(), $request->ip());

        return response()->json(['message' => "Ota-ona faolsizlantirildi. Uning barcha sessiyalari (mobil ilova ham) yakunlandi."]);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $profile = $this->findMember($request, $id);

        $data = $request->validate([
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        // Parol berilmasa — tizim vaqtinchalik parol yaratadi; ota-ona keyingi kirishda (mobil ilovada ham) almashtiradi
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
    private function findMember(Request $request, int $id): ParentProfile
    {
        $profile = ParentProfile::forOrganization($this->orgId($request))->with('user')->findOrFail($id);
        Gate::authorize('update', $profile);
        abort_unless($profile->user?->role === User::ROLE_PARENT, 404, "Ma'lumot topilmadi.");

        return $profile;
    }
}
