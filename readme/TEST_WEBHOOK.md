# Test Stripe Webhook Manually

## Quick Diagnosis

### Step 1: Check if webhook exists in Stripe
```bash
# Go to: https://dashboard.stripe.com/test/webhooks
# Look for endpoint: https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook
```

**If endpoint does NOT exist** → This is your problem! Follow Step 2.

### Step 2: Add Webhook Endpoint in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook`
4. Description: "Supabase subscription webhook"
5. Events to send:
   - ✓ `checkout.session.completed`
   - ✓ `customer.subscription.created`
   - ✓ `customer.subscription.updated`
   - ✓ `customer.subscription.deleted`
6. Click "Add endpoint"
7. **COPY the signing secret** (starts with `whsec_...`)

### Step 3: Add Webhook Secret to Supabase

1. Go to: https://supabase.com/dashboard/project/teckcldrmwfxoxcinlhb/settings/functions
2. Scroll to "Secrets"
3. Click "Add new secret"
4. Name: `STRIPE_WEBHOOK_SECRET`
5. Value: `whsec_xxxxxxxxxxxxx` (paste the secret from Stripe)
6. Click "Save"

### Step 4: Test with a Real Payment

1. Go to your app: https://tennis-tournament-or-06an.bolt.host/#/settings
2. Click "Upgrade to Premium"
3. Use test card: `4242 4242 4242 4242`
4. Complete payment
5. Check the webhook logs in Stripe dashboard

### Step 5: Verify Webhook Received Event

**In Stripe Dashboard:**
- Go to: https://dashboard.stripe.com/test/webhooks
- Click your endpoint
- Check "Events" tab
- You should see: `checkout.session.completed` and `customer.subscription.created`
- Status should be "Succeeded" (green checkmark)

**In Supabase:**
```sql
-- Check if subscription was updated
SELECT
  user_id,
  subscription_tier,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  updated_at
FROM user_subscriptions
WHERE stripe_customer_id = 'cus_TU49wptUI2yGjM'
ORDER BY updated_at DESC;
```

**Expected result after webhook:**
- `subscription_tier` should be `'premium'` (not 'free')
- `stripe_subscription_id` should be `'sub_xxxxx'` (not null)
- `updated_at` should be recent timestamp

### Step 6: Manual Test via Stripe CLI (Alternative)

If you have Stripe CLI installed:

```bash
# Forward webhook events to local
stripe listen --forward-to https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

## Troubleshooting

### If webhook shows "Failed" in Stripe:

1. Check Supabase function logs:
   - https://supabase.com/dashboard/project/teckcldrmwfxoxcinlhb/functions/stripe-webhook/logs

2. Common errors:
   - "Webhook signature verification failed" → Wrong webhook secret
   - "Unauthorized" → Missing STRIPE_SECRET_KEY
   - "Connection timeout" → Function not deployed

### If subscription still shows 'free':

Check webhook received the correct event:
```sql
-- Find your subscription in Stripe
-- Then manually update if needed (temporary fix)
UPDATE user_subscriptions
SET
  subscription_tier = 'premium',
  stripe_subscription_id = 'sub_xxxxx', -- Get from Stripe dashboard
  subscription_status = 'active',
  updated_at = NOW()
WHERE user_id = '9db9c981-bed9-4cca-8fcf-61462328a60e';

UPDATE user_feature_flags
SET
  can_access_tournaments = true,
  updated_at = NOW()
WHERE user_id = '9db9c981-bed9-4cca-8fcf-61462328a60e';
```

## Expected Flow

```
User clicks "Upgrade"
  ↓
Stripe Checkout Page
  ↓
User completes payment
  ↓
Stripe sends webhook → https://teckcldrmwfxoxcinlhb.supabase.co/functions/v1/stripe-webhook
  ↓
Webhook updates database:
  - subscription_tier: 'premium'
  - stripe_subscription_id: 'sub_xxx'
  - can_access_tournaments: true
  ↓
User redirected back to app
  ↓
App refreshes subscription data
  ↓
UI shows "Premium Plan"
```

## What I Need From You

Please provide:

1. **Screenshot or list of webhooks** from https://dashboard.stripe.com/test/webhooks
2. **Webhook event logs** - do you see any events being sent?
3. **Your latest subscription data** from the database query above
4. **Supabase function logs** - any errors when webhook is called?

This will tell me exactly where the problem is!
