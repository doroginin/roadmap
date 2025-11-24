import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Sprints and Teams save functionality', () => {
  test('should save sprint changes to server', async ({ page }) => {
    // Шаг 1: Открываем страницу
    await page.goto('/');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    console.log('✅ Page loaded');

    // Шаг 2: Переключаемся на вкладку Спринты
    const sprintsTab = page.getByTestId('tab-sprints');
    await sprintsTab.click();
    await expect(page.getByTestId('sprint-table-container')).toBeVisible({ timeout: 5000 });
    console.log('✅ Switched to Sprints tab');

    // Шаг 3: Запоминаем количество спринтов
    const sprintRows = page.locator('[data-testid="sprint-table-container"] tbody tr');
    const initialSprintCount = await sprintRows.count();
    console.log(`Initial sprint count: ${initialSprintCount}`);

    // Шаг 4: Добавляем новый спринт
    const addSprintButton = page.getByTestId('add-sprint-button');
    await addSprintButton.click();

    // Проверяем, что спринт добавлен
    await expect(sprintRows).toHaveCount(initialSprintCount + 1);
    console.log('✅ Sprint added');

    // Шаг 5: Редактируем код нового спринта
    const lastSprintRow = sprintRows.nth(initialSprintCount);
    const codeCell = lastSprintRow.locator('td').first();
    await codeCell.dblclick();

    const codeInput = codeCell.locator('input');
    await expect(codeInput).toBeVisible();

    const testSprintCode = `E2E_Sprint_${Date.now()}`;
    await codeInput.fill(testSprintCode);
    await codeInput.press('Enter');
    console.log(`✅ Sprint code set to: ${testSprintCode}`);

    // Шаг 6: Ждем автосохранения
    await waitForAutoSave(page, { savedTimeout: 5000 });
    console.log('✅ Changes saved');

    // Шаг 7: Перезагружаем страницу
    await page.reload();
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Шаг 8: Переключаемся на вкладку Спринты
    await sprintsTab.click();
    await expect(page.getByTestId('sprint-table-container')).toBeVisible({ timeout: 5000 });
    console.log('✅ Page reloaded and switched to Sprints tab');

    // Шаг 9: Проверяем, что спринт сохранился
    await expect(page.locator(`text=${testSprintCode}`)).toBeVisible({ timeout: 5000 });
    console.log('✅ Sprint persisted after page reload');

    // Шаг 10: Удаляем тестовый спринт через контекстное меню
    const testSprintRow = page.locator('tr').filter({ hasText: testSprintCode });
    await testSprintRow.click({ button: 'right' });

    const deleteButton = page.locator('button').filter({ hasText: 'Удалить' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    console.log('✅ Sprint deleted');

    // Шаг 11: Ждем автосохранения удаления (важно: ждем сначала "несохраненные изменения")
    await waitForAutoSave(page, { savedTimeout: 5000, waitForUnsaved: true });

    // Шаг 12: Проверяем удаление после перезагрузки
    await page.reload();
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await sprintsTab.click();
    await expect(page.getByTestId('sprint-table-container')).toBeVisible({ timeout: 5000 });

    await expect(page.locator(`text=${testSprintCode}`)).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Sprint deletion persisted');

    console.log('✨ Test passed: Sprint changes saved correctly!');
  });

  test('should save team changes to server', async ({ page }) => {
    // Шаг 1: Открываем страницу
    await page.goto('/');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    console.log('✅ Page loaded');

    // Шаг 2: Переключаемся на вкладку Команды
    const teamsTab = page.getByTestId('tab-teams');
    await teamsTab.click();
    await expect(page.getByTestId('team-table-container')).toBeVisible({ timeout: 5000 });
    console.log('✅ Switched to Teams tab');

    // Шаг 3: Запоминаем количество команд
    const teamRows = page.locator('[data-testid="team-table-container"] tbody tr');
    const initialTeamCount = await teamRows.count();
    console.log(`Initial team count: ${initialTeamCount}`);

    // Шаг 4: Добавляем новую команду
    const addTeamButton = page.getByTestId('add-team-button');
    await addTeamButton.click();

    // Проверяем, что команда добавлена
    await expect(teamRows).toHaveCount(initialTeamCount + 1);
    console.log('✅ Team added');

    // Шаг 5: Редактируем название новой команды
    const lastTeamRow = teamRows.nth(initialTeamCount);
    const nameCell = lastTeamRow.locator('td').first();
    await nameCell.dblclick();

    const nameInput = nameCell.locator('input');
    await expect(nameInput).toBeVisible();

    const testTeamName = `E2E_Team_${Date.now()}`;
    await nameInput.fill(testTeamName);
    await nameInput.press('Enter');
    console.log(`✅ Team name set to: ${testTeamName}`);

    // Шаг 6: Ждем автосохранения
    await waitForAutoSave(page, { savedTimeout: 5000 });
    console.log('✅ Changes saved');

    // Шаг 7: Перезагружаем страницу
    await page.reload();
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });

    // Шаг 8: Переключаемся на вкладку Команды
    await teamsTab.click();
    await expect(page.getByTestId('team-table-container')).toBeVisible({ timeout: 5000 });
    console.log('✅ Page reloaded and switched to Teams tab');

    // Шаг 9: Проверяем, что команда сохранилась
    await expect(page.locator(`text=${testTeamName}`)).toBeVisible({ timeout: 5000 });
    console.log('✅ Team persisted after page reload');

    // Шаг 10: Удаляем тестовую команду через контекстное меню
    const testTeamRow = page.locator('tr').filter({ hasText: testTeamName });
    await testTeamRow.click({ button: 'right' });

    const deleteButton = page.locator('button').filter({ hasText: 'Удалить' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    console.log('✅ Team deleted');

    // Шаг 11: Ждем автосохранения удаления (важно: ждем сначала "несохраненные изменения")
    await waitForAutoSave(page, { savedTimeout: 5000, waitForUnsaved: true });

    // Шаг 12: Проверяем удаление после перезагрузки
    await page.reload();
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await teamsTab.click();
    await expect(page.getByTestId('team-table-container')).toBeVisible({ timeout: 5000 });

    await expect(page.locator(`text=${testTeamName}`)).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Team deletion persisted');

    console.log('✨ Test passed: Team changes saved correctly!');
  });
});
