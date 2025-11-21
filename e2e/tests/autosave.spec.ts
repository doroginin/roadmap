import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

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
    await waitForAutoSave(page);

    // Шаг 4: Редактируем название задачи
    await taskCell.dblclick();
    const taskInput2 = page.getByTestId(`task-input-${testTaskId}`);
    await expect(taskInput2).toBeVisible();

    const newTaskName = `Задача А - обновлено ${Date.now()}`;
    await taskInput2.fill(newTaskName);
    await taskInput2.press('Enter');

    await expect(taskInput2).not.toBeVisible();
    await expect(taskCell).toContainText(newTaskName);

    // Ждем автосохранения
    await waitForAutoSave(page);

    console.log('Data saved successfully');

    // Шаг 5: Обновляем страницу с фильтром E2E
    await page.goto('/?filter_team=E2E');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Шаг 6: Убеждаемся что данные сохранились
    const updatedTaskCell = page.getByTestId(`task-cell-${testTaskId}`);
    await expect(updatedTaskCell).toBeVisible({ timeout: 5000 });

    // Проверяем, что название сохранилось
    await expect(updatedTaskCell).toContainText(newTaskName);

    console.log('Test passed: data persisted after reload');

    // Шаг 7: Удаляем задачу
    const taskRowForDelete = page.locator(`tr[data-row-id="${testTaskId}"]`);
    await taskRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();

    console.log('Task deleted');
  });
});
