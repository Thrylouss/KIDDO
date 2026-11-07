<?php

namespace App\Http\Requests;

use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Bog'cha yaratish/tahrirlash (Super Admin). Rahbar akkaunti va obuna maydonlari faqat yaratishda.
 * Bolalar/guruhlar/tarbiyachilar soni bu yerda yo'q — ular real jadvallardan hisoblanadi.
 */
class OrganizationRequest extends FormRequest
{
    private const UZ_PHONE = '/^\+998\d{9}$/';

    public function authorize(): bool
    {
        return true; // Policy controller'da (Gate::authorize)
    }

    private function isCreate(): bool
    {
        return $this->isMethod('post');
    }

    protected function prepareForValidation(): void
    {
        $clean = fn ($v) => is_string($v) ? (trim(preg_replace('/\s+/u', ' ', $v)) ?: null) : $v;
        $merge = [];
        foreach (['name', 'official_code', 'email', 'region', 'district', 'mfy', 'street', 'address', 'number',
                  'director_name', 'director_email', 'admin_name'] as $f) {
            if ($this->has($f)) {
                $merge[$f] = $clean($this->input($f));
            }
        }
        foreach (['phone', 'director_phone'] as $f) {
            if ($this->has($f)) {
                $merge[$f] = self::normalizePhone($this->input($f));
            }
        }
        if ($this->has('website') && is_string($w = $clean($this->input('website')))) {
            $merge['website'] = preg_match('#^https?://#i', $w) ? $w : "https://{$w}";
        }
        if ($this->has('notes') && is_string($this->input('notes'))) {
            $merge['notes'] = trim($this->input('notes')) ?: null;
        }
        if ($this->has('capacity') && $this->input('capacity') === '') {
            $merge['capacity'] = null;
        }
        if ($this->has('admin_username')) {
            $merge['admin_username'] = mb_strtolower(trim((string) $this->input('admin_username'))) ?: null;
        }
        $this->merge($merge);
    }

    public function rules(): array
    {
        $id      = $this->route('id');
        $create  = $this->isCreate();
        $unique  = fn (string $col) => Rule::unique('organizations', $col)->whereNull('deleted_at')->ignore($id);

        return [
            'name'           => [$create ? 'required' : 'sometimes', 'string', 'min:2', 'max:255'],
            'type'           => [$create ? 'required' : 'sometimes', Rule::in(Organization::TYPES)],
            'official_code'  => ['nullable', 'string', 'max:50', 'regex:/^[\pL\pN\-\/. ]+$/u', $unique('official_code')],
            'phone'          => ['nullable', 'string', 'regex:' . self::UZ_PHONE, $unique('phone')],
            'email'          => ['nullable', 'email', 'max:255'],
            'website'        => ['nullable', 'url', 'max:255'],
            'region'         => ['nullable', 'string', 'max:100'],
            'district'       => ['nullable', 'string', 'max:100'],
            'mfy'            => ['nullable', 'string', 'max:150'],
            'street'         => ['nullable', 'string', 'max:255'],
            'address'        => ['nullable', 'string', 'max:500'],
            'number'         => ['nullable', 'string', 'max:20'],
            'capacity'       => ['nullable', 'integer', 'min:1', 'max:10000'],
            'director_name'  => ['nullable', 'string', 'max:255'],
            'director_phone' => ['nullable', 'string', 'regex:' . self::UZ_PHONE],
            'director_email' => ['nullable', 'email', 'max:255'],
            'notes'          => ['nullable', 'string', 'max:2000'],

            // Faqat yaratishda: rahbar akkaunti (tizim individual vaqtinchalik parol yaratadi)
            ...($create ? [
                'admin_username' => ['nullable', 'string', 'min:3', 'max:32', 'regex:' . \App\Models\User::USERNAME_PATTERN, 'unique:users,username'],
                'admin_name'     => ['nullable', 'string', 'max:255'],
                // Eski klientlar: telefon + Super Admin bergan parol (orqaga moslik)
                'admin_phone'    => ['nullable', 'string', 'max:30', 'unique:users,phone'],
                'admin_email'    => ['nullable', 'email', 'max:255', 'unique:users,email'],
                'admin_password' => ['required_with:admin_phone', 'nullable', 'string', 'min:8'],
                // Obuna (faqat BILLING_ENABLED bo'lganda ishlatiladi)
                'plan_id'             => ['nullable', 'exists:plans,id'],
                'subscription_status' => ['nullable', Rule::in(['active', 'trial', 'past_due'])],
                'starts_at'           => ['nullable', 'date'],
                'ends_at'             => ['nullable', 'date', 'after_or_equal:starts_at'],
                'payment_status'      => ['nullable', Rule::in(['paid', 'pending', 'overdue'])],
            ] : []),
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'          => "Bog'cha nomini kiriting.",
            'name.min'               => "Bog'cha nomi juda qisqa.",
            'name.max'               => "Bog'cha nomi juda uzun (255 belgigacha).",
            'type.required'          => 'Tashkilot turini tanlang: davlat yoki xususiy.',
            'type.in'                => 'Tashkilot turi faqat «Davlat» yoki «Xususiy» bo\'lishi mumkin.',
            'official_code.unique'   => 'Bu rasmiy kod boshqa bog\'chaga biriktirilgan.',
            'official_code.regex'    => 'Rasmiy kodda faqat harf, raqam, «-», «/», «.» bo\'lishi mumkin.',
            'phone.regex'            => "Telefon raqami noto'g'ri. Masalan: +998 71 123 45 67",
            'phone.unique'           => 'Bu telefon raqami boshqa bog\'chada ko\'rsatilgan.',
            'director_phone.regex'   => "Rahbar telefon raqami noto'g'ri. Masalan: +998 90 123 45 67",
            'email.email'            => "Elektron pochta manzili noto'g'ri.",
            'director_email.email'   => "Rahbar elektron pochtasi noto'g'ri.",
            'website.url'            => "Veb-sayt manzili noto'g'ri.",
            'capacity.integer'       => "Quvvat butun son bo'lishi kerak.",
            'capacity.min'           => "Quvvat 1 dan kam bo'lmasin.",
            'capacity.max'           => 'Quvvat juda katta.',
            'notes.max'              => 'Izoh juda uzun (2000 belgigacha).',
            'admin_username.regex'   => "Login lotin harfi bilan boshlansin va faqat kichik lotin harflari, raqamlar, «.», «_», «-» dan iborat bo'lsin.",
            'admin_username.unique'  => 'Bu login band. Boshqa login tanlang.',
            'admin_username.min'     => 'Login kamida 3 belgidan iborat bo\'lsin.',
            'admin_phone.unique'     => 'Bu telefon raqami boshqa foydalanuvchiga tegishli.',
            'admin_password.min'     => 'Parol kamida 8 belgidan iborat bo\'lsin.',
            '*.max'                  => 'Qiymat juda uzun.',
        ];
    }

    /** +998 (71) 123-45-67, 998711234567, 71 123 45 67 → +998711234567; noto'g'ri bo'lsa asl qiymat (regex rad etadi). */
    public static function normalizePhone(mixed $v): mixed
    {
        if (! is_string($v) || trim($v) === '') {
            return is_string($v) ? null : $v;
        }
        $digits = preg_replace('/\D/', '', $v);
        if (strlen($digits) === 9) {
            $digits = '998' . $digits;
        }

        return preg_match('/^998\d{9}$/', $digits) ? '+' . $digits : trim($v);
    }
}
