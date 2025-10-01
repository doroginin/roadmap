import { RoadmapPlan } from './components/RoadmapPlan'
import { SaveStatus } from './components/SaveStatus'
import { useAutoSave } from './hooks/useAutoSave'
import { useState, useEffect } from 'react'
import { fetchRoadmapData } from './api/roadmapApi'
import type { RoadmapData } from './api/types'

function App() {
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные при монтировании
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchRoadmapData();
        
        if (response.error) {
          setError(response.error);
        } else {
          setRoadmapData(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Настройка автосохранения
  const autoSave = useAutoSave(roadmapData, {
    delay: 2000, // 2 секунды задержки
    enabled: false, // Отключено автосохранение - используем только ручную кнопку "Сохранить"
    onSaveSuccess: (version) => {
      console.log('Data saved successfully, version:', version);
    },
    onSaveError: (error) => {
      console.error('Save error:', error);
    }
  });

  if (loading) {
    return (
      <div className="container mx-auto p-4" data-testid="loading-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка данных...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4" data-testid="error-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Ошибка загрузки:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto" data-testid="app-container">
      {/* Статус сохранения */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-2" data-testid="save-status-bar">
        <SaveStatus 
          state={autoSave} 
          onForceSave={autoSave.forceSave}
        />
      </div>
      
      {/* Основной компонент */}
      <RoadmapPlan 
        initialData={roadmapData}
        onDataChange={setRoadmapData}
        onSaveRequest={autoSave.forceSave}
      />
    </div>
  )
}

export default App
