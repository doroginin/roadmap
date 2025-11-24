import { useCallback, useState, useRef } from 'react';
import type { Task, Resource, TeamData, Sprint } from '../api/types';

// Типы для отслеживания изменений
export type EntityType = 'task' | 'resource' | 'team' | 'sprint';

export interface CellChange {
  type: 'cell';
  entityType: EntityType;
  id: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export interface RowChange {
  type: 'row';
  entityType: EntityType;
  id: string;
  action: 'added' | 'deleted';
  data?: any;
  timestamp: number;
}

export type Change = CellChange | RowChange;

// Интерфейс для трекера изменений
export interface ChangeTracker {
  changes: Change[];
  hasUnsavedChanges: boolean;
  addCellChange: (entityType: EntityType, id: string, field: string, oldValue: any, newValue: any) => void;
  addRowChange: (entityType: EntityType, id: string, action: 'added' | 'deleted', data?: any) => void;
  buildChangeLog: () => ChangeLog;
  clearChanges: () => void;
  reset: () => void;
}

// Интерфейс для изменений, которые будут отправлены на сервер
export interface ChangeLog {
  tasks?: Task[];
  resources?: Resource[];
  teams?: TeamData[];
  sprints?: Sprint[];
  deleted?: {
    tasks?: string[];
    resources?: string[];
    teams?: string[];
    sprints?: string[];
  };
}

export function useChangeTracker() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Ref для хранения актуальных changes (для избежания stale closure)
  const changesRef = useRef<Change[]>([]);
  changesRef.current = changes;
  
  // Добавляем изменение ячейки
  const addCellChange = useCallback((
    entityType: EntityType,
    id: string,
    field: string,
    oldValue: any,
    newValue: any
  ) => {
    // Проверяем, действительно ли значение изменилось
    if (oldValue === newValue) {
      return;
    }

    const change: CellChange = {
      type: 'cell',
      entityType,
      id,
      field,
      oldValue,
      newValue,
      timestamp: Date.now()
    };

    setChanges(prev => {
      // Удаляем предыдущие изменения для этой ячейки
      const filtered = prev.filter(c =>
        !(c.type === 'cell' && c.entityType === entityType && c.id === id && 'field' in c && c.field === field)
      );

      return [...filtered, change];
    });

    setHasUnsavedChanges(true);
  }, []);

  // Добавляем изменение строки (добавление/удаление)
  const addRowChange = useCallback((
    entityType: EntityType,
    id: string,
    action: RowChange['action'],
    data?: any
  ) => {
    const change: RowChange = {
      type: 'row',
      entityType,
      id,
      action,
      data,
      timestamp: Date.now()
    };

    setChanges(prev => {
      // Удаляем предыдущие изменения для этой строки
      const filtered = prev.filter(c => 
        !(c.type === 'row' && c.entityType === entityType && c.id === id)
      );
      
      return [...filtered, change];
    });
    
    setHasUnsavedChanges(true);
  }, []);

  // Формируем лог изменений для отправки на сервер
  const buildChangeLog = useCallback((): ChangeLog => {
    // Используем changesRef для получения актуальных изменений (избегаем stale closure)
    const currentChanges = changesRef.current;

    const changeLog: ChangeLog = {};
    const deleted: ChangeLog['deleted'] = {};

    // Группируем изменения по типам
    const changesByType = currentChanges.reduce((acc, change) => {
      if (!acc[change.entityType]) {
        acc[change.entityType] = [];
      }
      acc[change.entityType].push(change);
      return acc;
    }, {} as Record<EntityType, Change[]>);

    // Обрабатываем каждую группу изменений
    Object.entries(changesByType).forEach(([entityType, typeChanges]) => {
      const added = new Map<string, any>();
      const updated = new Map<string, any>();
      const deletedIds = new Set<string>();

      typeChanges.forEach(change => {
        if ('action' in change) {
          // RowChange
          if (change.action === 'added' && change.data) {
            added.set(change.id, change.data);
          } else if (change.action === 'deleted') {
            deletedIds.add(change.id);
          }
        } else {
          // CellChange - нужно собрать все изменения для одного объекта
          const existing = updated.get(change.id) || added.get(change.id);
          if (existing) {
            // Обновляем существующую запись в added или updated
            existing[change.field] = change.newValue;
          } else {
            // Создаем новый объект с изменением
            const newObj = { id: change.id, [change.field]: change.newValue };
            updated.set(change.id, newObj);
          }
        }
      });

      // Объединяем added и updated, но исключаем те, которые помечены как удаленные
      const allItems = [...added.values(), ...updated.values()].filter(item => !deletedIds.has(item.id));
      if (allItems.length > 0) {
        (changeLog as any)[`${entityType}s`] = allItems;
      }

      if (deletedIds.size > 0) {
        (deleted as any)[`${entityType}s`] = Array.from(deletedIds);
      }
    });

    if (Object.keys(deleted).length > 0) {
      changeLog.deleted = deleted;
    }

    return changeLog;
  }, []); // Используем ref, поэтому зависимостей нет

  // Очищаем изменения после успешного сохранения
  const clearChanges = useCallback(() => {
    changesRef.current = [];
    setChanges([]);
    setHasUnsavedChanges(false);
  }, []);

  // Сбрасываем трекер
  const reset = useCallback(() => {
    changesRef.current = [];
    setChanges([]);
    setHasUnsavedChanges(false);
  }, []);

  return {
    changes,
    hasUnsavedChanges,
    addCellChange,
    addRowChange,
    buildChangeLog,
    clearChanges,
    reset
  };
}
