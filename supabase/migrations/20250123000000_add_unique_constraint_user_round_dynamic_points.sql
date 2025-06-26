-- Add unique constraint to user_round_dynamic_points table
-- This is required for the ON CONFLICT clause in handle_dynamic_points_update function to work

-- Add the unique constraint (if it doesn't already exist)
ALTER TABLE public.user_round_dynamic_points 
ADD CONSTRAINT IF NOT EXISTS user_round_dynamic_points_unique_user_round 
UNIQUE (user_id, betting_round_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT user_round_dynamic_points_unique_user_round 
ON public.user_round_dynamic_points 
IS 'Ensures each user can only have one dynamic points record per betting round. Required for ON CONFLICT clause in handle_dynamic_points_update function.'; 