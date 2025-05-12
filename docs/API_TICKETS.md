# Tickets API Documentation

REST API для управления тикетами службы поддержки проекта Shrooms.

## Обзор

API предоставляет полный набор endpoints для работы с тикетами службы поддержки, включая создание, чтение, обновление и управление тикетами. API использует строгую типизацию JSDoc и следует стандартам RESTful.

## Архитектура

- **Язык**: JavaScript с JSDoc типизацией (НЕ TypeScript)
- **Фреймворк**: Express.js
- **Аутентификация**: Bearer token для административных endpoints
- **Валидация**: Комплексная валидация входных данных и enum значений
- **База данных**: MongoDB с Mongoose ODM
- **Тестирование**: Jest с супертестами

## Аутентификация

### Типы доступа:
- **Публичный**: Создание тикетов (POST /api/tickets)
- **Пользовательский**: Просмотр своих тикетов (GET /api/tickets/user/:userId)
- **Административный**: Все остальные операции

### Как аутентифицироваться:
```
Authorization: Bearer <your-token>
```

## Типы данных

### TicketStatus
```javascript
'open' | 'in_progress' | 'resolved' | 'closed'
```

### TicketPriority
```javascript
'low' | 'medium' | 'high' | 'urgent'
```

### TicketCategory
```javascript
'technical' | 'account' | 'billing' | 'feature' | 'other'
```

### TicketCreateData
```javascript
{
  userId: string,
  conversationId: string,
  subject: string,
  initialMessage: string,
  context?: string,
  language?: 'en' | 'es' | 'ru',
  priority?: TicketPriority,
  category?: TicketCategory,
  email?: string
}
```

### TicketUpdateData
```javascript
{
  status?: TicketStatus,
  priority?: TicketPriority,
  category?: TicketCategory,
  assignedTo?: string,
  resolution?: string,
  subject?: string
}
```

## Endpoints

### 1. Создать тикет
```http
POST /api/tickets
```

**Доступ**: Публичный

**Тело запроса**:
```json
{
  "userId": "user123",
  "conversationId": "conv456",
  "subject": "Проблема с подключением",
  "initialMessage": "Не могу подключить кошелек",
  "email": "user@example.com"
}
```

**Ответ**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketId": "TKT-001",
    "userId": "user123",
    "subject": "Проблема с подключением",
    "status": "open",
    "priority": "medium",
    "category": "other",
    "createdAt": "2025-05-12T17:00:00.000Z"
  },
  "message": "Ticket created successfully"
}
```

### 2. Получить список тикетов
```http
GET /api/tickets?page=1&limit=20&status=open&priority=high
```

**Доступ**: Административный

**Параметры запроса**:
- `page` (number, optional): Номер страницы (по умолчанию: 1)
- `limit` (number, optional): Количество элементов на странице (по умолчанию: 20, максимум: 100)
- `status` (TicketStatus, optional): Фильтр по статусу
- `priority` (TicketPriority, optional): Фильтр по приоритету
- `category` (TicketCategory, optional): Фильтр по категории
- `assignedTo` (string, optional): Фильтр по исполнителю
- `userId` (string, optional): Фильтр по пользователю
- `search` (string, optional): Поиск в заголовке и тексте
- `sort` (string, optional): Поле для сортировки (по умолчанию: createdAt)
- `order` ('asc' | 'desc', optional): Порядок сортировки (по умолчанию: desc)

**Ответ**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "ticketId": "TKT-001",
        "subject": "Ticket 1",
        "status": "open",
        "priority": "high"
      }
    ],
    "total": 100,
    "page": 1,
    "pages": 5,
    "hasMore": true,
    "limit": 20
  }
}
```

### 3. Получить тикет по ID
```http
GET /api/tickets/TKT-001
```

**Доступ**: Административный

**Ответ**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketId": "TKT-001",
    "userId": "user123",
    "subject": "Проблема с подключением",
    "initialMessage": "Не могу подключить кошелек",
    "status": "open",
    "priority": "medium",
    "category": "technical",
    "createdAt": "2025-05-12T17:00:00.000Z"
  }
}
```

### 4. Обновить тикет
```http
PUT /api/tickets/TKT-001
```

**Доступ**: Административный

**Тело запроса**:
```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "agent123"
}
```

**Ответ**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketId": "TKT-001",
    "status": "in_progress",
    "priority": "high",
    "assignedTo": "agent123",
    "updatedAt": "2025-05-12T18:00:00.000Z"
  },
  "message": "Ticket updated successfully"
}
```

### 5. Закрыть тикет
```http
POST /api/tickets/TKT-001/close
```

**Доступ**: Административный

**Тело запроса**:
```json
{
  "resolution": "Проблема решена перезапуском сервиса",
  "closedBy": "agent123"
}
```

**Ответ**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketId": "TKT-001",
    "status": "closed",
    "resolution": "Проблема решена перезапуском сервиса",
    "resolvedAt": "2025-05-12T19:00:00.000Z"
  },
  "message": "Ticket closed successfully"
}
```

### 6. Назначить тикет исполнителю
```http
POST /api/tickets/TKT-001/assign
```

**Доступ**: Административный

**Тело запроса**:
```json
{
  "assignedTo": "agent123"
}
```

**Ответ**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "ticketId": "TKT-001",
    "assignedTo": "agent123",
    "status": "in_progress"
  },
  "message": "Ticket assigned successfully"
}
```

### 7. Получить тикеты исполнителя
```http
GET /api/tickets/assigned/agent123?status=in_progress&limit=50
```

**Доступ**: Административный

**Ответ**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "ticketId": "TKT-001",
      "assignedTo": "agent123",
      "status": "in_progress"
    }
  ]
}
```

### 8. Получить тикеты пользователя
```http
GET /api/tickets/user/user123?status=open&limit=20
```

**Доступ**: Пользовательский/Административный

**Ответ**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "ticketId": "TKT-001",
      "userId": "user123",
      "status": "open"
    }
  ]
}
```

### 9. Поиск тикетов
```http
GET /api/tickets/search?q=кошелек&status=open&limit=20
```

**Доступ**: Административный

**Ответ**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "ticketId": "TKT-001",
      "subject": "Проблема с кошельком",
      "status": "open"
    }
  ]
}
```

### 10. Получить тикеты по статусу
```http
GET /api/tickets/status/open?assignedTo=agent123&limit=50
```

**Доступ**: Административный

**Ответ**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "ticketId": "TKT-001",
      "status": "open",
      "assignedTo": "agent123"
    }
  ]
}
```

### 11. Получить статистику тикетов
```http
GET /api/tickets/stats
```

**Доступ**: Административный

**Ответ**:
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "open": 15,
      "in_progress": 8,
      "resolved": 25,
      "closed": 100
    },
    "byPriority": {
      "low": 20,
      "medium": 80,
      "high": 40,
      "urgent": 8
    },
    "byCategory": {
      "technical": 60,
      "account": 20,
      "billing": 15,
      "feature": 30,
      "other": 23
    }
  }
}
```

## Коды ошибок

### Общие коды ошибок

| Код | Описание |
|-----|----------|
| `SUCCESS` | Операция выполнена успешно |
| `MISSING_FIELDS` | Отсутствуют обязательные поля |
| `VALIDATION_ERROR` | Ошибка валидации данных |
| `MISSING_AUTH` | Отсутствует токен авторизации |
| `INVALID_AUTH_FORMAT` | Неверный формат токена |
| `INVALID_TOKEN` | Недействительный токен |
| `AUTH_SERVICE_ERROR` | Ошибка службы аутентификации |

### Специфические коды ошибок для тикетов

| Код | Описание |
|-----|----------|
| `TICKET_ID_REQUIRED` | ID тикета обязателен |
| `TICKET_NOT_FOUND` | Тикет не найден |
| `INVALID_TICKET_ID` | Неверный формат ID тикета |
| `INVALID_STATUS` | Недопустимый статус |
| `INVALID_PRIORITY` | Недопустимый приоритет |
| `INVALID_CATEGORY` | Недопустимая категория |
| `RESOLUTION_REQUIRED` | Решение обязательно |
| `ASSIGNED_TO_REQUIRED` | Исполнитель обязателен |
| `USER_ID_REQUIRED` | ID пользователя обязателен |
| `AGENT_ID_REQUIRED` | ID агента обязателен |
| `QUERY_REQUIRED` | Поисковой запрос обязателен |
| `FORBIDDEN` | Доступ запрещен |

## Примеры ошибок

### Ошибка валидации
```json
{
  "success": false,
  "error": "Missing required fields: userId, conversationId",
  "errorCode": "MISSING_FIELDS",
  "statusCode": 400
}
```

### Неавторизованный доступ
```json
{
  "success": false,
  "error": "Access denied. Authorization required.",
  "errorCode": "MISSING_AUTH",
  "statusCode": 401
}
```

### Тикет не найден
```json
{
  "success": false,
  "error": "Ticket not found",
  "errorCode": "TICKET_NOT_FOUND",
  "statusCode": 404
}
```

## Тестирование

API покрыт comprehensive unit и integration тестами с использованием Jest.

Запуск тестов:
```bash
# Запуск всех тестов
npm test

# Запуск конкретного файла тестов
npm test -- server/tests/api/tickets.test.js

# Запуск с покрытием кода
npm test -- --coverage
```

## Логирование

Все операции логируются с соответствующим уровнем:
- `info`: Успешные операции
- `warn`: Предупреждения (например, попытки доступа без авторизации)
- `error`: Ошибки выполнения

Логи включают контекстную информацию:
- ID пользователя/администратора
- ID тикета
- Параметры запроса
- Стек ошибок

## Производительность

- Пагинация ограничена 100 элементами на страницу
- Поиск оптимизирован с использованием индексов
- Lazy-loading сервисов для предотвращения циклических зависимостей
- Валидация на уровне API перед обращением к сервисам

## Совместимость

API полностью совместимо с:
- Существующим TicketService
- Моделью Ticket MongoDB
- Системой типов проекта
- Middleware аутентификации
- Системой логирования

## Расширения

API готово к расширению:
- Добавление новых статусов/приоритетов/категорий
- Интеграция с внешними системами
- Добавление реального времени через WebSocket
- Интеграция с системой уведомлений