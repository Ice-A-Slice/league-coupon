-- PL/pgSQL function to batch insert/update user_round_dynamic_points
CREATE OR REPLACE FUNCTION public.handle_dynamic_points_update(
    p_round_id BIGINT,
    p_dynamic_point_updates JSONB -- Expected: Array of objects like { "user_id": "uuid", "total_points": int, "q1_correct": bool, ... }
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Important for functions that modify data, ensure permissions are handled correctly
AS $$
DECLARE
    update_item JSONB;
    v_user_id UUID;
    v_total_points INTEGER;
    v_q1_correct BOOLEAN;
    v_q2_correct BOOLEAN;
    v_q3_correct BOOLEAN;
    v_q4_correct BOOLEAN;
BEGIN
    IF p_dynamic_point_updates IS NULL THEN
        RAISE NOTICE 'p_dynamic_point_updates is NULL, no action taken.';
        RETURN;
    END IF;

    -- Loop through each item in the JSONB array
    FOR update_item IN SELECT * FROM jsonb_array_elements(p_dynamic_point_updates)
    LOOP
        -- Extract values from the JSONB object
        -- Ensure to handle potential nulls if the JSON structure isn't guaranteed
        v_user_id := (update_item->>'user_id')::UUID;
        v_total_points := (update_item->>'total_points')::INTEGER;
        v_q1_correct := (update_item->>'q1_correct')::BOOLEAN;
        v_q2_correct := (update_item->>'q2_correct')::BOOLEAN;
        v_q3_correct := (update_item->>'q3_correct')::BOOLEAN;
        v_q4_correct := (update_item->>'q4_correct')::BOOLEAN;

        -- Perform the INSERT or UPDATE
        INSERT INTO public.user_round_dynamic_points (
            betting_round_id,
            user_id,
            dynamic_points,
            question_1_correct,
            question_2_correct,
            question_3_correct,
            question_4_correct,
            created_at,
            updated_at
        )
        VALUES (
            p_round_id,
            v_user_id,
            v_total_points,
            v_q1_correct,
            v_q2_correct,
            v_q3_correct,
            v_q4_correct,
            NOW(),
            NOW()
        )
        ON CONFLICT (betting_round_id, user_id) DO UPDATE SET
            dynamic_points = EXCLUDED.dynamic_points,
            question_1_correct = EXCLUDED.question_1_correct,
            question_2_correct = EXCLUDED.question_2_correct,
            question_3_correct = EXCLUDED.question_3_correct,
            question_4_correct = EXCLUDED.question_4_correct,
            updated_at = NOW();
    END LOOP;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Error in handle_dynamic_points_update: %', SQLERRM;
        RAISE;
END;
$$;

-- Optional: Add a comment to the function for clarity
COMMENT ON FUNCTION public.handle_dynamic_points_update(BIGINT, JSONB) 
IS 'Batch inserts or updates dynamic questionnaire points for users in a specific round. Expects a JSONB array of updates.';
