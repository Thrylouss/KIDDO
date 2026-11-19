<?php

namespace App\Iot\Providers;

/** Minew adapteri — interfeys tayyor, implementatsiya rasmiy hujjat va kalitlar olingach. */
class MinewProvider extends VendorProvider
{
    public function key(): string
    {
        return 'minew';
    }

    public function label(): string
    {
        return 'Minew';
    }
}
