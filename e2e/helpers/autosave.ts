import { expect, Page } from '@playwright/test';

/**
 * Ожидает завершения автосохранения, отслеживая статусы сохранения
 * @param page - Playwright Page объект
 * @param options - Опции для настройки таймаутов
 */
export async function waitForAutoSave(
  page: Page,
  options: {
    unsavedTimeout?: number;
    savedTimeout?: number;
  } = {}
) {
  const { unsavedTimeout = 3000, savedTimeout = 10000 } = options;

  // Ждем появления статуса "Есть несохраненные изменения"
  const unsavedStatus = page.getByTestId('save-status-unsaved');
  try {
    await expect(unsavedStatus).toBeVisible({ timeout: unsavedTimeout });
    console.log('Status: Unsaved changes detected');
  } catch (error) {
    console.log('Status: Unsaved changes status not detected (may have saved too quickly)');
  }

  // Ждем появления статуса "Сохранено"
  const savedStatus = page.getByTestId('save-status-saved');
  await expect(savedStatus).toBeVisible({ timeout: savedTimeout });
  console.log('Status: Saved successfully');
}
