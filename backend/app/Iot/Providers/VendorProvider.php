<?php

namespace App\Iot\Providers;

use App\Iot\Contracts\DeviceProvider;
use App\Iot\Exceptions\ProviderUnavailable;

/**
 * Vendor adapterlari uchun asos. Rasmiy API hujjati va kalitlar bo'lmaguncha endpoint, autentifikatsiya yoki
 * xom format TAXMIN QILINMAYDI: isAvailable() false, normalize() ProviderUnavailable tashlaydi.
 */
abstract class VendorProvider implements DeviceProvider
{
    public function isAvailable(): bool
    {
        return false;   // rasmiy integratsiya yozilgach — konfiguratsiya + implementatsiya bilan almashtiriladi
    }

    public function supportedTransports(): array
    {
        return [];      // vendor hujjatida tasdiqlangandan keyin to'ldiriladi
    }

    public function normalize(array $raw): array
    {
        throw new ProviderUnavailable("{$this->label()}: rasmiy API hujjati va kalitlar olinmaguncha adapter o'chirilgan.");
    }
}
