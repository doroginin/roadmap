// =============================
// Column styling utilities
// =============================

// Функция для получения стилей закрепления колонок с динамическим расчетом позиций
export const getFrozenColumnStyle = (col: string, columnWidths: Record<string, number>, rowType?: 'resource' | 'task') => {
    const baseStyle = {
        position: 'sticky' as const,
        zIndex: rowType === 'task' ? 6 : 8, // 6 для задач, 8 для ресурсов
        backgroundColor: 'white',
        flexShrink: 0,
        minWidth: 'fit-content'
    };

    // Добавляем 45px для каждой колонки с кнопкой фильтрации
    const filterButtonWidth = 45;

    switch (col) {
        case "type":
            return { ...baseStyle, left: 0 };
        case "status":
            return { ...baseStyle, left: `${columnWidths.type + filterButtonWidth}px` };
        case "sprintsAuto":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + filterButtonWidth * 2}px` };
        case "epic":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + filterButtonWidth * 3}px` };
        case "task":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + filterButtonWidth * 4}px` };
        case "team":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + filterButtonWidth * 5}px` };
        case "fn":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + columnWidths.team + filterButtonWidth * 6}px` };
        case "empl":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + columnWidths.team + columnWidths.fn + filterButtonWidth * 7}px` };
        case "planEmpl":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + columnWidths.team + columnWidths.fn + columnWidths.empl + filterButtonWidth * 8}px` };
        case "planWeeks":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + columnWidths.team + columnWidths.fn + columnWidths.empl + columnWidths.planEmpl + filterButtonWidth * 9}px` };
        case "autoplan":
            return { ...baseStyle, left: `${columnWidths.type + columnWidths.status + columnWidths.sprintsAuto + columnWidths.epic + columnWidths.task + columnWidths.team + columnWidths.fn + columnWidths.empl + columnWidths.planEmpl + columnWidths.planWeeks + filterButtonWidth * 10}px` };
        default:
            return {};
    }
};
