<?php

namespace Database\Seeders;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Planlar
        $basicPlan = \App\Models\Plan::firstOrCreate(
            ['slug' => 'boshlang-ich'],
            [
                'name'          => "Boshlang'ich",
                'description'   => "Kichik bog'chalar uchun",
                'price_monthly' => 299000,
                'max_children'  => 50,
                'max_groups'    => 5,
                'is_active'     => true,
                'sort_order'    => 1,
            ]
        );

        $standardPlan = \App\Models\Plan::firstOrCreate(
            ['slug' => 'standart'],
            [
                'name'          => 'Standart',
                'description'   => "O'rta bog'chalar uchun",
                'price_monthly' => 599000,
                'max_children'  => 150,
                'max_groups'    => 15,
                'is_active'     => true,
                'sort_order'    => 2,
            ]
        );

        $premiumPlan = \App\Models\Plan::firstOrCreate(
            ['slug' => 'premium'],
            [
                'name'          => 'Premium',
                'description'   => "Katta bog'chalar uchun",
                'price_monthly' => 999000,
                'max_children'  => null,
                'max_groups'    => null,
                'is_active'     => true,
                'sort_order'    => 3,
            ]
        );

        // Dev: Test bog'cha va uning subscriptioni — faqat development uchun
        if (app()->environment('local')) {
            $testOrg = Organization::firstOrCreate(
                ['name' => "Bahor Bog'chasi (Test)"],
                ['phone' => '+998712345678', 'address' => 'Toshkent, Chilonzor t.', 'is_active' => true]
            );

            Subscription::firstOrCreate(
                ['organization_id' => $testOrg->id, 'plan_id' => $standardPlan->id],
                [
                    'status'    => Subscription::STATUS_ACTIVE,
                    'starts_at' => now(),
                    'ends_at'   => now()->addDays(25),
                ]
            );

            // ── 1. Bonito Baby — Premium, active, expires in 45 days ──────────
            $bonitoBaby = Organization::firstOrCreate(
                ['name' => 'Bonito Baby'],
                [
                    'phone'     => '+998712000001',
                    'address'   => 'Toshkent, Yunusobod t.',
                    'is_active' => true,
                ]
            );
            User::firstOrCreate(
                ['phone' => '+998901000001'],
                [
                    'name'            => 'Barno Yusupova',
                    'email'           => 'admin@bonitobaby.uz',
                    'password'        => Hash::make('kiddo123'),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $bonitoBaby->id,
                    'is_active'       => true,
                ]
            );
            $bonitoSub = Subscription::firstOrCreate(
                ['organization_id' => $bonitoBaby->id, 'plan_id' => $premiumPlan->id],
                [
                    'status'    => Subscription::STATUS_ACTIVE,
                    'starts_at' => now()->subMonths(2),
                    'ends_at'   => now()->addDays(45),
                ]
            );
            $bonitoInvoice = Invoice::firstOrCreate(
                ['organization_id' => $bonitoBaby->id, 'subscription_id' => $bonitoSub->id],
                [
                    'amount'   => 999000,
                    'currency' => 'UZS',
                    'status'   => 'paid',
                    'due_at'   => now()->subMonths(2),
                    'paid_at'  => now()->subMonths(2),
                ]
            );
            Payment::firstOrCreate(
                ['organization_id' => $bonitoBaby->id, 'subscription_id' => $bonitoSub->id],
                [
                    'invoice_id'     => $bonitoInvoice->id,
                    'amount'         => 999000,
                    'currency'       => 'UZS',
                    'status'         => 'paid',
                    'payment_method' => 'payme',
                    'paid_at'        => now()->subMonths(2),
                ]
            );

            // ── 2. Bahor Bog'chasi — Standard, active, expires in 5 days ─────
            $bahor = Organization::firstOrCreate(
                ['name' => "Bahor Bog'chasi"],
                [
                    'phone'     => '+998712000002',
                    'address'   => 'Toshkent, Chilonzor t.',
                    'is_active' => true,
                ]
            );
            User::firstOrCreate(
                ['phone' => '+998901000002'],
                [
                    'name'            => 'Aziz Karimov',
                    'email'           => 'admin@bahor.uz',
                    'password'        => Hash::make('kiddo123'),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $bahor->id,
                    'is_active'       => true,
                ]
            );
            $bahorSub = Subscription::firstOrCreate(
                ['organization_id' => $bahor->id, 'plan_id' => $standardPlan->id],
                [
                    'status'    => Subscription::STATUS_ACTIVE,
                    'starts_at' => now()->subDays(25),
                    'ends_at'   => now()->addDays(5),
                ]
            );
            $bahorInvoice = Invoice::firstOrCreate(
                ['organization_id' => $bahor->id, 'subscription_id' => $bahorSub->id],
                [
                    'amount'   => 599000,
                    'currency' => 'UZS',
                    'status'   => 'paid',
                    'due_at'   => now()->subDays(25),
                    'paid_at'  => now()->subDays(25),
                ]
            );
            Payment::firstOrCreate(
                ['organization_id' => $bahor->id, 'subscription_id' => $bahorSub->id],
                [
                    'invoice_id'     => $bahorInvoice->id,
                    'amount'         => 599000,
                    'currency'       => 'UZS',
                    'status'         => 'paid',
                    'payment_method' => 'click',
                    'paid_at'        => now()->subDays(25),
                ]
            );

            // ── 3. KIDDO Academy — Standard, active, expires in 20 days ──────
            $kiddoAcademy = Organization::firstOrCreate(
                ['name' => 'KIDDO Academy'],
                [
                    'phone'     => '+998712000003',
                    'address'   => "Samarqand, Mirzo Ulug'bek k.",
                    'is_active' => true,
                ]
            );
            User::firstOrCreate(
                ['phone' => '+998901000003'],
                [
                    'name'            => 'Shahlo Nazarova',
                    'email'           => 'admin@kiddoacademy.uz',
                    'password'        => Hash::make('kiddo123'),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $kiddoAcademy->id,
                    'is_active'       => true,
                ]
            );
            $kiddoSub = Subscription::firstOrCreate(
                ['organization_id' => $kiddoAcademy->id, 'plan_id' => $standardPlan->id],
                [
                    'status'    => Subscription::STATUS_ACTIVE,
                    'starts_at' => now()->subDays(10),
                    'ends_at'   => now()->addDays(20),
                ]
            );
            $kiddoInvoice = Invoice::firstOrCreate(
                ['organization_id' => $kiddoAcademy->id, 'subscription_id' => $kiddoSub->id],
                [
                    'amount'   => 599000,
                    'currency' => 'UZS',
                    'status'   => 'paid',
                    'due_at'   => now()->subDays(10),
                    'paid_at'  => now()->subDays(10),
                ]
            );
            Payment::firstOrCreate(
                ['organization_id' => $kiddoAcademy->id, 'subscription_id' => $kiddoSub->id],
                [
                    'invoice_id'     => $kiddoInvoice->id,
                    'amount'         => 599000,
                    'currency'       => 'UZS',
                    'status'         => 'paid',
                    'payment_method' => 'manual',
                    'paid_at'        => now()->subDays(10),
                ]
            );

            // ── 4. Happy Kids — Basic, trial, ends in 3 days ─────────────────
            $happyKids = Organization::firstOrCreate(
                ['name' => 'Happy Kids'],
                [
                    'phone'     => '+998712000004',
                    'address'   => 'Buxoro, Markaziy k.',
                    'is_active' => true,
                ]
            );
            User::firstOrCreate(
                ['phone' => '+998901000004'],
                [
                    'name'            => 'Komil Tursunov',
                    'password'        => Hash::make('kiddo123'),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $happyKids->id,
                    'is_active'       => true,
                ]
            );
            $happySub = Subscription::firstOrCreate(
                ['organization_id' => $happyKids->id, 'plan_id' => $basicPlan->id],
                [
                    'status'        => Subscription::STATUS_TRIAL,
                    'trial_ends_at' => now()->addDays(3),
                ]
            );
            Invoice::firstOrCreate(
                ['organization_id' => $happyKids->id, 'subscription_id' => $happySub->id],
                [
                    'amount'   => 299000,
                    'currency' => 'UZS',
                    'status'   => 'pending',
                    'due_at'   => now()->addDays(3),
                ]
            );

            // ── 5. Little Stars — Standard, expired, payment overdue ──────────
            $littleStars = Organization::firstOrCreate(
                ['name' => 'Little Stars'],
                [
                    'phone'     => '+998712000005',
                    'address'   => "Namangan, Ulug'bek t.",
                    'is_active' => true,
                ]
            );
            User::firstOrCreate(
                ['phone' => '+998901000005'],
                [
                    'name'            => 'Dilnoza Mirzayeva',
                    'password'        => Hash::make('kiddo123'),
                    'role'            => User::ROLE_ADMIN,
                    'organization_id' => $littleStars->id,
                    'is_active'       => true,
                ]
            );
            $starsSub = Subscription::firstOrCreate(
                ['organization_id' => $littleStars->id, 'plan_id' => $standardPlan->id],
                [
                    'status'  => Subscription::STATUS_EXPIRED,
                    'ends_at' => now()->subDays(10),
                ]
            );
            $starsInvoice = Invoice::firstOrCreate(
                ['organization_id' => $littleStars->id, 'subscription_id' => $starsSub->id],
                [
                    'amount'   => 599000,
                    'currency' => 'UZS',
                    'status'   => 'pending',
                    'due_at'   => now()->subDays(10),
                ]
            );
            Payment::firstOrCreate(
                ['organization_id' => $littleStars->id, 'subscription_id' => $starsSub->id],
                [
                    'invoice_id'     => $starsInvoice->id,
                    'amount'         => 599000,
                    'currency'       => 'UZS',
                    'status'         => 'pending',
                    'payment_method' => null,
                    'due_at'         => now()->subDays(10),
                ]
            );

            // ── Notifications for Super Admin ─────────────────────────────────
            $notifications = [
                [
                    'title'          => "Obuna muddati yaqinlashmoqda",
                    'message'        => "Bahor Bog'chasi obunasi 5 kundan keyin tugaydi. Obunani yangilang.",
                    'type'           => 'warning',
                    'recipient_type' => 'super_admin',
                ],
                [
                    'title'          => "Trial tugamoqda",
                    'message'        => "Happy Kids trial muddati 3 kundan keyin tugaydi.",
                    'type'           => 'warning',
                    'recipient_type' => 'super_admin',
                ],
                [
                    'title'          => "Obuna muddati tugadi",
                    'message'        => "Little Stars obunasi tugadi va to'lov amalga oshirilmagan.",
                    'type'           => 'alert',
                    'recipient_type' => 'super_admin',
                    'read_at'        => null,
                ],
                [
                    'title'          => "Yangi to'lov",
                    'message'        => "KIDDO Academy tomonidan 599,000 UZS to'lov qilindi.",
                    'type'           => 'payment',
                    'recipient_type' => 'super_admin',
                    'read_at'        => now()->subHours(2),
                ],
                [
                    'title'          => "Yangi bog'cha ulandi",
                    'message'        => "Bonito Baby platformaga muvaffaqiyatli ulandi.",
                    'type'           => 'info',
                    'recipient_type' => 'super_admin',
                    'read_at'        => now()->subDays(2),
                ],
            ];

            foreach ($notifications as $notif) {
                \App\Models\AppNotification::firstOrCreate(
                    ['title' => $notif['title'], 'recipient_type' => 'super_admin'],
                    $notif
                );
            }

            $this->seedLocalAccounts();
        }
    }

    /**
     * Ma'lum parolli hisoblar — faqat lokal ishlab chiqish uchun.
     * Production'da super-admin bu seeder orqali yaratilmasligi kerak.
     */
    private function seedLocalAccounts(): void
    {
        // Super Admin
        User::firstOrCreate(
            ['phone' => '+998901234567'],
            [
                'name'            => 'Super Admin',
                'email'           => 'superadmin@kiddo.uz',
                'password'        => Hash::make('superadmin123'),
                'role'            => User::ROLE_SUPER_ADMIN,
                'organization_id' => null,
                'is_active'       => true,
            ]
        );

        // Test uchun admin foydalanuvchi
        User::firstOrCreate(
            ['phone' => '+998901234500'],
            [
                'name'      => 'Admin Foydalanuvchi',
                'email'     => 'admin@kiddo.uz',
                'password'  => Hash::make('password123'),
                'role'      => User::ROLE_ADMIN,
                'is_active' => true,
            ]
        );

        // Test uchun tarbiyachi
        User::firstOrCreate(
            ['phone' => '+998901234568'],
            [
                'name'      => 'Test Tarbiyachi',
                'email'     => 'teacher@kiddo.uz',
                'password'  => Hash::make('password123'),
                'role'      => User::ROLE_TEACHER,
                'is_active' => true,
            ]
        );

        // Test uchun ota-ona
        User::firstOrCreate(
            ['phone' => '+998901234569'],
            [
                'name'      => 'Test Ota-ona',
                'email'     => 'parent@kiddo.uz',
                'password'  => Hash::make('password123'),
                'role'      => User::ROLE_PARENT,
                'is_active' => true,
            ]
        );
    }
}
