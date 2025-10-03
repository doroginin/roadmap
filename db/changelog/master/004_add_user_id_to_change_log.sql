-- Add user_id column to change_log table
-- Version: 004

-- Add user_id column to change_log table if it doesn't exist
ALTER TABLE change_log ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);

-- Add index for user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_change_log_user_id ON change_log (user_id);

-- Update the log_data_change function to accept and store user_id
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
    new_version BIGINT;
    current_user_id VARCHAR(36);
BEGIN
    -- Get user_id from the current session variable (set by the application)
    current_user_id := current_setting('app.user_id', true);
    
    -- Increment version number
    UPDATE document_versions SET version_number = version_number + 1 
    RETURNING version_number INTO new_version;
    
    -- Log the change
    INSERT INTO change_log (version_number, table_name, record_id, operation, user_id, old_data, new_data)
    VALUES (
        new_version,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN current_user_id = '' THEN NULL ELSE current_user_id END,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';