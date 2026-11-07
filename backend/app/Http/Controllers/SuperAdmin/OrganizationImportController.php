<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Organization;
use App\Services\Export\XlsxWriter;
use App\Services\Import\OrganizationImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Davlat MTT larini Excel orqali import qilish: namuna fayl → preview (bazaga yozmaydi) → tasdiqlangan import.
 * Rahbarlar uchun foydalanuvchi/login/parol yaratilmaydi.
 */
class OrganizationImportController extends SuperAdminController
{
    public function __construct(private OrganizationImportService $service) {}

    public function template(): BinaryFileResponse
    {
        Gate::authorize('import', Organization::class);
        $path = (new XlsxWriter())->addSheet("Bog'chalar", [
            ['Muassasa nomi', 'Turi', 'Rasmiy kod', 'Raqami', 'Manzili', 'MFY', 'Quvvati', 'Rahbar F.I.Sh.', 'Rahbar telefon raqami'],
            ['1-sonli DMTT', 'Davlat', '', '1', "G'azalkent shahri, Navro'z ko'chasi, 5-uy", "Navro'z MFY", 120, 'Aliyeva Malika Karimovna', '+998901234567'],
        ], [0], [32, 12, 14, 10, 40, 24, 10, 32, 22])->save();

        return response()->download($path, 'bogchalar-import-namuna.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    /** Faylni o'qiydi va tekshiradi — bazaga hech narsa yozilmaydi. */
    public function preview(Request $request): JsonResponse
    {
        Gate::authorize('import', Organization::class);
        $data = $request->validate([
            'file'     => 'required|file|max:5120|extensions:xlsx,csv',
            'district' => 'required|string|max:100',
            'type'     => ['nullable', Rule::in(Organization::TYPES)],
            'region'   => 'nullable|string|max:100',
        ], [
            'file.required'   => 'Faylni tanlang.',
            'file.max'        => 'Fayl hajmi 5 MB dan oshmasin.',
            'file.extensions' => 'Faqat .xlsx yoki .csv fayl yuklang.',
        ]);

        try {
            $this->service->ensureSchema();
            $rows = $this->service->parse($data['file']->getRealPath(), $data['file']->getClientOriginalExtension());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $this->service->analyze($rows, $data['district'])]);
    }

    /**
     * Preview'da tanlangan qatorlarni import qiladi. Fayl qayta yuboriladi va serverda qayta o'qiladi —
     * Excel'dagi asl qiymatlar mijoz orqali o'zgarmaydi; hammasi bitta tranzaksiyada yaratiladi.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('import', Organization::class);
        $data = $request->validate([
            'file'             => 'required|file|max:5120|extensions:xlsx,csv',
            'district'         => 'required|string|max:100',
            'type'             => ['nullable', Rule::in(Organization::TYPES)],
            'region'           => 'nullable|string|max:100',
            'rows'             => 'required|array|min:1|max:' . OrganizationImportService::MAX_ROWS,
            'rows.*'           => 'integer|min:1|distinct',
            'confirmed_rows'   => 'array',
            'confirmed_rows.*' => 'integer|min:1',
        ], [
            'file.required'   => 'Faylni tanlang.',
            'file.extensions' => 'Faqat .xlsx yoki .csv fayl yuklang.',
            'rows.required'   => 'Import uchun kamida bitta qator tanlang.',
        ]);

        try {
            $this->service->ensureSchema();
            $result = $this->service->import(
                $data['file']->getRealPath(),
                $data['file']->getClientOriginalExtension(),
                $data['district'],
                array_map('intval', $data['rows']),
                array_map('intval', $data['confirmed_rows'] ?? []),
                mb_substr($data['file']->getClientOriginalName(), 0, 255),
                $request->user()->id,
                $request->ip(),
                $data['type'] ?? Organization::TYPE_DAVLAT,
                $data['region'] ?? null,
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (isset($result['rejected'])) {
            $n = count($result['rejected']);
            return response()->json([
                'message' => ($result['reason'] ?? '') === 'errors'
                    ? "Import bajarilmadi: faylda {$n} ta xatoli qator bor. Xatolarni Excel faylda tuzatib, faylni qayta yuklang. Hech qanday bog'cha yaratilmadi."
                    : "Import bajarilmadi: {$n} ta qatordagi ogohlantirish tasdiqlanmagan. Hech qanday bog'cha yaratilmadi.",
                'data'    => ['rejected' => $result['rejected'], 'reason' => $result['reason'] ?? null, 'summary' => $result['summary'] ?? null],
            ], 422);
        }

        $created = count($result['created']);
        $skipped = max(0, $result['total_rows'] - $created);

        return response()->json([
            'message' => "{$created} ta bog'cha yaratildi" . ($skipped ? ", {$skipped} ta qator o'tkazib yuborildi." : '.'),
            'data'    => [
                'created' => $result['created'],
                // Xatoli qator bo'lsa import umuman bajarilmaydi (yuqorida 422) — shuning uchun bu yerda xato 0
                'summary' => ['total' => $result['total_rows'], 'created' => $created, 'skipped' => $skipped, 'errors' => 0],
            ],
        ], 201);
    }
}
