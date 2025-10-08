import { test, expect } from '@playwright/test';

test.describe('Frozen Columns Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should have frozen columns with sticky positioning', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Проверяем, что колонки имеют стили закрепления
    const typeColumn = page.locator('th').filter({ hasText: 'Тип' });
    const statusColumn = page.locator('th').filter({ hasText: 'Status' });
    const teamColumn = page.locator('th').filter({ hasText: 'Team' });
    const autoColumn = page.locator('th').filter({ hasText: 'Auto' }).first();

    // Проверяем, что колонки существуют
    await expect(typeColumn).toBeVisible();
    await expect(statusColumn).toBeVisible();
    await expect(teamColumn).toBeVisible();
    await expect(autoColumn).toBeVisible();

    // Проверяем стили закрепления для колонок
    const typeColumnStyle = await typeColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(typeColumnStyle.position).toBe('sticky');
    expect(typeColumnStyle.left).toBe('0px');
    expect(typeColumnStyle.zIndex).toBe('15');

    // Проверяем стили для колонки Status
    const statusColumnStyle = await statusColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(statusColumnStyle.position).toBe('sticky');
    expect(parseInt(statusColumnStyle.left)).toBeGreaterThan(0);
    expect(statusColumnStyle.zIndex).toBe('15');

    // Проверяем стили для колонки Team
    const teamColumnStyle = await teamColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(teamColumnStyle.position).toBe('sticky');
    expect(parseInt(teamColumnStyle.left)).toBeGreaterThan(0);
    expect(teamColumnStyle.zIndex).toBe('15');

    // Проверяем стили для колонки Auto
    const autoColumnStyle = await autoColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(autoColumnStyle.position).toBe('sticky');
    expect(parseInt(autoColumnStyle.left)).toBeGreaterThan(0);
    expect(autoColumnStyle.zIndex).toBe('15');
  });

  test('should have frozen cells in resource rows', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Находим первую строку ресурса
    const resourceRow = page.locator('tr').filter({ hasText: 'Ресурс' }).first();
    await expect(resourceRow).toBeVisible();

    // Проверяем, что ячейки в строке ресурса имеют стили закрепления
    const typeCell = resourceRow.locator('td').first();
    const teamCell = resourceRow.locator('td').nth(2); // Team колонка

    // Проверяем стили для ячейки Тип
    const typeCellStyle = await typeCell.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(typeCellStyle.position).toBe('sticky');
    expect(typeCellStyle.left).toBe('0px');
    expect(typeCellStyle.zIndex).toBe('15');

    // Проверяем стили для ячейки Team
    const teamCellStyle = await teamCell.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(teamCellStyle.position).toBe('sticky');
    expect(parseInt(teamCellStyle.left)).toBeGreaterThan(0);
    expect(teamCellStyle.zIndex).toBe('15');
  });

  test('should have frozen cells in task rows', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Находим первую строку задачи
    const taskRow = page.locator('tr').filter({ hasText: 'Задача' }).first();
    await expect(taskRow).toBeVisible();

    // Проверяем, что ячейки в строке задачи имеют стили закрепления
    const typeCell = taskRow.locator('td').first();
    const statusCell = taskRow.locator('td').nth(1); // Status колонка
    const teamCell = taskRow.locator('td').nth(5); // Team колонка

    // Проверяем стили для ячейки Тип
    const typeCellStyle = await typeCell.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(typeCellStyle.position).toBe('sticky');
    expect(typeCellStyle.left).toBe('0px');
    expect(typeCellStyle.zIndex).toBe('15');

    // Проверяем стили для ячейки Status
    const statusCellStyle = await statusCell.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(statusCellStyle.position).toBe('sticky');
    expect(parseInt(statusCellStyle.left)).toBeGreaterThan(0);
    expect(statusCellStyle.zIndex).toBe('15');

    // Проверяем стили для ячейки Team
    const teamCellStyle = await teamCell.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(teamCellStyle.position).toBe('sticky');
    expect(parseInt(teamCellStyle.left)).toBeGreaterThan(0);
    expect(teamCellStyle.zIndex).toBe('15');
  });

  test('should have frozen resource rows under header', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Находим tbody с ресурсными строками (первый tbody)
    const resourceTbody = page.locator('tbody').first();
    await expect(resourceTbody).toBeVisible();

    // Проверяем, что tbody с ресурсами имеет стили закрепления
    const tbodyStyle = await resourceTbody.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        top: computedStyle.top,
        zIndex: computedStyle.zIndex
      };
    });
    
    expect(tbodyStyle.position).toBe('sticky');
    expect(tbodyStyle.top).toBe('48px'); // 48px = 3rem (высота шапки)
    expect(tbodyStyle.zIndex).toBe('8');

    // Проверяем, что есть ресурсные строки
    const resourceRows = resourceTbody.locator('tr');
    const resourceCount = await resourceRows.count();
    expect(resourceCount).toBeGreaterThan(0);

    // Проверяем, что первая строка ресурса имеет правильный текст
    const firstResourceRow = resourceRows.first();
    const firstCell = firstResourceRow.locator('td').first();
    await expect(firstCell).toContainText('Ресурс');
  });

  test('should have frozen Sprints and Task columns in header', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Находим колонки Sprints и Task в шапке
    const sprintsColumn = page.locator('th').filter({ hasText: 'Sprints' });
    const taskColumn = page.locator('th').filter({ hasText: 'Task' });

    // Проверяем, что колонки существуют
    await expect(sprintsColumn).toBeVisible();
    await expect(taskColumn).toBeVisible();

    // Проверяем стили закрепления для колонки Sprints
    const sprintsColumnStyle = await sprintsColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(sprintsColumnStyle.position).toBe('sticky');
    expect(parseInt(sprintsColumnStyle.left)).toBeGreaterThan(0);
    expect(sprintsColumnStyle.zIndex).toBe('15');

    // Проверяем стили закрепления для колонки Task
    const taskColumnStyle = await taskColumn.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex
      };
    });

    expect(taskColumnStyle.position).toBe('sticky');
    expect(parseInt(taskColumnStyle.left)).toBeGreaterThan(0);
    expect(taskColumnStyle.zIndex).toBe('15');
  });

  test('should have correct z-index hierarchy for task rows', async ({ page }) => {
    // Проверяем, что таблица загружена
    await expect(page.getByTestId('roadmap-table')).toBeVisible();

    // Находим tbody с задачами (второй tbody)
    const taskTbody = page.locator('tbody').nth(1);
    await expect(taskTbody).toBeVisible();

    // Проверяем, что tbody с задачами имеет правильный z-index
    const taskTbodyStyle = await taskTbody.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        zIndex: computedStyle.zIndex
      };
    });
    
    expect(taskTbodyStyle.position).toBe('relative');
    expect(taskTbodyStyle.zIndex).toBe('1');

    // Находим первую строку задачи
    const taskRow = page.locator('tr').filter({ hasText: 'Задача' }).first();
    await expect(taskRow).toBeVisible();

    // Проверяем, что строка задачи имеет правильный z-index
    const taskRowStyle = await taskRow.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return {
        position: computedStyle.position,
        zIndex: computedStyle.zIndex
      };
    });

    expect(taskRowStyle.position).toBe('relative');
    expect(taskRowStyle.zIndex).toBe('1');
  });
});
