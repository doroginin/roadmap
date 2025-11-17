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

    // Шаг 1.5: Создаем тестовый ресурс для команды E2E, чтобы фильтр E2E был доступен
    const addButtonSetup = page.getByTestId('add-button');
    await expect(addButtonSetup).toBeVisible({ timeout: 5000 });
    await addButtonSetup.click();

    const resourceButtonSetup = page.getByTestId('add-resource-button');
    await expect(resourceButtonSetup).toBeVisible({ timeout: 2000 });
    await resourceButtonSetup.click();


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

    // Заполняем Fn для сохранения
    const fnCellSetup = page.getByTestId(`fn-cell-${setupResourceId}`);
    await fnCellSetup.dblclick();
    await page.keyboard.type(setupResourceFn);
    await page.keyboard.press('Enter');

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.getByTestId('header-team');
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    // Находим кнопку фильтра в заголовке
    const filterButton = page.getByTestId('filter-team-button');
    await filterButton.click();

    // Шаг 3: Выбираем команду "E2E" в фильтре
    const e2eCheckbox = page.getByTestId('filter-checkbox-E2E');
    await expect(e2eCheckbox).toBeVisible({ timeout: 2000 });
    await e2eCheckbox.click();
    
    // Закрываем фильтр, кликнув вне его
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Шаг 4: Добавляем новый ресурс
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const resourceButton = page.getByTestId('add-resource-button');
    await expect(resourceButton).toBeVisible({ timeout: 2000 });
    await resourceButton.click();


    // Шаг 5: Находим новую строку ресурса
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    
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
    await page.keyboard.type(fnValue);
    await page.keyboard.press('Enter');
    
    console.log(`Resource with FN="${fnValue}" and Team="E2E" added`);

    // Шаг 8: Проверяем, что ресурс виден в отфильтрованной таблице
    await expect(fnCell).toContainText(fnValue, { timeout: 5000 });
    console.log('✅ New resource is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const filterButton2 = page.getByTestId('filter-team-button');
    await filterButton2.click();
    
    // Снимаем галку с E2E
    const e2eCheckbox2 = page.getByTestId('filter-checkbox-E2E');
    await e2eCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });

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
    console.log(`Resource with FN="${fnValue}" deleted`);

    // Шаг 12: Удаляем тестовый ресурс, созданный в начале, по ID
    const setupResourceRowForDelete = page.locator(`tr[data-row-id="${setupResourceId}"]`);
    await setupResourceRowForDelete.click({ button: 'right' });

    const contextMenuSetup = page.getByTestId('context-menu');
    await expect(contextMenuSetup).toBeVisible();

    const deleteButtonSetup = page.getByTestId('context-menu-delete');
    await deleteButtonSetup.click();

    await page.getByText('Сохранить').click();
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

    // Шаг 1.5: Создаем тестовый ресурс для команды E2E, чтобы фильтр E2E был доступен
    const addButtonSetup = page.getByTestId('add-button');
    await expect(addButtonSetup).toBeVisible({ timeout: 5000 });
    await addButtonSetup.click();

    const resourceButtonSetup = page.getByTestId('add-resource-button');
    await expect(resourceButtonSetup).toBeVisible({ timeout: 2000 });
    await resourceButtonSetup.click();


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

    // Заполняем Fn для сохранения
    const fnCellSetup = page.getByTestId(`fn-cell-${setupResourceId}`);
    await fnCellSetup.dblclick();
    await page.keyboard.type(setupResourceFn);
    await page.keyboard.press('Enter');

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.getByTestId('header-team');
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    const filterButton = page.getByTestId('filter-team-button');
    await filterButton.click();

    // Шаг 3: Выбираем команду "E2E" в фильтре
    const e2eCheckbox = page.getByTestId('filter-checkbox-E2E');
    await expect(e2eCheckbox).toBeVisible({ timeout: 2000 });
    await e2eCheckbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Шаг 4: Добавляем новую задачу
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const taskButton = page.getByTestId('add-task-button');
    await expect(taskButton).toBeVisible({ timeout: 2000 });
    await taskButton.click();


    // Шаг 5: Находим новую строку задачи
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    
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
    await page.keyboard.type(taskName);
    await page.keyboard.press('Enter');
    
    console.log(`Task "${taskName}" with Team="E2E" added`);

    // Шаг 8: Проверяем, что задача видна в отфильтрованной таблице
    await expect(taskCell).toContainText(taskName, { timeout: 5000 });
    console.log('✅ New task is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const filterButton2 = page.getByTestId('filter-team-button');
    await filterButton2.click();
    
    // Снимаем галку с E2E
    const e2eCheckbox2 = page.getByTestId('filter-checkbox-E2E');
    await e2eCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Шаг 10: Проверяем, что задача все еще видна после снятия фильтра
    await expect(taskCell).toContainText(taskName, { timeout: 5000 });
    await expect(teamCell).toContainText('E2E');
    console.log('✅ Task with Team="E2E" is visible without filter');

    // Шаг 11: Удаляем созданную задачу по ID
    const taskRowForDelete = page.locator(`tr[data-row-id="${newTaskId}"]`);
    // Прокручиваем элемент в видимую область, чтобы он не был перекрыт sticky элементами
    await taskRowForDelete.scrollIntoViewIfNeeded();
    await taskRowForDelete.click({ button: 'right', force: true });

    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible();

    const deleteButton = page.getByTestId('context-menu-delete');
    await deleteButton.click();

    await page.getByText('Сохранить').click();
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
        console.log(`Setup resource with FN="${setupResourceFn}" deleted`);
    } else {
      console.log('Setup resource was automatically cleaned up');
    }
  });

  test('should use first selected value when multiple filters are active', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const fn1Value = `Fn1_${randInt}`;
    const fn2Value = `Fn2_${randInt}`;
    const taskName = `Task${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Создаем первый ресурс с командой E2E и функцией Fn1
    const addButton1 = page.getByTestId('add-button');
    await expect(addButton1).toBeVisible({ timeout: 5000 });
    await addButton1.click();

    const resourceButton1 = page.getByTestId('add-resource-button');
    await expect(resourceButton1).toBeVisible({ timeout: 2000 });
    await resourceButton1.click();


    // Находим первый добавленный ресурс
    const table = page.getByTestId('roadmap-table');
    const allRows1 = table.locator('tr[data-testid="resource"][data-row-id]');
    const rowCount1 = await allRows1.count();
    const resource1Row = allRows1.nth(rowCount1 - 1);
    const resource1Id = await resource1Row.getAttribute('data-row-id');

    // Устанавливаем команду E2E для первого ресурса
    const teamCell1 = page.getByTestId(`team-cell-${resource1Id}`);
    await teamCell1.dblclick();
    const teamSelect1 = page.getByTestId('team-multiselect');
    await expect(teamSelect1).toBeVisible({ timeout: 300 });
    const e2eLabel1 = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(e2eLabel1).toBeVisible({ timeout: 2000 });
    const e2eCheckbox1 = e2eLabel1.locator('input[type="checkbox"]');
    await e2eCheckbox1.click();
    await page.keyboard.press('Tab');

    // Заполняем Fn1 для первого ресурса
    const fnCell1 = page.getByTestId(`fn-cell-${resource1Id}`);
    await fnCell1.dblclick();
    await page.keyboard.type(fn1Value);
    await page.keyboard.press('Enter');

    // Шаг 3: Создаем второй ресурс с командой E2E и функцией Fn2
    const addButton2 = page.getByTestId('add-button');
    await addButton2.click();

    const resourceButton2 = page.getByTestId('add-resource-button');
    await expect(resourceButton2).toBeVisible({ timeout: 2000 });
    await resourceButton2.click();


    // Находим второй добавленный ресурс
    const allRows2 = table.locator('tr[data-testid="resource"][data-row-id]');
    const rowCount2 = await allRows2.count();
    const resource2Row = allRows2.nth(rowCount2 - 1);
    const resource2Id = await resource2Row.getAttribute('data-row-id');

    // Устанавливаем команду E2E для второго ресурса
    const teamCell2 = page.getByTestId(`team-cell-${resource2Id}`);
    await teamCell2.dblclick();
    const teamSelect2 = page.getByTestId('team-multiselect');
    await expect(teamSelect2).toBeVisible({ timeout: 300 });
    const e2eLabel2 = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(e2eLabel2).toBeVisible({ timeout: 2000 });
    const e2eCheckbox2 = e2eLabel2.locator('input[type="checkbox"]');
    await e2eCheckbox2.click();
    await page.keyboard.press('Tab');

    // Заполняем Fn2 для второго ресурса
    const fnCell2 = page.getByTestId(`fn-cell-${resource2Id}`);
    await fnCell2.dblclick();
    await page.keyboard.type(fn2Value);
    await page.keyboard.press('Enter');

    // Шаг 4: Открываем фильтр по колонке Fn
    const fnHeader = page.getByTestId('header-fn');
    await expect(fnHeader).toBeVisible({ timeout: 5000 });
    
    const filterFnButton = page.getByTestId('filter-fn-button');
    await filterFnButton.click();

    // Шаг 5: Выбираем две функции в фильтре: сначала Fn1, затем Fn2
    // Сначала Fn1
    const fn1Checkbox = page.getByTestId(`filter-checkbox-${fn1Value}`);
    await expect(fn1Checkbox).toBeVisible({ timeout: 2000 });
    await fn1Checkbox.click();
    
    // Затем Fn2 (убеждаемся, что фильтр все еще открыт)
    await expect(page.getByTestId('filter-popup')).toBeVisible();
    const fn2Checkbox = page.getByTestId(`filter-checkbox-${fn2Value}`);
    await expect(fn2Checkbox).toBeVisible({ timeout: 2000 });
    await fn2Checkbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Шаг 6: Добавляем новую задачу
    const addButton3 = page.getByTestId('add-button');
    await expect(addButton3).toBeVisible({ timeout: 5000 });
    await addButton3.click();

    const taskButton = page.getByTestId('add-task-button');
    await expect(taskButton).toBeVisible({ timeout: 2000 });
    await taskButton.click();


    // Шаг 7: Находим новую строку задачи
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    
    // Находим все строки задач
    const allTaskRows = table.locator('tr[data-testid="task"][data-row-id]');
    const taskRowCount = await allTaskRows.count();
    
    // Ищем последнюю строку (новая задача)
    const newTaskRow = allTaskRows.nth(taskRowCount - 1);
    await expect(newTaskRow).toBeVisible({ timeout: 3000 });
    const newTaskId = await newTaskRow.getAttribute('data-row-id');

    // Шаг 8: Проверяем, что команда E2E установлена
    const taskTeamCell = page.getByTestId(`team-cell-${newTaskId}`);
    await expect(taskTeamCell).toContainText('E2E', { timeout: 2000 });
    console.log('✅ New task has Team="E2E" from filter defaults');

    // Шаг 9: Проверяем, что Fn установлена на первое значение из фильтра (Fn1)
    const taskFnCell = page.getByTestId(`fn-cell-${newTaskId}`);
    const fnText = await taskFnCell.textContent();
    console.log(`Fn cell text: "${fnText}"`);
    
    // Проверяем что установлена первая выбранная функция (Fn1)
    await expect(taskFnCell).toContainText(fn1Value, { timeout: 2000 });
    console.log(`✅ New task has Fn="${fn1Value}" (first selected value from filter)`);

    // Шаг 10: Добавляем название задачи чтобы сохранить
    const taskNameCell = page.getByTestId(`task-cell-${newTaskId}`);
    await taskNameCell.click({ clickCount: 2 });
    await page.keyboard.type(taskName);
    await page.keyboard.press('Enter');
    
    console.log(`Task "${taskName}" with Team="E2E" and Fn="${fn1Value}" added`);

    // Шаг 11: Удаляем созданную задачу по ID
    const taskRowForDelete = page.locator(`tr[data-row-id="${newTaskId}"]`);
    await taskRowForDelete.scrollIntoViewIfNeeded();
    await taskRowForDelete.click({ button: 'right', force: true });

    const contextMenu1 = page.getByTestId('context-menu');
    await expect(contextMenu1).toBeVisible();

    const deleteButton1 = page.getByTestId('context-menu-delete');
    await deleteButton1.click();

    await page.getByText('Сохранить').click();
    console.log(`Task "${taskName}" deleted`);

    // Шаг 12: Удаляем первый ресурс по ID
    const resource1RowForDelete = page.locator(`tr[data-row-id="${resource1Id}"]`);
    await resource1RowForDelete.click({ button: 'right' });

    const contextMenu2 = page.getByTestId('context-menu');
    await expect(contextMenu2).toBeVisible();

    const deleteButton2 = page.getByTestId('context-menu-delete');
    await deleteButton2.click();

    await page.getByText('Сохранить').click();
    console.log(`Resource with Fn="${fn1Value}" deleted`);

    // Шаг 13: Удаляем второй ресурс по ID
    const resource2RowForDelete = page.locator(`tr[data-row-id="${resource2Id}"]`);
    await resource2RowForDelete.click({ button: 'right' });

    const contextMenu3 = page.getByTestId('context-menu');
    await expect(contextMenu3).toBeVisible();

    const deleteButton3 = page.getByTestId('context-menu-delete');
    await deleteButton3.click();

    await page.getByText('Сохранить').click();
    console.log(`Resource with Fn="${fn2Value}" deleted`);
  });
});

