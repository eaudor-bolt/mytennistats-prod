/*
  # Disable problematic trigger entirely

  1. Changes
    - Drop the trigger that's causing signup failures
    - We'll handle user initialization from the application layer instead

  2. Security
    - No security impact - trigger was only for convenience
    - Application will create records with proper RLS policies
*/

-- Drop the problematic trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
