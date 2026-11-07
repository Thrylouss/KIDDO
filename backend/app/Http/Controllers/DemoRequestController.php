<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDemoRequestRequest;
use App\Services\DemoRequestService;
use Illuminate\Http\JsonResponse;

/** Landing sahifadagi «14 kunlik bepul DEMO» formasi — ommaviy endpoint. */
class DemoRequestController extends Controller
{
    public function __construct(private DemoRequestService $service) {}

    public function store(StoreDemoRequestRequest $request): JsonResponse
    {
        // Takroriy ariza ham bir xil javob oladi — tashqariga hech qanday ichki ma'lumot chiqmaydi
        $this->service->submit($request->payload(), $request->ip());

        return response()->json([
            'message' => "Arizangiz muvaffaqiyatli yuborildi! KIDDO jamoasi tez orada siz bilan bog'lanadi.",
        ], 201);
    }
}
