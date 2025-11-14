import { test, expect } from '@playwright/test';

test.describe('AutoSave Debounce Tests', () => {
  test('should send only one request when making two rapid changes within 1 second', async ({ page }) => {
    // Перехватываем сетевые запросы для анализа
    const apiRequests: Array<{ method: string; body: unknown; timestamp: number }> = [];
    
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
            timestamp: Date.now()
          });
          console.log('PUT request body:', body);
        }
      }
      
      // Продолжаем выполнение запроса
      await route.continue();
    });

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    await page.goto('/?filter_team=E2E');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Проверяем, что таблица загрузилась
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Создаем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();

    await page.waitForTimeout(500);

    // Находим последнюю добавленную задачу
    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);

    const testTaskId = await newTaskRow.getAttribute('data-row-id');
    if (!testTaskId) {
      throw new Error('Task ID not found');
    }
    console.log(`Created task with ID: ${testTaskId}`);

    // Шаг 3: Заполняем название задачи
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const initialTaskName = `E2E Test Task ${Date.now()}`;
    await taskInput.fill(initialTaskName);
    await taskInput.press('Enter');
    await expect(taskInput).not.toBeVisible();
    await expect(taskCell).toContainText(initialTaskName);

    // Ждем автосохранения
    await page.waitForTimeout(2000);

    // Очищаем массив запросов после создания задачи
    apiRequests.length = 0;

    // Шаг 4: Делаем первое изменение
    await taskCell.dblclick();
    const taskInput1 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput1).toBeVisible();

    const timestamp = Date.now();
    const firstChange = `Задача А - первое изменение ${timestamp}`;
    await taskInput1.fill(firstChange);
    await taskInput1.press('Enter');
    await expect(taskInput1).not.toBeVisible();
    await expect(taskCell).toContainText(firstChange);

    console.log('First change completed at:', new Date().toISOString());

    // Шаг 5: Делаем второе изменение сразу (в течение миллисекунд - намного быстрее чем 1 секунда)

    await taskCell.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput2).toBeVisible();

    const secondChange = `Задача А - второе изменение ${timestamp}`;
    await taskInput2.fill(secondChange);
    await taskInput2.press('Enter');
    await expect(taskInput2).not.toBeVisible();
    await expect(taskCell).toContainText(secondChange);

    console.log('Second change completed at:', new Date().toISOString());

    // Шаг 6: Ждем завершения автосохранения (3 секунды)
    await page.waitForTimeout(3000);

    console.log('Total API requests made:', apiRequests.length);
    console.log('API requests:', apiRequests.map(req => ({
      method: req.method,
      timestamp: new Date(req.timestamp).toISOString(),
      body: req.body
    })));

    // Проверяем, что был отправлен только один PUT запрос
    expect(apiRequests.length).toBe(1);

    // Проверяем, что в запросе содержится последнее изменение
    const requestBody = apiRequests[0].body as any;
    expect(requestBody.tasks).toBeDefined();
    expect(requestBody.tasks.length).toBe(1);
    expect(requestBody.tasks[0].task).toBe(secondChange);

    console.log('✅ Test passed: Only one request was sent with the final change');

    // Удаляем задачу
    const taskRowForDelete = page.locator(`tr[data-row-id="${testTaskId}"]`);
    await taskRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);

    console.log('Task deleted');
  });

  test('should send two requests when making changes with 1+ second interval', async ({ page }) => {
    // Перехватываем сетевые запросы для анализа
    const apiRequests: Array<{ method: string; body: unknown; timestamp: number }> = [];
    
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
            timestamp: Date.now()
          });
          console.log('PUT request body:', body);
        }
      }
      
      // Продолжаем выполнение запроса
      await route.continue();
    });

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    await page.goto('/?filter_team=E2E');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Создаем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();

    await page.waitForTimeout(500);

    // Находим последнюю добавленную задачу
    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);

    const testTaskId = await newTaskRow.getAttribute('data-row-id');
    if (!testTaskId) {
      throw new Error('Task ID not found');
    }
    console.log(`Created task with ID: ${testTaskId}`);

    // Шаг 3: Заполняем название задачи
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const initialTaskName = `E2E Test Task ${Date.now()}`;
    await taskInput.fill(initialTaskName);
    await taskInput.press('Enter');
    await expect(taskInput).not.toBeVisible();
    await expect(taskCell).toContainText(initialTaskName);

    // Ждем автосохранения
    await page.waitForTimeout(2000);

    // Очищаем массив запросов после создания задачи
    apiRequests.length = 0;

    // Шаг 4: Делаем первое изменение
    await taskCell.dblclick();
    const taskInput1 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput1).toBeVisible();

    const timestamp = Date.now();
    const firstChange = `Задача А - первое изменение ${timestamp}`;
    await taskInput1.fill(firstChange);
    await taskInput1.press('Enter');
    await expect(taskInput1).not.toBeVisible();

    console.log('First change completed at:', new Date().toISOString());

    // Шаг 5: Ждем завершения первого автосохранения (3 секунды)
    await page.waitForTimeout(3000);

    // Шаг 6: Делаем второе изменение
    await taskCell.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput2).toBeVisible();

    const secondChange = `Задача А - второе изменение ${timestamp}`;
    await taskInput2.fill(secondChange);
    await taskInput2.press('Enter');
    await expect(taskInput2).not.toBeVisible();

    console.log('Second change completed at:', new Date().toISOString());

    // Шаг 7: Ждем завершения второго автосохранения (3 секунды)
    await page.waitForTimeout(3000);

    console.log('Total API requests made:', apiRequests.length);
    console.log('API requests:', apiRequests.map(req => ({
      method: req.method,
      timestamp: new Date(req.timestamp).toISOString(),
      body: req.body
    })));

    // Проверяем, что было отправлено два PUT запроса
    expect(apiRequests.length).toBe(2);

    // Проверяем содержимое запросов
    const firstRequest = apiRequests[0].body as any;
    const secondRequest = apiRequests[1].body as any;

    expect(firstRequest.tasks).toBeDefined();
    expect(firstRequest.tasks.length).toBe(1);
    expect(firstRequest.tasks[0].task).toBe(firstChange);

    expect(secondRequest.tasks).toBeDefined();
    expect(secondRequest.tasks.length).toBe(1);
    expect(secondRequest.tasks[0].task).toBe(secondChange);

    console.log('✅ Test passed: Two separate requests were sent for each change');

    // Удаляем задачу
    const taskRowForDelete = page.locator(`tr[data-row-id="${testTaskId}"]`);
    await taskRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);

    console.log('Task deleted');
  });
});
