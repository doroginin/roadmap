
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Select } from "./Select";
import { TeamMultiSelect } from "./TeamMultiSelect";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { normalizeColorValue, getBg, getText } from "./colorUtils";
import { DEFAULT_BG } from "./colorDefaults";

// =============================
// Roadmap "План" — интерактивный прототип (v3.2)
// Fixes:
// - File was truncated. Restored full component and finished JSX.
// - Added missing state addMenuOpen and handlers.
// - Implemented context-menu actions: duplicateRow/deleteRow/addRowAbove/addRowBelow.
// - Kept keyboard + editing behaviors; confirmed drag constraints.
// Tests:
// - Added console self-tests for blocker scheduling and basic guards.
// =============================

// ---- Типы ----
type ID = string;

type Status = "Todo" | "Backlog" | "Cancelled";

type Fn = "BE" | "FE" | "PO" | "AN" | string;

// Типы для стрелок блокеров
type Link = {
    from: { taskId: string; weekIdx: number };
    to: { taskId: string; weekIdx: number };
    isConflict: boolean; // true если есть конфликт планирования
    blockerId: string; // ID задачи-блокера
    blockedTaskId: string; // ID заблокированной задачи
};

type Sprint = {
    code: string; // QxSy
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
};

type ResourceRow = {
    id: ID;
    kind: "resource";
    team: string[];
    fn: Fn;
    empl?: string; // optional binding to a specific person
    weeks: number[]; // capacity per week
};

type TaskRow = {
    id: ID;
    kind: "task";
    status: Status;
    sprintsAuto: string[]; // auto-calculated list of sprints the task spans
    epic?: string;
    task: string;
    team: string;
    fn: Fn;
    empl?: string; // optional; if set, must use only this resource line(s)
    planEmpl: number; // concurrent capacity needed per week
    planWeeks: number; // continuous duration in weeks
    blockerIds: ID[]; // blockers referencing other tasks
    fact: number; // auto: sum of weeks values
    startWeek: number | null; // auto
    endWeek: number | null;   // auto
    manualEdited: boolean; // ✏️ flag
    autoPlanEnabled: boolean; // чекбокс автоплана
    weeks: number[]; // actual placed amounts by week
};

type Row = ResourceRow | TaskRow;

// ---- Вспомогательные ----
function range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function fmtDM(dateISO: string) {
    const d = new Date(dateISO + "T00:00:00Z");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
}

// ---- Функции для стрелок блокеров ----
function cellId(taskId: string, weekIdx: number) {
    return `cell-${taskId}-${weekIdx}`;
}

function lastAllocatedWeek(task: TaskRow): number | null {
    const arr = task.weeks ?? [];
    for (let i = arr.length - 1; i >= 0; i--) {
        if ((arr[i] ?? 0) > 0) return i;
    }
    return null;
}

function firstAllocatedWeek(task: TaskRow): number | null {
    const arr = task.weeks ?? [];
    for (let i = 0; i < arr.length; i++) {
        if ((arr[i] ?? 0) > 0) return i;
    }
    return null;
}

function buildLinks(tasks: TaskRow[]): Link[] {
    const links: Link[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    for (const task of tasks) {
        for (const blockerId of task.blockerIds) {
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
                
                if (targetWeek != null && targetWeek < 16) { // проверяем что неделя в пределах таблицы
                    links.push({
                        from: { taskId: blockerId, weekIdx: fromW },
                        to: { taskId: task.id, weekIdx: targetWeek },
                        isConflict,
                        blockerId,
                        blockedTaskId: task.id
                    });
                }
            }
        }
    }
    return links;
}

const TOTAL_WEEKS = 16;

// ---- Функции для умной маршрутизации стрелок ----
function isTaskCellFilled(tasks: TaskRow[], taskId: string, weekIdx: number): boolean {
    const task = tasks.find(t => t.id === taskId);
    return task ? (task.weeks[weekIdx] || 0) > 0 : false;
}

function countFilledCellsInPath(tasks: TaskRow[], path: Array<{taskId: string, weekIdx: number}>): number {
    return path.reduce((count, cell) => {
        return count + (isTaskCellFilled(tasks, cell.taskId, cell.weekIdx) ? 1 : 0);
    }, 0);
}


function calculateRoutePath(
    tasks: TaskRow[], 
    fromTaskId: string, 
    fromWeek: number, 
    toTaskId: string, 
    toWeek: number,
    routeType: 'top' | 'bottom'
): Array<{taskId: string, weekIdx: number}> {
    const path: Array<{taskId: string, weekIdx: number}> = [];
    
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

function chooseBestRoute(
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

// ---- Компонент ArrowOverlay ----
function ArrowOverlay({ 
    links, 
    container, 
    onRemoveBlocker,
    tasks
}: { 
    links: Link[]; 
    container: HTMLDivElement | null;
    onRemoveBlocker: (blockerId: string, blockedTaskId: string) => void;
    tasks: TaskRow[];
}) {
    const [paths, setPaths] = useState<Array<{
        id: string;
        d: string; // SVG path
        isConflict: boolean; // конфликт планирования
        blockerId: string;
        blockedTaskId: string;
    }>>([]);
    const [hoverId, setHoverId] = useState<string | null>(null);

    // Measure and compute paths
    useLayoutEffect(() => {
        if (!container) return;

        const measure = () => {
            const wrapRect = container.getBoundingClientRect();
            const result: typeof paths = [];

            links.forEach((link, i) => {
                const a = document.getElementById(cellId(link.from.taskId, link.from.weekIdx));
                const b = document.getElementById(cellId(link.to.taskId, link.to.weekIdx));
                if (!a || !b) return;
                
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();

                // Умная маршрутизация стрелки
                const routeType = chooseBestRoute(
                    tasks,
                    link.from.taskId,
                    link.from.weekIdx,
                    link.to.taskId,
                    link.to.weekIdx
                );

                let x1: number, y1: number, x2: number, y2: number, d: string;

                // Определяем, идет ли стрелка снизу вверх
                const isUpward = ra.top > rb.top;
                
                if (routeType === 'top') {
                    // Маршрут: правая граница источника → верх/низ цели
                    x1 = ra.right - wrapRect.left + container.scrollLeft;
                    y1 = ra.top + ra.height / 2 - wrapRect.top + container.scrollTop;
                    x2 = rb.left + rb.width / 2 - wrapRect.left + container.scrollLeft;
                    // Если стрелка идет снизу вверх, направляем в нижний край ячейки
                    y2 = isUpward ? rb.bottom - wrapRect.top + container.scrollTop : rb.top - wrapRect.top + container.scrollTop;
                    d = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
                } else {
                    // Маршрут: низ источника → левая граница цели
                    x1 = ra.left + ra.width / 2 - wrapRect.left + container.scrollLeft;
                    y1 = ra.bottom - wrapRect.top + container.scrollTop;
                    x2 = rb.left - wrapRect.left + container.scrollLeft;
                    y2 = rb.top + rb.height / 2 - wrapRect.top + container.scrollTop;
                    d = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
                }
                result.push({ 
                    id: String(i), 
                    d, 
                    isConflict: link.isConflict,
                    blockerId: link.blockerId,
                    blockedTaskId: link.blockedTaskId
                });
            });

            setPaths(result);
        };

        // Observe resize/scroll/DOM changes
        const ro = new ResizeObserver(measure);
        ro.observe(container);
        const obs = new MutationObserver(measure);
        obs.observe(container, { childList: true, subtree: true, attributes: true });

        const onScroll = () => measure();
        container.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", measure);
        document.addEventListener("scroll", onScroll, true);

        measure();

        return () => {
            ro.disconnect();
            obs.disconnect();
            container.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", measure);
            document.removeEventListener("scroll", onScroll, true);
        };
    }, [container, links]);

    if (!container) return null;

    const w = Math.max(container.clientWidth, container.scrollWidth);
    const h = Math.max(container.clientHeight, container.scrollHeight);

    return (
        <svg
            width={w}
            height={h}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}
        >
            <defs>
                <marker id="arrow-head-normal" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
                </marker>
                <marker id="arrow-head-normal-hover" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#111827" />
                </marker>
                <marker id="arrow-head-conflict" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                </marker>
                <marker id="arrow-head-conflict-hover" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#b91c1c" />
                </marker>
            </defs>

            {paths.map((p) => {
                const active = hoverId === p.id;
                // Hover colors: серые становятся черными, красные - более красными
                const baseStroke = p.isConflict ? "#dc2626" : "#6b7280";
                const hoverStroke = p.isConflict ? "#b91c1c" : "#111827";
                const stroke = active ? hoverStroke : baseStroke;
                const strokeWidth = 3; // постоянная толщина
                
                // Выбираем маркер в зависимости от состояния
                let markerId: string;
                if (p.isConflict) {
                    markerId = active ? "arrow-head-conflict-hover" : "arrow-head-conflict";
                } else {
                    markerId = active ? "arrow-head-normal-hover" : "arrow-head-normal";
                }
                return (
                    <g key={p.id}>
                        {/* Hitbox for hover/click (wide invisible stroke with pointer events) */}
                        <path
                            d={p.d}
                            stroke="transparent"
                            strokeWidth={16}
                            fill="none"
                            style={{ pointerEvents: "stroke", cursor: "pointer" }}
                            onMouseEnter={() => setHoverId(p.id)}
                            onMouseLeave={() => setHoverId((prev) => (prev === p.id ? null : prev))}
                            onClick={() => {
                                const confirmed = window.confirm("Удалить блокер?");
                                if (confirmed) {
                                    onRemoveBlocker(p.blockerId, p.blockedTaskId);
                                }
                            }}
                        />

                        {/* Visible arrow */}
                        <path
                            d={p.d}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            markerEnd={`url(#${markerId})`}
                            opacity={active ? 1 : 0.95}
                            style={{ pointerEvents: "none" }}
                        />
                    </g>
                );
            })}
        </svg>
    );
}

// ---- Компонент ----
export function RoadmapPlan() {
    // ===== Tabs =====
    type Tab = "plan" | "sprints" | "teams";
    const [tab, setTab] = useState<Tab>("plan");

    // ===== Спринты (редактируемые) =====
    const [sprints, setSprints] = useState<Sprint[]>([
        { code: "Q3S1", start: "2025-06-02", end: "2025-06-29" },
        { code: "Q3S2", start: "2025-06-30", end: "2025-07-27" },
        { code: "Q3S3", start: "2025-07-28", end: "2025-08-24" },
        { code: "Q3S4", start: "2025-08-25", end: "2025-09-21" },
    ]);

    // ===== Команды (редактируемые) =====
    type TeamData = {
        name: string;
        jiraProject: string;
        featureTeam: string;
        issueType: string;
    };
    const [teamData, setTeamData] = useState<TeamData[]>([
        { name: "Demo", jiraProject: "", featureTeam: "", issueType: "" }
    ]);

    // Преобразуем данные команд в массив имен для совместимости с существующими компонентами
    const teamNames = useMemo(() => teamData.map(t => t.name), [teamData]);
    const WEEK0 = sprints[0]?.start || "2025-06-02";

    function mapWeekToSprintLocal(weekIndex0: number): string | null {
        const startDate = new Date(WEEK0 + "T00:00:00Z");
        startDate.setUTCDate(startDate.getUTCDate() + 7 * weekIndex0);
        const iso = startDate.toISOString().slice(0, 10);
        const d = new Date(iso + "T00:00:00Z");
        for (const s of sprints) {
            const s0 = new Date(s.start + "T00:00:00Z");
            const s1 = new Date(s.end + "T00:00:00Z");
            if (d >= s0 && d <= s1) return s.code;
        }
        return null;
    }
    function weekHeaderLabelLocal(idx0: number) {
        const startDate = new Date(WEEK0 + "T00:00:00Z");
        startDate.setUTCDate(startDate.getUTCDate() + 7 * idx0);
        const startISO = startDate.toISOString().slice(0, 10);
        const endDate = new Date(startDate.getTime());
        endDate.setUTCDate(endDate.getUTCDate() + 6);
        const endISO = endDate.toISOString().slice(0, 10);
        return { num: idx0 + 1, sprint: mapWeekToSprintLocal(idx0), from: fmtDM(startISO), to: fmtDM(endISO) };
    }

    function listSprintsBetweenLocal(startWeek: number | null, endWeek: number | null): string[] {
        if (!startWeek || !endWeek) return [];
        const codes = new Set<string>();
        for (let w = startWeek - 1; w < endWeek; w++) { const code = mapWeekToSprintLocal(w); if (code) codes.add(code); }
        return Array.from(codes);
    }

    // ===== Цвета =====
    // fnColors оставлены для совместимости, но не используются для покраски столбцов.
    // Новый источник цвета: пара Team+Fn
    const [teamFnColors, setTeamFnColors] = useState<Record<string, string | { bg: string; text: string }>>({});
    const [colorPanel, setColorPanel] = useState<{ anchor: { x: number; y: number }; teamFnKey: string; view: "resource" | "task"; initial: { bg: string; text: string } } | null>(null)


    // ===== Демо-данные строк =====
    const [rows, setRows] = useState<Row[]>(() => {
        const res1: ResourceRow = { id: "r1", kind: "resource", team: ["Demo"], fn: "BE", empl: "Ivan", weeks: Array(TOTAL_WEEKS).fill(1) };
        const res2: ResourceRow = { id: "r2", kind: "resource", team: ["Demo"], fn: "FE", weeks: Array(TOTAL_WEEKS).fill(1) };
        const res3: ResourceRow = { id: "r3", kind: "resource", team: ["Demo"], fn: "PO", weeks: Array(TOTAL_WEEKS).fill(1) };
        const t1: TaskRow = { id: "t1", kind: "task", status: "Todo", sprintsAuto: [], epic: "Эпик 1", task: "Задача 1", team: "Demo", fn: "BE", empl: "Ivan", planEmpl: 1, planWeeks: 3, blockerIds: [], fact: 0, startWeek: null, endWeek: null, manualEdited: false, autoPlanEnabled: true, weeks: Array(TOTAL_WEEKS).fill(0) };
        const t2: TaskRow = { id: "t2", kind: "task", status: "Todo", sprintsAuto: [], epic: "Эпик 1", task: "Задача 2", team: "Demo", fn: "BE", planEmpl: 1, planWeeks: 2, blockerIds: ["t1"], fact: 0, startWeek: null, endWeek: null, manualEdited: false, autoPlanEnabled: true, weeks: Array(TOTAL_WEEKS).fill(0) };
        const t3: TaskRow = { id: "t3", kind: "task", status: "Backlog", sprintsAuto: [], epic: "Эпик 2", task: "Задача 3", team: "Demo", fn: "FE", planEmpl: 1, planWeeks: 4, blockerIds: [], fact: 0, startWeek: null, endWeek: null, manualEdited: false, autoPlanEnabled: true, weeks: Array(TOTAL_WEEKS).fill(0) };
        return [res1, res2, res3, t1, t2, t3];
    });

    // ===== Последовательный пересчёт (как в формуле roadmap.js) =====
    type ResState = { res: ResourceRow; load: number[] };
    
    
    function computeAllRowsLocal(list: Row[]): { rows: Row[]; resLoad: Record<ID, number[]> } {
        const resources: ResState[] = list.filter(r => r.kind === 'resource').map(r => ({ 
            res: r as ResourceRow, 
            load: Array(TOTAL_WEEKS).fill(0) 
        }));
        const out: Row[] = [];
        const ceil = (x: number) => Math.ceil(Math.max(0, x || 0));

        const findTaskByIdInOut = (id: ID): TaskRow | undefined => 
            out.find(x => x.id === id && x.kind === 'task') as TaskRow | undefined;

        function matchResourceForTask(res: ResourceRow, t: TaskRow): boolean {
            if (res.fn !== t.fn) return false;
            // Преобразуем массив команд ресурса в строку для совместимости с логикой roadmap.js
            const resTeams = res.team; // массив команд
            const hitTeam = resTeams.includes((t.team || '').trim());
            if (!hitTeam) return false;
            if (t.empl && res.empl && t.empl !== res.empl) return false;
            if (t.empl && !res.empl) return false; // задача на конкретного сотрудника требует ресурс с тем же empl
            return true;
        }

        function freeTotalsForTask(t: TaskRow): { matched: ResState[]; free: number[] } {
            const matched = resources.filter(rs => matchResourceForTask(rs.res, t));
            const free = range(TOTAL_WEEKS).map(w => 
                matched.reduce((s, rs) => s + Math.max(0, (rs.res.weeks[w] || 0) - (rs.load[w] || 0)), 0)
            );
            return { matched, free };
        }

        function allocateWeekLoadAcrossResources(amount: number, matched: ResState[], week: number) {
            if (amount <= 0 || matched.length === 0) return;
            // свободные ёмкости на этой неделе
            const freeCaps = matched.map(rs => Math.max(0, (rs.res.weeks[week] || 0) - (rs.load[week] || 0)));
            const sumFree = freeCaps.reduce((a, b) => a + b, 0);
            let remain = amount;
            // 1) жадно слева-направо
            for (let j = 0; j < matched.length && remain > 0; j++) {
                const take = Math.min(freeCaps[j], remain);
                matched[j].load[week] += take;
                remain -= take;
            }
            // 2) остаток распределить пропорционально свободным (или поровну, если sumFree==0)
            if (remain > 0) {
                if (sumFree > 0) {
                    for (let j = 0; j < matched.length; j++) {
                        const extra = remain * (freeCaps[j] / sumFree);
                        matched[j].load[week] += extra;
                    }
                } else {
                    const share = remain / matched.length;
                    for (let j = 0; j < matched.length; j++) matched[j].load[week] += share;
                }
            }
        }

        function computeAutoForTask(t0: TaskRow): TaskRow {
            const t = { ...t0 };
            const need = Math.max(0, t.planEmpl || 0);
            const dur = ceil(t.planWeeks || 0);

            // blocker = max(End) по уже обработанным задачам
            const blocker = (t.blockerIds || [])
                .map(id => findTaskByIdInOut(id)?.endWeek || 0)
                .reduce((a, b) => Math.max(a, b), 0);

            // режим: ручной план при отключённом Auto → просто учитываем загрузку
            if (!t.autoPlanEnabled && t.manualEdited) {
                const weeks = t.weeks.slice();
                const matched = resources.filter(rs => matchResourceForTask(rs.res, t));
                for (let w = 0; w < TOTAL_WEEKS; w++) {
                    if (weeks[w] > 0) allocateWeekLoadAcrossResources(weeks[w], matched, w);
                }
                const nz = weeks.map((v, i) => v > 0 ? i + 1 : 0).filter(Boolean) as number[];
                t.startWeek = nz.length ? Math.min(...nz) : null;
                t.endWeek = nz.length ? Math.max(...nz) : null;
                t.fact = weeks.reduce((a, b) => a + b, 0);
                t.sprintsAuto = listSprintsBetweenLocal(t.startWeek, t.endWeek);
                return t;
            }

            // Автоплан: поиск самого раннего стартового окна s > blocker
            const { matched, free } = freeTotalsForTask(t);
            let start = 0;
            if (need > 0 && dur > 0 && matched.length > 0) {
                const maxStart = TOTAL_WEEKS - dur + 1;
                for (let s = Math.max(1, blocker + 1); s <= maxStart; s++) {
                    let ok = true;
                    for (let off = 0; off < dur; off++) {
                        if (free[s - 1 + off] < need) { 
                            ok = false; 
                            break; 
                        }
                    }
                    if (ok) { 
                        start = s; 
                        break; 
                    }
                }
            }
            const weeks = Array(TOTAL_WEEKS).fill(0) as number[];
            if (start > 0 && need > 0 && dur > 0) {
                for (let off = 0; off < dur; off++) {
                    weeks[start - 1 + off] = need;
                    allocateWeekLoadAcrossResources(need, matched, start - 1 + off);
                }
            }
            t.weeks = weeks;
            const nz = weeks.map((v, i) => v > 0 ? i + 1 : 0).filter(Boolean) as number[];
            t.startWeek = nz.length ? Math.min(...nz) : null;
            t.endWeek = nz.length ? Math.max(...nz) : null;
            t.fact = weeks.reduce((a, b) => a + b, 0);
            t.sprintsAuto = listSprintsBetweenLocal(t.startWeek, t.endWeek);
            return t;
        }

        // основной проход сверху вниз
        for (const r of list) {
            if (r.kind === 'resource') { 
                out.push(r); 
            } else { 
                out.push(computeAutoForTask(r as TaskRow)); 
            }
        }

        const resLoad: Record<ID, number[]> = Object.fromEntries(
            resources.map(rs => [rs.res.id, rs.load.slice()])
        );
        return { rows: out, resLoad };
    }

    const computed = useMemo(() => computeAllRowsLocal(rows), [rows, sprints]);
    const computedRows = computed.rows;

    // ====== Выделение/редактирование ======
    type ColKey = "type"|"status"|"sprintsAuto"|"epic"|"task"|"team"|"fn"|"empl"|"planEmpl"|"planWeeks"|"fact"|"start"|"end"|"autoplan"|{week:number};
    type SprintColKey = "code"|"start"|"end";
    type TeamColKey = "name"|"jiraProject"|"featureTeam"|"issueType";
    type Selection = { rowId: ID; col: ColKey } | null;
    type SprintSelection = { rowId: number; col: SprintColKey } | null;
    type TeamSelection = { rowId: number; col: TeamColKey } | null;
    const [sel, setSel] = useState<Selection>(null);
    const [editing, setEditing] = useState<Selection>(null);
    const [sprintSel, setSprintSel] = useState<SprintSelection>(null);
    const [sprintEditing, setSprintEditing] = useState<SprintSelection>(null);
    const [teamSel, setTeamSel] = useState<TeamSelection>(null);
    const [teamEditing, setTeamEditing] = useState<TeamSelection>(null);
    const cancelEditRef = useRef<boolean>(false);
    const cancelSprintEditRef = useRef<boolean>(false);
    const cancelTeamEditRef = useRef<boolean>(false);

    // ====== Стрелки блокеров ======
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    
    useEffect(() => {
        // ensure the ref is set after mount
        setContainerEl(tableContainerRef.current);
    }, []);

    // Порядок колонок для стрелок
    const columnOrder = useMemo<(ColKey)[]>(() => {
        const base: (ColKey)[] = ["type","status","sprintsAuto","epic","task","team","fn","empl","planEmpl","planWeeks","autoplan"];
        const weeks: (ColKey)[] = range(TOTAL_WEEKS).map(i => ({ week: i }));
        return [...base, ...weeks];
    }, []);
    function moveSelection(delta: number) {
        if (!sel) return;
        
        // Определяем тип строки
        const row = computedRows.find(r => r.id === sel.rowId);
        const isResource = row?.kind === "resource";
        
        // Находим следующую редактируемую ячейку
        const next = findNextEditableColumn(sel.col, delta, isResource);
        
        if (next) {
            setSel({ rowId: sel.rowId, col: next });
        }
        // Если не найдено редактируемых ячеек в этом направлении, не двигаем курсор
    }
    // Переход по строкам при сохранении текущей колонки
    function moveSelectionRow(delta: number) {
        if (!sel) return;
        const i = filteredRows.findIndex(r => r.id === sel.rowId);
        if (i < 0) return;
        const j = Math.max(0, Math.min(filteredRows.length - 1, i + delta));
        const target = filteredRows[j];
        if (!target) return;
        
        // Определяем тип текущей и целевой строки
        const currentRow = computedRows.find(r => r.id === sel.rowId);
        const targetRow = computedRows.find(r => r.id === target.id);
        const currentIsResource = currentRow?.kind === "resource";
        const targetIsResource = targetRow?.kind === "resource";
        
        let targetCol: ColKey = sel.col;
        
        // Если переходим от задачи к ресурсу
        if (!currentIsResource && targetIsResource) {
            // Маппинг колонок задач к объединенным ячейкам ресурсов
            if (sel.col === "sprintsAuto" || sel.col === "epic" || sel.col === "task") {
                targetCol = "status"; // Объединенная ячейка Status/Sprints/Epic/Task
            } else if (sel.col === "planWeeks" || sel.col === "autoplan") {
                targetCol = "planEmpl"; // Объединенная ячейка Plan empl/Plan weeks/Auto
            }
            // Для остальных колонок (type, status, team, fn, empl, planEmpl) оставляем как есть
        }
        // Если переходим от ресурса к задаче
        else if (currentIsResource && !targetIsResource) {
            // Маппинг объединенных ячеек ресурсов к первым колонкам задач
            if (sel.col === "status") {
                targetCol = "status"; // Первая колонка объединенной ячейки
            } else if (sel.col === "planEmpl") {
                targetCol = "planEmpl"; // Первая колонка объединенной ячейки плана
            }
            // Для остальных колонок оставляем как есть
        }
        
        // Проверяем, можно ли перейти в целевую строку
        if (!currentIsResource && targetIsResource) {
            // Переход от задачи к ресурсу - проверяем, можно ли переходить из этой колонки
            if (!canNavigateFromTaskToResource(sel.col)) {
                return; // Не переходим, если нельзя переходить из этой колонки задачи в ресурс
            }
        } else if (!hasEditableColumnsInTargetRow(targetCol, targetIsResource)) {
            // Для остальных случаев проверяем, есть ли редактируемые ячейки в целевой строке
            return; // Не переходим, если нет редактируемых ячеек в целевой строке
        }
        
        setSel({ rowId: target.id, col: targetCol });
        
        // Прокручиваем таблицу, чтобы выделенная ячейка была видна
        setTimeout(() => {
            const tableContainer = tableContainerRef.current;
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
    }
    // Проверяет, является ли колонка редактируемой
    function isEditableColumn(col: ColKey, isResource: boolean): boolean {
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
    }

    // Находит следующую редактируемую ячейку в заданном направлении
    function findNextEditableColumn(currentCol: ColKey, direction: number, isResource: boolean): ColKey | null {
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
    }

    // Проверяет, есть ли редактируемые ячейки в целевой строке, которые соответствуют текущей позиции
    function hasEditableColumnsInTargetRow(targetCol: ColKey, targetIsResource: boolean): boolean {
        // Проверяем, является ли сама целевая колонка редактируемой
        if (isEditableColumn(targetCol, targetIsResource)) {
            return true;
        }
        
        // Если целевая колонка не редактируемая, проверяем, есть ли редактируемые колонки в том же "блоке"
        // Например, если мы в колонке "status" задачи и переходим к ресурсу, 
        // то проверяем, есть ли редактируемые колонки в том же диапазоне
        
        const keyEq = (a: ColKey, b: ColKey) => (typeof a === "string" && typeof b === "string" && a===b) || (typeof a === "object" && typeof b === "object" && a.week===b.week);
        const idx = columnOrder.findIndex(k => keyEq(k, targetCol));
        if (idx === -1) return false;
        
        // Для ресурсов проверяем колонки team, fn, empl, недели
        if (targetIsResource) {
            return isEditableColumn("team", true) || isEditableColumn("fn", true) || 
                   isEditableColumn("empl", true) || isEditableColumn({ week: 0 }, true);
        } else {
            // Для задач проверяем все редактируемые колонки
            return isEditableColumn("status", false) || isEditableColumn("epic", false) || 
                   isEditableColumn("task", false) || isEditableColumn("team", false) || 
                   isEditableColumn("fn", false) || isEditableColumn("empl", false) || 
                   isEditableColumn("planEmpl", false) || isEditableColumn("planWeeks", false) || 
                   isEditableColumn("autoplan", false) || isEditableColumn({ week: 0 }, false);
        }
    }

    // Проверяет, можно ли перейти из колонки задачи в ресурс в режиме просмотра
    function canNavigateFromTaskToResource(taskCol: ColKey): boolean {
        // Для колонок задач, которые не имеют соответствующих редактируемых ячеек в ресурсах выше
        if (taskCol === "status" || taskCol === "sprintsAuto" || taskCol === "epic" || taskCol === "task" || 
            taskCol === "planEmpl" || taskCol === "planWeeks" || taskCol === "autoplan") {
            return false; // Нельзя переходить в ресурсы из этих колонок
        }
        
        // Для остальных колонок (type, team, fn, empl, недели) можно переходить
        return true;
    }

    // Перейти к следующей справа ячейке и сразу включить редактирование
    function focusNextRight(rowId: ID, col: ColKey): boolean {
        // Определяем тип строки
        const row = computedRows.find(r => r.id === rowId);
        const isResource = row?.kind === "resource";
        
        // Находим следующую редактируемую ячейку
        const next = findNextEditableColumn(col, 1, isResource);
        
        if (next) {
            const nextSel: Selection = { rowId, col: next };
            setSel(nextSel);
            // Всегда переходим в режим редактирования для редактируемых ячеек
            startEdit(nextSel);
            return true;
        }
        // Если не найдено редактируемых ячеек в этом направлении, не двигаем курсор
        return false;
    }
    function focusPrevLeft(rowId: ID, col: ColKey): boolean {
        // Определяем тип строки
        const row = computedRows.find(r => r.id === rowId);
        const isResource = row?.kind === "resource";
        
        // Находим предыдущую редактируемую ячейку
        const prev = findNextEditableColumn(col, -1, isResource);
        
        if (prev) {
            const prevSel: Selection = { rowId, col: prev };
            setSel(prevSel);
            // Всегда переходим в режим редактирования для редактируемых ячеек
            startEdit(prevSel);
            return true;
        }
        // Если не найдено редактируемых ячеек в этом направлении, не двигаем курсор
        return false;
    }

    // Навигация в режиме редактирования - сохраняет режим редактирования
    function navigateInEditMode(direction: 'next' | 'prev', currentRowId: ID, currentCol: ColKey): boolean {
        const row = computedRows.find(r => r.id === currentRowId);
        const isResource = row?.kind === "resource";
        
        const next = findNextEditableColumn(currentCol, direction === 'next' ? 1 : -1, isResource);
        
        if (next) {
            const nextSel: Selection = { rowId: currentRowId, col: next };
            setSel(nextSel);
            // Сохраняем режим редактирования
            startEdit(nextSel);
            return true;
        }
        return false;
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const el = e.target as HTMLElement | null;
            const tag = el?.tagName;
            const isEditable = !!el && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable);
            if (isEditable) return;
            // Обработка для таблицы спринтов
            if (tab === 'sprints') {
                if (!sprintSel) return;
                // Space: редактирование
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
            
            // Обработка для таблицы команд
            if (tab === 'teams') {
                if (!teamSel) return;
                // Space: редактирование
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
            
            // Обработка для таблицы плана
            if (!sel) return;
            // Space: автоплан
            if (e.key === " ") {
                e.preventDefault();
                if (typeof sel.col === "string" && sel.col === "autoplan") {
                    const t = computedRows.find(r=>r.id===sel.rowId) as TaskRow | undefined;
                    if (t) toggleAutoPlan(t.id, !t.autoPlanEnabled);
                }
                return;
            }
            // Backspace/Delete: очистка ячейки недели (только если не редактируем inline-инпут)
            if (!editing && (e.key === "Backspace" || e.key === "Delete")) {
                if (typeof sel.col === "object") {
                    e.preventDefault();
                    const row = computedRows.find(r=>r.id===sel.rowId);
                    const w = sel.col.week;
                    if (row?.kind === "task") {
                        const base = weeksBaseForTaskLocal(row as TaskRow);
                        const originalWeeks = (row as TaskRow).weeks.slice();
                        base[w] = 0;
                        
                        // Проверяем, изменилось ли значение
                        const hasChanged = !weeksArraysEqual(base, originalWeeks);
                        
                        setRows(prev=>prev.map(x =>
                            (x.kind==='task' && x.id===row.id)
                                ? { 
                                    ...(x as TaskRow), 
                                    weeks: base,
                                    // Устанавливаем флаги только если значение изменилось
                                    ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                                }
                                : x
                        ));
                    } else if (row?.kind === "resource") {
                        setRows(prev=>prev.map(x =>
                            (x.kind==='resource' && x.id===row.id)
                                ? { ...(x as ResourceRow), weeks: (x as ResourceRow).weeks.map((vv,i)=> i===w? 0: vv) }
                                : x
                        ));
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
                    // сохранить
                    commitEdit();
                } else if (typeof sel.col === "object") {
                    // Inline-редактирование недельной ячейки
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

    function startEdit(s: Selection) {
        setEditing(s);
        cancelEditRef.current = false;
    }
    function stopEdit() { 
        setEditing(null); 
    }
    function commitEdit() { setEditing(null); }

    // ====== Функции для редактирования спринтов ======
    function startSprintEdit(s: SprintSelection) {
        console.log('startSprintEdit called with:', s);
        setSprintEditing(s);
        cancelSprintEditRef.current = false;
    }
    function stopSprintEdit() { setSprintEditing(null); }
    function commitSprintEdit() { setSprintEditing(null); }

    // Функция для форматирования даты в формат DD.MM.YYYY
    function formatDate(dateString: string): string {
        if (!dateString) return '';
        const date = new Date(dateString + 'T00:00:00Z');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }

    // ====== Функции управления спринтами ======
    function addSprint() {
        const newSprint: Sprint = {
            code: `Q3S${sprints.length + 1}`,
            start: "",
            end: ""
        };
        setSprints([...sprints, newSprint]);
    }

    function addSprintAbove(index: number) {
        const newSprint: Sprint = {
            code: `Q3S${sprints.length + 1}`,
            start: "",
            end: ""
        };
        const newSprints = [...sprints];
        newSprints.splice(index, 0, newSprint);
        setSprints(newSprints);
    }

    function addSprintBelow(index: number) {
        const newSprint: Sprint = {
            code: `Q3S${sprints.length + 1}`,
            start: "",
            end: ""
        };
        const newSprints = [...sprints];
        newSprints.splice(index + 1, 0, newSprint);
        setSprints(newSprints);
    }

    function deleteSprint(index: number) {
        if (sprints.length > 1) {
            const newSprints = sprints.filter((_, i) => i !== index);
            setSprints(newSprints);
        }
    }

    // ====== Функции управления командами ======
    function addTeam() {
        const newTeam: TeamData = {
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        setTeamData([...teamData, newTeam]);
    }

    function addTeamAbove(index: number) {
        const newTeam: TeamData = {
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        const newTeams = [...teamData];
        newTeams.splice(index, 0, newTeam);
        setTeamData(newTeams);
    }

    function addTeamBelow(index: number) {
        const newTeam: TeamData = {
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        const newTeams = [...teamData];
        newTeams.splice(index + 1, 0, newTeam);
        setTeamData(newTeams);
    }

    function deleteTeam(index: number) {
        if (teamData.length > 1) {
            const newTeams = teamData.filter((_, i) => i !== index);
            setTeamData(newTeams);
        }
    }

    // Функция для получения стиля границ ячейки спринта
    function getSprintCellBorderStyle(isSelected: boolean | null = false): React.CSSProperties {
        if (isSelected) {
            return {
                borderTop: '2px solid gray',
                borderRight: '2px solid gray',
                borderBottom: '2px solid gray',
                borderLeft: '2px solid gray',
                paddingRight: '0.5em',
                paddingLeft: '0.5em'
            };
        }
        return {
            borderTop: '1px solid rgb(226, 232, 240)',
            borderRight: '1px solid rgb(226, 232, 240)',
            borderBottom: '1px solid rgb(226, 232, 240)',
            borderLeft: '1px solid rgb(226, 232, 240)',
            paddingRight: '0.5em',
            paddingLeft: '0.5em'
        };
    }

    // Функция для получения стиля границ ячейки команды
    function getTeamCellBorderStyle(isSelected: boolean | null = false): React.CSSProperties {
        if (isSelected) {
            return {
                borderTop: '2px solid gray',
                borderRight: '2px solid gray',
                borderBottom: '2px solid gray',
                borderLeft: '2px solid gray',
                paddingRight: '0.5em',
                paddingLeft: '0.5em'
            };
        }
        return {
            borderTop: '1px solid rgb(226, 232, 240)',
            borderRight: '1px solid rgb(226, 232, 240)',
            borderBottom: '1px solid rgb(226, 232, 240)',
            borderLeft: '1px solid rgb(226, 232, 240)',
            paddingRight: '0.5em',
            paddingLeft: '0.5em'
        };
    }

    // Навигация по спринтам
    function moveSprintSelection(delta: number) {
        if (!sprintSel) return;
        
        const sprintCols: SprintColKey[] = ["code", "start", "end"];
        const currentIdx = sprintCols.indexOf(sprintSel.col);
        const nextIdx = currentIdx + delta;
        
        if (nextIdx >= 0 && nextIdx < sprintCols.length) {
            setSprintSel({ rowId: sprintSel.rowId, col: sprintCols[nextIdx] });
        }
    }

    function moveSprintSelectionRow(delta: number) {
        if (!sprintSel) return;
        const nextRowId = sprintSel.rowId + delta;
        if (nextRowId >= 0 && nextRowId < sprints.length) {
            setSprintSel({ rowId: nextRowId, col: sprintSel.col });
            
            // Прокручиваем таблицу, чтобы выделенная ячейка была видна
            setTimeout(() => {
                const tableContainer = document.querySelector('.sprint-table-container');
                if (tableContainer) {
                    const selectedRow = tableContainer.querySelector(`tr:nth-child(${nextRowId + 2})`); // +2 потому что есть заголовок
                    if (selectedRow) {
                        selectedRow.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                        });
                    }
                }
            }, 0);
        }
    }

    // Навигация в режиме редактирования спринтов
    function navigateSprintInEditMode(direction: 'next' | 'prev', currentRowId: number, currentCol: SprintColKey) {
        const sprintCols: SprintColKey[] = ["code", "start", "end"];
        const currentIdx = sprintCols.indexOf(currentCol);
        const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        
        if (nextIdx >= 0 && nextIdx < sprintCols.length) {
            // Есть следующая ячейка в той же строке
            const nextSel: SprintSelection = { rowId: currentRowId, col: sprintCols[nextIdx] };
            setSprintSel(nextSel);
            startSprintEdit(nextSel);
        } else {
            // Нет следующей ячейки в строке - не переходим никуда
            // Остаемся в текущей ячейке
            return;
        }
    }

    // ====== Функции редактирования команд ======
    function startTeamEdit(s: TeamSelection) {
        if (!s) return;
        setTeamEditing(s);
        cancelTeamEditRef.current = false;
    }

    function stopTeamEdit() {
        setTeamEditing(null);
    }

    function commitTeamEdit() {
        stopTeamEdit();
    }

    // Навигация по командам
    function moveTeamSelection(delta: number) {
        if (!teamSel) return;
        const teamCols: TeamColKey[] = ["name", "jiraProject", "featureTeam", "issueType"];
        const currentIdx = teamCols.indexOf(teamSel.col);
        const nextIdx = currentIdx + delta;
        
        if (nextIdx >= 0 && nextIdx < teamCols.length) {
            setTeamSel({ rowId: teamSel.rowId, col: teamCols[nextIdx] });
        }
    }

    function moveTeamSelectionRow(delta: number) {
        if (!teamSel) return;
        const nextRowId = teamSel.rowId + delta;
        if (nextRowId >= 0 && nextRowId < teamData.length) {
            setTeamSel({ rowId: nextRowId, col: teamSel.col });
            
            // Прокручиваем таблицу, чтобы выделенная ячейка была видна
            setTimeout(() => {
                const tableContainer = document.querySelector('.team-table-container');
                if (tableContainer) {
                    const selectedRow = tableContainer.querySelector(`tr:nth-child(${nextRowId + 2})`); // +2 потому что есть заголовок
                    if (selectedRow) {
                        selectedRow.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                        });
                    }
                }
            }, 0);
        }
    }

    // Навигация в режиме редактирования команд
    function navigateTeamInEditMode(direction: 'next' | 'prev', currentRowId: number, currentCol: TeamColKey) {
        const teamCols: TeamColKey[] = ["name", "jiraProject", "featureTeam", "issueType"];
        const currentIdx = teamCols.indexOf(currentCol);
        const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        
        if (nextIdx >= 0 && nextIdx < teamCols.length) {
            // Есть следующая ячейка в той же строке
            const nextSel: TeamSelection = { rowId: currentRowId, col: teamCols[nextIdx] };
            setTeamSel(nextSel);
            startTeamEdit(nextSel);
        } else {
            // Нет следующей ячейки в строке - не переходим никуда
            // Остаемся в текущей ячейке
            return;
        }
    }

    // ====== Контекстные меню ======
    type CtxMenu = { x:number; y:number; rowId:ID; kind:"task"|"resource"; field?:"fn"; draftColor?: string } | null;
    type SprintCtxMenu = { x:number; y:number; index:number } | null;
    type TeamCtxMenu = { x:number; y:number; index:number } | null;
    const [ctx, setCtx] = useState<CtxMenu>(null);
    const [sprintCtx, setSprintCtx] = useState<SprintCtxMenu>(null);
    const [teamCtx, setTeamCtx] = useState<TeamCtxMenu>(null);

    function onContextMenuRow(e: React.MouseEvent, r: Row) { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, rowId: r.id, kind: r.kind }); }
    function onContextMenuSprint(e: React.MouseEvent, index: number) { 
        e.preventDefault(); 
        setSprintCtx({ x: e.clientX, y: e.clientY, index }); 
    }
    function onContextMenuTeam(e: React.MouseEvent, index: number) { 
        e.preventDefault(); 
        setTeamCtx({ x: e.clientX, y: e.clientY, index }); 
    }
    function onContextMenuCellColor(e: React.MouseEvent, r: ResourceRow | TaskRow, field: "fn", kind: "resource" | "task") {
        e.preventDefault();
        e.stopPropagation();
        const currentColor = kind === "resource"
            ? getTeamFnColorForResource(r as ResourceRow)
            : getTeamFnColorForTask(r as TaskRow);
        setCtx({ x: e.clientX, y: e.clientY, rowId: r.id, kind, field, draftColor: currentColor });
    }

    // ====== Drag reorder только по колонкам до Auto ======
    const dragRowRef = useRef<{ id: ID; kind: "resource"|"task" } | null>(null);
    const dragAllowedRef = useRef<boolean>(false);
    const isDraggingRef = useRef<boolean>(false);
    const [dragTooltip, setDragTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        task: TaskRow | null;
        resource: ResourceRow | null;
    }>({ visible: false, x: 0, y: 0, task: null, resource: null });
    
    const [highlightedRowId, setHighlightedRowId] = useState<ID | null>(null);
    const [dropPositionRowId, setDropPositionRowId] = useState<ID | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom'>('top');

    function markDragAllowed() { 
        dragAllowedRef.current = true; 
    }
    function clearDragAllowed() { dragAllowedRef.current = false; }
    
    // Вспомогательная функция для получения класса границ ячейки
    function getCellBorderClass(_rowId: ID): string {
        // Временно отключаем CSS классы, используем только inline стили
        return '';
    }
    
    // Вспомогательная функция для получения стиля границ ячейки для drag
        function getCellBorderStyleForDrag(rowId: ID): React.CSSProperties {
            // Если есть highlightedRowId (Shift+drag), показываем только красные рамки
            if (highlightedRowId) {
                if (highlightedRowId === rowId) {
                    return { borderTop: '2px solid #f87171', borderBottom: '2px solid #f87171' }; // светло-красная рамка
                }
                return {}; // Не показываем никаких рамок для других строк при Shift+drag
            }
            
            // Если нет highlightedRowId, показываем обычные серые рамки для dropPositionRowId
            if (dropPositionRowId === rowId) {
                if (dropPosition === 'top') {
                    return { borderTop: '2px solid #6b7280' }; // серая рамка сверху
                } else {
                    return { borderBottom: '2px solid #6b7280' }; // серая рамка снизу
                }
            }
            
            return {};
        }
    
    // Вспомогательная функция для получения стиля границ ячейки
    function getCellBorderStyle(isSelected: boolean | null = false): React.CSSProperties {
        if (isSelected) {
            return { 
                borderTop: '2px solid gray',
                borderRight: '2px solid gray',
                borderBottom: '2px solid gray',
                borderLeft: '2px solid gray',
                paddingRight: '0.5em',
                paddingLeft: '0.5em'
            };
        }
        return { 
            borderTop: '1px solid rgb(226, 232, 240)',
            borderRight: '1px solid rgb(226, 232, 240)',
            borderBottom: '1px solid rgb(226, 232, 240)',
            borderLeft: '1px solid rgb(226, 232, 240)',
            paddingRight: '0.5em',
            paddingLeft: '0.5em'
        };
    }
    
    
    function onMouseDownRow(e: React.MouseEvent, r: Row) {
        if (!dragAllowedRef.current) return;
        if (e.button !== 0) return; // только левая кнопка мыши
        
        
        dragRowRef.current = { id: r.id, kind: r.kind };
        isDraggingRef.current = true;
        
        // Очищаем предыдущие состояния подсветки
        setHighlightedRowId(null);
        setDropPositionRowId(null);
        setDropPosition('top');
        
        // Показываем тултип для задач и ресурсов
        if (r.kind === "task") {
            setDragTooltip({
                visible: true,
                x: e.clientX + 10,
                y: e.clientY - 10,
                task: r as TaskRow,
                resource: null
            });
        } else if (r.kind === "resource") {
            setDragTooltip({
                visible: true,
                x: e.clientX + 10,
                y: e.clientY - 10,
                task: null,
                resource: r as ResourceRow
            });
        }
        
        // Добавляем обработчики для отслеживания движения мыши
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            
            
            // Обновляем состояние клавиши Shift
            isShiftPressedRef.current = e.shiftKey;
            
            // Обновляем позицию тултипа
            setDragTooltip(prev => ({
                ...prev,
                x: e.clientX + 10,
                y: e.clientY - 10
            }));
            
            // Подсвечиваем строку под курсором при нажатом Shift (для блокеров)
            if (e.shiftKey) {
                const draggedRow = dragRowRef.current;
                
                // Если это задача - показываем красные рамки для блокеров
                if (draggedRow && draggedRow.kind === 'task') {
                    // Сначала очищаем dropPositionRowId, чтобы избежать двойных рамок
                    setDropPositionRowId(null);
                    setDropPosition('top');
                    
                    const element = document.elementFromPoint(e.clientX, e.clientY);
                    const targetRow = element?.closest('tr[data-row-id]');
                    if (targetRow) {
                        const targetRowId = targetRow.getAttribute('data-row-id');
                        if (targetRowId) {
                            // Проверяем, что перетаскиваемая строка и целевая строка одного типа
                            const targetRowData = rows.find(r => r.id === targetRowId);
                            
                            if (targetRowData && draggedRow.kind === targetRowData.kind) {
                                setHighlightedRowId(targetRowId);
                            } else {
                                setHighlightedRowId(null);
                            }
                        } else {
                            setHighlightedRowId(null);
                        }
                    } else {
                        setHighlightedRowId(null);
                    }
                } else {
                    // Если это ресурс - показываем обычные серые рамки (как без Shift)
                    setHighlightedRowId(null); // Очищаем подсветку блокеров
                    setDropPosition('top');
                    
                    const element = document.elementFromPoint(e.clientX, e.clientY);
                    const targetRow = element?.closest('tr[data-row-id]') || (e.target as HTMLElement)?.closest('tr[data-row-id]');
                    
                    if (targetRow) {
                        const targetRowId = targetRow.getAttribute('data-row-id');
                        if (targetRowId && targetRowId !== dragRowRef.current?.id) {
                            // Проверяем, что перетаскиваемая строка и целевая строка одного типа
                            const targetRowData = rows.find(r => r.id === targetRowId);
                            
                            if (draggedRow && targetRowData && draggedRow.kind === targetRowData.kind) {
                                // Определяем позицию рамки в зависимости от направления перетаскивания
                                const draggedRowData = rows.find(r => r.id === draggedRow.id);
                                if (draggedRowData && targetRowData) {
                                    const draggedIndex = rows.findIndex(r => r.id === draggedRow.id);
                                    const targetIndex = rows.findIndex(r => r.id === targetRowId);
                                    
                                    // Если перетаскиваем вверх, показываем верхнюю рамку целевой строки
                                    // Если перетаскиваем вниз, показываем нижнюю рамку целевой строки
                                    if (draggedIndex < targetIndex) {
                                        // Перетаскиваем вниз - нижняя рамка целевой строки
                                        setDropPosition('bottom');
                                        setDropPositionRowId(targetRowId);
                                    } else {
                                        // Перетаскиваем вверх - верхняя рамка целевой строки
                                        setDropPosition('top');
                                        setDropPositionRowId(targetRowId);
                                    }
                                } else {
                                    setDropPositionRowId(targetRowId);
                                }
                            } else {
                                setDropPositionRowId(null);
                            }
                        } else {
                            setDropPositionRowId(null);
                        }
                    } else {
                        setDropPositionRowId(null);
                    }
                }
            } else {
                // Обычное перетаскивание - показываем позицию вставки
                setHighlightedRowId(null); // Очищаем подсветку блокеров
                setDropPosition('top');
                
                // Попробуем использовать e.target и document.elementFromPoint
                const element = document.elementFromPoint(e.clientX, e.clientY);
                const targetRow = element?.closest('tr[data-row-id]') || (e.target as HTMLElement)?.closest('tr[data-row-id]');
                
                if (targetRow) {
                    const targetRowId = targetRow.getAttribute('data-row-id');
                    if (targetRowId && targetRowId !== dragRowRef.current?.id) {
                        // Проверяем, что перетаскиваемая строка и целевая строка одного типа
                        const draggedRow = dragRowRef.current;
                        const targetRowData = rows.find(r => r.id === targetRowId);
                        
                        if (draggedRow && targetRowData && draggedRow.kind === targetRowData.kind) {
                            // Определяем позицию рамки в зависимости от направления перетаскивания
                            const draggedRowData = rows.find(r => r.id === draggedRow.id);
                            if (draggedRowData && targetRowData) {
                                const draggedIndex = rows.findIndex(r => r.id === draggedRow.id);
                                const targetIndex = rows.findIndex(r => r.id === targetRowId);
                                
                                // Если перетаскиваем вверх, показываем верхнюю рамку целевой строки
                                // Если перетаскиваем вниз, показываем нижнюю рамку целевой строки
                                if (draggedIndex < targetIndex) {
                                    // Перетаскиваем вниз - нижняя рамка целевой строки
                                    setDropPosition('bottom');
                                    setDropPositionRowId(targetRowId);
                                } else {
                                    // Перетаскиваем вверх - верхняя рамка целевой строки
                                    setDropPosition('top');
                                    setDropPositionRowId(targetRowId);
                                }
                            } else {
                                setDropPositionRowId(targetRowId);
                            }
                        } else {
                            setDropPositionRowId(null);
                        }
                    } else {
                        setDropPositionRowId(null);
                    }
                } else {
                    setDropPositionRowId(null);
                }
            }
        };
        
        const handleMouseUp = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            
            // Сохраняем данные о перетаскиваемой строке до очистки состояния
            const draggedRow = dragRowRef.current;
            const isShiftPressed = isShiftPressedRef.current;
            
            // Находим элемент под курсором
            const element = document.elementFromPoint(e.clientX, e.clientY);
            const targetRow = element?.closest('tr');
            
            if (targetRow && draggedRow) {
                const targetRowId = targetRow.getAttribute('data-row-id');
                if (targetRowId) {
                    const targetRowData = computedRows.find(row => row.id === targetRowId);
                    if (targetRowData && targetRowData.kind === draggedRow.kind) {
                        // Выполняем операцию перестановки или назначения блокера
                        if (isShiftPressed && draggedRow.kind === "task" && targetRowData.kind === "task") {
                            // Назначение блокера
                            if (canSetBlocker(draggedRow.id, targetRowData.id)) {
                                setRows(prev => prev.map(row => 
                                    (row.kind === "task" && row.id === draggedRow.id) 
                                        ? { ...row, blockerIds: Array.from(new Set([...(row as TaskRow).blockerIds, targetRowData.id])) } 
                                        : row
                                ));
                            } else {
                                alert("Нельзя создать блокер: обнаружен цикл или неверный порядок (нельзя блокироваться на задачу ниже текущей).");
                            }
                        } else {
                            // Перестановка строк
                            setRows(prev => {
                                const list = prev.slice();
                                const from = list.findIndex(x => x.id === draggedRow.id);
                                const to = list.findIndex(x => x.id === targetRowData.id);
                                if (from<0 || to<0 || from===to) return prev;
                                const [m] = list.splice(from, 1);
                                list.splice(to, 0, m);
                                return list;
                            });
                        }
                    }
                }
            }
            
            // Очищаем состояние
            setDragTooltip({ visible: false, x: 0, y: 0, task: null, resource: null });
            setHighlightedRowId(null);
            setDropPositionRowId(null);
            setDropPosition('top');
            dragRowRef.current = null;
            isDraggingRef.current = false;
            clearDragAllowed();
            
            // Удаляем обработчики
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        // Добавляем обработчики
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    

    // ====== Блокеры Shift-drag + валидация ======
    const shiftDragTaskRef = useRef<ID | null>(null);
    const isShiftPressedRef = useRef<boolean>(false);
    
    function onTaskMouseDown(e: React.MouseEvent, t: TaskRow) {
        shiftDragTaskRef.current = t.id;
        isShiftPressedRef.current = e.shiftKey;
    }
    
    function onTaskMouseUp(_e: React.MouseEvent, t: TaskRow) {
        const src = shiftDragTaskRef.current;
        shiftDragTaskRef.current = null;
        if (!src || src === t.id) return;
        // Эта логика теперь обрабатывается в onDropRow
        return;
    }
    function canSetBlocker(srcTaskId: ID, blockerTaskId: ID): boolean {
        const idxMap = new Map(rows.map((r, i) => [r.id, i] as const));
        const srcIdx = idxMap.get(srcTaskId) ?? 0; const blockIdx = idxMap.get(blockerTaskId) ?? 0;
        if (blockIdx > srcIdx) return false; // запрет блокироваться на нижнюю
        // цикл
        const graph = new Map<ID, ID[]>(); rows.forEach(r => { if (r.kind === "task") graph.set(r.id, (r as TaskRow).blockerIds.slice()); });
        graph.set(srcTaskId, [ ...(graph.get(srcTaskId) || []), blockerTaskId ]);
        const seen = new Set<ID>();
        function dfs(v: ID): boolean { if (v === srcTaskId) return true; if (seen.has(v)) return false; seen.add(v); for (const u of (graph.get(v) || [])) if (dfs(u)) return true; return false; }
        return !dfs(blockerTaskId);
    }
    function removeBlocker(taskId: ID, blockerId: ID) { setRows(prev => prev.map(r => (r.kind === "task" && r.id === taskId) ? { ...r, blockerIds: (r as TaskRow).blockerIds.filter(x => x !== blockerId) } : r)); }
    
    // Функция для удаления блокера через стрелку
    function handleRemoveBlocker(blockerId: string, blockedTaskId: string) {
        removeBlocker(blockedTaskId, blockerId);
    }

    // ====== Фильтры ======
    type ColumnId = "type"|"status"|"sprintsAuto"|"epic"|"task"|"team"|"fn"|"empl"|"planEmpl"|"planWeeks"|"fact"|"start"|"end"|"autoplan";
    type FilterState = { [K in ColumnId]?: { search: string; selected: Set<string> } };
    const [filters, setFilters] = useState<FilterState>({});
    const [filterUi, setFilterUi] = useState<{ col: ColumnId; x:number; y:number } | null>(null);
    function openFilter(col: ColumnId, x:number, y:number) { setFilterUi({ col, x, y }); if (!filters[col]) setFilters(f => ({ ...f, [col]: { search: "", selected: new Set<string>() } })); }
    function toggleFilterValue(col: ColumnId, val: string) { setFilters(f => { const s = new Set(f[col]?.selected || []); if (s.has(val)) s.delete(val); else s.add(val); return { ...f, [col]: { search: f[col]?.search || "", selected: s } }; }); }
    function setFilterSearch(col: ColumnId, v:string) { setFilters(f => ({ ...f, [col]: { search: v, selected: f[col]?.selected || new Set<string>() } })); }
    function clearFilter(col: ColumnId) { setFilters(f => { const nf: FilterState = { ...f }; delete nf[col]; return nf; }); setFilterUi(null); }
    function valueForCol(r: Row, col: ColumnId): string {
        const t = r as TaskRow;
        switch(col){
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
    const filteredRows = useMemo(() => computedRows.filter(r => {
        for (const col of Object.keys(filters) as ColumnId[]) {
            const f = filters[col]!; const val = valueForCol(r, col); if (!f) continue;
            const tokens = Array.from(f.selected || []); if (tokens.length === 0) continue;
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
        } return true;
    }), [computedRows, filters]);

    const links = useMemo(() => {
        const tasks = filteredRows.filter(r => r.kind === "task") as TaskRow[];
        return buildLinks(tasks);
    }, [filteredRows]);

    // ====== Колоночные ширины и синхронизация горизонтального скролла ======
    const COL_WIDTH: Partial<Record<ColumnId, string>> = {
        type: '6rem',
        status: '32rem', // Объединенная ширина для Status/Sprints/Epic/Task
        sprintsAuto: '10rem',
        epic: '8rem',
        task: '14rem',
        team: '10rem',
        fn: '6rem',
        empl: '8rem',
        planEmpl: '24rem', // Объединенная ширина для Plan empl/Plan weeks/Auto
        planWeeks: '8rem',
        autoplan: '6rem',
    };

    const headerWeeksRef = useRef<HTMLDivElement | null>(null);
    const resWeeksRefs = useRef<Map<ID, HTMLDivElement>>(new Map());
    const taskWeeksRefs = useRef<Map<ID, HTMLDivElement>>(new Map());
    const isSyncingRef = useRef<boolean>(false);

    // setResourceWeeksRef removed - no longer needed with td elements
    // setTaskWeeksRef removed - no longer needed with td elements

    function syncScrollFromHeader(left: number) {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        try {
            // синхронизируем все контейнеры недель
            resWeeksRefs.current.forEach(el => { if (el) el.scrollLeft = left; });
            taskWeeksRefs.current.forEach(el => { if (el) el.scrollLeft = left; });
        } finally {
            isSyncingRef.current = false;
        }
    }
    // onHeaderWeeksScroll removed - no longer needed with td elements

    useEffect(() => {
        // первичная синхронизация
        const left = headerWeeksRef.current?.scrollLeft ?? 0;
        syncScrollFromHeader(left);
    }, []);

    function renderColGroup() {
        const order: ColumnId[] = ["type","status","sprintsAuto","epic","task","team","fn","empl","planEmpl","planWeeks","autoplan"];
        const cols = order.map((c) => (<col key={c} style={{ width: COL_WIDTH[c] || "8rem" }} />));
        return (<colgroup children={[...cols, <col key="timeline" />]} />);
    }

    // ====== Автоплан: чекбокс + подтверждение ======
    function toggleAutoPlan(taskId: ID, next: boolean) {
        const t = computedRows.find(r => r.kind === "task" && r.id === taskId) as TaskRow | undefined;
        if (!t) return;

        if (next && t.manualEdited && t.weeks.some(v => v > 0)) {
            const ok = confirm("Включить автоплан? Текущий ручной план будет перезаписан.");
            if (!ok) return; // отмена

            setRows(prev => prev.map(r =>
                (r.kind === "task" && r.id === taskId)
                    ? { ...(r as TaskRow), autoPlanEnabled: true, manualEdited: false, weeks: Array(TOTAL_WEEKS).fill(0) }
                    : r
            ));
        } else {
            setRows(prev => prev.map(r =>
                (r.kind === "task" && r.id === taskId)
                    ? { ...(r as TaskRow), autoPlanEnabled: next }
                    : r
            ));
        }
    }

    // ====== Редактор недель ======
    // ====== Помощники для недельного редактирования ======
function getComputedTaskByIdLocal(id: ID): TaskRow | undefined {
    return computedRows.find(r => r.kind === "task" && r.id === id) as TaskRow | undefined;
}
function weeksBaseForTaskLocal(t: TaskRow): number[] {
    if (t.autoPlanEnabled) {
        const ct = getComputedTaskByIdLocal(t.id);
        if (ct) return ct.weeks.slice();
    }
    return t.weeks.slice();
}

// Функция для сравнения массивов недель - проверяет, изменилось ли значение
function weeksArraysEqual(weeks1: number[], weeks2: number[]): boolean {
    if (weeks1.length !== weeks2.length) return false;
    return weeks1.every((val, index) => Math.abs(val - weeks2[index]) < 0.001);
}
    const paintRef = useRef<{ active:boolean; rowId:ID; originW:number; value:number; started:boolean } | null>(null);
    function onWeekCellMouseDown(_e: React.MouseEvent, r: Row, w: number) {
        // Одинарный клик только выделяет
        setSel({ rowId: r.id, col: { week: w } });

        // Готовим «мазок» со значением исходной ячейки
        if (r.kind === "task") {
            const t = r as TaskRow;
            const current = t.weeks[w] || 0; // используем прямое значение как для ресурсов
            paintRef.current = { active: true, rowId: t.id, originW: w, value: current, started: false };
        } else {
            const rr = r as ResourceRow;
            const current = rr.weeks[w] || 0;
            paintRef.current = { active: true, rowId: rr.id, originW: w, value: current, started: false };
        }
    }
    function onWeekCellMouseEnter(_e: React.MouseEvent, r: Row, w: number) {
        const p = paintRef.current;
        if (!p || !p.active || r.id !== p.rowId) return;

        if (r.kind === "task") {
            const t = r as TaskRow;
            const base = t.weeks.slice(); // используем прямую копию weeks как для ресурсов
            const originalWeeks = t.weeks.slice();
            
            if (!p.started && w !== p.originW) {
                p.started = true;
                base[p.originW] = p.value; // включаем исходную ячейку в мазок
            }
            base[w] = p.value;
            
            // Проверяем, изменилось ли значение
            const hasChanged = !weeksArraysEqual(base, originalWeeks);
            
            setRows(prev => prev.map(x =>
                (x.kind === "task" && x.id === t.id)
                    ? { 
                        ...(x as TaskRow), 
                        weeks: base,
                        // Устанавливаем флаги только если значение изменилось
                        ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                    }
                    : x
            ));
        } else {
            const rr = r as ResourceRow;
            const base = rr.weeks.slice();
            if (!p.started && w !== p.originW) {
                p.started = true;
                base[p.originW] = p.value;
            }
            base[w] = p.value;
            setRows(prev => prev.map(x =>
                (x.kind === "resource" && x.id === rr.id)
                    ? { ...(x as ResourceRow), weeks: base }
                    : x
            ));
        }
    }
    useEffect(() => { const up = () => { if (paintRef.current) paintRef.current.active = false; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);
    function onWeekCellDoubleClick(_e: React.MouseEvent, r: Row, w:number) {
        // Включаем inline-редактирование для выбранной недельной ячейки
        setSel({ rowId: r.id, col: { week: w } });
        startEdit({ rowId: r.id, col: { week: w } });
    }

    // ====== Раскраска ресурсов (перегруз/недогруз) ======
    function resourceCellBg(rr: ResourceRow, weekIdx0: number): string {
        const cap = rr.weeks[weekIdx0] || 0;
        const used = (computed.resLoad[rr.id]?.[weekIdx0] ?? 0);
        if (used > cap) return "#fee2e2"; // перегруз — красный
        if (cap > 0 && used < cap) return "#dcfce7"; // недогруз — зелёный
        return "transparent";
    }

    // ===== Цвета Team+Fn =====
    function teamKeyFromResource(rr: ResourceRow): string {
        const teams = Array.isArray(rr.team) ? rr.team.slice().sort().join('+') : '';
        return `${teams}|${rr.fn || ''}`;
    }
    function teamKeyFromTask(t: TaskRow): string {
        const team = (t.team || '').trim();
        return `${team}|${t.fn || ''}`;
    }
    function getTeamFnColorForResource(rr: ResourceRow): string {
        return getBg(teamFnColors[teamKeyFromResource(rr)]);
    }
    function getTeamFnColorForTask(t: TaskRow): string {
        return getBg(teamFnColors[teamKeyFromTask(t)]);
    }
    function cellBgForTask(t: TaskRow): string {
        return getBg(teamFnColors[teamKeyFromTask(t)]) || DEFAULT_BG;
    }

    // ====== Обновления полей ======
    function updateTask<K extends keyof TaskRow>(id: ID, patch: Pick<TaskRow, K>) { setRows(prev => prev.map(r => (r.kind === "task" && r.id === id) ? { ...r, ...patch } : r)); }
    function updateResource<K extends keyof ResourceRow>(id: ID, patch: Pick<ResourceRow, K>) { setRows(prev => prev.map(r => (r.kind === "resource" && r.id === id) ? { ...r, ...patch } : r)); }

    function splitRows(list: Row[]) { const resources = list.filter(r => r.kind === "resource"); const tasks = list.filter(r => r.kind === "task"); return { resources, tasks }; }
    function newResource(): ResourceRow {
        return { id: rid(), kind: "resource", team: [], fn: "" as Fn, weeks: Array(TOTAL_WEEKS).fill(0) };
    }
    function newTask(): TaskRow {
        return {
            id: rid(),
            kind: "task",
            status: "Todo",
            sprintsAuto: [],
            epic: "",
            task: "",
            team: "",
            fn: "" as Fn,
            planEmpl: 0,
            planWeeks: 0,
            blockerIds: [],
            fact: 0,
            startWeek: null,
            endWeek: null,
            manualEdited: false,
            autoPlanEnabled: true,
            weeks: Array(TOTAL_WEEKS).fill(0)
        };
    }
    function rid() { return Math.random().toString(36).slice(2); }

    // ====== Локальное состояние меню добавления ======
    const [addMenuOpen, setAddMenuOpen] = useState<boolean>(false);
    
    function addResourceBottom() { setRows(prev => { const split = splitRows(prev); return [...split.resources, newResource(), ...split.tasks]; }); setAddMenuOpen(false); }
    function addTaskBottom() { setRows(prev => { const split = splitRows(prev); return [...split.resources, ...split.tasks, newTask()]; }); setAddMenuOpen(false); }

    // ===== Контекстные действия над строками (реализация) =====
    function duplicateRow(rowId: ID) {
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const row = prev[idx];
            const copy: Row = row.kind === 'task'
                ? { ...(row as TaskRow), id: rid(), blockerIds: [...(row as TaskRow).blockerIds] }
        : { ...(row as ResourceRow), id: rid(), weeks: [...(row as ResourceRow).weeks] };
            const next = prev.slice();
            next.splice(idx + 1, 0, copy);
            return next;
        });
        setCtx(null);
    }
    function deleteRow(rowId: ID) {
        setRows(prev => prev.filter(r => r.id !== rowId));
        setCtx(null);
    }
    function addRowAbove(rowId: ID) {
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const row = prev[idx];
            const insert = row.kind === 'task' ? newTask() : newResource();
            const next = prev.slice();
            next.splice(idx, 0, insert);
            return next;
        });
        setCtx(null);
    }
    function addRowBelow(rowId: ID) {
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const row = prev[idx];
            const insert = row.kind === 'task' ? newTask() : newResource();
            const next = prev.slice();
            next.splice(idx + 1, 0, insert);
            return next;
        });
        setCtx(null);
    }

    // ====== UI ======
    return (
        <div className="p-4 space-y-4 h-screen flex flex-col">
            <div className="flex gap-2">
                <button className={`px-3 py-1 rounded ${tab==='plan'? 'bg-black text-white':'border'}`} onClick={()=>setTab('plan')}>План</button>
                <button className={`px-3 py-1 rounded ${tab==='sprints'? 'bg-black text-white':'border'}`} onClick={()=>setTab('sprints')}>Спринты</button>
                <button className={`px-3 py-1 rounded ${tab==='teams'? 'bg-black text-white':'border'}`} onClick={()=>setTab('teams')}>Команды</button>
            </div>
    
            {tab === 'plan' ? (
                <>
                <div ref={tableContainerRef} className="flex-grow border rounded-xl overflow-auto" style={{ position: "relative" }}>
                    <table className="min-w-full text-sm select-none table-fixed border-collapse" style={{ border: '1px solid rgb(226, 232, 240)' }}>
                        {renderColGroup()}
                        <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(249, 250, 251)' }}>
                        <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                            {renderHeadWithFilter("Тип", "type")}
                            {renderHeadWithFilter("Status", "status")}
                            {renderHeadWithFilter("Sprints", "sprintsAuto")}
                            {renderHeadWithFilter("Epic", "epic")}
                            {renderHeadWithFilter("Task", "task")}
                            {renderHeadWithFilter("Team", "team")}
                            {renderHeadWithFilter("Fn", "fn")}
                            {renderHeadWithFilter("Empl", "empl")}
                            {renderHeadWithFilter("Plan empl", "planEmpl")}
                            {renderHeadWithFilter("Plan weeks", "planWeeks")}
                            {renderHeadWithFilter("Auto", "autoplan")}
                            {/* Заголовки для недель */}
                            {range(TOTAL_WEEKS).map(w => { const h = weekHeaderLabelLocal(w); return (
                                <th key={w} className="px-2 py-2 text-center whitespace-nowrap align-middle" style={{width: '3.5rem', border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>
                                    <div className="text-xs font-semibold">#{h.num}</div>
                                    <div className="text-[10px] text-gray-500">{h.sprint || ""}</div>
                                    <div className="text-[10px] text-gray-400">с {h.from}</div>
                                </th>
                            ); })}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {/* Ресурсы */}
                        {filteredRows.filter(r => r.kind === "resource").map(r => (
                            <tr key={r.id}
                                className={"border-b bg-gray-50"}
                                data-row-id={r.id}
                                onMouseDown={(e)=>onMouseDownRow(e,r)}
                                onContextMenu={(e)=>onContextMenuRow(e,r)}
                            >
                                {/* Тип */}
                                <td className={`px-2 py-1 align-middle bg-gray-50 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'type')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed}>Ресурс</td>

                                {/* Объединенная ячейка для Status/Sprints/Epic/Task (не используется для ресурсов) */}
                                <td className={`px-2 py-1 align-middle bg-gray-50 text-center text-gray-400 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'status')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed}
                                    colSpan={4}
                                >—</td>

                                {/* Team */}
                                <td className={`px-2 py-1 align-middle bg-gray-50 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'team')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>{
                                    console.log('Resource team cell double clicked, starting edit');
                                    startEdit({rowId:r.id,col:"team"});
                                }} onClick={()=>{
                                    console.log('Resource team cell clicked, setting selection');
                                    setSel({rowId:r.id,col:"team"});
                                }}>
                                    {editing?.rowId===r.id && editing?.col==="team" ? (
                                        <div className="w-full h-full">
                                            <TeamMultiSelect
                                                teams={teamNames}
                                                selectedTeams={(r as ResourceRow).team}
                                                onSelect={(selected) => {
                                                    updateResource(r.id, { team: selected });
                                                    stopEdit();
                                                }}
                                                onSaveValue={(selected) => {
                                                    updateResource(r.id, { team: selected });
                                                }}
                                                onTabNext={() => focusNextRight(r.id, 'team')}
                                                onTabPrev={() => focusPrevLeft(r.id, 'team')}
                                                onEscape={() => stopEdit()}
                                            />
                                        </div>
                                    ) : (<span>{(r as ResourceRow).team.join(', ')}</span>)}
                                </td>

                                {/* Fn */}
                                <td className={`px-2 py-1 align-middle text-center draggable-cell`} style={{ backgroundColor: getBg(teamFnColors[teamKeyFromResource(r as ResourceRow)]), color: getText(teamFnColors[teamKeyFromResource(r as ResourceRow)]), ...getCellBorderStyle(isSel(r.id,'fn')), ...getCellBorderStyleForDrag(r.id) }} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"fn"})} onClick={()=>setSel({rowId:r.id,col:"fn"})} onContextMenu={(e)=>onContextMenuCellColor(e, r as ResourceRow, 'fn', 'resource')}>
                                    {editing?.rowId===r.id && editing?.col==="fn" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={r.fn}
                                               onKeyDown={(e)=>{
                                                    if(e.key==='Enter'){ updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); commitEdit(); }
                                                    if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('prev', r.id, 'fn'); return; }
                                                    if(e.key==='Tab'){ e.preventDefault(); updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('next', r.id, 'fn'); }
                                                    if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                               }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); } stopEdit(); }} />
                                    ) : (<span>{r.fn}</span>)}
                                </td>

                                {/* Empl */}
                                <td className={`px-2 py-1 align-middle bg-gray-50 text-center draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'empl')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"empl"})} onClick={()=>setSel({rowId:r.id,col:"empl"})}>
                                    {editing?.rowId===r.id && editing?.col==="empl" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as ResourceRow).empl || ""}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('prev', r.id, 'empl'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('next', r.id, 'empl'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                               }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); } stopEdit(); }} />
                                    ) : (<span>{(r as ResourceRow).empl || ''}</span>)}
                                </td>

                                {/* Объединенная ячейка для Plan empl/Plan weeks/Auto (не используется для ресурсов) */}
                                <td className={`px-2 py-1 align-middle bg-gray-50 text-center text-gray-400 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planEmpl')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed}
                                    colSpan={3}
                                >—</td>

                                {/* Таймлайн недель ресурса */}
                                {range(TOTAL_WEEKS).map(w => (
                                    <td key={w} className={`px-0 py-0 align-middle week-cell`} style={{width: '3.5rem', background: resourceCellBg(r as ResourceRow, w), ...getCellBorderStyle(isSelWeek(r.id,w)), ...getCellBorderStyleForDrag(r.id)}}>
                                        <div
                                            onMouseDown={(e)=>onWeekCellMouseDown(e,r,w)}
                                            onMouseEnter={(e)=>onWeekCellMouseEnter(e,r,w)}
                                            onDoubleClick={(e)=>onWeekCellDoubleClick(e,r,w)}
                                            onClick={()=>setSel({rowId:r.id,col:{week:w}})}
                                            className="w-full h-8 text-sm flex items-center justify-center cursor-pointer select-none"
                                            title={`Неделя #${w+1}`}
                                        >
                                            {editing?.rowId===r.id && typeof editing.col==='object' && editing.col.week===w ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    className="w-full h-full box-border text-center outline-none bg-transparent"
                                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                                    defaultValue={(r as ResourceRow).weeks[w] ? String((r as ResourceRow).weeks[w]) : ""}
                                                    onKeyDown={(e)=>{
                                                        if(e.key==='Enter'){
                                                            const val = clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,99);
                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: (x as ResourceRow).weeks.map((vv,i)=> i===w? val: vv)}
                                                                    : x
                                                            ));
                                                            commitEdit();
                                                        }
                                                        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitEdit(); if (sel) focusPrevLeft(sel.rowId, sel.col); return; }
                                                        if(e.key==='Tab'){
                                                            e.preventDefault();
                                                            const val = clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,99);
                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: (x as ResourceRow).weeks.map((vv,i)=> i===w? val: vv)}
                                                                    : x
                                                            ));
                                                            focusNextRight(r.id, {week:w});
                                                        }
                                                        if(e.key==='Escape'){
                                                            cancelEditRef.current=true;
                                                            stopEdit();
                                                        }
                                                    }}
                                                    onBlur={(e)=>{
                                                        if(!cancelEditRef.current){
                                                            const val = clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,99);
                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: (x as ResourceRow).weeks.map((vv,i)=> i===w? val: vv)}
                                                                    : x
                                                            ));
                                                        }
                                                        stopEdit();
                                                    }}
                                                />
                                            ) : (
                                                <span>{(r as ResourceRow).weeks[w] || 0}</span>
                                            )}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}

                        {/* Задачи */}
                        {filteredRows.filter(r => r.kind === "task").map(r => (
                            <tr key={r.id}
                                className="border-b bg-white"
                                data-row-id={r.id}
                                onMouseDown={(e)=>{ 
                                    if (r.kind==='task') onTaskMouseDown(e, r as TaskRow); 
                                    onMouseDownRow(e, r);
                                }}
                                onMouseUp={(e)=>{ if (r.kind==='task') onTaskMouseUp(e, r as TaskRow); clearDragAllowed(); }}
                                onContextMenu={(e)=>onContextMenuRow(e,r)}
                            >
                                {/* Тип */}
                                <td className={`px-2 py-1 align-middle bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'type')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed}>Задача</td>

                                {/* Status */}
                                <td className={`px-2 py-1 align-middle text-center bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'status')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"status"})} onClick={()=>setSel({rowId:r.id,col:"status"})}>
                                    {editing?.rowId===r.id && editing?.col==="status" ? (
                                        <div className="w-full h-full">
                                            <Select
                                                options={["Todo", "Backlog", "Cancelled"]}
                                                selectedValue={(r as TaskRow).status}
                                                onSelect={(selected) => {
                                                    updateTask(r.id, { status: selected as Status });
                                                    stopEdit();
                                                }}
                                                onSaveValue={(selected) => {
                                                    updateTask(r.id, { status: selected as Status });
                                                }}
                                                onTabNext={() => navigateInEditMode('next', r.id, 'status')}
                                                onTabPrev={() => navigateInEditMode('prev', r.id, 'status')}
                                                onEscape={() => stopEdit()}
                                                placeholder="Выберите статус..."
                                                searchPlaceholder="Поиск статусов..."
                                            />
                                        </div>
                                    ) : (<span>{(r as TaskRow).status || ""}</span>)}
                               </td>

                                {/* Sprints readonly */}
                                <td className={`px-2 py-1 align-middle bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'sprintsAuto')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed}>{(r as TaskRow).sprintsAuto.join(", ")||""}</td>

                                {/* Epic */}
                                <td className={`px-2 py-1 align-middle bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'epic')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"epic"})} onClick={()=>setSel({rowId:r.id,col:"epic"})}>
                                    {editing?.rowId===r.id && editing?.col==="epic" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).epic||""}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); navigateInEditMode('prev', r.id, 'epic'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); navigateInEditMode('next', r.id, 'epic'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).epic||""}</span>)}
                                </td>

                                {/* Task */}
                                <td className={`px-2 py-1 align-middle bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'task')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"task"})} onClick={()=>setSel({rowId:r.id,col:"task"})}>
                                    {editing?.rowId===r.id && editing?.col==="task" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).task}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{task:(e.target as HTMLInputElement).value}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{task:(e.target as HTMLInputElement).value}); navigateInEditMode('prev', r.id, 'task'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{task:(e.target as HTMLInputElement).value}); navigateInEditMode('next', r.id, 'task'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{task:(e.target as HTMLInputElement).value}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).task}</span>)}
                                </td>

                                {/* Team */}
                                <td className={`px-2 py-1 align-middle bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'team')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>{
                                    console.log('Task team cell double clicked, starting edit');
                                    startEdit({rowId:r.id,col:"team"});
                                }} onClick={()=>{
                                    console.log('Task team cell clicked, setting selection');
                                    setSel({rowId:r.id,col:"team"});
                                }}>
                                    {editing?.rowId===r.id && editing?.col==="team" ? (
                                        <div className="w-full h-full">
                                            <Select
                                                options={teamNames}
                                                selectedValue={r.team}
                                                onSelect={(selected) => {
                                                    updateTask(r.id, { team: selected });
                                                    stopEdit();
                                                }}
                                                onSaveValue={(selected) => {
                                                    updateTask(r.id, { team: selected });
                                                }}
                                                onTabNext={() => focusNextRight(r.id, 'team')}
                                                onTabPrev={() => focusPrevLeft(r.id, 'team')}
                                                onEscape={() => stopEdit()}
                                                placeholder="Выберите команду..."
                                                searchPlaceholder="Поиск команд..."
                                            />
                                        </div>
                                    ) : (<span>{r.team}</span>)}
                                </td>

                                {/* Fn */}
                                <td className={`px-2 py-1 align-middle text-center draggable-cell`} style={{ backgroundColor: getBg(teamFnColors[teamKeyFromTask(r as TaskRow)]), color: getText(teamFnColors[teamKeyFromTask(r as TaskRow)]), ...getCellBorderStyle(isSel(r.id,'fn')), ...getCellBorderStyleForDrag(r.id) }} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"fn"})} onClick={()=>setSel({rowId:r.id,col:"fn"})} onContextMenu={(e)=>onContextMenuCellColor(e, r as TaskRow, 'fn', 'task')}>
                                    {editing?.rowId===r.id && editing?.col==="fn" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={r.fn}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('prev', r.id, 'fn'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('next', r.id, 'fn'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); } stopEdit(); }} />
                                    ) : (<span>{r.fn}</span>)}
                                </td>

                                {/* Empl */}
                                <td className={`px-2 py-1 align-middle text-center bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'empl')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"empl"})} onClick={()=>setSel({rowId:r.id,col:"empl"})}>
                                    {editing?.rowId===r.id && editing?.col==="empl" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).empl || ""}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('prev', r.id, 'empl'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('next', r.id, 'empl'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).empl || ''}</span>)}
                                </td>

                                {/* Plan empl */}
                                <td className={`px-2 py-1 align-middle text-center bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planEmpl')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"planEmpl"})} onClick={()=>setSel({rowId:r.id,col:"planEmpl"})}>
                                    {editing?.rowId===r.id && editing?.col==="planEmpl" ? (
                                        <input autoFocus type="number" className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).planEmpl}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{planEmpl: clamp(parseFloat((e.target as HTMLInputElement).value||"0"),0,99)}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{planEmpl: clamp(parseFloat((e.target as HTMLInputElement).value||"0"),0,99)}); navigateInEditMode('prev', r.id, 'planEmpl'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{planEmpl: clamp(parseFloat((e.target as HTMLInputElement).value||"0"),0,99)}); navigateInEditMode('next', r.id, 'planEmpl'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{planEmpl: clamp(parseFloat((e.target as HTMLInputElement).value||"0"),0,99)}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).planEmpl}</span>)}
                                </td>

                                {/* Plan weeks */}
                                <td className={`px-2 py-1 align-middle text-center bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planWeeks')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"planWeeks"})} onClick={()=>setSel({rowId:r.id,col:"planWeeks"})}>
                                    {editing?.rowId===r.id && editing?.col==="planWeeks" ? (
                                        <input autoFocus type="number" className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).planWeeks}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,TOTAL_WEEKS)}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,TOTAL_WEEKS)}); navigateInEditMode('prev', r.id, 'planWeeks'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,TOTAL_WEEKS)}); navigateInEditMode('next', r.id, 'planWeeks'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,TOTAL_WEEKS)}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).planWeeks}</span>)}
                                </td>

                    {/* Автоплан чекбокс */}
                    <td className={`px-2 py-1 align-middle text-center bg-white ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'autoplan')), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={markDragAllowed} onClick={()=>setSel({rowId:r.id,col:"autoplan"})}>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={(r as TaskRow).autoPlanEnabled} onChange={e=>toggleAutoPlan(r.id, e.currentTarget.checked)} 
                                   onKeyDown={(e)=>{
                                       if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); navigateInEditMode('prev', r.id, 'autoplan'); return; }
                                       if(e.key==='Tab'){ e.preventDefault(); navigateInEditMode('next', r.id, 'autoplan'); }
                                   }} />
                        </label>
                    </td>

                    {/* Таймлайн с горизонтальным скроллом */}
                    {range(TOTAL_WEEKS).map(w => (
                        <td key={w} id={cellId(r.id, w)} className={`px-0 py-0 align-middle ${getCellBorderClass(r.id)} week-cell`} style={{width: '3.5rem', background: ((r as TaskRow).weeks[w] || 0) > 0 ? cellBgForTask(r as TaskRow) : undefined, color: ((r as TaskRow).weeks[w] || 0) > 0 ? getText(teamFnColors[teamKeyFromTask(r as TaskRow)]) : undefined, ...getCellBorderStyle(isSelWeek(r.id,w)), ...getCellBorderStyleForDrag(r.id)}} onMouseDown={(e)=>onWeekCellMouseDown(e,r,w)} onMouseEnter={(e)=>onWeekCellMouseEnter(e,r,w)} onDoubleClick={(e)=>onWeekCellDoubleClick(e,r,w)}>
                            {editing?.rowId===r.id && typeof editing.col==='object' && editing.col.week===w ? (
                                <input
                                    autoFocus
                                    type="number"
                                    className="w-full h-full text-sm text-center box-border outline-none bg-transparent"
                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                    defaultValue={((r as TaskRow).weeks[w] || 0) === 0 ? "" : String((r as TaskRow).weeks[w])}
                                    onKeyDown={(e)=>{
                                        if(e.key==='Enter'){
                                            const raw = (e.target as HTMLInputElement).value;
                                            const val = Math.max(0, parseFloat(raw||"0"));
                                            const base = weeksBaseForTaskLocal(r as TaskRow);
                                            const originalWeeks = (r as TaskRow).weeks.slice();
                                            base[w] = val;
                                            
                                            // Проверяем, изменилось ли значение
                                            const hasChanged = !weeksArraysEqual(base, originalWeeks);
                                            
                                            setRows(prev=>prev.map(x =>
                                                (x.kind==='task' && x.id===r.id)
                                                    ? { 
                                                        ...(x as TaskRow), 
                                                        weeks: base,
                                                        // Устанавливаем флаги только если значение изменилось
                                                        ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));
                                            commitEdit();
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.stopPropagation(); 
                                            const raw = (e.target as HTMLInputElement).value;
                                            const val = Math.max(0, parseFloat(raw||"0"));
                                            const base = weeksBaseForTaskLocal(r as TaskRow);
                                            const originalWeeks = (r as TaskRow).weeks.slice();
                                            base[w] = val;
                                            
                                            // Проверяем, изменилось ли значение
                                            const hasChanged = !weeksArraysEqual(base, originalWeeks);
                                            
                                            setRows(prev=>prev.map(x =>
                                                (x.kind==='task' && x.id===r.id)
                                                    ? { 
                                                        ...(x as TaskRow), 
                                                        weeks: base,
                                                        // Устанавливаем флаги только если значение изменилось
                                                        ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));
                                            commitEdit(); 
                                            if (sel) focusPrevLeft(sel.rowId, sel.col); 
                                            return; 
                                        }
                                        if(e.key==='Tab'){
                                            e.preventDefault();
                                            const raw = (e.target as HTMLInputElement).value;
                                            const val = Math.max(0, parseFloat(raw||"0"));
                                            const base = weeksBaseForTaskLocal(r as TaskRow);
                                            const originalWeeks = (r as TaskRow).weeks.slice();
                                            base[w] = val;
                                            
                                            // Проверяем, изменилось ли значение
                                            const hasChanged = !weeksArraysEqual(base, originalWeeks);
                                            
                                            setRows(prev=>prev.map(x =>
                                                (x.kind==='task' && x.id===r.id)
                                                    ? { 
                                                        ...(x as TaskRow), 
                                                        weeks: base,
                                                        // Устанавливаем флаги только если значение изменилось
                                                        ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));
                                            focusNextRight(r.id, {week:w});
                                        }
                                        if(e.key==='Escape'){
                                            cancelEditRef.current=true;
                                            stopEdit();
                                        }
                                    }}
                                    onBlur={(e)=>{
                                        if(!cancelEditRef.current){
                                            const raw = (e.target as HTMLInputElement).value;
                                            const val = Math.max(0, parseFloat(raw||"0"));
                                            const base = weeksBaseForTaskLocal(r as TaskRow);
                                            const originalWeeks = (r as TaskRow).weeks.slice();
                                            base[w] = val;
                                            
                                            // Проверяем, изменилось ли значение
                                            const hasChanged = !weeksArraysEqual(base, originalWeeks);
                                            
                                            setRows(prev=>prev.map(x =>
                                                (x.kind==='task' && x.id===r.id)
                                                    ? { 
                                                        ...(x as TaskRow), 
                                                        weeks: base,
                                                        // Устанавливаем флаги только если значение изменилось
                                                        ...(hasChanged ? { manualEdited: true, autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));
                                        }
                                        stopEdit();
                                    }}
                                />
                            ) : (
                                <div
                                    onMouseDown={(e)=>onWeekCellMouseDown(e,r,w)}
                                    onMouseEnter={(e)=>onWeekCellMouseEnter(e,r,w)}
                                    onDoubleClick={(e)=>onWeekCellDoubleClick(e,r,w)}
                                    onClick={()=>setSel({rowId:r.id,col:{week:w}})}
                                    className="w-full h-8 text-sm flex items-center justify-center cursor-pointer select-none"
                                    title={`Неделя #${w+1}`}
                                >{(r as TaskRow).weeks[w] || ""}</div>
                            )}
                        </td>
                    ))}
                </tr>
            ))}
            </tbody>
        </table>
        
        {/* SVG overlay для стрелок блокеров */}
        <ArrowOverlay 
            links={links} 
            container={containerEl} 
            onRemoveBlocker={handleRemoveBlocker}
            tasks={filteredRows.filter(r => r.kind === "task") as TaskRow[]}
        />
    </div>
            

            {/* Кнопка Добавить снизу */}
            <div className="flex justify-start">
                <div className="relative">
                    <button className="bg-black text-white rounded px-4 py-2" onClick={()=>setAddMenuOpen(v=>!v)}>+ Добавить</button>
                    {addMenuOpen && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-1 w-40">
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100" onClick={addResourceBottom}>Ресурс</button>
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100" onClick={addTaskBottom}>Задача</button>
                        </div>
                    )}
                </div>
            </div>
        </>
    ) : tab === 'sprints' ? (
        <>
        <div className="sprint-table-container flex-grow border rounded-xl overflow-auto" style={{ position: "relative" }}>
            <table className="min-w-full text-sm select-none table-fixed border-collapse" style={{ border: '1px solid rgb(226, 232, 240)' }}>
                <colgroup>
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(249, 250, 251)' }}>
                <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Код</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Начало</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Окончание</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {sprints.map((s, i) => (
                    <tr key={i} className="border-b bg-white" onContextMenu={(e) => onContextMenuSprint(e, i)}>
                        <td className="px-4 py-2 align-middle" 
                            style={getSprintCellBorderStyle(sprintSel?.rowId === i && sprintSel?.col === 'code')}
                            onDoubleClick={() => startSprintEdit({rowId: i, col: 'code'})} 
                            onClick={() => setSprintSel({rowId: i, col: 'code'})}>
                            {sprintEditing?.rowId === i && sprintEditing?.col === 'code' ? (
                                <input 
                                    autoFocus 
                                    className="w-full h-8 box-border min-w-0 outline-none bg-transparent" 
                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                    defaultValue={s.code} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, code: (e.target as HTMLInputElement).value} : x)); 
                                            commitSprintEdit(); 
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.stopPropagation(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, code: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('prev', i, 'code'); 
                                            return; 
                                        }
                                        if (e.key === 'Tab') { 
                                            e.preventDefault(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, code: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('next', i, 'code'); 
                                        }
                                        if (e.key === 'Escape') { 
                                            cancelSprintEditRef.current = true; 
                                            stopSprintEdit(); 
                                        }
                                    }}
                                    onBlur={(e) => { 
                                        if (!cancelSprintEditRef.current) { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, code: (e.target as HTMLInputElement).value} : x)); 
                                        } 
                                        stopSprintEdit(); 
                                    }} 
                                />
                            ) : (
                                <span>{s.code}</span>
                            )}
                        </td>
                        <td className="px-4 py-2 align-middle" 
                            style={getSprintCellBorderStyle(sprintSel?.rowId === i && sprintSel?.col === 'start')}
                            onDoubleClick={() => startSprintEdit({rowId: i, col: 'start'})} 
                            onClick={() => setSprintSel({rowId: i, col: 'start'})}>
                            {sprintEditing?.rowId === i && sprintEditing?.col === 'start' ? (
                                <input 
                                    type="date" 
                                    autoFocus 
                                    className="w-full h-8 box-border min-w-0 outline-none bg-transparent" 
                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                    defaultValue={s.start} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, start: (e.target as HTMLInputElement).value} : x)); 
                                            commitSprintEdit(); 
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.stopPropagation(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, start: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('prev', i, 'start'); 
                                            return; 
                                        }
                                        if (e.key === 'Tab') { 
                                            e.preventDefault(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, start: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('next', i, 'start'); 
                                        }
                                        if (e.key === 'Escape') { 
                                            cancelSprintEditRef.current = true; 
                                            stopSprintEdit(); 
                                        }
                                    }}
                                    onBlur={(e) => { 
                                        if (!cancelSprintEditRef.current) { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, start: (e.target as HTMLInputElement).value} : x)); 
                                        } 
                                        stopSprintEdit(); 
                                    }} 
                                />
                            ) : (
                                <span>{formatDate(s.start)}</span>
                            )}
                        </td>
                        <td className="px-4 py-2 align-middle" 
                            style={getSprintCellBorderStyle(sprintSel?.rowId === i && sprintSel?.col === 'end')}
                            onDoubleClick={() => startSprintEdit({rowId: i, col: 'end'})} 
                            onClick={() => setSprintSel({rowId: i, col: 'end'})}>
                            {sprintEditing?.rowId === i && sprintEditing?.col === 'end' ? (
                                <input 
                                    type="date" 
                                    autoFocus 
                                    className="w-full h-8 box-border min-w-0 outline-none bg-transparent" 
                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                    defaultValue={s.end} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, end: (e.target as HTMLInputElement).value} : x)); 
                                            commitSprintEdit(); 
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.stopPropagation(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, end: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('prev', i, 'end'); 
                                            return; 
                                        }
                                        if (e.key === 'Tab') { 
                                            e.preventDefault(); 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, end: (e.target as HTMLInputElement).value} : x)); 
                                            navigateSprintInEditMode('next', i, 'end'); 
                                        }
                                        if (e.key === 'Escape') { 
                                            cancelSprintEditRef.current = true; 
                                            stopSprintEdit(); 
                                        }
                                    }}
                                    onBlur={(e) => { 
                                        if (!cancelSprintEditRef.current) { 
                                            setSprints(sp => sp.map((x, idx) => idx === i ? {...x, end: (e.target as HTMLInputElement).value} : x)); 
                                        } 
                                        stopSprintEdit(); 
                                    }} 
                                />
                            ) : (
                                <span>{formatDate(s.end)}</span>
                            )}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>

        {/* Кнопка Добавить снизу */}
        <div className="flex justify-start">
            <button className="bg-black text-white rounded px-4 py-2" onClick={addSprint}>+ Добавить</button>
        </div>
        </>
    ) : (
        <>
        <div className="team-table-container flex-grow border rounded-xl overflow-auto" style={{ position: "relative" }}>
            <table className="min-w-full text-sm select-none table-fixed border-collapse" style={{ border: '1px solid rgb(226, 232, 240)' }}>
                <colgroup>
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(249, 250, 251)' }}>
                <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Название</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Проект в JIRA</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>FeatureTeam</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>IssueType</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {teamData.map((t, i) => (
                    <tr key={i} className="border-b bg-white" onContextMenu={(e) => onContextMenuTeam(e, i)}>
                        <td className="px-4 py-2 align-middle" 
                            style={getTeamCellBorderStyle(teamSel?.rowId === i && teamSel?.col === 'name')}
                            onDoubleClick={() => startTeamEdit({rowId: i, col: 'name'})} 
                            onClick={() => setTeamSel({rowId: i, col: 'name'})}>
                            {teamEditing?.rowId === i && teamEditing?.col === 'name' ? (
                                <input 
                                    autoFocus 
                                    className="w-full h-8 box-border min-w-0 outline-none bg-transparent" 
                                    style={{ border: 'none', padding: 0, margin: 0 }}
                                    defaultValue={t.name} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { 
                                            setTeamData(teams => teams.map((x, idx) => idx === i ? {...x, name: (e.target as HTMLInputElement).value} : x)); 
                                            commitTeamEdit(); 
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.stopPropagation(); 
                                            setTeamData(teams => teams.map((x, idx) => idx === i ? {...x, name: (e.target as HTMLInputElement).value} : x)); 
                                            navigateTeamInEditMode('prev', i, 'name'); 
                                            return; 
                                        }
                                        if (e.key === 'Tab') { 
                                            e.preventDefault(); 
                                            setTeamData(teams => teams.map((x, idx) => idx === i ? {...x, name: (e.target as HTMLInputElement).value} : x)); 
                                            navigateTeamInEditMode('next', i, 'name'); 
                                        }
                                        if (e.key === 'Escape') { 
                                            cancelTeamEditRef.current = true; 
                                            stopTeamEdit(); 
                                        }
                                    }}
                                    onBlur={(e) => { 
                                        if (!cancelTeamEditRef.current) { 
                                            setTeamData(teams => teams.map((x, idx) => idx === i ? {...x, name: (e.target as HTMLInputElement).value} : x)); 
                                        } 
                                        stopTeamEdit(); 
                                    }} 
                                />
                            ) : (
                                <span>{t.name}</span>
                            )}
                        </td>
                        <td className="px-4 py-2 align-middle" 
                            style={getTeamCellBorderStyle(teamSel?.rowId === i && teamSel?.col === 'jiraProject')}
                            onDoubleClick={() => startTeamEdit({rowId: i, col: 'jiraProject'})} 
                            onClick={() => setTeamSel({rowId: i, col: 'jiraProject'})}>
                            <span>{t.jiraProject}</span>
                        </td>
                        <td className="px-4 py-2 align-middle" 
                            style={getTeamCellBorderStyle(teamSel?.rowId === i && teamSel?.col === 'featureTeam')}
                            onDoubleClick={() => startTeamEdit({rowId: i, col: 'featureTeam'})} 
                            onClick={() => setTeamSel({rowId: i, col: 'featureTeam'})}>
                            <span>{t.featureTeam}</span>
                        </td>
                        <td className="px-4 py-2 align-middle" 
                            style={getTeamCellBorderStyle(teamSel?.rowId === i && teamSel?.col === 'issueType')}
                            onDoubleClick={() => startTeamEdit({rowId: i, col: 'issueType'})} 
                            onClick={() => setTeamSel({rowId: i, col: 'issueType'})}>
                            <span>{t.issueType}</span>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
        <div className="flex justify-start">
            <button className="bg-black text-white rounded px-4 py-2" onClick={addTeam}>+ Добавить</button>
        </div>
        </>
    )}

{/* Контекстное меню спринтов */}
{sprintCtx && (
    <div 
        className="fixed bg-white border rounded shadow-lg z-50 py-1 min-w-32"
        style={{ left: sprintCtx.x, top: sprintCtx.y }}
        onMouseLeave={() => setSprintCtx(null)}
    >
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
            onClick={() => { addSprintAbove(sprintCtx.index); setSprintCtx(null); }}
        >
            Добавить выше
        </button>
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
            onClick={() => { addSprintBelow(sprintCtx.index); setSprintCtx(null); }}
        >
            Добавить ниже
        </button>
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm text-red-600"
            onClick={() => { deleteSprint(sprintCtx.index); setSprintCtx(null); }}
            disabled={sprints.length <= 1}
        >
            Удалить
        </button>
    </div>
)}

{/* Контекстное меню команд */}
{teamCtx && (
    <div 
        className="fixed bg-white border rounded shadow-lg z-50 py-1 min-w-32"
        style={{ left: teamCtx.x, top: teamCtx.y }}
        onMouseLeave={() => setTeamCtx(null)}
    >
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
            onClick={() => { addTeamAbove(teamCtx.index); setTeamCtx(null); }}
        >
            Добавить выше
        </button>
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
            onClick={() => { addTeamBelow(teamCtx.index); setTeamCtx(null); }}
        >
            Добавить ниже
        </button>
        <button 
            className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm text-red-600"
            onClick={() => { deleteTeam(teamCtx.index); setTeamCtx(null); }}
            disabled={teamData.length <= 1}
        >
            Удалить
        </button>
        </div>
    )}

{/* Контекстное меню строк / плюс пункт цвета для Fn/Empl ресурса */}
{ctx && (
        <>
            <div className="fixed inset-0 z-40" onMouseDown={()=>setCtx(null)} />
            <div className="fixed z-50 bg-white shadow-lg rounded-md border border-gray-200 p-2" style={{left:ctx.x, top:ctx.y}} onMouseDown={(e)=>e.stopPropagation()}>
                <div className="bg-white border rounded shadow text-sm">
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>duplicateRow(ctx.rowId)}>Дублировать</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>deleteRow(ctx.rowId)}>Удалить</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>addRowAbove(ctx.rowId)}>Добавить выше</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>addRowBelow(ctx.rowId)}>Добавить ниже</button>
                    {ctx.field && (
                        <button
                            className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                            onClick={() => {
                                const row = rows.find(x => x.id === ctx.rowId);
                                if (!row) { setCtx(null); return; }
                                const teamFnKey = ctx.kind === "resource" ? teamKeyFromResource(row as ResourceRow) : teamKeyFromTask(row as TaskRow);
                                const initial = normalizeColorValue(teamFnColors[teamFnKey]);
                                setColorPanel({ anchor: { x: ctx.x, y: ctx.y }, teamFnKey, view: ctx.kind, initial });
                                setCtx(null);
                            }}
                        >
                            Выбрать цвет
                        </button>
                    )}
                </div>
            </div>
        </>
    )}

{/* Панель выбора цветов */}
{colorPanel && (
    <ColorPickerPanel
        view={colorPanel.view}
        teamFnKey={colorPanel.teamFnKey}
        anchor={colorPanel.anchor}
        initialColors={colorPanel.initial}
        onApply={(bg, text) => {
            setTeamFnColors(prev => ({ ...prev, [colorPanel.teamFnKey]: { bg, text } }));
            setColorPanel(null);
        }}
        onCancel={() => {
            setColorPanel(null);
        }}
        onCloseOutside={() => {
            setColorPanel(null);
        }}
    />
)}


{/* UI фильтров */}
{filterUi && (
        <div className="fixed z-50" style={{ left: filterUi.x, top: filterUi.y }}>
            <div className="bg-white border rounded shadow p-2 w-56 max-w-xs text-sm" style={{ backgroundColor: '#ffffff' }} onMouseLeave={()=>setFilterUi(null)}>
                <div className="font-semibold mb-1">Фильтр</div>
                <input className="border w-full px-2 py-1 mb-2 box-border" placeholder="Поиск" value={filters[filterUi.col]?.search || ""} onChange={e=>setFilterSearch(filterUi.col, e.target.value)} />
                <div className="max-h-60 overflow-auto space-y-1">
                    {Array.from(new Set(filteredValuesForColumn(computedRows, filterUi.col).filter(v => v.toLowerCase().includes((filters[filterUi.col]?.search||"").toLowerCase())))).map(v => (
                        <label key={v} className="flex items-center gap-2">
                            <input type="checkbox" checked={filters[filterUi.col]?.selected?.has(v) || false} onChange={()=>toggleFilterValue(filterUi.col, v)} />
                            <span className="truncate" title={v}>{v || "(пусто)"}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-2 flex justify-between">
                    <button className="text-xs underline" onClick={()=>clearFilter(filterUi.col)}>Сбросить</button>
                    <button className="text-xs underline" onClick={()=>setFilterUi(null)}>ОК</button>
                </div>
            </div>
        </div>
    )}

{/* Тултип при перетягивании задач и ресурсов */}
{dragTooltip.visible && (dragTooltip.task || dragTooltip.resource) && (
    <div 
        className="fixed z-50 text-gray-800 text-sm rounded-lg shadow-lg border border-gray-300 pointer-events-none"
        style={{ 
            left: dragTooltip.x, 
            top: dragTooltip.y,
            maxWidth: '300px',
            minWidth: '200px',
            padding: '12px 16px',
            backgroundColor: '#f3f4f6',
            opacity: 1,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
        }}
    >
        <div className="font-semibold text-base mb-2 text-gray-900">
            {dragTooltip.task && (
                <>
                    {dragTooltip.task.team} / {dragTooltip.task.task} / {dragTooltip.task.fn}
                </>
            )}
            {dragTooltip.resource && (
                <>
                    {dragTooltip.resource.team.join(', ')} / {dragTooltip.resource.fn}
                    {dragTooltip.resource.empl && ` / ${dragTooltip.resource.empl}`}
                </>
            )}
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">
            {dragTooltip.task && (
                <>
                    {isShiftPressedRef.current 
                        ? "Киньте задачу на ту, которая блокирует текущую"
                        : "Нажмите Shift для выбора блокирующей задачи"
                    }
                </>
            )}
        </div>
    </div>
)}
</div>
);
// ===== helpers (render) =====
// Helper function to check if a filter is active
function isFilterActive(col: ColumnId): boolean {
    const filter = filters[col];
    return !!(filter && filter.selected.size > 0);
}

function renderHeadWithFilter(label: string, col: ColumnId) {
    const filterActive = isFilterActive(col);
    const buttonClass = filterActive 
        ? "text-xs rounded" 
        : "text-xs text-gray-500";
    const buttonStyle = filterActive 
        ? { padding: '1px 2px', backgroundColor: '#166534', color: '#ffffff' } // Force green background and white text with inline styles
        : { padding: '1px 2px' };
    
    return (
        <th className="px-2 py-2 text-center align-middle" style={{ width: COL_WIDTH[col], border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>
            <div className="flex items-center justify-between">
                <span>{label}</span>
                {col === "team" ? (
                    <button 
                        className={buttonClass} 
                        style={buttonStyle}
                        title={filterActive ? "Фильтр применен" : "Открыть фильтр"}
                        onClick={(e)=>openFilter(col, (e.currentTarget as HTMLElement).getBoundingClientRect().left, (e.currentTarget as HTMLElement).getBoundingClientRect().bottom+4)}
                    >
                        ▾
                    </button>
                ) : (
                    <button 
                        className={buttonClass} 
                        style={buttonStyle}
                        title={filterActive ? "Фильтр применен" : "Открыть фильтр"}
                        onClick={(e)=>openFilter(col, (e.currentTarget as HTMLElement).getBoundingClientRect().left, (e.currentTarget as HTMLElement).getBoundingClientRect().bottom+4)}
                    >
                        ▾
                    </button>
                )}
            </div>
        </th>
    );
}
function filteredValuesForColumn(list: Row[], col: ColumnId): string[] { return list.map(r => valueForCol(r, col)).filter(v => v !== undefined); }
function isSel(rowId:ID, col:Exclude<ColKey, {week:number}>|"type") { return sel && sel.rowId===rowId && sel.col===col; }
function isSelWeek(rowId:ID, w:number) { return sel && sel.rowId===rowId && typeof sel.col==='object' && sel.col.week===w; }
// self-tests hook removed to satisfy eslint rules-of-hooks
}
