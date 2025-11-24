import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Resources reordering functionality', () => {
  test('should create three resources, reorder them, save, and verify order persists after reload', async ({ page }) => {
    // Generate unique function names for this test
    const fn1 = `FN${Math.floor(Math.random() * 10000)}_A`;
    const fn2 = `FN${Math.floor(Math.random() * 10000)}_B`;
    const fn3 = `FN${Math.floor(Math.random() * 10000)}_C`;

    console.log(`\n🎲 Creating resources: ${fn1}, ${fn2}, ${fn3}`);

    // Шаг 1: Открываем страницу с фильтром по команде E2E
    console.log('\n📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter');

    // Шаг 2: Создаем три ресурса
    console.log('\n➕ Step 2: Creating three resources');
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();

    const resourceIds: string[] = [];
    const resourceFns = [fn1, fn2, fn3];

    for (let i = 0; i < 3; i++) {
      await addButton.click();
      await expect(page.getByTestId('add-menu')).toBeVisible();
      await page.getByTestId('add-resource-button').click();

      const resourceRows = page.locator('[data-row-kind="resource"]');
      const resourceCount = await resourceRows.count();
      const newResourceRow = resourceRows.nth(resourceCount - 1);
      const resourceId = await newResourceRow.getAttribute('data-row-id');
      if (!resourceId) throw new Error(`Resource ${i + 1} ID not found`);

      resourceIds.push(resourceId);
      console.log(`Created resource ${i + 1} with ID: ${resourceId}`);

      // Устанавливаем функцию ресурса
      const fnCell = page.getByTestId(`fn-cell-${resourceId}`);
      await fnCell.scrollIntoViewIfNeeded();
      await fnCell.dblclick();
      const fnInput = page.getByTestId(`resource-input-${resourceId}`);
      await expect(fnInput).toBeVisible();
      await fnInput.fill(resourceFns[i]);
      await fnInput.press('Enter');
      console.log(`✅ Resource ${i + 1} function set: ${resourceFns[i]}`);

      // Устанавливаем доступность ресурса для первой недели
      const resourceRow = page.locator(`tr[data-row-id="${resourceId}"]`);
      const weekCell = resourceRow.locator(`[data-testid="week-1"]`);
      await weekCell.dblclick();
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
      console.log(`✅ Resource ${i + 1} availability set`);
    }

    // Шаг 3: Сохраняем изменения
    console.log('\n💾 Step 3: Saving initial resources');
    const saveButton = page.getByText('Сохранить');
    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Resources saved');

    // Шаг 4: Проверяем начальный порядок (должен быть fn1, fn2, fn3)
    console.log('\n📊 Step 4: Verifying initial order');
    let resourceRows = page.locator('[data-row-kind="resource"]');

    // Находим индексы наших ресурсов
    const getResourceIndices = async () => {
      const count = await resourceRows.count();
      const indices: { [key: string]: number } = {};

      for (let i = 0; i < count; i++) {
        const row = resourceRows.nth(i);
        const rowId = await row.getAttribute('data-row-id');
        if (rowId && resourceIds.includes(rowId)) {
          const idx = resourceIds.indexOf(rowId);
          indices[resourceFns[idx]] = i;
        }
      }
      return indices;
    };

    let indices = await getResourceIndices();
    console.log(`Initial order indices: ${fn1}=${indices[fn1]}, ${fn2}=${indices[fn2]}, ${fn3}=${indices[fn3]}`);

    // Проверяем что порядок правильный (fn1 < fn2 < fn3)
    expect(indices[fn1]).toBeLessThan(indices[fn2]);
    expect(indices[fn2]).toBeLessThan(indices[fn3]);
    console.log('✅ Initial order is correct');

    // Шаг 5: Перемещаем ресурсы (меняем порядок на fn3, fn1, fn2)
    console.log('\n🔄 Step 5: Reordering resources (moving last to first)');

    // Перемещаем fn3 (последний) на место fn1 (первый)
    const resource3Row = page.locator(`tr[data-row-id="${resourceIds[2]}"]`);
    const resource1Row = page.locator(`tr[data-row-id="${resourceIds[0]}"]`);

    const draggableCell3 = resource3Row.locator('.draggable-cell').first();
    const draggableCell1 = resource1Row.locator('.draggable-cell').first();

    await draggableCell3.scrollIntoViewIfNeeded();
    await expect(draggableCell3).toBeVisible();
    await draggableCell1.scrollIntoViewIfNeeded();
    await expect(draggableCell1).toBeVisible();

    // Выполняем drag and drop
    const cell3Box = await draggableCell3.boundingBox();
    const cell1Box = await draggableCell1.boundingBox();
    if (!cell3Box || !cell1Box) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(cell3Box.x + cell3Box.width / 2, cell3Box.y + cell3Box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cell1Box.x + cell1Box.width / 2, cell1Box.y + cell1Box.height / 2 - 5, { steps: 10 });
    await page.mouse.up();

    console.log(`✅ Dragged ${fn3} to the top`);

    // Ждем немного чтобы UI обновился
    await page.waitForTimeout(500);

    // Проверяем новый порядок в UI
    indices = await getResourceIndices();
    console.log(`New order indices: ${fn1}=${indices[fn1]}, ${fn2}=${indices[fn2]}, ${fn3}=${indices[fn3]}`);

    // Теперь порядок должен быть fn3 < fn1 < fn2
    expect(indices[fn3]).toBeLessThan(indices[fn1]);
    expect(indices[fn1]).toBeLessThan(indices[fn2]);
    console.log('✅ Order changed in UI');

    // Шаг 6: Сохраняем изменения
    console.log('\n💾 Step 6: Saving reordered resources');
    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Changes saved');

    // Шаг 7: Обновляем страницу
    console.log('\n🔄 Step 7: Reloading page to verify order persistence');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page reloaded');

    // Шаг 8: Проверяем что порядок сохранился (должен быть fn3, fn1, fn2)
    console.log('\n📊 Step 8: Verifying order persisted after reload');

    // Проверяем что все ресурсы существуют
    await expect(page.getByTestId(`fn-cell-${resourceIds[0]}`)).toContainText(fn1);
    await expect(page.getByTestId(`fn-cell-${resourceIds[1]}`)).toContainText(fn2);
    await expect(page.getByTestId(`fn-cell-${resourceIds[2]}`)).toContainText(fn3);
    console.log('✅ All three resources persisted');

    resourceRows = page.locator('[data-row-kind="resource"]');
    indices = await getResourceIndices();
    console.log(`Order after reload: ${fn1}=${indices[fn1]}, ${fn2}=${indices[fn2]}, ${fn3}=${indices[fn3]}`);

    // Порядок должен остаться fn3 < fn1 < fn2
    expect(indices[fn3]).toBeLessThan(indices[fn1]);
    expect(indices[fn1]).toBeLessThan(indices[fn2]);
    console.log('✅ Order persisted correctly after page reload!');

    // Шаг 9: Очистка - удаляем ресурсы
    console.log('\n🗑️  Step 9: Cleaning up test data');

    for (let i = 0; i < resourceIds.length; i++) {
      const resourceRow = page.locator(`tr[data-row-id="${resourceIds[i]}"]`);
      await resourceRow.scrollIntoViewIfNeeded();
      await resourceRow.click({ button: 'right' });
      await page.getByTestId('context-menu-delete').click();
    }

    await saveButton.click();
    await waitForAutoSave(page);
    console.log('✅ Test data deleted');

    console.log('\n✨ Test completed successfully! Resource reordering is working and persists after reload.');
  });
});
