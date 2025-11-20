import { useState, useEffect } from "react";

interface ResizeState {
    column: string;
    startX: number;
    startWidth: number;
}

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
    /* 45 - ширина стрелки для фильтрации и блока для изменения ширины колонок */
    type: 65 - 45,
    status: 80 - 45,
    sprintsAuto: 90 - 45,
    epic: 195 - 45,
    task: 195 - 45,
    team: 80 - 45,
    fn: 55 - 45,
    empl: 70 - 45,
    planEmpl: 70 - 45,
    planWeeks: 80 - 45
};

export function useColumnResize() {
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
    const [isResizing, setIsResizing] = useState<ResizeState | null>(null);

    const handleResizeStart = (column: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing({
            column,
            startX: e.clientX,
            startWidth: columnWidths[column] || 200
        });
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = e.clientX - isResizing.startX;

        // Используем минимальную ширину из columnWidths
        const minWidth = columnWidths[isResizing.column] || 20;

        if (isResizing.column === 'autoplan') {
            return; // Колонка Auto не ресайзится - фиксированная 50px
        }

        const newWidth = Math.max(minWidth, isResizing.startWidth + deltaX);

        setColumnWidths(prev => ({
            ...prev,
            [isResizing.column]: newWidth
        }));
    };

    const handleResizeEnd = () => {
        setIsResizing(null);
    };

    // Добавляем глобальные обработчики для ресайзинга
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
        }
    }, [isResizing]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        columnWidths,
        handleResizeStart
    };
}
