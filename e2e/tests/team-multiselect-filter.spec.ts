import { test, expect } from '@playwright/test';

test.describe('Team MultiSelect Filter Behavior', () => {
  test('should keep multiselect open when clicking checkboxes inside it', async ({ page }) => {
    // Шаг 1: Открываем страницу
    await page.goto('/');

    // Ждем загрузки данных
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Шаг 2: Находим ресурс команды Demo и открываем мультиселект
    const testResourceId = 'dddddddd-0000-0000-0000-000000000002';
    const resourceRow = page.locator(`[data-row-id="${testResourceId}"]`);
    await expect(resourceRow).toBeVisible({ timeout: 5000 });

    const teamCell = resourceRow.locator('td').nth(2);
    await teamCell.dblclick();

    const multiselect = page.getByTestId('team-multiselect');
    await expect(multiselect).toBeVisible({ timeout: 5000 });

    // Шаг 3: Проверяем, что мультиселект содержит команду Demo
    await expect(multiselect.getByText('Demo').first()).toBeVisible();

    // Шаг 4: Кликаем на чекбокс Demo внутри мультиселекта
    // Ищем label с текстом "Demo" и внутри него чекбокс
    const demoLabel = multiselect.locator('label').filter({ hasText: 'Demo' }).first();
    await expect(demoLabel).toBeVisible();
    const demoCheckbox = demoLabel.locator('input[type="checkbox"]');
    await expect(demoCheckbox).toBeVisible();
    
    // Запоминаем состояние чекбокса до клика
    const wasCheckedBefore = await demoCheckbox.isChecked();
    console.log(`Demo checkbox was ${wasCheckedBefore ? 'checked' : 'unchecked'} before click`);

    // Кликаем на чекбокс
    await demoCheckbox.click();

    // Шаг 5: Проверяем, что мультиселект все еще открыт после клика на чекбокс
    await expect(multiselect).toBeVisible({ timeout: 2000 });
    console.log('✅ Test passed: Team multiselect remained open after clicking checkbox inside it');

    // Шаг 6: Проверяем, что состояние чекбокса изменилось
    const isCheckedAfter = await demoCheckbox.isChecked();
    expect(isCheckedAfter).toBe(!wasCheckedBefore);
    console.log(`Demo checkbox is now ${isCheckedAfter ? 'checked' : 'unchecked'} after click`);

    // Шаг 7: Кликаем еще раз, чтобы вернуть исходное состояние
    await demoCheckbox.click();
    await expect(multiselect).toBeVisible({ timeout: 2000 });
    console.log('✅ Test passed: Team multiselect remained open after second checkbox click');
  });
});
