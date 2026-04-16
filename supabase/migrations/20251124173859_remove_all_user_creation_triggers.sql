/*
  # Remove ALL user creation triggers

  1. Changes
    - Drop on_auth_user_created_subscription trigger
    - Drop initialize_user_subscription_data function
    - Remove all automatic trigger-based user initialization
    - Application will handle user data creation instead

  2. Security
    - No security impact
    - User initialization moved to application layer with proper error handling
*/

-- Drop the subscription trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS public.initialize_user_subscription_data() CASCADE;
DROP FUNCTION IF EXISTS initialize_user_subscription_data() CASCADE;
