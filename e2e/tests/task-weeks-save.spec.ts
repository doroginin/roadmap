import { test, expect } from '@playwright/test';

test.describe('Task Weeks Save functionality', () => {
  test('should create task, save weeks plan, reload page, verify data, and delete task', async ({ page }) => {
    // Перехватываем сетевые запросы для анализа
    const apiRequests: Array<{ method: string; body: unknown; timestamp: string }> = [];

    await page.route('**/api/v1/data', async (route) => {
      const request = route.request();
      const method = request.method();

      if (method === 'PUT') {
        const requestBody = request.postData();
        if (requestBody) {
          const body = JSON.parse(requestBody);
          apiRequests.push({
            method,
            body,
            timestamp: new Date().toISOString()
          });
          console.log('PUT request body:', JSON.stringify(body, null, 2));
        }
      }

      // Продолжаем выполнение запроса
      await route.continue();
    });

    // Шаг 1: Открываем страницу
    console.log('\n📖 Step 1: Opening page with E2E filter');
    await page.goto('/?filter_team=E2E');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded');

    // Шаг 3: Создаем новую задачу
    console.log('\n➕ Step 3: Creating new task');

    // Находим кнопку "Добавить" и открываем меню
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Ждем появления меню
    await expect(page.getByTestId('add-menu')).toBeVisible();

    // Кликаем на "Задача"
    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();

    // Находим последнюю добавленную задачу (она должна быть в конце таблицы)
    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);

    // Получаем ID новой задачи
    const newTaskId = await newTaskRow.getAttribute('data-row-id');
    console.log(`New task ID: ${newTaskId}`);

    // Шаг 4: Заполняем поля новой задачи
    console.log('\n📝 Step 4: Filling task fields');

    const timestamp = Date.now();
    const taskName = `E2E Test Task ${timestamp}`;

    // Вводим название задачи
    const taskCell = page.getByTestId(`task-cell-${newTaskId}`);
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${newTaskId}`);
    await expect(taskInput).toBeVisible();
    await taskInput.fill(taskName);
    await taskInput.press('Enter');
    console.log(`Task name set: ${taskName}`);

    // Устанавливаем planEmpl = 2
    const planEmplCell = page.getByTestId(`planEmpl-cell-${newTaskId}`);
    await planEmplCell.dblclick();
    const planEmplInput = page.getByTestId(`planEmpl-input-${newTaskId}`);
    await expect(planEmplInput).toBeVisible();
    await planEmplInput.fill('2');
    await planEmplInput.press('Enter');
    console.log('planEmpl set: 2');

    // Устанавливаем planWeeks = 3
    const planWeeksCell = page.getByTestId(`planWeeks-cell-${newTaskId}`);
    await planWeeksCell.dblclick();
    const planWeeksInput = page.getByTestId(`planWeeks-input-${newTaskId}`);
    await expect(planWeeksInput).toBeVisible();
    await planWeeksInput.fill('3');
    await planWeeksInput.press('Enter');
    console.log('planWeeks set: 3');

    // Шаг 6: Заполняем план по неделям (weeks)
    console.log('\n📅 Step 5: Setting weeks plan manually');

    // Находим ячейки недель для новой задачи
    // Устанавливаем значения для недель 1, 2, 3
    const weekValues = [1, 2, 1]; // week 1: 1 person, week 2: 2 people, week 3: 1 person

    for (let weekIndex = 0; weekIndex < weekValues.length; weekIndex++) {
      const weekCell = page.locator(`[data-row-id="${newTaskId}"][data-week-idx="${weekIndex}"]`);
      await weekCell.dblclick();

      // Находим input в ячейке
      const weekInput = weekCell.locator('input[type="number"]');
      await expect(weekInput).toBeVisible();
      await weekInput.fill(String(weekValues[weekIndex]));
      await weekInput.press('Enter');

      console.log(`Week ${weekIndex + 1} set to: ${weekValues[weekIndex]}`);
    }

    // Шаг 7: Сохраняем
    console.log('\n💾 Step 6: save');
    // Click save button
    const saveButton = page.getByText('Сохранить');
    await saveButton.click();

    // Проверяем, что были отправлены PUT запросы
    const putRequests = apiRequests.filter(req => req.method === 'PUT');
    console.log(`API PUT requests sent: ${putRequests.length}`);
    expect(putRequests.length).toBeGreaterThan(0);

    // Шаг 8: Перезагружаем страницу с фильтром E2E
    console.log('\n🔄 Step 7: Reloading page');
    await page.goto('/?filter_team=E2E');
    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page reloaded');

    // Шаг 10: Проверяем что данные сохранились
    console.log('\n✅ Step 9: Verifying saved data');

    // Проверяем название задачи
    const savedTaskCell = page.getByTestId(`task-cell-${newTaskId}`);
    await expect(savedTaskCell).toBeVisible({ timeout: 5000 });
    await expect(savedTaskCell).toContainText(taskName);
    console.log(`✅ Task name persisted: ${taskName}`);

    // Проверяем planEmpl
    const savedPlanEmplCell = page.getByTestId(`planEmpl-cell-${newTaskId}`);
    await expect(savedPlanEmplCell).toContainText('2');
    console.log('✅ planEmpl persisted: 2');

    // Проверяем planWeeks
    const savedPlanWeeksCell = page.getByTestId(`planWeeks-cell-${newTaskId}`);
    await expect(savedPlanWeeksCell).toContainText('3');
    console.log('✅ planWeeks persisted: 3');

    // Проверяем значения по неделям
    for (let weekIndex = 0; weekIndex < weekValues.length; weekIndex++) {
      const weekCell = page.locator(`[data-row-id="${newTaskId}"][data-week-idx="${weekIndex}"]`);
      await expect(weekCell).toBeVisible();

      // Получаем текст ячейки и проверяем значение
      const weekText = await weekCell.textContent();
      const expectedValue = String(weekValues[weekIndex]);
      expect(weekText?.trim()).toBe(expectedValue);
      console.log(`✅ Week ${weekIndex + 1} persisted: ${expectedValue}`);
    }

    // Шаг 11: Удаляем задачу
    console.log('\n🗑️ Step 10: Deleting task');

    // Находим строку задачи и кликаем правой кнопкой для контекстного меню
    const taskRowForDelete = page.locator(`tr[data-row-id="${newTaskId}"]`);
    await taskRowForDelete.click({ button: 'right' });

    // Ждем появления контекстного меню
    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    // Кликаем на "Delete Row"
    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    // Click save button
    await page.getByText('Сохранить').click();

    // Шаг 12: Перезагружаем страницу с фильтром E2E и проверяем что задача удалена
    console.log('\n🔄 Step 11: Verifying deletion');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Проверяем что задача не существует
    const deletedTaskCell = page.getByTestId(`task-cell-${newTaskId}`);
    await expect(deletedTaskCell).not.toBeVisible();
    console.log('✅ Task deletion persisted');

    console.log('\n✅✅✅ Test passed: Task weeks plan saved and persisted correctly!');
  });
});
