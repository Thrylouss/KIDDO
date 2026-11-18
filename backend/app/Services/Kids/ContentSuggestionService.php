<?php

namespace App\Services\Kids;

use App\Models\EducationalContent;
use App\Models\Group;
use Illuminate\Support\Collection;

/**
 * Kontent qo'shishni tezlashtiruvchi DASTLABKI tavsiyalar (kalit so'zlar asosida, AI/pullik servis talab qilmaydi).
 * Muhim: bu tavsiyalar videoning bolalar uchun xavfsizligini kafolatlamaydi — yakuniy qarorni rahbar qabul qiladi.
 * Yosh tavsiyasi ataylab ehtiyotkor: aniq belgi bo'lmasa, kichik yoshlar uchun tavsiya qilinmaydi.
 */
class ContentSuggestionService
{
    private const CATEGORY_KEYWORDS = [
        'music'     => ["qo'shiq", 'qoshiq', 'musiqa', 'song', 'songs', 'music', 'nursery rhyme', 'lullaby', 'песн', 'песен', 'музык', 'колыбел'],
        'languages' => ['alphabet', 'abc', 'alifbo', 'english for kids', 'learn english', 'ingliz tili', 'rus tili', "o'zbek tili", 'phonics', 'английск', 'алфавит', 'азбук', 'учим буквы', 'words for kids'],
        'cartoons'  => ['multfilm', 'multik', 'cartoon', 'animation', 'мультфильм', 'мультик'],
        'lessons'   => ['sanash', 'raqam', 'ranglar', 'shakllar', 'counting', 'numbers', 'colors', 'colours', 'shapes', 'math', 'lesson', 'learn', 'счёт', 'счет', 'цифр', 'цвета', 'фигур', 'урок'],
        'activities' => ['exercise', 'yoga', 'dance', 'craft', 'puzzle', 'mashq', "o'yin", 'raqs', 'зарядк', 'танц', 'поделк', 'игра'],
    ];

    /** Faqat aniq «kichik yosh uchun» iboralari (masalan, «Baby Shark» nomidagi «baby» yoshni pasaytirmaydi). */
    private const TODDLER = ['for toddlers', 'toddler learning', 'for babies', 'chaqaloqlar uchun', 'для малышей', 'для самых маленьких'];

    /**
     * @param array{title?: ?string, author?: ?string, audio_language?: ?string} $meta
     * @return array{language: string, category: string, min_age: int, max_age: int, group_ids: int[], confidence: string}
     */
    public function suggest(array $meta, Collection $groups): array
    {
        $text = mb_strtolower(trim(($meta['title'] ?? '') . ' ' . ($meta['author'] ?? '')));

        $language = $meta['audio_language'] ?? $this->language($text);
        $category = $this->category($text);
        [$min, $max] = $this->ages($text);

        $groupIds = $groups
            ->filter(function (Group $g) use ($min, $max) {
                $range = $g->ageRange();
                return $range !== null && $range[0] <= $max && $range[1] >= $min;
            })
            ->pluck('id')->values()->all();

        return [
            'language'   => $language,
            'category'   => $category,
            'min_age'    => $min,
            'max_age'    => $max,
            'group_ids'  => $groupIds,
            'confidence' => $text === '' ? 'none' : 'low',
        ];
    }

    private function language(string $text): string
    {
        if (preg_match('/\p{Cyrillic}/u', $text)) {
            return 'ru';
        }
        if (preg_match("/(o'|g'|oʻ|gʻ|\\b(bolalar|uchun|qo'shiq|multfilm|o'zbek|ertak)\\b)/u", $text)) {
            return 'uz';
        }

        return 'en';
    }

    private function category(string $text): string
    {
        foreach (self::CATEGORY_KEYWORDS as $category => $words) {
            foreach ($words as $w) {
                if ($text !== '' && str_contains($text, $w)) {
                    return $category;
                }
            }
        }

        return 'activities';
    }

    /** @return array{0:int,1:int} */
    private function ages(string $text): array
    {
        if (preg_match('/(\d)\s*[-–—]\s*(\d)\s*(yosh|years?|y\.?o\.?|лет|года?)/u', $text, $m)) {
            $a = max(EducationalContent::MIN_AGE, min((int) $m[1], (int) $m[2]));
            $b = min(EducationalContent::MAX_AGE, max((int) $m[1], (int) $m[2]));
            if ($a <= $b) {
                return [$a, $b];
            }
        }
        foreach (self::TODDLER as $w) {
            if (str_contains($text, $w)) {
                return [2, 4];
            }
        }

        return [4, EducationalContent::MAX_AGE];   // ehtiyotkor standart: eng kichiklarga avtomatik tavsiya qilinmaydi
    }
}
