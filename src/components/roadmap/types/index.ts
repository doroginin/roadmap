// =============================
// Roadmap Types
// =============================

export type ID = string;

export type Status = "Todo" | "Backlog" | "Cancelled";

export type Fn = "BE" | "FE" | "PO" | "AN" | string;

// Типы для стрелок блокеров
export type Link = {
    from: { taskId: string; weekIdx: number };
    to: { taskId: string; weekIdx: number };
    isConflict: boolean; // true если есть конфликт планирования
    blockerId: string; // ID задачи-блокера
    blockedTaskId: string; // ID заблокированной задачи
    type: 'task' | 'week'; // тип блокера: задача или неделя
};

export type Sprint = {
    id?: string;  // Sprint UUID
    code: string; // QxSy
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
};

export type ResourceRow = {
    id: ID;
    kind: "resource";
    team: string[];
    teamIds?: string[]; // UUIDs for saving
    fn: Fn;
    functionId?: string; // UUID for saving
    empl?: string; // optional binding to a specific person
    employeeId?: string; // UUID for saving
    fnBgColor?: string; // Function background color (hex)
    fnTextColor?: string; // Function text color (hex)
    weeks: number[]; // capacity per week
    prevId?: string | null; // Previous resource ID in order
    nextId?: string | null; // Next resource ID in order
};

export type TaskRow = {
    id: ID;
    kind: "task";
    status: Status;
    sprintsAuto: string[]; // auto-calculated list of sprints the task spans
    epic?: string;
    task: string;
    team: string;
    teamId?: string; // UUID for saving
    fn: Fn;
    functionId?: string; // UUID for saving
    empl?: string; // optional; if set, must use only this resource line(s)
    employeeId?: string; // UUID for saving
    planEmpl: number; // concurrent capacity needed per week
    planWeeks: number; // continuous duration in weeks
    blockerIds: ID[]; // blockers referencing other tasks
    weekBlockers: number[]; // week numbers that block this task (1-based)
    fact: number; // auto: sum of weeks values
    startWeek: number | null; // auto
    endWeek: number | null;   // auto
    expectedStartWeek?: number | null; // скрытое поле для ожидаемой недели начала
    autoPlanEnabled: boolean; // чекбокс автоплана
    weeks: number[]; // actual placed amounts by week
    prevId?: string | null; // Previous task ID in order
    nextId?: string | null; // Next task ID in order
};

export type Row = ResourceRow | TaskRow;
