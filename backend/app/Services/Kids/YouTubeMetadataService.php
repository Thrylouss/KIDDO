<?php

namespace App\Services\Kids;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Video metama'lumotlari. Asosiy manba — YouTube oEmbed (kalit talab qilmaydi, bepul):
 * nom, kanal, thumbnail va embedding ruxsati (401 = egasi embedni o'chirgan).
 * YOUTUBE_API_KEY berilgan bo'lsa (ixtiyoriy) — davomiylik, embeddable va «bolalar uchun» belgisi qo'shiladi.
 * Kalit faqat backend'da ishlatiladi. Tarmoq xatosi modulni to'xtatmaydi — rahbar ma'lumotni qo'lda kiritadi.
 */
class YouTubeMetadataService
{
    /**
     * @return array{available: bool, title: ?string, author: ?string, thumbnail_url: string, embeddable: ?bool,
     *               duration_seconds: ?int, made_for_kids: ?bool, audio_language: ?string, source: string}
     */
    public function fetch(string $videoId): array
    {
        abort_unless(YouTubeVideo::isValidId($videoId), 422, "YouTube video ID noto'g'ri.");

        return Cache::remember("kids:yt-meta:{$videoId}", now()->addHours(6), fn () => $this->load($videoId));
    }

    private function load(string $videoId): array
    {
        $meta = [
            'available' => false, 'title' => null, 'author' => null, 'thumbnail_url' => YouTubeVideo::thumbnailUrl($videoId),
            'embeddable' => null, 'duration_seconds' => null, 'made_for_kids' => null, 'audio_language' => null, 'source' => 'none',
        ];

        try {
            $res = Http::timeout(5)->acceptJson()->get('https://www.youtube.com/oembed', [
                'url' => YouTubeVideo::watchUrl($videoId), 'format' => 'json',
            ]);
            if ($res->successful()) {
                $meta = array_merge($meta, [
                    'available' => true, 'embeddable' => true, 'source' => 'oembed',
                    'title'     => $this->clean($res->json('title'), 200),
                    'author'    => $this->clean($res->json('author_name'), 120),
                ]);
            } elseif ($res->status() === 401 || $res->status() === 403) {
                $meta = array_merge($meta, ['available' => true, 'embeddable' => false, 'source' => 'oembed']);
            }
        } catch (\Throwable $e) {
            $this->warn('oEmbed', $e);
        }

        if ($key = config('kiddo.youtube.api_key')) {
            try {
                $res  = Http::timeout(5)->acceptJson()->get('https://www.googleapis.com/youtube/v3/videos', [
                    'part' => 'contentDetails,status,snippet', 'id' => $videoId, 'key' => $key,
                ]);
                $item = $res->successful() ? $res->json('items.0') : null;
                if (is_array($item)) {
                    $meta['available']        = true;
                    $meta['source']           = 'youtube_api';
                    $meta['title']          ??= $this->clean($item['snippet']['title'] ?? null, 200);
                    $meta['author']         ??= $this->clean($item['snippet']['channelTitle'] ?? null, 120);
                    $meta['embeddable']       = isset($item['status']['embeddable']) ? (bool) $item['status']['embeddable'] : $meta['embeddable'];
                    $meta['made_for_kids']    = isset($item['status']['madeForKids']) ? (bool) $item['status']['madeForKids'] : null;
                    $meta['duration_seconds'] = $this->duration($item['contentDetails']['duration'] ?? null);
                    $lang = strtolower(substr((string) ($item['snippet']['defaultAudioLanguage'] ?? $item['snippet']['defaultLanguage'] ?? ''), 0, 2));
                    $meta['audio_language']   = in_array($lang, ['uz', 'ru', 'en'], true) ? $lang : null;
                }
            } catch (\Throwable $e) {
                $this->warn('Data API', $e);   // kalit xato matnida bo'lmaydi — faqat sinf nomi yoziladi
            }
        }

        return $meta;
    }

    /** ISO 8601 (PT1H2M3S) → soniya. */
    private function duration(?string $iso): ?int
    {
        if (! $iso || ! preg_match('/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/', $iso, $m)) {
            return null;
        }

        return ((int) ($m[1] ?? 0)) * 3600 + ((int) ($m[2] ?? 0)) * 60 + (int) ($m[3] ?? 0);
    }

    /** Tashqi matn: teglar olib tashlanadi, uzunlik cheklanadi (frontend uni oddiy matn sifatida ko'rsatadi). */
    private function clean(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($value)));

        return $text === '' ? null : mb_substr($text, 0, $max);
    }

    private function warn(string $source, \Throwable $e): void
    {
        try {
            Log::warning("KIDDO Kids: YouTube {$source} metama'lumotini olib bo'lmadi", ['error' => class_basename($e)]);
        } catch (\Throwable) {
            // log yozilmasa ham asosiy oqim davom etadi
        }
    }
}
