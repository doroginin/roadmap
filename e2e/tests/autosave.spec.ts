import { test, expect } from '@playwright/test';

test.describe('Save functionality', () => {
  test('should save task name changes automatically', async ({ page }) => {
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

    // Ждем появления popup фильтра
    await expect(page.getByTestId('filter-popup')).toBeVisible();

    // Выбираем только "Demo"
    await page.getByTestId('filter-checkbox-Demo').click();

    // Закрываем фильтр
    await page.getByTestId('filter-ok-button').click();

    // Ждем, пока фильтр применится
    await expect(page.getByTestId('filter-popup')).not.toBeVisible();

    // Шаг 3: Находим первую задачу команды Demo
    // Ищем строку с data-row-id содержащую нашу тестовую задачу
    const testTaskId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const taskCell = page.getByTestId(`task-cell-${testTaskId}`);

    // Проверяем, что задача видна
    await expect(taskCell).toBeVisible({ timeout: 5000 });

    // Получаем исходное название задачи
    const originalTaskName = await taskCell.textContent();
    console.log('Original task name:', originalTaskName);

    // Шаг 4: Редактируем название задачи
    await taskCell.dblclick();

    // Ждем появления инпута
    const taskInput = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput).toBeVisible();

    // Очищаем поле и вводим новое название
    const newTaskName = `Задача А - обновлено ${Date.now()}`;
    await taskInput.fill(newTaskName);

    // Нажимаем Enter для сохранения
    await taskInput.press('Enter');

    // Проверяем, что инпут исчез
    await expect(taskInput).not.toBeVisible();

    // Проверяем, что название обновилось в ячейке
    await expect(taskCell).toContainText(newTaskName);

    // Ждем больше времени для завершения сохранения
    await page.waitForTimeout(5000);

    console.log('Data saved successfully');

    // Шаг 6: Обновляем страницу
    await page.reload();

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    
    // Дополнительная задержка для полной загрузки данных
    await page.waitForTimeout(2000);

    // Шаг 7: Снова включаем фильтр по команде "Demo"
    await page.getByTestId('filter-team-button').click();
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    await page.getByTestId('filter-checkbox-Demo').click();
    await page.getByTestId('filter-ok-button').click();
    await expect(page.getByTestId('filter-popup')).not.toBeVisible();

    // Шаг 8: Убеждаемся что данные сохранились
    const updatedTaskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(updatedTaskCell).toBeVisible({ timeout: 5000 });

    // Проверяем, что название сохранилось
    await expect(updatedTaskCell).toContainText(newTaskName);

    console.log('Test passed: data persisted after reload');
  });
});
