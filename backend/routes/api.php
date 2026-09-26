<?php

use App\Http\Controllers\Admin\ChildController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\GroupController;
use App\Http\Controllers\Admin\ParentController;
use App\Http\Controllers\Admin\TeacherController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SuperAdmin\ActivityLogController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperDashboard;
use App\Http\Controllers\SuperAdmin\InvoiceController;
use App\Http\Controllers\SuperAdmin\NotificationController;
use App\Http\Controllers\SuperAdmin\OrganizationController as SuperOrgController;
use App\Http\Controllers\SuperAdmin\PaymentController;
use App\Http\Controllers\SuperAdmin\PlanController;
use App\Http\Controllers\SuperAdmin\SubscriptionController;
use App\Http\Controllers\SuperAdmin\UserController as SuperUserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app'    => config('app.name'),
        'time'   => now()->toIso8601String(),
    ]);
});

Route::prefix('v1')->group(function () {

    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // ── Admin ──────────────────────────────────────────────────
        Route::middleware('role:admin,super_admin')->prefix('admin')->group(function () {
            Route::get('/dashboard', [DashboardController::class, 'summary']);

            Route::get('/groups', [GroupController::class, 'index']);
            Route::post('/groups', [GroupController::class, 'store']);

            Route::get('/children', [ChildController::class, 'index']);
            Route::post('/children', [ChildController::class, 'store']);
            Route::get('/children/{id}', [ChildController::class, 'show']);
            Route::put('/children/{id}', [ChildController::class, 'update']);
            Route::delete('/children/{id}', [ChildController::class, 'destroy']);

            Route::get('/teachers', [TeacherController::class, 'index']);
            Route::post('/teachers', [TeacherController::class, 'store']);

            Route::get('/parents', [ParentController::class, 'index']);
        });

        // ── Super Admin ────────────────────────────────────────────
        Route::middleware('role:super_admin')->prefix('super-admin')->group(function () {
            Route::get('/dashboard',                          [SuperDashboard::class,   'summary']);

            // Plans
            Route::get('/plans',                              [PlanController::class,   'index']);
            Route::post('/plans',                             [PlanController::class,   'store']);
            Route::get('/plans/{id}',                         [PlanController::class,   'show']);
            Route::put('/plans/{id}',                         [PlanController::class,   'update']);
            Route::patch('/plans/{id}/activate',              [PlanController::class,   'activate']);
            Route::patch('/plans/{id}/deactivate',            [PlanController::class,   'deactivate']);

            // Subscriptions (metrics must come before {id} wildcard)
            Route::get('/subscriptions',                             [SubscriptionController::class, 'index']);
            Route::get('/subscriptions/metrics',                     [SubscriptionController::class, 'metrics']);
            Route::post('/subscriptions',                            [SubscriptionController::class, 'store']);
            Route::get('/subscriptions/{id}',                        [SubscriptionController::class, 'show']);
            Route::patch('/subscriptions/{id}/toggle-auto-renew',    [SubscriptionController::class, 'toggleAutoRenew']);
            Route::post('/subscriptions/{id}/renew',                 [SubscriptionController::class, 'renew']);
            Route::post('/subscriptions/{id}/change-plan',           [SubscriptionController::class, 'changePlan']);
            Route::post('/subscriptions/{id}/cancel',                [SubscriptionController::class, 'cancel']);

            // Payments
            Route::get('/payments',                           [PaymentController::class, 'index']);
            Route::get('/payments/{id}',                      [PaymentController::class, 'show']);
            Route::post('/payments/{id}/verify',              [PaymentController::class, 'verify']);
            Route::post('/payments/{id}/refund',              [PaymentController::class, 'refund']);

            // Invoices
            Route::get('/invoices',                           [InvoiceController::class, 'index']);
            Route::post('/invoices',                          [InvoiceController::class, 'store']);
            Route::get('/invoices/{id}',                      [InvoiceController::class, 'show']);
            Route::patch('/invoices/{id}/mark-paid',          [InvoiceController::class, 'markPaid']);
            Route::patch('/invoices/{id}/cancel',             [InvoiceController::class, 'cancel']);

            // Organizations
            Route::get('/organizations',                     [SuperOrgController::class, 'index']);
            Route::post('/organizations',                    [SuperOrgController::class, 'store']);
            Route::get('/organizations/{id}',                [SuperOrgController::class, 'show']);
            Route::put('/organizations/{id}',                [SuperOrgController::class, 'update']);
            Route::patch('/organizations/{id}/activate',     [SuperOrgController::class, 'activate']);
            Route::patch('/organizations/{id}/deactivate',   [SuperOrgController::class, 'deactivate']);
            Route::delete('/organizations/{id}',             [SuperOrgController::class, 'destroy']);
            Route::post('/organizations/{id}/reset-password',[SuperOrgController::class, 'resetPassword']);
            Route::post('/organizations/{id}/enter',         [SuperOrgController::class, 'enter']);
            Route::post('/organizations/{id}/renew',         [SuperOrgController::class, 'renewSubscription']);
            Route::get('/organizations/{id}/payments',       [SuperOrgController::class, 'payments']);
            Route::get('/organizations/{id}/activity',       [SuperOrgController::class, 'activityLogs']);

            // Notifications (read-all must come before {id}/read)
            Route::get('/notifications',                     [NotificationController::class, 'index']);
            Route::post('/notifications',                    [NotificationController::class, 'send']);
            Route::patch('/notifications/read-all',          [NotificationController::class, 'markAllRead']);
            Route::patch('/notifications/{id}/read',         [NotificationController::class, 'markRead']);

            // Activity logs
            Route::get('/activity-logs',                     [ActivityLogController::class, 'index']);

            // Users
            Route::get('/users',                             [SuperUserController::class, 'index']);
            Route::get('/users/{id}',                        [SuperUserController::class, 'show']);
            Route::put('/users/{id}',                        [SuperUserController::class, 'update']);
            Route::patch('/users/{id}/activate',             [SuperUserController::class, 'activate']);
            Route::patch('/users/{id}/deactivate',           [SuperUserController::class, 'deactivate']);
            Route::post('/users/{id}/reset-password',        [SuperUserController::class, 'resetPassword']);

            // Revenue chart
            Route::get('/dashboard/revenue',                 [SuperDashboard::class, 'revenue']);
        });

        // ── Teacher ────────────────────────────────────────────────
        Route::middleware('role:admin,teacher')->prefix('teacher')->group(function () {
        });

        // ── Parent ─────────────────────────────────────────────────
        Route::middleware('role:admin,parent')->prefix('parent')->group(function () {
        });
    });
});
