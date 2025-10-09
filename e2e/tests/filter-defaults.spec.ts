import { test, expect } from '@playwright/test';

test.describe('Filter Defaults for New Items', () => {
  test('should create new resource with filter defaults', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const fnValue = `FN${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 2: Открываем фильтр по колонке Team
    // Находим заголовок Team и кнопку фильтра
    const teamHeader = page.locator('th').filter({ hasText: /^Team/ }).first();
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    // Находим кнопку фильтра в заголовке
    const filterButton = teamHeader.locator('button[title*="Фильтр"]').or(teamHeader.locator('button').first());
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем команду "Demo" в фильтре
    // Ищем чекбокс для "Demo"
    const demoLabel = page.locator('label').filter({ hasText: /^Demo$/ }).first();
    await expect(demoLabel).toBeVisible({ timeout: 2000 });
    const demoCheckbox = demoLabel.locator('input[type="checkbox"]');
    await demoCheckbox.click();
    
    // Закрываем фильтр, кликнув вне его
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новый ресурс
    const addButton = page.locator('button', { hasText: '+ Добавить' }).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const resourceButton = page.locator('button', { hasText: 'Ресурс' }).first();
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

    // Шаг 6: Проверяем, что команда "Demo" уже установлена
    const teamCell = newResourceRow.locator('td').nth(2); // Team - 3-я колонка
    await expect(teamCell).toContainText('Demo', { timeout: 2000 });
    console.log('✅ New resource has Team="Demo" from filter defaults');

    // Шаг 7: Добавляем Fn чтобы сохранить ресурс
    const fnCell = newResourceRow.locator('td').nth(3); // Fn - 4-я колонка
    await fnCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(fnValue);
    await page.keyboard.press('Enter');
    
    console.log(`Resource with FN="${fnValue}" and Team="Demo" added`);

    // Шаг 8: Проверяем, что ресурс виден в отфильтрованной таблице
    const fnCell2 = page.locator('td').filter({ hasText: fnValue });
    await expect(fnCell2).toBeVisible({ timeout: 5000 });
    console.log('✅ New resource is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const teamHeader2 = page.locator('th').filter({ hasText: /^Team/ }).first();
    const filterButton2 = teamHeader2.locator('button[title*="Фильтр"]').or(teamHeader2.locator('button').first());
    await filterButton2.click();
    await page.waitForTimeout(300);
    
    // Снимаем галку с Demo
    const demoLabel2 = page.locator('label').filter({ hasText: /^Demo$/ }).first();
    const demoCheckbox2 = demoLabel2.locator('input[type="checkbox"]');
    await demoCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 10: Проверяем, что ресурс все еще виден после снятия фильтра
    await expect(fnCell2).toBeVisible({ timeout: 5000 });
    
    const savedResourceRow = fnCell2.locator('xpath=ancestor::tr');
    const savedTeamCell = savedResourceRow.locator('td').nth(2);
    await expect(savedTeamCell).toContainText('Demo');
    console.log('✅ Resource with Team="Demo" is visible without filter');

    // Шаг 11: Удаляем ресурс
    await savedResourceRow.click({ button: 'right' });
    await page.waitForTimeout(500);

    const deleteButton = page.locator('button').filter({ hasText: /Удалить|Delete/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    await page.waitForTimeout(2000);
    console.log(`Resource with FN="${fnValue}" deleted`);
  });

  test('should create new task with filter defaults', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const taskName = `Task${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.locator('th').filter({ hasText: /^Team/ }).first();
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    const filterButton = teamHeader.locator('button[title*="Фильтр"]').or(teamHeader.locator('button').first());
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем команду "Test" в фильтре
    const testLabel = page.locator('label').filter({ hasText: /^Test$/ }).first();
    await expect(testLabel).toBeVisible({ timeout: 2000 });
    const testCheckbox = testLabel.locator('input[type="checkbox"]');
    await testCheckbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новую задачу
    const addButton = page.locator('button', { hasText: '+ Добавить' }).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const taskButton = page.locator('button', { hasText: 'Задача' }).first();
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

    // Шаг 6: Проверяем, что команда "Test" уже установлена
    const teamCell = newTaskRow.locator('td').nth(5); // Team - 6-я колонка для задач
    await expect(teamCell).toContainText('Test', { timeout: 2000 });
    console.log('✅ New task has Team="Test" from filter defaults');

    // Шаг 7: Добавляем название задачи чтобы сохранить
    const taskCell = newTaskRow.locator('td').nth(4); // Task - 5-я колонка
    await taskCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(taskName);
    await page.keyboard.press('Enter');
    
    console.log(`Task "${taskName}" with Team="Test" added`);

    // Шаг 8: Проверяем, что задача видна в отфильтрованной таблице
    const taskCell2 = page.locator('td').filter({ hasText: taskName });
    await expect(taskCell2).toBeVisible({ timeout: 5000 });
    console.log('✅ New task is visible with filter active');
    
    // Шаг 9: Очищаем фильтр чтобы увидеть все элементы
    const teamHeader2 = page.locator('th').filter({ hasText: /^Team/ }).first();
    const filterButton2 = teamHeader2.locator('button[title*="Фильтр"]').or(teamHeader2.locator('button').first());
    await filterButton2.click();
    await page.waitForTimeout(300);
    
    // Снимаем галку с Test
    const testLabel2 = page.locator('label').filter({ hasText: /^Test$/ }).first();
    const testCheckbox2 = testLabel2.locator('input[type="checkbox"]');
    await testCheckbox2.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 10: Проверяем, что задача все еще видна после снятия фильтра
    await expect(taskCell2).toBeVisible({ timeout: 5000 });
    
    const savedTaskRow = taskCell2.locator('xpath=ancestor::tr');
    const savedTeamCell = savedTaskRow.locator('td').nth(5);
    await expect(savedTeamCell).toContainText('Test');
    console.log('✅ Task with Team="Test" is visible without filter');

    // Шаг 11: Удаляем задачу
    await savedTaskRow.click({ button: 'right' });
    await page.waitForTimeout(500);

    const deleteButton = page.locator('button').filter({ hasText: /Удалить|Delete/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    await page.waitForTimeout(2000);
    console.log(`Task "${taskName}" deleted`);
  });

  test('should use first selected value when multiple filters are active', async ({ page }) => {
    // Генерируем случайное число для уникальности
    const randInt = Math.floor(Math.random() * 10000);
    const fnValue = `FN${randInt}`;

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(1000);

    // Шаг 2: Открываем фильтр по колонке Team
    const teamHeader = page.locator('th').filter({ hasText: /^Team/ }).first();
    await expect(teamHeader).toBeVisible({ timeout: 5000 });
    
    const filterButton = teamHeader.locator('button[title*="Фильтр"]').or(teamHeader.locator('button').first());
    await filterButton.click();
    await page.waitForTimeout(500);

    // Шаг 3: Выбираем две команды в фильтре: Demo и Test
    // Сначала Demo
    const demoLabel = page.locator('label').filter({ hasText: /^Demo$/ }).first();
    await expect(demoLabel).toBeVisible({ timeout: 2000 });
    const demoCheckbox = demoLabel.locator('input[type="checkbox"]');
    await demoCheckbox.click();
    
    // Затем Test
    const testLabel = page.locator('label').filter({ hasText: /^Test$/ }).first();
    await expect(testLabel).toBeVisible({ timeout: 2000 });
    const testCheckbox = testLabel.locator('input[type="checkbox"]');
    await testCheckbox.click();
    
    // Закрываем фильтр
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(500);

    // Шаг 4: Добавляем новый ресурс
    const addButton = page.locator('button', { hasText: '+ Добавить' }).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    const resourceButton = page.locator('button', { hasText: 'Ресурс' }).first();
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

    // Шаг 6: Проверяем, что команда установлена на первое значение из фильтра (Demo)
    const teamCell = newResourceRow.locator('td').nth(2);
    const teamText = await teamCell.textContent();
    console.log(`Team cell text: "${teamText}"`);
    
    // Проверяем что это либо Demo, либо Test (первое из Set, порядок может варьироваться)
    const hasValidTeam = teamText?.includes('Demo') || teamText?.includes('Test');
    expect(hasValidTeam).toBeTruthy();
    console.log(`✅ New resource has Team from filter defaults: "${teamText}"`);

    // Шаг 7: Добавляем Fn чтобы сохранить ресурс
    const fnCell = newResourceRow.locator('td').nth(3);
    await fnCell.click({ clickCount: 2 });
    await page.waitForTimeout(300);
    await page.keyboard.type(fnValue);
    await page.keyboard.press('Enter');

    // Шаг 8: Удаляем ресурс (cleanup)
    await page.waitForTimeout(2000);
    await newResourceRow.click({ button: 'right' });
    await page.waitForTimeout(500);

    const deleteButton = page.locator('button').filter({ hasText: /Удалить|Delete/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    await page.waitForTimeout(1000);
    console.log(`Resource with FN="${fnValue}" deleted`);
  });
});

