-- Add reminder_sent_at column to betting_rounds table
-- This column tracks when reminder emails were sent for each round
-- to prevent duplicate reminder emails

ALTER TABLE betting_rounds 
ADD COLUMN reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient querying of reminder status
CREATE INDEX idx_betting_rounds_reminder_sent_at 
ON betting_rounds(reminder_sent_at) 
WHERE reminder_sent_at IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN betting_rounds.reminder_sent_at IS 'Timestamp when reminder email was sent for this round. NULL means no reminder sent yet.'; 