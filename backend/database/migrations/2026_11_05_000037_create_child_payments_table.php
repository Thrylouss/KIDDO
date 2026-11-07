<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bolaning oylik to'lov holati (MVP «Payment Status»): to'lov tizimi emas — rahbar to'langanini qayd etadi,
     * ota-ona mobil ilovada o'z farzandining holatini ko'radi. Bir bola — bir oy — bitta yozuv.
     */
    public function up(): void
    {
        Schema::create('child_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->date('month');                         // oyning 1-kuni
            $table->unsignedInteger('amount');             // so'm
            $table->date('paid_at');
            $table->string('note', 255)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['child_id', 'month']);
            $table->index(['organization_id', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('child_payments');
    }
};
