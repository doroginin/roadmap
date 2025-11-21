import { expect, Page } from '@playwright/test';

/**
 * Ожидает завершения автосохранения, отслеживая статусы сохранения
 * @param page - Playwright Page объект
 * @param options - Опции для настройки таймаутов
 */
export async function waitForAutoSave(
  page: Page,
  options: {
    savedTimeout?: number;
  } = {}
) {
  const { savedTimeout = 3000 } = options;

  // Ждем появления статуса "Сохранено"
  const savedStatus = page.getByTestId('save-status-saved');
  await expect(savedStatus).toBeVisible({ timeout: savedTimeout });
  console.log('Status: Saved successfully');
}
