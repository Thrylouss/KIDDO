<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;

class SubscriptionService
{
    /**
     * Creates a subscription + invoice for an org.
     *
     * @param  array{
     *   status?: string,
     *   ends_at?: string,
     *   payment_status?: string,
     *   notes?: string|null,
     *   user_id?: int|null,
     *   ip?: string|null,
     * } $options
     */
    public function createSubscription(Organization $org, Plan $plan, array $options = []): Subscription
    {
        return DB::transaction(function () use ($org, $plan, $options) {
            $status = $options['status'] ?? Subscription::STATUS_TRIAL;

            // When creating a paid/active subscription, expire any existing
            // trial, active, or past_due subscriptions for this org so only
            // one active subscription exists at a time.
            if ($status !== Subscription::STATUS_TRIAL) {
                Subscription::where('organization_id', $org->id)
                    ->whereIn('status', [
                        Subscription::STATUS_ACTIVE,
                        Subscription::STATUS_TRIAL,
                        Subscription::STATUS_PAST_DUE,
                    ])
                    ->update(['status' => Subscription::STATUS_EXPIRED]);
            }

            $subData = [
                'organization_id' => $org->id,
                'plan_id'         => $plan->id,
                'status'          => $status,
                'starts_at'       => $options['starts_at'] ?? now(),
                'auto_renew'      => $options['auto_renew'] ?? false,
            ];

            if ($status === Subscription::STATUS_TRIAL) {
                $subData['trial_ends_at'] = now()->addDays($plan->trial_days ?? 7);
            } else {
                $subData['ends_at'] = $options['ends_at'] ?? null;
            }

            $sub = Subscription::create($subData);

            $paymentStatus = $options['payment_status'] ?? 'pending';

            $invoice = Invoice::create([
                'organization_id' => $org->id,
                'subscription_id' => $sub->id,
                'amount'          => $plan->price_monthly,
                'currency'        => $plan->currency ?? 'UZS',
                'status'          => $paymentStatus === 'paid' ? 'paid' : 'pending',
                'notes'           => $options['notes'] ?? null,
                'paid_at'         => $paymentStatus === 'paid' ? now() : null,
            ]);

            if ($paymentStatus === 'paid') {
                Payment::create([
                    'organization_id' => $org->id,
                    'subscription_id' => $sub->id,
                    'invoice_id'      => $invoice->id,
                    'amount'          => $plan->price_monthly,
                    'currency'        => $plan->currency ?? 'UZS',
                    'status'          => 'paid',
                    'payment_method'  => 'manual',
                    'paid_at'         => now(),
                    'notes'           => $options['notes'] ?? null,
                ]);
            }

            ActivityLog::record(
                'subscription.created',
                "Obuna yaratildi: org #{$org->id}",
                $options['user_id'] ?? null,
                $org->id,
                ['plan_id' => $plan->id, 'status' => $status],
                $options['ip'] ?? null
            );

            return $sub;
        });
    }

    /**
     * Renews an existing subscription.
     *
     * @param  array{
     *   ends_at: string,
     *   payment_status?: string,
     *   notes?: string|null,
     *   user_id?: int|null,
     *   ip?: string|null,
     * } $options
     */
    public function renewSubscription(Subscription $sub, Plan $plan, array $options): Subscription
    {
        return DB::transaction(function () use ($sub, $plan, $options) {
            $orgId = $sub->organization_id;

            // Expire current active subscriptions for org
            Subscription::where('organization_id', $orgId)
                ->whereIn('status', [
                    Subscription::STATUS_ACTIVE,
                    Subscription::STATUS_TRIAL,
                    Subscription::STATUS_PAST_DUE,
                ])
                ->update(['status' => Subscription::STATUS_EXPIRED]);

            $newSub = Subscription::create([
                'organization_id' => $orgId,
                'plan_id'         => $plan->id,
                'status'          => Subscription::STATUS_ACTIVE,
                'starts_at'       => now(),
                'ends_at'         => $options['ends_at'],
                'auto_renew'      => $options['auto_renew'] ?? false,
            ]);

            $paymentStatus = $options['payment_status'] ?? 'pending';

            $invoice = Invoice::create([
                'organization_id' => $orgId,
                'subscription_id' => $newSub->id,
                'amount'          => $plan->price_monthly,
                'currency'        => $plan->currency ?? 'UZS',
                'status'          => $paymentStatus === 'paid' ? 'paid' : 'pending',
                'notes'           => $options['notes'] ?? null,
                'paid_at'         => $paymentStatus === 'paid' ? now() : null,
            ]);

            if ($paymentStatus === 'paid') {
                Payment::create([
                    'organization_id' => $orgId,
                    'subscription_id' => $newSub->id,
                    'invoice_id'      => $invoice->id,
                    'amount'          => $plan->price_monthly,
                    'currency'        => $plan->currency ?? 'UZS',
                    'status'          => 'paid',
                    'payment_method'  => 'manual',
                    'paid_at'         => now(),
                    'notes'           => $options['notes'] ?? null,
                ]);
            }

            ActivityLog::record(
                'subscription.renewed',
                "Obuna uzaytirildi: org #{$orgId}",
                $options['user_id'] ?? null,
                $orgId,
                ['plan_id' => $plan->id, 'ends_at' => $options['ends_at']],
                $options['ip'] ?? null
            );

            return $newSub;
        });
    }

    /**
     * Changes plan of an existing subscription.
     *
     * @param  array{
     *   effective_immediately?: bool,
     *   user_id?: int|null,
     *   ip?: string|null,
     * } $options
     */
    public function changePlan(Subscription $sub, Plan $newPlan, array $options = []): Subscription
    {
        return DB::transaction(function () use ($sub, $newPlan, $options) {
            $sub->update(['plan_id' => $newPlan->id]);

            ActivityLog::record(
                'subscription.plan_changed',
                "Obuna tarifi o'zgartirildi: org #{$sub->organization_id}",
                $options['user_id'] ?? null,
                $sub->organization_id,
                ['new_plan_id' => $newPlan->id],
                $options['ip'] ?? null
            );

            return $sub->fresh();
        });
    }

    /**
     * Cancels a subscription.
     */
    public function cancelSubscription(Subscription $sub, ?string $reason = null, array $options = []): Subscription
    {
        return DB::transaction(function () use ($sub, $reason, $options) {
            $sub->update([
                'status'            => Subscription::STATUS_CANCELLED,
                'cancelled_at'      => now(),
                'cancelled_reason'  => $reason,
            ]);

            ActivityLog::record(
                'subscription.cancelled',
                "Obuna bekor qilindi: org #{$sub->organization_id}",
                $options['user_id'] ?? null,
                $sub->organization_id,
                ['reason' => $reason],
                $options['ip'] ?? null
            );

            return $sub->fresh();
        });
    }

    /**
     * Checks and expires subscriptions where ends_at < now and status = active/trial.
     */
    public function checkExpiry(): int
    {
        $subs = Subscription::whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->where(function ($q) {
                $q->where(function ($q2) {
                    $q2->where('status', Subscription::STATUS_ACTIVE)
                        ->where('ends_at', '<', now());
                })->orWhere(function ($q2) {
                    $q2->where('status', Subscription::STATUS_TRIAL)
                        ->where('trial_ends_at', '<', now());
                });
            })
            ->get();

        $count = 0;
        foreach ($subs as $sub) {
            $sub->update(['status' => Subscription::STATUS_EXPIRED]);

            ActivityLog::record(
                'subscription.expired',
                "Obuna muddati tugadi: org #{$sub->organization_id}",
                null,
                $sub->organization_id,
                ['subscription_id' => $sub->id]
            );

            $count++;
        }

        return $count;
    }

    /**
     * Calculate Monthly Recurring Revenue (MRR).
     * Only counts STATUS_ACTIVE subscriptions — trial, expired, cancelled
     * and past_due subscriptions are excluded because they are not confirmed
     * recurring revenue.
     */
    public function calculateMRR(): float
    {
        return (float) Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
            ->sum('plans.price_monthly');
    }
}
