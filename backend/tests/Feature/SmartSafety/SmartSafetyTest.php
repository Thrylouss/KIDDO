<?php

namespace Tests\Feature\SmartSafety;

use App\Iot\Engine\EventQueue;
use App\Iot\Engine\GeofenceEngine;
use App\Iot\Engine\LocationEngine;
use App\Iot\Data\NormalizedEvent;
use App\Iot\Notifications\NotificationDispatcher;
use App\Iot\ProviderRegistry;
use App\Iot\Providers\DemoProvider;
use App\Models\Child;
use App\Models\Group;
use App\Models\IotDevice;
use App\Models\IotEvent;
use App\Models\Organization;
use App\Models\SafetyIncident;
use App\Models\SafetyZone;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** KIDDO Smart Safety: uskunaga tayyor IoT qatlami, feature flag, izolyatsiya va insident hayot sikli. */
class SmartSafetyTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $director;
    private User $teacher;
    private Group $group;
    private Child $child;
    private IotDevice $gateway;
    private IotDevice $band;
    private string $token;
    /** @var array<int, array{0: SafetyIncident, 1: bool}> */
    public array $dispatched = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['kiddo.smart_safety.enabled' => true]);
        $this->app->instance(NotificationDispatcher::class, new class($this) implements NotificationDispatcher {
            public function __construct(private $test) {}
            public function incidentOpened(SafetyIncident $incident, bool $demo): void { $this->test->dispatched[] = [$incident, $demo]; }
        });

        $this->org      = Organization::factory()->create();
        $this->director = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $this->org->id]);
        $this->group    = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->child    = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        $this->teacher  = $this->teacherFor($this->org, $this->group);

        $this->gateway = IotDevice::create(['organization_id' => $this->org->id, 'type' => 'gateway', 'provider' => 'demo', 'external_id' => 'GW-1']);
        $this->band    = IotDevice::create(['organization_id' => $this->org->id, 'type' => 'wristband', 'provider' => 'demo', 'external_id' => 'WB-1']);
        $this->as($this->director)->putJson("/api/v1/smart-safety/director/devices/{$this->band->id}/assignment", ['child_id' => $this->child->id])->assertOk();
        $this->token = $this->as($this->director)->postJson("/api/v1/smart-safety/director/devices/{$this->gateway->id}/token")->assertOk()->json('token');

        // Reja: kirish (0..10), xona (10..40), cheklangan oshxona (40..50)
        SafetyZone::create(['organization_id' => $this->org->id, 'name' => 'Kirish', 'kind' => 'entrance', 'polygon' => [[0, 0], [10, 0], [10, 10], [0, 10]]]);
        SafetyZone::create(['organization_id' => $this->org->id, 'name' => 'Xona', 'kind' => 'safe', 'polygon' => [[10, 0], [40, 0], [40, 10], [10, 10]]]);
        SafetyZone::create(['organization_id' => $this->org->id, 'name' => 'Oshxona', 'kind' => 'restricted', 'polygon' => [[40, 0], [50, 0], [50, 10], [40, 10]]]);
    }

    private function teacherFor(Organization $org, Group $group): User
    {
        $u = User::factory()->teacher()->create(['organization_id' => $org->id]);
        TeacherProfile::factory()->create(['user_id' => $u->id, 'organization_id' => $org->id])->groups()->attach($group->id, ['assigned_at' => '2026-09-01']);

        return $u;
    }

    private function as(User $u)
    {
        $this->app['auth']->forgetGuards();

        return $u->isParent() ? $this->actingAsParent($u) : $this->actingAs($u, 'sanctum');
    }

    private function ingest(array $events, ?string $token = null)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . ($token ?? $this->token))->postJson('/api/v1/iot/ingest', ['events' => $events]);
    }

    private function ev(string $type, string $at, array $extra = [], string $device = 'WB-1'): array
    {
        return ['device' => $device, 'type' => $type, 'at' => $at] + $extra;
    }

    public function test_feature_flag_ochiq_bolmasa_hamma_endpointlar_404(): void
    {
        config(['kiddo.smart_safety.enabled' => false]);
        $this->ingest([$this->ev('sos', '2026-11-19T09:00:00Z')])->assertNotFound();
        $this->as($this->director)->getJson('/api/v1/smart-safety/status')->assertNotFound();
        $this->as($this->director)->getJson('/api/v1/smart-safety/director/devices')->assertNotFound();
        $this->as($this->teacher)->getJson('/api/v1/smart-safety/teacher/incidents')->assertNotFound();
        $this->assertSame(0, IotEvent::count());
    }

    public function test_gateway_autentifikatsiyasi_va_token_xeshi(): void
    {
        $this->ingest([$this->ev('sos', '2026-11-19T09:00:00Z')], 'kgw_wrong_token_aaaaaaaaaaaaaaaa')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/iot/ingest', ['events' => [$this->ev('sos', '2026-11-19T09:00:00Z')]])->assertUnauthorized();
        $this->assertSame(hash('sha256', $this->token), $this->gateway->fresh()->token_hash);
        $this->as($this->director)->getJson('/api/v1/smart-safety/director/devices')->assertOk()
            ->assertJsonMissingPath('data.0.token_hash')->assertJsonPath('data.0.has_token', true);
        $this->assertStringNotContainsString($this->token, json_encode(IotDevice::all()->toArray()));
    }

    public function test_cheklangan_zona_insident_va_bildirishnoma(): void
    {
        $this->ingest([$this->ev('location', '2026-11-19T09:00:00Z', ['x' => 45, 'y' => 5])])->assertStatus(202)
            ->assertJsonPath('data.accepted', 1)->assertJsonPath('data.incidents', 1);

        $i = SafetyIncident::sole();
        $this->assertSame(['restricted_zone', 'critical', 'open', $this->child->id], [$i->type, $i->severity, $i->status, $i->child_id]);
        $this->assertSame('Oshxona', $i->zone->name);
        $this->assertCount(1, $this->dispatched);
        $this->assertTrue($this->dispatched[0][1]);   // demo provayder — tashqariga yuborilmaydigan belgisi
        $this->assertSame('online', $this->gateway->fresh()->status);
    }

    public function test_deduplikatsiya_va_ochiq_insident_takrorlanmaydi(): void
    {
        $e = $this->ev('location', '2026-11-19T09:00:00Z', ['x' => 45, 'y' => 5]);
        $this->ingest([$e, $e])->assertJsonPath('data.accepted', 1)->assertJsonPath('data.duplicates', 1);
        $this->ingest([$e])->assertJsonPath('data.duplicates', 1);
        $this->ingest([$this->ev('location', '2026-11-19T09:05:00Z', ['x' => 46, 'y' => 6])])->assertJsonPath('data.accepted', 1)->assertJsonPath('data.incidents', 0);
        $this->assertSame(2, IotEvent::where('type', 'location')->count());
        $this->assertSame(1, SafetyIncident::count());
    }

    public function test_bufer_hodisalari_vaqt_tartibida_qayta_ishlanadi(): void
    {
        // Gateway oflayn bo'lgan — hodisalar teskari tartibda keladi
        $this->ingest([
            $this->ev('location', '2026-11-19T09:10:00Z', ['x' => 20, 'y' => 5]),
            $this->ev('battery', '2026-11-19T09:05:00Z', ['battery' => 40]),
            $this->ev('location', '2026-11-19T09:00:00Z', ['x' => 5, 'y' => 5, 'battery' => 80]),
        ])->assertJsonPath('data.accepted', 3);

        $this->assertSame(['location', 'arrival', 'battery', 'location'], IotEvent::orderBy('id')->pluck('type')->all());
        $band = $this->band->fresh();
        $this->assertSame('2026-11-19 09:10:00', $band->last_seen_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame(40, $band->battery_level);
    }

    public function test_smart_attendance_kuniga_bir_marta_va_rasmiy_davomatga_yozilmaydi(): void
    {
        $this->ingest([$this->ev('location', '2026-11-19T08:00:00Z', ['x' => 2, 'y' => 2])]);
        $this->ingest([$this->ev('location', '2026-11-19T08:30:00Z', ['x' => 3, 'y' => 3])]);
        $this->ingest([$this->ev('location', '2026-11-20T08:00:00Z', ['x' => 2, 'y' => 2])]);

        $this->assertSame(2, IotEvent::where('type', 'arrival')->where('child_id', $this->child->id)->count());
        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_sos_batareya_olib_tashlash_va_oflayn_insidentlari(): void
    {
        $this->ingest([
            $this->ev('sos', '2026-11-19T09:00:00Z'),
            $this->ev('battery', '2026-11-19T09:01:00Z', ['battery' => 9]),
            $this->ev('removed', '2026-11-19T09:02:00Z'),
            $this->ev('offline', '2026-11-19T09:03:00Z'),
        ])->assertJsonPath('data.incidents', 4);

        $this->assertEqualsCanonicalizing(['sos', 'battery_low', 'device_removed', 'device_offline'], SafetyIncident::pluck('type')->all());
        $this->assertSame('critical', SafetyIncident::where('type', 'sos')->value('severity'));
        $this->assertSame('offline', $this->band->fresh()->status);
    }

    public function test_insident_hayot_sikli_qabul_qilish_yechmaydi(): void
    {
        $this->ingest([$this->ev('sos', '2026-11-19T09:00:00Z')]);
        $id = SafetyIncident::sole()->id;

        $this->as($this->teacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/resolve", ['note' => 'Hal qilindi'])->assertUnprocessable();
        $this->as($this->teacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/acknowledge")->assertOk()->assertJsonPath('data.status', 'acknowledged');
        $this->assertNull(SafetyIncident::find($id)->resolved_at);
        $this->as($this->teacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/acknowledge")->assertUnprocessable();
        $this->as($this->teacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/resolve", ['note' => 'x'])->assertUnprocessable();
        $this->as($this->teacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/resolve", ['note' => 'Bola xavfsiz, tarbiyachi yonida'])
            ->assertOk()->assertJsonPath('data.status', 'resolved');
        $this->assertDatabaseHas('activity_logs', ['action' => 'safety_incident.acknowledged', 'user_id' => $this->teacher->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'safety_incident.resolved', 'user_id' => $this->teacher->id]);
    }

    public function test_eskalatsiya_qabul_qilinmagan_ochiq_insidentlar(): void
    {
        $this->ingest([$this->ev('sos', now()->subMinutes(10)->toIso8601String())]);
        $this->ingest([$this->ev('removed', now()->toIso8601String())]);
        $this->assertSame(1, app(\App\Services\SmartSafety\IncidentService::class)->escalateOverdue());
        $this->assertNotNull(SafetyIncident::where('type', 'sos')->value('escalated_at'));
        $this->assertNull(SafetyIncident::where('type', 'device_removed')->value('escalated_at'));
    }

    public function test_tashkilot_va_rol_izolyatsiyasi(): void
    {
        $this->ingest([$this->ev('sos', '2026-11-19T09:00:00Z')]);
        $id = SafetyIncident::sole()->id;

        $otherOrg = Organization::factory()->create();
        $otherDirector = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $otherOrg->id]);
        $otherChild = Child::factory()->create(['organization_id' => $otherOrg->id]);
        $this->as($otherDirector)->getJson('/api/v1/smart-safety/director/incidents')->assertOk()->assertJsonCount(0, 'data');
        $this->as($otherDirector)->getJson('/api/v1/smart-safety/director/devices')->assertOk()->assertJsonCount(0, 'data');
        $this->as($otherDirector)->patchJson("/api/v1/smart-safety/director/incidents/{$id}/acknowledge")->assertNotFound();
        $this->as($otherDirector)->putJson("/api/v1/smart-safety/director/devices/{$this->band->id}/assignment", ['child_id' => $otherChild->id])->assertNotFound();
        $this->as($this->director)->putJson("/api/v1/smart-safety/director/devices/{$this->band->id}/assignment", ['child_id' => $otherChild->id])->assertNotFound();

        // Boshqa guruh tarbiyachisi bu bolaning insidentini ko'rmaydi
        $otherGroupTeacher = $this->teacherFor($this->org, Group::factory()->create(['organization_id' => $this->org->id]));
        $this->as($otherGroupTeacher)->getJson('/api/v1/smart-safety/teacher/incidents')->assertOk()->assertJsonCount(0, 'data');
        $this->as($otherGroupTeacher)->patchJson("/api/v1/smart-safety/teacher/incidents/{$id}/acknowledge")->assertNotFound();
        $this->as($this->teacher)->getJson('/api/v1/smart-safety/teacher/incidents')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.child.id', $this->child->id);

        // Rollar
        $parent = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->org->id]);
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->as($parent)->getJson('/api/v1/smart-safety/teacher/incidents')->assertForbidden();
        $this->as($parent)->getJson('/api/v1/smart-safety/status')->assertForbidden();
        $this->as($this->teacher)->getJson('/api/v1/smart-safety/director/devices')->assertForbidden();
        $this->as($sa)->getJson('/api/v1/smart-safety/director/incidents', ['X-Impersonated-Org' => (string) $this->org->id])->assertForbidden();
        $this->as($this->director)->getJson('/api/v1/smart-safety/super-admin/overview')->assertForbidden();

        // Boshqa bog'cha gatewayi bu bog'cha qurilmasi hodisasini yubora olmaydi
        $foreignGw = IotDevice::create(['organization_id' => $otherOrg->id, 'type' => 'gateway', 'provider' => 'demo', 'external_id' => 'GW-X']);
        $foreignToken = 'kgw_' . str_repeat('f', 48);
        $foreignGw->forceFill(['token_hash' => hash('sha256', $foreignToken)])->save();
        $this->ingest([$this->ev('sos', '2026-11-19T10:00:00Z')], $foreignToken)->assertJsonPath('data.ignored', 1)->assertJsonPath('data.accepted', 0);
        $this->assertSame(1, SafetyIncident::count());
    }

    public function test_super_admin_global_korinish_shaxsiy_malumotsiz(): void
    {
        $this->ingest([$this->ev('sos', '2026-11-19T09:00:00Z'), $this->ev('battery', '2026-11-19T09:01:00Z', ['battery' => 10])]);
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $res = $this->as($sa)->getJson('/api/v1/smart-safety/super-admin/overview')->assertOk()
            ->assertJsonPath('totals.devices', 2)->assertJsonPath('totals.open_incidents', 2)->assertJsonPath('data.0.low_battery', 1)
            ->assertJsonPath('data.0.organization.id', $this->org->id);
        $this->assertStringNotContainsString($this->child->first_name, $res->getContent());
        $this->as($sa)->getJson('/api/v1/smart-safety/status')->assertOk()->assertJsonPath('providers.0.key', 'demo');
    }

    public function test_vendor_adapterlari_ochiq_va_demo_normalizatsiya(): void
    {
        $reg = app(ProviderRegistry::class);
        foreach (['blueiot', 'mokosmart', 'minew'] as $k) {
            $this->assertNull($reg->available($k));
        }
        $this->assertNotNull($reg->available('demo'));
        $status = json_encode($reg->status());
        $this->assertStringNotContainsStringIgnoringCase('token', $status);

        $vendorGw = IotDevice::create(['organization_id' => $this->org->id, 'type' => 'gateway', 'provider' => 'minew', 'external_id' => 'GW-M']);
        $t = 'kgw_' . str_repeat('m', 48);
        $vendorGw->forceFill(['token_hash' => hash('sha256', $t)])->save();
        $this->ingest([['anything' => true]], $t)->assertStatus(503);

        $events = (new DemoProvider())->normalize([
            ['device' => 'WB-1', 'type' => 'sos', 'at' => '2026-11-19T09:00:00Z'],
            ['device' => 'WB-1', 'type' => 'hack', 'at' => '2026-11-19T09:00:00Z'],
            ['device' => 'WB-1', 'type' => 'battery', 'at' => 'not-a-date'],
            ['type' => 'sos'],
            ['device' => 'WB-1', 'type' => 'battery', 'at' => '2026-11-19T09:00:00Z', 'battery' => 250],
        ]);
        $this->assertCount(2, $events);
        $this->assertSame(100, $events[1]->battery);
    }

    public function test_dvigatellar_geofence_lokatsiya_navbat(): void
    {
        $this->assertTrue(GeofenceEngine::contains([[0, 0], [10, 0], [10, 10], [0, 10]], 5, 5));
        $this->assertFalse(GeofenceEngine::contains([[0, 0], [10, 0], [10, 10], [0, 10]], 15, 5));
        $this->assertFalse(GeofenceEngine::contains([[0, 0], [10, 0]], 1, 0));

        $loc = new LocationEngine();
        $this->assertSame([3.0, 4.0], $loc->resolve(3, 4, [], []));
        [$x] = $loc->resolve(null, null, ['A' => -40, 'B' => -80], ['A' => [0, 0], 'B' => [10, 0]]);
        $this->assertLessThan(1.0, $x);                    // kuchli signal yaqinidagi ankerga yaqin
        $this->assertNull($loc->resolve(null, null, ['Z' => -50], ['A' => [0, 0]]));

        $q = new EventQueue();
        $mk = fn ($t) => new NormalizedEvent('demo', 'WB-1', 'heartbeat', CarbonImmutable::parse($t));
        $q->push($mk('2026-11-19T09:02:00Z'), $mk('2026-11-19T09:00:00Z'), $mk('2026-11-19T09:01:00Z'));
        $this->assertSame(['09:00', '09:01', '09:02'], array_map(fn ($e) => $e->occurredAt->format('H:i'), $q->drain()));
    }

    public function test_qurilma_royxati_validatsiya_va_biriktirish(): void
    {
        $this->as($this->director)->postJson('/api/v1/smart-safety/director/devices', ['type' => 'wristband', 'provider' => 'demo', 'external_id' => 'WB-1'])
            ->assertUnprocessable()->assertJsonValidationErrors('external_id');
        $this->as($this->director)->postJson('/api/v1/smart-safety/director/devices', ['type' => 'wristband', 'provider' => 'demo', 'external_id' => '<script>'])
            ->assertUnprocessable();
        $id = $this->as($this->director)->postJson('/api/v1/smart-safety/director/devices', ['type' => 'wristband', 'provider' => 'demo', 'external_id' => 'WB-2'])
            ->assertCreated()->json('data.id');
        // Bolaga yangi bilaguzuk berilsa, eskisi avtomatik ajratiladi
        $this->as($this->director)->putJson("/api/v1/smart-safety/director/devices/{$id}/assignment", ['child_id' => $this->child->id])->assertOk()
            ->assertJsonPath('data.child.id', $this->child->id);
        $this->assertNull($this->band->fresh('activeAssignment')->activeAssignment);
        $this->as($this->director)->putJson("/api/v1/smart-safety/director/devices/{$this->gateway->id}/assignment", ['child_id' => $this->child->id])->assertUnprocessable();
        $this->as($this->director)->postJson('/api/v1/smart-safety/director/zones', ['name' => 'Yomon', 'kind' => 'restricted', 'polygon' => [[0, 0], [1, 1]]])->assertUnprocessable();
    }
}
