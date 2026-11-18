<?php

namespace App\Services\Kids;

/**
 * YouTube havolasini qat'iy tekshiradi va faqat 11 belgili video ID'ni ajratadi.
 * Foydalanuvchi kiritgan URL, HTML yoki iframe kodi hech qachon saqlanmaydi — embed manzili ID'dan quriladi.
 */
final class YouTubeVideo
{
    private const ID = '/^[A-Za-z0-9_-]{11}$/';

    private const HOSTS = [
        'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
        'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be',
    ];

    /** Ruxsat etilgan formatlar: watch?v=, youtu.be/, embed/, shorts/, live/, v/. Boshqasi — null. */
    public static function parseId(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '' || mb_strlen($url) > 500 || preg_match('/[\s<>"\']/', $url)) {
            return null;
        }
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://' . $url;
        }

        $parts = parse_url($url);
        if (! $parts || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            return null;
        }
        $host = strtolower($parts['host'] ?? '');
        if (! in_array($host, self::HOSTS, true)) {
            return null;
        }

        $path = $parts['path'] ?? '/';
        $id   = null;
        if ($host === 'youtu.be') {
            $id = explode('/', ltrim($path, '/'))[0] ?? null;
        } elseif ($path === '/watch') {
            parse_str($parts['query'] ?? '', $query);
            $id = is_string($query['v'] ?? null) ? $query['v'] : null;
        } elseif (preg_match('#^/(embed|shorts|live|v)/([^/]+)/?$#', $path, $m)) {
            $id = $m[2];
        }

        return $id !== null && preg_match(self::ID, $id) ? $id : null;
    }

    public static function isValidId(?string $id): bool
    {
        return is_string($id) && preg_match(self::ID, $id) === 1;
    }

    /** Maxfiylik rejimidagi embed: tavsiya etilgan videolar faqat shu kanaldan, brauzerda inline ijro. */
    public static function embedUrl(string $id): string
    {
        return "https://www.youtube-nocookie.com/embed/{$id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1";
    }

    public static function watchUrl(string $id): string
    {
        return "https://www.youtube.com/watch?v={$id}";
    }

    public static function thumbnailUrl(string $id): string
    {
        return "https://i.ytimg.com/vi/{$id}/hqdefault.jpg";
    }
}
