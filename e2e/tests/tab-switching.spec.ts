import { test, expect } from '@playwright/test';

test.describe('Tab Switching Tests', () => {
    test('should maintain scroll and add button after switching tabs', async ({ page }) => {
        // Загружаем приложение
        await page.goto('http://localhost:5173');

        // Ждем загрузки таблицы
        await page.waitForSelector('[data-testid="roadmap-table"]', { timeout: 10000 });

        // Проверяем, что кнопка "Добавить" видима на вкладке План
        const addButton = page.locator('button:has-text("+ Добавить")');
        await expect(addButton).toBeVisible({ timeout: 5000 });
        console.log('✅ Add button is visible on Plan tab');

        // Проверяем, что таблица имеет overflow (скролл доступен)
        const tableContainer = page.locator('[data-testid="roadmap-table-container"]');
        const containerOverflowY = await tableContainer.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.overflowY;
        });
        console.log(`Initial overflow-y on Plan tab: ${containerOverflowY}`);

        // Переключаемся на вкладку Спринты
        const sprintsTab = page.locator('[data-testid="tab-sprints"]');
        await sprintsTab.click();
        await page.waitForTimeout(100); // Даем время на переключение

        console.log('✅ Switched to Sprints tab');

        // Проверяем, что мы на вкладке Спринты (таблица плана не видна)
        await expect(tableContainer).not.toBeVisible();

        // Переключаемся обратно на вкладку План
        const planTab = page.locator('[data-testid="tab-plan"]');
        await planTab.click();
        await page.waitForTimeout(100); // Даем время на переключение и пересчет размеров

        console.log('✅ Switched back to Plan tab');

        // Проверяем, что таблица снова видна
        await expect(tableContainer).toBeVisible({ timeout: 5000 });

        // ГЛАВНАЯ ПРОВЕРКА: Проверяем, что кнопка "Добавить" все еще видима
        await expect(addButton).toBeVisible({ timeout: 5000 });
        console.log('✅ Add button is still visible after tab switch');

        // ГЛАВНАЯ ПРОВЕРКА: Проверяем, что скролл работает (overflow установлен правильно)
        const containerOverflowYAfter = await tableContainer.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.overflowY;
        });
        console.log(`Overflow-y after tab switch: ${containerOverflowYAfter}`);

        // Проверяем, что overflow-y либо 'auto', либо 'scroll' (не 'hidden')
        expect(['auto', 'scroll']).toContain(containerOverflowYAfter);

        // Проверяем, что высота контейнера установлена корректно
        const containerHeight = await tableContainer.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.height;
        });
        console.log(`Container height after tab switch: ${containerHeight}`);

        // Проверяем, что высота не '0px' и не 'auto'
        expect(containerHeight).not.toBe('0px');
        expect(containerHeight).not.toBe('auto');

        // Проверяем, что можно скроллить таблицу
        const isScrollable = await tableContainer.evaluate(el => {
            return el.scrollHeight > el.clientHeight;
        });
        console.log(`Is container scrollable: ${isScrollable}`);

        // Если таблица достаточно большая, пытаемся скроллить
        if (isScrollable) {
            await tableContainer.evaluate(el => {
                el.scrollTop = 100;
            });
            await page.waitForTimeout(100);

            const scrollTop = await tableContainer.evaluate(el => el.scrollTop);
            expect(scrollTop).toBeGreaterThan(0);
            console.log('✅ Scroll works correctly after tab switch');
        }

        console.log('✅ All tests passed: button and scroll work after tab switching');
    });

    test('should handle multiple tab switches correctly', async ({ page }) => {
        // Загружаем приложение
        await page.goto('http://localhost:5173');

        // Ждем загрузки таблицы
        await page.waitForSelector('[data-testid="roadmap-table"]', { timeout: 10000 });

        const planTab = page.locator('[data-testid="tab-plan"]');
        const sprintsTab = page.locator('[data-testid="tab-sprints"]');
        const teamsTab = page.locator('[data-testid="tab-teams"]');
        const addButton = page.locator('button:has-text("+ Добавить")');
        const tableContainer = page.locator('[data-testid="roadmap-table-container"]');

        // Проверяем начальное состояние
        await expect(addButton).toBeVisible();
        console.log('✅ Initial state: Add button visible');

        // Цикл переключения: План -> Спринты -> Команды -> План
        for (let i = 0; i < 3; i++) {
            console.log(`\n🔄 Cycle ${i + 1}`);

            // План -> Спринты
            await sprintsTab.click();
            console.log('  Switched to Sprints');

            // Спринты -> Команды
            await teamsTab.click();
            console.log('  Switched to Teams');

            // Команды -> План
            await planTab.click();
            await page.waitForTimeout(100); // Даем время на пересчет

            console.log('  Switched back to Plan');

            // Проверяем, что кнопка видна после каждого цикла
            await expect(addButton).toBeVisible({ timeout: 5000 });
            console.log('  ✅ Add button visible after cycle');

            // Проверяем overflow
            const overflow = await tableContainer.evaluate(el => 
                window.getComputedStyle(el).overflowY
            );
            expect(['auto', 'scroll']).toContain(overflow);
            console.log(`  ✅ Overflow-y is correct: ${overflow}`);
        }

        console.log('\n✅ All cycles passed: button and scroll consistently work');
    });

    test('should recalculate layout after window resize following tab switch', async ({ page }) => {
        // Загружаем приложение
        await page.goto('http://localhost:5173');

        // Ждем загрузки таблицы
        await page.waitForSelector('[data-testid="roadmap-table"]', { timeout: 10000 });

        const planTab = page.locator('[data-testid="tab-plan"]');
        const sprintsTab = page.locator('[data-testid="tab-sprints"]');
        const tableContainer = page.locator('[data-testid="roadmap-table-container"]');

        // Переключаемся на Спринты и обратно
        await sprintsTab.click();
        await page.waitForTimeout(300);
        await planTab.click();
        
        // Ждём завершения переключения таба (таблица должна быть видна)
        await expect(tableContainer).toBeVisible();

        // Получаем начальную высоту
        const heightBefore = await tableContainer.evaluate(el => 
            window.getComputedStyle(el).height
        );
        console.log(`Height before resize: ${heightBefore}`);

        // Изменяем размер окна
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.waitForTimeout(100); // Даем время на обработку resize

        // Получаем высоту после ресайза
        const heightAfter = await tableContainer.evaluate(el => 
            window.getComputedStyle(el).height
        );
        console.log(`Height after resize: ${heightAfter}`);

        // Проверяем, что высота изменилась (или осталась корректной)
        expect(heightAfter).not.toBe('0px');
        expect(heightAfter).not.toBe('auto');

        // Проверяем overflow
        const overflow = await tableContainer.evaluate(el => 
            window.getComputedStyle(el).overflowY
        );
        expect(['auto', 'scroll']).toContain(overflow);
        console.log(`✅ Overflow-y is correct after resize: ${overflow}`);

        console.log('✅ Layout recalculates correctly after resize');
    });
});

