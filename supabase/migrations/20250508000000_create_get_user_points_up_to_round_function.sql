-- Create RPC function to get user total points up to a specific round
-- This is used for position change calculations in the user data aggregation service

CREATE OR REPLACE FUNCTION public.get_user_points_up_to_round(target_round_id BIGINT)
RETURNS TABLE(user_id UUID, total_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ub.user_id,
        COALESCE(SUM(ub.points_awarded), 0)::INTEGER as total_points
    FROM public.user_bets ub
    WHERE ub.betting_round_id <= target_round_id
      AND ub.points_awarded IS NOT NULL
    GROUP BY ub.user_id;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.get_user_points_up_to_round(BIGINT) 
IS 'Returns total accumulated points for each user up to and including the specified round. Used for position change calculations in email system.'; 