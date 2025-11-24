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
    delay = 1000,
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

  // Ref для changeTracker чтобы избежать stale closure в setTimeout
  const changeTrackerRef = useRef(changeTracker);
  changeTrackerRef.current = changeTracker;

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
    
    // Обновляем состояние только если оно действительно изменилось
    setState(prev => {
      if (prev.hasUnsavedChanges === true) {
        return prev; // Не обновляем, если уже true
      }
      return { ...prev, hasUnsavedChanges: true };
    });

    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Устанавливаем новый таймер
    timeoutRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, isSaving: true, error: null }));

      try {
        // Используем ref для получения актуального changeTracker (избегаем stale closure)
        const currentChangeTracker = changeTrackerRef.current;

        // Получаем лог изменений только когда нужно сохранить
        const changeLog = currentChangeTracker.buildChangeLog();

        const result = await saveRoadmapChanges(changeLog, currentVersionRef.current, userId || undefined);
        
        if (result.error) {
          setState(prev => {
            const newState = { 
              ...prev, 
              isSaving: false, 
              error: result.error || 'Unknown error',
              hasUnsavedChanges: true
            };
            // Проверяем, действительно ли состояние изменилось
            if (prev.isSaving === newState.isSaving && 
                prev.error === newState.error && 
                prev.hasUnsavedChanges === newState.hasUnsavedChanges) {
              return prev;
            }
            return newState;
          });
          onSaveError?.(result.error);
        } else {
          currentVersionRef.current = result.data.version;

          setState(prev => {
            const newState = {
              ...prev,
              isSaving: false,
              lastSaved: new Date(),
              error: null,
              hasUnsavedChanges: false
            };
            // Проверяем, действительно ли состояние изменилось
            if (prev.isSaving === newState.isSaving && 
                prev.lastSaved?.getTime() === newState.lastSaved?.getTime() && 
                prev.error === newState.error && 
                prev.hasUnsavedChanges === newState.hasUnsavedChanges) {
              return prev;
            }
            return newState;
          });
          
          // Очищаем изменения в трекере
          currentChangeTracker.clearChanges();
          
          onSaveSuccess?.(result.data.version);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => {
          const newState = {
            ...prev,
            isSaving: false,
            error: errorMessage,
            hasUnsavedChanges: true
          };
          // Проверяем, действительно ли состояние изменилось
          if (prev.isSaving === newState.isSaving && 
              prev.error === newState.error && 
              prev.hasUnsavedChanges === newState.hasUnsavedChanges) {
            return prev;
          }
          return newState;
        });
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
        
        // Очищаем изменения в трекере
        changeTracker.clearChanges();
        
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