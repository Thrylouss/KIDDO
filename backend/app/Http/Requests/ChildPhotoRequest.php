<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Bola rasmi: faqat JPG/PNG/WEBP, 2 MB gacha, 64–6000 px.
 * Tur fayl kengaytmasi bo'yicha emas, mazmuni (finfo) bo'yicha ham tekshiriladi.
 * Ruxsat controllerda (Policy) — bu yerda faqat validatsiya.
 */
class ChildPhotoRequest extends FormRequest
{
    public const MAX_KB = 2048;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'mimetypes:image/jpeg,image/png,image/webp',
                'max:' . self::MAX_KB,
                'dimensions:min_width=64,min_height=64,max_width=6000,max_height=6000',
            ],
        ];
    }
}
