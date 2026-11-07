<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** Bog'langan ma'lumotli bog'chani o'chirishga urinish — 422, o'rniga arxivlash tavsiya etiladi. */
class OrganizationHasLinkedDataException extends RuntimeException
{
    /** @param array<string, int> $linked */
    public function __construct(public readonly array $linked)
    {
        parent::__construct("Bu bog'chaga bog'langan ma'lumotlar bor, uni o'chirib bo'lmaydi. O'rniga arxivlang.");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'data'    => ['linked' => $this->linked],
        ], 422);
    }
}
