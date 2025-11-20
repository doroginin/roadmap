// =============================
// Basic calculation utilities
// =============================

export function range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
}

export function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

export function fmtDM(dateISO: string) {
    if (!dateISO || dateISO === "Invalid Date") {
        return "??.??.????";
    }

    const d = new Date(dateISO + "T00:00:00Z");

    if (isNaN(d.getTime())) {
        return "??.??.????";
    }

    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getUTCFullYear());
    const result = `${dd}.${mm}.${yyyy}`;

    // Проверяем, что результат не содержит NaN
    if (result.includes('NaN') || isNaN(Number(dd)) || isNaN(Number(mm)) || isNaN(Number(yyyy))) {
        return "??.??.????";
    }

    return result;
}

export function cellId(taskId: string, weekIdx: number) {
    return `cell-${taskId}-${weekIdx}`;
}
