-- Add transparency_sent_at column to betting_rounds table
-- This tracks when transparency emails are sent for each round

ALTER TABLE betting_rounds ADD COLUMN transparency_sent_at TIMESTAMPTZ; 