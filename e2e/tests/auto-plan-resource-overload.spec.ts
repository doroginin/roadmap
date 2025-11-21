import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Auto Plan and Resource Overload', () => {
  test('should auto-plan task, detect overload on manual edit, and restore auto-plan', async ({ page }) => {
    // Generate random function name to avoid conflicts
    const randomFn = `FN${Math.floor(Math.random() * 10000)}`;
    let resourceId = '';
    let taskId = '';

    console.log(`\n🎲 Using random function: ${randomFn}`);

    // Step 1: Open page with E2E team filter
    console.log('\n📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    
    // Wait for data to load
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter');

    // Step 2: Add new resource
    console.log('\n➕ Step 2: Adding new resource');
    
    // Click "Add" button
    await page.getByText('+ Добавить').click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    
    // Click "Add Resource"
    await page.getByTestId('add-resource-button').click();
    await expect(page.getByTestId('add-menu')).not.toBeVisible();

    // Find all resource rows and get the last one (newest)
    const resourceRows = page.locator('tr[data-testid="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);
    
    // Get resource ID from data-row-id attribute
    resourceId = await newResourceRow.getAttribute('data-row-id') || '';
    console.log(`New resource ID: ${resourceId}`);
    
    // Fill in function name using data-testid
    const fnCell = newResourceRow.locator(`[data-testid="fn-cell-${resourceId}"]`);
    await fnCell.dblclick(); // Double-click to start editing
    await page.keyboard.type(randomFn);
    await page.keyboard.press('Enter');
    
    console.log(`✅ Resource with Fn="${randomFn}" added`);

    // Step 3: Add available resources for weeks 2-5 with value 1
    console.log('\n📅 Step 3: Setting resource availability for weeks 2-5');
    
    // Find resource row by ID to ensure we're working with the right row
    const ourResourceRow = page.locator(`tr[data-row-id="${resourceId}"]`);
    
    // Set weeks 2-5 to value 1 using double-click to enter value
    for (let weekNum = 2; weekNum <= 5; weekNum++) {
      const weekCell = ourResourceRow.locator(`[data-testid="week-${weekNum}"]`);
      await weekCell.dblclick();
      // Type 1 and press Enter to confirm
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
    }
    
    console.log('✅ Resource availability set for weeks 2-5 (value 1)');
    
    // Verify resource weeks were set correctly
    for (let weekNum = 2; weekNum <= 5; weekNum++) {
      const weekCell = ourResourceRow.locator(`[data-testid="week-${weekNum}"]`);
      const weekText = await weekCell.textContent();
      console.log(`Resource week ${weekNum} content: "${weekText}"`);
    }

    // Save changes manually
    await page.getByText('Сохранить').click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    // Step 4: Add new task
    console.log('\n➕ Step 4: Adding new task for this resource');
    
    await page.getByText('+ Добавить').click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    await page.getByTestId('add-task-button').click();
    await expect(page.getByTestId('add-menu')).not.toBeVisible();

    // Find the new task row (last one in the list)
    const taskRows = page.locator('tr[data-testid="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);
    
    taskId = await newTaskRow.getAttribute('data-row-id') || '';
    console.log(`New task ID: ${taskId}`);
    
    // Fill in task details: Fn, planEmpl, planWeeks
    // Set Fn to match the resource function using Select dropdown
    const taskFnCell = newTaskRow.locator(`[data-testid="fn-cell-${taskId}"]`);
    await taskFnCell.dblclick(); // Double-click to open Select

    // Wait for Select dropdown to open and find the option with our random function
    const selectOption = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption).toBeVisible({ timeout: 5000 });
    
    // Click on the option to select it
    await selectOption.click();

    console.log(`Fn "${randomFn}" selected for task`);

    // Set planEmpl = 1
    const taskPlanEmplCell = newTaskRow.locator(`[data-testid="planEmpl-cell-${taskId}"]`);
    await taskPlanEmplCell.dblclick();
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');

    // Set planWeeks = 2
    const taskPlanWeeksCell = newTaskRow.locator(`[data-testid="planWeeks-cell-${taskId}"]`);
    await taskPlanWeeksCell.dblclick();
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');

    console.log(`✅ Task configured: Fn=${randomFn}, planEmpl=1, planWeeks=2`);

    // Save and wait for auto-plan calculation
    console.log('Saving and waiting for auto-plan calculation...');
    await page.getByText('Сохранить').click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    // Step 5: Verify auto-plan scheduled task on weeks 2 and 3
    console.log('\n✅ Step 5: Verifying auto-plan scheduled task on weeks 2-3');
    
    // Find our task by ID
    const ourTaskRow = page.locator(`tr[data-row-id="${taskId}"]`);
    
    // Debug: Check task parameters
    const taskFnText = await ourTaskRow.locator(`[data-testid="fn-cell-${taskId}"]`).textContent();
    const taskPlanEmplText = await ourTaskRow.locator(`[data-testid="planEmpl-cell-${taskId}"]`).textContent();
    const taskPlanWeeksText = await ourTaskRow.locator(`[data-testid="planWeeks-cell-${taskId}"]`).textContent();
    const taskAutoCheckbox = ourTaskRow.locator('input[type="checkbox"]');
    const isAutoChecked = await taskAutoCheckbox.isChecked();
    
    console.log(`Task Fn: "${taskFnText}"`);
    console.log(`Task planEmpl: "${taskPlanEmplText}"`);
    console.log(`Task planWeeks: "${taskPlanWeeksText}"`);
    console.log(`Task Auto checked: ${isAutoChecked}`);
    
    // Debug: Check what's in week 2 cell
    const taskWeek2Cell = ourTaskRow.locator(`[data-testid="week-2"]`);
    const week2Text = await taskWeek2Cell.textContent();
    console.log(`Task week 2 content: "${week2Text}"`);
    
    // Check week 2 has value 1
    await expect(taskWeek2Cell).toContainText('1', { timeout: 10000 });
    
    // Check week 3 has value 1
    const taskWeek3Cell = ourTaskRow.locator(`[data-testid="week-3"]`);
    await expect(taskWeek3Cell).toContainText('1', { timeout: 5000 });
    
    console.log('✅ Task auto-planned on weeks 2-3 with value 1 each');

    // Step 6: Manually edit week 3 from 1 to 2
    console.log('\n✏️ Step 6: Manually editing week 3 from 1 to 2');

    await taskWeek3Cell.dblclick();

    // Clear existing value and type new value
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');

    console.log('✅ Week 3 changed to 2');

    // Save changes
    await page.getByText('Сохранить').click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    // Step 7: Verify Auto checkbox is unchecked
    console.log('\n🔍 Step 7: Verifying Auto checkbox is unchecked');
    
    const autoCheckbox = ourTaskRow.locator('input[type="checkbox"]');
    await expect(autoCheckbox).not.toBeChecked({ timeout: 5000 });
    
    console.log('✅ Auto checkbox is unchecked');

    // Step 8: Verify resource week 3 shows overload (red highlight)
    console.log('\n🔍 Step 8: Verifying resource week 3 shows overload');
    
    // Find resource row again
    const resourceRowAfterEdit = page.locator(`tr[data-row-id="${resourceId}"]`);
    const resourceWeek3Cell = resourceRowAfterEdit.locator(`[data-testid="week-3"]`);
    
    // Check if cell has red/overload styling by checking background color
    const week3CellBg = await resourceWeek3Cell.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Red color in RGB is typically rgb(254, 202, 202) or similar
    const hasRedHighlight = week3CellBg.includes('254') || week3CellBg.includes('252');
    
    expect(hasRedHighlight).toBeTruthy();
    console.log(`✅ Resource week 3 shows red overload indicator (bg: ${week3CellBg})`);

    // Step 9: Re-enable Auto and confirm
    console.log('\n🔄 Step 9: Re-enabling Auto plan');
    
    // Set up dialog handler BEFORE clicking the checkbox
    page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept();
    });
    
    await autoCheckbox.click();

    console.log('✅ Auto plan re-enabled and confirmed');

    // Save
    await page.getByText('Сохранить').click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    // Step 10: Verify manual edit was reverted
    console.log('\n✅ Step 10: Verifying manual edit was reverted');
    
    // Week 3 should be back to 1
    await expect(taskWeek3Cell).toContainText('1', { timeout: 5000 });
    console.log('✅ Week 3 reverted back to 1');

    // Step 11: Verify resource week 3 no longer shows overload
    console.log('\n✅ Step 11: Verifying resource overload indicator is gone');

    const week3CellBgAfter = await resourceWeek3Cell.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // After reverting, background should not be red
    const hasRedHighlightAfter = week3CellBgAfter.includes('254') || week3CellBgAfter.includes('252');
    
    expect(hasRedHighlightAfter).toBeFalsy();
    console.log(`✅ Resource week 3 no longer shows red overload (bg: ${week3CellBgAfter})`);

    // Step 12: Delete test task
    console.log('\n🗑️ Step 12: Deleting test task');
    
    // Right-click on task row
    const taskRowForDelete = page.locator(`tr[data-row-id="${taskId}"]`);
    await taskRowForDelete.click({ button: 'right', force: true, position: { x: 10, y: 10 } });
    
    // Wait for context menu
    const contextMenu = page.getByTestId('context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    
    // Click delete button
    await page.getByTestId('context-menu-delete').click();
    
    // Wait for task to be removed
    await expect(taskRowForDelete).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Test task deleted');

    // Step 13: Delete test resource
    console.log('\n🗑️ Step 13: Deleting test resource');
    
    // Right-click on resource row
    const resourceRowForDelete = page.locator(`tr[data-row-id="${resourceId}"]`);
    await resourceRowForDelete.click({ button: 'right', force: true, position: { x: 10, y: 10 } });
    
    // Wait for context menu
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    
    // Click delete button
    await page.getByTestId('context-menu-delete').click();
    
    // Wait for resource to be removed
    await expect(resourceRowForDelete).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Test resource deleted');

    // Step 14: Save changes to ensure deletions are sent to server
    console.log('\n💾 Step 14: Saving changes to server');
    
    // Click save button
    const saveButton = page.getByText('Сохранить');
    await saveButton.click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    console.log('✅ Changes saved to server');

    console.log('\n✨ All steps completed successfully!');
  });
});

