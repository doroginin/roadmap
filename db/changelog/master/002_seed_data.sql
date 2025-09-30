-- Seed data for roadmap application
-- Version: 002

-- Insert default teams
INSERT INTO teams (name, jira_project, feature_team, issue_type) VALUES
('Demo', '', '', ''),
('Test', '', '', ''),
('Test 2', '', '', '');

-- Insert default sprints
INSERT INTO sprints (code, start_date, end_date) VALUES
('Q3S1', '2025-06-02', '2025-06-29'),
('Q3S2', '2025-06-30', '2025-07-27'),
('Q3S3', '2025-07-28', '2025-08-24'),
('Q3S4', '2025-08-25', '2025-09-21');

-- Insert default functions
INSERT INTO functions (name) VALUES
('FN0'), ('FN1'), ('FN2'), ('FN3'), ('FN4'), ('FN5'), ('FN6'), ('FN7'), ('FN8'), 
('FN9'), ('FN10'), ('FN11'), ('FN12'), ('FN13'), ('FN14'), ('FN15');

-- Insert default employees
INSERT INTO employees (name) VALUES
('Empl1'), ('Empl2');

-- Get team and function IDs for resources
DO $$
DECLARE
    test_team_id UUID;
    test2_team_id UUID;
    fn1_id UUID;
    fn2_id UUID;
    fn3_id UUID;
    fn4_id UUID;
    fn5_id UUID;
    fn6_id UUID;
    fn7_id UUID;
    fn8_id UUID;
    fn9_id UUID;
    fn10_id UUID;
    fn11_id UUID;
    fn12_id UUID;
    fn13_id UUID;
    fn14_id UUID;
    fn15_id UUID;
    empl1_id UUID;
    empl2_id UUID;
BEGIN
    -- Get team IDs
    SELECT id INTO test_team_id FROM teams WHERE name = 'Test';
    SELECT id INTO test2_team_id FROM teams WHERE name = 'Test 2';
    
    -- Get function IDs
    SELECT id INTO fn1_id FROM functions WHERE name = 'FN1';
    SELECT id INTO fn2_id FROM functions WHERE name = 'FN2';
    SELECT id INTO fn3_id FROM functions WHERE name = 'FN3';
    SELECT id INTO fn4_id FROM functions WHERE name = 'FN4';
    SELECT id INTO fn5_id FROM functions WHERE name = 'FN5';
    SELECT id INTO fn6_id FROM functions WHERE name = 'FN6';
    SELECT id INTO fn7_id FROM functions WHERE name = 'FN7';
    SELECT id INTO fn8_id FROM functions WHERE name = 'FN8';
    SELECT id INTO fn9_id FROM functions WHERE name = 'FN9';
    SELECT id INTO fn10_id FROM functions WHERE name = 'FN10';
    SELECT id INTO fn11_id FROM functions WHERE name = 'FN11';
    SELECT id INTO fn12_id FROM functions WHERE name = 'FN12';
    SELECT id INTO fn13_id FROM functions WHERE name = 'FN13';
    SELECT id INTO fn14_id FROM functions WHERE name = 'FN14';
    SELECT id INTO fn15_id FROM functions WHERE name = 'FN15';
    
    -- Get employee IDs
    SELECT id INTO empl1_id FROM employees WHERE name = 'Empl1';
    SELECT id INTO empl2_id FROM employees WHERE name = 'Empl2';
    
    -- Insert resources with proper UUIDs and weeks data
    INSERT INTO resources (id, team_ids, function_id, employee_id, weeks, display_order) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', ARRAY[test_team_id], fn1_id, NULL, ARRAY[0, 0, 0, 1, 1, 1, 1, 1, 1], 1),
    ('550e8400-e29b-41d4-a716-446655440002', ARRAY[test_team_id], fn1_id, empl1_id, ARRAY[0, 1, 0, 1, 1, 1, 1, 1, 1], 2),
    ('550e8400-e29b-41d4-a716-446655440003', ARRAY[test_team_id], fn2_id, NULL, ARRAY[0, 1, 1, 1, 1, 1, 1, 1, 1], 3),
    ('550e8400-e29b-41d4-a716-446655440004', ARRAY[test_team_id], fn3_id, NULL, ARRAY[1, 0, 1, 1, 1, 0, 0, 0, 0], 4),
    ('550e8400-e29b-41d4-a716-446655440005', ARRAY[test_team_id], fn4_id, NULL, ARRAY[1, 0, 1, 0, 1, 0, 1, 0, 1], 5),
    ('550e8400-e29b-41d4-a716-446655440006', ARRAY[test_team_id], fn5_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 6),
    ('550e8400-e29b-41d4-a716-446655440007', ARRAY[test_team_id], fn6_id, NULL, ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 2], 7),
    ('550e8400-e29b-41d4-a716-446655440008', ARRAY[test_team_id], fn7_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 8),
    ('550e8400-e29b-41d4-a716-446655440009', ARRAY[test_team_id], fn8_id, NULL, ARRAY[1, 1, 1, 1, 0, 1, 1, 1, 1], 9),
    ('550e8400-e29b-41d4-a716-44665544000a', ARRAY[test2_team_id], fn9_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 10),
    ('550e8400-e29b-41d4-a716-44665544000b', ARRAY[test_team_id], fn9_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 11),
    ('550e8400-e29b-41d4-a716-44665544000c', ARRAY[test_team_id, test2_team_id], fn10_id, NULL, ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 2], 12),
    ('550e8400-e29b-41d4-a716-44665544000d', ARRAY[test_team_id], fn11_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 13),
    ('550e8400-e29b-41d4-a716-44665544000e', ARRAY[test_team_id, test2_team_id], fn11_id, NULL, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 14),
    ('550e8400-e29b-41d4-a716-44665544000f', ARRAY[test_team_id], fn12_id, empl1_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 15),
    ('550e8400-e29b-41d4-a716-446655440010', ARRAY[test_team_id], fn12_id, empl2_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 16),
    ('550e8400-e29b-41d4-a716-446655440011', ARRAY[test_team_id], fn13_id, empl1_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 17),
    ('550e8400-e29b-41d4-a716-446655440012', ARRAY[test_team_id], fn13_id, empl2_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 18),
    ('550e8400-e29b-41d4-a716-446655440013', ARRAY[test2_team_id, test_team_id], fn14_id, empl1_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 19),
    ('550e8400-e29b-41d4-a716-446655440014', ARRAY[test_team_id, test2_team_id], fn14_id, empl2_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 20),
    ('550e8400-e29b-41d4-a716-446655440015', ARRAY[test2_team_id, test_team_id], fn15_id, empl1_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 21),
    ('550e8400-e29b-41d4-a716-446655440016', ARRAY[test_team_id, test2_team_id], fn15_id, empl2_id, ARRAY[1, 1, 1, 1, 1, 1, 1, 1, 1], 22);
    
END $$;
