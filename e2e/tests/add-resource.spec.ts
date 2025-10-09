import { test, expect } from '@playwright/test';

test.describe('Add Resource functionality', () => {
  test('should add a new resource, save it, and delete it', async ({ page }) => {
    // Генерируем случайное число для FN
    const randInt = Math.floor(Math.random() * 10000);
    const fnValue = `FN${randInt}`;
    const weekValues = ['1', '2', '1', '1', '1'];

    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Открываем меню "Добавить" и выбираем "Ресурс"
    // Находим кнопку "+ Добавить" внизу страницы
    const addButton = page.locator('button', { hasText: '+ Добавить' }).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Ждем появления меню с опциями
    const resourceButton = page.locator('button', { hasText: 'Ресурс' }).first();
    await expect(resourceButton).toBeVisible({ timeout: 2000 });
    await resourceButton.click();

    // Ждем немного, чтобы ресурс добавился в таблицу
    await page.waitForTimeout(500);

    // Шаг 3: Находим новую строку ресурса
    // Ищем последнюю строку с Тип = "Ресурс" и пустой командой
    const table = page.getByTestId('roadmap-table');
    
    // Прокручиваем таблицу до конца
    await page.evaluate(() => {
      const tableContainer = document.querySelector('[data-testid="roadmap-table"]')?.closest('.roadmap-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    });
    
    await page.waitForTimeout(500);
    
    // Находим все строки ресурсов с data-row-id
    const allRows = table.locator('tr[data-testid="resource"][data-row-id]');
    const rowCount = await allRows.count();
    
    // Ищем последнюю строку (новый ресурс)
    const newResourceRow = allRows.nth(rowCount - 1);
    
    // Проверяем, что строка видна
    await expect(newResourceRow).toBeVisible({ timeout: 3000 });

    // Получаем ID новой строки ресурса из data-row-id
    const newResourceId = await newResourceRow.getAttribute('data-row-id');
    if (!newResourceId) {
      throw new Error('Resource row ID not found');
    }
    
    console.log(`New resource ID: ${newResourceId}`);

    // Шаг 4: Двойной клик на ячейку команды, используя data-testid
    // Прокручиваем строку в видимую область и делаем двойной клик на ячейку team
    await page.evaluate((rowId) => {
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        const teamCell = row?.querySelector('td[data-testid="team"]');
        const tableContainer = document.querySelector('[data-testid="roadmap-table-container"]');
        
        if (row && teamCell && tableContainer) {
            // Прокручиваем строку в видимую область вертикально
            row.scrollIntoView({ behavior: 'instant', block: 'center' });
            
            // Сбрасываем горизонтальную прокрутку к началу чтобы ячейка team была видна
            // (она должна быть sticky/frozen, но на всякий случай)
            tableContainer.scrollLeft = 0;
        }
    }, newResourceId);
    
    await page.waitForTimeout(500);
    
    // Находим ячейку team снова после прокрутки
    const teamCell = newResourceRow.getByTestId(`team-cell-${newResourceId}`);
    
    // Кликаем два раза на ячейку team
    await teamCell.click({ clickCount: 2 });

    // Ждем появления мультиселекта команды
    const teamSelect = page.getByTestId('team-multiselect');
    await expect(teamSelect).toBeVisible({ timeout: 300 });

    // Выбираем "Test" из списка
    const testLabel = page.locator('label').filter({ hasText: /^Test$/ }).first();
    await expect(testLabel).toBeVisible({ timeout: 2000 });
    const testCheckbox = testLabel.locator('input[type="checkbox"]');
    await testCheckbox.click();

    // Шаг 5: Нажимаем Tab для перехода к ячейке Fn
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Вводим значение Fn
    await page.keyboard.type(fnValue);

    // Шаг 6: Нажимаем Tab два раза для перехода к первой неделе
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Шаг 7: Заполняем недели
    for (let i = 0; i < weekValues.length; i++) {
      const weekValue = weekValues[i];
      
      // Очищаем поле и вводим значение
      await page.keyboard.press('Control+A'); // Выделяем все
      await page.keyboard.type(weekValue);
      
      // Если это не последняя неделя, нажимаем Tab
      // Если последняя - нажимаем Enter
      if (i < weekValues.length - 1) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
      } else {
        await page.keyboard.press('Enter');
      }
    }

    console.log(`Resource with FN="${fnValue}" added`);

    // Шаг 8: Ждем 2 секунды для автосохранения
    await page.waitForTimeout(2000);

    // Шаг 9: Обновляем страницу
    await page.reload();

    // Ждем загрузки данных после обновления
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(2000);

    // Шаг 10: Проверяем, что наш ресурс остался на месте
    // Ищем ячейку с Fn значением
    const fnCell = page.locator('td').filter({ hasText: fnValue });
    await expect(fnCell).toBeVisible({ timeout: 5000 });
    console.log(`✅ Resource with FN="${fnValue}" persisted after page reload`);

    // Также проверяем, что команда "Test" установлена
    const savedResourceRow = fnCell.locator('xpath=ancestor::tr');
    const savedTeamCell = savedResourceRow.locator('td').nth(2);
    await expect(savedTeamCell).toContainText('Test');
    console.log('✅ Team "Test" is correctly set');

    // Шаг 11: Удаляем ресурс
    // Кликаем правой кнопкой мыши на строку для открытия контекстного меню
    await savedResourceRow.click({ button: 'right' });

    // Ждем появления контекстного меню
    await page.waitForTimeout(500);

    // Ищем кнопку удаления в контекстном меню
    const deleteButton = page.locator('button').filter({ hasText: /Удалить|Delete/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    console.log(`Resource with FN="${fnValue}" deleted`);

    // Шаг 12: Ждем 2 секунды для автосохранения удаления
    await page.waitForTimeout(2000);

    // Шаг 13: Обновляем страницу
    await page.reload();

    // Ждем загрузки данных после обновления
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    await page.waitForTimeout(2000);

    // Шаг 14: Проверяем, что нашего ресурса нет
    const deletedFnCell = page.locator('td').filter({ hasText: fnValue });
    await expect(deletedFnCell).not.toBeVisible({ timeout: 3000 });
    console.log(`✅ Resource with FN="${fnValue}" successfully deleted and not visible after page reload`);
  });
});

