# Roadmap Application Backend

Go backend для приложения планирования roadmap с поддержкой версионирования и оптимистичной блокировки.

## Архитектура

- **PostgreSQL** - база данных для хранения всех данных
- **Go** - backend API сервер
- **Gin** - HTTP фреймворк
- **Версионирование** - автоматическое отслеживание изменений с инкрементальными версиями

## Структура проекта

```
.
├── cmd/service/main.go          # Точка входа приложения
├── internal/
│   ├── api/handlers.go          # HTTP handlers
│   ├── config/config.go         # Конфигурация
│   ├── models/models.go         # Модели данных
│   ├── repository/repository.go # Слой работы с БД
│   └── service/service.go       # Бизнес-логика
├── db/changelog/master/         # SQL миграции
│   ├── 001_initial_schema.sql   # Начальная схема БД
│   ├── 002_seed_data.sql        # Тестовые данные
│   └── 003_migrate_test_tasks.sql # Миграция задач из React
├── go.mod                       # Go модули
└── README.md                    # Документация
```

## API Endpoints

### GET /api/v1/version
Легкая ручка для получения текущей версии документа. Клиент должен вызывать её каждую секунду для проверки изменений.

**Response:**
```json
{
  "version": 123
}
```

### GET /api/v1/data
Получение всех данных с текущей версией.

**Response:**
```json
{
  "version": 123,
  "teams": [...],
  "sprints": [...],
  "functions": [...],
  "employees": [...],
  "resources": [...],
  "tasks": [...]
}
```

### GET /api/v1/data/diff/:fromVersion
Получение изменений начиная с указанной версии до актуальной.

**Response:**
```json
{
  "version": 125,
  "changes": [
    {
      "version": 124,
      "table": "tasks",
      "recordId": "uuid",
      "operation": "UPDATE",
      "oldData": {...},
      "newData": {...}
    }
  ]
}
```

### PUT /api/v1/data
Обновление данных с проверкой версии (оптимистичная блокировка).

**Request:**
```json
{
  "version": 123,
  "teams": [...],
  "sprints": [...],
  "functions": [...],
  "employees": [...],
  "resources": [...],
  "tasks": [...],
  "deleted": {
    "tasks": ["uuid1", "uuid2"]
  }
}
```

**Response (успех):**
```json
{
  "version": 124,
  "success": true
}
```

**Response (конфликт версий):**
```json
{
  "success": false,
  "error": "Version conflict: client version 123, server version 125"
}
```

## Логика версионирования

1. **Автоматическое версионирование**: При любом изменении данных версия автоматически увеличивается
2. **Оптимистичная блокировка**: Клиент должен передавать текущую известную ему версию при обновлении
3. **Конфликт версий**: Если версия клиента устарела, сервер возвращает ошибку
4. **Разрешение конфликтов**: Клиент должен получить актуальные данные через diff API и повторить запрос

## Workflow клиента

1. **Инициализация**: Получить все данные через `GET /api/v1/data`
2. **Мониторинг**: Каждую секунду проверять версию через `GET /api/v1/version`
3. **Обнаружение изменений**: Если версия изменилась, получить diff через `GET /api/v1/data/diff/:version`
4. **Обновление данных**: При сохранении передавать текущую версию в `PUT /api/v1/data`
5. **Обработка конфликтов**: При получении 409 Conflict получить актуальные данные и повторить запрос

## База данных

### Основные таблицы:
- `teams` - команды
- `sprints` - спринты  
- `functions` - функции (fn)
- `employees` - сотрудники
- `resources` - ресурсные строки
- `tasks` - задачи

### Служебные таблицы:
- `document_versions` - текущая версия документа
- `change_log` - лог всех изменений для diff API

## Запуск

### Переменные окружения:
- `DATABASE_URL` - строка подключения к PostgreSQL (по умолчанию: `postgres://user:password@localhost/roadmap?sslmode=disable`)
- `PORT` - порт сервера (по умолчанию: `8080`)

### Команды:
```bash
# Установка зависимостей
go mod download

# Запуск сервера
go run cmd/service/main.go

# Или сборка и запуск
go build -o roadmap cmd/service/main.go
./roadmap
```

### Настройка базы данных:
1. Создать базу данных PostgreSQL
2. Выполнить миграции из `db/changelog/master/` в порядке номеров
3. Настроить `DATABASE_URL` для подключения

## Особенности реализации

- **Транзакции**: Все обновления выполняются в транзакциях
- **CORS**: Настроен для работы с фронтендом
- **Триггеры**: Автоматическое обновление `updated_at` и логирование изменений
- **UUID**: Использование UUID для всех ID записей
- **Массивы**: Поддержка PostgreSQL массивов для weeks, team_ids, blocker_ids и т.д.