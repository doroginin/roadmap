# Автоматическое сохранение

## Обзор

В приложении реализована система автоматического сохранения, которая сохраняет изменения данных через 2 секунды после их внесения, используя API endpoint `PUT /api/v1/data`.

## Компоненты

### 1. Хук `useAutoSave`

**Расположение:** `src/hooks/useAutoSave.ts`

**Функциональность:**
- Отслеживает изменения в данных
- Автоматически сохраняет изменения с задержкой (по умолчанию 2 секунды)
- Обрабатывает конфликты версий
- Предоставляет состояние сохранения

**Использование:**
```typescript
const autoSave = useAutoSave(roadmapData, {
  delay: 2000, // задержка в миллисекундах
  enabled: true,
  onSaveSuccess: (version) => console.log('Сохранено, версия:', version),
  onSaveError: (error) => console.error('Ошибка сохранения:', error)
});
```

### 2. Компонент `SaveStatus`

**Расположение:** `src/components/SaveStatus.tsx`

**Функциональность:**
- Отображает текущий статус сохранения
- Показывает время последнего сохранения
- Предупреждает о несохраненных изменениях
- Предоставляет кнопку принудительного сохранения

### 3. API функции

**Расположение:** `src/api/roadmapApi.ts`

**Функции:**
- `saveRoadmapData()` - сохранение данных через PUT /api/v1/data
- `fetchRoadmapData()` - загрузка данных через GET /api/v1/data
- `fetchVersion()` - получение текущей версии через GET /api/v1/version

## Интеграция

### В App.tsx

```typescript
// Загружаем данные
const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);

// Настраиваем автосохранение
const autoSave = useAutoSave(roadmapData, {
  delay: 2000,
  enabled: true,
  onSaveSuccess: (version) => console.log('Сохранено, версия:', version),
  onSaveError: (error) => console.error('Ошибка сохранения:', error)
});

// Передаем данные в компонент
<RoadmapPlan 
  initialData={roadmapData}
  onDataChange={setRoadmapData}
/>
```

### В RoadmapPlan.tsx

```typescript
interface RoadmapPlanProps {
  initialData?: RoadmapData | null;
  onDataChange?: (data: RoadmapData) => void;
}

// Уведомляем о изменениях
const notifyDataChange = useCallback(() => {
  if (!onDataChange) return;
  
  const roadmapData: RoadmapData = {
    version: 0,
    teams: teamData,
    sprints: sprints,
    functions: [],
    employees: [],
    resources: resources,
    tasks: tasks
  };
  
  onDataChange(roadmapData);
}, [rows, teamData, sprints, onDataChange]);
```

## Состояния сохранения

1. **Сохранение** - отображается спиннер и текст "Сохранение..."
2. **Сохранено** - зеленый индикатор с временем последнего сохранения
3. **Несохраненные изменения** - оранжевый индикатор с кнопкой "Сохранить сейчас"
4. **Ошибка** - красный индикатор с описанием ошибки и кнопкой "Повторить"

## Настройки

### Задержка автосохранения
По умолчанию: 2 секунды
```typescript
const autoSave = useAutoSave(data, { delay: 3000 }); // 3 секунды
```

### Отключение автосохранения
```typescript
const autoSave = useAutoSave(data, { enabled: false });
```

### Принудительное сохранение
```typescript
await autoSave.forceSave();
```

## Обработка ошибок

Система автоматически обрабатывает:
- Сетевые ошибки
- Конфликты версий (409)
- Ошибки валидации (400)
- Таймауты

При ошибке пользователь может:
- Повторить сохранение кнопкой "Повторить"
- Продолжить работу (изменения остаются в локальном состоянии)

## Производительность

- Изменения группируются и сохраняются батчами
- Таймер сбрасывается при каждом новом изменении
- Сравнение данных происходит через JSON.stringify для простоты
- Версия данных отслеживается для предотвращения конфликтов

