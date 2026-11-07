<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Guruh rasmi: faqat JPG/PNG/WEBP, 5 MB gacha, 64–6000 px; tur mazmuni (finfo) bo'yicha ham tekshiriladi.
 * Guruh ruxsati controllerda (bog'cha / tarbiyachi guruhi) — bu yerda faqat validatsiya.
 */
class GroupPhotoRequest extends FormRequest
{
    public const MAX_KB = 5120;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'group_id' => ['required', 'integer'],
            'caption'  => ['nullable', 'string', 'max:255'],
            'taken_on' => ['nullable', 'date', 'before_or_equal:today'],
            'photo'    => [
                'required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp',
                'max:' . self::MAX_KB, 'dimensions:min_width=64,min_height=64,max_width=6000,max_height=6000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.required' => "Rasmni tanlang.",
            'photo.image'    => "Faqat rasm (JPG, PNG yoki WEBP) yuklang.",
            'photo.mimes'    => "Faqat JPG, PNG yoki WEBP rasm yuklang.",
            'photo.max'      => "Rasm hajmi 5 MB dan oshmasin.",
        ];
    }
}
