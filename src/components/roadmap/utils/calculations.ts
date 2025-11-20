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

/**
 * Calculate total number of weeks based on sprints data
 * @param sprints Array of sprint objects with start and end dates
 * @param week0 Base date (YYYY-MM-DD) for week numbering (first week starts here)
 * @returns Total number of weeks spanning from first sprint start to last sprint end
 */
export function calculateTotalWeeks(sprints: Array<{ start: string; end: string }>, week0: string): number {
    if (!sprints || sprints.length === 0 || !week0) {
        return 16; // fallback to default
    }

    try {
        // Normalize week0: if it already has time, use as is, otherwise add time
        const week0Normalized = week0.includes('T') ? week0 : week0 + "T00:00:00Z";
        const baseDate = new Date(week0Normalized);
        if (isNaN(baseDate.getTime())) {
            return 16;
        }

        // Find min start date and max end date from sprints
        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        for (const sprint of sprints) {
            // Normalize sprint dates: if they already have time, use as is
            const startNormalized = sprint.start.includes('T') ? sprint.start : sprint.start + "T00:00:00Z";
            const endNormalized = sprint.end.includes('T') ? sprint.end : sprint.end + "T00:00:00Z";

            const startDate = new Date(startNormalized);
            const endDate = new Date(endNormalized);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                continue;
            }

            if (!minStart || startDate < minStart) {
                minStart = startDate;
            }
            if (!maxEnd || endDate > maxEnd) {
                maxEnd = endDate;
            }
        }

        if (!minStart || !maxEnd) {
            return 16;
        }

        // Calculate week numbers for start and end dates
        const firstWeek = Math.floor((minStart.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const lastWeek = Math.floor((maxEnd.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Total weeks = lastWeek - firstWeek + 1
        const totalWeeks = lastWeek - firstWeek + 1;

        return Math.max(1, totalWeeks); // at least 1 week
    } catch (e) {
        console.error("Error calculating total weeks:", e);
        return 16;
    }
}
