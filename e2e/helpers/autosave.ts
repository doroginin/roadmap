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
    waitForUnsaved?: boolean;  // Ждать ли сначала появления несохраненных изменений
  } = {}
) {
  const { savedTimeout = 3000, waitForUnsaved = false } = options;

  // Если нужно дождаться несохраненных изменений сначала
  if (waitForUnsaved) {
    // Ждем появления статуса "Есть несохраненные изменения" или "Сохранение..."
    const unsavedStatus = page.getByTestId('save-status-unsaved');
    const savingStatus = page.getByTestId('save-status-saving');

    try {
      // Пробуем дождаться одного из статусов (короткий timeout т.к. может быть очень быстро)
      await Promise.race([
        expect(unsavedStatus).toBeVisible({ timeout: 2000 }),
        expect(savingStatus).toBeVisible({ timeout: 2000 })
      ]);
    } catch {
      // Если не появился - возможно сохранение уже началось и закончилось очень быстро
    }
  }

  // Ждем появления статуса "Сохранено"
  const savedStatus = page.getByTestId('save-status-saved');
  await expect(savedStatus).toBeVisible({ timeout: savedTimeout });
}
