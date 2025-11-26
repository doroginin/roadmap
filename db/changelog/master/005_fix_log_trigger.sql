--liquibase formatted sql

--changeset dvdoroginin:005_fix_log_trigger
--comment: Fix log_data_change trigger to handle document_versions correctly

-- Drop and recreate the function to fix the subquery issue
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
    new_version BIGINT;
    doc_id UUID;
BEGIN
    -- Get the single document version ID (should only be one row)
    SELECT id INTO STRICT doc_id FROM document_versions ORDER BY created_at LIMIT 1;

    -- Increment version number
    UPDATE document_versions
    SET version_number = version_number + 1
    WHERE id = doc_id
    RETURNING version_number INTO STRICT new_version;

    -- Log the change
    INSERT INTO change_log (version_number, table_name, record_id, operation, old_data, new_data)
    VALUES (
        new_version,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';
