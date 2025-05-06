CREATE OR REPLACE FUNCTION public.handle_round_scoring(
    p_betting_round_id INT,
    p_bet_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
-- SECURITY DEFINER -- We might need this later if the edge function role lacks permissions, but start without.
AS $$
DECLARE
    bet_update JSONB;
    v_bet_id UUID;
    v_points INT;
BEGIN
    -- Check if p_bet_updates is a valid JSON array
    IF NOT jsonb_typeof(p_bet_updates) = 'array' THEN
        RAISE EXCEPTION 'p_bet_updates must be a JSON array. Received: %', jsonb_typeof(p_bet_updates);
    END IF;

    -- Loop through each object in the JSON array
    FOR bet_update IN SELECT * FROM jsonb_array_elements(p_bet_updates)
    LOOP
        -- Extract bet_id and points, ensuring they exist and have correct types
        IF NOT (bet_update ? 'bet_id' AND bet_update ? 'points' AND jsonb_typeof(bet_update -> 'points') = 'number') THEN
             RAISE WARNING 'Skipping invalid bet update object in array: %', bet_update;
             CONTINUE; -- Skip this element and continue with the next
        END IF;

        -- Safely extract values
        BEGIN
            v_bet_id := (bet_update ->> 'bet_id')::UUID;
            v_points := (bet_update ->> 'points')::INT;
        EXCEPTION WHEN others THEN
            RAISE WARNING 'Skipping bet update due to invalid data type conversion for object: %. Error: %', bet_update, SQLERRM;
            CONTINUE; -- Skip this element
        END;

        -- Update the user_bets table
        UPDATE public.user_bets
        SET points_awarded = v_points
        WHERE id = v_bet_id
          -- Optional: Add safety check to only update bets for the correct round?
          AND betting_round_id = p_betting_round_id;

    END LOOP;

    -- Update the betting_rounds table status
    UPDATE public.betting_rounds
    SET status = 'scored',
        scored_at = now() -- Use current transaction timestamp
    WHERE id = p_betting_round_id;

END;
$$;
