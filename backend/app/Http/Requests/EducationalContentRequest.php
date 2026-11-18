<?php

namespace App\Http\Requests;

use App\Models\EducationalContent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * KIDDO Kids kontenti: faqat oddiy matn maydonlari. YouTube havolasi alohida (YouTubeVideo::parseId) tekshiriladi —
 * HTML yoki iframe kodi qabul qilinmaydi. Yangilashda (PUT) maydonlar ixtiyoriy.
 */
class EducationalContentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $req = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'youtube_url' => [$req, 'string', 'max:500'],
            'title'       => [$req, 'string', 'min:2', 'max:200', 'not_regex:/<[^>]*>/'],
            'description' => ['nullable', 'string', 'max:2000', 'not_regex:/<[^>]*>/'],
            'language'    => [$req, Rule::in(EducationalContent::LANGUAGES)],
            'category'    => [$req, Rule::in(EducationalContent::CATEGORIES)],
            'min_age'     => [$req, 'integer', 'between:' . EducationalContent::MIN_AGE . ',' . EducationalContent::MAX_AGE],
            'max_age'     => [$req, 'integer', 'between:' . EducationalContent::MIN_AGE . ',' . EducationalContent::MAX_AGE],
            'status'      => ['sometimes', Rule::in(EducationalContent::STATUSES)],
            'group_ids'   => ['sometimes', 'array', 'max:100'],
            'group_ids.*' => ['integer', 'distinct'],
        ];
    }

    public function messages(): array
    {
        return [
            'youtube_url.required' => "YouTube havolasini kiriting.",
            'title.required'       => "Video nomini kiriting.",
            'title.min'            => "Nom juda qisqa.",
            'title.max'            => "Nom 200 belgidan oshmasin.",
            'title.not_regex'      => "Nomda HTML teglari bo'lmasin.",
            'description.max'      => "Tavsif 2000 belgidan oshmasin.",
            'description.not_regex' => "Tavsifda HTML teglari bo'lmasin.",
            'language.*'           => "Tilni tanlang: O'zbekcha, Русский yoki English.",
            'category.*'           => "Kategoriyani tanlang.",
            'min_age.*'            => "Minimal yosh 1 dan 7 gacha bo'lsin.",
            'max_age.*'            => "Maksimal yosh 1 dan 7 gacha bo'lsin.",
            'status.in'            => "Noto'g'ri holat.",
            'group_ids.*'          => "Guruhlar noto'g'ri tanlangan.",
        ];
    }
}
