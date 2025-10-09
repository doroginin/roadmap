import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TeamMultiSelectProps {
  teams: string[];
  selectedTeams: string[];
  onSelect: (selected: string[]) => void;
  onSaveValue?: (selected: string[]) => void; // Сохраняет значение без закрытия списка
  onTabNext?: () => boolean; // Возвращает true если навигация произошла
  onTabPrev?: () => boolean; // Возвращает true если навигация произошла
  onEscape?: () => void;
}

export function TeamMultiSelect({ teams, selectedTeams, onSelect, onSaveValue, onTabNext, onTabPrev, onEscape }: TeamMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(true); // Автоматически открываем при входе в режим редактирования
  
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  
  // Обновляем позицию dropdown при открытии
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Примерная высота dropdown (с запасом)
      const estimatedDropdownHeight = 300; // max-h-40 (~160px) + padding + search input
      
      // Определяем, достаточно ли места снизу
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;
      
      setDropdownPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: rect.left,
        openUpward
      });
    }
  }, [isOpen]);

  // Обработчик клика вне dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  // Обработчик сохранения команды без закрытия списка
  const handleTeamSave = (team: string) => {
    const newSelected = selectedTeams.includes(team)
      ? selectedTeams.filter(t => t !== team)
      : [...selectedTeams, team];
    if (onSaveValue) {
      onSaveValue(newSelected);
    } else {
      onSelect(newSelected);
    }
  };

  // Обработчик клавиатуры для основного элемента
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const filteredTeams = teams.filter(team => team.toLowerCase().includes(inputValue.toLowerCase()));
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0); // Начинаем с первого элемента
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, filteredTeams.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredTeams.length - 1); // Начинаем с последнего элемента
      } else {
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // В мультиселекте Enter просто закрывает список и переводит в режим просмотра
      setIsOpen(false);
      if (onEscape) {
        onEscape(); // Выходим из режима редактирования
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredTeams.length) {
        handleTeamSave(filteredTeams[highlightedIndex]);
        // Не закрываем список, продолжаем редактирование
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Для мультиселекта не переключаем галку, только сохраняем и переходим
      
      // Пытаемся перейти
      let navigationOccurred = false;
      if (e.shiftKey) {
        if (onTabPrev) {
          navigationOccurred = onTabPrev();
        }
      } else {
        if (onTabNext) {
          navigationOccurred = onTabNext();
        }
      }
      
      // Если навигация не произошла, оставляем список открытым
      if (!navigationOccurred) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Обработчик клавиатуры для поля поиска
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const filteredTeams = teams.filter(team => team.toLowerCase().includes(inputValue.toLowerCase()));
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredTeams.length > 0) {
        setHighlightedIndex(0); // Переходим к первой опции в списке
        // Убираем фокус с поля поиска и переводим на контейнер списка
        (e.target as HTMLInputElement).blur();
        setTimeout(() => {
          const listContainer = dropdownRef.current?.querySelector('.max-h-40');
          if (listContainer) {
            (listContainer as HTMLElement).focus();
          }
        }, 0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredTeams.length > 0) {
        setHighlightedIndex(filteredTeams.length - 1); // Переходим к последней опции в списке
        // Убираем фокус с поля поиска и переводим на контейнер списка
        (e.target as HTMLInputElement).blur();
        setTimeout(() => {
          const listContainer = dropdownRef.current?.querySelector('.max-h-40');
          if (listContainer) {
            (listContainer as HTMLElement).focus();
          }
        }, 0);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // В мультиселекте Enter просто закрывает список и переводит в режим просмотра
      setIsOpen(false);
      if (onEscape) {
        onEscape(); // Выходим из режима редактирования
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Для мультиселекта не переключаем галку, только сохраняем и переходим
      
      // Пытаемся перейти
      let navigationOccurred = false;
      if (e.shiftKey) {
        if (onTabPrev) {
          navigationOccurred = onTabPrev();
        }
      } else {
        if (onTabNext) {
          navigationOccurred = onTabNext();
        }
      }
      
      // Если навигация не произошла, оставляем список открытым
      if (!navigationOccurred) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscape) {
        onEscape(); // Выходим из режима редактирования
      } else {
        setIsOpen(false);
      }
    }
  };

  const filteredTeams = teams.filter(team => team.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <>
      <div
        ref={triggerRef}
        className="w-full h-full flex items-center cursor-pointer bg-white"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid="team-multiselect"
      >
        <span className="truncate px-1">{selectedTeams.join(', ') || 'Выберите команды...'}</span>
        <span className="ml-auto px-1">▾</span>
      </div>
      
      {isOpen && dropdownPosition && createPortal(
        <div 
          ref={dropdownRef}
          className="z-50 bg-white border rounded shadow-lg" 
          style={{ 
            position: 'fixed',
            top: dropdownPosition.openUpward ? undefined : `${dropdownPosition.top}px`,
            bottom: dropdownPosition.openUpward ? `${window.innerHeight - dropdownPosition.top}px` : undefined,
            left: `${dropdownPosition.left}px`,
            backgroundColor: '#ffffff', 
            minWidth: '10em', 
            width: '16rem', 
            maxWidth: '20rem', 
            zIndex: 9999 
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '8px 0' }}>
            <input
              type="text"
              style={{ 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                padding: '8px 12px', 
                width: 'calc(100% - 16px)', 
                margin: '0 8px 8px 8px', 
                boxSizing: 'border-box' 
              }}
              placeholder="Поиск команд..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            
            <div 
              className="max-h-40 overflow-y-auto"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e ) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(prev => Math.min(prev + 1, filteredTeams.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (highlightedIndex <= 0) {
                    // Если мы в самом верху списка, переходим в поле поиска
                    const searchInput = dropdownRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
                    if (searchInput) {
                      searchInput.focus();
                    }
                  } else {
                    setHighlightedIndex(prev => prev - 1);
                  }
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation(); // Останавливаем всплытие события
                  // В мультиселекте Enter просто закрывает список и переводит в режим просмотра
                  setIsOpen(false);
                  if (onEscape) {
                    onEscape(); // Выходим из режима редактирования
                  }
                } else if (e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTeams.length) {
        handleTeamSave(filteredTeams[highlightedIndex]);
        // Не закрываем список, продолжаем редактирование
      }
    } else if (e.key === 'Tab') {
                  e.preventDefault();
                  // Для мультиселекта не переключаем галку, только сохраняем и переходим
                  
                  // Пытаемся перейти
                  let navigationOccurred = false;
                  if (e.shiftKey) {
                    if (onTabPrev) {
                      navigationOccurred = onTabPrev();
                    }
                  } else {
                    if (onTabNext) {
                      navigationOccurred = onTabNext();
                    }
                  }
                  
                  // Если навигация не произошла, оставляем список открытым
                  if (!navigationOccurred) {
                    setIsOpen(true);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              tabIndex={0}
            >
              {filteredTeams.map((team, index) => (
                <label 
                  key={team} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 20px',
                    cursor: 'pointer',
                    backgroundColor: index === highlightedIndex ? '#dbeafe' : 'transparent'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseMove={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => {
                    if (index !== highlightedIndex) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (index !== highlightedIndex) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  data-testid={`team-option-${team}`}
                >
                  <input
                    type="checkbox"
                    style={{ marginRight: '8px' }}
                    checked={selectedTeams.includes(team)}
                    onChange={() => handleTeamSave(team)}
                    data-testid={`team-checkbox-${team}`}
                  />
                  <span>{team}</span>
                </label>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}