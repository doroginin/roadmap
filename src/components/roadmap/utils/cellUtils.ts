// =============================
// Cell styling utilities
// =============================

import React from "react";

// Функция для получения класса фона ячейки с учетом несоответствия
export function getCellBgClass(hasMismatch: boolean): string {
    return hasMismatch ? 'bg-red-100' : 'bg-white';
}

// Функция для получения inline стилей фона ячейки с учетом несоответствия
export function getCellBgStyle(hasMismatch: boolean): React.CSSProperties {
    return hasMismatch ? { backgroundColor: '#fee2e2' } : {};
}
