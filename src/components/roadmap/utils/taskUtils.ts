// =============================
// Task-related utilities
// =============================

import type { TaskRow } from "../types";

export function lastAllocatedWeek(task: TaskRow): number | null {
    const arr = task.weeks ?? [];
    for (let i = arr.length - 1; i >= 0; i--) {
        if ((arr[i] ?? 0) > 0) return i;
    }
    return null;
}

export function firstAllocatedWeek(task: TaskRow): number | null {
    const arr = task.weeks ?? [];
    for (let i = 0; i < arr.length; i++) {
        if ((arr[i] ?? 0) > 0) return i;
    }
    return null;
}

// Функция для проверки несоответствия expectedStartWeek и startWeek
export function hasExpectedStartWeekMismatch(task: TaskRow): boolean {
    const result = task.expectedStartWeek !== null &&
        task.expectedStartWeek !== undefined &&
        task.expectedStartWeek !== task.startWeek;

    return result;
}
