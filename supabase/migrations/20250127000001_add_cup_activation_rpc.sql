-- Create RPC function for atomic cup activation with optimistic locking
-- This function ensures only one activation can succeed per season
CREATE OR REPLACE FUNCTION activate_last_round_special(
    p_season_id INTEGER,
    p_activation_timestamp TIMESTAMPTZ
) RETURNS JSON AS $$
DECLARE
    v_current_activated BOOLEAN;
    v_current_activated_at TIMESTAMPTZ;
    v_season_name TEXT;
    v_result JSON;
BEGIN
    -- Lock the season record to prevent concurrent modifications
    SELECT 
        last_round_special_activated,
        last_round_special_activated_at,
        name
    INTO 
        v_current_activated,
        v_current_activated_at,
        v_season_name
    FROM seasons 
    WHERE id = p_season_id
    FOR UPDATE;
    
    -- Check if season exists
    IF NOT FOUND THEN
        v_result := json_build_object(
            'success', false,
            'already_activated', false,
            'activated_at', null,
            'season_name', null,
            'error', 'Season not found'
        );
        RETURN v_result;
    END IF;
    
    -- Check if already activated
    IF v_current_activated = true THEN
        v_result := json_build_object(
            'success', false,
            'already_activated', true,
            'activated_at', v_current_activated_at,
            'season_name', v_season_name,
            'error', null
        );
        RETURN v_result;
    END IF;
    
    -- Perform the activation
    UPDATE seasons 
    SET 
        last_round_special_activated = true,
        last_round_special_activated_at = p_activation_timestamp
    WHERE id = p_season_id;
    
    -- Return success result
    v_result := json_build_object(
        'success', true,
        'already_activated', false,
        'activated_at', p_activation_timestamp,
        'season_name', v_season_name,
        'error', null
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Handle any unexpected errors
        v_result := json_build_object(
            'success', false,
            'already_activated', false,
            'activated_at', null,
            'season_name', null,
            'error', 'Database error: ' || SQLERRM
        );
        RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION activate_last_round_special(INTEGER, TIMESTAMPTZ) IS 
'Atomically activates the Last Round Special cup for a season with optimistic locking to prevent race conditions. Returns JSON with success status and activation details.'; 