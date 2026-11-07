<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mashg'ulot: yo'nalish, tugash vaqti, natija/izoh va ishtirok etgan bolalar.
     * Faqat qo'shimcha nullable ustunlar va yangi pivot jadval.
     */
    public function up(): void
    {
        Schema::table('group_activities', function (Blueprint $table) {
            $table->string('direction', 30)->nullable()->after('title');
            $table->time('ends_at')->nullable()->after('starts_at');
            $table->text('result')->nullable()->after('description');
        });

        Schema::create('group_activity_child', function (Blueprint $table) {
            $table->foreignId('group_activity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->primary(['group_activity_id', 'child_id']);
            $table->index('child_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_activity_child');
        Schema::table('group_activities', function (Blueprint $table) {
            $table->dropColumn(['direction', 'ends_at', 'result']);
        });
    }
};
