import { test, expect } from '@playwright/test';
import { waitForAutoSave } from '../helpers/autosave';

test.describe('Auto Plan Recalculation', () => {
  test('should recalculate plan when planWeeks or planEmpl changes for task with autoPlanEnabled', async ({ page }) => {
    // Generate unique function name for this test
    const randomFn = `FN${Math.floor(Math.random() * 10000)}`;
    console.log(`\n🎲 Using random function: ${randomFn}\n`);

    // Step 1: Open page with E2E filter
    console.log('📖 Step 1: Opening page with E2E team filter');
    await page.goto('/?filter_team=E2E');
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('roadmap-table')).toBeVisible();
    console.log('✅ Page loaded with E2E filter\n');

    // Step 2: Add new resource
    console.log('➕ Step 2: Adding new resource');
    const addButton = page.getByTestId('add-button');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    const addResourceButton = page.getByTestId('add-resource-button');
    await expect(addResourceButton).toBeVisible();
    await addResourceButton.click();

    // Find the newly added resource
    const resourceRows = page.locator('[data-row-kind="resource"]');
    const resourceCount = await resourceRows.count();
    const newResourceRow = resourceRows.nth(resourceCount - 1);
    const resourceId = await newResourceRow.getAttribute('data-row-id');
    if (!resourceId) throw new Error('Resource ID not found');
    console.log(`New resource ID: ${resourceId}`);

    // Set resource function
    const fnCell = page.getByTestId(`fn-cell-${resourceId}`);
    await fnCell.dblclick();
    const fnInput = page.getByTestId(`resource-input-${resourceId}`);
    await expect(fnInput).toBeVisible();
    await fnInput.fill(randomFn);
    await fnInput.press('Enter');
    console.log(`✅ Resource with Fn="${randomFn}" added\n`);

    // Step 3: Set resource availability for weeks 1-10 (value: 1)
    console.log('📅 Step 3: Setting resource availability for weeks 1-10');
    const resourceRow = page.locator(`tr[data-row-id="${resourceId}"]`);
    for (let week = 1; week <= 10; week++) {
      const weekCell = resourceRow.locator(`[data-testid="week-${week}"]`);
      await weekCell.dblclick();
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
    }
    console.log('✅ Resource availability set for weeks 1-10 (value 1)\n');

    // Step 4: Add new task
    console.log('➕ Step 4: Adding new task for this resource');
    await addButton.click();
    await expect(page.getByTestId('add-menu')).toBeVisible();
    const addTaskButton = page.getByTestId('add-task-button');
    await expect(addTaskButton).toBeVisible();
    await addTaskButton.click();

    // Find the newly added task
    const taskRows = page.locator('[data-row-kind="task"]');
    const taskCount = await taskRows.count();
    const newTaskRow = taskRows.nth(taskCount - 1);
    const taskId = await newTaskRow.getAttribute('data-row-id');
    if (!taskId) throw new Error('Task ID not found');
    console.log(`New task ID: ${taskId}`);

    // Set task function to match resource
    const taskFnCell = page.getByTestId(`fn-cell-${taskId}`);
    await taskFnCell.dblclick();
    
    // Wait for Select dropdown to open and find the option with our random function
    const selectOption = page.getByTestId(`select-option-${randomFn}`);
    await expect(selectOption).toBeVisible({ timeout: 5000 });
    await selectOption.click();
    console.log(`Fn "${randomFn}" selected for task`);

    // Set planEmpl = 1
    const planEmplCell = page.getByTestId(`planEmpl-cell-${taskId}`);
    await planEmplCell.dblclick();
    const planEmplInput = page.getByTestId(`planEmpl-input-${taskId}`);
    await expect(planEmplInput).toBeVisible();
    await planEmplInput.fill('1');
    await planEmplInput.press('Enter');

    // Set planWeeks = 3
    const planWeeksCell = page.getByTestId(`planWeeks-cell-${taskId}`);
    await planWeeksCell.dblclick();
    const planWeeksInput = page.getByTestId(`planWeeks-input-${taskId}`);
    await expect(planWeeksInput).toBeVisible();
    await planWeeksInput.fill('3');
    await planWeeksInput.press('Enter');
    console.log('✅ Task configured: Fn=' + randomFn + ', planEmpl=1, planWeeks=3');

    // Get task row for future operations
    const taskRow = page.locator(`tr[data-row-id="${taskId}"]`);
    
    // Verify Auto checkbox is checked by default
    const autoCheckbox = taskRow.locator('input[type="checkbox"]');
    await expect(autoCheckbox).toBeChecked();

    // Save and wait for auto-plan to trigger
    console.log('Saving and waiting for auto-plan calculation...\n');
    await page.getByTestId('manual-save-button').click();
    // Ждем автосохранения
    await waitForAutoSave(page);

    // Step 5: Verify initial auto-plan (should be on weeks 1-3)
    console.log('✅ Step 5: Verifying initial auto-plan scheduled on weeks 1-3');
    for (let week = 1; week <= 3; week++) {
      const weekCell = taskRow.locator(`[data-testid="week-${week}"]`);
      const weekContent = await weekCell.textContent();
      expect(weekContent?.trim()).toBe('1');
      console.log(`Week ${week} content: "${weekContent?.trim()}"`);
    }
    console.log('✅ Task auto-planned on weeks 1-3 with value 1 each\n');

    // Step 6: Change planWeeks from 3 to 5
    console.log('📝 Step 6: Changing planWeeks from 3 to 5');
    await planWeeksCell.dblclick();
    const planWeeksInput2 = page.getByTestId(`planWeeks-input-${taskId}`);
    await expect(planWeeksInput2).toBeVisible();
    await planWeeksInput2.fill('5');
    await planWeeksInput2.press('Enter');
    console.log('✅ planWeeks changed to 5');

    // Ждем автосохранения и пересчета плана
    await waitForAutoSave(page);

    // Step 7: Verify plan was recalculated (should now be on weeks 1-5)
    console.log('\n✅ Step 7: Verifying plan was recalculated to weeks 1-5');
    for (let week = 1; week <= 5; week++) {
      const weekCell = taskRow.locator(`[data-testid="week-${week}"]`);
      const weekContent = await weekCell.textContent();
      expect(weekContent?.trim()).toBe('1');
      console.log(`Week ${week} content: "${weekContent?.trim()}"`);
    }
    // Week 6 should be empty
    const week6Cell = taskRow.locator(`[data-testid="week-6"]`);
    const week6Content = await week6Cell.textContent();
    expect(week6Content?.trim()).toBe('');
    console.log('✅ Plan was successfully recalculated after planWeeks change\n');

    // Step 8: Change planEmpl from 1 to 0.5
    console.log('📝 Step 8: Changing planEmpl from 1 to 0.5');
    await planEmplCell.dblclick();
    const planEmplInput2 = page.getByTestId(`planEmpl-input-${taskId}`);
    await expect(planEmplInput2).toBeVisible();
    await planEmplInput2.fill('0.5');
    await planEmplInput2.press('Enter');
    console.log('✅ planEmpl changed to 0.5');

    // Ждем автосохранения и пересчета плана
    await waitForAutoSave(page);

    // Step 9: Verify plan was recalculated (should still be on weeks 1-5 but with value 0.5)
    console.log('\n✅ Step 9: Verifying plan was recalculated with new planEmpl value');
    for (let week = 1; week <= 5; week++) {
      const weekCell = taskRow.locator(`[data-testid="week-${week}"]`);
      const weekContent = await weekCell.textContent();
      expect(weekContent?.trim()).toBe('0.5');
      console.log(`Week ${week} content: "${weekContent?.trim()}"`);
    }
    console.log('✅ Plan was successfully recalculated after planEmpl change\n');

    // Step 10: Verify Auto checkbox is still checked
    console.log('✅ Step 10: Verifying Auto checkbox is still checked');
    await expect(autoCheckbox).toBeChecked();
    console.log('✅ Auto checkbox is still checked\n');

    // Step 11: Delete test task
    console.log('🗑️ Step 11: Deleting test task');
    
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
    console.log('✅ Test task deleted\n');

    // Step 12: Delete test resource
    console.log('🗑️ Step 12: Deleting test resource');
    
    // Right-click on resource row
    const resourceRowForDelete = page.locator(`tr[data-row-id="${resourceId}"]`);
    await resourceRowForDelete.click({ button: 'right', force: true, position: { x: 10, y: 10 } });
    
    // Wait for context menu
    await expect(contextMenu).toBeVisible({ timeout: 5000 });
    
    // Click delete button
    await page.getByTestId('context-menu-delete').click();
    
    // Wait for resource to be removed
    await expect(resourceRowForDelete).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Test resource deleted\n');

    // Step 13: Save changes to ensure deletions are sent to server
    console.log('💾 Step 13: Saving changes to server');
    
    // Click save button
    const saveButton = page.getByTestId('manual-save-button');
    await saveButton.click();

    // Ждем появления надписи "Сохранено"
    await expect(page.getByTestId('save-status-saved')).toBeVisible({ timeout: 5000 });

    console.log('✅ Changes saved to server\n');

    console.log('✨ All steps completed successfully! Plan recalculation logic is working correctly.');
  });
});

