/*
  # Automatic User Initialization

  1. New Functions
    - `initialize_new_user()` - Automatically creates user profile and subscription data
    
  2. Changes
    - Creates user_profiles entry with data from auth.users.raw_user_meta_data
    - Creates user_subscriptions entry with free tier
    - Creates user_usage_stats entry with zeros
    - Creates user_feature_flags entry with tournaments disabled
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates data for the newly signed up user
*/

-- Create function to initialize new users
CREATE OR REPLACE FUNCTION public.initialize_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, first_name, last_name, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert subscription with free tier
  INSERT INTO public.user_subscriptions (user_id, subscription_tier, subscription_status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert usage stats
  INSERT INTO public.user_usage_stats (user_id, players_created, match_results_created, shares_created, live_shares_created)
  VALUES (NEW.id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert feature flags
  INSERT INTO public.user_feature_flags (user_id, can_access_tournaments)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error initializing user data: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_new_user();
