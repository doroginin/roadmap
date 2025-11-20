import { useState, useRef } from "react";
import type { ID } from "../types";

// Типы колонок для выделения
export type ColKey =
    | "type" | "status" | "sprintsAuto" | "epic" | "task"
    | "team" | "fn" | "empl" | "planEmpl" | "planWeeks"
    | "fact" | "start" | "end" | "autoplan"
    | { week: number };

export type SprintColKey = "code" | "start" | "end";
export type TeamColKey = "name" | "jiraProject" | "featureTeam" | "issueType";

// Типы выделения
export type Selection = { rowId: ID; col: ColKey } | null;
export type SprintSelection = { rowId: number; col: SprintColKey } | null;
export type TeamSelection = { rowId: number; col: TeamColKey } | null;

/**
 * Хук управления состоянием выделения для всех трех таблиц (план, спринты, команды)
 */
export function useSelection() {
    // ====== Состояние для таблицы плана ======
    const [sel, setSel] = useState<Selection>(null);
    const [editing, setEditing] = useState<Selection>(null);
    const cancelEditRef = useRef<boolean>(false);

    // ====== Состояние для таблицы спринтов ======
    const [sprintSel, setSprintSel] = useState<SprintSelection>(null);
    const [sprintEditing, setSprintEditing] = useState<SprintSelection>(null);
    const cancelSprintEditRef = useRef<boolean>(false);

    // ====== Состояние для таблицы команд ======
    const [teamSel, setTeamSel] = useState<TeamSelection>(null);
    const [teamEditing, setTeamEditing] = useState<TeamSelection>(null);
    const cancelTeamEditRef = useRef<boolean>(false);

    // ====== Utility функции для проверки выделения ======
    const isSel = (rowId: ID, col: Exclude<ColKey, { week: number }> | "type") => {
        return sel && sel.rowId === rowId && sel.col === col;
    };

    const isSelWeek = (rowId: ID, w: number) => {
        return sel && sel.rowId === rowId && typeof sel.col === "object" && sel.col.week === w;
    };

    // ====== Функции редактирования для таблицы плана ======
    const startEdit = (s: Selection) => {
        setEditing(s);
        cancelEditRef.current = false;
    };

    const stopEdit = () => {
        setEditing(null);
    };

    const commitEdit = () => {
        setEditing(null);
    };

    // ====== Функции редактирования для таблицы спринтов ======
    const startSprintEdit = (s: SprintSelection) => {
        setSprintEditing(s);
        cancelSprintEditRef.current = false;
    };

    const stopSprintEdit = () => {
        setSprintEditing(null);
    };

    const commitSprintEdit = () => {
        setSprintEditing(null);
    };

    // ====== Функции редактирования для таблицы команд ======
    const startTeamEdit = (s: TeamSelection) => {
        setTeamEditing(s);
        cancelTeamEditRef.current = false;
    };

    const stopTeamEdit = () => {
        setTeamEditing(null);
    };

    const commitTeamEdit = () => {
        setTeamEditing(null);
    };

    // ====== Вспомогательные функции для определения редактируемых колонок ======
    const isEditableColumn = (col: ColKey, isResource: boolean): boolean => {
        if (isResource) {
            // Для ресурсов редактируемые колонки: team, fn, empl, недели
            return col === "team" || col === "fn" || col === "empl" ||
                   (typeof col === "object" && col.week !== undefined);
        } else {
            // Для задач редактируемые колонки: status, epic, task, team, fn, empl, planEmpl, planWeeks, autoplan, недели
            return col === "status" || col === "epic" || col === "task" ||
                   col === "team" || col === "fn" || col === "empl" || col === "planEmpl" ||
                   col === "planWeeks" || col === "autoplan" ||
                   (typeof col === "object" && col.week !== undefined);
        }
    };

    return {
        // Состояние таблицы плана
        sel,
        setSel,
        editing,
        setEditing,
        cancelEditRef,

        // Состояние таблицы спринтов
        sprintSel,
        setSprintSel,
        sprintEditing,
        setSprintEditing,
        cancelSprintEditRef,

        // Состояние таблицы команд
        teamSel,
        setTeamSel,
        teamEditing,
        setTeamEditing,
        cancelTeamEditRef,

        // Utility функции
        isSel,
        isSelWeek,
        isEditableColumn,

        // Функции редактирования для таблицы плана
        startEdit,
        stopEdit,
        commitEdit,

        // Функции редактирования для таблицы спринтов
        startSprintEdit,
        stopSprintEdit,
        commitSprintEdit,

        // Функции редактирования для таблицы команд
        startTeamEdit,
        stopTeamEdit,
        commitTeamEdit,
    };
}
