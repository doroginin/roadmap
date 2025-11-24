import { useRef, useState } from "react";
import type { ID, Row, TaskRow, ResourceRow } from "../types";

interface DragTooltip {
    visible: boolean;
    x: number;
    y: number;
    task: TaskRow | null;
    resource: ResourceRow | null;
}

interface DragAndDropProps {
    rows: Row[];
    setRows: React.Dispatch<React.SetStateAction<Row[]>>;
    changeTracker?: any;
}

export function useDragAndDrop({ rows, setRows, changeTracker }: DragAndDropProps) {
    // ====== Drag state ======
    const dragRowRef = useRef<{ id: ID; kind: "resource" | "task" } | null>(null);
    const dragAllowedRef = useRef<boolean>(false);
    const isDraggingRef = useRef<boolean>(false);
    const shiftDragTaskRef = useRef<ID | null>(null);
    const isShiftPressedRef = useRef<boolean>(false);

    const [dragTooltip, setDragTooltip] = useState<DragTooltip>({
        visible: false,
        x: 0,
        y: 0,
        task: null,
        resource: null
    });

    const [highlightedRowId, setHighlightedRowId] = useState<ID | null>(null);
    const [dropPositionRowId, setDropPositionRowId] = useState<ID | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom'>('top');
    const [highlightedWeekIdx, setHighlightedWeekIdx] = useState<number | null>(null);

    // ====== Helper functions ======
    function markDragAllowed() {
        dragAllowedRef.current = true;
    }

    function clearDragAllowed() {
        dragAllowedRef.current = false;
    }

    function getCellBorderClass(_rowId: ID): string {
        // Временно отключаем CSS классы, используем только inline стили
        return '';
    }

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

    function getWeekColumnHighlightStyle(weekIdx: number): React.CSSProperties {
        if (highlightedWeekIdx === weekIdx) {
            return { borderLeft: '2px solid #f87171', borderRight: '2px solid #f87171' }; // красная рамка для колонки
        }
        return {};
    }

    // ====== Blocker validation ======
    function canSetBlocker(srcTaskId: ID, blockerTaskId: ID): boolean {
        // Нельзя блокировать задачу саму собой
        if (srcTaskId === blockerTaskId) return false;

        // Создаем граф зависимостей с предполагаемой новой связью
        const graph = new Map<ID, ID[]>();
        rows.forEach(r => {
            if (r.kind === "task") {
                graph.set(r.id, (r as TaskRow).blockerIds.slice());
            }
        });

        // Добавляем предполагаемую новую связь
        const currentBlockers = graph.get(srcTaskId) || [];
        graph.set(srcTaskId, [...currentBlockers, blockerTaskId]);

        // Проверяем на циклические зависимости с помощью DFS
        function hasCycle(): boolean {
            const visited = new Set<ID>();
            const recursionStack = new Set<ID>();

            function dfs(taskId: ID): boolean {
                if (recursionStack.has(taskId)) {
                    // Найден цикл
                    return true;
                }
                if (visited.has(taskId)) {
                    // Уже посещенная вершина, но не в текущем пути рекурсии
                    return false;
                }

                visited.add(taskId);
                recursionStack.add(taskId);

                // Проверяем всех блокеров текущей задачи
                const blockers = graph.get(taskId) || [];
                for (const blockerId of blockers) {
                    if (dfs(blockerId)) {
                        return true;
                    }
                }

                recursionStack.delete(taskId);
                return false;
            }

            // Проверяем все задачи в графе
            for (const taskId of graph.keys()) {
                if (!visited.has(taskId)) {
                    if (dfs(taskId)) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Возвращаем true, если циклов нет
        return !hasCycle();
    }

    function removeBlocker(taskId: ID, blockerId: ID) {
        setRows(prev => prev.map(r =>
            (r.kind === "task" && r.id === taskId)
                ? { ...r, blockerIds: (r as TaskRow).blockerIds.filter(x => x !== blockerId) }
                : r
        ));
    }

    function handleRemoveBlocker(blockerId: string, blockedTaskId: string) {
        if (blockerId.startsWith('week-')) {
            // Удаляем блокер недели
            const weekNumber = parseInt(blockerId.replace('week-', ''));

            // Получаем текущие блокеры недель до изменения
            const taskRow = rows.find(r => r.kind === "task" && r.id === blockedTaskId) as TaskRow | undefined;
            const oldWeekBlockers = taskRow?.weekBlockers || [];
            const newWeekBlockers = oldWeekBlockers.filter(w => w !== weekNumber);

            setRows(prev => prev.map(row =>
                (row.kind === "task" && row.id === blockedTaskId)
                    ? { ...row, weekBlockers: newWeekBlockers }
                    : row
            ));

            // Отслеживаем изменение
            if (changeTracker) {
                changeTracker.addCellChange('task', blockedTaskId, 'weekBlockers', oldWeekBlockers, newWeekBlockers);
            }
        } else {
            // Удаляем блокер задачи
            // Получаем текущие блокеры до изменения
            const taskRow = rows.find(r => r.kind === "task" && r.id === blockedTaskId) as TaskRow | undefined;
            const oldBlockerIds = taskRow?.blockerIds || [];
            const newBlockerIds = oldBlockerIds.filter(x => x !== blockerId);

            setRows(prev => prev.map(r =>
                (r.kind === "task" && r.id === blockedTaskId)
                    ? { ...r, blockerIds: newBlockerIds }
                    : r
            ));

            // Отслеживаем изменение
            if (changeTracker) {
                changeTracker.addCellChange('task', blockedTaskId, 'blockerIds', oldBlockerIds, newBlockerIds);
            }
        }
    }

    // ====== Mouse event handlers ======
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

                    // Проверяем, находится ли курсор над колонкой недели
                    const weekCell = element?.closest('td[data-week-idx]');
                    if (weekCell) {
                        const weekIdx = parseInt(weekCell.getAttribute('data-week-idx') || '-1');
                        if (weekIdx >= 0) {
                            setHighlightedWeekIdx(weekIdx);
                            setHighlightedRowId(null);
                            return;
                        }
                    }

                    // Если не над колонкой недели, проверяем строки задач
                    setHighlightedWeekIdx(null);
                    const targetRow = element?.closest('tr[data-row-id]');
                    if (targetRow) {
                        const targetRowId = targetRow.getAttribute('data-row-id');
                        if (targetRowId) {
                            // Проверяем, что перетаскиваемая строка и целевая строка одного типа
                            const targetRowData = rows.find(r => r.id === targetRowId);

                            // Не показываем красные рамки, если это та же задача которую перетаскиваем
                            if (targetRowData && draggedRow.kind === targetRowData.kind && draggedRow.id !== targetRowId) {
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

            // Проверяем, был ли drop на колонку недели при Shift+drag задачи
            if (isShiftPressed && draggedRow && draggedRow.kind === "task") {
                const weekCell = element?.closest('td[data-week-idx]');
                if (weekCell) {
                    const weekIdx = parseInt(weekCell.getAttribute('data-week-idx') || '-1');
                    if (weekIdx >= 0) {
                        const weekNumber = weekIdx + 1; // Преобразуем в 1-based

                        // Получаем текущие блокеры недель до изменения
                        const taskRow = rows.find(r => r.kind === "task" && r.id === draggedRow.id) as TaskRow | undefined;
                        const oldWeekBlockers = taskRow?.weekBlockers || [];
                        const newWeekBlockers = Array.from(new Set([...oldWeekBlockers, weekNumber]));

                        setRows(prev => prev.map(row =>
                            (row.kind === "task" && row.id === draggedRow.id)
                                ? { ...row, weekBlockers: newWeekBlockers }
                                : row
                        ));

                        // Отслеживаем изменение
                        if (changeTracker) {
                            changeTracker.addCellChange('task', draggedRow.id, 'weekBlockers', oldWeekBlockers, newWeekBlockers);
                        }

                        // Очищаем состояние и выходим
                        setDragTooltip({ visible: false, x: 0, y: 0, task: null, resource: null });
                        setHighlightedRowId(null);
                        setHighlightedWeekIdx(null);
                        setDropPositionRowId(null);
                        setDropPosition('top');
                        dragRowRef.current = null;
                        isDraggingRef.current = false;
                        clearDragAllowed();

                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        return;
                    }
                }
            }

            const targetRow = element?.closest('tr');

            if (targetRow && draggedRow) {
                const targetRowId = targetRow.getAttribute('data-row-id');
                if (targetRowId) {
                    const targetRowData = rows.find(row => row.id === targetRowId);
                    if (targetRowData && targetRowData.kind === draggedRow.kind) {
                        // Выполняем операцию перестановки или назначения блокера
                        if (isShiftPressed && draggedRow.kind === "task" && targetRowData.kind === "task") {
                            // Назначение блокера - проверяем, что это не та же задача
                            if (draggedRow.id === targetRowData.id) {
                                // Не делаем ничего, просто игнорируем
                            } else {
                                if (canSetBlocker(draggedRow.id, targetRowData.id)) {
                                    // Получаем текущие блокеры до изменения
                                    const taskRow = rows.find(r => r.kind === "task" && r.id === draggedRow.id) as TaskRow | undefined;
                                    const oldBlockerIds = taskRow?.blockerIds || [];
                                    const newBlockerIds = Array.from(new Set([...oldBlockerIds, targetRowData.id]));

                                    setRows(prev => prev.map(row =>
                                        (row.kind === "task" && row.id === draggedRow.id)
                                            ? { ...row, blockerIds: newBlockerIds }
                                            : row
                                    ));

                                    // Отслеживаем изменение
                                    if (changeTracker) {
                                        changeTracker.addCellChange('task', draggedRow.id, 'blockerIds', oldBlockerIds, newBlockerIds);
                                    }
                                } else {
                                    alert("Нельзя создать блокер: обнаружен цикл или неверный порядок.");
                                }
                            }
                        } else {
                            // Перестановка строк
                            setRows(prev => {
                                const list = prev.slice();
                                const from = list.findIndex(x => x.id === draggedRow.id);
                                const to = list.findIndex(x => x.id === targetRowData.id);
                                if (from < 0 || to < 0 || from === to) {
                                    return prev;
                                }

                                // Remove dragged row from original position
                                const [movedRow] = list.splice(from, 1);

                                // Insert at target position
                                const insertIndex = dropPosition === 'top' ? to : to + 1;
                                list.splice(insertIndex, 0, movedRow);

                                // Update prev_id and next_id for all affected rows
                                // Resources and tasks are in separate sections, so we need to update only within the same kind
                                const isResource = movedRow.kind === 'resource';
                                const sameKindRows = list.filter(r => r.kind === (isResource ? 'resource' : 'task'));

                                // Update linked list pointers
                                const rowType = isResource ? 'resource' : 'task';
                                sameKindRows.forEach((row, index) => {
                                    const prevRow = index > 0 ? sameKindRows[index - 1] : null;
                                    const nextRow = index < sameKindRows.length - 1 ? sameKindRows[index + 1] : null;

                                    const oldPrevId = row.prevId;
                                    const oldNextId = row.nextId;
                                    const newPrevId = prevRow ? prevRow.id : null;
                                    const newNextId = nextRow ? nextRow.id : null;

                                    row.prevId = newPrevId;
                                    row.nextId = newNextId;

                                    // Track changes for affected rows (only if values actually changed)
                                    if (changeTracker) {
                                        if (oldPrevId !== newPrevId) {
                                            changeTracker.addCellChange(rowType, row.id, 'prevId', oldPrevId, newPrevId);
                                        }
                                        if (oldNextId !== newNextId) {
                                            changeTracker.addCellChange(rowType, row.id, 'nextId', oldNextId, newNextId);
                                        }
                                    }
                                });

                                return list;
                            });
                        }
                    }
                }
            }

            // Очищаем состояние
            setDragTooltip({ visible: false, x: 0, y: 0, task: null, resource: null });
            setHighlightedRowId(null);
            setHighlightedWeekIdx(null);
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

    function onTaskMouseDown(e: React.MouseEvent, t: TaskRow) {
        shiftDragTaskRef.current = t.id;
        isShiftPressedRef.current = e.shiftKey;
    }

    function onTaskMouseUp(_e: React.MouseEvent, t: TaskRow) {
        const src = shiftDragTaskRef.current;
        shiftDragTaskRef.current = null;
        if (!src || src === t.id) return;
        // Эта логика теперь обрабатывается в onMouseDownRow
        return;
    }

    return {
        // State
        dragTooltip,
        highlightedRowId,
        dropPositionRowId,
        dropPosition,
        highlightedWeekIdx,
        isShiftPressedRef,

        // Helper functions
        markDragAllowed,
        clearDragAllowed,
        getCellBorderClass,
        getCellBorderStyleForDrag,
        getWeekColumnHighlightStyle,

        // Blocker functions
        canSetBlocker,
        removeBlocker,
        handleRemoveBlocker,

        // Event handlers
        onMouseDownRow,
        onTaskMouseDown,
        onTaskMouseUp,
    };
}
