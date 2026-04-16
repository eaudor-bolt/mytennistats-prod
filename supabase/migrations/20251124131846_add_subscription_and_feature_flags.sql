/*
  # Add Subscription and Feature Flags System

  1. New Tables
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `subscription_tier` (text: 'free' or 'premium')
      - `stripe_customer_id` (text, nullable)
      - `stripe_subscription_id` (text, nullable)
      - `subscription_status` (text: 'active', 'cancelled', 'past_due')
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_feature_flags`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `can_access_tournaments` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_usage_stats`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `players_created` (integer, default 0)
      - `match_results_created` (integer, default 0)
      - `shares_created` (integer, default 0)
      - `live_shares_created` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for users to read/update their own data
    - Add policies for service role to manage subscriptions

  3. Triggers
    - Auto-create subscription record on user signup
    - Auto-create feature flags record on user signup
    - Auto-create usage stats record on user signup
    - Set tournament access for specific user ID
*/

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_feature_flags table
CREATE TABLE IF NOT EXISTS user_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  can_access_tournaments boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_usage_stats table
CREATE TABLE IF NOT EXISTS user_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  players_created integer DEFAULT 0,
  match_results_created integer DEFAULT 0,
  shares_created integer DEFAULT 0,
  live_shares_created integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage_stats ENABLE ROW LEVEL SECURITY;

-- Policies for user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for user_feature_flags
CREATE POLICY "Users can view own feature flags"
  ON user_feature_flags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for user_usage_stats
CREATE POLICY "Users can view own usage stats"
  ON user_usage_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage stats"
  ON user_usage_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to initialize user subscription data
CREATE OR REPLACE FUNCTION initialize_user_subscription_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Create subscription record
  INSERT INTO user_subscriptions (user_id, subscription_tier, subscription_status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create feature flags record
  INSERT INTO user_feature_flags (user_id, can_access_tournaments)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create usage stats record
  INSERT INTO user_usage_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create subscription data on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_subscription_data();

-- Initialize data for existing users
INSERT INTO user_subscriptions (user_id, subscription_tier, subscription_status)
SELECT id, 'free', 'active'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_feature_flags (user_id, can_access_tournaments)
SELECT id, false
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_usage_stats (user_id)
SELECT id
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Grant tournament access to specific user
UPDATE user_feature_flags
SET can_access_tournaments = true
WHERE user_id = '9db9c981-bed9-4cca-8fcf-61462328a60e';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user_id ON user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_stats_user_id ON user_usage_stats(user_id);
