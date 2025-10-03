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

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Проверяем, что таблица загрузилась
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();
    await expect(page.getByTestId('filter-popup')).not.toBeVisible();

    // Шаг 3: Находим тестовую задачу
    const testTaskId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(taskCell).toBeVisible({ timeout: 5000 });

    // Получаем исходное название задачи
    const originalTaskName = await taskCell.textContent();
    console.log('Original task name:', originalTaskName);

    // Шаг 4: Делаем первое изменение
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const timestamp = Date.now();
    const firstChange = `Задача А - первое изменение ${timestamp}`;
    await taskInput.fill(firstChange);
    await taskInput.press('Enter');
    await expect(taskInput).not.toBeVisible();
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

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();
    await expect(page.getByTestId('filter-popup')).not.toBeVisible();

    // Шаг 3: Находим тестовую задачу
    const testTaskId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(taskCell).toBeVisible({ timeout: 5000 });

    // Шаг 4: Делаем первое изменение
    await taskCell.dblclick();
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    const timestamp = Date.now();
    const firstChange = `Задача А - первое изменение ${timestamp}`;
    await taskInput.fill(firstChange);
    await taskInput.press('Enter');
    await expect(taskInput).not.toBeVisible();

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
  });
});
