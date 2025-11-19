-- Seed data for roadmap application
-- Version: 002

-- Insert default teams
INSERT INTO teams (name, jira_project, feature_team, issue_type) VALUES
('Test', '', '', ''),
('Test 2', '', '', ''),
('E2E', '', '', '');

-- Insert default sprints
INSERT INTO sprints (code, start_date, end_date) VALUES
('Q4S1', '2025-10-06', '2025-10-17'),
('Q4S2', '2025-10-20', '2025-11-01'),
('Q4S3', '2025-11-05', '2025-11-14'),
('Q4S4', '2025-11-17', '2025-11-28'),
('Q4S5', '2025-12-01', '2025-12-12'),
('Q4S6', '2025-12-15', '2025-12-30'),
('Q1S1', '2026-01-12', '2026-01-23'),
('Q1S2', '2026-01-26', '2025-02-06');

-- Get team IDs for resources
DO $$
DECLARE
    test_team_id UUID;
    test2_team_id UUID;
BEGIN
    -- Get team IDs
    SELECT id INTO test_team_id FROM teams WHERE name = 'Test';
    SELECT id INTO test2_team_id FROM teams WHERE name = 'Test 2';
    
    -- Insert resources with proper UUIDs and weeks data (now using string values for function and employee)
    INSERT INTO resources (id, team_ids, function, employee, weeks, display_order) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', ARRAY[test_team_id], 'FN1', NULL, ARRAY[0, 0, 0, 1, 1, 1, 1, 1, 1], 1),
    ('550e8400-e29b-41d4-a716-446655440002', ARRAY[test_team_id], 'FN1', 'Empl1', ARRAY[0, 1, 0, 1, 1, 1, 1, 1, 1], 2),
    ('550e8400-e29b-41d4-a716-446655440003', ARRAY[test_team_id], 'FN2', NULL, ARRAY[0, 1, 1, 1, 1, 1, 1, 1, 1], 3),
    ('550e8400-e29b-41d4-a716-446655440004', ARRAY[test_team_id], 'FN3', NULL, ARRAY[1, 0, 1, 1, 1, 0, 0, 0, 0], 4),
    ('550e8400-e29b-41d4-a716-446655440005', ARRAY[test_team_id], 'FN4', NULL, ARRAY[1, 0, 1, 0, 1, 0, 1, 0, 1], 5),
    ('550e8400-e29b-41d4-a716-446655440006', ARRAY[test_team_id], 'FN5', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 6),
    ('550e8400-e29b-41d4-a716-446655440007', ARRAY[test_team_id], 'FN6', NULL, ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 2], 7),
    ('550e8400-e29b-41d4-a716-446655440008', ARRAY[test_team_id], 'FN7', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 8),
    ('550e8400-e29b-41d4-a716-446655440009', ARRAY[test_team_id], 'FN8', NULL, ARRAY[1, 1, 1, 1, 0, 1, 1, 1, 1], 9),
    ('550e8400-e29b-41d4-a716-44665544000a', ARRAY[test2_team_id], 'FN9', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 10),
    ('550e8400-e29b-41d4-a716-44665544000b', ARRAY[test_team_id], 'FN9', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 11),
    ('550e8400-e29b-41d4-a716-44665544000c', ARRAY[test_team_id, test2_team_id], 'FN10', NULL, ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 2], 12),
    ('550e8400-e29b-41d4-a716-44665544000d', ARRAY[test_team_id], 'FN11', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 13),
    ('550e8400-e29b-41d4-a716-44665544000e', ARRAY[test_team_id, test2_team_id], 'FN11', NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 14),
    ('550e8400-e29b-41d4-a716-44665544000f', ARRAY[test_team_id], 'FN12', 'Empl1', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 15),
    ('550e8400-e29b-41d4-a716-446655440010', ARRAY[test_team_id], 'FN12', 'Empl2', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 16),
    ('550e8400-e29b-41d4-a716-446655440011', ARRAY[test_team_id], 'FN13', 'Empl1', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 17),
    ('550e8400-e29b-41d4-a716-446655440012', ARRAY[test_team_id], 'FN13', 'Empl2', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 18),
    ('550e8400-e29b-41d4-a716-446655440013', ARRAY[test2_team_id, test_team_id], 'FN14', 'Empl1', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 19),
    ('550e8400-e29b-41d4-a716-446655440014', ARRAY[test_team_id, test2_team_id], 'FN14', 'Empl2', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 20),
    ('550e8400-e29b-41d4-a716-446655440015', ARRAY[test2_team_id, test_team_id], 'FN15', 'Empl1', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 21),
    ('550e8400-e29b-41d4-a716-446655440016', ARRAY[test_team_id, test2_team_id], 'FN15', 'Empl2', ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 22);
    
END $$;
