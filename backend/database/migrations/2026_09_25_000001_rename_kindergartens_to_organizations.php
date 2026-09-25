<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop FK before renaming column
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['kindergarten_id']);
            $table->renameColumn('kindergarten_id', 'organization_id');
        });

        Schema::rename('kindergartens', 'organizations');

        // Re-add FK pointing to new table name
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('organization_id')
                  ->references('id')
                  ->on('organizations')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
            $table->renameColumn('organization_id', 'kindergarten_id');
        });

        Schema::rename('organizations', 'kindergartens');

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('kindergarten_id')
                  ->references('id')
                  ->on('kindergartens')
                  ->nullOnDelete();
        });
    }
};
