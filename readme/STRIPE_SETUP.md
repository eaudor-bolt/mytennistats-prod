# Stripe Webhook Setup Instructions

## Problem
After completing payment, the subscription tier stays "free" in the database because Stripe webhooks are not configured.

## Solution: Configure Stripe Webhook

### Step 1: Get Your Webhook Endpoint URL

Your webhook endpoint is:
```
https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook
```

### Step 2: Configure Webhook in Stripe Dashboard

#### For Test Mode:
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter endpoint URL: `https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook`
4. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_...`)

#### For Production Mode:
1. Go to https://dashboard.stripe.com/webhooks
2. Follow the same steps as test mode

### Step 3: Add Webhook Secret to Supabase

1. Go to your Supabase project: https://supabase.com/dashboard/project/teckcldrmwfxoxcinlhb
2. Go to Project Settings > Edge Functions
3. Add a new secret:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_...` (the signing secret from Stripe)
4. Click "Save"

### Step 4: Test the Integration

1. Go to your app: https://tennis-tournament-or-06an.bolt.host
2. Log in and go to Settings (`#/settings`)
3. Click "Upgrade to Premium"
4. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)
5. Complete payment
6. You should be redirected to Settings
7. Your subscription should now show "Premium Plan"

## How It Works

1. User clicks "Upgrade to Premium"
2. App creates Stripe checkout session with your Stripe Customer ID
3. User completes payment on Stripe's hosted page
4. Stripe sends webhook event to your endpoint
5. Webhook updates `user_subscriptions` table:
   - `subscription_tier` → 'premium'
   - `stripe_subscription_id` → 'sub_xxx'
   - `subscription_status` → 'active'
6. User redirected back to Settings page
7. Page refreshes subscription data and shows "Premium" status

## Troubleshooting

### Check if webhook is configured:
```sql
-- Check recent subscriptions
SELECT user_id, subscription_tier, stripe_subscription_id, updated_at
FROM user_subscriptions
ORDER BY updated_at DESC
LIMIT 5;
```

### If subscription_tier is still 'free':
1. Check Stripe webhook logs: https://dashboard.stripe.com/test/webhooks
2. Verify the webhook secret is correctly set in Supabase
3. Check Supabase Edge Function logs for errors

### Manual fix if needed:
If you completed a payment but it didn't update, you can manually update:
```sql
UPDATE user_subscriptions
SET subscription_tier = 'premium',
    stripe_subscription_id = 'sub_xxx', -- Get from Stripe dashboard
    subscription_status = 'active',
    updated_at = NOW()
WHERE user_id = 'your-user-id';

UPDATE user_feature_flags
SET can_access_tournaments = true,
    updated_at = NOW()
WHERE user_id = 'your-user-id';
```

## Important Notes

- **Both test and production mode need separate webhook configurations**
- The webhook endpoint URL is the same for both modes
- You'll have different signing secrets for test vs production
- Always test in test mode first before going to production
