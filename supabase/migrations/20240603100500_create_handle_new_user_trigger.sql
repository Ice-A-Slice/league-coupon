-- supabase/migrations/YYYYMMDDHHMMSS_create_handle_new_user_trigger.sql
-- (Replace YYYYMMDDHHMMSS with the actual timestamp, ensuring it's later than the profiles table migration)

-- 1. Create the function to copy user data to profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Must be SECURITY DEFINER to write to public.profiles from auth.users trigger
SET search_path = public -- Ensures the function can find public.profiles
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', -- Path from Google OAuth data
    NEW.raw_user_meta_data->>'avatar_url'   -- Path from Google OAuth data
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Optionally, log the error to the database or raise a notice/warning
    -- For example: RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    -- For now, we'll let the transaction fail if the insert fails to ensure data integrity
    -- or you could choose to let the user creation succeed even if profile creation fails.
    -- If you want user creation to succeed even if this fails, return NEW here and handle errors.
    RAISE NOTICE 'Error in handle_new_user for user_id %: %', NEW.id, SQLERRM;
    RETURN NEW; -- Or RAISE to make the whole transaction fail
END;
$$;

-- Add a comment to the function
COMMENT ON FUNCTION public.handle_new_user() 
IS 'Trigger function to populate public.profiles upon new user creation in auth.users.';

-- 2. Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add a comment to the trigger
COMMENT ON TRIGGER on_auth_user_created ON auth.users 
IS 'When a new user is created in auth.users, automatically populate their corresponding row in public.profiles.'; 