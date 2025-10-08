import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SelectProps {
  options: string[];
  selectedValue: string;
  onSelect: (selected: string) => void;
  onSaveValue?: (selected: string) => void; // Сохраняет значение без закрытия списка
  onTabNext?: () => boolean; // Возвращает true если навигация произошла
  onTabPrev?: () => boolean; // Возвращает true если навигация произошла
  onEscape?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function Select({ options, selectedValue, onSelect, onSaveValue, onTabNext, onTabPrev, onEscape, placeholder = "Выберите...", searchPlaceholder = "Поиск..." }: SelectProps) {
  const [isOpen, setIsOpen] = useState(true); // Автоматически открываем при входе в режим редактирования
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  
  // При открытии списка выбираем текущий элемент
  useEffect(() => {
    if (isOpen && selectedValue) {
      const filteredOptions = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));
      const currentIndex = filteredOptions.findIndex(option => option === selectedValue);
      if (currentIndex >= 0) {
        setHighlightedIndex(currentIndex);
      }
    }
  }, [isOpen, selectedValue, options, inputValue]);
  
  // Обновляем позицию dropdown при открытии
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left
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

  // Обработчик выбора опции
  const handleOptionSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };

  // Обработчик клавиатуры для основного элемента
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const filteredOptions = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        // При открытии списка выбираем текущий элемент, если он есть
        if (selectedValue) {
          const currentIndex = filteredOptions.findIndex(option => option === selectedValue);
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        } else {
          setHighlightedIndex(0); // Начинаем с первого элемента
        }
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        // При открытии списка выбираем текущий элемент, если он есть
        if (selectedValue) {
          const currentIndex = filteredOptions.findIndex(option => option === selectedValue);
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : filteredOptions.length - 1);
        } else {
          setHighlightedIndex(filteredOptions.length - 1); // Начинаем с последнего элемента
        }
      } else {
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleOptionSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleOptionSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
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
      
      // Если навигация произошла, выбираем текущий выделенный элемент и закрываем список
      if (navigationOccurred) {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          // Сохраняем значение и закрываем список
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          setIsOpen(false);
        } else {
          setIsOpen(false);
        }
      } else {
        // Если навигация не произошла, сохраняем текущее выбранное значение, но оставляем список открытым
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          // Не закрываем список - редактирование продолжается
        }
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

  // Обработчик клавиатуры для поля поиска
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const filteredOptions = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        // При переходе из поля поиска выбираем текущий элемент, если он есть
        if (selectedValue) {
          const currentIndex = filteredOptions.findIndex(option => option === selectedValue);
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        } else {
          setHighlightedIndex(0); // Переходим к первой опции в списке
        }
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
      if (filteredOptions.length > 0) {
        // При переходе из поля поиска выбираем текущий элемент, если он есть
        if (selectedValue) {
          const currentIndex = filteredOptions.findIndex(option => option === selectedValue);
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : filteredOptions.length - 1);
        } else {
          setHighlightedIndex(filteredOptions.length - 1); // Переходим к последней опции в списке
        }
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
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleOptionSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
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
      
      // Если навигация произошла, выбираем текущий выделенный элемент и закрываем список
      if (navigationOccurred) {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          // Сохраняем значение и закрываем список
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          setIsOpen(false);
        } else {
          setIsOpen(false);
        }
      } else {
        // Если навигация не произошла, сохраняем текущее выбранное значение, но оставляем список открытым
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          // Не закрываем список - редактирование продолжается
        }
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

  const filteredOptions = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <>
      <div
        ref={triggerRef}
        className="w-full h-full flex items-center cursor-pointer bg-white"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <span className="truncate px-1">{selectedValue || placeholder}</span>
        <span className="ml-auto px-1">▾</span>
      </div>
      
      {isOpen && dropdownPosition && createPortal(
        <div 
          ref={dropdownRef}
          className="z-50 bg-white border rounded shadow-lg" 
          style={{ 
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
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
              placeholder={searchPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            
            <div 
              className="max-h-40 overflow-y-auto"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
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
                  if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    // Сохраняем значение и закрываем список
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          setIsOpen(false);
                  }
                } else if (e.key === ' ') {
                  e.preventDefault();
                  if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    handleOptionSelect(filteredOptions[highlightedIndex]);
                  }
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  
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
                  
                  // Если навигация произошла, выбираем текущий выделенный элемент и закрываем список
                  if (navigationOccurred) {
                    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                      // Сохраняем значение и закрываем список
          if (onSaveValue) {
            onSaveValue(filteredOptions[highlightedIndex]);
          } else {
            onSelect(filteredOptions[highlightedIndex]);
          }
          setIsOpen(false);
                    } else {
                      setIsOpen(false);
                    }
                  } else {
                    // Если навигация не произошла, сохраняем текущее выбранное значение, но оставляем список открытым
                    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                      if (onSaveValue) {
                        onSaveValue(filteredOptions[highlightedIndex]);
                      } else {
                        onSelect(filteredOptions[highlightedIndex]);
                      }
                      // Не закрываем список - редактирование продолжается
                    }
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              tabIndex={0}
            >
              {filteredOptions.map((option, index) => (
                <div
                  key={option}
                  style={{
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
                  onClick={() => handleOptionSelect(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}