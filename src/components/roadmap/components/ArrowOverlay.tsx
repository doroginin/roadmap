import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Link, TaskRow } from "../types";
import { cellId } from "../utils/calculations";
import { chooseBestRoute } from "../utils/linkBuilder";

interface ArrowOverlayProps {
    links: Link[];
    container: HTMLDivElement | null;
    onRemoveBlocker: (blockerId: string, blockedTaskId: string) => void;
    tasks: TaskRow[];
}

export function ArrowOverlay({
    links,
    container,
    onRemoveBlocker,
    tasks
}: ArrowOverlayProps) {
    const [paths, setPaths] = useState<Array<{
        id: string;
        d: string; // SVG path
        isConflict: boolean; // конфликт планирования
        blockerId: string;
        blockedTaskId: string;
        type: 'task' | 'week'; // тип блокера
    }>>([]);
    const [hoverId, setHoverId] = useState<string | null>(null);

    // Use refs to store current values to avoid recreating useLayoutEffect
    const linksRef = useRef(links);
    const tasksRef = useRef(tasks);
    const prevPathsRef = useRef<typeof paths>([]);

    // Update refs when props change
    useEffect(() => {
        linksRef.current = links;
        tasksRef.current = tasks;
    }, [links, tasks]);

        // Measure and compute paths
        useLayoutEffect(() => {
            if (!container) return;

            let timeoutId: number | null = null;

            const measure = () => {
                // Debounce measure calls to prevent infinite loops
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = window.setTimeout(() => {
            const wrapRect = container.getBoundingClientRect();
            const result: typeof paths = [];

            // Use current values from refs
            const currentLinks = linksRef.current;
            const currentTasks = tasksRef.current;

            // Функция для проверки, пересекается ли стрелка с занятой ячейкой
            const getArrowOffset = (x1: number, y1: number, x2: number, y2: number): {offsetX: number, offsetY: number} => {
                const isHorizontal = Math.abs(x2 - x1) > Math.abs(y2 - y1);
                let offsetX = 0;
                let offsetY = 0;

                if (isHorizontal) {
                    // Для горизонтальных стрелок проверяем пересечения с занятыми ячейками
                    const startX = Math.min(x1, x2);
                    const endX = Math.max(x1, x2);
                    const arrowY = (y1 + y2) / 2;

                    // Проверяем пересечения с занятыми ячейками
                    let hasIntersection = false;
                    currentTasks.forEach(task => {
                        for (let weekIdx = 0; weekIdx < task.weeks.length; weekIdx++) {
                            if ((task.weeks[weekIdx] || 0) > 0) {
                                const cellElement = document.getElementById(cellId(task.id, weekIdx));
                                if (cellElement) {
                                    const cellRect = cellElement.getBoundingClientRect();
                                    const cellX = cellRect.left + cellRect.width / 2 - wrapRect.left + container.scrollLeft;
                                    const cellY = cellRect.top + cellRect.height / 2 - wrapRect.top + container.scrollTop;

                                    // Проверяем пересечение
                                    if (Math.abs(arrowY - cellY) < 15 && cellX >= startX && cellX <= endX) {
                                        hasIntersection = true;
                                    }
                                }
                            }
                        }
                    });

                    if (hasIntersection) {
                        offsetY = 6; // Смещаем на 6px от верхней границы ячейки
                    }
                } else {
                    // Для вертикальных стрелок проверяем пересечения и смещаем к левой границе
                    const startY = Math.min(y1, y2);
                    const endY = Math.max(y1, y2);
                    const arrowX = (x1 + x2) / 2;

                    // Проверяем пересечения с занятыми ячейками
                    let hasIntersection = false;
                    let targetCellLeft = null;

                    currentTasks.forEach(task => {
                        for (let weekIdx = 0; weekIdx < task.weeks.length; weekIdx++) {
                            if ((task.weeks[weekIdx] || 0) > 0) {
                                const cellElement = document.getElementById(cellId(task.id, weekIdx));
                                if (cellElement) {
                                    const cellRect = cellElement.getBoundingClientRect();
                                    const cellX = cellRect.left + cellRect.width / 2 - wrapRect.left + container.scrollLeft;
                                    const cellY = cellRect.top + cellRect.height / 2 - wrapRect.top + container.scrollTop;

                                    // Проверяем пересечение
                                    if (Math.abs(arrowX - cellX) < 25 && cellY >= startY && cellY <= endY) {
                                        hasIntersection = true;
                                        // Запоминаем левую границу ячейки для точного позиционирования
                                        targetCellLeft = cellRect.left - wrapRect.left + container.scrollLeft;
                                    }
                                }
                            }
                        }
                    });

                    if (hasIntersection && targetCellLeft !== null) {
                        // Смещаем к позиции 6px от левой границы ячейки
                        offsetX = (targetCellLeft + 6) - arrowX;
                    }
                }

                return {offsetX, offsetY};
            };

            currentLinks.forEach((link, i) => {
                let a: HTMLElement | null, b: HTMLElement | null;

                if (link.type === 'week') {
                    // Для блокеров недель: стрелка выходит из ячейки R:M-1 (где M - номер недели блокера)
                    a = document.getElementById(cellId(link.from.taskId, link.from.weekIdx));
                    b = document.getElementById(cellId(link.to.taskId, link.to.weekIdx));
                } else {
                    // Для блокеров задач: обычная логика
                    a = document.getElementById(cellId(link.from.taskId, link.from.weekIdx));
                    b = document.getElementById(cellId(link.to.taskId, link.to.weekIdx));
                }

                if (!a || !b) return;

                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();

                let x1: number, y1: number, x2: number, y2: number, d: string;

                if (link.type === 'week') {
                    // Для блокеров недель: простая прямая стрелка, по центру или со смещением
                    const verticalLineLength = 8; // Длина вертикальной палочки

                    // Начинаем из середины исходной ячейки
                    x1 = ra.left + ra.width / 2 - wrapRect.left + container.scrollLeft;
                    // Идем к левой границе целевой ячейки
                    x2 = rb.left - wrapRect.left + container.scrollLeft;

                    // Сначала пробуем разместить по центру ячейки
                    const centerY1 = ra.top + ra.height / 2 - wrapRect.top + container.scrollTop;
                    const centerY2 = rb.top + rb.height / 2 - wrapRect.top + container.scrollTop;

                    // Проверяем, есть ли пересечения при размещении по центру
                    const centerOffset = getArrowOffset(x1, centerY1, x2, centerY2);

                    if (centerOffset.offsetY === 0) {
                        // Нет пересечений - размещаем по центру
                        y1 = centerY1;
                        y2 = centerY2;
                    } else {
                        // Есть пересечения - размещаем на 6px от верхней границы ячейки
                        const fixedOffset = 6; // Фиксированное смещение от верхней границы
                        y1 = ra.top + fixedOffset - wrapRect.top + container.scrollTop;
                        y2 = rb.top + fixedOffset - wrapRect.top + container.scrollTop;
                    }

                    // Создаем путь с вертикальной палочкой в начале: |->
                    const verticalStart = y1 - verticalLineLength / 2;
                    const verticalEnd = y1 + verticalLineLength / 2;
                    d = `M ${x1} ${verticalStart} L ${x1} ${verticalEnd} M ${x1} ${y1} L ${x2} ${y2}`;
                } else {
                    // Для блокеров задач: умная маршрутизация
                const routeType = chooseBestRoute(
                    tasks,
                    link.from.taskId,
                    link.from.weekIdx,
                    link.to.taskId,
                    link.to.weekIdx
                );

                // Определяем, идет ли стрелка снизу вверх
                const isUpward = ra.top > rb.top;

                    if (routeType === 'top') {
                        // Маршрут: правая граница источника → верх/низ цели
                        x1 = ra.right - wrapRect.left + container.scrollLeft;
                        y1 = ra.top + ra.height / 2 - wrapRect.top + container.scrollTop;
                        x2 = rb.left + rb.width / 2 - wrapRect.left + container.scrollLeft;
                        // Если стрелка идет снизу вверх, направляем в нижний край ячейки
                        y2 = isUpward ? rb.bottom - wrapRect.top + container.scrollTop : rb.top - wrapRect.top + container.scrollTop;

                        // Применяем смещение для избежания пересечений
                        const horizontalOffset = getArrowOffset(x1, y1, x2, y1); // Проверяем горизонтальный сегмент
                        const verticalOffset = getArrowOffset(x2, y1, x2, y2); // Проверяем вертикальный сегмент

                        const horizontalY = y1 + horizontalOffset.offsetY;
                        const adjustedX2 = x2 + verticalOffset.offsetX;

                        d = `M ${x1} ${horizontalY} L ${adjustedX2} ${horizontalY} L ${adjustedX2} ${y2}`;
                    } else {
                        // Маршрут: низ источника → левая граница цели
                        x1 = ra.left + ra.width / 2 - wrapRect.left + container.scrollLeft;
                        y1 = ra.bottom - wrapRect.top + container.scrollTop;
                        x2 = rb.left - wrapRect.left + container.scrollLeft;
                        y2 = rb.top + rb.height / 2 - wrapRect.top + container.scrollTop;

                        // Применяем смещение для избежания пересечений
                        const verticalOffset = getArrowOffset(x1, y1, x1, y2); // Проверяем вертикальный сегмент
                        const horizontalOffset = getArrowOffset(x1, y2, x2, y2); // Проверяем горизонтальный сегмент

                        const adjustedX1 = x1 + verticalOffset.offsetX;
                        const horizontalY = y2 + horizontalOffset.offsetY;

                        d = `M ${adjustedX1} ${y1} L ${adjustedX1} ${horizontalY} L ${x2} ${horizontalY}`;
                    }
                }

                result.push({
                    id: String(i),
                    d,
                    isConflict: link.isConflict,
                    blockerId: link.blockerId,
                    blockedTaskId: link.blockedTaskId,
                    type: link.type
                });
            });

            // Only update paths if they actually changed to prevent infinite loops
            const prevPaths = prevPathsRef.current;
            let hasChanges = false;

            if (prevPaths.length !== result.length) {
                hasChanges = true;
            } else {
                // Deep comparison for each path
                hasChanges = result.some((newPath, index) => {
                    const oldPath = prevPaths[index];
                    return !oldPath ||
                           oldPath.d !== newPath.d ||
                           oldPath.isConflict !== newPath.isConflict ||
                           oldPath.blockerId !== newPath.blockerId ||
                           oldPath.blockedTaskId !== newPath.blockedTaskId ||
                           oldPath.type !== newPath.type;
                });
            }

            if (hasChanges) {
                prevPathsRef.current = result;
                setPaths(result);
            }
                }, 16); // ~60fps
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
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            ro.disconnect();
            obs.disconnect();
            container.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", measure);
            document.removeEventListener("scroll", onScroll, true);
        };
    }, [container]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!container) return null;

    const w = Math.max(container.clientWidth, container.scrollWidth);
    // Используем высоту таблицы вместо scrollHeight контейнера для корректной работы с фильтрами
    const table = container.querySelector('table');
    const tableHeight = table ? table.getBoundingClientRect().height : 0;
    const h = Math.max(container.clientHeight, tableHeight);

    return (
        <svg
            width={w}
            height={h}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}
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
                <marker id="arrow-head-week" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
                </marker>
                <marker id="arrow-head-week-hover" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                </marker>
            </defs>

            {paths.map((p) => {
                const active = hoverId === p.id;

                // Определяем цвет и маркер в зависимости от типа блокера
                let baseStroke: string, hoverStroke: string, markerId: string;

                if (p.type === 'week') {
                    // Блокеры недель: серые стрелки (красные при конфликте)
                if (p.isConflict) {
                        baseStroke = "#dc2626";
                        hoverStroke = "#b91c1c";
                    markerId = active ? "arrow-head-conflict-hover" : "arrow-head-conflict";
                } else {
                        baseStroke = "#6b7280";
                        hoverStroke = "#111827";
                    markerId = active ? "arrow-head-normal-hover" : "arrow-head-normal";
                }
                } else {
                    // Блокеры задач: серые стрелки (красные при конфликте)
                    if (p.isConflict) {
                        baseStroke = "#dc2626";
                        hoverStroke = "#b91c1c";
                        markerId = active ? "arrow-head-conflict-hover" : "arrow-head-conflict";
                    } else {
                        baseStroke = "#6b7280";
                        hoverStroke = "#111827";
                        markerId = active ? "arrow-head-normal-hover" : "arrow-head-normal";
                    }
                }

                const stroke = active ? hoverStroke : baseStroke;
                const strokeWidth = 2; // постоянная толщина
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
