# API Usage Examples

## Примеры использования API

### 1. Получение текущей версии (легкая ручка)

```bash
curl -X GET http://localhost:8080/api/v1/version
```

**Response:**
```json
{
  "version": 1
}
```

### 2. Получение всех данных

```bash
curl -X GET http://localhost:8080/api/v1/data
```

**Response:**
```json
{
  "version": 1,
  "teams": [
    {
      "id": "uuid",
      "name": "Demo",
      "jiraProject": "",
      "featureTeam": "",
      "issueType": ""
    }
  ],
  "sprints": [
    {
      "id": "uuid",
      "code": "Q3S1",
      "start": "2025-06-02",
      "end": "2025-06-29"
    }
  ],
  "functions": [...],
  "employees": [...],
  "resources": [...],
  "tasks": [...]
}
```

### 3. Получение изменений с версии 1

```bash
curl -X GET http://localhost:8080/api/v1/data/diff/1
```

**Response:**
```json
{
  "version": 5,
  "changes": [
    {
      "version": 2,
      "table": "tasks",
      "recordId": "uuid",
      "operation": "UPDATE",
      "oldData": {...},
      "newData": {...}
    }
  ]
}
```

### 4. Обновление данных

```bash
curl -X PUT http://localhost:8080/api/v1/data \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "tasks": [
      {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "kind": "task",
        "status": "Todo",
        "task": "Updated task name",
        "team": "Test",
        "fn": "FN1",
        "planEmpl": 2,
        "planWeeks": 3,
        "weeks": [0,0,1,1,1,0,0,0,0]
      }
    ]
  }'
```

**Success Response:**
```json
{
  "version": 2,
  "success": true
}
```

**Version Conflict Response (409):**
```json
{
  "success": false,
  "error": "Version conflict: client version 1, server version 3"
}
```

## Workflow клиента

### JavaScript пример

```javascript
class RoadmapClient {
  constructor(baseUrl = 'http://localhost:8080/api/v1') {
    this.baseUrl = baseUrl;
    this.currentVersion = null;
    this.data = null;
  }

  // Инициализация - получение всех данных
  async initialize() {
    const response = await fetch(`${this.baseUrl}/data`);
    const data = await response.json();
    
    this.currentVersion = data.version;
    this.data = data;
    
    // Запуск мониторинга версий
    this.startVersionMonitoring();
    
    return data;
  }

  // Мониторинг версий каждую секунду
  startVersionMonitoring() {
    setInterval(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/version`);
        const { version } = await response.json();
        
        if (version !== this.currentVersion) {
          await this.syncChanges();
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    }, 1000);
  }

  // Синхронизация изменений
  async syncChanges() {
    try {
      const response = await fetch(`${this.baseUrl}/data/diff/${this.currentVersion}`);
      const { version, changes } = await response.json();
      
      // Применить изменения к локальным данным
      this.applyChanges(changes);
      this.currentVersion = version;
      
      // Уведомить UI об изменениях
      this.onDataChanged(changes);
    } catch (error) {
      console.error('Sync failed:', error);
      // Fallback - получить все данные заново
      await this.initialize();
    }
  }

  // Применение изменений к локальным данным
  applyChanges(changes) {
    changes.forEach(change => {
      const { table, recordId, operation, newData } = change;
      
      switch (operation) {
        case 'INSERT':
          this.data[table].push(newData);
          break;
        case 'UPDATE':
          const index = this.data[table].findIndex(item => item.id === recordId);
          if (index !== -1) {
            this.data[table][index] = newData;
          }
          break;
        case 'DELETE':
          this.data[table] = this.data[table].filter(item => item.id !== recordId);
          break;
      }
    });
  }

  // Сохранение изменений с обработкой конфликтов
  async saveChanges(updates) {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const response = await fetch(`${this.baseUrl}/data`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: this.currentVersion,
            ...updates
          })
        });

        const result = await response.json();

        if (result.success) {
          this.currentVersion = result.version;
          return result;
        } else if (response.status === 409) {
          // Конфликт версий - синхронизируемся и повторяем
          console.log('Version conflict, syncing...');
          await this.syncChanges();
          retries++;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Save failed:', error);
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Callback для уведомления UI об изменениях
  onDataChanged(changes) {
    // Переопределить в наследнике
    console.log('Data changed:', changes);
  }
}

// Использование
const client = new RoadmapClient();

// Инициализация
client.initialize().then(data => {
  console.log('Initial data loaded:', data);
});

// Сохранение изменений
client.saveChanges({
  tasks: [
    {
      id: 'task-uuid',
      status: 'Todo',
      task: 'Updated task',
      // ... другие поля
    }
  ]
}).then(result => {
  console.log('Changes saved:', result);
}).catch(error => {
  console.error('Save failed:', error);
});
```

## Обработка ошибок

### Типичные сценарии:

1. **Конфликт версий (409)**: Клиент пытается сохранить изменения на основе устаревшей версии
   - Получить актуальные изменения через diff API
   - Применить изменения к локальным данным
   - Повторить запрос на сохранение

2. **Сетевые ошибки**: Временная недоступность сервера
   - Повторить запрос с экспоненциальной задержкой
   - Показать пользователю статус подключения

3. **Ошибки валидации (400)**: Некорректные данные
   - Показать пользователю детали ошибки
   - Не повторять запрос без исправления данных

## Производительность

### Оптимизации:

1. **Легкая ручка версий**: Минимальная нагрузка для частых проверок
2. **Diff API**: Передача только изменений вместо всех данных
3. **Батчинг**: Группировка изменений в один запрос
4. **Кэширование**: Локальное хранение данных с синхронизацией
