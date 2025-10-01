import React from 'react';
import type { AutoSaveState } from '../api/types';

interface SaveStatusProps {
  state: AutoSaveState;
  onForceSave?: () => void;
}

export function SaveStatus({ state, onForceSave }: SaveStatusProps) {
  const { isSaving, lastSaved, error, hasUnsavedChanges } = state;

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds}с назад`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}м назад`;
    } else if (diffHours < 24) {
      return `${diffHours}ч назад`;
    } else {
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {isSaving && (
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Сохранение...</span>
        </div>
      )}

      {!isSaving && lastSaved && !hasUnsavedChanges && (
        <div className="flex items-center gap-1 text-green-600">
          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
          <span>Сохранено {formatLastSaved(lastSaved)}</span>
        </div>
      )}

      {!isSaving && hasUnsavedChanges && (
        <div className="flex items-center gap-1 text-orange-600">
          <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
          <span>Есть несохраненные изменения</span>
          {onForceSave && (
            <button
              onClick={onForceSave}
              className="ml-2 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors"
            >
              Сохранить сейчас
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1 text-red-600">
          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
          <span>Ошибка: {error}</span>
          {onForceSave && (
            <button
              onClick={onForceSave}
              className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
            >
              Повторить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

