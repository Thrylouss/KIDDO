<?php

namespace App\Iot;

use App\Iot\Contracts\DeviceProvider;
use App\Iot\Providers\BlueIotProvider;
use App\Iot\Providers\DemoProvider;
use App\Iot\Providers\MinewProvider;
use App\Iot\Providers\MokoSmartProvider;

class ProviderRegistry
{
    /** @var array<string, DeviceProvider> */
    private array $providers;

    public function __construct()
    {
        foreach ([new DemoProvider(), new BlueIotProvider(), new MokoSmartProvider(), new MinewProvider()] as $p) {
            $this->providers[$p->key()] = $p;
        }
    }

    /** Faqat yoqilgan va mavjud provayder; aks holda null. */
    public function available(string $key): ?DeviceProvider
    {
        $p = $this->providers[$key] ?? null;

        return $p && $p->isAvailable() ? $p : null;
    }

    /** Sozlamalar sahifasi uchun holat (maxfiy qiymatlarsiz). */
    public function status(): array
    {
        return array_values(array_map(fn (DeviceProvider $p) => [
            'key'        => $p->key(),
            'label'      => $p->label(),
            'available'  => $p->isAvailable(),
            'transports' => array_map(fn ($t) => $t->value, $p->supportedTransports()),
            'note'       => $p->key() === 'demo' ? 'simulator' : 'awaiting_official_docs',
        ], $this->providers));
    }
}
