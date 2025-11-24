import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Tasks reordering functionality', () => {
  test('should create three tasks, reorder them, save, and verify order persists after reload', async ({ page }) => {
    // Generate unique names for this test
    const randomFn = `FN${Math.floor(Math.random() * 10000)}`;
    const task1 = `Test Task A ${Date.now()}`;
    const task2 = `Test Task B ${Date.now()}`;
    const task3 = `Test Task C ${Date.now()}`;

    console.log(`\n🎲 Using function: ${randomFn}`);
    console.log(`📝 Creating tasks: "${task1}", "${task2}", "${task3}"`);

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    console.log('\n📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter');

    // Шаг 2: Создаем ресурс для задач
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

    // Шаг 3: Создаем три задачи
    console.log('\n➕ Step 3: Creating three tasks');
    const taskIds: string[] = [];
    const taskNames = [task1, task2, task3];

    for (let i = 0; i < 3; i++) {
      await addButton.click();
      await expect(page.getByTestId('add-menu')).toBeVisible();
      await page.getByTestId('add-task-button').click();

      const taskRows = page.locator('[data-row-kind="task"]');
      const taskCount = await taskRows.count();
      const newTaskRow = taskRows.nth(taskCount - 1);
      const taskId = await newTaskRow.getAttribute('data-row-id');
      if (!taskId) throw new Error(`Task ${i + 1} ID not found`);

      taskIds.push(taskId);
      console.log(`Created task ${i + 1} with ID: ${taskId}`);

      // Заполняем название задачи
      const taskCell = page.getByTestId(`task-cell-${taskId}`);
      await taskCell.scrollIntoViewIfNeeded();
      await expect(taskCell).toBeVisible();
      await taskCell.dblclick();
      const taskInput = page.getByTestId(`task-input-${taskId}`);
      await expect(taskInput).toBeVisible();
      await taskInput.fill(taskNames[i]);
      await taskInput.press('Enter');
      console.log(`✅ Task ${i + 1} name set: ${taskNames[i]}`);

      // Устанавливаем функцию задачи
      const taskFnCell = page.getByTestId(`fn-cell-${taskId}`);
      await taskFnCell.dblclick();
      const selectOption = page.getByTestId(`select-option-${randomFn}`);
      await expect(selectOption).toBeVisible({ timeout: 5000 });
      await selectOption.click();
      console.log(`✅ Task ${i + 1} function set: ${randomFn}`);

      // Устанавливаем plan: planEmpl = 1, planWeeks = 1
      const planEmplCell = page.getByTestId(`planEmpl-cell-${taskId}`);
      await planEmplCell.dblclick();
      const planEmplInput = page.getByTestId(`planEmpl-input-${taskId}`);
      await expect(planEmplInput).toBeVisible();
      await planEmplInput.fill('1');
      await planEmplInput.press('Enter');
      console.log(`✅ Task ${i + 1} planEmpl set: 1`);

      const planWeeksCell = page.getByTestId(`planWeeks-cell-${taskId}`);
      await planWeeksCell.dblclick();
      const planWeeksInput = page.getByTestId(`planWeeks-input-${taskId}`);
      await expect(planWeeksInput).toBeVisible();
      await planWeeksInput.fill('1');
      await planWeeksInput.press('Enter');
      console.log(`✅ Task ${i + 1} planWeeks set: 1`);
    }

    // Шаг 4: Сохраняем изменения
    console.log('\n💾 Step 4: Saving initial tasks');
    const saveButton = page.getByText('Сохранить');
    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Tasks saved');

    // Шаг 5: Проверяем начальный порядок (должен быть task1, task2, task3)
    console.log('\n📊 Step 5: Verifying initial order');
    let taskRows = page.locator('[data-row-kind="task"]');

    // Находим индексы наших задач
    const getTaskIndices = async () => {
      const count = await taskRows.count();
      const indices: { [key: string]: number } = {};

      for (let i = 0; i < count; i++) {
        const row = taskRows.nth(i);
        const rowId = await row.getAttribute('data-row-id');
        if (rowId && taskIds.includes(rowId)) {
          const idx = taskIds.indexOf(rowId);
          indices[taskNames[idx]] = i;
        }
      }
      return indices;
    };

    let indices = await getTaskIndices();
    console.log(`Initial order indices: ${task1}=${indices[task1]}, ${task2}=${indices[task2]}, ${task3}=${indices[task3]}`);

    // Проверяем что порядок правильный (task1 < task2 < task3)
    expect(indices[task1]).toBeLessThan(indices[task2]);
    expect(indices[task2]).toBeLessThan(indices[task3]);
    console.log('✅ Initial order is correct');

    // Шаг 6: Перемещаем задачи (меняем порядок на task3, task1, task2)
    console.log('\n🔄 Step 6: Reordering tasks (moving last to first)');

    // Перемещаем task3 (последняя) на место task1 (первая)
    const task3Row = page.locator(`tr[data-row-id="${taskIds[2]}"]`);
    const task1Row = page.locator(`tr[data-row-id="${taskIds[0]}"]`);

    const draggableCell3 = task3Row.locator('.draggable-cell').first();
    const draggableCell1 = task1Row.locator('.draggable-cell').first();

    await draggableCell3.scrollIntoViewIfNeeded();
    await expect(draggableCell3).toBeVisible();
    await draggableCell1.scrollIntoViewIfNeeded();
    await expect(draggableCell1).toBeVisible();

    // Выполняем drag and drop
    const cell3Box = await draggableCell3.boundingBox();
    const cell1Box = await draggableCell1.boundingBox();
    if (!cell3Box || !cell1Box) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(cell3Box.x + cell3Box.width / 2, cell3Box.y + cell3Box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cell1Box.x + cell1Box.width / 2, cell1Box.y + cell1Box.height / 2 - 5, { steps: 10 });
    await page.mouse.up();

    console.log(`✅ Dragged ${task3} to the top`);

    // Ждем немного чтобы UI обновился
    await page.waitForTimeout(500);

    // Проверяем новый порядок в UI
    indices = await getTaskIndices();
    console.log(`New order indices: ${task1}=${indices[task1]}, ${task2}=${indices[task2]}, ${task3}=${indices[task3]}`);

    // Теперь порядок должен быть task3 < task1 < task2
    expect(indices[task3]).toBeLessThan(indices[task1]);
    expect(indices[task1]).toBeLessThan(indices[task2]);
    console.log('✅ Order changed in UI');

    // Шаг 7: Сохраняем изменения
    console.log('\n💾 Step 7: Saving reordered tasks');
    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Changes saved');

    // Шаг 8: Обновляем страницу
    console.log('\n🔄 Step 8: Reloading page to verify order persistence');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page reloaded');

    // Шаг 9: Проверяем что порядок сохранился (должен быть task3, task1, task2)
    console.log('\n📊 Step 9: Verifying order persisted after reload');

    // Проверяем что все задачи существуют
    await expect(page.getByTestId(`task-cell-${taskIds[0]}`)).toContainText(task1);
    await expect(page.getByTestId(`task-cell-${taskIds[1]}`)).toContainText(task2);
    await expect(page.getByTestId(`task-cell-${taskIds[2]}`)).toContainText(task3);
    console.log('✅ All three tasks persisted');

    taskRows = page.locator('[data-row-kind="task"]');
    indices = await getTaskIndices();
    console.log(`Order after reload: ${task1}=${indices[task1]}, ${task2}=${indices[task2]}, ${task3}=${indices[task3]}`);

    // Порядок должен остаться task3 < task1 < task2
    expect(indices[task3]).toBeLessThan(indices[task1]);
    expect(indices[task1]).toBeLessThan(indices[task2]);
    console.log('✅ Order persisted correctly after page reload!');

    // Шаг 10: Очистка - удаляем задачи и ресурс
    console.log('\n🗑️  Step 10: Cleaning up test data');

    for (let i = 0; i < taskIds.length; i++) {
      const taskRow = page.locator(`tr[data-row-id="${taskIds[i]}"]`);
      await taskRow.scrollIntoViewIfNeeded();
      await taskRow.click({ button: 'right' });
      await page.getByTestId('context-menu-delete').click();
    }

    // Удаляем ресурс
    const resourceRowForDelete = page.locator(`tr[data-row-id="${resourceId}"]`);
    await resourceRowForDelete.scrollIntoViewIfNeeded();
    await resourceRowForDelete.click({ button: 'right' });
    await page.getByTestId('context-menu-delete').click();

    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Test data deleted');

    console.log('\n✨ Test completed successfully! Task reordering is working and persists after reload.');
  });
});
