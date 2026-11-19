<?php

namespace App\Services\SmartSafety;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\IotDevice;
use App\Models\IotDeviceAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Qurilma ro'yxati, bolaga biriktirish (bitta bolada bitta faol bilaguzuk) va gateway tokenini berish. */
class DeviceService
{
    public function assign(IotDevice $device, Child $child, User $by, ?string $ip): IotDeviceAssignment
    {
        if ($device->type !== 'wristband') {
            throw ValidationException::withMessages(['device' => "Bolaga faqat bilaguzuk biriktiriladi."]);
        }
        if ((int) $child->organization_id !== (int) $device->organization_id) {
            throw ValidationException::withMessages(['child_id' => "Bola topilmadi."]);
        }

        return DB::transaction(function () use ($device, $child, $by, $ip) {
            // Qurilmaning va bolaning oldingi faol biriktirishlari yopiladi
            IotDeviceAssignment::whereNull('unassigned_at')
                ->where(fn ($q) => $q->where('iot_device_id', $device->id)->orWhere('child_id', $child->id))
                ->update(['unassigned_at' => now()]);
            $a = IotDeviceAssignment::create([
                'organization_id' => $device->organization_id, 'iot_device_id' => $device->id, 'child_id' => $child->id,
                'assigned_by' => $by->id, 'assigned_at' => now(),
            ]);
            ActivityLog::record('iot_device.assigned', "Smart Safety: qurilma biriktirildi {$device->external_id}", $by->id, $device->organization_id,
                ['device_id' => $device->id, 'child_id' => $child->id], $ip);

            return $a;
        });
    }

    public function unassign(IotDevice $device, User $by, ?string $ip): void
    {
        IotDeviceAssignment::where('iot_device_id', $device->id)->whereNull('unassigned_at')->update(['unassigned_at' => now()]);
        ActivityLog::record('iot_device.unassigned', "Smart Safety: biriktirish bekor qilindi {$device->external_id}", $by->id, $device->organization_id,
            ['device_id' => $device->id], $ip);
    }

    /** Gateway uchun yangi token: faqat bir marta qaytariladi, bazada sha256 xeshi saqlanadi. */
    public function issueToken(IotDevice $gateway, User $by, ?string $ip): string
    {
        if ($gateway->type !== 'gateway') {
            throw ValidationException::withMessages(['device' => "Token faqat gateway uchun beriladi."]);
        }
        $token = 'kgw_' . Str::random(48);
        $gateway->forceFill(['token_hash' => hash('sha256', $token)])->save();
        ActivityLog::record('iot_device.token_issued', "Smart Safety: gateway tokeni yangilandi {$gateway->external_id}", $by->id, $gateway->organization_id,
            ['device_id' => $gateway->id], $ip);

        return $token;
    }

    public function resource(IotDevice $d): array
    {
        $a = $d->activeAssignment;

        return [
            'id' => $d->id, 'type' => $d->type, 'provider' => $d->provider, 'external_id' => $d->external_id, 'label' => $d->label,
            'battery_level' => $d->battery_level, 'status' => $d->status, 'firmware_version' => $d->firmware_version,
            'last_seen_at' => $d->last_seen_at, 'has_token' => $d->token_hash !== null,
            'child' => $a?->child ? ['id' => $a->child->id, 'name' => trim("{$a->child->first_name} {$a->child->last_name}")] : null,
        ];
    }
}
