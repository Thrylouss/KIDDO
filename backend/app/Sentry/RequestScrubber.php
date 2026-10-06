<?php

namespace App\Sentry;

use Sentry\Event;
use Sentry\EventHint;

/**
 * Strips sensitive fields from the request body before the event is sent to Sentry.
 * Referenced as a static callable in config/sentry.php so the config remains
 * serialisable (config:cache compatible — no anonymous closures).
 */
class RequestScrubber
{
    private const SENSITIVE_FIELDS = [
        'password',
        'password_confirmation',
        'current_password',
        'token',
        'secret',
    ];

    public static function scrub(Event $event, ?EventHint $hint): ?Event
    {
        $request = $event->getRequest();

        if (empty($request['data']) || ! is_array($request['data'])) {
            return $event;
        }

        foreach (self::SENSITIVE_FIELDS as $field) {
            if (array_key_exists($field, $request['data'])) {
                $request['data'][$field] = '[Filtered]';
            }
        }

        $event->setRequest($request);

        return $event;
    }
}
