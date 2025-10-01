import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRoadmapData } from '../api/roadmapApi';
import type { RoadmapData, AutoSaveState, UseAutoSaveOptions } from '../api/types';

export function useAutoSave(
  data: RoadmapData | null,
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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);
  const currentVersionRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  // Эффект для автосохранения с задержкой
  useEffect(() => {
    if (!data || !enabled) return;

    // Инициализация при первой загрузке данных
    if (!isInitializedRef.current) {
      currentVersionRef.current = data.version;
      lastSavedDataRef.current = JSON.stringify(data);
      isInitializedRef.current = true;
      setState(prev => ({ 
        ...prev, 
        hasUnsavedChanges: false,
        lastSaved: new Date()
      }));
      return;
    }

    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Проверяем, изменились ли данные
    const newDataString = JSON.stringify(data);
    const hasChanges = lastSavedDataRef.current !== newDataString;
    
    if (hasChanges) {
      setState(prev => ({ ...prev, hasUnsavedChanges: true }));

      // Устанавливаем новый таймер
      timeoutRef.current = setTimeout(async () => {
        setState(prev => ({ ...prev, isSaving: true, error: null }));

        try {
          const result = await saveRoadmapData(data, currentVersionRef.current);
          
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
            lastSavedDataRef.current = JSON.stringify(data);
            
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
    }

    // Очистка при размонтировании
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, onSaveSuccess, onSaveError]);

  const forceSave = useCallback(async () => {
    if (!data || !enabled) return;

    // Очищаем таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const result = await saveRoadmapData(data, currentVersionRef.current);
      
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
        lastSavedDataRef.current = JSON.stringify(data);
        
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
  }, [data, enabled, onSaveSuccess, onSaveError]);

  const resetState = useCallback(() => {
    setState({
      isSaving: false,
      lastSaved: null,
      error: null,
      hasUnsavedChanges: false
    });
    lastSavedDataRef.current = null;
    currentVersionRef.current = 0;
    isInitializedRef.current = false;
  }, []);

  return {
    ...state,
    forceSave,
    resetState
  };
}