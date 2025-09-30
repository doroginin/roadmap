-- Migrate test tasks from React application
-- Version: 003

DO $$
DECLARE
    test_team_id UUID;
    test2_team_id UUID;
    fn0_id UUID;
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
    
    -- Insert FN0 if it doesn't exist
    INSERT INTO functions (name) VALUES ('FN0') ON CONFLICT (name) DO NOTHING;
    
    -- Get function IDs
    SELECT id INTO fn0_id FROM functions WHERE name = 'FN0';
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
    
    -- Clear existing test tasks
    DELETE FROM tasks WHERE team_id IN (test_team_id, test2_team_id);
    
    -- Insert test tasks with proper UUIDs and correct data
    INSERT INTO tasks (
        id, status, epic, task_name, team_id, function_id, employee_id,
        plan_empl, plan_weeks, blocker_ids, week_blockers, fact, start_week, end_week,
        expected_start_week, manual_edited, auto_plan_enabled, weeks, display_order
    ) VALUES
    -- Task 1
    ('650e8400-e29b-41d4-a716-446655440001', 'Todo', '', 'Если не заданы доступные ресурсы, вовзращаем пустую строку', test_team_id, fn0_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, NULL, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 1),
    
    -- Task 2
    ('650e8400-e29b-41d4-a716-446655440002', 'Todo', '', 'Начинаем с той недели где заданы ресурсы', test_team_id, fn1_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 2, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 2),
    
    -- Task 3
    ('650e8400-e29b-41d4-a716-446655440003', 'Todo', '', 'Начинаем с той недели где заданы ресурсы и они не 0', test_team_id, fn2_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 2, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 3),
    
    -- Task 4
    ('650e8400-e29b-41d4-a716-446655440004', 'Todo', '', 'Начинаем с той недели, начиная с которой доступно необходимое кол-во недель для задачи', test_team_id, fn3_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 4),
    
    -- Task 5
    ('650e8400-e29b-41d4-a716-446655440005', 'Todo', '', 'Если ресурсы, заданы но их недостаточно возвращаем пустую строку', test_team_id, fn4_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, NULL, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 5),
    
    -- Task 6
    ('650e8400-e29b-41d4-a716-446655440006', 'Todo', '', 'Если ресурс занят другой задачей, планируем после нее', test_team_id, fn5_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, NULL, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 6),
    
    -- Task 7
    ('650e8400-e29b-41d4-a716-446655440007', 'Todo', '', 'Если ресурс занят другой задачей, планируем после нее', test_team_id, fn5_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 7),
    
    -- Task 8
    ('650e8400-e29b-41d4-a716-446655440008', 'Todo', '', 'Если ресурсы занят частично другой задачей и еще есть место планируем параллельно', test_team_id, fn6_id, NULL,
     0, 0, '{}', '{}', 0, NULL, NULL, NULL, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 8),
    
    -- Task 9
    ('650e8400-e29b-41d4-a716-446655440009', 'Todo', '', 'Если ресурсы занят частично другой задачей и еще есть место планируем параллельно', test_team_id, fn6_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 9),
    
    -- Task 10
    ('650e8400-e29b-41d4-a716-44665544000a', 'Todo', '', 'Если задача требует нецелое число недель округляем в большую сторону', test_team_id, fn7_id, NULL,
     1, 1.5, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 10),
    
    -- Task 11
    ('650e8400-e29b-41d4-a716-44665544000b', 'Todo', '', 'Если задача требует нецелое число недель округляем в большую сторону', test_team_id, fn7_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 11),
    
    -- Task 12
    ('650e8400-e29b-41d4-a716-44665544000c', 'Todo', '', 'Если у задачи указан блокер начинаем позже блокирующей недели', test_team_id, fn8_id, NULL,
     1, 1, '{}', ARRAY[3], 0, NULL, NULL, 4, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 12),
    
    -- Task 13
    ('650e8400-e29b-41d4-a716-44665544000d', 'Todo', '', 'Если у задачи указан блокер и нет ресурсов сразу после блокера планируем не раньше блокирующей недели и не раньше чем появятся доступные ресурсы', test_team_id, fn8_id, NULL,
     1, 1, '{}', ARRAY[3], 0, NULL, NULL, 6, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 13),
    
    -- Task 14
    ('650e8400-e29b-41d4-a716-44665544000e', 'Todo', '', 'Если одна функция определена для нескольких команд используем ресурсы той команды которая указана в задаче', test_team_id, fn9_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 14),
    
    -- Task 15
    ('650e8400-e29b-41d4-a716-44665544000f', 'Todo', '', 'Если одна функция определена для нескольких команд используем ресурсы той команды которая указана в задаче', test_team_id, fn9_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 15),
    
    -- Task 16
    ('650e8400-e29b-41d4-a716-446655440010', 'Todo', '', 'Если одна функция определена для нескольких команд используем ресурсы той команды которая указана в задаче', test2_team_id, fn9_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 16),
    
    -- Task 17
    ('650e8400-e29b-41d4-a716-446655440011', 'Todo', '', 'Если одна функция определена для нескольких команд используем ресурсы той команды которая указана в задаче', test2_team_id, fn9_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 17),
    
    -- Task 18
    ('650e8400-e29b-41d4-a716-446655440012', 'Todo', '', 'Если для одной функции задано сразу несколько команд используем ее ресурв в задачах обеих команд', test_team_id, fn10_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 18),
    
    -- Task 19
    ('650e8400-e29b-41d4-a716-446655440013', 'Todo', '', 'Если для одной функции задано сразу несколько команд используем ее ресурв в задачах обеих команд', test2_team_id, fn10_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 19),
    
    -- Task 20
    ('650e8400-e29b-41d4-a716-446655440014', 'Todo', '', 'Если для одной функции задано сразу несколько команд используем ее ресурв в задачах обеих команд', test_team_id, fn10_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 20),
    
    -- Task 21
    ('650e8400-e29b-41d4-a716-446655440015', 'Todo', '', 'Если для одной функции задано сразу несколько команд используем ее ресурв в задачах обеих команд', test2_team_id, fn10_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 21),
    
    -- Task 22
    ('650e8400-e29b-41d4-a716-446655440016', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 22),
    
    -- Task 23
    ('650e8400-e29b-41d4-a716-446655440017', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 23),
    
    -- Task 24
    ('650e8400-e29b-41d4-a716-446655440018', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 2, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 24),
    
    -- Task 25
    ('650e8400-e29b-41d4-a716-446655440019', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 25),
    
    -- Task 26
    ('650e8400-e29b-41d4-a716-44665544001a', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 2, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 26),
    
    -- Task 27
    ('650e8400-e29b-41d4-a716-44665544001b', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 4, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 27),
    
    -- Task 28
    ('650e8400-e29b-41d4-a716-44665544001c', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 28),
    
    -- Task 29
    ('650e8400-e29b-41d4-a716-44665544001d', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 29),
    
    -- Task 30
    ('650e8400-e29b-41d4-a716-44665544001e', 'Todo', '', 'Две одинаковые функции, одна для одной команды, другая для двух', test2_team_id, fn11_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 6, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 30),
    
    -- Task 31
    ('650e8400-e29b-41d4-a716-44665544001f', 'Todo', '', 'Планирование общей задачи при наличии только персональных ресурсов, затем перс задачи', test_team_id, fn12_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 31),
    
    -- Task 32
    ('650e8400-e29b-41d4-a716-446655440020', 'Todo', '', 'Планирование общей задачи при наличии только персональных ресурсов, затем перс задачи', test_team_id, fn12_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 32),
    
    -- Task 33
    ('650e8400-e29b-41d4-a716-446655440021', 'Todo', '', 'Планирование персональной задачи после общих задач', test_team_id, fn12_id, empl1_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 33),
    
    -- Task 34
    ('650e8400-e29b-41d4-a716-446655440022', 'Todo', '', 'Планирование персональной задачи после общих задач', test_team_id, fn12_id, empl1_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 34),
    
    -- Task 35
    ('650e8400-e29b-41d4-a716-446655440023', 'Todo', '', 'Планирование персональной задачи после общих задач', test_team_id, fn12_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 35),
    
    -- Task 36
    ('650e8400-e29b-41d4-a716-446655440024', 'Todo', '', 'Планирование персональной задачи после общих задач', test_team_id, fn12_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 36),
    
    -- Task 37
    ('650e8400-e29b-41d4-a716-446655440025', 'Todo', '', 'Планирование персональной задачи', test_team_id, fn13_id, empl1_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 37),
    
    -- Task 38
    ('650e8400-e29b-41d4-a716-446655440026', 'Todo', '', 'Планирование персональной задачи', test_team_id, fn13_id, empl1_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 38),
    
    -- Task 39
    ('650e8400-e29b-41d4-a716-446655440027', 'Todo', '', 'Планирование персональной задачи', test_team_id, fn13_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 39),
    
    -- Task 40
    ('650e8400-e29b-41d4-a716-446655440028', 'Todo', '', 'Планирование персональной задачи', test_team_id, fn13_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 40),
    
    -- Task 41
    ('650e8400-e29b-41d4-a716-446655440029', 'Todo', '', 'Планирование общей задачи при наличии только персональных ресурсов, после перс задач', test_team_id, fn13_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 41),
    
    -- Task 42
    ('650e8400-e29b-41d4-a716-44665544002a', 'Todo', '', 'Планирование общей задачи при наличии только персональных ресурсов, после перс задач', test_team_id, fn13_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 42),
    
    -- Task 43
    ('650e8400-e29b-41d4-a716-44665544002b', 'Todo', '', 'Два сотрудника одной функции работают на две команды (не важно кто делает, но будет делать Empl1 по приоритету ресурсов)', test_team_id, fn14_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 43),
    
    -- Task 44
    ('650e8400-e29b-41d4-a716-44665544002c', 'Todo', '', 'Два сотрудника одной функции работают на две команды (перс задача для Empl1)', test_team_id, fn14_id, empl1_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 44),
    
    -- Task 45
    ('650e8400-e29b-41d4-a716-44665544002d', 'Todo', '', 'Два сотрудника одной функции работают на две команды (перс задача для Empl2)', test2_team_id, fn14_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 45),
    
    -- Task 46
    ('650e8400-e29b-41d4-a716-44665544002e', 'Todo', '', 'Два сотрудника одной функции работают на две команды (перс задача для Empl2)', test2_team_id, fn14_id, empl2_id,
     1, 2, '{}', '{}', 0, NULL, NULL, 3, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 46),
    
    -- Task 47
    ('650e8400-e29b-41d4-a716-44665544002f', 'Todo', '', 'Два сотрудника одной функции работают на две команды (не важно кто делает, но будет делать Empl1 по приоритету ресурсов)', test_team_id, fn14_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 47),
    
    -- Task 48
    ('650e8400-e29b-41d4-a716-446655440030', 'Todo', '', 'Два сотрудника одной функции работают на две команды (не важно кто делает, но будет делать Empl2 по приоритету ресурсов)', test_team_id, fn14_id, NULL,
     1, 2, '{}', '{}', 0, NULL, NULL, 5, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 48),
    
    -- Task 49
    ('650e8400-e29b-41d4-a716-446655440031', 'Todo', '', 'Два сотрудника одной функции работают на две команды (перс задача)', test_team_id, fn15_id, empl1_id,
     1, 1, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 49),
    
    -- Task 50
    ('650e8400-e29b-41d4-a716-446655440032', 'Todo', '', 'Два сотрудника одной функции работают на две команды (не важно кто делает, но будет делать Empl2 по приоритету ресурсов)', test_team_id, fn15_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 1, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 50),
    
    -- Task 51
    ('650e8400-e29b-41d4-a716-446655440033', 'Todo', '', 'Два сотрудника одной функции работают на две команды (не важно кто делает, но будет делать Empl1 по приоритету ресурсов)', test_team_id, fn15_id, NULL,
     1, 1, '{}', '{}', 0, NULL, NULL, 2, false, true, ARRAY[0,0,0,0,0,0,0,0,0], 51);

END $$;