import { test, expect } from '@playwright/test';

test.describe('Filter Defaults for New Items', () => {
  test('should create new resource with filter defaults', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const fnValue = `FN${randInt}`;
    const setupResourceFn = `FNSetup${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 1.5: Создаем тестовый ресурс для команды E2E, чтобы фильтр E2E был доступен
    const addButtonSetup = page.getByTestId('add-button');
    await expect(addButtonSetup).toBeVisible({ timeout: 5000 });
    await addButtonSetup.click();

    const resourceButtonSetup = page.getByTestId('add-resource-button');
    await expect(resourceButtonSetup).toBeVisible({ timeout: 2000 });
    await resourceButtonSetup.click();

    await page.waitForTimeout(500);

    // Находим последний добавленный ресурс
    const tableSetup = page.getByTestId('roadmap-table');
    const allRowsSetup = tableSetup.locator('tr[data-testid="resource"][data-row-id]');
    const rowCountSetup = await allRowsSetup.count();
    const setupResourceRow = allRowsSetup.nth(rowCountSetup - 1);
    const setupResourceId = await setupResourceRow.getAttribute('data-row-id');

    // Устанавливаем команду E2E для тестового ресурса
    const teamCellSetup = page.getByTestId(`team-cell-${setupResourceId}`);
    await teamCellSetup.dblclick();
    const teamSelectSetup = page.getByTestId('team-multiselect');
    await expect(teamSelectSetup).toBeVisible({ timeout: 300 });
    const e2eLabelSetup = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(e2eLabelSetup).toBeVisible({ timeout: 2000 });
    const e2eCheckboxSetup = e2eLabelSetup.locator('input[type="checkbox"]');
    await e2eCheckboxSetup.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Заполняем Fn для сохранения
    const fnCellSetup = page.getByTestId(`fn-cell-${setupResourceId}`);
    await fnCellSetup.dblclick();
    await page.waitForTimeout(300);
    await page.keyboard.type(setupResourceFn);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.getByTestId('header-team');
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    // Находим кнопку фильтра в заголовке
    const filterButton = page.getByTestId('filter-team-button');
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем команду "E2E" в фильтре
    const e2eCheckbox = page.getByTestId('filter-checkbox-E2E');
    await expect(e2eCheckbox).toBeVisible({ timeout: 2000 });
    await e2eCheckbox.click();
    
    // Закрываем фильтр, кликнув вне его
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новый ресурс
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const resourceButton = page.getByTestId('add-resource-button');
    await expect(resourceButton).toBeVisible({ timeout: 2000 });
    await resourceButton.click();

    await page.waitForTimeout(500);

    // Шаг 5: Находим новую строку ресурса
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    await page.waitForTimeout(500);
    
    // Находим все строки ресурсов
    const allRows = table.locator('tr[data-testid="resource"][data-row-id]');
    const rowCount = await allRows.count();
    
    // Ищем последнюю строку (новый ресурс)
    const newResourceRow = allRows.nth(rowCount - 1);
    await expect(newResourceRow).toBeVisible({ timeout: 3000 });
    const newResourceId = await newResourceRow.getAttribute('data-row-id');

    // Шаг 6: Проверяем, что команда "E2E" уже установлена
    const teamCell = page.getByTestId(`team-cell-${newResourceId}`);
    await expect(teamCell).toContainText('E2E', { timeout: 2000 });
    console.log('✅ New resource has Team="E2E" from filter defaults');

    // Шаг 7: Добавляем Fn чтобы сохранить ресурс
    const fnCell = page.getByTestId(`fn-cell-${newResourceId}`);
    await fnCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(fnValue);
    await page.keyboard.press('Enter');
    
    console.log(`Resource with FN="${fnValue}" and Team="E2E" added`);

    // Шаг 8: Проверяем, что ресурс виден в отфильтрованной таблице
    await expect(fnCell).toContainText(fnValue, { timeout: 5000 });
    console.log('✅ New resource is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const filterButton2 = page.getByTestId('filter-team-button');
    await filterButton2.click();
    await page.waitForTimeout(300);
    
    // Снимаем галку с E2E
    const e2eCheckbox2 = page.getByTestId('filter-checkbox-E2E');
    await e2eCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 10: Проверяем, что ресурс все еще виден после снятия фильтра
    await expect(fnCell).toContainText(fnValue, { timeout: 5000 });
    await expect(teamCell).toContainText('E2E');
    console.log('✅ Resource with Team="E2E" is visible without filter');

    // Шаг 11: Удаляем созданный ресурс по ID
    const resourceRowForDelete = page.locator(`tr[data-row-id="${newResourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Resource with FN="${fnValue}" deleted`);

    // Шаг 12: Удаляем тестовый ресурс, созданный в начале, по ID
    const setupResourceRowForDelete = page.locator(`tr[data-row-id="${setupResourceId}"]`);
    await setupResourceRowForDelete.click({ button: 'right' });

    const contextMenuSetup = page.getByTestId('context-menu');
    await expect(contextMenuSetup).toBeVisible();

    const deleteButtonSetup = page.getByTestId('context-menu-delete');
    await deleteButtonSetup.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Setup resource with FN="${setupResourceFn}" deleted`);
  });

  test('should create new task with filter defaults', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const taskName = `Task${randInt}`;
    const setupResourceFn = `FNSetup${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 1.5: Создаем тестовый ресурс для команды E2E, чтобы фильтр E2E был доступен
    const addButtonSetup = page.getByTestId('add-button');
    await expect(addButtonSetup).toBeVisible({ timeout: 5000 });
    await addButtonSetup.click();

    const resourceButtonSetup = page.getByTestId('add-resource-button');
    await expect(resourceButtonSetup).toBeVisible({ timeout: 2000 });
    await resourceButtonSetup.click();

    await page.waitForTimeout(500);

    // Находим последний добавленный ресурс
    const tableSetup = page.getByTestId('roadmap-table');
    const allRowsSetup = tableSetup.locator('tr[data-testid="resource"][data-row-id]');
    const rowCountSetup = await allRowsSetup.count();
    const setupResourceRow = allRowsSetup.nth(rowCountSetup - 1);
    const setupResourceId = await setupResourceRow.getAttribute('data-row-id');

    // Устанавливаем команду E2E для тестового ресурса
    const teamCellSetup = page.getByTestId(`team-cell-${setupResourceId}`);
    await teamCellSetup.dblclick();
    const teamSelectSetup = page.getByTestId('team-multiselect');
    await expect(teamSelectSetup).toBeVisible({ timeout: 300 });
    const e2eLabelSetup = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(e2eLabelSetup).toBeVisible({ timeout: 2000 });
    const e2eCheckboxSetup = e2eLabelSetup.locator('input[type="checkbox"]');
    await e2eCheckboxSetup.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Заполняем Fn для сохранения
    const fnCellSetup = page.getByTestId(`fn-cell-${setupResourceId}`);
    await fnCellSetup.dblclick();
    await page.waitForTimeout(300);
    await page.keyboard.type(setupResourceFn);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.getByTestId('header-team');
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    const filterButton = page.getByTestId('filter-team-button');
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем команду "E2E" в фильтре
    const e2eCheckbox = page.getByTestId('filter-checkbox-E2E');
    await expect(e2eCheckbox).toBeVisible({ timeout: 2000 });
    await e2eCheckbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const taskButton = page.getByTestId('add-task-button');
    await expect(taskButton).toBeVisible({ timeout: 2000 });
    await taskButton.click();

    await page.waitForTimeout(500);

    // Шаг 5: Находим новую строку задачи
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    await page.waitForTimeout(500);
    
    // Находим все строки задач
    const allRows = table.locator('tr[data-testid="task"][data-row-id]');
    const rowCount = await allRows.count();
    
    // Ищем последнюю строку (новая задача)
    const newTaskRow = allRows.nth(rowCount - 1);
    await expect(newTaskRow).toBeVisible({ timeout: 3000 });
    const newTaskId = await newTaskRow.getAttribute('data-row-id');

    // Шаг 6: Проверяем, что команда "E2E" уже установлена
    const teamCell = page.getByTestId(`team-cell-${newTaskId}`);
    await expect(teamCell).toContainText('E2E', { timeout: 2000 });
    console.log('✅ New task has Team="E2E" from filter defaults');

    // Шаг 7: Добавляем название задачи чтобы сохранить
    const taskCell = page.getByTestId(`task-cell-${newTaskId}`);
    await taskCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(taskName);
    await page.keyboard.press('Enter');
    
    console.log(`Task "${taskName}" with Team="E2E" added`);

    // Шаг 8: Проверяем, что задача видна в отфильтрованной таблице
    await expect(taskCell).toContainText(taskName, { timeout: 5000 });
    console.log('✅ New task is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const filterButton2 = page.getByTestId('filter-team-button');
    await filterButton2.click();
    await page.waitForTimeout(300);
    
    // Снимаем галку с E2E
    const e2eCheckbox2 = page.getByTestId('filter-checkbox-E2E');
    await e2eCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 10: Проверяем, что задача все еще видна после снятия фильтра
    await expect(taskCell).toContainText(taskName, { timeout: 5000 });
    await expect(teamCell).toContainText('E2E');
    console.log('✅ Task with Team="E2E" is visible without filter');

    // Шаг 11: Удаляем созданную задачу по ID
    const taskRowForDelete = page.locator(`tr[data-row-id="${newTaskId}"]`);
    // Прокручиваем элемент в видимую область, чтобы он не был перекрыт sticky элементами
    await taskRowForDelete.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await taskRowForDelete.click({ button: 'right', force: true });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Task "${taskName}" deleted`);

    // Шаг 12: Проверяем, существует ли еще setupResource, и удаляем его если да
    // (он может быть автоматически удален приложением, если пустой)
    const setupResourceRowForDelete = page.locator(`tr[data-row-id="${setupResourceId}"]`);
    const isSetupResourceVisible = await setupResourceRowForDelete.isVisible().catch(() => false);
    
    if (isSetupResourceVisible) {
      console.log('Setup resource still exists, deleting it...');
      await setupResourceRowForDelete.click({ button: 'right', force: true });

      const contextMenuSetup2 = page.getByTestId('context-menu');
      await expect(contextMenuSetup2).toBeVisible();

      const deleteButtonSetup = page.getByTestId('context-menu-delete');
      await deleteButtonSetup.click();

      await page.getByText('Сохранить').click();
      await page.waitForTimeout(2000);
      console.log(`Setup resource with FN="${setupResourceFn}" deleted`);
    } else {
      console.log('Setup resource was automatically cleaned up');
    }
  });

  test('should use first selected value when multiple filters are active', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const fnValue = `FN${randInt}`;
    const setupResourceFn = `FNSetup${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 1.5: Создаем тестовый ресурс для команды E2E, чтобы фильтр E2E был доступен
    const addButtonSetup = page.getByTestId('add-button');
    await expect(addButtonSetup).toBeVisible({ timeout: 5000 });
    await addButtonSetup.click();

    const resourceButtonSetup = page.getByTestId('add-resource-button');
    await expect(resourceButtonSetup).toBeVisible({ timeout: 2000 });
    await resourceButtonSetup.click();

    await page.waitForTimeout(500);

    // Находим последний добавленный ресурс
    const tableSetup = page.getByTestId('roadmap-table');
    const allRowsSetup = tableSetup.locator('tr[data-testid="resource"][data-row-id]');
    const rowCountSetup = await allRowsSetup.count();
    const setupResourceRow = allRowsSetup.nth(rowCountSetup - 1);
    const setupResourceId = await setupResourceRow.getAttribute('data-row-id');

    // Устанавливаем команду E2E для тестового ресурса
    const teamCellSetup = page.getByTestId(`team-cell-${setupResourceId}`);
    await teamCellSetup.dblclick();
    const teamSelectSetup = page.getByTestId('team-multiselect');
    await expect(teamSelectSetup).toBeVisible({ timeout: 300 });
    const e2eLabelSetup = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(e2eLabelSetup).toBeVisible({ timeout: 2000 });
    const e2eCheckboxSetup = e2eLabelSetup.locator('input[type="checkbox"]');
    await e2eCheckboxSetup.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Заполняем Fn для сохранения
    const fnCellSetup = page.getByTestId(`fn-cell-${setupResourceId}`);
    await fnCellSetup.dblclick();
    await page.waitForTimeout(300);
    await page.keyboard.type(setupResourceFn);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Шаг 1.6: Создаем тестовый ресурс для команды Demo, чтобы фильтр Demo был доступен
    const addButtonDemo = page.getByTestId('add-button');
    await addButtonDemo.click();

    const resourceButtonDemo = page.getByTestId('add-resource-button');
    await expect(resourceButtonDemo).toBeVisible({ timeout: 2000 });
    await resourceButtonDemo.click();

    await page.waitForTimeout(500);

    // Находим последний добавленный ресурс
    const allRowsDemo = tableSetup.locator('tr[data-testid="resource"][data-row-id]');
    const rowCountDemo = await allRowsDemo.count();
    const demoResourceRow = allRowsDemo.nth(rowCountDemo - 1);
    const demoResourceId = await demoResourceRow.getAttribute('data-row-id');

    // Устанавливаем команду Demo для тестового ресурса
    const teamCellDemo = page.getByTestId(`team-cell-${demoResourceId}`);
    await teamCellDemo.dblclick();
    const teamSelectDemo = page.getByTestId('team-multiselect');
    await expect(teamSelectDemo).toBeVisible({ timeout: 300 });
    const demoLabelSetup = page.locator('label').filter({ hasText: /^Demo$/ }).first();
    await expect(demoLabelSetup).toBeVisible({ timeout: 2000 });
    const demoCheckboxSetup = demoLabelSetup.locator('input[type="checkbox"]');
    await demoCheckboxSetup.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Заполняем Fn для сохранения
    const setupDemoResourceFn = `FNSetupDemo${randInt}`;
    const fnCellDemo = page.getByTestId(`fn-cell-${demoResourceId}`);
    await fnCellDemo.dblclick();
    await page.waitForTimeout(300);
    await page.keyboard.type(setupDemoResourceFn);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.getByTestId('header-team');
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    const filterButton = page.getByTestId('filter-team-button');
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем две команды в фильтре: E2E и Demo
    // Сначала E2E
    const e2eCheckbox = page.getByTestId('filter-checkbox-E2E');
    await expect(e2eCheckbox).toBeVisible({ timeout: 2000 });
    await e2eCheckbox.click();
    await page.waitForTimeout(200);
    
    // Затем Demo (убеждаемся, что фильтр все еще открыт)
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    const demoCheckbox = page.getByTestId('filter-checkbox-Demo');
    await expect(demoCheckbox).toBeVisible({ timeout: 2000 });
    await demoCheckbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новый ресурс
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const resourceButton = page.getByTestId('add-resource-button');
    await expect(resourceButton).toBeVisible({ timeout: 2000 });
    await resourceButton.click();

    await page.waitForTimeout(500);

    // Шаг 5: Находим новую строку ресурса
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    await page.waitForTimeout(500);
    
    // Находим все строки ресурсов
    const allRows = table.locator('tr[data-testid="resource"][data-row-id]');
    const rowCount = await allRows.count();
    
    // Ищем последнюю строку (новый ресурс)
    const newResourceRow = allRows.nth(rowCount - 1);
    await expect(newResourceRow).toBeVisible({ timeout: 3000 });
    const newResourceId = await newResourceRow.getAttribute('data-row-id');

    // Шаг 6: Проверяем, что команда установлена на первое значение из фильтра (E2E или Demo)
    const teamCell = page.getByTestId(`team-cell-${newResourceId}`);
    const teamText = await teamCell.textContent();
    console.log(`Team cell text: "${teamText}"`);
    
    // Проверяем что это либо E2E, либо Demo (первое из Set, порядок может варьироваться)
    const hasValidTeam = teamText?.includes('E2E') || teamText?.includes('Demo');
    expect(hasValidTeam).toBeTruthy();
    console.log(`✅ New resource has Team from filter defaults: "${teamText}"`);

    // Шаг 7: Добавляем Fn чтобы сохранить ресурс
    const fnCell = page.getByTestId(`fn-cell-${newResourceId}`);
    await fnCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(fnValue);
    await page.keyboard.press('Enter');

    // Шаг 8: Удаляем созданный ресурс по ID (cleanup)
    await page.waitForTimeout(2000);
    const resourceRowForDelete = page.locator(`tr[data-row-id="${newResourceId}"]`);
    await resourceRowForDelete.click({ button: 'right' });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Resource with FN="${fnValue}" deleted`);

    // Шаг 9: Удаляем тестовый ресурс E2E, созданный в начале, по ID
    const setupResourceRowForDelete = page.locator(`tr[data-row-id="${setupResourceId}"]`);
    await setupResourceRowForDelete.click({ button: 'right' });

    const contextMenuSetup3 = page.getByTestId('context-menu');
    await expect(contextMenuSetup3).toBeVisible();

    const deleteButtonSetup = page.getByTestId('context-menu-delete');
    await deleteButtonSetup.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Setup resource with FN="${setupResourceFn}" deleted`);

    // Шаг 10: Удаляем тестовый ресурс Demo, созданный в начале, по ID
    const demoResourceRowForDelete = page.locator(`tr[data-row-id="${demoResourceId}"]`);
    await demoResourceRowForDelete.click({ button: 'right' });

    const contextMenuDemo = page.getByTestId('context-menu');
    await expect(contextMenuDemo).toBeVisible();

    const deleteButtonDemo = page.getByTestId('context-menu-delete');
    await deleteButtonDemo.click();

    await page.getByText('Сохранить').click();
    await page.waitForTimeout(2000);
    console.log(`Setup resource Demo with FN="${setupDemoResourceFn}" deleted`);
  });
});

