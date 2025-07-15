-- Migration: Add Last Round Special support
-- Date: 2025-01-27
-- Description: Add database schema changes to support Last Round Special cup competition

-- Add Last Round Special tracking columns to seasons table
ALTER TABLE seasons 
ADD COLUMN last_round_special_activated BOOLEAN DEFAULT FALSE,
ADD COLUMN last_round_special_activated_at TIMESTAMP WITH TIME ZONE;

-- Add competition type to season_winners table to support both league and cup winners
ALTER TABLE season_winners 
ADD COLUMN competition_type VARCHAR(50) DEFAULT 'league';

-- Add check constraint to ensure competition_type has valid values
ALTER TABLE season_winners 
ADD CONSTRAINT season_winners_competition_type_check 
CHECK (competition_type IN ('league', 'last_round_special'));

-- Create new table for storing Last Round Special points
CREATE TABLE user_last_round_special_points (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    betting_round_id INTEGER NOT NULL REFERENCES betting_rounds(id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure one record per user per betting round per season
    UNIQUE(user_id, betting_round_id, season_id)
);

-- Add performance indexes for the new table
CREATE INDEX idx_user_last_round_special_points_user_season 
ON user_last_round_special_points(user_id, season_id);

CREATE INDEX idx_user_last_round_special_points_season 
ON user_last_round_special_points(season_id);

CREATE INDEX idx_user_last_round_special_points_betting_round 
ON user_last_round_special_points(betting_round_id);

-- Add index on season_winners competition_type for faster filtering
CREATE INDEX idx_season_winners_competition_type 
ON season_winners(competition_type);

-- Add composite index for efficient Hall of Fame queries
CREATE INDEX idx_season_winners_season_competition 
ON season_winners(season_id, competition_type);

-- Add updated_at trigger for user_last_round_special_points
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_last_round_special_points_updated_at 
    BEFORE UPDATE ON user_last_round_special_points 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN seasons.last_round_special_activated IS 'Indicates if Last Round Special cup has been activated for this season';
COMMENT ON COLUMN seasons.last_round_special_activated_at IS 'Timestamp when Last Round Special was activated';
COMMENT ON COLUMN season_winners.competition_type IS 'Type of competition: league or last_round_special';
COMMENT ON TABLE user_last_round_special_points IS 'Stores points for Last Round Special cup competition';
COMMENT ON COLUMN user_last_round_special_points.points IS 'Points earned in this betting round for cup competition (no dynamic points)'; 