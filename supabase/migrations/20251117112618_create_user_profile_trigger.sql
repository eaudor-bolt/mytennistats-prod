/*
  # Create automatic user profile creation trigger

  1. Changes
    - Create a trigger function that automatically creates a user_profile when a new user signs up
    - The trigger runs after INSERT on auth.users table
    - Extracts first_name and last_name from user metadata
    - Sets default language to 'en'
    - This eliminates RLS issues during signup since the trigger runs with elevated permissions

  2. Security
    - No RLS changes needed - trigger bypasses RLS by design
    - Only creates profiles for newly authenticated users
    - Uses user metadata passed during signup
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
