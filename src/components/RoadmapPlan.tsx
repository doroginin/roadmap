import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Select } from "./Select";
import { TeamMultiSelect } from "./TeamMultiSelect";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { SaveStatus } from "./SaveStatus";
import { normalizeColorValue, getBg, getText } from "./colorUtils";
import { DEFAULT_BG } from "./colorDefaults";
import { fetchRoadmapData } from "../api/roadmapApi";
import type { RoadmapData } from "../api/types";
import { generateUUID } from "../utils/uuid";

// Roadmap types and utilities
import type { ID, Status, Fn, Sprint, ResourceRow, TaskRow, Row } from "./roadmap/types";
import { range, clamp, fmtDM, cellId, calculateTotalWeeks } from "./roadmap/utils/calculations";
import { hasExpectedStartWeekMismatch } from "./roadmap/utils/taskUtils";
import { getCellBgClass, getCellBgStyle } from "./roadmap/utils/cellUtils";
import { buildLinks } from "./roadmap/utils/linkBuilder";
import { getFrozenColumnStyle } from "./roadmap/utils/columnStyles";
import { ArrowOverlay } from "./roadmap/components/ArrowOverlay";
import { useColumnResize } from "./roadmap/hooks/useColumnResize";
import { useRoadmapFilters, type ColumnId } from "./roadmap/hooks/useRoadmapFilters";
import { useSelection, type ColKey } from "./roadmap/hooks/useSelection";
import { useKeyboardNavigation } from "./roadmap/hooks/useKeyboardNavigation";
import { useDragAndDrop } from "./roadmap/hooks/useDragAndDrop";

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

// ---- Компонент ----
interface RoadmapPlanProps {
  initialData?: RoadmapData | null;
  onDataChange?: (data: RoadmapData) => void;
  onSaveRequest?: () => void;
  userId?: string | null;
  changeTracker?: any; // TODO: добавить правильный тип
  autoSaveState?: any; // TODO: добавить правильный тип для AutoSaveState
}

export function RoadmapPlan({ initialData, onDataChange, changeTracker, autoSaveState }: RoadmapPlanProps = {}) {
    // ===== Tabs =====
    type Tab = "plan" | "sprints" | "teams";
    const [tab, setTab] = useState<Tab>("plan");

    // ===== Спринты (редактируемые) =====
    const [sprints, setSprints] = useState<Sprint[]>([]);

    // ===== Команды (редактируемые) =====
    type LocalTeamData = {
        id?: string; // UUID
        name: string;
        jiraProject: string;
        featureTeam: string;
        issueType: string;
    };
    const [teamData, setTeamData] = useState<LocalTeamData[]>([
        { name: "Demo", jiraProject: "", featureTeam: "", issueType: "" }
    ]);

    // Преобразуем данные команд в массив имен для совместимости с существующими компонентами
    const teamNames = useMemo(() => teamData.map(t => t.name), [teamData]);
    const WEEK0 = useMemo(() => {
        if (sprints.length > 0 && sprints[0].start) {
            const dateStr = sprints[0].start.split('T')[0];
            return dateStr;
        }
        return "2025-06-02";
    }, [sprints]);

    // Вычисляем общее количество недель на основе спринтов
    const totalWeeks = useMemo(() => {
        return calculateTotalWeeks(sprints, WEEK0);
    }, [sprints, WEEK0]);

    function mapWeekToSprintLocal(weekIndex0: number): string | null {
        const startDate = new Date(WEEK0 + "T00:00:00Z");
        startDate.setUTCDate(startDate.getUTCDate() + 7 * weekIndex0);
        const iso = startDate.toISOString().slice(0, 10);
        const d = new Date(iso + "T00:00:00Z");
        for (const s of sprints) {
            const s0 = new Date(s.start);
            const s1 = new Date(s.end);
            if (d >= s0 && d <= s1) return s.code;
        }
        return null;
    }
    function weekHeaderLabelLocal(idx0: number) {
        if (!WEEK0 || WEEK0 === "Invalid Date" || !WEEK0.includes('-')) {
            return { num: idx0 + 1, sprint: null, from: "??.??.????", to: "??.??.????" };
        }
        
        try {
            const startDate = new Date(WEEK0 + "T00:00:00Z");
            
            if (isNaN(startDate.getTime())) {
                return { num: idx0 + 1, sprint: null, from: "??.??.????", to: "??.??.????" };
            }
            
            startDate.setUTCDate(startDate.getUTCDate() + 7 * idx0);
            const startISO = startDate.toISOString().slice(0, 10);
            
            const endDate = new Date(startDate.getTime());
            endDate.setUTCDate(endDate.getUTCDate() + 6);
            const endISO = endDate.toISOString().slice(0, 10);
            
            return { num: idx0 + 1, sprint: mapWeekToSprintLocal(idx0), from: fmtDM(startISO), to: fmtDM(endISO) };
        } catch (error) {
            console.error('weekHeaderLabelLocal error:', error);
            return { num: idx0 + 1, sprint: null, from: "??.??.????", to: "??.??.????" };
        }
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

    // ===== Ширина колонок (для ресайзинга) =====
    const { columnWidths, handleResizeStart } = useColumnResize();

    // ===== Состояние загрузки данных =====
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [currentVersion, setCurrentVersion] = useState<number>(0);

    // Функции для получения уникальных значений из данных
    const getUniqueValues = useCallback((field: 'fn' | 'empl', teamFilter?: string) => {
        const allRows = [...rows];
        let filtered = allRows;
        
        // Если указан фильтр по команде, применяем его
        if (teamFilter) {
            filtered = allRows.filter(row => {
                if (row.kind === 'task') {
                    return (row as TaskRow).team === teamFilter;
                }
                if (row.kind === 'resource') {
                    return (row as ResourceRow).team.includes(teamFilter);
                }
                return false;
            });
        }
        
        const values = new Set<string>();
        filtered.forEach(row => {
            const value = (row as any)[field];
            if (value && typeof value === 'string' && value.trim()) {
                values.add(value.trim());
            }
        });
        
        return Array.from(values).sort();
    }, [rows]);

    const getEmployeesForFunction = useCallback((fn: string, teamFilter?: string) => {
        const allRows = [...rows];
        let filtered = allRows;
        
        // Фильтруем по команде если указана
        if (teamFilter) {
            filtered = allRows.filter(row => {
                if (row.kind === 'task') {
                    return (row as TaskRow).team === teamFilter;
                }
                if (row.kind === 'resource') {
                    return (row as ResourceRow).team.includes(teamFilter);
                }
                return false;
            });
        }
        
        // Фильтруем по функции
        filtered = filtered.filter(row => (row as any).fn === fn);
        
        const employees = new Set<string>();
        filtered.forEach(row => {
            const empl = (row as any).empl;
            if (empl && typeof empl === 'string' && empl.trim()) {
                employees.add(empl.trim());
            }
        });
        
        return Array.from(employees).sort();
    }, [rows]);
    
    // Helper function to prepare data for saving (convert names to UUIDs)
    const prepareDataForSave = useCallback((): RoadmapData | null => {
        const { resources, tasks } = splitRows(rows);
        
        // Prepare resources with UUIDs
        const preparedResources = (resources as ResourceRow[]).map(r => {
            const teamUUIDs = r.team.map(teamName => {
                const found = teamData.find(t => t.name === teamName);
                return found?.id;
            }).filter(Boolean) as string[];
            
            return {
                id: r.id,
                teamIds: teamUUIDs.length > 0 ? teamUUIDs : undefined,
                fn: r.fn || undefined,
                empl: r.empl || undefined,
                weeks: r.weeks || undefined,
                prevId: r.prevId || undefined,
                nextId: r.nextId || undefined
            };
        });
        
        // Prepare tasks with UUIDs
        // For tasks with autoPlanEnabled, use computed weeks from computedRowsRef
        const preparedTasks = (tasks as TaskRow[]).map(t => {
            const teamUUID = teamData.find(team => team.name === t.team)?.id || t.teamId;
            
            // For tasks with autoPlanEnabled, get weeks from computedRowsRef
            let weeksToSave = t.weeks;
            if (t.autoPlanEnabled) {
                const computedTask = computedRowsRef.current.find(r => r.kind === 'task' && r.id === t.id) as TaskRow | undefined;
                if (computedTask && computedTask.weeks) {
                    weeksToSave = computedTask.weeks;
                }
            }
            
            return {
                id: t.id,
                status: t.status || undefined,
                sprintsAuto: t.sprintsAuto || undefined,
                epic: t.epic || undefined,
                task: t.task || undefined,
                teamId: teamUUID || undefined,
                fn: t.fn || undefined,
                empl: t.empl || undefined,
                planEmpl: t.planEmpl || undefined,
                planWeeks: t.planWeeks || undefined,
                blockerIds: t.blockerIds || undefined,
                weekBlockers: t.weekBlockers || undefined,
                fact: t.fact || undefined,
                startWeek: t.startWeek || undefined,
                endWeek: t.endWeek || undefined,
                expectedStartWeek: t.expectedStartWeek || undefined,
                autoPlanEnabled: t.autoPlanEnabled || undefined,
                weeks: weeksToSave !== undefined ? weeksToSave : undefined,
                prevId: t.prevId || undefined,
                nextId: t.nextId || undefined
            };
        });
        
        const roadmapData: RoadmapData = {
            version: currentVersion,
            teams: teamData.map(t => ({
                id: t.id,
                name: t.name,
                jiraProject: t.jiraProject,
                featureTeam: t.featureTeam,
                issueType: t.issueType
            })),
            sprints: sprints,
            resources: preparedResources as any[],
            tasks: preparedTasks as any[]
        };
        
        return roadmapData;
    }, [teamData, sprints, currentVersion, rows]);
    

    // ===== Загрузка данных при монтировании компонента =====
    // Using useRef to track if data is already loaded to avoid re-loading on every initialData change
    const loadedVersionRef = useRef<number | null>(null);
    
    useEffect(() => {
        const loadData = async () => {
            // Skip if we already loaded this version
            if (initialData && loadedVersionRef.current === initialData.version) {
                return;
            }
            
            try {
                setLoading(true);
                setError(null);
                
                let data: RoadmapData;
                
                if (initialData) {
                    // Используем переданные данные
                    data = initialData;
                } else {
                    // Загружаем данные с сервера
                    const response = await fetchRoadmapData();
                    
                    if (response.error) {
                        setError(response.error);
                        return;
                    }
                    
                    data = response.data;
                }
                
                // Mark this version as loaded
                loadedVersionRef.current = data.version;
                
                // Ensure tasks have weeks array initialized
                // Pad weeks array to totalWeeks if it's shorter
                const tasksWithWeeks = (data.tasks || []).map(task => {
                    let weeks: number[];
                    if (Array.isArray(task.weeks) && task.weeks.length > 0) {
                        // Use provided weeks and pad to totalWeeks if needed
                        weeks = [...task.weeks];
                        while (weeks.length < totalWeeks) {
                            weeks.push(0);
                        }
                    } else {
                        // Initialize with zeros
                        weeks = Array(totalWeeks).fill(0);
                    }
                    return {
                        ...task,
                        weeks
                    };
                });
                
                // Объединяем ресурсы и задачи в один массив rows
                // Backend уже возвращает данные в правильном порядке (linked list)
                const allRows: Row[] = [
                    ...(data.resources || []),
                    ...tasksWithWeeks
                ] as Row[];

                setRows(allRows as Row[]);
                // Generate IDs for sprints and teams that don't have them (for change tracking)
                setSprints((data.sprints || []).map(s => ({ ...s, id: s.id || generateUUID() })));
                setTeamData((data.teams || []).map(t => ({ ...t, id: t.id || generateUUID() })));
                setCurrentVersion(data.version || 0);

                // Инициализируем цвета из загруженных ресурсов
                const initialColors: Record<string, { bg: string; text: string }> = {};
                (data.resources || []).forEach(resource => {
                    if (resource.fnBgColor && resource.fnTextColor) {
                        const teams = Array.isArray(resource.team) ? resource.team.slice().sort().join('+') : '';
                        const teamFnKey = `${teams}|${resource.fn || ''}`;
                        initialColors[teamFnKey] = {
                            bg: resource.fnBgColor,
                            text: resource.fnTextColor
                        };
                    }
                });
                setTeamFnColors(initialColors);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [initialData?.version]);

    // ===== Уведомление родительского компонента об изменениях данных =====
    const isInitialMount = useRef(true);
    
    useEffect(() => {
        // Пропускаем первый рендер (при монтировании)
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        // Уведомляем родительский компонент об изменении данных
        if (onDataChange) {
            const dataToSave = prepareDataForSave();
            if (dataToSave) {
                onDataChange(dataToSave);
            }
        }
    }, [rows, teamData, sprints, onDataChange, prepareDataForSave]);

    // ===== Последовательный пересчёт (как в формуле roadmap.js) =====
    type ResState = { res: ResourceRow; load: number[] };
    
    function computeAllRowsLocal(list: Row[]): { rows: Row[]; resLoad: Record<ID, number[]> } {
        const resources: ResState[] = list.filter(r => r.kind === 'resource').map(r => ({ 
            res: r as ResourceRow, 
            load: Array(totalWeeks).fill(0) 
        }));
        const out: Row[] = [];
        const ceil = (x: number) => Math.ceil(Math.max(0, x || 0));

        const findTaskByIdInOut = (id: ID): TaskRow | undefined => 
            out.find(x => x.id === id && x.kind === 'task') as TaskRow | undefined;

        // Кэш для вычисленных блокеров, чтобы избежать повторных вычислений
        // Разделяем на два типа: фактические результаты и предварительные оценки
        const blockerCache = new Map<ID, number>(); // Только для обработанных задач
        const estimateCache = new Map<ID, number>(); // Для предварительных оценок
        // Стек для отслеживания циклических зависимостей
        const computationStack = new Set<ID>();

        // Рекурсивное вычисление максимального времени завершения блокеров
        function computeBlockerEndTime(taskId: ID, currentTaskId: ID): number {
            // Проверка на циклическую зависимость
            if (computationStack.has(taskId)) {
                console.warn(`Обнаружена циклическая зависимость при вычислении блокера ${taskId} для задачи ${currentTaskId}`);
                return 0; // Возвращаем 0, чтобы не блокировать планирование
            }

            // Проверяем кэш фактических результатов
            if (blockerCache.has(taskId)) {
                const cachedResult = blockerCache.get(taskId)!;
                return cachedResult;
            }
            
            // Для предварительных оценок проверяем только в рамках текущего вычисления
            if (estimateCache.has(taskId) && !computationStack.has(currentTaskId)) {
                return estimateCache.get(taskId)!;
            }

            // Ищем задачу среди уже обработанных
            const blockerTask = findTaskByIdInOut(taskId);
            
            if (blockerTask) {
                // Задача уже обработана, используем её endWeek
                const endTime = blockerTask.endWeek || 0;
                blockerCache.set(taskId, endTime);
                return endTime;
            }

            // Ищем задачу сначала среди обработанных, затем среди исходных
            let originalTask = findTaskByIdInOut(taskId);
            if (!originalTask) {
                originalTask = list.find(r => r.id === taskId && r.kind === 'task') as TaskRow | undefined;
            }
            if (!originalTask) {
                console.warn(`Блокирующая задача ${taskId} не найдена ни в обработанных, ни в исходных задачах`);
                blockerCache.set(taskId, 0);
                return 0;
            }

            // Если у блокирующей задачи отключено автопланирование
            if (!originalTask.autoPlanEnabled) {
                // Вычисляем endWeek на основе weeks массива
                const weeks = originalTask.weeks || [];
                const nz = weeks.map((v, i) => v > 0 ? i + 1 : 0).filter(Boolean) as number[];
                const endTime = nz.length ? Math.max(...nz) : 0;
                // Всегда кэшируем результаты для задач без автопланирования
                blockerCache.set(taskId, endTime);
                return endTime;
            }

            // Если у блокирующей задачи включено автопланирование, нужно рекурсивно вычислить её план
            if (originalTask.autoPlanEnabled) {
                // Добавляем текущую задачу в стек для отслеживания циклов
                computationStack.add(taskId);

                try {
                    // Рекурсивно вычисляем блокеры для блокирующей задачи
                    const blockerOfBlocker = (originalTask.blockerIds || [])
                        .map(id => computeBlockerEndTime(id, taskId))
                        .reduce((a, b) => Math.max(a, b), 0);

                    // УПРОЩЕННАЯ ЛОГИКА: Используем только блокеры задачи
                    // Топологическая сортировка гарантирует правильный порядок обработки
                    const earliestStartAfterProcessedTasks = blockerOfBlocker;

                    // Вычисляем план для блокирующей задачи с учетом её блокеров
                    const need = Math.max(0, originalTask.planEmpl || 0);
                    const dur = ceil(originalTask.planWeeks || 0);
                    
                    let endTime = 0;
                    if (need > 0 && dur > 0) {
                        // Находим подходящие ресурсы
                        const matched = resources.filter(rs => matchResourceForTask(rs.res, originalTask));
                        if (matched.length > 0) {
                            // Вычисляем свободные ресурсы с учетом уже запланированных задач
                            const free = Array(totalWeeks).fill(0);
                            for (let w = 0; w < totalWeeks; w++) {
                                free[w] = matched.reduce((sum, rs) => sum + Math.max(0, rs.res.weeks[w] - rs.load[w]), 0);
                            }

                            // Ищем первое доступное окно после блокеров И после обработанных задач выше
                            const maxStart = totalWeeks - dur + 1;
                            for (let s = Math.max(1, earliestStartAfterProcessedTasks + 1); s <= maxStart; s++) {
                                let ok = true;
                                for (let off = 0; off < dur; off++) {
                                    if (free[s - 1 + off] < need) { 
                                        ok = false; 
                                        break; 
                                    }
                                }
                                if (ok) { 
                                    endTime = s + dur - 1;
                                    break; 
                                }
                            }
                        }
                    }

                    // Если задача уже обработана, кэшируем как фактический результат
                    if (findTaskByIdInOut(taskId)) {
                        blockerCache.set(taskId, endTime);
                    } else {
                        // Если задача не обработана, кэшируем как предварительную оценку
                        estimateCache.set(taskId, endTime);
                    }
                    return endTime;
                } finally {
                    // Убираем задачу из стека
                    computationStack.delete(taskId);
                }
            }

            // Если автопланирование отключено и нет ручного плана, возвращаем 0
            blockerCache.set(taskId, 0);
            return 0;
        }

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
            const free = range(totalWeeks).map(w => 
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

            // Проверяем на циклические зависимости перед началом вычислений
            if (computationStack.has(t.id)) {
                console.warn(`Обнаружена циклическая зависимость для задачи ${t.id}. Автопланирование отключено.`);
                // Возвращаем задачу без планирования
                t.startWeek = null;
                t.endWeek = null;
                t.fact = 0;
                t.weeks = Array(totalWeeks).fill(0);
                t.sprintsAuto = [];
                return t;
            }

            // Вычисляем максимальное время завершения блокеров с учетом рекурсивного планирования
            const taskBlocker = (t.blockerIds || [])
                .map(id => computeBlockerEndTime(id, t.id))
                .reduce((a, b) => Math.max(a, b), 0);
            
            // Вычисляем максимальную неделю из блокеров на неделю (задача может начинаться только ПОСЛЕ блокирующей недели)
            const weekBlocker = (t.weekBlockers || [])
                .map(weekNum => weekNum) // Блокирующая неделя в 1-based, задача начинается после неё
                .reduce((a, b) => Math.max(a, b), 0);
            
            // Итоговый блокер - максимум из блокеров задач и блокеров недель
            const blocker = Math.max(taskBlocker, weekBlocker);
            
            // ДИАГНОСТИКА: Логируем информацию о планировании

            // режим: автоплан отключён → используем существующие weeks и только учитываем загрузку ресурсов
            if (!t.autoPlanEnabled) {
                const weeks = t.weeks.slice();
                const matched = resources.filter(rs => matchResourceForTask(rs.res, t));
                for (let w = 0; w < totalWeeks; w++) {
                    if (weeks[w] > 0) allocateWeekLoadAcrossResources(weeks[w], matched, w);
                }
                const nz = weeks.map((v, i) => v > 0 ? i + 1 : 0).filter(Boolean) as number[];
                t.startWeek = nz.length ? Math.min(...nz) : null;
                t.endWeek = nz.length ? Math.max(...nz) : null;
                t.fact = weeks.reduce((a, b) => a + b, 0);
                t.sprintsAuto = listSprintsBetweenLocal(t.startWeek, t.endWeek);
                return t;
            }

            // Автоплан включен: всегда вычисляем план заново
            // (для правильного пересчета при изменении зависимостей)
            const weeks = Array(totalWeeks).fill(0) as number[];
            let matched: ResState[] = [];
            
            // Добавляем задачу в стек для отслеживания циклических зависимостей
            computationStack.add(t.id);
            
            let start = 0;
            try {
                const result = freeTotalsForTask(t);
                matched = result.matched;
                const free = result.free;
                if (need > 0 && dur > 0 && matched.length > 0) {
                    const maxStart = totalWeeks - dur + 1;
                    // ИСПРАВЛЕНИЕ: Начинаем поиск строго после завершения всех блокеров
                    const minStart = Math.max(1, blocker + 1);
                    
                    for (let s = minStart; s <= maxStart; s++) {
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
            } finally {
                // Убираем задачу из стека после завершения вычислений
                computationStack.delete(t.id);
            }
            
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

        // Сначала добавляем все ресурсы
        for (const r of list) {
            if (r.kind === 'resource') { 
                out.push(r); 
            }
        }

        // Затем обрабатываем задачи в топологическом порядке (учитывая зависимости)
        const tasks = list.filter(r => r.kind === 'task') as TaskRow[];
        const processedTaskIds = new Set<ID>();
        const taskOrder: TaskRow[] = [];

        // Топологическая сортировка задач по зависимостям
        function canProcessTask(task: TaskRow): boolean {
            // Безопасная проверка на случай если blockerIds undefined
            return (task.blockerIds || []).every(blockerId => processedTaskIds.has(blockerId));
        }

        // Повторяем до тех пор, пока не обработаем все задачи
        while (taskOrder.length < tasks.length) {
            const foundTasks: TaskRow[] = [];
            
            // Собираем все задачи, которые можно обработать на этом шаге
            for (const task of tasks) {
                if (!processedTaskIds.has(task.id) && canProcessTask(task)) {
                    foundTasks.push(task);
                }
            }
            
            if (foundTasks.length > 0) {
                // Сортируем найденные задачи ТОЛЬКО по исходному порядку
                // Это гарантирует стабильность и правильное планирование параллельных задач
                foundTasks.sort((a, b) => {
                    const aIndex = tasks.indexOf(a);
                    const bIndex = tasks.indexOf(b);
                    return aIndex - bIndex;
                });
                
                // Обрабатываем первую задачу из отсортированного списка
                const taskToProcess = foundTasks[0];
                taskOrder.push(taskToProcess);
                processedTaskIds.add(taskToProcess.id);
            } else {
                // Если не нашли ни одной задачи для обработки, значит есть циклические зависимости
                console.warn("Обнаружены циклические зависимости в задачах. Обрабатываем оставшиеся задачи в исходном порядке.");
                for (const task of tasks) {
                    if (!processedTaskIds.has(task.id)) {
                        taskOrder.push(task);
                        processedTaskIds.add(task.id);
                    }
                }
                break;
            }
        }

        // Обрабатываем задачи в топологическом порядке для правильного планирования ресурсов,
        // но сохраняем результаты в Map для последующего добавления в исходном порядке
        const processedTasks = new Map<ID, TaskRow>();
        
        for (const task of taskOrder) {
            const processedTask = computeAutoForTask(task);
            processedTasks.set(processedTask.id, processedTask);
            
            // После обработки задачи очищаем предварительные оценки
            // Теперь у нас есть фактический результат
            if (processedTask.endWeek !== null) {
                estimateCache.delete(processedTask.id);
                blockerCache.set(processedTask.id, processedTask.endWeek);
            }
        }

        // Добавляем задачи в исходном порядке, используя обработанные версии
        // Это предотвращает "телепортацию" задач при назначении блокеров
        for (const task of tasks) {
            const processedTask = processedTasks.get(task.id);
            if (processedTask) {
                out.push(processedTask);
            }
        }

        const resLoad: Record<ID, number[]> = Object.fromEntries(
            resources.map(rs => [rs.res.id, rs.load.slice()])
        );
        return { rows: out, resLoad };
    }

    const computed = useMemo(() => computeAllRowsLocal(rows), [rows, sprints]);
    const computedRows = computed.rows;

    // Store computedRows in ref for use in prepareDataForSave
    const computedRowsRef = useRef<Row[]>([]);
    const prevComputedRowsRef = useRef<Row[]>([]);
    
    // Отслеживаем изменения weeks[] для задач с autoPlanEnabled после пересчета
    useEffect(() => {
        if (!changeTracker) return;
        
        const prevComputed = prevComputedRowsRef.current;
        const currentComputed = computedRows;
        
        // Проверяем изменения weeks[] только для задач с autoPlanEnabled
        currentComputed.forEach(currentRow => {
            if (currentRow.kind !== 'task') return;
            
            const currentTask = currentRow as TaskRow;
            if (!currentTask.autoPlanEnabled) return;
            
            // Находим предыдущую версию задачи
            const prevTask = prevComputed.find(r => r.kind === 'task' && r.id === currentTask.id) as TaskRow | undefined;
            if (!prevTask) return; // Новая задача, пропускаем
            
            // Сравниваем weeks[] массивы
            const prevWeeks = prevTask.weeks || [];
            const currentWeeks = currentTask.weeks || [];
            
            // Проверяем, изменились ли weeks
            const weeksChanged = prevWeeks.length !== currentWeeks.length ||
                prevWeeks.some((val, idx) => val !== currentWeeks[idx]);
            
            if (weeksChanged) {
                // Добавляем изменение в changeTracker
                changeTracker.addCellChange('task', currentTask.id, 'weeks', prevWeeks, currentWeeks);
            }
        });
        
        // Сохраняем текущее состояние для следующего сравнения
        prevComputedRowsRef.current = currentComputed;
    }, [computedRows, changeTracker]);
    
    computedRowsRef.current = computedRows;

    // ====== Фильтрация ======
    const {
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
    } = useRoadmapFilters(computedRows);

    // ====== Выделение/редактирование ======
    // ====== Selection hook ======
    const {
        sel, setSel,
        editing,
        cancelEditRef,
        sprintSel, setSprintSel,
        sprintEditing,
        cancelSprintEditRef,
        teamSel, setTeamSel,
        teamEditing,
        cancelTeamEditRef,
        isSel,
        isSelWeek,
        isEditableColumn,
        startEdit,
        stopEdit,
        commitEdit,
        startSprintEdit,
        stopSprintEdit,
        commitSprintEdit,
        startTeamEdit,
        stopTeamEdit,
        commitTeamEdit,
    } = useSelection();

    // ====== Стрелки блокеров ======
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const tableContainerRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            setContainerEl(node);
        }
    }, []);

    // ====== Высота заголовка таблицы для правильного позиционирования ресурсов ======
    const theadRef = useRef<HTMLTableSectionElement | null>(null);
    const [theadHeight, setTheadHeight] = useState<number>(48); // начальное значение по умолчанию

    // Измеряем высоту заголовка таблицы
    useLayoutEffect(() => {
        const measureTheadHeight = () => {
            if (theadRef.current) {
                const height = theadRef.current.getBoundingClientRect().height;
                setTheadHeight(height);
            }
        };

        // Измеряем при монтировании
        measureTheadHeight();
        
        // Повторное измерение через requestAnimationFrame для корректного измерения после рендеринга
        requestAnimationFrame(() => {
            measureTheadHeight();
            // Ещё одно измерение после следующего кадра для надёжности
            requestAnimationFrame(measureTheadHeight);
        });
        
        const resizeObserver = new ResizeObserver(measureTheadHeight);
        if (theadRef.current) {
            resizeObserver.observe(theadRef.current);
        }

        window.addEventListener('resize', measureTheadHeight);
        
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', measureTheadHeight);
        };
    }, []);

    // Дополнительное измерение при изменении данных, которые влияют на высоту заголовка
    useEffect(() => {
        if (theadRef.current) {
            const height = theadRef.current.getBoundingClientRect().height;
            setTheadHeight(height);
        }
    }, [columnWidths]);


    // Порядок колонок для стрелок
    const columnOrder = useMemo<(ColKey)[]>(() => {
        const base: (ColKey)[] = ["type","status","sprintsAuto","epic","task","team","fn","empl","planEmpl","planWeeks","autoplan"];
        const weeks: (ColKey)[] = range(totalWeeks).map(i => ({ week: i }));
        return [...base, ...weeks];
    }, []);

    // ====== Keyboard navigation hook ======
    const {
        focusNextRight,
        focusPrevLeft,
        navigateInEditMode,
        navigateSprintInEditMode,
        navigateTeamInEditMode,
    } = useKeyboardNavigation({
        sel, setSel, editing, cancelEditRef,
        sprintSel, setSprintSel, sprintEditing, cancelSprintEditRef, sprints,
        teamSel, setTeamSel, teamEditing, cancelTeamEditRef, teamData,
        computedRows, filteredRows, containerEl, columnOrder, tab,
        isEditableColumn, startEdit, stopEdit, commitEdit,
        startSprintEdit, stopSprintEdit, commitSprintEdit,
        startTeamEdit, stopTeamEdit, commitTeamEdit,
        toggleAutoPlan, weeksBaseForTaskLocal, weeksArraysEqual, setRows, changeTracker
    });

    // ====== Drag and drop hook ======
    const {
        dragTooltip,
        isShiftPressedRef,
        markDragAllowed,
        clearDragAllowed,
        getCellBorderClass,
        getCellBorderStyleForDrag,
        getWeekColumnHighlightStyle,
        handleRemoveBlocker,
        onMouseDownRow,
        onTaskMouseDown,
        onTaskMouseUp,
    } = useDragAndDrop({
        rows,
        setRows,
        changeTracker,
    });

    // Функция для форматирования даты в формат DD.MM.YYYY
    function formatDate(dateString: string): string {
        if (!dateString) return '';
        
        // Если дата уже в формате ISO с временем, используем её как есть
        // Если дата в формате YYYY-MM-DD, добавляем время
        const isoString = dateString.includes('T') ? dateString : dateString + 'T00:00:00Z';
        const date = new Date(isoString);
        
        if (isNaN(date.getTime())) {
            return '??.??.????';
        }
        
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }

    // ====== Функции управления спринтами ======
    // Вспомогательная функция для форматирования даты в YYYY-MM-DD (для API)
    function formatDateForSprintApi(date: Date): string {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }

    // Вспомогательная функция для создания дефолтных дат спринта
    function getDefaultSprintDates(): { start: string; end: string } {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 13); // 2 недели спринт
        return {
            start: formatDateForSprintApi(today),
            end: formatDateForSprintApi(endDate)
        };
    }

    function addSprint() {
        const { start, end } = getDefaultSprintDates();
        const newSprint: Sprint = {
            id: generateUUID(),
            code: `Q3S${sprints.length + 1}`,
            start,
            end
        };
        setSprints([...sprints, newSprint]);
        changeTracker.addRowChange('sprint', newSprint.id!, 'added', newSprint);
    }

    function addSprintAbove(index: number) {
        const { start, end } = getDefaultSprintDates();
        const newSprint: Sprint = {
            id: generateUUID(),
            code: `Q3S${sprints.length + 1}`,
            start,
            end
        };
        const newSprints = [...sprints];
        newSprints.splice(index, 0, newSprint);
        setSprints(newSprints);
        changeTracker.addRowChange('sprint', newSprint.id!, 'added', newSprint);
    }

    function addSprintBelow(index: number) {
        const { start, end } = getDefaultSprintDates();
        const newSprint: Sprint = {
            id: generateUUID(),
            code: `Q3S${sprints.length + 1}`,
            start,
            end
        };
        const newSprints = [...sprints];
        newSprints.splice(index + 1, 0, newSprint);
        setSprints(newSprints);
        changeTracker.addRowChange('sprint', newSprint.id!, 'added', newSprint);
    }

    function deleteSprint(index: number) {
        if (sprints.length > 1) {
            const sprintToDelete = sprints[index];
            const newSprints = sprints.filter((_, i) => i !== index);
            setSprints(newSprints);
            if (sprintToDelete.id) {
                changeTracker.addRowChange('sprint', sprintToDelete.id, 'deleted');
            }
        }
    }

    // Функция для обновления поля спринта с отслеживанием изменений
    function updateSprintField(index: number, field: 'code' | 'start' | 'end', newValue: string) {
        const sprint = sprints[index];
        const oldValue = sprint[field];

        if (oldValue === newValue) return;

        setSprints(sp => sp.map((x, idx) => idx === index ? {...x, [field]: newValue} : x));

        if (sprint.id) {
            changeTracker.addCellChange('sprint', sprint.id, field, oldValue, newValue);
        }
    }

    // ====== Функции управления командами ======
    function addTeam() {
        const newTeam: LocalTeamData = {
            id: generateUUID(),
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        setTeamData([...teamData, newTeam]);
        changeTracker.addRowChange('team', newTeam.id!, 'added', newTeam);
    }

    function addTeamAbove(index: number) {
        const newTeam: LocalTeamData = {
            id: generateUUID(),
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        const newTeams = [...teamData];
        newTeams.splice(index, 0, newTeam);
        setTeamData(newTeams);
        changeTracker.addRowChange('team', newTeam.id!, 'added', newTeam);
    }

    function addTeamBelow(index: number) {
        const newTeam: LocalTeamData = {
            id: generateUUID(),
            name: `Team ${teamData.length + 1}`,
            jiraProject: "",
            featureTeam: "",
            issueType: ""
        };
        const newTeams = [...teamData];
        newTeams.splice(index + 1, 0, newTeam);
        setTeamData(newTeams);
        changeTracker.addRowChange('team', newTeam.id!, 'added', newTeam);
    }

    function deleteTeam(index: number) {
        if (teamData.length > 1) {
            const teamToDelete = teamData[index];
            const newTeams = teamData.filter((_, i) => i !== index);
            setTeamData(newTeams);
            if (teamToDelete.id) {
                changeTracker.addRowChange('team', teamToDelete.id, 'deleted');
            }
        }
    }

    // Функция для обновления поля команды с отслеживанием изменений
    function updateTeamField(index: number, field: 'name' | 'jiraProject' | 'featureTeam' | 'issueType', newValue: string) {
        const team = teamData[index];
        const oldValue = team[field];

        if (oldValue === newValue) return;

        setTeamData(teams => teams.map((x, idx) => idx === index ? {...x, [field]: newValue} : x));

        if (team.id) {
            changeTracker.addCellChange('team', team.id, field, oldValue, newValue);
        }
    }

    // Функция для получения стиля границ ячейки спринта
    function getSprintCellBorderStyle(isSelected: boolean | null = false): React.CSSProperties {
        if (isSelected) {
            return {
                borderTop: '1px solid rgb(226, 232, 240)',
                borderRight: '1px solid rgb(226, 232, 240)',
                borderBottom: '1px solid rgb(226, 232, 240)',
                borderLeft: '1px solid rgb(226, 232, 240)',
                outline: '2px solid gray',
                outlineOffset: '-1px',
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
                borderTop: '1px solid rgb(226, 232, 240)',
                borderRight: '1px solid rgb(226, 232, 240)',
                borderBottom: '1px solid rgb(226, 232, 240)',
                borderLeft: '1px solid rgb(226, 232, 240)',
                outline: '2px solid gray',
                outlineOffset: '-1px',
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


    // Вспомогательная функция для получения стиля границ ячейки
    function getCellBorderStyle(isSelected: boolean | null = false): React.CSSProperties {
        if (isSelected) {
            return {
                borderTop: '1px solid rgb(226, 232, 240)',
                borderRight: '1px solid rgb(226, 232, 240)',
                borderBottom: '1px solid rgb(226, 232, 240)',
                borderLeft: '1px solid rgb(226, 232, 240)',
                outline: '2px solid gray',
                outlineOffset: '-1px'
            };
        }
        return {
            borderTop: '1px solid rgb(226, 232, 240)',
            borderRight: '1px solid rgb(226, 232, 240)',
            borderBottom: '1px solid rgb(226, 232, 240)',
            borderLeft: '1px solid rgb(226, 232, 240)'
        };
    }



    // ====== Фильтры ======

    // Управление overflow контейнера таблицы в зависимости от количества строк
    useEffect(() => {
        const updateOverflow = () => {
            if (containerEl) {
                const table = containerEl.querySelector('table');
                
                if (table) {
                    // Получаем доступное пространство от родительского контейнера
                    const parentContainer = containerEl.parentElement;
                    if (parentContainer) {
                        const parentRect = parentContainer.getBoundingClientRect();
                        const availableHeight = parentRect.height - 40; // 40px для отступов

                        const tableRect = table.getBoundingClientRect();
                        
                        // Если таблица помещается в доступное пространство, ограничиваем высоту
                        if (tableRect.height <= availableHeight) {
                            containerEl.style.overflowX = 'auto'; // Горизонтальная прокрутка всегда доступна
                            containerEl.style.overflowY = 'hidden'; // Вертикальная прокрутка отключена
                            containerEl.style.height = `${tableRect.height}px`; // Фиксируем высоту по содержимому
                            containerEl.style.maxHeight = 'none';
                        } else {
                            containerEl.style.overflowX = 'auto'; // Горизонтальная прокрутка всегда доступна
                            containerEl.style.overflowY = 'auto'; // Вертикальная прокрутка включена
                            containerEl.style.height = `${availableHeight}px`;
                            containerEl.style.maxHeight = `${availableHeight}px`;
                        }
                    }
                }
            }
        };

        // Выполняем с задержкой для корректного измерения после рендеринга
        const timeoutId = setTimeout(updateOverflow, 100);
        
        // Также обновляем при изменении размера окна
        window.addEventListener('resize', updateOverflow);
        
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updateOverflow);
        };
    }, [containerEl, theadHeight, filteredRows, tab]);

    // Сбрасываем позицию скролла только при изменении фильтров
    useEffect(() => {
        if (containerEl) {
            containerEl.scrollTop = 0;
        }
    }, [containerEl, filters]);

    const links = useMemo(() => {
        const tasks = filteredRows.filter(r => r.kind === "task") as TaskRow[];
        return buildLinks(tasks, totalWeeks);
    }, [filteredRows, totalWeeks]);

    // ====== Колоночные ширины и синхронизация горизонтального скролла ======
    const COL_WIDTH: Partial<Record<ColumnId, string>> = useMemo(() => {
        const widths = {
            type: `${columnWidths.type+45}px`,
            status: `${columnWidths.status+45}px`,
            sprintsAuto: `${columnWidths.sprintsAuto+45}px`,
            epic: `${columnWidths.epic+45}px`,
            task: `${columnWidths.task+45}px`,
            team: `${columnWidths.team+45}px`,
            fn: `${columnWidths.fn+45}px`,
            empl: `${columnWidths.empl+45}px`,
            planEmpl: `${columnWidths.planEmpl+45}px`,
            planWeeks: `${columnWidths.planWeeks+45}px`,
            autoplan: '60px', // Фиксированная ширина для autoplan
        };
        return widths;
    }, [columnWidths]);

    // Функция для получения ширины ячейки с учетом кнопок фильтрации
    const getCellWidth = (col: ColumnId) => {
        return COL_WIDTH[col] || "8rem";
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
        const cols = order.map((c) => {
            const width = COL_WIDTH[c] || "8rem";
            return (
                <col key={c} style={{ 
                    width: width,
                    minWidth: width,
                    maxWidth: width
                }} />
            );
        });
        return (
            <colgroup>
                {cols}
                <col key="timeline" />
            </colgroup>
        );
    }

    // ====== Ресайзинг колонок ======

    // ====== Автоплан: чекбокс + подтверждение ======
    function toggleAutoPlan(taskId: ID, next: boolean) {
        const t = computedRows.find(r => r.kind === "task" && r.id === taskId) as TaskRow | undefined;
        if (!t) return;

        if (changeTracker) {
            changeTracker.addCellChange('task', taskId, 'autoPlanEnabled', t.autoPlanEnabled, next);
        }

        if (next) {
            const hasExistingAllocation = Array.isArray(t.weeks) && t.weeks.some(value => value > 0);
            let requireConfirmation = false;

            if (hasExistingAllocation) {
                const tempTask: TaskRow = {
                    ...t,
                    autoPlanEnabled: true,
                    weeks: Array(totalWeeks).fill(0),
                    startWeek: null,
                    endWeek: null,
                    fact: 0
                };

                const tempRows = rows.map(r =>
                    (r.kind === "task" && r.id === taskId) ? tempTask : r
                );

                const tempComputed = computeAllRowsLocal(tempRows);
                const autoPlannedTask = tempComputed.rows.find(r => r.kind === "task" && r.id === taskId) as TaskRow | undefined;

                if (autoPlannedTask) {
                    const autoWeeks = autoPlannedTask.weeks.slice();
                    const plansIdentical = t.weeks.length === autoWeeks.length &&
                        t.weeks.every((val, index) => Math.abs(val - (autoWeeks[index] || 0)) < 0.001);
                    requireConfirmation = !plansIdentical;
                } else {
                    requireConfirmation = true;
                }
            }

            if (requireConfirmation) {
                const ok = confirm("Включить автоплан? Текущий план будет перезаписан.");
                if (!ok) return;

                const oldWeeks = t.weeks.slice();
                const newWeeks = Array(totalWeeks).fill(0);

                setRows(prev => prev.map(r =>
                    (r.kind === "task" && r.id === taskId)
                        ? { ...(r as TaskRow), autoPlanEnabled: true, weeks: Array(totalWeeks).fill(0) }
                        : r
                ));

                if (changeTracker) {
                    changeTracker.addCellChange('task', taskId, 'autoPlanEnabled', t.autoPlanEnabled, true);
                    changeTracker.addCellChange('task', taskId, 'weeks', oldWeeks, newWeeks);
                }
            } else {
                // Планы идентичны, но всё равно очищаем weeks для включения автоплана
                const oldWeeks = t.weeks.slice();
                const newWeeks = Array(totalWeeks).fill(0);
                
                setRows(prev => prev.map(r =>
                    (r.kind === "task" && r.id === taskId)
                        ? { ...(r as TaskRow), autoPlanEnabled: true, weeks: newWeeks }
                        : r
                ));

                if (changeTracker) {
                    changeTracker.addCellChange('task', taskId, 'autoPlanEnabled', t.autoPlanEnabled, true);
                    changeTracker.addCellChange('task', taskId, 'weeks', oldWeeks, newWeeks);
                }
            }
        } else {
            setRows(prev => prev.map(r =>
                (r.kind === "task" && r.id === taskId)
                    ? { ...(r as TaskRow), autoPlanEnabled: false, weeks: t.weeks.slice() }
                    : r
            ));

            if (changeTracker) {
                changeTracker.addCellChange('task', taskId, 'autoPlanEnabled', t.autoPlanEnabled, false);
            }
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
    const paintRef = useRef<{ active:boolean; rowId:ID; originW:number; value:number; started:boolean; lastW:number; savedWeeks?: number[]; wasAutoPlan?: boolean } | null>(null);
    
    // Функция для заполнения всех ячеек между двумя позициями
    function fillWeeksBetween(weeks: number[], fromW: number, toW: number, value: number): number[] {
        // Расширяем массив до totalWeeks если он короче
        const result = weeks.slice();
        while (result.length < totalWeeks) {
            result.push(0);
        }
        
        const start = Math.min(fromW, toW);
        const end = Math.max(fromW, toW);
        
        for (let i = start; i <= end && i < totalWeeks; i++) {
            result[i] = value;
        }
        
        return result;
    }
    
    function onWeekCellMouseDown(_e: React.MouseEvent, r: Row, w: number) {
        // Одинарный клик только выделяет
        setSel({ rowId: r.id, col: { week: w } });

        // Готовим «мазок» со значением исходной ячейки
        if (r.kind === "task") {
            const t = r as TaskRow;
            const current = t.weeks[w] || 0; // используем прямое значение как для ресурсов
            // Сохраняем текущие недели (автозапланированные) и флаг автопланирования
            paintRef.current = { 
                active: true, 
                rowId: t.id, 
                originW: w, 
                value: current, 
                started: false, 
                lastW: w,
                savedWeeks: t.weeks.slice(), // Сохраняем текущие автозапланированные недели
                wasAutoPlan: t.autoPlanEnabled // Запоминаем, было ли автопланирование включено
            };
        } else {
            const rr = r as ResourceRow;
            const current = rr.weeks[w] || 0;
            paintRef.current = { active: true, rowId: rr.id, originW: w, value: current, started: false, lastW: w };
        }
    }
    function onWeekCellMouseEnter(_e: React.MouseEvent, r: Row, w: number) {
        const p = paintRef.current;
        if (!p || !p.active || r.id !== p.rowId) return;

        if (r.kind === "task") {
            if (!p.started && w !== p.originW) {
                p.started = true;
            }
            
            const fromW = p.lastW;
            
            setRows(prev => prev.map(x => {
                if (x.kind === "task" && x.id === r.id) {
                    const currentTask = x as TaskRow;
                    
                    // Всегда используем сохраненные недели, если они есть
                    // Это защищает от потери данных при пересчетах
                    const weeksToUse = p.savedWeeks ? p.savedWeeks : currentTask.weeks;
                    const originalWeeks = weeksToUse.slice();
                    
                    // Заполняем все ячейки между последней обработанной позицией и текущей
                    const base = fillWeeksBetween(weeksToUse, fromW, w, p.value);
                    
                    // Проверяем, изменилось ли значение
                    const hasChanged = !weeksArraysEqual(base, originalWeeks);

                    // Обновляем сохраненные недели для следующей итерации
                    if (hasChanged && p.savedWeeks) {
                        p.savedWeeks = base.slice();
                    }

                    // Регистрируем изменение в changeTracker
                    if (hasChanged && changeTracker) {
                        changeTracker.addCellChange('task', currentTask.id, 'weeks', originalWeeks, base);
                        // Если задача была с автопланированием, также регистрируем его отключение
                        if (currentTask.autoPlanEnabled) {
                            changeTracker.addCellChange('task', currentTask.id, 'autoPlanEnabled', true, false);
                        }
                    }

                    return {
                        ...currentTask,
                        weeks: base,
                        // Отключаем автоплан только если значение изменилось
                        ...(hasChanged ? { autoPlanEnabled: false } : {})
                    };
                }
                return x;
            }));
            
            // Обновляем последнюю обработанную позицию ПОСЛЕ обработки
            p.lastW = w;
        } else {
            if (!p.started && w !== p.originW) {
                p.started = true;
            }
            
            const fromW = p.lastW;
            
            setRows(prev => prev.map(x => {
                if (x.kind === "resource" && x.id === r.id) {
                    const currentResource = x as ResourceRow;
                    const originalWeeks = currentResource.weeks.slice();

                    // Заполняем все ячейки между последней обработанной позицией и текущей
                    const base = fillWeeksBetween(currentResource.weeks, fromW, w, p.value);

                    // Регистрируем изменение в changeTracker
                    const hasChanged = !weeksArraysEqual(base, originalWeeks);
                    if (hasChanged && changeTracker) {
                        changeTracker.addCellChange('resource', currentResource.id, 'weeks', originalWeeks, base);
                    }

                    return { ...currentResource, weeks: base };
                }
                return x;
            }));
            
            // Обновляем последнюю обработанную позицию ПОСЛЕ обработки
            p.lastW = w;
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
        if (cap === 0) return "#ffffff"; // белый фон для нулевых значений
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
    function updateTask<K extends keyof TaskRow>(id: ID, patch: Pick<TaskRow, K>) { 
        // Находим текущую задачу для записи изменений
        const currentTask = computedRows.find(r => r.kind === "task" && r.id === id) as TaskRow | undefined;
        
        // Расширяем patch с дополнительными полями для UUID-ов
        const extendedPatch: any = { ...patch };
        
        // Если обновляется team (имя), также обновляем teamId (UUID)
        if ('team' in patch && patch.team) {
            const found = teamData.find(t => t.name === patch.team);
            if (found?.id) {
                extendedPatch.teamId = found.id;
            }
        }
        
        // Записываем изменения в лог
        if (changeTracker && currentTask) {
            Object.entries(extendedPatch).forEach(([key, value]) => {
                const oldValue = (currentTask as any)[key];
                if (oldValue !== value) {
                    changeTracker.addCellChange('task', id, key, oldValue, value);
                }
            });
        }
        
        setRows(prev => {
            const newRows = prev.map(r => (r.kind === "task" && r.id === id) ? { ...r, ...extendedPatch } : r);
            return newRows;
        });
    }
    function updateResource<K extends keyof ResourceRow>(id: ID, patch: Pick<ResourceRow, K>) { 
        // Находим текущий ресурс для записи изменений
        const currentResource = computedRows.find(r => r.kind === "resource" && r.id === id) as ResourceRow | undefined;
        
        // Расширяем patch с дополнительными полями для UUID-ов
        const extendedPatch: any = { ...patch };
        
        // Если обновляется team (массив имен), также обновляем teamIds (массив UUID)
        if ('team' in patch && patch.team) {
            const teamArray = patch.team as string[];
            const teamUUIDs = teamArray.map(teamName => {
                const found = teamData.find(t => t.name === teamName);
                return found?.id;
            }).filter(Boolean) as string[];
            extendedPatch.teamIds = teamUUIDs;
        }
        
        
        // Записываем изменения в лог
        if (changeTracker && currentResource) {
            Object.entries(extendedPatch).forEach(([key, value]) => {
                const oldValue = (currentResource as any)[key];
                if (oldValue !== value) {
                    changeTracker.addCellChange('resource', id, key, oldValue, value);
                }
            });
        }
        
        setRows(prev => {
            const newRows = prev.map(r => (r.kind === "resource" && r.id === id) ? { ...r, ...extendedPatch } : r);
            return newRows;
        });
    }

    function splitRows(list: Row[]) { const resources = list.filter(r => r.kind === "resource"); const tasks = list.filter(r => r.kind === "task"); return { resources, tasks }; }
    
    // Функция для извлечения значений по умолчанию из активных фильтров
    // Возвращает первое выбранное значение для каждого отфильтрованного поля
    
    function newResource(): ResourceRow {
        const defaults = getFilterDefaults();
        
        // Для ресурсов team - это массив, поэтому обрабатываем особым образом
        const teamValue = defaults.team ? [defaults.team] : [];
        
        // Получаем UUID команд
        const teamUUIDs = teamValue.map(teamName => {
            const found = teamData.find(t => t.name === teamName);
            return found?.id;
        }).filter(Boolean) as string[];
        
        return { 
            id: generateUUID(), 
            kind: "resource", 
            team: teamValue,
            teamIds: teamUUIDs,
            fn: (defaults.fn || "") as Fn,
            weeks: Array(totalWeeks).fill(0) 
        };
    }
    
    function newTask(): TaskRow {
        const defaults = getFilterDefaults();
        
        // Получаем UUID команды
        let teamId: string | undefined;
        let teamName = defaults.team || "";
        
        if (defaults.team) {
            const found = teamData.find(t => t.name === defaults.team);
            if (found?.id) {
                teamId = found.id;
            }
        } else if (defaults.fn) {
            // Если команда не указана в фильтре, но указана функция,
            // берем команду из первого ресурса с этой функцией
            const resourceWithFn = computedRows.find(
                r => r.kind === "resource" && r.fn === defaults.fn && r.team && r.team.length > 0
            ) as ResourceRow | undefined;
            
            if (resourceWithFn && resourceWithFn.team && resourceWithFn.team.length > 0) {
                teamName = resourceWithFn.team[0];
                const found = teamData.find(t => t.name === teamName);
                if (found?.id) {
                    teamId = found.id;
                }
            }
        }
        
        return {
            id: generateUUID(),
            kind: "task",
            status: (defaults.status || "Todo") as Status,
            sprintsAuto: [],
            epic: defaults.epic || "",
            task: "",
            team: teamName,
            teamId: teamId,
            fn: (defaults.fn || "") as Fn,
            planEmpl: 0,
            planWeeks: 0,
            blockerIds: [],
            weekBlockers: [],
            fact: 0,
            startWeek: null,
            endWeek: null,
            expectedStartWeek: null,
            autoPlanEnabled: true,
            weeks: Array(totalWeeks).fill(0)
        };
    }

    // ====== Локальное состояние меню добавления ======
    const [addMenuOpen, setAddMenuOpen] = useState<boolean>(false);
    
    // Функция для конвертации ResourceRow в формат API
    function resourceRowToApi(row: ResourceRow) {
        return {
            id: row.id,
            teamIds: row.teamIds || [],
            functionId: row.functionId,
            employeeId: row.employeeId,
            weeks: row.weeks,
            prevId: row.prevId,
            nextId: row.nextId
        };
    }
    
    // Функция для конвертации TaskRow в формат API
    function taskRowToApi(row: TaskRow) {
        return {
            id: row.id,
            status: row.status,
            sprintsAuto: row.sprintsAuto,
            epic: row.epic,
            task: row.task,
            teamId: row.teamId,
            functionId: row.functionId,
            employeeId: row.employeeId,
            planEmpl: row.planEmpl,
            planWeeks: row.planWeeks,
            blockerIds: row.blockerIds,
            weekBlockers: row.weekBlockers,
            fact: row.fact,
            startWeek: row.startWeek,
            endWeek: row.endWeek,
            expectedStartWeek: row.expectedStartWeek,
            autoPlanEnabled: row.autoPlanEnabled,
            weeks: row.weeks,
            prevId: row.prevId,
            nextId: row.nextId
        };
    }
    
    function addResourceBottom() { 
        const newRes = newResource();
        setRows(prev => { 
            const split = splitRows(prev); 
            return [...split.resources, newRes, ...split.tasks]; 
        }); 
        setAddMenuOpen(false);
        // Регистрируем добавление в changeTracker
        if (changeTracker) {
            changeTracker.addRowChange('resource', newRes.id, 'added', resourceRowToApi(newRes));
        }
    }
    
    function addTaskBottom() { 
        const newT = newTask();
        setRows(prev => { 
            const split = splitRows(prev); 
            return [...split.resources, ...split.tasks, newT]; 
        }); 
        setAddMenuOpen(false);
        // Регистрируем добавление в changeTracker
        if (changeTracker) {
            changeTracker.addRowChange('task', newT.id, 'added', taskRowToApi(newT));
        }
    }

    // ===== Контекстные действия над строками (реализация) =====
    function duplicateRow(rowId: ID) {
        const sourceRow = computedRows.find(r => r.id === rowId);
        if (!sourceRow) return;
        
        const copy: Row = sourceRow.kind === 'task'
            ? { ...(sourceRow as TaskRow), id: generateUUID(), blockerIds: [...(sourceRow as TaskRow).blockerIds], weekBlockers: [...(sourceRow as TaskRow).weekBlockers], expectedStartWeek: (sourceRow as TaskRow).expectedStartWeek }
            : { ...(sourceRow as ResourceRow), id: generateUUID(), weeks: [...(sourceRow as ResourceRow).weeks] };
        
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next.splice(idx + 1, 0, copy);
            return next;
        });
        
        // Регистрируем добавление в changeTracker
        if (changeTracker) {
            if (copy.kind === 'resource') {
                changeTracker.addRowChange('resource', copy.id, 'added', resourceRowToApi(copy as ResourceRow));
            } else {
                changeTracker.addRowChange('task', copy.id, 'added', taskRowToApi(copy as TaskRow));
            }
        }
        setCtx(null);
    }
    function deleteRow(rowId: ID) {
        // Находим строку для регистрации удаления
        const row = computedRows.find(r => r.id === rowId);
        if (row && changeTracker) {
            const entityType = row.kind === 'resource' ? 'resource' : 'task';
            changeTracker.addRowChange(entityType, rowId, 'deleted');
        }
        setRows(prev => prev.filter(r => r.id !== rowId));
        setCtx(null);
    }
    function addRowAbove(rowId: ID) {
        const referenceRow = computedRows.find(r => r.id === rowId);
        if (!referenceRow) return;
        
        const insert = referenceRow.kind === 'task' ? newTask() : newResource();
        
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next.splice(idx, 0, insert);
            return next;
        });
        
        // Регистрируем добавление в changeTracker
        if (changeTracker) {
            if (insert.kind === 'resource') {
                changeTracker.addRowChange('resource', insert.id, 'added', resourceRowToApi(insert as ResourceRow));
            } else {
                changeTracker.addRowChange('task', insert.id, 'added', taskRowToApi(insert as TaskRow));
            }
        }
        setCtx(null);
    }
    function addRowBelow(rowId: ID) {
        const referenceRow = computedRows.find(r => r.id === rowId);
        if (!referenceRow) return;
        
        const insert = referenceRow.kind === 'task' ? newTask() : newResource();
        
        setRows(prev => {
            const idx = prev.findIndex(r => r.id === rowId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next.splice(idx + 1, 0, insert);
            return next;
        });
        
        // Регистрируем добавление в changeTracker
        if (changeTracker) {
            if (insert.kind === 'resource') {
                changeTracker.addRowChange('resource', insert.id, 'added', resourceRowToApi(insert as ResourceRow));
            } else {
                changeTracker.addRowChange('task', insert.id, 'added', taskRowToApi(insert as TaskRow));
            }
        }
        setCtx(null);
    }

    // ====== UI ======
    
    // Отображение состояния загрузки
    if (loading) {
        return (
            <div className="p-4 flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg">Загрузка данных...</div>
                </div>
            </div>
        );
    }
    
    // Отображение ошибки
    if (error) {
        return (
            <div className="p-4 flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg text-red-600 mb-4">Ошибка загрузки данных</div>
                    <div className="text-sm text-gray-600">{error}</div>
                </div>
            </div>
        );
    }

    // Проверка наличия данных о спринтах
    if (sprints.length === 0) {
        return (
            <div className="p-4 flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg">Нет данных о спринтах</div>
                </div>
            </div>
        );
    }

    // Проверка, что WEEK0 определен
    if (!WEEK0 || WEEK0 === "Invalid Date") {
        return (
            <div className="p-4 flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg">Ошибка загрузки дат спринтов</div>
                    <div className="text-sm text-gray-600">WEEK0: {WEEK0}</div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-screen flex flex-col">
            {/* Tab navigation на всю ширину экрана */}
            <div className="w-full bg-white px-4 py-3">
                <div className="container mx-auto flex gap-2 items-center justify-between" data-testid="tab-navigation">
                    <div className="flex gap-2">
                        <button className={`px-3 py-1 rounded border`} style={tab==='plan' ? {backgroundColor: '#d1d5db', color: 'black', marginRight: '0.5em'} : {backgroundColor: '#f3f4f6', marginRight: '0.5em'}} onClick={()=>setTab('plan')} data-testid="tab-plan">План</button>
                        <button className={`px-3 py-1 rounded border`} style={tab==='sprints' ? {backgroundColor: '#d1d5db', color: 'black', marginRight: '0.5em'} : {backgroundColor: '#f3f4f6', marginRight: '0.5em'}} onClick={()=>setTab('sprints')} data-testid="tab-sprints">Спринты</button>
                        <button className={`px-3 py-1 rounded border`} style={tab==='teams' ? {backgroundColor: '#d1d5db', color: 'black'} : {backgroundColor: '#f3f4f6'}} onClick={()=>setTab('teams')} data-testid="tab-teams">Команды</button>
                    </div>
                    {autoSaveState && (
                        <div data-testid="save-status-bar">
                            <SaveStatus 
                                state={autoSaveState} 
                                onForceSave={autoSaveState.forceSave}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Основной контент в контейнере */}
            <div className="flex-grow p-4 w-full overflow-visible" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
    
            {tab === 'plan' ? (
                <>
                <div ref={tableContainerRef} className="border rounded-xl" style={{ position: "relative", width: "100%", height: "auto" }} data-testid="roadmap-table-container">
                    <table 
                        key={JSON.stringify(columnWidths)} 
                        className="text-sm select-none"
                        data-testid="roadmap-table" 
                        style={{ 
                            border: '1px solid rgb(226, 232, 240)',
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            tableLayout: 'fixed',
                            width: '100%',
                            height: 'auto'
                        }}
                    >
                        {renderColGroup()}
                        <thead ref={theadRef} style={{ 
                            position: 'sticky',
                            top: 0,
                            zIndex: 8, // Общий z-index для шапки и ресурсов
                            backgroundColor: '#f3f4f6'
                        }}>
                        <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                            {renderHeadWithFilter("Тип", "type", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            {renderHeadWithFilter("Status", "status", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            <th 
                                className="px-2 py-2 text-center align-middle" 
                                style={{ 
                                    width: getCellWidth("sprintsAuto"),
                                    minWidth: getCellWidth("sprintsAuto"),
                                    maxWidth: getCellWidth("sprintsAuto"),
                                    border: '1px solid rgb(226, 232, 240)', 
                                    paddingRight: '0.5em', 
                                    paddingLeft: '0.5em', 
                                    position: 'relative',
                                    borderLeft: '1px solid rgb(226, 232, 240)',
                                    ...getFrozenColumnStyle('sprintsAuto', columnWidths),
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span>Sprints</span>
                                    <button 
                                        className={isFilterActive('sprintsAuto') ? "text-xs rounded" : "text-xs text-gray-500"} 
                                        style={isFilterActive('sprintsAuto') 
                                            ? { padding: '1px 2px', backgroundColor: '#166534', color: '#ffffff' }
                                            : { padding: '1px 2px', backgroundColor: '#d1d5db' }
                                        }
                                        title={isFilterActive('sprintsAuto') ? "Фильтр применен" : "Открыть фильтр"}
                                        onClick={(e)=>openFilter('sprintsAuto', (e.currentTarget as HTMLElement).getBoundingClientRect().left, (e.currentTarget as HTMLElement).getBoundingClientRect().bottom+4)}
                                    >
                                        ▾
                                    </button>
                                </div>
                                {/* Ресайзер */}
                                <div
                                    className="absolute inset-y-0 right-0 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors opacity-0 hover:opacity-100"
                                    style={{
                                        zIndex: 20,
                                        right: '-3px',
                                        top: '0',
                                        bottom: '0',
                                        width: '6px',
                                        pointerEvents: 'auto'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleResizeStart('sprintsAuto', e);
                                    }}
                                    onMouseEnter={() => {
                                        document.body.style.cursor = 'col-resize';
                                    }}
                                    onMouseLeave={() => {
                                        document.body.style.cursor = '';
                                    }}
                                    title="Перетащите для изменения ширины колонки"
                                />
                            </th>
                            {renderHeadWithFilter("Epic", "epic", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            <th 
                                className="px-2 py-2 text-center align-middle" 
                                style={{ 
                                    width: getCellWidth("task"),
                                    minWidth: getCellWidth("task"),
                                    maxWidth: getCellWidth("task"),
                                    border: '1px solid rgb(226, 232, 240)', 
                                    paddingRight: '0.5em', 
                                    paddingLeft: '0.5em', 
                                    position: 'relative',
                                    ...getFrozenColumnStyle('task', columnWidths),
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span>Task</span>
                                    <button 
                                        className={isFilterActive('task') ? "text-xs rounded" : "text-xs text-gray-500"} 
                                        style={isFilterActive('task') 
                                            ? { padding: '1px 2px', backgroundColor: '#166534', color: '#ffffff' }
                                            : { padding: '1px 2px', backgroundColor: '#d1d5db' }
                                        }
                                        title={isFilterActive('task') ? "Фильтр применен" : "Открыть фильтр"}
                                        onClick={(e)=>openFilter('task', (e.currentTarget as HTMLElement).getBoundingClientRect().left, (e.currentTarget as HTMLElement).getBoundingClientRect().bottom+4)}
                                    >
                                        ▾
                                    </button>
                                </div>
                                {/* Ресайзер */}
                                <div
                                    className="absolute inset-y-0 right-0 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors opacity-0 hover:opacity-100"
                                    style={{
                                        zIndex: 20,
                                        right: '-3px',
                                        top: '0',
                                        bottom: '0',
                                        width: '6px',
                                        pointerEvents: 'auto'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleResizeStart('task', e);
                                    }}
                                    onMouseEnter={() => {
                                        document.body.style.cursor = 'col-resize';
                                    }}
                                    onMouseLeave={() => {
                                        document.body.style.cursor = '';
                                    }}
                                    title="Перетащите для изменения ширины колонки"
                                />
                            </th>
                            {renderHeadWithFilter("Team", "team", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            {renderHeadWithFilter("Fn", "fn", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            {renderHeadWithFilter("Empl", "empl", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            {renderHeadWithFilter("Plan empl", "planEmpl", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            {renderHeadWithFilter("Plan weeks", "planWeeks", filters, isFilterActive, openFilter, handleResizeStart, columnWidths)}
                            <th 
                                className="px-2 py-2 text-center align-middle" 
                                style={{ 
                                    width: '50px',
                                    minWidth: '50px',
                                    maxWidth: '50px',
                                    border: '1px solid rgb(226, 232, 240)', 
                                    paddingRight: '0.5em', 
                                    paddingLeft: '0.5em',
                                    ...getFrozenColumnStyle('autoplan', columnWidths),
                                    backgroundColor: '#f3f4f6'
                                }}
                            >
                                <span>Auto</span>
                            </th>
                            {/* Заголовки для недель */}
                            {range(totalWeeks).map(w => { 
                                const h = weekHeaderLabelLocal(w); 
                                return (
                                <th key={w} className="px-2 py-2 text-center whitespace-nowrap align-middle" style={{width: '3.5rem', border: '1px solid rgb(226, 232, 240)' }}>
                                    <div className="text-xs font-semibold">#{h.num}</div>
                                    <div className="text-[10px] text-gray-500">{h.sprint || ""}</div>
                                    <div className="text-[10px] text-gray-400">с {h.from || "??.??.????"}</div>
                                </th>
                            ); })}
                        </tr>
                        </thead>
                        {/* Закрепленная область для ресурсных строк */}
                        <tbody className="sticky bg-gray-50" style={{ 
                            position: 'sticky',
                            top: `${theadHeight}px`, // Динамически вычисленная высота шапки
                            zIndex: 8, // Выше задач, но ниже шапки
                            backgroundColor: '#f3f4f6' 
                        }}>
                        {/* Ресурсы */}
                        {filteredRows.filter(r => r.kind === "resource").map(r => (
                            <tr key={r.id}
                                className={"border-b bg-white"}
                                style={{ height: '24px' }}
                                data-row-id={r.id}
                                data-row-kind="resource"
                                data-testid={`resource`}
                                onMouseDown={(e)=>onMouseDownRow(e,r)}
                                onContextMenu={(e)=>onContextMenuRow(e,r)}
                            >
                                {/* Тип */}
                                <td className={`px-2 py-1 align-middle draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'type')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('type', columnWidths)}} onMouseDown={markDragAllowed}>
                                    <div className="w-full overflow-hidden" title="Ресурс">
                                        <span className="block truncate">Ресурс</span>
                                    </div>
                                </td>

                                {/* Объединенная ячейка для Status/Sprints/Epic/Task (не используется для ресурсов) */}
                                <td className={`px-2 py-1 align-middle text-center text-gray-400 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'status')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('status', columnWidths)}} onMouseDown={markDragAllowed}
                                    colSpan={4}
                                >—</td>

                                {/* Team */}
                                <td className={`px-2 py-1 align-middle draggable-cell`} style={{ borderLeft: '1px solid rgb(226, 232, 240)', ...getCellBorderStyle(isSel(r.id,'team')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('team', columnWidths) }} onMouseDown={markDragAllowed} onDoubleClick={()=>{
                                    startEdit({rowId:r.id,col:"team"});
                                }} onClick={()=>{
                                    setSel({rowId:r.id,col:"team"});
                                }} data-testid={`team-cell-${r.id}`}>
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
                                ) : (
                                    <div className="w-full overflow-hidden" title={(r as ResourceRow).team.join(', ')}>
                                        <span className="block truncate">{(r as ResourceRow).team.join(', ')}</span>
                                    </div>
                                )}
                                </td>

                                {/* Fn */}
                                <td className={`px-2 py-1 align-middle text-center draggable-cell`} style={{ ...getCellBorderStyle(isSel(r.id,'fn')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('fn', columnWidths), backgroundColor: getBg(teamFnColors[teamKeyFromResource(r as ResourceRow)]), color: getText(teamFnColors[teamKeyFromResource(r as ResourceRow)]) }} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"fn"})} onClick={()=>setSel({rowId:r.id,col:"fn"})} onContextMenu={(e)=>onContextMenuCellColor(e, r as ResourceRow, 'fn', 'resource')} data-testid={`fn-cell-${r.id}`}>
                                    {editing?.rowId===r.id && editing?.col==="fn" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={r.fn} data-testid={`resource-input-${r.id}`}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('prev', r.id, 'fn'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); navigateInEditMode('next', r.id, 'fn'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateResource(r.id,{fn:(e.target as HTMLInputElement).value as Fn}); } stopEdit(); }} />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={r.fn}>
                                            <span className="block truncate">{r.fn}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Empl */}
                                <td className={`px-2 py-1 align-middle text-center draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'empl')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('empl', columnWidths)}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"empl"})} onClick={()=>setSel({rowId:r.id,col:"empl"})}>
                                    {editing?.rowId===r.id && editing?.col==="empl" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as ResourceRow).empl || ""}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('prev', r.id, 'empl'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); navigateInEditMode('next', r.id, 'empl'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateResource(r.id,{empl:(e.target as HTMLInputElement).value || undefined}); } stopEdit(); }} />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={(r as ResourceRow).empl || ''}>
                                            <span className="block truncate">{(r as ResourceRow).empl || ''}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Объединенная ячейка для Plan empl/Plan weeks/Auto (не используется для ресурсов) */}
                                <td className={`px-2 py-1 align-middle text-center text-gray-400 draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planEmpl')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('planEmpl', columnWidths)}} onMouseDown={markDragAllowed}
                                    colSpan={3}
                                >—</td>

                                {/* Таймлайн недель ресурса */}
                                {range(totalWeeks).map(w => (
                                    <td key={w} data-week-idx={w} data-testid={`week-${w + 1}`} className={`px-0 py-0 align-middle week-cell`} style={{width: '3.5rem', background: resourceCellBg(r as ResourceRow, w), ...getCellBorderStyle(isSelWeek(r.id,w)), ...getCellBorderStyleForDrag(r.id), ...getWeekColumnHighlightStyle(w)}}>
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
                                                            const oldWeeks = (r as ResourceRow).weeks.slice();
                                                            const newWeeks = (r as ResourceRow).weeks.map((vv,i)=> i===w? val: vv);

                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: newWeeks}
                                                                    : x
                                                            ));

                                                            // Регистрируем изменение в changeTracker
                                                            if (changeTracker && !weeksArraysEqual(oldWeeks, newWeeks)) {
                                                                changeTracker.addCellChange('resource', r.id, 'weeks', oldWeeks, newWeeks);
                                                            }

                                                            commitEdit();
                                                        }
                                                        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitEdit(); if (sel) focusPrevLeft(sel.rowId, sel.col); return; }
                                                        if(e.key==='Tab'){
                                                            e.preventDefault();
                                                            const val = clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,99);
                                                            const oldWeeks = (r as ResourceRow).weeks.slice();
                                                            const newWeeks = (r as ResourceRow).weeks.map((vv,i)=> i===w? val: vv);

                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: newWeeks}
                                                                    : x
                                                            ));

                                                            // Регистрируем изменение в changeTracker
                                                            if (changeTracker && !weeksArraysEqual(oldWeeks, newWeeks)) {
                                                                changeTracker.addCellChange('resource', r.id, 'weeks', oldWeeks, newWeeks);
                                                            }

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
                                                            const oldWeeks = (r as ResourceRow).weeks.slice();
                                                            const newWeeks = (r as ResourceRow).weeks.map((vv,i)=> i===w? val: vv);

                                                            setRows(prev=>prev.map(x =>
                                                                (x.kind==='resource' && x.id===r.id)
                                                                    ? { ...(x as ResourceRow), weeks: newWeeks}
                                                                    : x
                                                            ));

                                                            // Регистрируем изменение в changeTracker
                                                            if (changeTracker && !weeksArraysEqual(oldWeeks, newWeeks)) {
                                                                changeTracker.addCellChange('resource', r.id, 'weeks', oldWeeks, newWeeks);
                                                            }
                                                        }
                                                        stopEdit();
                                                    }}
                                                />
                                            ) : (
                                                <span style={{display: 'inline-block', minWidth: '2em', textAlign: 'center'}}>{(r as ResourceRow).weeks[w] || "\u00A0"}</span>
                                            )}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                        
                        {/* Обычная область для задач */}
                        <tbody className="divide-y divide-gray-200" style={{ 
                            position: 'relative',
                            backgroundColor: 'white'
                        }}>
                        {/* Задачи */}
                        {filteredRows.filter(r => r.kind === "task").map(r => {
                            const task = r as TaskRow;
                            const hasMismatch = hasExpectedStartWeekMismatch(task);
                            
                            
                            return (
                            <tr key={r.id}
                                className={`border-b ${hasMismatch ? 'bg-red-100' : 'bg-white'}`}
                                style={{
                                    height: '24px',
                                    position: 'relative',
                                    ...(hasMismatch ? { backgroundColor: '#fee2e2' } : {})
                                }}
                                data-row-id={r.id}
                                data-row-kind="task"
                                data-testid={`task`}
                                onMouseDown={(e)=>{
                                    if (r.kind==='task') onTaskMouseDown(e, r as TaskRow);
                                    onMouseDownRow(e, r);
                                }}
                                onMouseUp={(e)=>{ if (r.kind==='task') onTaskMouseUp(e, r as TaskRow); clearDragAllowed(); }}
                                onContextMenu={(e)=>onContextMenuRow(e,r)}
                            >
                                {/* Тип */}
                                <td className={`px-2 py-1 align-middle ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'type')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('type', columnWidths, 'task')}} onMouseDown={markDragAllowed}>
                                    <div className="w-full overflow-hidden" title="Задача">
                                        <span className="block truncate">Задача</span>
                                    </div>
                                </td>

                                {/* Status */}
                                <td className={`px-2 py-1 align-middle text-center ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'status')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('status', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"status"})} onClick={()=>setSel({rowId:r.id,col:"status"})}>
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
                                <td className={`px-2 py-1 align-middle ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{width: getCellWidth("sprintsAuto"), minWidth: getCellWidth("sprintsAuto"), maxWidth: getCellWidth("sprintsAuto"), borderLeft: '1px solid rgb(226, 232, 240)', ...getCellBorderStyle(isSel(r.id,'sprintsAuto')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('sprintsAuto', columnWidths, 'task')}} onMouseDown={markDragAllowed}>
                                    <div className="w-full overflow-hidden" title={(r as TaskRow).sprintsAuto.join(", ")||""}>
                                        <span className="block truncate">{(r as TaskRow).sprintsAuto.join(", ")||""}</span>
                                    </div>
                                </td>

                                {/* Epic */}
                                <td className={`px-2 py-1 align-middle ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'epic')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('epic', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"epic"})} onClick={()=>setSel({rowId:r.id,col:"epic"})}>
                                    {editing?.rowId===r.id && editing?.col==="epic" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).epic||""}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); navigateInEditMode('prev', r.id, 'epic'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); navigateInEditMode('next', r.id, 'epic'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{epic:(e.target as HTMLInputElement).value}); } stopEdit(); }} />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={(r as TaskRow).epic||""}>
                                            <span className="block truncate">{(r as TaskRow).epic||""}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Task */}
                                <td className={`px-2 py-1 align-middle ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{width: getCellWidth("task"), minWidth: getCellWidth("task"), maxWidth: getCellWidth("task"), ...getCellBorderStyle(isSel(r.id,'task')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('task', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"task"})} onClick={()=>setSel({rowId:r.id,col:"task"})} data-testid={`task-cell-${r.id}`}>
                                    {editing?.rowId===r.id && editing?.col==="task" ? (
                                        <input autoFocus className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).task} data-testid={`task-input-${r.id}`}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{task:(e.target as HTMLInputElement).value}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{task:(e.target as HTMLInputElement).value}); navigateInEditMode('prev', r.id, 'task'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{task:(e.target as HTMLInputElement).value}); navigateInEditMode('next', r.id, 'task'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{task:(e.target as HTMLInputElement).value}); } stopEdit(); }} />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={(r as TaskRow).task}>
                                            <span className="block truncate">{(r as TaskRow).task}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Team */}
                                <td className={`px-2 py-1 align-middle ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'team')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('team', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>{
                                    startEdit({rowId:r.id,col:"team"});
                                }} onClick={()=>{
                                    setSel({rowId:r.id,col:"team"});
                                }} data-testid={`team-cell-${r.id}`}>
                                    {editing?.rowId===r.id && editing?.col==="team" ? (
                                        <div className="w-full h-full">
                                            <Select
                                                options={teamNames}
                                                selectedValue={r.team}
                                                onSelect={(selected) => {
                                                    const selectedTeam = teamData.find(t => t.name === selected);
                                                    updateTask(r.id, { team: selected, teamId: selectedTeam?.id });
                                                    stopEdit();
                                                }}
                                                onSaveValue={(selected) => {
                                                    const selectedTeam = teamData.find(t => t.name === selected);
                                                    updateTask(r.id, { team: selected, teamId: selectedTeam?.id });
                                                }}
                                                onTabNext={() => focusNextRight(r.id, 'team')}
                                                onTabPrev={() => focusPrevLeft(r.id, 'team')}
                                                onEscape={() => stopEdit()}
                                                placeholder="Выберите команду..."
                                                searchPlaceholder="Поиск команд..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full overflow-hidden" title={r.team}>
                                            <span className="block truncate">{r.team}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Fn */}
                                <td className={`px-2 py-1 align-middle text-center draggable-cell`} style={{ ...getCellBorderStyle(isSel(r.id,'fn')), ...getCellBorderStyleForDrag(r.id), ...getFrozenColumnStyle('fn', columnWidths, 'task'), backgroundColor: getBg(teamFnColors[teamKeyFromTask(r as TaskRow)]), color: getText(teamFnColors[teamKeyFromTask(r as TaskRow)]) }} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"fn"})} onClick={()=>setSel({rowId:r.id,col:"fn"})} onContextMenu={(e)=>onContextMenuCellColor(e, r as TaskRow, 'fn', 'task')} data-testid={`fn-cell-${r.id}`}>
                                    {editing?.rowId===r.id && editing?.col==="fn" ? (
                                        <Select
                                            options={getUniqueValues('fn', (r as TaskRow).team)}
                                            selectedValue={r.fn || ''}
                                            onSelect={(value) => { 
                                                updateTask(r.id, {fn: value as Fn}); 
                                                commitEdit(); 
                                            }}
                                            onSaveValue={(value) => { 
                                                updateTask(r.id, {fn: value as Fn}); 
                                            }}
                                            onTabNext={() => { updateTask(r.id, {fn: r.fn}); return navigateInEditMode('next', r.id, 'fn'); }}
                                            onTabPrev={() => { updateTask(r.id, {fn: r.fn}); return navigateInEditMode('prev', r.id, 'fn'); }}
                                            onEscape={() => { cancelEditRef.current=true; stopEdit(); }}
                                            placeholder="Выберите функцию"
                                            searchPlaceholder="Поиск функции..."
                                        />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={r.fn}>
                                            <span className="block truncate">{r.fn}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Empl */}
                                <td className={`px-2 py-1 align-middle text-center ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'empl')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('empl', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"empl"})} onClick={()=>setSel({rowId:r.id,col:"empl"})}>
                                    {editing?.rowId===r.id && editing?.col==="empl" ? (
                                        <Select
                                            options={getEmployeesForFunction((r as TaskRow).fn || '', (r as TaskRow).team)}
                                            selectedValue={(r as TaskRow).empl || ''}
                                            onSelect={(value) => {
                                                updateTask(r.id, {empl: value === '' ? '' : (value || undefined)});
                                                commitEdit();
                                            }}
                                            onSaveValue={(value) => {
                                                updateTask(r.id, {empl: value === '' ? '' : (value || undefined)});
                                            }}
                                            onTabNext={() => { updateTask(r.id, {empl: (r as TaskRow).empl}); return navigateInEditMode('next', r.id, 'empl'); }}
                                            onTabPrev={() => { updateTask(r.id, {empl: (r as TaskRow).empl}); return navigateInEditMode('prev', r.id, 'empl'); }}
                                            onEscape={() => { cancelEditRef.current=true; stopEdit(); }}
                                            placeholder="Выберите сотрудника"
                                            searchPlaceholder="Поиск сотрудника..."
                                            allowClear={true}
                                            clearLabel="Не важно"
                                        />
                                    ) : (
                                        <div className="w-full overflow-hidden" title={(r as TaskRow).empl || ''}>
                                            <span className="block truncate">{(r as TaskRow).empl || ''}</span>
                                        </div>
                                    )}
                                </td>

                                {/* Plan empl */}
                                <td data-testid={`planEmpl-cell-${r.id}`} className={`px-2 py-1 align-middle text-center ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planEmpl')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('planEmpl', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"planEmpl"})} onClick={()=>setSel({rowId:r.id,col:"planEmpl"})}>
                                    {editing?.rowId===r.id && editing?.col==="planEmpl" ? (
                                        <input data-testid={`planEmpl-input-${r.id}`} autoFocus type="number" className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).planEmpl}
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
                                <td data-testid={`planWeeks-cell-${r.id}`} className={`px-2 py-1 align-middle text-center ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'planWeeks')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('planWeeks', columnWidths, 'task')}} onMouseDown={markDragAllowed} onDoubleClick={()=>startEdit({rowId:r.id,col:"planWeeks"})} onClick={()=>setSel({rowId:r.id,col:"planWeeks"})}>
                                    {editing?.rowId===r.id && editing?.col==="planWeeks" ? (
                                        <input data-testid={`planWeeks-input-${r.id}`} autoFocus type="number" className="w-full h-full box-border min-w-0 outline-none bg-transparent" style={{ border: 'none', padding: 0, margin: 0 }} defaultValue={(r as TaskRow).planWeeks}
                                               onKeyDown={(e)=>{
                                                   if(e.key==='Enter'){ updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,totalWeeks)}); commitEdit(); }
                                                   if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,totalWeeks)}); navigateInEditMode('prev', r.id, 'planWeeks'); return; }
                                                   if(e.key==='Tab'){ e.preventDefault(); updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,totalWeeks)}); navigateInEditMode('next', r.id, 'planWeeks'); }
                                                   if(e.key==='Escape'){ cancelEditRef.current=true; stopEdit(); }
                                              }}
                                               onBlur={(e)=>{ if(!cancelEditRef.current){ updateTask(r.id,{planWeeks: clamp(parseInt((e.target as HTMLInputElement).value||"0"),0,totalWeeks)}); } stopEdit(); }} />
                                    ) : (<span>{(r as TaskRow).planWeeks}</span>)}
                                </td>

                    {/* Автоплан чекбокс */}
                    <td className={`px-2 py-1 align-middle text-center ${getCellBgClass(hasMismatch)} ${getCellBorderClass(r.id)} draggable-cell`} style={{...getCellBorderStyle(isSel(r.id,'autoplan')), ...getCellBorderStyleForDrag(r.id), ...getCellBgStyle(hasMismatch), ...getFrozenColumnStyle('autoplan', columnWidths, 'task')}} onMouseDown={markDragAllowed} onClick={()=>setSel({rowId:r.id,col:"autoplan"})}>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={(r as TaskRow).autoPlanEnabled} onChange={e=>toggleAutoPlan(r.id, e.currentTarget.checked)} 
                                   onKeyDown={(e)=>{
                                       if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); navigateInEditMode('prev', r.id, 'autoplan'); return; }
                                       if(e.key==='Tab'){ e.preventDefault(); navigateInEditMode('next', r.id, 'autoplan'); }
                                   }} />
                        </label>
                    </td>

                    {/* Таймлайн с горизонтальным скроллом */}
                    {range(totalWeeks).map(w => (
                        <td key={w} id={cellId(r.id, w)} data-row-id={r.id} data-week-idx={w} data-testid={`week-${w + 1}`} className={`px-0 py-0 align-middle ${getCellBorderClass(r.id)} week-cell`} style={{width: '3.5rem', zIndex: 2, background: ((r as TaskRow).weeks[w] || 0) > 0 ? cellBgForTask(r as TaskRow) : undefined, color: ((r as TaskRow).weeks[w] || 0) > 0 ? getText(teamFnColors[teamKeyFromTask(r as TaskRow)]) : undefined, ...getCellBorderStyle(isSelWeek(r.id,w)), ...getCellBorderStyleForDrag(r.id), ...getWeekColumnHighlightStyle(w)}} onMouseDown={(e)=>onWeekCellMouseDown(e,r,w)} onMouseEnter={(e)=>onWeekCellMouseEnter(e,r,w)} onDoubleClick={(e)=>onWeekCellDoubleClick(e,r,w)}>
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
                                                        // Отключаем автоплан только если значение изменилось
                                                        ...(hasChanged ? { autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));

                                            // Регистрируем изменение в changeTracker
                                            if (hasChanged && changeTracker) {
                                                changeTracker.addCellChange('task', r.id, 'weeks', originalWeeks, base);
                                                // Если задача была с автопланированием, также регистрируем его отключение
                                                if ((r as TaskRow).autoPlanEnabled) {
                                                    changeTracker.addCellChange('task', r.id, 'autoPlanEnabled', true, false);
                                                }
                                            }

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
                                                        // Отключаем автоплан только если значение изменилось
                                                        ...(hasChanged ? { autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));

                                            // Регистрируем изменение в changeTracker
                                            if (hasChanged && changeTracker) {
                                                changeTracker.addCellChange('task', r.id, 'weeks', originalWeeks, base);
                                                // Если задача была с автопланированием, также регистрируем его отключение
                                                if ((r as TaskRow).autoPlanEnabled) {
                                                    changeTracker.addCellChange('task', r.id, 'autoPlanEnabled', true, false);
                                                }
                                            }

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
                                                        // Отключаем автоплан только если значение изменилось
                                                        ...(hasChanged ? { autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));

                                            // Регистрируем изменение в changeTracker
                                            if (hasChanged && changeTracker) {
                                                changeTracker.addCellChange('task', r.id, 'weeks', originalWeeks, base);
                                                // Если задача была с автопланированием, также регистрируем его отключение
                                                if ((r as TaskRow).autoPlanEnabled) {
                                                    changeTracker.addCellChange('task', r.id, 'autoPlanEnabled', true, false);
                                                }
                                            }

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
                                                        // Отключаем автоплан только если значение изменилось
                                                        ...(hasChanged ? { autoPlanEnabled: false } : {})
                                                    }
                                                    : x
                                            ));

                                            // Регистрируем изменение в changeTracker
                                            if (hasChanged && changeTracker) {
                                                changeTracker.addCellChange('task', r.id, 'weeks', originalWeeks, base);
                                            }
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
                            );
                        })}
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
            

            {/* Кнопка Добавить снизу - прилеплена к низу */}
            <div className="flex justify-start mt-auto" style={{ flexShrink: 0 }}>
                <div className="relative">
                    <button className="border rounded px-4 py-2" style={{backgroundColor: '#f3f4f6'}} onClick={()=>setAddMenuOpen(v=>!v)} data-testid="add-button">+ Добавить</button>
                    {addMenuOpen && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white border rounded shadow p-1 w-40" style={{ zIndex: 1000 }} data-testid="add-menu">
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100" onClick={addResourceBottom} data-testid="add-resource-button">Ресурс</button>
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100" onClick={addTaskBottom} data-testid="add-task-button">Задача</button>
                        </div>
                    )}
                </div>
            </div>
        </>
    ) : tab === 'sprints' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="border rounded-xl overflow-auto" data-testid="sprint-table-container" style={{ position: "relative" }}>
            <table className="min-w-full text-sm select-none table-fixed border-collapse" style={{ border: '1px solid rgb(226, 232, 240)' }}>
                <colgroup>
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f3f4f6' }}>
                <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Код</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Начало</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Окончание</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {sprints.map((s, i) => (
                    <tr key={s.id} className="border-b bg-white" onContextMenu={(e) => onContextMenuSprint(e, i)}>
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
                                            updateSprintField(i, 'code', (e.target as HTMLInputElement).value);
                                            commitSprintEdit();
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateSprintField(i, 'code', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('prev', i, 'code');
                                            return;
                                        }
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            updateSprintField(i, 'code', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('next', i, 'code');
                                        }
                                        if (e.key === 'Escape') {
                                            cancelSprintEditRef.current = true;
                                            stopSprintEdit();
                                        }
                                    }}
                                    onBlur={(e) => {
                                        if (!cancelSprintEditRef.current) {
                                            updateSprintField(i, 'code', (e.target as HTMLInputElement).value);
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
                                            updateSprintField(i, 'start', (e.target as HTMLInputElement).value);
                                            commitSprintEdit();
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateSprintField(i, 'start', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('prev', i, 'start');
                                            return;
                                        }
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            updateSprintField(i, 'start', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('next', i, 'start');
                                        }
                                        if (e.key === 'Escape') {
                                            cancelSprintEditRef.current = true;
                                            stopSprintEdit();
                                        }
                                    }}
                                    onBlur={(e) => {
                                        if (!cancelSprintEditRef.current) {
                                            updateSprintField(i, 'start', (e.target as HTMLInputElement).value);
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
                                            updateSprintField(i, 'end', (e.target as HTMLInputElement).value);
                                            commitSprintEdit();
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateSprintField(i, 'end', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('prev', i, 'end');
                                            return;
                                        }
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            updateSprintField(i, 'end', (e.target as HTMLInputElement).value);
                                            navigateSprintInEditMode('next', i, 'end');
                                        }
                                        if (e.key === 'Escape') {
                                            cancelSprintEditRef.current = true;
                                            stopSprintEdit();
                                        }
                                    }}
                                    onBlur={(e) => {
                                        if (!cancelSprintEditRef.current) {
                                            updateSprintField(i, 'end', (e.target as HTMLInputElement).value);
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
            <button className="border rounded px-4 py-2" style={{backgroundColor: '#f3f4f6'}} onClick={addSprint} data-testid="add-sprint-button">+ Добавить</button>
        </div>
        </div>
    ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="border rounded-xl overflow-auto" data-testid="team-table-container" style={{ position: "relative" }}>
            <table className="min-w-full text-sm select-none table-fixed border-collapse" style={{ border: '1px solid rgb(226, 232, 240)' }}>
                <colgroup>
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f3f4f6' }}>
                <tr style={{ borderBottom: '1px solid rgb(226, 232, 240)' }}>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Название</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>Проект в JIRA</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>FeatureTeam</th>
                    <th className="px-4 py-2 text-left" style={{ border: '1px solid rgb(226, 232, 240)', paddingRight: '0.5em', paddingLeft: '0.5em' }}>IssueType</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {teamData.map((t, i) => (
                    <tr key={t.id} className="border-b bg-white" onContextMenu={(e) => onContextMenuTeam(e, i)}>
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
                                            updateTeamField(i, 'name', (e.target as HTMLInputElement).value);
                                            commitTeamEdit();
                                        }
                                        if (e.key === 'Tab' && e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateTeamField(i, 'name', (e.target as HTMLInputElement).value);
                                            navigateTeamInEditMode('prev', i, 'name');
                                            return;
                                        }
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            updateTeamField(i, 'name', (e.target as HTMLInputElement).value);
                                            navigateTeamInEditMode('next', i, 'name');
                                        }
                                        if (e.key === 'Escape') {
                                            cancelTeamEditRef.current = true;
                                            stopTeamEdit();
                                        }
                                    }}
                                    onBlur={(e) => {
                                        if (!cancelTeamEditRef.current) {
                                            updateTeamField(i, 'name', (e.target as HTMLInputElement).value);
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
            <button className="bg-black text-white rounded px-4 py-2" onClick={addTeam} data-testid="add-team-button">+ Добавить</button>
        </div>
        </div>
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
            <div data-testid="context-menu" className="fixed z-50 bg-white shadow-lg rounded-md border border-gray-200 p-2" style={{left:ctx.x, top:ctx.y}} onMouseDown={(e)=>e.stopPropagation()}>
                <div className="bg-white border rounded shadow text-sm">
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>duplicateRow(ctx.rowId)} data-testid="duplicate-row-button">Дублировать</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>deleteRow(ctx.rowId)} data-testid="context-menu-delete">Удалить</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>addRowAbove(ctx.rowId)} data-testid="add-row-above-button">Добавить выше</button>
                    <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={()=>addRowBelow(ctx.rowId)} data-testid="add-row-below-button">Добавить ниже</button>
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
            // Обновляем цвета в состоянии для UI
            setTeamFnColors(prev => ({ ...prev, [colorPanel.teamFnKey]: { bg, text } }));

            // Сохраняем цвета в ресурсы (даже если цвет выбран в задаче)
            // Находим все ресурсы с этим teamFnKey и обновляем их
            computedRows
                .filter(row => row.kind === "resource" && teamKeyFromResource(row as ResourceRow) === colorPanel.teamFnKey)
                .forEach(row => {
                    updateResource(row.id, { fnBgColor: bg, fnTextColor: text });
                });

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
        <div className="fixed z-50" style={{ left: filterUi.x, top: filterUi.y }} data-testid="filter-popup">
            <div className="bg-white border rounded shadow p-2 w-56 max-w-xs text-sm" style={{ backgroundColor: '#ffffff' }} onMouseLeave={()=>setFilterUi(null)}>
                <div className="font-semibold mb-1">Фильтр</div>
                <input className="border w-full px-2 py-1 mb-2 box-border" placeholder="Поиск" value={filters[filterUi.col]?.search || ""} onChange={e=>setFilterSearch(filterUi.col, e.target.value)} data-testid="filter-search-input" />
                <div className="max-h-60 overflow-auto space-y-1" data-testid="filter-options">
                    {Array.from(new Set(filteredValuesForColumn(computedRows, filterUi.col).filter(v => v.toLowerCase().includes((filters[filterUi.col]?.search||"").toLowerCase())))).map(v => (
                        <label key={v} className="flex items-center gap-2" data-testid={`filter-option-${v}`}>
                            <input type="checkbox" checked={filters[filterUi.col]?.selected?.has(v) || false} onChange={()=>toggleFilterValue(filterUi.col, v)} data-testid={`filter-checkbox-${v}`} />
                            <span className="truncate" title={v}>{v || "(пусто)"}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-2 flex justify-between">
                    <button className="text-xs border rounded px-2 py-1" style={{backgroundColor: '#f3f4f6'}} onClick={()=>clearFilter(filterUi.col)} data-testid="filter-clear-button">Сбросить</button>
                    <button className="text-xs border rounded px-2 py-1" style={{backgroundColor: '#f3f4f6'}} onClick={()=>setFilterUi(null)} data-testid="filter-ok-button">ОК</button>
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
        </div>
    );

    // ===== helpers (render) =====
    function filteredValuesForColumn(list: Row[], col: ColumnId): string[] { return list.map(r => valueForCol(r, col)).filter(v => v !== undefined); }


    function renderHeadWithFilter(label: string, col: ColumnId, _filters: any, isFilterActive: (col: ColumnId) => boolean, openFilter: (col: ColumnId, x: number, y: number) => void, handleResizeStart: (col: string, e: React.MouseEvent) => void, columnWidths: Record<string, number>) {
        const filterActive = isFilterActive(col);
        const buttonClass = filterActive
            ? "text-xs rounded"
            : "text-xs text-gray-500";
        const buttonStyle = filterActive
            ? { padding: '1px 2px', backgroundColor: '#166534', color: '#ffffff' } // Force green background and white text with inline styles
            : { padding: '1px 2px', backgroundColor: '#d1d5db' };

        // Определяем стили закрепления для колонок
        const getFrozenStyle = (col: ColumnId) => getFrozenColumnStyle(col, columnWidths);

        return (
            <th
                className="px-2 py-2 text-center align-middle"
                style={{
                    width: COL_WIDTH[col],
                    border: '1px solid rgb(226, 232, 240)',
                    paddingRight: '0.5em',
                    paddingLeft: '0.5em',
                    position: 'relative',
                    ...getFrozenStyle(col),
                    backgroundColor: '#f3f4f6'
                }}
                data-testid={`header-${col}`}
            >
                <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <button
                        className={buttonClass}
                        style={buttonStyle}
                        title={filterActive ? "Фильтр применен" : "Открыть фильтр"}
                        onClick={(e)=>openFilter(col, (e.currentTarget as HTMLElement).getBoundingClientRect().left, (e.currentTarget as HTMLElement).getBoundingClientRect().bottom+4)}
                        data-testid={`filter-${col}-button`}
                    >
                        ▾
                    </button>
                </div>
                {/* Ресайзер для всех колонок кроме autoplan */}
                {col !== "autoplan" && (
                    <div
                        className="absolute inset-y-0 right-0 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors opacity-0 hover:opacity-100"
                        style={{
                            zIndex: 20,
                            right: '-3px',
                            top: '0',
                            bottom: '0',
                            width: '6px', // Явно задаем ширину 6px
                            pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleResizeStart(col, e);
                        }}
                        onMouseEnter={() => {
                            document.body.style.cursor = 'col-resize';
                        }}
                        onMouseLeave={() => {
                            document.body.style.cursor = '';
                        }}
                        title="Перетащите для изменения ширины колонки"
                    />
                )}
            </th>
        );
    }

// self-tests hook removed to satisfy eslint rules-of-hooks
}
