import { useState, useRef, useEffect } from 'react';

interface TeamSelectProps {
  teams: string[];
  selectedTeam: string;
  onSelect: (selected: string) => void;
  onAddNewTeam: (newTeam: string) => void;
}

export function TeamSelect({ teams, selectedTeam, onSelect, onAddNewTeam }: TeamSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [newTeamInput, setNewTeamInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Обработчик клика вне dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Обработчик выбора команды
  const handleTeamSelect = (team: string) => {
    onSelect(team);
    setIsOpen(false);
  };

  // Обработчик добавления новой команды
  const handleAddNewTeam = () => {
    if (newTeamInput.trim() && !teams.includes(newTeamInput.trim())) {
      onAddNewTeam(newTeamInput.trim());
      setNewTeamInput('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="border rounded px-1 py-0.5 w-24 h-8 box-border flex items-center cursor-pointer bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedTeam || 'Выберите команду...'}</span>
        <span className="ml-auto">▾</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 max-w-xs bg-white border rounded shadow-lg" style={{ backgroundColor: '#ffffff' }}>
          <div className="p-2">
            <input
              type="text"
              className="border rounded px-2 py-1 w-full mb-2 box-border"
              placeholder="Поиск команд..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            
            <div className="max-h-40 overflow-y-auto">
              {teams
                .filter(team => team.toLowerCase().includes(inputValue.toLowerCase()))
                .map(team => (
                  <div
                    key={team}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleTeamSelect(team)}
                  >
                    {team}
                  </div>
                ))
              }
              {inputValue && !teams.includes(inputValue) && (
                <div
                  className="p-2 hover:bg-gray-100 cursor-pointer text-blue-500"
                  onClick={handleAddNewTeam}
                >
                  + Добавить "{inputValue}"
                </div>
              )}
            </div>
            
            <div className="border-t mt-2 pt-2">
              <input
                type="text"
                className="border rounded px-2 py-1 w-full box-border"
                placeholder="Новая команда"
                value={newTeamInput}
                onChange={(e) => setNewTeamInput(e.target.value)}
                onKeyDown={(e) => {
                  if(e.key==='Enter') {
                    handleAddNewTeam();
                  }
                  if(e.key==='Escape'){
                    setIsOpen(false);
                  }
                }}
              />
              <button
                className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm w-full"
                onClick={handleAddNewTeam}
                disabled={!newTeamInput.trim() || teams.includes(newTeamInput.trim())}
              >
                Добавить команду
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamMultiSelectProps {
  teams: string[];
  selectedTeams: string[];
  onSelect: (selected: string[]) => void;
  onAddNewTeam: (newTeam: string) => void;
}

export function TeamMultiSelect({ teams, selectedTeams, onSelect, onAddNewTeam }: TeamMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [newTeamInput, setNewTeamInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Обработчик клика вне dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Обработчик выбора команды
  const handleTeamChange = (team: string) => {
    const newSelected = selectedTeams.includes(team)
      ? selectedTeams.filter(t => t !== team)
      : [...selectedTeams, team];
    onSelect(newSelected);
  };

  // Обработчик добавления новой команды
  const handleAddNewTeam = () => {
    if (newTeamInput.trim() && !teams.includes(newTeamInput.trim()) && !selectedTeams.includes(newTeamInput.trim())) {
      onAddNewTeam(newTeamInput.trim());
      setNewTeamInput('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="border rounded px-1 py-0.5 w-40 h-8 box-border flex items-center cursor-pointer bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedTeams.join(', ') || 'Выберите команды...'}</span>
        <span className="ml-auto">▾</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 max-w-xs bg-white border rounded shadow-lg" style={{ backgroundColor: '#ffffff' }}>
          <div className="p-2">
            <input
              type="text"
              className="border rounded px-2 py-1 w-full mb-2 box-border"
              placeholder="Поиск команд..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            
            <div className="max-h-40 overflow-y-auto">
              {teams
                .filter(team => team.toLowerCase().includes(inputValue.toLowerCase()))
                .map(team => (
                  <label key={team} className="flex items-center p-2 hover:bg-gray-100">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={selectedTeams.includes(team)}
                      onChange={() => handleTeamChange(team)}
                    />
                    <span>{team}</span>
                  </label>
                ))
              }
              {inputValue && !teams.includes(inputValue) && !selectedTeams.includes(inputValue) && (
                <div
                  className="p-2 hover:bg-gray-100 cursor-pointer text-blue-500"
                  onClick={() => {
                    onAddNewTeam(inputValue.trim());
                    setNewTeamInput('');
                    setIsOpen(false);
                  }}
                >
                  + Добавить "{inputValue}"
                </div>
              )}
            </div>
            
            <div className="border-t mt-2 pt-2">
              <input
                type="text"
                className="border rounded px-2 py-1 w-full box-border"
                placeholder="Новая команда"
                value={newTeamInput}
                onChange={(e) => setNewTeamInput(e.target.value)}
                onKeyDown={(e) => {
                  if(e.key==='Enter') {
                    handleAddNewTeam();
                  }
                  if(e.key==='Escape'){
                    setIsOpen(false);
                  }
                }}
              />
              <button
                className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm w-full"
                onClick={handleAddNewTeam}
                disabled={!newTeamInput.trim() || teams.includes(newTeamInput.trim())}
              >
                Добавить команду
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}