<?php

namespace Tests\Feature\Daily;

use App\Models\Child;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\SleepRecord;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Baza darajasidagi cheklovlar (faqat kiddo_test, RefreshDatabase). */
class DailySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_ovqat_bola_sana_tur_boyicha_bitta_faol_yozuv(): void
    {
        $child = Child::factory()->create();
        MealRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28', 'meal_type' => 'tushlik']);
        MealRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28', 'meal_type' => 'nonushta']); // boshqa tur — ruxsat

        $this->expectException(UniqueConstraintViolationException::class);
        MealRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28', 'meal_type' => 'tushlik']);
    }

    public function test_ochirilgan_ovqat_orniga_yangisi_yoziladi(): void
    {
        $child = Child::factory()->create();
        MealRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28'])->delete();

        MealRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28']);
        $this->assertSame(2, MealRecord::withTrashed()->where('child_id', $child->id)->count());
    }

    public function test_notogri_ovqat_turi_bazada_rad_etiladi(): void
    {
        $this->expectException(QueryException::class);
        MealRecord::factory()->create(['meal_type' => 'kechlik']);
    }

    public function test_uyqu_kuniga_bitta_faol_yozuv(): void
    {
        $child = Child::factory()->create();
        SleepRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28']);
        SleepRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-27']);

        $this->expectException(UniqueConstraintViolationException::class);
        SleepRecord::factory()->create(['child_id' => $child->id, 'date' => '2026-10-28']);
    }

    public function test_uyqu_tugashi_boshlanishdan_oldin_bolmaydi_bazada_ham(): void
    {
        SleepRecord::factory()->create(['started_at' => '13:00', 'ended_at' => null]); // hali uxlayapti

        $this->expectException(QueryException::class);
        SleepRecord::factory()->create(['started_at' => '13:00', 'ended_at' => '12:59']);
    }

    public function test_mashgulot_bir_kunda_bir_nechta(): void
    {
        $a = GroupActivity::factory()->create(['date' => '2026-10-28']);
        GroupActivity::factory()->create(['group_id' => $a->group_id, 'date' => '2026-10-28', 'title' => 'Musiqa']);

        $this->assertSame(2, GroupActivity::where('group_id', $a->group_id)->count());
    }
}
