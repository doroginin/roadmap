import { useState, useEffect, useCallback } from 'react';

/**
 * Тип для состояния фильтра одной колонки
 */
export type FilterValue = {
  search: string;
  selected: Set<string>;
};

/**
 * Тип для всех фильтров (ключ = ID колонки)
 */
export type FilterState<T extends string = string> = {
  [K in T]?: FilterValue;
};

/**
 * Хук для синхронизации состояния фильтров с URL query параметрами.
 *
 * Формат URL:
 * - ?filter_team=Team1,Team2 - selected values (comma-separated)
 * - ?filter_team_search=foo - search string for the column
 *
 * @example
 * const [filters, setFilters] = useUrlFilters<ColumnId>();
 */
export function useUrlFilters<T extends string = string>(): [
  FilterState<T>,
  (filters: FilterState<T>) => void
] {
  // Функция для парсинга фильтров из URL
  const parseFiltersFromUrl = useCallback((): FilterState<T> => {
    const params = new URLSearchParams(window.location.search);
    const filters: FilterState<T> = {};

    // Получаем все параметры, начинающиеся с "filter_"
    const filterParams = new Set<string>();
    params.forEach((_, key) => {
      if (key.startsWith('filter_')) {
        // Извлекаем имя колонки из ключа
        const columnName = key.replace('filter_', '').replace('_search', '');
        filterParams.add(columnName);
      }
    });

    // Парсим каждую колонку
    filterParams.forEach((columnName) => {
      const selectedParam = params.get(`filter_${columnName}`);
      const searchParam = params.get(`filter_${columnName}_search`);

      // Создаем фильтр только если есть хотя бы один параметр
      if (selectedParam !== null || searchParam !== null) {
        const selected = new Set<string>();

        if (selectedParam) {
          // Парсим comma-separated значения
          // Декодируем каждое значение отдельно
          selectedParam.split(',').forEach((value) => {
            const decoded = decodeURIComponent(value.trim());
            if (decoded) {
              selected.add(decoded);
            }
          });
        }

        filters[columnName as T] = {
          search: searchParam || '',
          selected,
        };
      }
    });

    return filters;
  }, []);

  // Функция для сохранения фильтров в URL
  const saveFiltersToUrl = useCallback((filters: FilterState<T>) => {
    const params = new URLSearchParams();

    // Добавляем каждый фильтр в URL
    Object.entries(filters).forEach(([columnName, filterValue]) => {
      const filter = filterValue as FilterValue;

      // Добавляем selected values
      if (filter.selected && filter.selected.size > 0) {
        const values = Array.from(filter.selected)
          .map((v) => encodeURIComponent(v))
          .join(',');
        params.set(`filter_${columnName}`, values);
      }

      // Добавляем search string
      if (filter.search) {
        params.set(`filter_${columnName}_search`, filter.search);
      }
    });

    // Обновляем URL без перезагрузки страницы
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, []);

  // Инициализируем состояние из URL
  const [filters, setFiltersState] = useState<FilterState<T>>(() => parseFiltersFromUrl());

  // Обработчик события popstate (браузерная навигация назад/вперед)
  useEffect(() => {
    const handlePopState = () => {
      setFiltersState(parseFiltersFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseFiltersFromUrl]);

  // Обертка для setFilters, которая также обновляет URL
  const setFilters = useCallback(
    (newFilters: FilterState<T>) => {
      setFiltersState(newFilters);
      saveFiltersToUrl(newFilters);
    },
    [saveFiltersToUrl]
  );

  return [filters, setFilters];
}
