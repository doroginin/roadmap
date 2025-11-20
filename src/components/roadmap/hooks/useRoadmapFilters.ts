import { useState, useMemo } from "react";
import type { Row, TaskRow, ResourceRow } from "../types";
import { useUrlFilters, type FilterState } from "../../../hooks/useUrlFilters";

export type ColumnId =
    | "type" | "status" | "sprintsAuto" | "epic" | "task"
    | "team" | "fn" | "empl" | "planEmpl" | "planWeeks"
    | "fact" | "start" | "end" | "autoplan";

interface FilterUI {
    col: ColumnId;
    x: number;
    y: number;
}

function valueForCol(r: Row, col: ColumnId): string {
    const t = r as TaskRow;
    switch (col) {
        case "type": return r.kind === "task" ? "Задача" : "Ресурс";
        case "status": return r.kind === "task" ? t.status : "";
        case "sprintsAuto": return r.kind === "task" ? (t.sprintsAuto.join(", ") || "") : "";
        case "epic": return r.kind === "task" ? (t.epic || "") : "";
        case "task": return r.kind === "task" ? t.task : "";
        case "team": return r.kind === "task" ? r.team : (r as ResourceRow).team.join(", ");
        case "fn": return r.fn;
        case "empl": return r.empl || "";
        case "planEmpl": return r.kind === "task" ? String(t.planEmpl) : "";
        case "planWeeks": return r.kind === "task" ? String(t.planWeeks) : "";
        case "fact": return r.kind === "task" ? String(t.fact) : "";
        case "start": return r.kind === "task" ? String(t.startWeek || "") : "";
        case "end": return r.kind === "task" ? String(t.endWeek || "") : "";
        case "autoplan": return r.kind === "task" ? (t.autoPlanEnabled ? "on" : "off") : "";
    }
}

export function useRoadmapFilters(computedRows: Row[]) {
    const [filters, setFilters] = useUrlFilters<ColumnId>();
    const [filterUi, setFilterUi] = useState<FilterUI | null>(null);

    const isFilterActive = (col: ColumnId): boolean => {
        const filter = filters[col];
        return !!(filter && filter.selected.size > 0);
    };

    const openFilter = (col: ColumnId, x: number, y: number) => {
        setFilterUi({ col, x, y });
        if (!filters[col]) {
            setFilters({ ...filters, [col]: { search: "", selected: new Set<string>() } });
        }
    };

    const toggleFilterValue = (col: ColumnId, val: string) => {
        const s = new Set(filters[col]?.selected || []);
        if (s.has(val)) s.delete(val);
        else s.add(val);
        setFilters({ ...filters, [col]: { search: filters[col]?.search || "", selected: s } });
    };

    const setFilterSearch = (col: ColumnId, v: string) => {
        setFilters({ ...filters, [col]: { search: v, selected: filters[col]?.selected || new Set<string>() } });
    };

    const clearFilter = (col: ColumnId) => {
        const nf: FilterState = { ...filters };
        delete nf[col];
        setFilters(nf);
        setFilterUi(null);
    };

    const filteredRows = useMemo(() => {
        const result = computedRows.filter(r => {
            for (const col of Object.keys(filters) as ColumnId[]) {
                const f = filters[col]!;
                const val = valueForCol(r, col);
                if (!f) continue;
                const tokens = Array.from(f.selected || []);
                if (tokens.length === 0) continue;
                // Fix filtering logic: proper OR logic for empty and non-empty values
                const hit = tokens.some(s => {
                    // Handle empty values: both "" and "(пусто)" should match empty fields
                    if (s === "" || s === "(пусто)") {
                        return !val || val.trim() === "";
                    }
                    // Handle non-empty values: exact match to avoid substring issues
                    return val === s;
                });
                if (!hit) return false;
            }
            return true;
        });

        return result;
    }, [computedRows, filters]);

    const getFilterDefaults = () => {
        const defaults: Record<string, string | undefined> = {};
        for (const col of Object.keys(filters) as ColumnId[]) {
            const filter = filters[col];
            if (filter && filter.selected.size > 0) {
                const firstValue = Array.from(filter.selected)[0];
                defaults[col] = firstValue;
            }
        }
        return defaults;
    };

    return {
        filters,
        filterUi,
        filteredRows,
        isFilterActive,
        openFilter,
        toggleFilterValue,
        setFilterSearch,
        clearFilter,
        setFilterUi,
        getFilterDefaults,
        valueForCol
    };
}
