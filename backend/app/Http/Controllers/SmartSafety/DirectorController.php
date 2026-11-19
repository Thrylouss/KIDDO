<?php

namespace App\Http\Controllers\SmartSafety;

use App\Http\Controllers\Admin\AdminController;
use App\Models\Child;
use App\Models\IotDevice;
use App\Models\IotEvent;
use App\Models\SafetyIncident;
use App\Models\SafetyZone;
use App\Services\SmartSafety\DeviceService;
use App\Services\SmartSafety\IncidentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Bog'cha rahbari: qurilmalar, biriktirish, zonalar, insidentlar va IoT audit — faqat o'z bog'chasi (route: role:admin). */
class DirectorController extends AdminController
{
    public function __construct(private DeviceService $devices, private IncidentService $incidents) {}

    // ── Qurilmalar ────────────────────────────────────────────────

    public function devices(Request $request): JsonResponse
    {
        $f = $request->validate(['type' => ['nullable', Rule::in(IotDevice::TYPES)], 'status' => ['nullable', Rule::in(IotDevice::STATUSES)]]);
        $rows = IotDevice::forOrganization($this->orgId($request))
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->with('activeAssignment.child')->orderBy('type')->orderBy('external_id')->get();

        return response()->json(['data' => $rows->map(fn ($d) => $this->devices->resource($d))->values()]);
    }

    public function storeDevice(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'             => ['required', Rule::in(IotDevice::TYPES)],
            'provider'         => ['required', Rule::in(IotDevice::PROVIDERS)],
            'external_id'      => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9:_.-]+$/',
                Rule::unique('iot_devices')->where(fn ($q) => $q->where('provider', $request->input('provider')))],
            'label'            => ['nullable', 'string', 'max:100', 'not_regex:/<[^>]*>/'],
            'firmware_version' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9._-]+$/'],
            'x'                => ['nullable', 'numeric', 'between:0,1000'],
            'y'                => ['nullable', 'numeric', 'between:0,1000'],
        ], ['external_id.unique' => "Bu qurilma allaqachon ro'yxatda.", 'external_id.regex' => "Identifikator faqat harf, raqam va : _ . - belgilaridan iborat bo'lsin."]);

        $device = IotDevice::create([
            'organization_id' => $this->orgId($request), 'type' => $data['type'], 'provider' => $data['provider'],
            'external_id' => $data['external_id'], 'label' => $data['label'] ?? null, 'firmware_version' => $data['firmware_version'] ?? null,
            'meta' => $data['type'] === 'anchor' && isset($data['x'], $data['y']) ? ['x' => (float) $data['x'], 'y' => (float) $data['y']] : null,
            'status' => 'offline',
        ]);

        return response()->json(['data' => $this->devices->resource($device)], 201);
    }

    public function destroyDevice(Request $request, int $id): JsonResponse
    {
        $device = $this->findDevice($request, $id);
        $this->devices->unassign($device, $request->user(), $request->ip());
        $device->delete();

        return response()->json(['message' => "Qurilma o'chirildi."]);
    }

    public function assign(Request $request, int $id): JsonResponse
    {
        $device = $this->findDevice($request, $id);
        $data   = $request->validate(['child_id' => ['required', 'integer']]);
        $child  = Child::where('organization_id', $this->orgId($request))->findOrFail($data['child_id']);
        $this->devices->assign($device, $child, $request->user(), $request->ip());

        return response()->json(['data' => $this->devices->resource($device->fresh('activeAssignment.child'))]);
    }

    public function unassign(Request $request, int $id): JsonResponse
    {
        $device = $this->findDevice($request, $id);
        $this->devices->unassign($device, $request->user(), $request->ip());

        return response()->json(['data' => $this->devices->resource($device->fresh('activeAssignment.child'))]);
    }

    /** Gateway tokeni faqat shu javobda bir marta ko'rsatiladi. */
    public function issueToken(Request $request, int $id): JsonResponse
    {
        $token = $this->devices->issueToken($this->findDevice($request, $id), $request->user(), $request->ip());

        return response()->json(['token' => $token, 'message' => "Tokenni gateway sozlamasiga xavfsiz kiriting — u qayta ko'rsatilmaydi."]);
    }

    // ── Zonalar (geofence) ────────────────────────────────────────

    public function zones(Request $request): JsonResponse
    {
        return response()->json(['data' => SafetyZone::forOrganization($this->orgId($request))->orderBy('name')->get(['id', 'name', 'kind', 'polygon', 'is_active'])]);
    }

    public function storeZone(Request $request): JsonResponse
    {
        $data = $this->validateZone($request, true);
        $zone = SafetyZone::create($data + ['organization_id' => $this->orgId($request)]);

        return response()->json(['data' => $zone], 201);
    }

    public function updateZone(Request $request, int $id): JsonResponse
    {
        $zone = SafetyZone::forOrganization($this->orgId($request))->findOrFail($id);
        $zone->update($this->validateZone($request, false));

        return response()->json(['data' => $zone]);
    }

    public function destroyZone(Request $request, int $id): JsonResponse
    {
        SafetyZone::forOrganization($this->orgId($request))->findOrFail($id)->delete();

        return response()->json(['message' => "Zona o'chirildi."]);
    }

    // ── Insidentlar va audit ──────────────────────────────────────

    public function incidents(Request $request): JsonResponse
    {
        $f = $request->validate(['status' => ['nullable', Rule::in(['open', 'acknowledged', 'resolved', 'unresolved'])]]);
        $page = SafetyIncident::forOrganization($this->orgId($request))
            ->when(($f['status'] ?? null) === 'unresolved', fn ($q) => $q->unresolved())
            ->when(in_array($f['status'] ?? null, ['open', 'acknowledged', 'resolved'], true), fn ($q) => $q->where('status', $f['status']))
            ->with(['child', 'device', 'zone'])->orderByDesc('opened_at')->paginate(50);

        return response()->json([
            'data' => collect($page->items())->map(fn ($i) => $this->incidents->resource($i))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    public function acknowledge(Request $request, int $id): JsonResponse
    {
        $i = $this->incidents->acknowledge($this->findIncident($request, $id), $request->user(), $request->ip());

        return response()->json(['data' => $this->incidents->resource($i->fresh(['child', 'device', 'zone']))]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500', 'not_regex:/<[^>]*>/']], ['note.*' => "Yechim izohini kiriting (3–500 belgi)."]);
        $i = $this->incidents->resolve($this->findIncident($request, $id), $request->user(), $data['note'], $request->ip());

        return response()->json(['data' => $this->incidents->resource($i->fresh(['child', 'device', 'zone']))]);
    }

    public function events(Request $request): JsonResponse
    {
        $page = IotEvent::where('organization_id', $this->orgId($request))->with(['device:id,external_id,type', 'zone:id,name'])
            ->orderByDesc('occurred_at')->orderByDesc('id')->paginate(100);

        return response()->json([
            'data' => collect($page->items())->map(fn (IotEvent $e) => [
                'id' => $e->id, 'type' => $e->type, 'occurred_at' => $e->occurred_at, 'received_at' => $e->received_at,
                'device' => $e->device?->external_id, 'zone' => $e->zone?->name, 'child_id' => $e->child_id,
            ])->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private function findDevice(Request $request, int $id): IotDevice
    {
        return IotDevice::forOrganization($this->orgId($request))->with('activeAssignment.child')->findOrFail($id);
    }

    private function findIncident(Request $request, int $id): SafetyIncident
    {
        return SafetyIncident::forOrganization($this->orgId($request))->findOrFail($id);
    }

    private function validateZone(Request $request, bool $create): array
    {
        $req = $create ? 'required' : 'sometimes';

        return $request->validate([
            'name'        => [$req, 'string', 'max:100', 'not_regex:/<[^>]*>/'],
            'kind'        => [$req, Rule::in(SafetyZone::KINDS)],
            'polygon'     => [$req, 'array', 'min:3', 'max:50'],
            'polygon.*'   => ['array', 'size:2'],
            'polygon.*.*' => ['numeric', 'between:0,1000'],
            'is_active'   => ['sometimes', 'boolean'],
        ], ['polygon.*' => "Zona kamida 3 nuqtali ko'pburchak bo'lsin (0–1000 m)."]);
    }
}
