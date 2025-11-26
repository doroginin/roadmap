import { test, expect } from '@playwright/test';

test.describe('Context menu close functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Ждем загрузки данных
    await page.waitForSelector('[data-testid="tab-plan"]', { state: 'visible' });
    
    // Убедимся, что мы на вкладке "План"
    const planTab = page.locator('[data-testid="tab-plan"]');
    await expect(planTab).toBeVisible();
  });

  test('should close context menu when clicking outside on table cell', async ({ page }) => {
    // Находим первую строку с ресурсом
    const firstResourceRow = page.locator('tr[data-row-id]').first();
    
    // Открываем контекстное меню правым кликом
    await firstResourceRow.click({ button: 'right' });
    
    // Проверяем, что контекстное меню появилось
    const contextMenu = page.locator('[data-testid="context-menu"]');
    await expect(contextMenu).toBeVisible();
    
    // Кликаем мышкой в стороне от меню (координаты левее и выше)
    await page.mouse.click(50, 100);
    
    // Проверяем, что контекстное меню закрылось
    await expect(contextMenu).not.toBeVisible();
  });

  test('should close context menu when clicking outside on empty space', async ({ page }) => {
    // Находим первую строку с задачей
    const firstTaskRow = page.locator('tbody').nth(1).locator('tr').first();
    
    // Открываем контекстное меню правым кликом
    await firstTaskRow.click({ button: 'right' });
    
    // Проверяем, что контекстное меню появилось
    const contextMenu = page.locator('[data-testid="context-menu"]');
    await expect(contextMenu).toBeVisible();
    
    // Кликаем в пустое место на странице
    await page.mouse.click(10, 10);
    
    // Проверяем, что контекстное меню закрылось
    await expect(contextMenu).not.toBeVisible();
  });

  test('should close context menu after selecting an option', async ({ page }) => {
    // Находим первую строку с ресурсом
    const firstResourceRow = page.locator('tr[data-row-id]').first();
    
    // Открываем контекстное меню правым кликом
    await firstResourceRow.click({ button: 'right' });
    
    // Проверяем, что контекстное меню появилось
    const contextMenu = page.locator('[data-testid="context-menu"]');
    await expect(contextMenu).toBeVisible();
    
    // Нажимаем на кнопку "Добавить ниже"
    const addBelowButton = page.locator('[data-testid="add-row-below-button"]');
    await addBelowButton.click();
    
    // Небольшая задержка для обработки события
    await page.waitForTimeout(100);
    
    // Проверяем, что контекстное меню закрылось
    await expect(contextMenu).not.toBeVisible();
  });
});

