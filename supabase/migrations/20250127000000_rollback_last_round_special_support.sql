-- Rollback Migration: Remove Last Round Special support
-- Date: 2025-01-27
-- Description: Rollback script to undo Last Round Special database schema changes
-- WARNING: This will permanently delete all Last Round Special data!

-- Drop trigger and function for user_last_round_special_points
DROP TRIGGER IF EXISTS update_user_last_round_special_points_updated_at ON user_last_round_special_points;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes on season_winners
DROP INDEX IF EXISTS idx_season_winners_season_competition;
DROP INDEX IF EXISTS idx_season_winners_competition_type;

-- Drop indexes on user_last_round_special_points
DROP INDEX IF EXISTS idx_user_last_round_special_points_betting_round;
DROP INDEX IF EXISTS idx_user_last_round_special_points_season;
DROP INDEX IF EXISTS idx_user_last_round_special_points_user_season;

-- Drop the user_last_round_special_points table (THIS WILL DELETE ALL CUP DATA!)
DROP TABLE IF EXISTS user_last_round_special_points;

-- Remove competition_type constraint and column from season_winners
ALTER TABLE season_winners DROP CONSTRAINT IF EXISTS season_winners_competition_type_check;
ALTER TABLE season_winners DROP COLUMN IF EXISTS competition_type;

-- Remove Last Round Special columns from seasons table
ALTER TABLE seasons DROP COLUMN IF EXISTS last_round_special_activated_at;
ALTER TABLE seasons DROP COLUMN IF EXISTS last_round_special_activated;

-- Note: This rollback script will permanently delete all Last Round Special data.
-- Consider backing up the data before running this script. 