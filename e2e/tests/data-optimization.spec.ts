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

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Проверяем, что таблица загрузилась
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Очищаем массив запросов после загрузки
    apiRequests.length = 0;

    // Шаг 2: Включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();
    await expect(page.getByTestId('filter-popup')).not.toBeVisible();

    // Шаг 3: Редактируем название первой задачи
    const testTaskId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(taskCell).toBeVisible({ timeout: 5000 });

    const originalTaskName = await taskCell.textContent();
    console.log('Original task name:', originalTaskName);

    // Редактируем название задачи
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const newTaskName = `Задача А - оптимизация ${Date.now()}`;
    await taskInput.fill(newTaskName);
    await taskInput.press('Enter');

    await expect(taskInput).not.toBeVisible();
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

    // Открываем страницу
    await page.goto('/');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Очищаем массив запросов
    apiRequests.length = 0;

    // Включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();

    // Находим первую строку ресурса (используем существующий ресурс)
    const testResourceId = 'dddddddd-0000-0000-0000-000000000002';
    const resourceCell = page.getByTestId(`resource-cell-${testResourceId}`);
    await expect(resourceCell).toBeVisible({ timeout: 5000 });

    // Редактируем название ресурса
    await resourceCell.dblclick();
    const resourceInput = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput).toBeVisible();

    const newResourceName = `Ресурс - оптимизация ${Date.now()}`;
    await resourceInput.fill(newResourceName);
    await resourceInput.press('Enter');

    await expect(resourceInput).not.toBeVisible();
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

    // Открываем страницу
    await page.goto('/');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Очищаем массив запросов
    apiRequests.length = 0;

    // Включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();

    // Редактируем задачу
    const testTaskId = 'bbbbbbbb-0000-0000-0000-000000000002';
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(taskCell).toBeVisible({ timeout: 5000 });

    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const newTaskName = `Задача - множественные изменения ${Date.now()}`;
    await taskInput.fill(newTaskName);
    await taskInput.press('Enter');

    // Сразу редактируем ресурс (в пределах 2 секунд)
    const testResourceId = 'dddddddd-0000-0000-0000-000000000002';
    const resourceCell = page.getByTestId(`resource-cell-${testResourceId}`);
    await expect(resourceCell).toBeVisible({ timeout: 5000 });

    await resourceCell.dblclick();
    const resourceInput = page.getByTestId(`resource-input-${testResourceId}`);
    await expect(resourceInput).toBeVisible();

    const newResourceName = `Ресурс - множественные изменения ${Date.now()}`;
    await resourceInput.fill(newResourceName);
    await resourceInput.press('Enter');

    // Сохраняем данные вручную
    await page.getByTestId('manual-save-button').click();
    
    // Ждем немного для завершения сохранения
    await page.waitForTimeout(1000);

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
  });
});
