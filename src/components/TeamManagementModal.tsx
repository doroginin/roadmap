import React, { useState } from 'react';

type TaskRowLite = { kind: 'task'; team: string };
type ResourceRowLite = { kind: 'resource'; team: string[] };
type RowLite = TaskRowLite | ResourceRowLite;

interface TeamManagementModalProps {
  teams: string[];
  setTeams: React.Dispatch<React.SetStateAction<string[]>>;
  rows: RowLite[];
  onClose: () => void;
}

export function TeamManagementModal({ teams, setTeams, rows, onClose }: TeamManagementModalProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState('');

  // Обработчик добавления новой команды
  const handleAddTeam = () => {
    const trimmedName = newTeamName.trim();
    if (!trimmedName) {
      setError('Название команды не может быть пустым');
      return;
    }
    
    if (teams.includes(trimmedName)) {
      setError('Команда с таким названием уже существует');
      return;
    }
    
    setTeams(prev => [...prev, trimmedName]);
    setNewTeamName('');
    setError('');
  };

  // Обработчик удаления команды
  const handleDeleteTeam = (teamToDelete: string) => {
    // Проверяем использование команды в строках
    const isUsedInTasks = rows.some(row => row.kind === 'task' && row.team === teamToDelete);
    const isUsedInResources = rows.some(row => row.kind === 'resource' && row.team.includes(teamToDelete));
    
    if (isUsedInTasks || isUsedInResources) {
      const usageDetails = [
        isUsedInTasks ? 'задачах' : '',
        isUsedInResources ? 'ресурсах' : ''
      ].filter(Boolean).join(' и ');
      
      const confirmDelete = confirm(`Команда "${teamToDelete}" используется в ${usageDetails}. Вы уверены, что хотите удалить её?`);
      if (!confirmDelete) return;
    }
    
    setTeams(prev => prev.filter(team => team !== teamToDelete));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#ffffff' }}>
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Управление командами</h2>
        </div>
        
        <div className="px-6 py-4 flex-grow overflow-y-auto">
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="border rounded px-3 py-2 flex-grow box-border"
                placeholder="Название новой команды"
                value={newTeamName}
                onChange={(e) => {
                  setNewTeamName(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
              />
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
              >
                Добавить
              </button>
            </div>
            {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
          </div>
          
          <div className="border rounded">
            <div className="max-h-60 overflow-y-auto">
              {teams.length === 0 ? (
                <div className="px-4 py-3 text-gray-500 text-center">
                  Нет команд
                </div>
              ) : (
                teams.map(team => {
                  // Проверяем использование команды
                  const isUsedInTasks = rows.some(row => row.kind === 'task' && row.team === team);
                  const isUsedInResources = rows.some(row => row.kind === 'resource' && row.team.includes(team));
                  
                  return (
                    <div 
                      key={team} 
                      className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <span className="truncate">{team}</span>
                      <button
                        className={`text-sm px-2 py-1 rounded ${
                          (isUsedInTasks || isUsedInResources) 
                            ? 'bg-yellow-100 text-yellow-800 cursor-help' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                        onClick={() => handleDeleteTeam(team)}
                        title={
                          (isUsedInTasks || isUsedInResources) 
                            ? `Используется в ${[
                              isUsedInTasks ? 'задачах' : '',
                              isUsedInResources ? 'ресурсах' : ''
                            ].filter(Boolean).join(' и ')}` 
                            : 'Удалить команду'
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}