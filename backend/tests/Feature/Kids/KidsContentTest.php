<?php

namespace Tests\Feature\Kids;

use App\Models\EducationalContent;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\Kids\YouTubeVideo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** KIDDO Kids: rahbar kutubxonani boshqaradi, tarbiyachi faqat o'z guruhi uchun mos kontentni ko'radi. */
class KidsContentTest extends TestCase
{
    use RefreshDatabase;

    private const VID  = 'dQw4w9WgXcQ';
    private const VID2 = 'aqz-KE-bpKQ';

    private Organization $org;
    private User $owner;
    private User $teacher;
    private Group $small;   // 2-3 yosh
    private Group $middle;  // 4-5 yosh
    private Group $big;     // 6-7 yosh (tayyorlov)

    /** oEmbed javobi (testlar o'zgartiradi): [status, body] yoki 'offline'. */
    private array|string $oembed = [200, ['title' => 'Ranglar va shakllar — bolalar uchun', 'author_name' => 'Kids TV']];

    protected function setUp(): void
    {
        parent::setUp();
        config(['kiddo.youtube.api_key' => null]);
        Http::preventStrayRequests();   // haqiqiy tarmoqqa hech qachon chiqilmaydi
        Http::fake(function () {
            if ($this->oembed === 'offline') {
                throw new \Illuminate\Http\Client\ConnectionException('offline');
            }
            return Http::response($this->oembed[1], $this->oembed[0]);
        });

        $this->org    = Organization::factory()->create(['name' => 'Quyoshcha']);
        $this->owner  = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $this->org->id]);
        $this->small  = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Kichkintoylar', 'age_category' => '2-3 yosh']);
        $this->middle = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quvnoqlar', 'age_category' => '4-5 yosh']);
        $this->big    = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyoshchalar', 'age_category' => '6-7 yosh (tayyorlov)']);
        $this->teacher = $this->teacherFor($this->org, [$this->middle]);
    }

    private function teacherFor(Organization $org, array $groups): User
    {
        $user    = User::factory()->teacher()->create(['organization_id' => $org->id]);
        $profile = TeacherProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $org->id]);
        foreach ($groups as $g) {
            $profile->groups()->attach($g->id, ['assigned_at' => '2026-09-01']);
        }

        return $user;
    }

    private function as(User $user)
    {
        if ($user->isParent()) {
            return $this->actingAsParent($user);
        }
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'youtube_url' => 'https://www.youtube.com/watch?v=' . self::VID,
            'title'       => 'Ranglar va shakllar',
            'description' => 'Ranglarni o\'rganamiz',
            'language'    => 'uz',
            'category'    => 'lessons',
            'min_age'     => 4,
            'max_age'     => 5,
            'group_ids'   => [$this->middle->id],
        ], $over);
    }

    private function create(array $over = [], ?User $by = null): EducationalContent
    {
        $id = $this->as($by ?? $this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload($over))->assertCreated()->json('data.id');

        return EducationalContent::findOrFail($id);
    }

    // 1. Owner kontent yaratadi
    public function test_rahbar_kontent_yaratadi_faqat_video_id_saqlanadi(): void
    {
        $res = $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['youtube_url' => 'https://youtu.be/' . self::VID . '?t=10']))
            ->assertCreated()
            ->assertJsonPath('data.youtube_video_id', self::VID)
            ->assertJsonPath('data.embed_url', YouTubeVideo::embedUrl(self::VID))
            ->assertJsonPath('data.thumbnail_url', 'https://i.ytimg.com/vi/' . self::VID . '/hqdefault.jpg')
            ->assertJsonPath('data.embeddable', true)
            ->assertJsonPath('data.groups.0.name', 'Quvnoqlar');

        $c = EducationalContent::sole();
        $this->assertSame($this->org->id, $c->organization_id);
        $this->assertSame($this->owner->id, $c->created_by);
        $this->assertSame('active', $c->status);
        $this->assertStringNotContainsString('youtu.be', json_encode($c->getAttributes()));   // URL saqlanmaydi
        $this->assertDatabaseHas('activity_logs', ['action' => 'kids_content.created', 'organization_id' => $this->org->id]);
        $this->assertNotNull($res->json('data.id'));
    }

    // 2. Tahrirlash va yashirish
    public function test_rahbar_tahrirlaydi_va_yashiradi_tarbiyachi_yashiringanni_kormaydi(): void
    {
        $c = $this->create();
        $this->as($this->owner)->putJson("/api/v1/admin/kids/contents/{$c->id}", ['title' => 'Yangi nom', 'category' => 'music'])
            ->assertOk()->assertJsonPath('data.title', 'Yangi nom')->assertJsonPath('data.category', 'music')
            ->assertJsonPath('data.groups.0.id', $this->middle->id);   // guruhlar o'zgarmadi

        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents')->assertOk()->assertJsonCount(1, 'data');

        $this->as($this->owner)->patchJson("/api/v1/admin/kids/contents/{$c->id}/status", ['status' => 'hidden'])->assertOk()->assertJsonPath('data.status', 'hidden');
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents')->assertOk()->assertJsonCount(0, 'data');
        $this->as($this->teacher)->getJson("/api/v1/teacher/kids/contents/{$c->id}")->assertNotFound();

        $this->as($this->owner)->getJson('/api/v1/admin/kids/contents?status=hidden')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.hidden', 1);
    }

    // 3. Boshqa bog'cha kontentiga kirish taqiqlangan
    public function test_boshqa_bogcha_kontenti_url_va_api_orqali_ochilmaydi(): void
    {
        $c        = $this->create();
        $otherOrg = Organization::factory()->create();
        $intruder = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $otherOrg->id]);
        $otherGroup = Group::factory()->create(['organization_id' => $otherOrg->id, 'age_category' => '4-5 yosh']);
        $otherTeacher = $this->teacherFor($otherOrg, [$otherGroup]);

        $this->as($intruder)->getJson('/api/v1/admin/kids/contents')->assertOk()->assertJsonCount(0, 'data');
        $this->as($intruder)->getJson("/api/v1/admin/kids/contents/{$c->id}")->assertNotFound();
        $this->as($intruder)->putJson("/api/v1/admin/kids/contents/{$c->id}", ['title' => 'Buzildi'])->assertNotFound();
        $this->as($intruder)->patchJson("/api/v1/admin/kids/contents/{$c->id}/status", ['status' => 'hidden'])->assertNotFound();
        $this->as($intruder)->deleteJson("/api/v1/admin/kids/contents/{$c->id}")->assertNotFound();
        $this->as($otherTeacher)->getJson("/api/v1/teacher/kids/contents/{$c->id}")->assertNotFound();
        $this->as($otherTeacher)->putJson("/api/v1/teacher/kids/contents/{$c->id}/favorite", ['favorite' => true])->assertNotFound();

        // boshqa bog'cha guruhiga biriktirib bo'lmaydi
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['group_ids' => [$otherGroup->id]]))
            ->assertUnprocessable()->assertJsonValidationErrors('group_ids');

        $this->assertSame('Ranglar va shakllar', $c->fresh()->title);
        $this->assertSame('active', $c->fresh()->status);
    }

    // Rollar: Super Admin kontentni boshqarmaydi; tarbiyachi va ota-ona admin API'siga kira olmaydi
    public function test_super_admin_tarbiyachi_va_ota_ona_kutubxonani_boshqara_olmaydi(): void
    {
        $c = EducationalContent::create(['organization_id' => $this->org->id, 'title' => 'Test', 'youtube_video_id' => self::VID,
            'language' => 'uz', 'category' => 'lessons', 'min_age' => 4, 'max_age' => 5]);
        $this->deleteJson("/api/v1/admin/kids/contents/{$c->id}")->assertUnauthorized();
        $this->getJson('/api/v1/teacher/kids/contents')->assertUnauthorized();

        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $parent = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->org->id]);
        foreach ([$sa, $this->teacher, $parent] as $user) {
            $headers = $user->isSuperAdmin() ? ['X-Impersonated-Org' => (string) $this->org->id] : [];
            $this->as($user)->getJson('/api/v1/admin/kids/contents', $headers)->assertForbidden();
            $this->as($user)->postJson('/api/v1/admin/kids/contents', $this->payload(), $headers)->assertForbidden();
            $this->as($user)->postJson('/api/v1/admin/kids/contents/preview', ['youtube_url' => 'https://youtu.be/' . self::VID], $headers)->assertForbidden();
            $this->as($user)->deleteJson("/api/v1/admin/kids/contents/{$c->id}", [], $headers)->assertForbidden();
            $this->as($user)->getJson('/api/v1/admin/kids/usage', $headers)->assertForbidden();
        }
        $this->as($this->owner)->getJson('/api/v1/teacher/kids/contents')->assertForbidden();
        $this->as($parent)->getJson('/api/v1/teacher/kids/contents')->assertForbidden();
        $this->assertSame(1, EducationalContent::count());
    }

    // 4. Tarbiyachi faqat o'z guruhini ko'radi; bir nechta guruh orasida tanlaydi
    public function test_tarbiyachi_faqat_ozining_guruhlari_kontentini_koradi(): void
    {
        $mine  = $this->create(['title' => 'Quvnoqlar uchun']);
        $other = $this->create(['title' => 'Kattalar uchun', 'min_age' => 6, 'max_age' => 7, 'group_ids' => [$this->big->id]]);

        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents')->assertOk()
            ->assertJsonPath('group_id', $this->middle->id)
            ->assertJsonCount(1, 'groups')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Quvnoqlar uchun');
        $this->as($this->teacher)->getJson("/api/v1/teacher/kids/contents?group_id={$this->big->id}")->assertNotFound();
        $this->as($this->teacher)->getJson("/api/v1/teacher/kids/contents/{$other->id}")->assertNotFound();

        $multi = $this->teacherFor($this->org, [$this->middle, $this->big]);
        $this->as($multi)->getJson('/api/v1/teacher/kids/contents')->assertOk()->assertJsonCount(2, 'groups');
        $this->as($multi)->getJson("/api/v1/teacher/kids/contents?group_id={$this->big->id}")->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $other->id);
        $this->assertNotNull($mine);
    }

    // 5. Yosh bo'yicha filtr (backend'da ham)
    public function test_yosh_mos_kelmasa_biriktirilmaydi_va_korsatilmaydi(): void
    {
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['min_age' => 6, 'max_age' => 7, 'group_ids' => [$this->small->id]]))
            ->assertUnprocessable()->assertJsonValidationErrors('group_ids');
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['min_age' => 5, 'max_age' => 3]))
            ->assertUnprocessable()->assertJsonValidationErrors('max_age');
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['min_age' => 0]))->assertUnprocessable();

        // guruh yoshi keyinroq o'zgarsa — mos kelmaydigan kontent avtomatik yashiriladi
        $c = $this->create(['min_age' => 4, 'max_age' => 5]);
        $this->middle->update(['age_category' => '6-7 yosh']);
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents')->assertOk()->assertJsonCount(0, 'data');
        $this->as($this->teacher)->getJson("/api/v1/teacher/kids/contents/{$c->id}")->assertNotFound();
    }

    public function test_guruh_yosh_oraligi_matndan_aniqlanadi(): void
    {
        $cases = ['3-4 yosh' => [3, 4], '6–7 yosh (tayyorlov)' => [6, 7], '5 yosh' => [5, 5], '7-6' => [6, 7], null => null, 'katta' => null];
        foreach ($cases as $text => $expected) {
            $this->assertSame($expected, (new Group(['age_category' => $text === '' ? null : $text]))->ageRange(), (string) $text);
        }
    }

    // 6. Til va kategoriya bo'yicha filtr
    public function test_til_kategoriya_va_qidiruv_filtrlari(): void
    {
        $this->create(['title' => 'English ABC', 'language' => 'en', 'category' => 'languages']);
        $this->create(['title' => 'Песенка', 'language' => 'ru', 'category' => 'music', 'youtube_url' => 'https://youtu.be/' . self::VID2]);
        $this->create(['title' => 'Sanash', 'language' => 'uz', 'category' => 'lessons']);

        $t = $this->as($this->teacher);
        $t->getJson('/api/v1/teacher/kids/contents?language=en')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'English ABC');
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents?category=music')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.language', 'ru');
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents?q=sana')->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents?language=de')->assertUnprocessable();
        $this->as($this->owner)->getJson('/api/v1/admin/kids/contents?language=ru&category=music')->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->owner)->getJson("/api/v1/admin/kids/contents?group_id={$this->middle->id}")->assertOk()->assertJsonCount(3, 'data');
    }

    // 7. Video URL validatsiyasi
    public function test_faqat_ruxsat_etilgan_youtube_havolalari_qabul_qilinadi(): void
    {
        $valid = [
            'https://www.youtube.com/watch?v=' . self::VID, 'https://youtube.com/watch?v=' . self::VID . '&list=x', 'https://m.youtube.com/watch?v=' . self::VID,
            'https://youtu.be/' . self::VID, 'https://www.youtube.com/shorts/' . self::VID, 'https://www.youtube.com/embed/' . self::VID,
            'https://www.youtube-nocookie.com/embed/' . self::VID, 'www.youtube.com/live/' . self::VID, 'http://youtu.be/' . self::VID,
        ];
        foreach ($valid as $url) {
            $this->assertSame(self::VID, YouTubeVideo::parseId($url), $url);
        }

        $invalid = [
            '', 'dQw4w9WgXcQ', 'https://vimeo.com/123456', 'javascript:alert(1)', 'https://evil.com/watch?v=' . self::VID,
            'https://youtube.com.evil.com/watch?v=' . self::VID, 'https://evil.com/?u=https://youtu.be/' . self::VID,
            '<iframe src="https://www.youtube.com/embed/' . self::VID . '"></iframe>', 'https://www.youtube.com/@kidstv',
            'https://www.youtube.com/playlist?list=PL123', 'https://www.youtube.com/watch?v=short', 'https://user:pass@youtu.be/' . self::VID,
            'https://youtu.be:8080/' . self::VID, 'ftp://youtu.be/' . self::VID, 'https://www.youtube.com/watch?v=' . self::VID . '"><script>',
        ];
        foreach ($invalid as $url) {
            $this->assertNull(YouTubeVideo::parseId($url), $url);
            $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['youtube_url' => $url]))
                ->assertUnprocessable()->assertJsonValidationErrors('youtube_url');
        }
        $this->assertSame(0, EducationalContent::count());
    }

    public function test_html_va_skript_kiritilmaydi(): void
    {
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['title' => '<script>alert(1)</script>']))
            ->assertUnprocessable()->assertJsonValidationErrors('title');
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents', $this->payload(['description' => '<img src=x onerror=alert(1)>']))
            ->assertUnprocessable()->assertJsonValidationErrors('description');
    }

    // 8. Sevimlilar
    public function test_sevimlilar_shaxsiy_va_filtr_ishlaydi(): void
    {
        $a = $this->create(['title' => 'Alfa']);
        $this->create(['title' => 'Beta', 'youtube_url' => 'https://youtu.be/' . self::VID2]);
        $colleague = $this->teacherFor($this->org, [$this->middle]);

        $this->as($this->teacher)->putJson("/api/v1/teacher/kids/contents/{$a->id}/favorite", ['favorite' => true])->assertOk()->assertJsonPath('is_favorite', true);
        $this->as($this->teacher)->putJson("/api/v1/teacher/kids/contents/{$a->id}/favorite", ['favorite' => true])->assertOk();   // idempotent
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents?favorites=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.is_favorite', true);
        $this->as($colleague)->getJson('/api/v1/teacher/kids/contents?favorites=1')->assertOk()->assertJsonCount(0, 'data');

        $this->as($this->teacher)->putJson("/api/v1/teacher/kids/contents/{$a->id}/favorite", ['favorite' => false])->assertOk()->assertJsonPath('is_favorite', false);
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents?favorites=1')->assertOk()->assertJsonCount(0, 'data');
        $this->assertDatabaseCount('educational_content_favorites', 0);
    }

    // 9. Foydalanish tarixi
    public function test_foydalanish_qayd_etiladi_va_rahbar_tarixini_koradi(): void
    {
        $c = $this->create();
        $this->as($this->teacher)->postJson("/api/v1/teacher/kids/contents/{$c->id}/usage", ['group_id' => $this->middle->id, 'note' => "Ertalabki mashg'ulot"])
            ->assertCreated();
        $this->as($this->teacher)->postJson("/api/v1/teacher/kids/contents/{$c->id}/usage", ['group_id' => $this->big->id])->assertNotFound();
        $this->as($this->teacher)->postJson("/api/v1/teacher/kids/contents/{$c->id}/usage", ['group_id' => $this->middle->id, 'used_on' => now()->addDay()->toDateString()])
            ->assertUnprocessable();

        $this->as($this->owner)->getJson('/api/v1/admin/kids/usage')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.content.title', 'Ranglar va shakllar')
            ->assertJsonPath('data.0.group.name', 'Quvnoqlar')
            ->assertJsonPath('data.0.teacher', $this->teacher->name)
            ->assertJsonPath('data.0.note', "Ertalabki mashg'ulot");
        $this->as($this->owner)->getJson('/api/v1/admin/kids/contents')->assertJsonPath('data.0.usage_count', 1);

        $other = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => Organization::factory()->create()->id]);
        $this->as($other)->getJson('/api/v1/admin/kids/usage')->assertOk()->assertJsonCount(0, 'data');
    }

    // O'chirish: soft delete, tarix saqlanadi, boshqa bog'chaga ta'sir qilmaydi
    public function test_ochirish_faqat_shu_kontentni_ochiradi_tarix_saqlanadi(): void
    {
        $c = $this->create();
        $otherOrg = Organization::factory()->create();
        $otherOwner = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $otherOrg->id]);
        $foreign = $this->create(['group_ids' => []], $otherOwner);
        $this->as($this->teacher)->postJson("/api/v1/teacher/kids/contents/{$c->id}/usage", ['group_id' => $this->middle->id])->assertCreated();

        $this->as($this->owner)->deleteJson("/api/v1/admin/kids/contents/{$c->id}")->assertOk();
        $this->assertSoftDeleted('educational_contents', ['id' => $c->id]);
        $this->assertNotSoftDeleted('educational_contents', ['id' => $foreign->id]);
        $this->assertDatabaseCount('educational_content_usage_logs', 1);
        $this->as($this->owner)->getJson('/api/v1/admin/kids/usage')->assertJsonPath('data.0.content.deleted', true);
        $this->as($this->teacher)->getJson('/api/v1/teacher/kids/contents')->assertJsonCount(0, 'data');
        $this->assertNotNull($this->middle->fresh());
    }

    // Avtomatik tavsiya: kalitsiz ishlaydi, xato bo'lsa qo'lda kiritish
    public function test_preview_metama_lumot_va_ehtiyotkor_tavsiyalar(): void
    {
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents/preview', ['youtube_url' => 'https://youtu.be/' . self::VID])
            ->assertOk()
            ->assertJsonPath('video_id', self::VID)
            ->assertJsonPath('metadata.title', 'Ranglar va shakllar — bolalar uchun')
            ->assertJsonPath('metadata.embeddable', true)
            ->assertJsonPath('suggestions.language', 'uz')
            ->assertJsonPath('suggestions.category', 'lessons')
            ->assertJsonPath('suggestions.min_age', 4)            // aniq belgi yo'q — eng kichiklarga tavsiya qilinmaydi
            ->assertJsonPath('suggestions.group_ids', [$this->middle->id, $this->big->id])
            ->assertJsonPath('duplicate', false)
            ->assertJsonMissingPath('metadata.api_key');

        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents/preview', ['youtube_url' => 'https://vimeo.com/1'])->assertUnprocessable();
    }

    public function test_yosh_tavsiyasi_ehtiyotkor_va_aniq_belgiga_tayanadi(): void
    {
        $svc    = app(\App\Services\Kids\ContentSuggestionService::class);
        $groups = \App\Models\Group::where('organization_id', $this->org->id)->get();
        $this->assertSame([4, 7], array_slice(array_values($svc->suggest(['title' => 'Baby Shark Dance'], $groups)), 2, 2));          // «baby» — aniq belgi emas
        $this->assertSame([2, 4], array_slice(array_values($svc->suggest(['title' => 'Colors for toddlers'], $groups)), 2, 2));
        $this->assertSame([3, 5], array_slice(array_values($svc->suggest(['title' => 'Песенки 3-5 лет'], $groups)), 2, 2));
        $this->assertSame('ru', $svc->suggest(['title' => 'Песенки 3-5 лет'], $groups)['language']);
        $this->assertSame('music', $svc->suggest(['title' => 'Песенки 3-5 лет'], $groups)['category']);
        $this->assertSame('languages', $svc->suggest(['title' => 'Learn English ABC'], $groups)['category']);
    }

    public function test_youtube_ishlamasa_yoki_embed_bloklangan_bolsa_ham_modul_ishlaydi(): void
    {
        $this->oembed = [401, 'Unauthorized'];
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents/preview', ['youtube_url' => 'https://youtu.be/' . self::VID2])
            ->assertOk()->assertJsonPath('metadata.embeddable', false)->assertJsonPath('metadata.title', null);
        $this->create(['youtube_url' => 'https://youtu.be/' . self::VID2]);
        $this->assertFalse(EducationalContent::sole()->embeddable);
    }

    public function test_tarmoq_xatosida_qolda_kiritish_mumkin(): void
    {
        $this->oembed = 'offline';
        $this->as($this->owner)->postJson('/api/v1/admin/kids/contents/preview', ['youtube_url' => 'https://youtu.be/' . self::VID2])
            ->assertOk()->assertJsonPath('metadata.available', false)->assertJsonPath('suggestions.confidence', 'none');
        $this->create(['youtube_url' => 'https://youtu.be/' . self::VID2]);
        $this->assertNull(EducationalContent::sole()->embeddable);
    }
}
