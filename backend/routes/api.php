<?php

use App\Http\Controllers\Admin\ChildController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\GroupController;
use App\Http\Controllers\Admin\ParentController;
use App\Http\Controllers\Admin\TeacherController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DemoRequestController;
use App\Http\Controllers\SuperAdmin\DemoRequestController as SuperDemoRequestController;
use App\Http\Controllers\Mobile\AuthController as MobileAuthController;
use App\Http\Controllers\Admin\AttendanceController as AdminAttendanceController;
use App\Http\Controllers\Admin\DailyController as AdminDailyController;
use App\Http\Controllers\Admin\MessageController as AdminMessageController;
use App\Http\Controllers\Parent\DailyController as ParentDailyController;
use App\Http\Controllers\Teacher\ChildController as TeacherChildController;
use App\Http\Controllers\Teacher\MessageController as TeacherMessageController;
use App\Http\Controllers\Parent\MessageController as ParentMessageController;
use App\Http\Controllers\Teacher\DailyController as TeacherDailyController;
use App\Http\Controllers\Parent\AttendanceController as ParentAttendanceController;
use App\Http\Controllers\Parent\ChildController as ParentChildController;
use App\Http\Controllers\Teacher\AttendanceController as TeacherAttendanceController;
use App\Http\Controllers\SuperAdmin\ActivityLogController;
use App\Http\Controllers\SuperAdmin\DashboardController as SuperDashboard;
use App\Http\Controllers\SuperAdmin\InvoiceController;
use App\Http\Controllers\SuperAdmin\NotificationController;
use App\Http\Controllers\SuperAdmin\OrganizationController as SuperOrgController;
use App\Http\Controllers\SuperAdmin\OrganizationImportController as SuperOrgImportController;
use App\Http\Controllers\Admin\NotificationController as AdminNotificationController;
use App\Http\Controllers\Admin\PaymentController as AdminChildPaymentController;
use App\Http\Controllers\Admin\PhotoController as AdminPhotoController;
use App\Http\Controllers\Teacher\PhotoController as TeacherPhotoController;
use App\Http\Controllers\Parent\MediaController as ParentMediaController;
use App\Http\Controllers\SuperAdmin\PaymentController;
use App\Http\Controllers\SuperAdmin\PlanController;
use App\Http\Controllers\SuperAdmin\ReportController;
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

    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

    // Landing: «14 kunlik bepul DEMO» arizasi — autentifikatsiyasiz
    Route::post('/demo-requests', [DemoRequestController::class, 'store'])->middleware('throttle:demo-requests');

    // ── Mobil ilova (faqat ota-ona) ────────────────────────────────
    // Login web bilan bir xil 'login' limiter hisoblagichlarini ishlatadi
    Route::post('/mobile/login', [MobileAuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/mobile/token/refresh', [MobileAuthController::class, 'refresh'])->middleware('throttle:mobile-refresh');

    // password.changed: vaqtinchalik parol almashtirilmaguncha faqat /me, /me/password va /logout
    Route::middleware(['auth:sanctum', 'password.changed'])->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/me/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');

        // ── Admin ──────────────────────────────────────────────────
        // Super Admin bu yerda faqat ko'radi (impersonatsiya) — yozish amallari rahbarga tegishli
        Route::middleware(['role:admin,super_admin', 'super_admin.read_only'])->prefix('admin')->group(function () {
            Route::get('/dashboard', [DashboardController::class, 'summary']);

            Route::get('/groups', [GroupController::class, 'index']);
            Route::post('/groups', [GroupController::class, 'store']);
            Route::put('/groups/{id}', [GroupController::class, 'update']);
            Route::delete('/groups/{id}', [GroupController::class, 'destroy']);

            Route::get('/children', [ChildController::class, 'index']);
            Route::post('/children', [ChildController::class, 'store']);
            Route::get('/children/{id}', [ChildController::class, 'show']);
            Route::put('/children/{id}', [ChildController::class, 'update']);
            Route::delete('/children/{id}', [ChildController::class, 'destroy']);
            Route::post('/children/{id}/parents', [ChildController::class, 'attachParent']);
            Route::delete('/children/{id}/parents/{parentId}', [ChildController::class, 'detachParent']);
            Route::get('/children/{id}/photo', [ChildController::class, 'photo']);
            Route::post('/children/{id}/photo', [ChildController::class, 'uploadPhoto'])->middleware('throttle:20,1');
            Route::delete('/children/{id}/photo', [ChildController::class, 'deletePhoto']);

            Route::get('/teachers', [TeacherController::class, 'index']);
            Route::post('/teachers', [TeacherController::class, 'store']);
            Route::put('/teachers/{id}', [TeacherController::class, 'update']);
            Route::put('/teachers/{id}/groups', [TeacherController::class, 'syncGroups']);
            Route::patch('/teachers/{id}/activate', [TeacherController::class, 'activate']);
            Route::patch('/teachers/{id}/deactivate', [TeacherController::class, 'deactivate']);
            Route::post('/teachers/{id}/reset-password', [TeacherController::class, 'resetPassword']);

            Route::get('/parents', [ParentController::class, 'index']);
            Route::post('/parents', [ParentController::class, 'store']);
            Route::put('/parents/{id}', [ParentController::class, 'update']);
            Route::patch('/parents/{id}/activate', [ParentController::class, 'activate']);
            Route::patch('/parents/{id}/deactivate', [ParentController::class, 'deactivate']);
            Route::post('/parents/{id}/reset-password', [ParentController::class, 'resetPassword']);

            Route::get('/attendance', [AdminAttendanceController::class, 'index']);
            Route::put('/attendance', [AdminAttendanceController::class, 'update']);
            Route::get('/attendance/monthly', [AdminAttendanceController::class, 'monthly']);
            Route::get('/attendance/export', [AdminAttendanceController::class, 'export']);

            Route::get('/daily', [AdminDailyController::class, 'show']);
            Route::put('/daily/meals', [AdminDailyController::class, 'storeMeals']);
            Route::delete('/daily/meals/{id}', [AdminDailyController::class, 'destroyMeal']);
            Route::put('/daily/sleep', [AdminDailyController::class, 'storeSleep']);
            Route::delete('/daily/sleep/{id}', [AdminDailyController::class, 'destroySleep']);
            Route::post('/daily/activities', [AdminDailyController::class, 'storeActivity']);
            Route::put('/daily/activities/{id}', [AdminDailyController::class, 'updateActivity']);
            Route::delete('/daily/activities/{id}', [AdminDailyController::class, 'destroyActivity']);

            Route::get('/messages', [AdminMessageController::class, 'index']);
            Route::post('/messages', [AdminMessageController::class, 'store'])->middleware('throttle:30,1');

            // Super Admin bildirishnomalari (read-all {id} dan oldin)
            Route::get('/notifications', [AdminNotificationController::class, 'index']);
            Route::patch('/notifications/read-all', [AdminNotificationController::class, 'markAllRead']);
            Route::patch('/notifications/{id}/read', [AdminNotificationController::class, 'markRead']);

            // Oylik to'lov holati
            Route::get('/payments', [AdminChildPaymentController::class, 'index']);
            Route::put('/payments', [AdminChildPaymentController::class, 'store']);
            Route::delete('/payments/{childId}/{month}', [AdminChildPaymentController::class, 'destroy']);

            // Guruh fotogalereyasi
            Route::get('/photos', [AdminPhotoController::class, 'index']);
            Route::post('/photos', [AdminPhotoController::class, 'store'])->middleware('throttle:30,1');
            Route::get('/photos/{id}/file', [AdminPhotoController::class, 'file']);
            Route::delete('/photos/{id}', [AdminPhotoController::class, 'destroy']);
        });

        // ── Super Admin ────────────────────────────────────────────
        Route::middleware('role:super_admin')->prefix('super-admin')->group(function () {
            Route::get('/dashboard',                          [SuperDashboard::class,   'summary']);

            // Landing'dan kelgan DEMO arizalari
            Route::get('/demo-requests',                      [SuperDemoRequestController::class, 'index']);
            Route::get('/demo-requests/{id}',                 [SuperDemoRequestController::class, 'show'])->whereNumber('id');
            Route::patch('/demo-requests/{id}',               [SuperDemoRequestController::class, 'update'])->whereNumber('id');
            Route::post('/demo-requests/{id}/retry-telegram', [SuperDemoRequestController::class, 'retryTelegram'])->whereNumber('id')->middleware('throttle:20,1');

            // ── Billing (BILLING_ENABLED=false bo'lsa 404) ──
            Route::middleware('billing')->group(function () {
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

                // Bog'cha obunasi va platforma hisobotlari
                Route::post('/organizations/{id}/renew',         [SuperOrgController::class, 'renewSubscription']);
                Route::get('/organizations/{id}/payments',       [SuperOrgController::class, 'payments']);
                Route::get('/dashboard/revenue',                 [SuperDashboard::class, 'revenue']);
                Route::get('/dashboard/expiring',                [SuperDashboard::class, 'expiring']);
                Route::get('/reports/overview',                  [ReportController::class, 'overview']);
                Route::get('/reports/revenue',                   [ReportController::class, 'revenue']);
                Route::get('/reports/subscriptions',             [ReportController::class, 'subscriptions']);
            });

            // Organizations (Excel import {id} wildcard'dan oldin)
            Route::get('/organizations/import/template',     [SuperOrgImportController::class, 'template']);
            Route::post('/organizations/import/preview',     [SuperOrgImportController::class, 'preview'])->middleware('throttle:30,1');
            Route::post('/organizations/import',             [SuperOrgImportController::class, 'store'])->middleware('throttle:10,1');
            Route::get('/organizations',                     [SuperOrgController::class, 'index']);
            Route::get('/organizations/stats',               [SuperOrgController::class, 'stats']);
            Route::get('/organizations/filter-options',      [SuperOrgController::class, 'filterOptions']);
            Route::get('/organizations/export',              [SuperOrgController::class, 'export'])->middleware('throttle:20,1');
            Route::post('/organizations/bulk-status',        [SuperOrgController::class, 'bulkStatus'])->middleware('throttle:30,1');
            Route::post('/organizations',                    [SuperOrgController::class, 'store']);
            Route::get('/organizations/{id}',                [SuperOrgController::class, 'show'])->whereNumber('id');
            Route::patch('/organizations/{id}/status',       [SuperOrgController::class, 'changeStatus'])->whereNumber('id');
            Route::get('/organizations/{id}/status-history', [SuperOrgController::class, 'statusHistory'])->whereNumber('id');
            Route::get('/organizations/{id}/groups',         [SuperOrgController::class, 'groups'])->whereNumber('id');
            Route::get('/organizations/{id}/teachers',       [SuperOrgController::class, 'teachers'])->whereNumber('id');
            Route::get('/organizations/{id}/children-summary', [SuperOrgController::class, 'childrenSummary'])->whereNumber('id');
            Route::get('/organizations/{id}/attendance',     [SuperOrgController::class, 'attendance'])->whereNumber('id');
            Route::put('/organizations/{id}',                [SuperOrgController::class, 'update']);
            Route::patch('/organizations/{id}/activate',     [SuperOrgController::class, 'activate']);
            Route::patch('/organizations/{id}/deactivate',   [SuperOrgController::class, 'deactivate']);
            Route::delete('/organizations/{id}',             [SuperOrgController::class, 'destroy']);
            Route::post('/organizations/{id}/reset-password',[SuperOrgController::class, 'resetPassword']);
            Route::post('/organizations/{id}/admin-account', [SuperOrgController::class, 'createAdminAccount'])->middleware('throttle:30,1');
            Route::post('/organizations/{id}/enter',         [SuperOrgController::class, 'enter']);
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

            // Dashboard extra endpoints (must come before wildcard)
            Route::get('/dashboard/recent',                  [SuperDashboard::class, 'recent']);

            // Reports
            Route::prefix('reports')->group(function () {
                Route::get('/organizations', [ReportController::class, 'organizations']);
                Route::get('/users',         [ReportController::class, 'users']);
            });
        });

        // ── Teacher ────────────────────────────────────────────────
        // Admin ota-ona va tarbiyachilarni faqat /admin/* orqali boshqaradi
        Route::middleware('role:teacher')->prefix('teacher')->group(function () {
            Route::get('/dashboard', [TeacherAttendanceController::class, 'dashboard']);
            Route::put('/attendance', [TeacherAttendanceController::class, 'store']);
            Route::get('/attendance/monthly', [TeacherAttendanceController::class, 'monthly']);
            Route::get('/attendance/export', [TeacherAttendanceController::class, 'export']);

            Route::get('/children', [TeacherChildController::class, 'index']);
            Route::get('/children/{id}', [TeacherChildController::class, 'show']);
            Route::get('/children/{id}/history', [TeacherChildController::class, 'history']);
            Route::get('/children/{id}/photo', [TeacherChildController::class, 'photo']);
            Route::post('/children/{id}/photo', [TeacherChildController::class, 'uploadPhoto'])->middleware('throttle:20,1');
            Route::delete('/children/{id}/photo', [TeacherChildController::class, 'deletePhoto']);

            Route::get('/photos', [TeacherPhotoController::class, 'index']);
            Route::post('/photos', [TeacherPhotoController::class, 'store'])->middleware('throttle:30,1');
            Route::get('/photos/{id}/file', [TeacherPhotoController::class, 'file']);
            Route::delete('/photos/{id}', [TeacherPhotoController::class, 'destroy']);

            Route::get('/messages', [TeacherMessageController::class, 'index']);
            Route::post('/messages', [TeacherMessageController::class, 'store'])->middleware('throttle:30,1');

            Route::get('/daily', [TeacherDailyController::class, 'show']);
            Route::put('/daily/meals', [TeacherDailyController::class, 'storeMeals']);
            Route::delete('/daily/meals/{id}', [TeacherDailyController::class, 'destroyMeal']);
            Route::put('/daily/sleep', [TeacherDailyController::class, 'storeSleep']);
            Route::delete('/daily/sleep/{id}', [TeacherDailyController::class, 'destroySleep']);
            Route::post('/daily/activities', [TeacherDailyController::class, 'storeActivity']);
            Route::put('/daily/activities/{id}', [TeacherDailyController::class, 'updateActivity']);
            Route::delete('/daily/activities/{id}', [TeacherDailyController::class, 'destroyActivity']);
        });

        // ── Parent ─────────────────────────────────────────────────
        Route::middleware(['role:parent', 'abilities:mobile'])->prefix('mobile')->group(function () {
            Route::post('/logout', [MobileAuthController::class, 'logout']);
            Route::get('/sessions', [MobileAuthController::class, 'sessions']);
            Route::delete('/sessions/{sid}', [MobileAuthController::class, 'destroySession']);
        });

        // Web (/ota-ona) va mobil tokenlar ikkalasida ham 'parent' ability bor
        Route::middleware(['role:parent', 'abilities:parent'])->prefix('parent')->group(function () {
            Route::get('/children', [ParentChildController::class, 'index']);
            Route::get('/children/{id}/attendance', [ParentAttendanceController::class, 'index']);
            Route::get('/children/{id}/daily', [ParentDailyController::class, 'show']);
            Route::get('/children/{id}/photo', [ParentChildController::class, 'photo']);
            Route::get('/children/{id}/photos', [ParentMediaController::class, 'photos']);
            Route::get('/children/{id}/payments', [ParentMediaController::class, 'payments']);
            Route::get('/photos/{id}/file', [ParentMediaController::class, 'photoFile']);
            Route::get('/messages', [ParentMessageController::class, 'index']);
            Route::patch('/messages/{id}/read', [ParentMessageController::class, 'read']);
        });
    });
});
