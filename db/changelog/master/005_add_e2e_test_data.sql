-- 005_add_e2e_test_data.sql
-- Добавляем тестовые данные для e2e тестов

-- Получаем ID команды Demo из базы данных
DO $$
DECLARE
    demo_team_id UUID;
BEGIN
    SELECT id INTO demo_team_id FROM teams WHERE name = 'Demo' LIMIT 1;
    
    IF demo_team_id IS NULL THEN
        RAISE EXCEPTION 'Team "Demo" not found in database';
    END IF;

    -- Добавляем тестовые ресурсы (теперь function и employee - это строки)
    INSERT INTO resources (id, team_ids, function, employee, weeks, display_order, created_at, updated_at)
    VALUES 
    (
        'dddddddd-0000-0000-0000-000000000002',
        ARRAY[demo_team_id]::uuid[],
        'Test Function',
        NULL,
        ARRAY[0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        2,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Добавляем тестовые задачи (теперь function и employee - это строки)
    INSERT INTO tasks (id, status, sprints_auto, epic, task_name, team_id, function, employee, plan_empl, plan_weeks, blocker_ids, week_blockers, fact, start_week, end_week, expected_start_week, auto_plan_enabled, weeks, display_order, created_at, updated_at)
    VALUES 
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Todo',
        ARRAY['Q3S1'],
        'Test Epic',
        'Test Task 1 - Data Optimization',
        demo_team_id,
        'Test Function',
        NULL,
        1.0,
        2.0,
        ARRAY[]::uuid[],
        ARRAY[]::bigint[],
        0.0,
        1,
        2,
        NULL,
        false,
        ARRAY[1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        1,
        NOW(),
        NOW()
    ),
    (
        'bbbbbbbb-0000-0000-0000-000000000002',
        'Todo',
        ARRAY['Q3S1'],
        'Test Epic',
        'Test Task 2 - Resource Test',
        demo_team_id,
        'Test Function',
        NULL,
        1.0,
        1.0,
        ARRAY[]::uuid[],
        ARRAY[]::bigint[],
        0.0,
        2,
        2,
        NULL,
        false,
        ARRAY[0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        2,
        NOW(),
        NOW()
    ),
    (
        'eeeeeeee-0000-0000-0000-000000000001',
        'Todo',
        ARRAY['Q3S1', 'Q3S2'],
        'Test Epic',
        'Test Task 3 - Multiple Changes',
        demo_team_id,
        'Test Function',
        NULL,
        1.0,
        3.0,
        ARRAY[]::uuid[],
        ARRAY[]::bigint[],
        0.0,
        3,
        5,
        NULL,
        false,
        ARRAY[0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        3,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

END $$;