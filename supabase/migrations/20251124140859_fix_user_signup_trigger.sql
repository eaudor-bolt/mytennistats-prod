/*
  # Fix user signup trigger to include subscription initialization

  1. Changes
    - Update handle_new_user() function to create user_profiles, user_subscriptions, and user_usage_stats
    - Ensures all required records are created atomically during signup
    - Prevents "Database error saving new user" errors

  2. Security
    - Function runs with SECURITY DEFINER (elevated permissions)
    - Bypasses RLS during user creation
    - Safe because it only creates records for the new authenticated user
*/

-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate function with subscription initialization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email, first_name, last_name, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );

  -- Create user subscription with free tier
  INSERT INTO public.user_subscriptions (
    user_id,
    subscription_tier,
    subscription_status
  )
  VALUES (
    NEW.id,
    'free',
    'active'
  );

  -- Create user usage stats
  INSERT INTO public.user_usage_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
