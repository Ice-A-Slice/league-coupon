-- supabase/migrations/YYYYMMDDHHMMSS_create_profiles_table.sql
-- (Replace YYYYMMDDHHMMSS with the actual timestamp)

-- Create the public.profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.profiles IS 'User profile information, extending auth.users.';
COMMENT ON COLUMN public.profiles.id IS 'References the user in auth.users.';
COMMENT ON COLUMN public.profiles.full_name IS 'User''s full name, often from an identity provider.';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to the user''s avatar image.';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp of the last profile update.';

-- Enable Row Level Security (RLS) on the new table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- 1. Allow authenticated users to read their own profile
CREATE POLICY "Authenticated users can read their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Note: Inserting into this table should ideally be handled by a trigger
-- on the auth.users table to copy initial data from raw_user_meta_data,
-- or by an edge function called after user sign-up.

-- Example of a trigger function (you would need to create this function separately if it doesn't exist)
-- This is a conceptual example; the exact fields in raw_user_meta_data might vary by provider.
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER SET search_path = public
-- AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, full_name, avatar_url)
--   VALUES (
--     NEW.id, 
--     NEW.raw_user_meta_data->>'full_name', -- Adjust path as needed
--     NEW.raw_user_meta_data->>'avatar_url'   -- Adjust path as needed
--   );
--   RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Secure the 'updated_at' column, ensuring it's automatically updated
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime (updated_at); 