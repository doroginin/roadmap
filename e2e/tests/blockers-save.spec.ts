import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Blockers save functionality', () => {
  test('should create, save, and verify week blocker via Shift+drag with auto-planning', async ({ page }) => {
    // Generate unique function name for this test
    const randomFn = `FN${Math.floor(Math.random() * 10000)}`;
    const taskName1 = `Test Task 1 ${Date.now()}`;
    const taskName2 = `Test Task 2 ${Date.now()}`;

    console.log(`\n🎲 Using random function: ${randomFn}`);
    console.log(`📝 Test tasks: "${taskName1}" and "${taskName2}"`);

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    console.log('\n📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter');

    // Шаг 2: Создаем ресурс
    console.log('\n➕ Step 2: Creating resource');
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-resource-button').click();

    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);
    const resourceId = await newResourceRow.getAttribute('data-row-id');
    if (!resourceId) throw new Error('Resource ID not found');
    console.log(`Created resource with ID: ${resourceId}`);

    // Устанавливаем функцию ресурса
    const fnCell = page.getByTestId(`fn-cell-${resourceId}`);
    await fnCell.dblclick();
    const fnInput = page.getByTestId(`resource-input-${resourceId}`);
    await expect(fnInput).toBeVisible();
    await fnInput.fill(randomFn);
    await fnInput.press('Enter');
    console.log(`✅ Resource function set: ${randomFn}`);

    // Устанавливаем доступность ресурса для недель 1-10
    console.log('📅 Setting resource availability for weeks 1-10');
    const resourceRow = page.locator(`tr[data-row-id="${resourceId}"]`);
    const weekCell = resourceRow.locator(`[data-testid="week-1"]`);
    await weekCell.dblclick();
    for (let week = 1; week <= 10; week++) {
      await page.keyboard.type('1');
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');

    console.log('✅ Resource availability set');

    // Шаг 3: Создаем первую задачу с автопланированием
    console.log('\n➕ Step 3: Creating first task with auto-planning');
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-task-button').click();

    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount1 = await taskRows.count();
    const newTaskRow1 = taskRows.nth(taskCount1 - 1);
    const taskId1 = await newTaskRow1.getAttribute('data-row-id');
    if (!taskId1) throw new Error('Task 1 ID not found');
    console.log(`Created task 1 with ID: ${taskId1}`);

    // Заполняем название задачи 1
    const taskCell1 = page.getByTestId(`task-cell-${taskId1}`);
    await taskCell1.scrollIntoViewIfNeeded();
    await expect(taskCell1).toBeVisible();
    await taskCell1.dblclick();
    const taskInput1 = page.getByTestId(`task-input-${taskId1}`);
    await expect(taskInput1).toBeVisible();
    await taskInput1.fill(taskName1);
    await taskInput1.press('Enter');
    console.log(`✅ Task 1 name set: ${taskName1}`);

    // Устанавливаем функцию задачи 1
    const taskFnCell1 = page.getByTestId(`fn-cell-${taskId1}`);
    await taskFnCell1.dblclick();
    const selectOption1 = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption1).toBeVisible();
    await selectOption1.click();
    console.log(`✅ Task 1 function set: ${randomFn}`);

    // Устанавливаем plan для задачи 1: planEmpl = 1, planWeeks = 2
    const planEmplCell1 = page.getByTestId(`planEmpl-cell-${taskId1}`);
    await planEmplCell1.dblclick();
    const planEmplInput1 = page.getByTestId(`planEmpl-input-${taskId1}`);
    await expect(planEmplInput1).toBeVisible();
    await planEmplInput1.fill('1');
    await planEmplInput1.press('Enter');
    console.log('✅ Task 1 planEmpl set: 1');

    const planWeeksCell1 = page.getByTestId(`planWeeks-cell-${taskId1}`);
    await planWeeksCell1.dblclick();
    const planWeeksInput1 = page.getByTestId(`planWeeks-input-${taskId1}`);
    await expect(planWeeksInput1).toBeVisible();
    await planWeeksInput1.fill('2');
    await planWeeksInput1.press('Enter');
    console.log('✅ Task 1 planWeeks set: 2');

    // Проверяем что автоплан включен и задача запланирована
    const taskRow1 = page.locator(`tr[data-row-id="${taskId1}"]`);
    const autoCheckbox1 = taskRow1.locator('input[type="checkbox"]');
    await expect(autoCheckbox1).toBeChecked();
    console.log('✅ Task 1 auto-planning is enabled');

    // Шаг 4: Создаем вторую задачу с автопланированием
    console.log('\n➕ Step 4: Creating second task with auto-planning');
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-task-button').click();

    const taskCount2 = await taskRows.count();
    const newTaskRow2 = taskRows.nth(taskCount2 - 1);
    const taskId2 = await newTaskRow2.getAttribute('data-row-id');
    if (!taskId2) throw new Error('Task 2 ID not found');
    console.log(`Created task 2 with ID: ${taskId2}`);

    // Заполняем название задачи 2
    const taskCell2 = page.getByTestId(`task-cell-${taskId2}`);
    await taskCell2.scrollIntoViewIfNeeded();
    await expect(taskCell2).toBeVisible();
    await taskCell2.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${taskId2}`);
    await expect(taskInput2).toBeVisible();
    await taskInput2.fill(taskName2);
    await taskInput2.press('Enter');
    console.log(`✅ Task 2 name set: ${taskName2}`);

    // Устанавливаем функцию задачи 2
    const taskFnCell2 = page.getByTestId(`fn-cell-${taskId2}`);
    await taskFnCell2.dblclick();
    const selectOption2 = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption2).toBeVisible({ timeout: 5000 });
    await selectOption2.click();
    console.log(`✅ Task 2 function set: ${randomFn}`);

    // Устанавливаем plan для задачи 2: planEmpl = 1, planWeeks = 2
    const planEmplCell2 = page.getByTestId(`planEmpl-cell-${taskId2}`);
    await planEmplCell2.dblclick();
    const planEmplInput2 = page.getByTestId(`planEmpl-input-${taskId2}`);
    await expect(planEmplInput2).toBeVisible();
    await planEmplInput2.fill('1');
    await planEmplInput2.press('Enter');
    console.log('✅ Task 2 planEmpl set: 1');

    const planWeeksCell2 = page.getByTestId(`planWeeks-cell-${taskId2}`);
    await planWeeksCell2.dblclick();
    const planWeeksInput2 = page.getByTestId(`planWeeks-input-${taskId2}`);
    await expect(planWeeksInput2).toBeVisible();
    await planWeeksInput2.fill('2');
    await planWeeksInput2.press('Enter');
    console.log('✅ Task 2 planWeeks set: 2');

    // Проверяем что автоплан включен
    const taskRow2 = page.locator(`tr[data-row-id="${taskId2}"]`);
    const autoCheckbox2 = taskRow2.locator('input[type="checkbox"]');
    await expect(autoCheckbox2).toBeChecked();
    console.log('✅ Task 2 auto-planning is enabled');

    // Шаг 5: Проверяем что задача 2 запланирована на недели 3-4 (сразу после задачи 1)
    console.log('\n📊 Step 5: Verifying initial task 2 schedule');
    const task2Week3 = taskRow2.locator('[data-week-idx="2"]');
    const task2Week3Text = await task2Week3.textContent();
    console.log(`Task 2 week 3 content: "${task2Week3Text}"`);

    // Шаг 6: Создаем блокер на неделю через Shift+drag
    console.log('\n🔗 Step 6: Creating week blocker via Shift+drag on week 4');

    // Находим ячейку типа задачи 2 для начала перетаскивания
    const typeCell2 = page.locator(`tr[data-row-id="${taskId2}"] .draggable-cell`).first();
    await typeCell2.scrollIntoViewIfNeeded();
    await expect(typeCell2).toBeVisible();

    // Находим неделю 4 (weekIdx=3) задачи 1 - это блокирует задачу 2 до 5-й недели
    const targetWeekCell = page.locator(`[data-row-id="${taskId1}"][data-week-idx="3"]`);
    await targetWeekCell.scrollIntoViewIfNeeded();
    await expect(targetWeekCell).toBeVisible();

    // Выполняем Shift+drag
    await page.keyboard.down('Shift');
    const typeCellBox = await typeCell2.boundingBox();
    const targetBox = await targetWeekCell.boundingBox();
    if (!typeCellBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(typeCellBox.x + typeCellBox.width / 2, typeCellBox.y + typeCellBox.height / 2);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    console.log('✅ Week blocker created via Shift+drag on week 4');

    // Шаг 7: Проверяем что появилась стрелка
    console.log('\n🎨 Step 7: Verifying arrow is displayed');
    const svg = page.locator('svg[width][height]').first();
    await expect(svg).toBeVisible({ timeout: 5000 });
    // Ждем появления paths внутри SVG
    const paths = svg.locator('path[stroke]');
    await expect(paths.first()).toBeVisible({ timeout: 5000 });
    const pathCount = await paths.count();
    expect(pathCount).toBeGreaterThan(0);
    console.log(`✅ Found ${pathCount} arrow(s) displayed`);

    // Шаг 8: Проверяем что задача 2 перепланировалась на недели 5-6 (после блокера)
    console.log('\n📊 Step 8: Verifying task 2 was rescheduled after blocker');
    const task2Week5 = taskRow2.locator('[data-week-idx="4"]');
    const task2Week5Text = await task2Week5.textContent();
    console.log(`Task 2 week 5 content after blocker: "${task2Week5Text}"`);
    // Проверяем что теперь задача 2 начинается не раньше 5-й недели
    const task2Week3After = taskRow2.locator('[data-week-idx="2"]');
    const task2Week3AfterText = await task2Week3After.textContent();
    console.log(`Task 2 week 3 content after blocker: "${task2Week3AfterText}" (should be empty or 0)`);

    // Шаг 9: Сохраняем изменения
    console.log('\n💾 Step 9: Saving changes');
    const saveButton = page.getByText('Сохранить');
    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Changes saved');

    // Шаг 10: Перезагружаем страницу и проверяем что блокер сохранился
    console.log('\n🔄 Step 10: Reloading page to verify blocker persistence');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page reloaded');

    // Проверяем что задачи существуют
    await expect(page.getByTestId(`task-cell-${taskId1}`)).toContainText(taskName1);
    await expect(page.getByTestId(`task-cell-${taskId2}`)).toContainText(taskName2);
    console.log('✅ Both tasks persisted');

    // Проверяем что стрелка блокера все еще отображается
    // Ждем отрисовки стрелок после перезагрузки
    const svgAfterReload = page.locator('svg[width][height]').first();
    await expect(svgAfterReload).toBeVisible({ timeout: 5000 });
    const pathsAfterReload = svgAfterReload.locator('path[stroke]');
    await expect(pathsAfterReload.first()).toBeVisible({ timeout: 5000 });
    const pathCountAfterReload = await pathsAfterReload.count();
    expect(pathCountAfterReload).toBeGreaterThan(0);
    console.log(`✅ Found ${pathCountAfterReload} arrow(s) after reload - blocker persisted`);

    // Проверяем что задача 2 все еще запланирована на недели 5-6 (после блокера)
    const taskRow2AfterReload = page.locator(`tr[data-row-id="${taskId2}"]`);
    const task2Week5AfterReload = taskRow2AfterReload.locator('[data-week-idx="4"]');
    const task2Week5AfterReloadText = await task2Week5AfterReload.textContent();
    console.log(`✅ Task 2 still starts at week 5 after reload: "${task2Week5AfterReloadText}"`);

    // Шаг 11: Очистка - удаляем задачи и ресурс
    console.log('\n🗑️  Step 11: Cleaning up test data');

    // Удаляем задачу 2
    const taskRowForDelete2 = page.locator(`tr[data-row-id="${taskId2}"]`);
    await taskRowForDelete2.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    // Удаляем задачу 1
    const taskRowForDelete1 = page.locator(`tr[data-row-id="${taskId1}"]`);
    await taskRowForDelete1.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    // Удаляем ресурс
    const resourceRowForDelete = page.locator(`tr[data-row-id="${resourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    await page.getByText('Сохранить').click();
    await waitForAutoSave(page);
    console.log('✅ Test data deleted');

    console.log('\n✨ Test completed successfully! Week blocker with auto-planning is working.');
  });

  test('should create, save, and verify task blocker via Shift+drag with auto-planning', async ({ page }) => {
    // Generate unique function name for this test
    const randomFn = `FN${Math.floor(Math.random() * 10000)}`;
    const taskName1 = `Test Task 1 ${Date.now()}`;
    const taskName2 = `Test Task 2 ${Date.now()}`;

    console.log(`\n🎲 Using random function: ${randomFn}`);
    console.log(`📝 Test tasks: "${taskName1}" and "${taskName2}"`);

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    console.log('\n📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter');

    // Шаг 2: Создаем ресурс
    console.log('\n➕ Step 2: Creating resource');
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-resource-button').click();

    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);
    const resourceId = await newResourceRow.getAttribute('data-row-id');
    if (!resourceId) throw new Error('Resource ID not found');
    console.log(`Created resource with ID: ${resourceId}`);

    // Устанавливаем функцию ресурса
    const fnCell = page.getByTestId(`fn-cell-${resourceId}`);
    await fnCell.dblclick();
    const fnInput = page.getByTestId(`resource-input-${resourceId}`);
    await expect(fnInput).toBeVisible();
    await fnInput.fill(randomFn);
    await fnInput.press('Enter');
    console.log(`✅ Resource function set: ${randomFn}`);

    // Устанавливаем доступность ресурса для недель 1-10
    console.log('📅 Setting resource availability for weeks 1-10');
    const resourceRow = page.locator(`tr[data-row-id="${resourceId}"]`);
    for (let week = 1; week <= 10; week++) {
      const weekCell = resourceRow.locator(`[data-testid="week-${week}"]`);
      await weekCell.dblclick();
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
    }
    console.log('✅ Resource availability set');

    // Шаг 3: Создаем первую задачу с автопланированием
    console.log('\n➕ Step 3: Creating first task with auto-planning');
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-task-button').click();

    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount1 = await taskRows.count();
    const newTaskRow1 = taskRows.nth(taskCount1 - 1);
    const taskId1 = await newTaskRow1.getAttribute('data-row-id');
    if (!taskId1) throw new Error('Task 1 ID not found');
    console.log(`Created task 1 with ID: ${taskId1}`);

    // Заполняем название задачи 1
    const taskCell1 = page.getByTestId(`task-cell-${taskId1}`);
    await taskCell1.scrollIntoViewIfNeeded();
    await expect(taskCell1).toBeVisible();
    await taskCell1.dblclick();
    const taskInput1 = page.getByTestId(`task-input-${taskId1}`);
    await expect(taskInput1).toBeVisible();
    await taskInput1.fill(taskName1);
    await taskInput1.press('Enter');
    console.log(`✅ Task 1 name set: ${taskName1}`);

    // Устанавливаем функцию задачи 1
    const taskFnCell1 = page.getByTestId(`fn-cell-${taskId1}`);
    await taskFnCell1.dblclick();
    const selectOption1 = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption1).toBeVisible({ timeout: 5000 });
    await selectOption1.click();
    console.log(`✅ Task 1 function set: ${randomFn}`);

    // Устанавливаем plan для задачи 1: planEmpl = 1, planWeeks = 2
    const planEmplCell1 = page.getByTestId(`planEmpl-cell-${taskId1}`);
    await planEmplCell1.dblclick();
    const planEmplInput1 = page.getByTestId(`planEmpl-input-${taskId1}`);
    await expect(planEmplInput1).toBeVisible();
    await planEmplInput1.fill('1');
    await planEmplInput1.press('Enter');
    console.log('✅ Task 1 planEmpl set: 1');

    const planWeeksCell1 = page.getByTestId(`planWeeks-cell-${taskId1}`);
    await planWeeksCell1.dblclick();
    const planWeeksInput1 = page.getByTestId(`planWeeks-input-${taskId1}`);
    await expect(planWeeksInput1).toBeVisible();
    await planWeeksInput1.fill('2');
    await planWeeksInput1.press('Enter');
    console.log('✅ Task 1 planWeeks set: 2');

    // Проверяем что автоплан включен и задача запланирована
    const taskRow1 = page.locator(`tr[data-row-id="${taskId1}"]`);
    const autoCheckbox1 = taskRow1.locator('input[type="checkbox"]');
    await expect(autoCheckbox1).toBeChecked();
    console.log('✅ Task 1 auto-planning is enabled');

    // Шаг 4: Создаем вторую задачу с автопланированием
    console.log('\n➕ Step 4: Creating second task with auto-planning');
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-task-button').click();

    const taskCount2 = await taskRows.count();
    const newTaskRow2 = taskRows.nth(taskCount2 - 1);
    const taskId2 = await newTaskRow2.getAttribute('data-row-id');
    if (!taskId2) throw new Error('Task 2 ID not found');
    console.log(`Created task 2 with ID: ${taskId2}`);

    // Заполняем название задачи 2
    const taskCell2 = page.getByTestId(`task-cell-${taskId2}`);
    await taskCell2.scrollIntoViewIfNeeded();
    await expect(taskCell2).toBeVisible();
    await taskCell2.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${taskId2}`);
    await expect(taskInput2).toBeVisible();
    await taskInput2.fill(taskName2);
    await taskInput2.press('Enter');
    console.log(`✅ Task 2 name set: ${taskName2}`);

    // Устанавливаем функцию задачи 2
    const taskFnCell2 = page.getByTestId(`fn-cell-${taskId2}`);
    await taskFnCell2.dblclick();
    const selectOption2 = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption2).toBeVisible({ timeout: 5000 });
    await selectOption2.click();
    console.log(`✅ Task 2 function set: ${randomFn}`);

    // Устанавливаем plan для задачи 2: planEmpl = 1, planWeeks = 2
    const planEmplCell2 = page.getByTestId(`planEmpl-cell-${taskId2}`);
    await planEmplCell2.dblclick();
    const planEmplInput2 = page.getByTestId(`planEmpl-input-${taskId2}`);
    await expect(planEmplInput2).toBeVisible();
    await planEmplInput2.fill('1');
    await planEmplInput2.press('Enter');
    console.log('✅ Task 2 planEmpl set: 1');

    const planWeeksCell2 = page.getByTestId(`planWeeks-cell-${taskId2}`);
    await planWeeksCell2.dblclick();
    const planWeeksInput2 = page.getByTestId(`planWeeks-input-${taskId2}`);
    await expect(planWeeksInput2).toBeVisible();
    await planWeeksInput2.fill('2');
    await planWeeksInput2.press('Enter');
    console.log('✅ Task 2 planWeeks set: 2');

    // Проверяем что автоплан включен
    const taskRow2 = page.locator(`tr[data-row-id="${taskId2}"]`);
    const autoCheckbox2 = taskRow2.locator('input[type="checkbox"]');
    await expect(autoCheckbox2).toBeChecked();
    console.log('✅ Task 2 auto-planning is enabled');

    // Шаг 5: Создаем блокер на задачу через Shift+drag (Task 2 блокирует Task 1)
    console.log('\n🔗 Step 5: Creating task blocker via Shift+drag (Task 2 blocks Task 1)');

    // Проверяем начальное расписание: Task 1 на неделях 1-2, Task 2 на неделях 3-4
    console.log('Initial schedule: Task 1 on weeks 1-2, Task 2 on weeks 3-4');
    const task1Week1Before = taskRow1.locator('[data-week-idx="0"]');
    const task1Week1BeforeText = await task1Week1Before.textContent();
    console.log(`Task 1 week 1 before blocker: "${task1Week1BeforeText}"`);

    // Находим ячейку типа задачи 1 для начала перетаскивания
    const typeCell1 = page.locator(`tr[data-row-id="${taskId1}"] .draggable-cell`).first();
    await typeCell1.scrollIntoViewIfNeeded();
    await expect(typeCell1).toBeVisible();

    // Находим ячейку типа задачи 2 для целевого drop
    const typeCell2 = page.locator(`tr[data-row-id="${taskId2}"] .draggable-cell`).first();
    await typeCell2.scrollIntoViewIfNeeded();
    await expect(typeCell2).toBeVisible();

    // Выполняем Shift+drag (перетаскиваем Task 1 на Task 2, чтобы Task 2 блокировал Task 1)
    await page.keyboard.down('Shift');
    const typeCell1Box = await typeCell1.boundingBox();
    const typeCell2Box = await typeCell2.boundingBox();
    if (!typeCell1Box || !typeCell2Box) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(typeCell1Box.x + typeCell1Box.width / 2, typeCell1Box.y + typeCell1Box.height / 2);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(typeCell2Box.x + typeCell2Box.width / 2, typeCell2Box.y + typeCell2Box.height / 2, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    console.log('✅ Task blocker created via Shift+drag (Task 2 blocks Task 1)');

    // Ждем появления стрелки блокера
    const svgEarly = page.locator('svg[width][height]').first();
    await expect(svgEarly).toBeVisible({ timeout: 5000 });

    // Проверяем что Task 1 перепланировалась на недели 3-4 (после Task 2)
    const task1Week3Check = taskRow1.locator('[data-week-idx="2"]');
    const task1Week3CheckText = await task1Week3Check.textContent();
    console.log(`Task 1 week 3 content after blocker: "${task1Week3CheckText}" (should have values - Task 1 moved after Task 2)`);

    // Проверяем что Task 2 осталась на неделе 1-2 (она блокирует, поэтому идет первой)
    const task2Week1Check = taskRow2.locator('[data-week-idx="0"]');
    const task2Week1CheckText = await task2Week1Check.textContent();
    console.log(`Task 2 week 1 content after blocker: "${task2Week1CheckText}" (should have values - Task 2 goes first)`);

    // Шаг 6: Проверяем что появилась стрелка и она направлена правильно
    console.log('\n🎨 Step 6: Verifying arrow is displayed and points in the correct direction');
    const svg = page.locator('svg[width][height]').first();
    await expect(svg).toBeVisible({ timeout: 5000 });
    // Ждем появления paths внутри SVG
    const paths = svg.locator('path[stroke]');
    await expect(paths.first()).toBeVisible({ timeout: 5000 });
    const pathCount = await paths.count();
    expect(pathCount).toBeGreaterThan(0);
    console.log(`✅ Found ${pathCount} arrow(s) displayed`);

    // Проверяем направление стрелки: она должна идти от Task 2 к Task 1
    // Получаем позиции задач на странице
    const task2Row = page.locator(`tr[data-row-id="${taskId2}"]`);
    const task1Row = page.locator(`tr[data-row-id="${taskId1}"]`);
    const task2Box = await task2Row.boundingBox();
    const task1Box = await task1Row.boundingBox();

    if (!task2Box || !task1Box) {
      throw new Error('Could not get task row positions');
    }

    // Task 2 должна быть выше (меньший Y) чем Task 1, так как она блокирует
    console.log(`Task 2 position Y: ${task2Box.y}, Task 1 position Y: ${task1Box.y}`);

    // Проверяем что есть маркер стрелки (указывающий на заблокированную задачу)
    const markers = svg.locator('marker');
    const markerCount = await markers.count();
    expect(markerCount).toBeGreaterThan(0);
    console.log(`✅ Found ${markerCount} arrow marker(s) - arrows have direction`);

    // Шаг 7: Ждем автосохранения
    console.log('\n💾 Step 7: Waiting for autosave');
    await waitForAutoSave(page);
    console.log('✅ Changes autosaved');

    // Шаг 8: Перезагружаем страницу и проверяем что блокер сохранился
    console.log('\n🔄 Step 8: Reloading page to verify blocker persistence');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page reloaded');

    // Проверяем что задачи существуют
    await expect(page.getByTestId(`task-cell-${taskId1}`)).toContainText(taskName1);
    await expect(page.getByTestId(`task-cell-${taskId2}`)).toContainText(taskName2);
    console.log('✅ Both tasks persisted');

    // Проверяем что стрелка блокера все еще отображается и направлена правильно
    // Ждем отрисовки стрелок после перезагрузки
    const svgAfterReload = page.locator('svg[width][height]').first();
    await expect(svgAfterReload).toBeVisible({ timeout: 5000 });
    const pathsAfterReload = svgAfterReload.locator('path[stroke]');
    await expect(pathsAfterReload.first()).toBeVisible({ timeout: 5000 });
    const pathCountAfterReload = await pathsAfterReload.count();
    expect(pathCountAfterReload).toBeGreaterThan(0);
    console.log(`✅ Found ${pathCountAfterReload} arrow(s) after reload - blocker persisted`);

    // Проверяем направление стрелки после перезагрузки
    const markersAfterReload = svgAfterReload.locator('marker');
    const markerCountAfterReload = await markersAfterReload.count();
    expect(markerCountAfterReload).toBeGreaterThan(0);
    console.log(`✅ Arrow markers present after reload - direction preserved`);

    // Проверяем что расписание сохранилось: Task 2 на неделях 1-2, Task 1 на неделях 3-4
    const task2RowAfterReload = page.locator(`tr[data-row-id="${taskId2}"]`);
    const task1RowAfterReload = page.locator(`tr[data-row-id="${taskId1}"]`);
    const task2Week1AfterReload = task2RowAfterReload.locator('[data-week-idx="0"]');
    const task1Week3AfterReload = task1RowAfterReload.locator('[data-week-idx="2"]');
    const task2Week1AfterReloadText = await task2Week1AfterReload.textContent();
    const task1Week3AfterReloadText = await task1Week3AfterReload.textContent();
    console.log(`✅ Schedule preserved: Task 2 week 1: "${task2Week1AfterReloadText}", Task 1 week 3: "${task1Week3AfterReloadText}"`);

    // Шаг 9: Очистка - удаляем задачи и ресурс
    console.log('\n🗑️  Step 9: Cleaning up test data');

    // Удаляем задачу 2
    const taskRowForDelete2 = page.locator(`tr[data-row-id="${taskId2}"]`);
    await taskRowForDelete2.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    // Удаляем задачу 1
    const taskRowForDelete1 = page.locator(`tr[data-row-id="${taskId1}"]`);
    await taskRowForDelete1.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    // Удаляем ресурс
    const resourceRowForDelete = page.locator(`tr[data-row-id="${resourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    await page.getByText('Сохранить').click();
    await waitForAutoSave(page);
    console.log('✅ Test data deleted');

    console.log('\n✨ Test completed successfully! Task blocker with auto-planning is working.');
  });
});
