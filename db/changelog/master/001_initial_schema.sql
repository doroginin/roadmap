-- Initial schema for roadmap application
-- Version: 001

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE task_status AS ENUM ('Todo', 'Backlog', 'Cancelled');
CREATE TYPE row_kind AS ENUM ('resource', 'task');

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    jira_project VARCHAR(255) DEFAULT '',
    feature_team VARCHAR(255) DEFAULT '',
    issue_type VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sprints table
CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Functions table (for fn field)
CREATE TABLE functions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resources table
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind row_kind NOT NULL DEFAULT 'resource',
    team_ids UUID[] NOT NULL, -- array of team IDs
    function_id UUID NOT NULL REFERENCES functions(id),
    employee_id UUID REFERENCES employees(id), -- optional
    weeks DECIMAL[] NOT NULL DEFAULT '{}', -- capacity per week
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT resources_kind_check CHECK (kind = 'resource')
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind row_kind NOT NULL DEFAULT 'task',
    status task_status NOT NULL DEFAULT 'Todo',
    sprints_auto TEXT[] DEFAULT '{}', -- auto-calculated sprint codes
    epic VARCHAR(255),
    task_name VARCHAR(500) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id),
    function_id UUID NOT NULL REFERENCES functions(id),
    employee_id UUID REFERENCES employees(id), -- optional
    plan_empl DECIMAL NOT NULL DEFAULT 0,
    plan_weeks DECIMAL NOT NULL DEFAULT 0,
    blocker_ids UUID[] DEFAULT '{}', -- references to other tasks
    week_blockers INTEGER[] DEFAULT '{}', -- week numbers that block this task
    fact DECIMAL NOT NULL DEFAULT 0, -- auto-calculated
    start_week INTEGER, -- auto-calculated
    end_week INTEGER, -- auto-calculated
    expected_start_week INTEGER, -- hidden field for expected start week
    manual_edited BOOLEAN NOT NULL DEFAULT FALSE,
    auto_plan_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weeks DECIMAL[] NOT NULL DEFAULT '{}', -- actual placed amounts by week
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT tasks_kind_check CHECK (kind = 'task')
);

-- Document versions table for optimistic locking
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT single_version_row CHECK (id = uuid_generate_v4())
);

-- Insert initial version
INSERT INTO document_versions (version_number) VALUES (1);

-- Change log table for tracking all changes
CREATE TABLE change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number BIGINT NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_resources_team_ids ON resources USING GIN (team_ids);
CREATE INDEX idx_resources_function_id ON resources (function_id);
CREATE INDEX idx_resources_employee_id ON resources (employee_id);
CREATE INDEX idx_resources_display_order ON resources (display_order);

CREATE INDEX idx_tasks_team_id ON tasks (team_id);
CREATE INDEX idx_tasks_function_id ON tasks (function_id);
CREATE INDEX idx_tasks_employee_id ON tasks (employee_id);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_blocker_ids ON tasks USING GIN (blocker_ids);
CREATE INDEX idx_tasks_display_order ON tasks (display_order);

CREATE INDEX idx_change_log_version ON change_log (version_number);
CREATE INDEX idx_change_log_table_record ON change_log (table_name, record_id);
CREATE INDEX idx_change_log_created_at ON change_log (created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON sprints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_functions_updated_at BEFORE UPDATE ON functions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment version and log changes
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
    new_version BIGINT;
BEGIN
    -- Increment version number
    UPDATE document_versions SET version_number = version_number + 1 
    RETURNING version_number INTO new_version;
    
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

-- Triggers for change logging
CREATE TRIGGER log_teams_changes AFTER INSERT OR UPDATE OR DELETE ON teams FOR EACH ROW EXECUTE FUNCTION log_data_change();
CREATE TRIGGER log_sprints_changes AFTER INSERT OR UPDATE OR DELETE ON sprints FOR EACH ROW EXECUTE FUNCTION log_data_change();
CREATE TRIGGER log_functions_changes AFTER INSERT OR UPDATE OR DELETE ON functions FOR EACH ROW EXECUTE FUNCTION log_data_change();
CREATE TRIGGER log_employees_changes AFTER INSERT OR UPDATE OR DELETE ON employees FOR EACH ROW EXECUTE FUNCTION log_data_change();
CREATE TRIGGER log_resources_changes AFTER INSERT OR UPDATE OR DELETE ON resources FOR EACH ROW EXECUTE FUNCTION log_data_change();
CREATE TRIGGER log_tasks_changes AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION log_data_change();
