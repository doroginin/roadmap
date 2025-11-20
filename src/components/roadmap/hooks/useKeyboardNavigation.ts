import { useEffect } from "react";
import type { Row, TaskRow, ResourceRow, Sprint } from "../types";
import type { ColKey, SprintColKey, TeamColKey, Selection, SprintSelection, TeamSelection } from "./useSelection";

interface KeyboardNavigationProps {
    // Selection state
    sel: Selection;
    setSel: (sel: Selection) => void;
    editing: Selection;
    cancelEditRef: React.MutableRefObject<boolean>;

    // Sprint state
    sprintSel: SprintSelection;
    setSprintSel: (sel: SprintSelection) => void;
    sprintEditing: SprintSelection;
    cancelSprintEditRef: React.MutableRefObject<boolean>;
    sprints: Sprint[];

    // Team state
    teamSel: TeamSelection;
    setTeamSel: (sel: TeamSelection) => void;
    teamEditing: TeamSelection;
    cancelTeamEditRef: React.MutableRefObject<boolean>;
    teamData: any[];

    // Data
    computedRows: Row[];
    filteredRows: Row[];
    containerEl: HTMLDivElement | null;
    columnOrder: ColKey[];
    tab: "plan" | "sprints" | "teams";

    // Functions from useSelection
    isEditableColumn: (col: ColKey, isResource: boolean) => boolean;
    startEdit: (s: Selection) => void;
    stopEdit: () => void;
    commitEdit: () => void;
    startSprintEdit: (s: SprintSelection) => void;
    stopSprintEdit: () => void;
    commitSprintEdit: () => void;
    startTeamEdit: (s: TeamSelection) => void;
    stopTeamEdit: () => void;
    commitTeamEdit: () => void;

    // Actions
    toggleAutoPlan: (taskId: string, enabled: boolean) => void;
    weeksBaseForTaskLocal: (task: TaskRow) => number[];
    weeksArraysEqual: (a: number[], b: number[]) => boolean;
    setRows: React.Dispatch<React.SetStateAction<Row[]>>;
    changeTracker: any;
}

export function useKeyboardNavigation(props: KeyboardNavigationProps) {
    const {
        sel, setSel, editing, cancelEditRef,
        sprintSel, setSprintSel, sprintEditing, cancelSprintEditRef, sprints,
        teamSel, setTeamSel, teamEditing, cancelTeamEditRef, teamData,
        computedRows, filteredRows, containerEl, columnOrder, tab,
        isEditableColumn, startEdit, stopEdit, commitEdit,
        startSprintEdit, stopSprintEdit, commitSprintEdit,
        startTeamEdit, stopTeamEdit, commitTeamEdit,
        toggleAutoPlan, weeksBaseForTaskLocal, weeksArraysEqual, setRows, changeTracker
    } = props;

    // Находит следующую редактируемую ячейку в заданном направлении
    const findNextEditableColumn = (currentCol: ColKey, direction: number, isResource: boolean): ColKey | null => {
        const keyEq = (a: ColKey, b: ColKey) => (typeof a === "string" && typeof b === "string" && a===b) || (typeof a === "object" && typeof b === "object" && a.week===b.week);
        const idx = columnOrder.findIndex(k => keyEq(k, currentCol));
        if (idx === -1) return null;

        // Ищем в заданном направлении
        for (let i = idx + direction; i >= 0 && i < columnOrder.length; i += direction) {
            const col = columnOrder[i];
            if (isEditableColumn(col, isResource)) {
                return col;
            }
        }

        return null; // Не найдено редактируемых ячеек в этом направлении
    };

    // Проверяет, есть ли редактируемые ячейки в целевой строке
    const hasEditableColumnsInTargetRow = (targetCol: ColKey, targetIsResource: boolean): boolean => {
        if (isEditableColumn(targetCol, targetIsResource)) {
            return true;
        }

        const keyEq = (a: ColKey, b: ColKey) => (typeof a === "string" && typeof b === "string" && a===b) || (typeof a === "object" && typeof b === "object" && a.week===b.week);
        const idx = columnOrder.findIndex(k => keyEq(k, targetCol));
        if (idx === -1) return false;

        if (targetIsResource) {
            return isEditableColumn("team", true) || isEditableColumn("fn", true) ||
                   isEditableColumn("empl", true) || isEditableColumn({ week: 0 }, true);
        } else {
            return isEditableColumn("status", false) || isEditableColumn("epic", false) ||
                   isEditableColumn("task", false) || isEditableColumn("team", false) ||
                   isEditableColumn("fn", false) || isEditableColumn("empl", false) ||
                   isEditableColumn("planEmpl", false) || isEditableColumn("planWeeks", false) ||
                   isEditableColumn("autoplan", false) || isEditableColumn({ week: 0 }, false);
        }
    };

    // Проверяет, можно ли перейти из колонки задачи в ресурс
    const canNavigateFromTaskToResource = (taskCol: ColKey): boolean => {
        if (taskCol === "status" || taskCol === "sprintsAuto" || taskCol === "epic" || taskCol === "task" ||
            taskCol === "planEmpl" || taskCol === "planWeeks" || taskCol === "autoplan") {
            return false;
        }
        return true;
    };

    // ====== Навигация по основной таблице ======
    const moveSelection = (delta: number) => {
        if (!sel) return;

        const row = computedRows.find(r => r.id === sel.rowId);
        const isResource = row?.kind === "resource";

        const next = findNextEditableColumn(sel.col, delta, isResource);

        if (next) {
            setSel({ rowId: sel.rowId, col: next });
        }
    };

    const moveSelectionRow = (delta: number) => {
        if (!sel) return;
        const i = filteredRows.findIndex(r => r.id === sel.rowId);
        if (i < 0) return;
        const j = Math.max(0, Math.min(filteredRows.length - 1, i + delta));
        const target = filteredRows[j];
        if (!target) return;

        const currentRow = computedRows.find(r => r.id === sel.rowId);
        const targetRow = computedRows.find(r => r.id === target.id);
        const currentIsResource = currentRow?.kind === "resource";
        const targetIsResource = targetRow?.kind === "resource";

        let targetCol: ColKey = sel.col;

        if (!currentIsResource && targetIsResource) {
            if (sel.col === "sprintsAuto" || sel.col === "epic" || sel.col === "task") {
                targetCol = "status";
            } else if (sel.col === "planWeeks" || sel.col === "autoplan") {
                targetCol = "planEmpl";
            }
        } else if (currentIsResource && !targetIsResource) {
            if (sel.col === "status") {
                targetCol = "status";
            } else if (sel.col === "planEmpl") {
                targetCol = "planEmpl";
            }
        }

        if (!currentIsResource && targetIsResource) {
            if (!canNavigateFromTaskToResource(sel.col)) {
                return;
            }
        } else if (!hasEditableColumnsInTargetRow(targetCol, targetIsResource)) {
            return;
        }

        setSel({ rowId: target.id, col: targetCol });

        setTimeout(() => {
            const tableContainer = containerEl;
            if (tableContainer) {
                const selectedRow = tableContainer.querySelector(`tr[data-row-id="${target.id}"]`);
                if (selectedRow) {
                    selectedRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest'
                    });
                }
            }
        }, 0);
    };

    const focusNextRight = (rowId: string, col: ColKey): boolean => {
        const row = computedRows.find(r => r.id === rowId);
        const isResource = row?.kind === "resource";

        const next = findNextEditableColumn(col, 1, isResource);

        if (next) {
            const nextSel: Selection = { rowId, col: next };
            setSel(nextSel);
            startEdit(nextSel);
            return true;
        }
        return false;
    };

    const focusPrevLeft = (rowId: string, col: ColKey): boolean => {
        const row = computedRows.find(r => r.id === rowId);
        const isResource = row?.kind === "resource";

        const prev = findNextEditableColumn(col, -1, isResource);

        if (prev) {
            const prevSel: Selection = { rowId, col: prev };
            setSel(prevSel);
            startEdit(prevSel);
            return true;
        }
        return false;
    };

    const navigateInEditMode = (direction: 'next' | 'prev', currentRowId: string, currentCol: ColKey): boolean => {
        const row = computedRows.find(r => r.id === currentRowId);
        const isResource = row?.kind === "resource";

        const next = findNextEditableColumn(currentCol, direction === 'next' ? 1 : -1, isResource);

        if (next) {
            const nextSel: Selection = { rowId: currentRowId, col: next };
            setSel(nextSel);
            startEdit(nextSel);
            return true;
        }
        return false;
    };

    // ====== Навигация по таблице спринтов ======
    const moveSprintSelection = (delta: number) => {
        if (!sprintSel) return;

        const sprintCols: SprintColKey[] = ["code", "start", "end"];
        const currentIdx = sprintCols.indexOf(sprintSel.col);
        const nextIdx = currentIdx + delta;

        if (nextIdx >= 0 && nextIdx < sprintCols.length) {
            setSprintSel({ rowId: sprintSel.rowId, col: sprintCols[nextIdx] });
        }
    };

    const moveSprintSelectionRow = (delta: number) => {
        if (!sprintSel) return;
        const nextRowId = sprintSel.rowId + delta;
        if (nextRowId >= 0 && nextRowId < sprints.length) {
            setSprintSel({ rowId: nextRowId, col: sprintSel.col });

            setTimeout(() => {
                const tableContainer = document.querySelector('.sprint-table-container');
                if (tableContainer) {
                    const selectedRow = tableContainer.querySelector(`tr:nth-child(${nextRowId + 2})`);
                    if (selectedRow) {
                        selectedRow.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }
                }
            }, 0);
        }
    };

    const navigateSprintInEditMode = (direction: 'next' | 'prev', currentRowId: number, currentCol: SprintColKey) => {
        const sprintCols: SprintColKey[] = ["code", "start", "end"];
        const currentIdx = sprintCols.indexOf(currentCol);
        const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;

        if (nextIdx >= 0 && nextIdx < sprintCols.length) {
            const nextSel: SprintSelection = { rowId: currentRowId, col: sprintCols[nextIdx] };
            setSprintSel(nextSel);
            startSprintEdit(nextSel);
        }
    };

    // ====== Навигация по таблице команд ======
    const moveTeamSelection = (delta: number) => {
        if (!teamSel) return;
        const teamCols: TeamColKey[] = ["name", "jiraProject", "featureTeam", "issueType"];
        const currentIdx = teamCols.indexOf(teamSel.col);
        const nextIdx = currentIdx + delta;

        if (nextIdx >= 0 && nextIdx < teamCols.length) {
            setTeamSel({ rowId: teamSel.rowId, col: teamCols[nextIdx] });
        }
    };

    const moveTeamSelectionRow = (delta: number) => {
        if (!teamSel) return;
        const nextRowId = teamSel.rowId + delta;
        if (nextRowId >= 0 && nextRowId < teamData.length) {
            setTeamSel({ rowId: nextRowId, col: teamSel.col });

            setTimeout(() => {
                const tableContainer = document.querySelector('.team-table-container');
                if (tableContainer) {
                    const selectedRow = tableContainer.querySelector(`tr:nth-child(${nextRowId + 2})`);
                    if (selectedRow) {
                        selectedRow.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }
                }
            }, 0);
        }
    };

    const navigateTeamInEditMode = (direction: 'next' | 'prev', currentRowId: number, currentCol: TeamColKey) => {
        const teamCols: TeamColKey[] = ["name", "jiraProject", "featureTeam", "issueType"];
        const currentIdx = teamCols.indexOf(currentCol);
        const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;

        if (nextIdx >= 0 && nextIdx < teamCols.length) {
            const nextSel: TeamSelection = { rowId: currentRowId, col: teamCols[nextIdx] };
            setTeamSel(nextSel);
            startTeamEdit(nextSel);
        }
    };

    // ====== Keyboard event handler ======
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const el = e.target as HTMLElement | null;
            const tag = el?.tagName;
            const isEditable = !!el && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable);
            if (isEditable) return;

            // Sprint table navigation
            if (tab === 'sprints') {
                if (!sprintSel) return;

                if (e.key === " ") {
                    e.preventDefault();
                    if (sprintEditing) {
                        commitSprintEdit();
                    } else {
                        startSprintEdit(sprintSel);
                    }
                    return;
                }
                if (!sprintEditing && e.key === "Tab") { e.preventDefault(); if (e.shiftKey) { moveSprintSelection(-1); } else { moveSprintSelection(1); } return; }
                if (!sprintEditing && e.key === "ArrowUp") { e.preventDefault(); moveSprintSelectionRow(-1); return; }
                if (!sprintEditing && e.key === "ArrowDown") { e.preventDefault(); moveSprintSelectionRow(1); return; }
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (sprintEditing) {
                        commitSprintEdit();
                    } else {
                        startSprintEdit(sprintSel);
                    }
                    return;
                }
                if (e.key === "Escape") {
                    if (sprintEditing) { cancelSprintEditRef.current = true; stopSprintEdit(); }
                    return;
                }
                if (e.key === "ArrowRight") { e.preventDefault(); moveSprintSelection(1); return; }
                if (e.key === "ArrowLeft")  { e.preventDefault(); moveSprintSelection(-1); return; }
                return;
            }

            // Team table navigation
            if (tab === 'teams') {
                if (!teamSel) return;

                if (e.key === " ") {
                    e.preventDefault();
                    if (teamEditing) {
                        commitTeamEdit();
                    } else {
                        startTeamEdit(teamSel);
                    }
                    return;
                }
                if (!teamEditing && e.key === "Tab") { e.preventDefault(); if (e.shiftKey) { moveTeamSelection(-1); } else { moveTeamSelection(1); } return; }
                if (!teamEditing && e.key === "ArrowUp") { e.preventDefault(); moveTeamSelectionRow(-1); return; }
                if (!teamEditing && e.key === "ArrowDown") { e.preventDefault(); moveTeamSelectionRow(1); return; }
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (teamEditing) {
                        commitTeamEdit();
                    } else {
                        startTeamEdit(teamSel);
                    }
                    return;
                }
                if (e.key === "Escape") {
                    if (teamEditing) { cancelTeamEditRef.current = true; stopTeamEdit(); }
                    return;
                }
                if (e.key === "ArrowRight") { e.preventDefault(); moveTeamSelection(1); return; }
                if (e.key === "ArrowLeft")  { e.preventDefault(); moveTeamSelection(-1); return; }
                return;
            }

            // Plan table navigation
            if (!sel) return;

            // Space: toggle autoplan
            if (e.key === " ") {
                e.preventDefault();
                if (typeof sel.col === "string" && sel.col === "autoplan") {
                    const t = computedRows.find(r=>r.id===sel.rowId) as TaskRow | undefined;
                    if (t) toggleAutoPlan(t.id, !t.autoPlanEnabled);
                }
                return;
            }

            // Backspace/Delete: clear week cell
            if (!editing && (e.key === "Backspace" || e.key === "Delete")) {
                if (typeof sel.col === "object") {
                    e.preventDefault();
                    const row = computedRows.find(r=>r.id===sel.rowId);
                    const w = sel.col.week;
                    if (row?.kind === "task") {
                        const base = weeksBaseForTaskLocal(row as TaskRow);
                        const originalWeeks = (row as TaskRow).weeks.slice();
                        base[w] = 0;

                        const hasChanged = !weeksArraysEqual(base, originalWeeks);

                        setRows(prev=>prev.map(x =>
                            (x.kind==='task' && x.id===row.id)
                                ? {
                                    ...(x as TaskRow),
                                    weeks: base,
                                    ...(hasChanged ? { autoPlanEnabled: false } : {})
                                }
                                : x
                        ));

                        if (hasChanged && changeTracker) {
                            changeTracker.addCellChange('task', row.id, 'weeks', originalWeeks, base);
                            if ((row as TaskRow).autoPlanEnabled) {
                                changeTracker.addCellChange('task', row.id, 'autoPlanEnabled', true, false);
                            }
                        }
                    } else if (row?.kind === "resource") {
                        const oldWeeks = (row as ResourceRow).weeks.slice();
                        const newWeeks = (row as ResourceRow).weeks.map((vv,i)=> i===w? 0: vv);

                        setRows(prev=>prev.map(x =>
                            (x.kind==='resource' && x.id===row.id)
                                ? { ...(x as ResourceRow), weeks: newWeeks }
                                : x
                        ));

                        if (changeTracker && !weeksArraysEqual(oldWeeks, newWeeks)) {
                            changeTracker.addCellChange('resource', row.id, 'weeks', oldWeeks, newWeeks);
                        }
                    }
                }
                return;
            }

            if (!editing && e.key === "Tab") { e.preventDefault(); if (e.shiftKey) { moveSelection(-1); } else { moveSelection(1); } return; }
            if (!editing && e.key === "ArrowUp") { e.preventDefault(); moveSelectionRow(-1); return; }
            if (!editing && e.key === "ArrowDown") { e.preventDefault(); moveSelectionRow(1); return; }
            if (e.key === "Enter") {
                e.preventDefault();
                if (editing) {
                    commitEdit();
                } else if (typeof sel.col === "object") {
                    startEdit(sel);
                } else {
                    startEdit(sel);
                }
                return;
            }
            if (e.key === "Escape") {
                if (editing) { cancelEditRef.current = true; stopEdit(); }
                return;
            }
            if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(1); return; }
            if (e.key === "ArrowLeft")  { e.preventDefault(); moveSelection(-1); return; }
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [sel, editing, computedRows, sprintSel, sprintEditing, sprints, teamSel, teamEditing, teamData]);

    return {
        moveSelection,
        moveSelectionRow,
        focusNextRight,
        focusPrevLeft,
        navigateInEditMode,
        moveSprintSelection,
        moveSprintSelectionRow,
        navigateSprintInEditMode,
        moveTeamSelection,
        moveTeamSelectionRow,
        navigateTeamInEditMode,
    };
}
