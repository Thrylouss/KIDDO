<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kunlik davomat: har bir bola uchun bir kunda bitta yozuv.
     * softDeletes ishlatilmaydi — yozuvlar upsert orqali yangilanadi,
     * tuzatishlar activity_logs jadvalida saqlanadi.
     */
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('child_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete(); // o'sha kundagi guruh
            $table->date('date');
            $table->enum('status', ['present', 'absent', 'excused']);
            $table->string('note', 255)->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('marked_at');
            $table->timestamps();

            $table->unique(['child_id', 'date']);
            $table->index(['organization_id', 'date']);
            $table->index(['group_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
