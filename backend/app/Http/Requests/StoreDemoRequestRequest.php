<?php

namespace App\Http\Requests;

use App\Models\DemoRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Ommaviy «14 kunlik bepul DEMO» arizasi (autentifikatsiyasiz). */
class StoreDemoRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $trim = fn ($v) => is_string($v) ? trim(preg_replace('/\s+/u', ' ', $v)) : $v;
        $this->merge([
            'kindergarten_name' => $trim($this->input('kindergarten_name')),
            'region'            => $trim($this->input('region')),
            'district'          => $trim($this->input('district')),
            'address'           => $trim($this->input('address')) ?: null,
            'director_name'     => $trim($this->input('director_name')),
            'comment'           => is_string($this->input('comment')) ? (trim($this->input('comment')) ?: null) : $this->input('comment'),
            'phone'             => $this->normalizePhone($this->input('phone')),
            'children_count'    => $this->input('children_count') === '' ? null : $this->input('children_count'),
            'groups_count'      => $this->input('groups_count') === '' ? null : $this->input('groups_count'),
        ]);
    }

    public function rules(): array
    {
        return [
            'kindergarten_name' => ['required', 'string', 'min:2', 'max:255'],
            'kindergarten_type' => ['required', Rule::in(DemoRequest::TYPES)],
            'region'            => ['required', 'string', 'max:100'],
            'district'          => ['required', 'string', 'max:100'],
            'address'           => ['nullable', 'string', 'max:500'],
            'director_name'     => ['required', 'string', 'min:3', 'max:255'],
            'phone'             => ['required', 'regex:/^\+998\d{9}$/'],
            'children_count'    => ['nullable', 'integer', 'min:1', 'max:5000'],
            'groups_count'      => ['nullable', 'integer', 'min:1', 'max:300'],
            'comment'           => ['nullable', 'string', 'max:2000'],
            'consent'           => ['accepted'],
            'website'           => ['nullable', 'max:0'], // honeypot — odam to'ldirmaydi
        ];
    }

    public function messages(): array
    {
        return [
            'kindergarten_name.required' => "Bog'cha nomini kiriting.",
            'kindergarten_name.min'      => "Bog'cha nomi juda qisqa.",
            'kindergarten_type.required' => "Bog'cha turini tanlang.",
            'kindergarten_type.in'       => "Bog'cha turini tanlang.",
            'region.required'            => 'Viloyatni tanlang.',
            'district.required'          => 'Tuman yoki shaharni kiriting.',
            'director_name.required'     => 'Rahbarning F.I.Sh. ni kiriting.',
            'director_name.min'          => "F.I.Sh. juda qisqa.",
            'phone.required'             => 'Telefon raqamini kiriting.',
            'phone.regex'                => "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67",
            'children_count.integer'     => "Bolalar soni butun son bo'lishi kerak.",
            'children_count.min'         => "Bolalar soni 1 dan kam bo'lmasin.",
            'children_count.max'         => 'Bolalar soni juda katta.',
            'groups_count.integer'       => "Guruhlar soni butun son bo'lishi kerak.",
            'groups_count.min'           => "Guruhlar soni 1 dan kam bo'lmasin.",
            'groups_count.max'           => 'Guruhlar soni juda katta.',
            'comment.max'                => 'Izoh juda uzun (2000 belgigacha).',
            'consent.accepted'           => "Ma'lumotlarni qayta ishlashga rozilik bering.",
            'website.max'                => "So'rov rad etildi.",
            '*.max'                      => 'Matn juda uzun.',
        ];
    }

    /** +998 (90) 123-45-67, 998901234567, 90 123 45 67 → +998901234567; noto'g'ri bo'lsa asl qiymat qaytadi (regex rad etadi). */
    private function normalizePhone(mixed $v): mixed
    {
        if (! is_string($v) || trim($v) === '') {
            return $v === '' ? null : $v;
        }
        $digits = preg_replace('/\D/', '', $v);
        if (strlen($digits) === 9) {
            $digits = '998' . $digits;
        }

        return preg_match('/^998\d{9}$/', $digits) ? '+' . $digits : $v;
    }

    public function payload(): array
    {
        return collect($this->validated())->except(['consent', 'website'])->all();
    }
}
