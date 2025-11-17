import { test, expect } from '@playwright/test';

test.describe('Data Optimization Tests', () => {
  test('should send only changed task data to API', async ({ page }) => {
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

    // Очищаем массив запросов после загрузки
    apiRequests.length = 0;

    // Шаг 2: Создаем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();


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

    // Сохраняем изменения
    await page.getByText('Сохранить').click();

    // Очищаем массив запросов перед редактированием
    apiRequests.length = 0;

    // Редактируем название задачи
    await taskCell.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput2).toBeVisible();

    const newTaskName = `Задача А - оптимизация ${Date.now()}`;
    await taskInput2.fill(newTaskName);
    await taskInput2.press('Enter');

    await expect(taskInput2).not.toBeVisible();
    await expect(taskCell).toContainText(newTaskName);

    // Шаг 4: Сохраняем данные вручную
    await page.getByTestId('manual-save-button').click();
    
    // Ждем немного для завершения сохранения
    await page.waitForTimeout(1000);

    // Проверяем, что был отправлен PUT запрос
    expect(apiRequests.length).toBeGreaterThanOrEqual(1);

    const putRequest = apiRequests[0];
    console.log('PUT request body:', JSON.stringify(putRequest.body, null, 2));

    // Шаг 5: Проверяем структуру отправленных данных
    const requestBody = putRequest.body;
    
    // Должны быть только поля version, userId и tasks
    expect(requestBody).toHaveProperty('version');
    expect(requestBody).toHaveProperty('userId');
    expect(requestBody).toHaveProperty('tasks');
    
    // НЕ должно быть других полей с данными
    expect(requestBody).not.toHaveProperty('teams');
    expect(requestBody).not.toHaveProperty('sprints');
    expect(requestBody).not.toHaveProperty('functions');
    expect(requestBody).not.toHaveProperty('employees');
    expect(requestBody).not.toHaveProperty('resources');

    // Шаг 6: Проверяем содержимое tasks
    expect(Array.isArray(requestBody.tasks)).toBe(true);
    expect(requestBody.tasks).toHaveLength(1);
    
    const updatedTask = requestBody.tasks[0];
    expect(updatedTask).toHaveProperty('id', testTaskId);
    expect(updatedTask).toHaveProperty('task', newTaskName);
    
    console.log('✅ Test passed: Only changed task data was sent to API');

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

  test('should send only changed resource data to API', async ({ page }) => {
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
        }
      }
      
      await route.continue();
    });

    // Открываем страницу с фильтром по команде E2E
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Очищаем массив запросов
    apiRequests.length = 0;

    // Создаем новый ресурс
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addResourceButton = page.getByTestId('add-resource-button');
    await expect(addResourceButton).toBeVisible();
    await addResourceButton.click();


    // Находим последний добавленный ресурс
    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);

    const testResourceId = await newResourceRow.getAttribute('data-row-id');
    if (!testResourceId) {
      throw new Error('Resource ID not found');
    }
    console.log(`Created resource with ID: ${testResourceId}`);

    // Заполняем название ресурса
    const resourceCell = page.getByTestId(`fn-cell-${testResourceId}`);
    await resourceCell.dblclick();
    const resourceInput = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput).toBeVisible();

    const initialResourceName = `E2E Test Resource ${Date.now()}`;
    await resourceInput.fill(initialResourceName);
    await resourceInput.press('Enter');
    await expect(resourceInput).not.toBeVisible();
    await expect(resourceCell).toContainText(initialResourceName);

    // Сохраняем изменения
    await page.getByText('Сохранить').click();

    // Очищаем массив запросов перед редактированием
    apiRequests.length = 0;

    // Редактируем название ресурса
    await resourceCell.dblclick();
    const resourceInput2 = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput2).toBeVisible();

    const newResourceName = `Ресурс - оптимизация ${Date.now()}`;
    await resourceInput2.fill(newResourceName);
    await resourceInput2.press('Enter');

    await expect(resourceInput2).not.toBeVisible();
    await expect(resourceCell).toContainText(newResourceName);

    // Сохраняем данные вручную
    await page.getByTestId('manual-save-button').click();
    
    // Ждем немного для завершения сохранения
    await page.waitForTimeout(1000);

    // Проверяем, что был отправлен PUT запрос
    expect(apiRequests.length).toBeGreaterThanOrEqual(1);

    const putRequest = apiRequests[0];
    const requestBody = putRequest.body;

    // Должны быть только version, userId и resources
    expect(requestBody).toHaveProperty('version');
    expect(requestBody).toHaveProperty('userId');
    expect(requestBody).toHaveProperty('resources');
    
    // НЕ должно быть других полей
    expect(requestBody).not.toHaveProperty('tasks');
    expect(requestBody).not.toHaveProperty('teams');
    expect(requestBody).not.toHaveProperty('sprints');
    expect(requestBody).not.toHaveProperty('functions');
    expect(requestBody).not.toHaveProperty('employees');

    // Проверяем содержимое resources
    expect(Array.isArray(requestBody.resources)).toBe(true);
    expect(requestBody.resources).toHaveLength(1);
    
    const updatedResource = requestBody.resources[0];
    expect(updatedResource).toHaveProperty('id', testResourceId);
    
    console.log('✅ Test passed: Only changed resource data was sent to API');

    // Удаляем ресурс
    const resourceRowForDelete = page.locator(`tr[data-row-id="${testResourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);

    console.log('Resource deleted');
  });

  test('should send multiple changes in single request', async ({ page }) => {
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
        }
      }
      
      await route.continue();
    });

    // Открываем страницу с фильтром по команде E2E
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Очищаем массив запросов
    apiRequests.length = 0;

    // Создаем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();


    // Находим последнюю добавленную задачу
    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);

    const testTaskId = await newTaskRow.getAttribute('data-row-id');
    if (!testTaskId) {
      throw new Error('Task ID not found');
    }
    console.log(`Created task with ID: ${testTaskId}`);

    // Заполняем название задачи
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

    // Создаем новый ресурс
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addResourceButton = page.getByTestId('add-resource-button');
    await expect(addResourceButton).toBeVisible();
    await addResourceButton.click();


    // Находим последний добавленный ресурс
    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);

    const testResourceId = await newResourceRow.getAttribute('data-row-id');
    if (!testResourceId) {
      throw new Error('Resource ID not found');
    }
    console.log(`Created resource with ID: ${testResourceId}`);

    // Заполняем название ресурса
    const resourceCell = page.getByTestId(`fn-cell-${testResourceId}`);
    await resourceCell.dblclick();
    const resourceInput = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput).toBeVisible();

    const initialResourceName = `E2E Test Resource ${Date.now()}`;
    await resourceInput.fill(initialResourceName);
    await resourceInput.press('Enter');
    await expect(resourceInput).not.toBeVisible();
    await expect(resourceCell).toContainText(initialResourceName);

    // Сохраняем изменения
    await page.getByText('Сохранить').click();

    // Очищаем массив запросов перед редактированием
    apiRequests.length = 0;

    // Редактируем задачу
    await taskCell.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput2).toBeVisible();

    const newTaskName = `Задача - множественные изменения ${Date.now()}`;
    await taskInput2.fill(newTaskName);
    await taskInput2.press('Enter');

    // Сразу редактируем ресурс (в пределах 2 секунд)
    await resourceCell.dblclick();
    const resourceInput2 = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput2).toBeVisible();

    const newResourceName = `Ресурс - множественные изменения ${Date.now()}`;
    await resourceInput2.fill(newResourceName);
    await resourceInput2.press('Enter');

    // Ждем немного для обработки изменений

    // Сохраняем данные вручную
    await page.getByTestId('manual-save-button').click();
    
    // Ждем немного для завершения сохранения
    await page.waitForTimeout(2000);

    // Проверяем, что был отправлен PUT запрос
    expect(apiRequests.length).toBeGreaterThanOrEqual(1);

    const putRequest = apiRequests[0];
    const requestBody = putRequest.body;

    // Должны быть и tasks, и resources
    expect(requestBody).toHaveProperty('tasks');
    expect(requestBody).toHaveProperty('resources');
    
    // Проверяем содержимое
    expect(Array.isArray(requestBody.tasks)).toBe(true);
    expect(Array.isArray(requestBody.resources)).toBe(true);
    
    const updatedTask = requestBody.tasks.find((t: { id: string }) => t.id === testTaskId);
    const updatedResource = requestBody.resources.find((r: { id: string }) => r.id === testResourceId);
    
    expect(updatedTask).toBeDefined();
    expect(updatedResource).toBeDefined();
    expect(updatedTask.task).toBe(newTaskName);
    
    console.log('✅ Test passed: Multiple changes sent in single optimized request');

    // Удаляем задачу
    const taskRowForDelete = page.locator(`tr[data-row-id="${testTaskId}"]`);
    await taskRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);

    // Удаляем ресурс
    const resourceRowForDelete = page.locator(`tr[data-row-id="${testResourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });

    await expect(contextMenu).toBeVisible();

    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);

    console.log('Task and resource deleted');
  });
});
