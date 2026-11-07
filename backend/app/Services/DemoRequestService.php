<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\DemoRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * DEMO arizalari: saqlash → Telegram'ga xabar (xato bo'lsa ham ariza saqlanib qoladi) → Super Admin holatni boshqaradi.
 * Akkaunt yoki tashkilot avtomatik yaratilmaydi; 14 kunlik muddat holat «Demo faol» bo'lganda boshlanadi.
 */
class DemoRequestService
{
    /** Bir xil telefon + bog'cha nomi shu muddat ichida qayta yuborilsa — yangi ariza yaratilmaydi. */
    public const DUPLICATE_HOURS = 24;

    public function __construct(private TelegramNotifier $telegram) {}

    /**
     * @return array{request: DemoRequest, duplicate: bool}
     */
    public function submit(array $data, ?string $ip): array
    {
        $existing = DemoRequest::where('phone', $data['phone'])
            ->whereRaw('lower(kindergarten_name) = ?', [mb_strtolower($data['kindergarten_name'])])
            ->where('created_at', '>=', now()->subHours(self::DUPLICATE_HOURS))
            ->latest('id')->first();
        if ($existing) {
            return ['request' => $existing, 'duplicate' => true];
        }

        $request = DemoRequest::create([
            ...$data,
            'consent_at'      => now(),
            'status'          => DemoRequest::STATUS_NEW,
            'telegram_status' => DemoRequest::TELEGRAM_PENDING,
            'ip_hash'         => $ip ? hash_hmac('sha256', $ip, (string) config('app.key')) : null,
        ]);

        // Saqlangandan keyin — Telegram ishlamasa ham ariza yo'qolmaydi
        $this->deliver($request);

        return ['request' => $request->fresh(), 'duplicate' => false];
    }

    /** Telegram'ga yuborish urinishi va natijasini qayd etadi. */
    public function deliver(DemoRequest $request): bool
    {
        if (! $this->telegram->configured()) {
            $request->forceFill([
                'telegram_status' => DemoRequest::TELEGRAM_NOT_CONFIGURED,
                'telegram_error'  => 'Telegram sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).',
            ])->save();
            $this->log('warning', 'DEMO arizasi saqlandi, lekin Telegram sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)', [
                'demo_request_id' => $request->id,
            ]);

            return false;
        }

        $result = $this->telegram->send($this->message($request));
        $request->forceFill([
            'telegram_attempts'        => $request->telegram_attempts + 1,
            'telegram_last_attempt_at' => now(),
            'telegram_status'          => $result['ok'] ? DemoRequest::TELEGRAM_SENT : DemoRequest::TELEGRAM_FAILED,
            'telegram_sent_at'         => $result['ok'] ? now() : $request->telegram_sent_at,
            'telegram_error'           => $result['ok'] ? null : $result['error'],
        ])->save();

        if (! $result['ok']) {
            // Token xato matnida yo'q (TelegramNotifier::scrub) — logga xavfsiz yoziladi.
            // error darajasi: production'dagi LOG_LEVEL=error da ham ko'rinadi.
            $this->log('error', 'DEMO arizasi Telegramga yuborilmadi', [
                'demo_request_id' => $request->id,
                'attempts'        => $request->telegram_attempts,
                'error'           => $result['error'],
            ]);
        }

        return $result['ok'];
    }

    /** Yuborilmagan arizalarni qayta yuborish (buyruq / scheduler). */
    public function retryPending(int $maxAttempts): array
    {
        $sent = $failed = 0;
        DemoRequest::whereIn('telegram_status', [DemoRequest::TELEGRAM_PENDING, DemoRequest::TELEGRAM_FAILED, DemoRequest::TELEGRAM_NOT_CONFIGURED])
            ->where('telegram_attempts', '<', $maxAttempts)
            ->orderBy('id')->limit(50)->get()
            ->each(function (DemoRequest $r) use (&$sent, &$failed) {
                $this->deliver($r) ? $sent++ : $failed++;
            });

        return ['sent' => $sent, 'failed' => $failed];
    }

    /** Super Admin: holat va ichki qayd. «Demo faol» — 14 kunlik muddat shu paytdan boshlanadi (bir marta). */
    public function update(DemoRequest $request, array $data, User $by, ?string $ip): DemoRequest
    {
        return DB::transaction(function () use ($request, $data, $by, $ip) {
            $changes = array_intersect_key($data, array_flip(['internal_note', 'organization_id']));
            if (isset($data['status']) && $data['status'] !== $request->status) {
                $changes['status']            = $data['status'];
                $changes['status_changed_at'] = now();
                $changes['handled_by']        = $by->id;
                if ($data['status'] === DemoRequest::STATUS_ACTIVE && ! $request->demo_starts_at) {
                    $changes['demo_starts_at'] = now();
                    $changes['demo_ends_at']   = now()->addDays(DemoRequest::DEMO_DAYS);
                }
            }
            $request->update($changes);

            ActivityLog::record('demo_request.updated', "DEMO arizasi yangilandi: #{$request->id} {$request->kindergarten_name}",
                $by->id, null, ['demo_request_id' => $request->id, 'fields' => array_keys($changes)], $ip);

            return $request->fresh();
        });
    }

    /**
     * Log yozib bo'lmasa ham (masalan, storage/logs yozishga yopiq) ariza oqimi to'xtamaydi:
     * ariza allaqachon bazada, Telegram holati va xatosi esa demo_requests jadvalida saqlanadi.
     */
    private function log(string $level, string $message, array $context): void
    {
        try {
            Log::log($level, $message, $context);
        } catch (\Throwable) {
            // e'tiborsiz — asosiy ma'lumot bazada
        }
    }

    /** Telegram xabari (oddiy matn — formatlash belgilari ekranlanishi shart emas). */
    public function message(DemoRequest $r): string
    {
        $v = fn ($value) => ($value === null || $value === '') ? '—' : (string) $value;

        return implode("\n", [
            '🆕 YANGI KIDDO DEMO ARIZASI',
            '',
            "🏫 Bog'cha: {$r->kindergarten_name}",
            '🏢 Turi: ' . ($r->kindergarten_type === 'xususiy' ? 'Xususiy' : 'Davlat'),
            "📍 Hudud: {$r->region}, {$r->district}",
            '📌 Manzil: ' . $v($r->address),
            '',
            "👤 Rahbar: {$r->director_name}",
            "📞 Telefon: {$r->phone}",
            '',
            '👶 Bolalar soni: ' . $v($r->children_count),
            '👥 Guruhlar soni: ' . $v($r->groups_count),
            '💬 Izoh: ' . $v($r->comment),
            '',
            '📅 Ariza vaqti: ' . $r->created_at->timezone(config('app.timezone'))->format('d.m.Y H:i'),
            '🟡 Holat: Yangi ariza',
        ]);
    }

    public function resource(DemoRequest $r): array
    {
        return [
            'id'                => $r->id,
            'kindergarten_name' => $r->kindergarten_name,
            'kindergarten_type' => $r->kindergarten_type,
            'region'            => $r->region,
            'district'          => $r->district,
            'address'           => $r->address,
            'director_name'     => $r->director_name,
            'phone'             => $r->phone,
            'children_count'    => $r->children_count,
            'groups_count'      => $r->groups_count,
            'comment'           => $r->comment,
            'status'            => $r->status,
            'status_label'      => DemoRequest::STATUS_LABELS[$r->status] ?? $r->status,
            'internal_note'     => $r->internal_note,
            'status_changed_at' => $r->status_changed_at,
            'handled_by'        => $r->handler?->name,
            'organization'      => $r->organization ? ['id' => $r->organization->id, 'name' => $r->organization->name] : null,
            'demo_starts_at'    => $r->demo_starts_at,
            'demo_ends_at'      => $r->demo_ends_at,
            'demo_days_left'    => $r->demo_ends_at ? max(0, (int) ceil(now()->diffInHours($r->demo_ends_at, false) / 24)) : null,
            'telegram'          => [
                'status'          => $r->telegram_status,
                'attempts'        => $r->telegram_attempts,
                'sent_at'         => $r->telegram_sent_at,
                'last_attempt_at' => $r->telegram_last_attempt_at,
                'error'           => $r->telegram_error,
            ],
            'created_at'        => $r->created_at,
        ];
    }
}
