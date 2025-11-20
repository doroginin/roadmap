// =============================
// Link building utilities for blocker arrows
// =============================

import type { TaskRow, Link } from "../types";
import { lastAllocatedWeek, firstAllocatedWeek } from "./taskUtils";

export function buildLinks(tasks: TaskRow[], totalWeeks: number = 16): Link[] {
    const links: Link[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const task of tasks) {
        // Обрабатываем блокеры задач (безопасная проверка на undefined)
        for (const blockerId of (task.blockerIds || [])) {
            const blocker = taskMap.get(blockerId);
            if (!blocker) continue;

            const fromW = lastAllocatedWeek(blocker);
            const taskFirstW = firstAllocatedWeek(task);

            if (fromW != null) {
                // Определяем есть ли конфликт планирования
                const isConflict = taskFirstW != null && taskFirstW <= fromW;

                // Если конфликт, стрелка ведет на правильную неделю (следующую после блокера)
                // Если нет конфликта, стрелка ведет на первую неделю задачи
                const targetWeek = isConflict ? fromW + 1 : taskFirstW;

                if (targetWeek != null && targetWeek < totalWeeks) { // проверяем что неделя в пределах таблицы
                    links.push({
                        from: { taskId: blockerId, weekIdx: fromW },
                        to: { taskId: task.id, weekIdx: targetWeek },
                        isConflict,
                        blockerId,
                        blockedTaskId: task.id,
                        type: 'task'
                    });
                }
            }
        }

        // Обрабатываем блокеры недель
        for (const weekNumber of task.weekBlockers || []) {
            const weekIdx = weekNumber - 1; // Преобразуем в 0-based
            const taskFirstW = firstAllocatedWeek(task);

            if (weekIdx >= 0 && weekIdx < totalWeeks) { // проверяем что неделя в пределах таблицы
                // Определяем есть ли конфликт планирования (если первая неделя <= блокирующей недели)
                const isConflict = taskFirstW != null && taskFirstW <= weekIdx;

                // Если конфликт, стрелка ведет на правильную неделю (следующую после блокера)
                // Если нет конфликта, стрелка ведет на первую неделю задачи
                const targetWeek = isConflict ? weekIdx + 1 : taskFirstW;

                if (targetWeek != null && targetWeek < totalWeeks) {
                    // Стрелка выходит из самой блокирующей недели
                    links.push({
                        from: { taskId: task.id, weekIdx: weekIdx },
                        to: { taskId: task.id, weekIdx: targetWeek },
                        isConflict,
                        blockerId: `week-${weekNumber}`, // Специальный ID для блокера недели
                        blockedTaskId: task.id,
                        type: 'week'
                    });
                }
            }
        }
    }
    return links;
}

// ---- Функции для умной маршрутизации стрелок ----
export function isTaskCellFilled(tasks: TaskRow[], taskId: string, weekIdx: number): boolean {
    const task = tasks.find(t => t.id === taskId);
    return task ? (task.weeks[weekIdx] || 0) > 0 : false;
}

export function countFilledCellsInPath(tasks: TaskRow[], path: Array<{ taskId: string, weekIdx: number }>): number {
    return path.reduce((count, cell) => {
        return count + (isTaskCellFilled(tasks, cell.taskId, cell.weekIdx) ? 1 : 0);
    }, 0);
}

export function calculateRoutePath(
    tasks: TaskRow[],
    fromTaskId: string,
    fromWeek: number,
    toTaskId: string,
    toWeek: number,
    routeType: 'top' | 'bottom'
): Array<{ taskId: string, weekIdx: number }> {
    const path: Array<{ taskId: string, weekIdx: number }> = [];

    if (routeType === 'top') {
        // Маршрут: правая граница источника → верх цели
        // Горизонтальный сегмент от fromWeek+1 до toWeek-1 по строке источника
        for (let week = fromWeek + 1; week < toWeek; week++) {
            path.push({ taskId: fromTaskId, weekIdx: week });
        }
        // Вертикальный сегмент от источника до цели по колонке toWeek
        const fromIndex = tasks.findIndex(t => t.id === fromTaskId);
        const toIndex = tasks.findIndex(t => t.id === toTaskId);
        if (fromIndex !== -1 && toIndex !== -1) {
            const start = Math.min(fromIndex, toIndex);
            const end = Math.max(fromIndex, toIndex);
            for (let i = start + 1; i < end; i++) {
                path.push({ taskId: tasks[i].id, weekIdx: toWeek });
            }
        }
    } else {
        // Маршрут: низ источника → левая граница цели
        // Вертикальный сегмент от источника до цели по колонке fromWeek
        const fromIndex = tasks.findIndex(t => t.id === fromTaskId);
        const toIndex = tasks.findIndex(t => t.id === toTaskId);
        if (fromIndex !== -1 && toIndex !== -1) {
            const start = Math.min(fromIndex, toIndex);
            const end = Math.max(fromIndex, toIndex);
            for (let i = start + 1; i < end; i++) {
                path.push({ taskId: tasks[i].id, weekIdx: fromWeek });
            }
        }
        // Горизонтальный сегмент от fromWeek+1 до toWeek-1 по строке цели
        for (let week = fromWeek + 1; week < toWeek; week++) {
            path.push({ taskId: toTaskId, weekIdx: week });
        }
    }

    return path;
}

export function chooseBestRoute(
    tasks: TaskRow[],
    fromTaskId: string,
    fromWeek: number,
    toTaskId: string,
    toWeek: number
): 'top' | 'bottom' {
    const topPath = calculateRoutePath(tasks, fromTaskId, fromWeek, toTaskId, toWeek, 'top');
    const bottomPath = calculateRoutePath(tasks, fromTaskId, fromWeek, toTaskId, toWeek, 'bottom');

    const topFilledCount = countFilledCellsInPath(tasks, topPath);
    const bottomFilledCount = countFilledCellsInPath(tasks, bottomPath);

    // Выбираем маршрут с меньшим количеством заполненных ячеек
    return topFilledCount <= bottomFilledCount ? 'top' : 'bottom';
}
