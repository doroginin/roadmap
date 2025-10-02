import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRoadmapChanges } from '../api/roadmapApi';
import type { RoadmapData, AutoSaveState, UseAutoSaveOptions } from '../api/types';
import type { ChangeTracker } from './useChangeTracker';

export function useAutoSave(
  data: RoadmapData | null,
  userId: string | null,
  changeTracker: ChangeTracker,
  options: UseAutoSaveOptions = {}
) {
  const {
    delay = 2000,
    enabled = true,
    onSaveSuccess,
    onSaveError
  } = options;

  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    error: null,
    hasUnsavedChanges: false
  });

  const timeoutRef = useRef<number | null>(null);
  const currentVersionRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  // Эффект для автосохранения с задержкой
  useEffect(() => {
    if (!data || !enabled) return;

    // Инициализация при первой загрузке данных
    if (!isInitializedRef.current) {
      currentVersionRef.current = data.version;
      isInitializedRef.current = true;
      setState(prev => ({ 
        ...prev, 
        hasUnsavedChanges: false,
        lastSaved: new Date()
      }));
      return;
    }

    // Проверяем, есть ли изменения через hasUnsavedChanges из changeTracker
    if (!changeTracker.hasUnsavedChanges) {
      return;
    }
    
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));

    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Устанавливаем новый таймер
    timeoutRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, isSaving: true, error: null }));

      try {
        // Получаем лог изменений только когда нужно сохранить
        const changeLog = changeTracker.buildChangeLog();
        
        // Отладочная информация
        console.log('🔍 AutoSave Debug:', {
          hasChanges: Object.keys(changeLog).length > 0,
          changeLog,
          changeLogKeys: Object.keys(changeLog),
          changeLogString: JSON.stringify(changeLog, null, 2),
          hasUnsavedChanges: changeTracker.hasUnsavedChanges
        });
        
        const result = await saveRoadmapChanges(changeLog, currentVersionRef.current, userId || undefined);
        
        if (result.error) {
          setState(prev => ({ 
            ...prev, 
            isSaving: false, 
            error: result.error || 'Unknown error',
            hasUnsavedChanges: true
          }));
          onSaveError?.(result.error);
        } else {
          currentVersionRef.current = result.data.version;

          setState(prev => ({
            ...prev,
            isSaving: false,
            lastSaved: new Date(),
            error: null,
            hasUnsavedChanges: false
          }));
          onSaveSuccess?.(result.data.version);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: errorMessage,
          hasUnsavedChanges: true
        }));
        onSaveError?.(errorMessage);
      }
    }, delay);

    // Очистка при размонтировании
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [changeTracker.hasUnsavedChanges, delay, enabled, onSaveSuccess, onSaveError]);

  const forceSave = useCallback(async () => {
    if (!data || !enabled) return;

    // Очищаем таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const changeLog = changeTracker.buildChangeLog();
      const result = await saveRoadmapChanges(changeLog, currentVersionRef.current, userId || undefined);
      
      if (result.error) {
        setState(prev => ({ 
          ...prev, 
          isSaving: false, 
          error: result.error || 'Unknown error',
          hasUnsavedChanges: true
        }));
        onSaveError?.(result.error);
      } else {
        currentVersionRef.current = result.data.version;
        
        setState(prev => ({ 
          ...prev, 
          isSaving: false, 
          lastSaved: new Date(),
          error: null,
          hasUnsavedChanges: false
        }));
        onSaveSuccess?.(result.data.version);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ 
        ...prev, 
        isSaving: false, 
        error: errorMessage,
        hasUnsavedChanges: true
      }));
      onSaveError?.(errorMessage);
    }
  }, [data, enabled, changeTracker, onSaveSuccess, onSaveError]);

  const resetState = useCallback(() => {
    setState({
      isSaving: false,
      lastSaved: null,
      error: null,
      hasUnsavedChanges: false
    });
    currentVersionRef.current = 0;
    isInitializedRef.current = false;
  }, []);

  return {
    ...state,
    forceSave,
    resetState
  };
}