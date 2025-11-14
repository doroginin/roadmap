import { test, expect } from '@playwright/test';

test.describe('Team MultiSelect Filter Behavior', () => {
  test('should keep multiselect open when clicking checkboxes inside it', async ({ page }) => {
    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Создаем новый ресурс
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.getByTestId('add-menu')).toBeVisible();

    const addResourceButton = page.getByTestId('add-resource-button');
    await expect(addResourceButton).toBeVisible();
    await addResourceButton.click();

    await page.waitForTimeout(500);

    // Находим последний добавленный ресурс
    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);

    const testResourceId = await newResourceRow.getAttribute('data-row-id');
    if (!testResourceId) {
      throw new Error('Resource ID not found');
    }
    console.log(`Created resource with ID: ${testResourceId}`);

    // Шаг 3: Открываем мультиселект команды
    const teamCell = newResourceRow.getByTestId(`team-cell-${testResourceId}`);
    await teamCell.dblclick();

    const multiselect = page.getByTestId('team-multiselect');
    await expect(multiselect).toBeVisible({ timeout: 5000 });

    // Шаг 4: Проверяем, что мультиселект содержит команду E2E
    // Dropdown рендерится через Portal, поэтому ищем label напрямую в документе
    const testLabel = page.locator('label').filter({ hasText: /^E2E$/ }).first();
    await expect(testLabel).toBeVisible();

    // Шаг 5: Кликаем на чекбокс Test внутри мультиселекта
    const testCheckbox = testLabel.locator('input[type="checkbox"]');
    await expect(testCheckbox).toBeVisible();
    
    // Запоминаем состояние чекбокса до клика
    const wasCheckedBefore = await testCheckbox.isChecked();
    console.log(`Test checkbox was ${wasCheckedBefore ? 'checked' : 'unchecked'} before click`);

    // Кликаем на чекбокс
    await testCheckbox.click();

    // Шаг 6: Проверяем, что мультиселект все еще открыт после клика на чекбокс
    // Проверяем, что dropdown с label элементами все еще виден
    await expect(testLabel).toBeVisible({ timeout: 2000 });
    console.log('✅ Test passed: Team multiselect remained open after clicking checkbox inside it');

    // Шаг 7: Проверяем, что состояние чекбокса изменилось
    const isCheckedAfter = await testCheckbox.isChecked();
    expect(isCheckedAfter).toBe(!wasCheckedBefore);
    console.log(`Test checkbox is now ${isCheckedAfter ? 'checked' : 'unchecked'} after click`);

    // Шаг 8: Кликаем еще раз, чтобы вернуть исходное состояние
    await testCheckbox.click();
    await expect(testLabel).toBeVisible({ timeout: 2000 });
    console.log('✅ Test passed: Team multiselect remained open after second checkbox click');

    // Закрываем мультиселект (нажимаем Escape или кликаем вне)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

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
});
