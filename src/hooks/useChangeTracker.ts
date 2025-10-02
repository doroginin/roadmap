import { useCallback, useState } from 'react';
import type { Task, Resource, TeamData, Sprint, Function, Employee } from '../api/types';

// Типы для отслеживания изменений
export type EntityType = 'task' | 'resource' | 'team' | 'sprint' | 'function' | 'employee';

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
  functions?: Function[];
  employees?: Employee[];
  deleted?: {
    tasks?: string[];
    resources?: string[];
    teams?: string[];
    sprints?: string[];
    functions?: string[];
    employees?: string[];
  };
}

export function useChangeTracker() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Добавляем изменение ячейки
  const addCellChange = useCallback((
    entityType: EntityType,
    id: string,
    field: string,
    oldValue: any,
    newValue: any
  ) => {
    console.log('🔍 addCellChange called:', { entityType, id, field, oldValue, newValue });
    console.log('🔍 changeTracker state:', { changes: changes.length, hasUnsavedChanges });
    
    // Проверяем, действительно ли значение изменилось
    if (oldValue === newValue) {
      console.log('🔍 Values are the same, skipping change');
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

    console.log('🔍 Adding change:', change);

    setChanges(prev => {
      // Удаляем предыдущие изменения для этой ячейки
      const filtered = prev.filter(c => 
        !(c.type === 'cell' && c.entityType === entityType && c.id === id && 'field' in c && c.field === field)
      );
      
      const newChanges = [...filtered, change];
      console.log('🔍 New changes array:', newChanges);
      return newChanges;
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
    console.log('🔍 buildChangeLog called with changes:', changes);
    console.log('🔍 changes length:', changes.length);
    console.log('🔍 hasUnsavedChanges:', hasUnsavedChanges);
    changes.forEach((change, index) => {
      console.log(`🔍 change ${index}:`, {
        type: change.type,
        entityType: change.entityType,
        id: change.id,
        field: 'field' in change ? change.field : 'N/A',
        action: 'action' in change ? change.action : 'N/A'
      });
    });
    
    const changeLog: ChangeLog = {};
    const deleted: ChangeLog['deleted'] = {};

    // Группируем изменения по типам
    const changesByType = changes.reduce((acc, change) => {
      if (!acc[change.entityType]) {
        acc[change.entityType] = [];
      }
      acc[change.entityType].push(change);
      return acc;
    }, {} as Record<EntityType, Change[]>);
    
    console.log('🔍 changesByType:', changesByType);

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
            existing[change.field] = change.newValue;
          } else {
            // Создаем новый объект с изменением
            const newObj = { id: change.id, [change.field]: change.newValue };
            updated.set(change.id, newObj);
          }
        }
      });

      // Добавляем в changeLog
      const allItems = [...added.values(), ...updated.values()];
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
  }, [changes]);

  // Очищаем изменения после успешного сохранения
  const clearChanges = useCallback(() => {
    setChanges([]);
    setHasUnsavedChanges(false);
  }, []);

  // Сбрасываем трекер
  const reset = useCallback(() => {
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
