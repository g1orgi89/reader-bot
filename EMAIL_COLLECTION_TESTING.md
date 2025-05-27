# 🍄 Тестирование интеграции с ticketEmailService

## Обзор изменений

Мы интегрировали `ticketEmailService` с Chat API для автоматического сбора email при создании тикетов поддержки. Теперь бот:

1. **Создает тикет** когда Claude или `ticketEmailService` определяют необходимость
2. **Запрашивает email** у пользователя для связи с службой поддержки
3. **Обновляет тикет** с полученным email адресом

## Как это работает

### Workflow создания тикета с email:

1. **Пользователь задает проблемный вопрос** → 
2. **Система создает тикет** → 
3. **Бот просит email** → 
4. **Пользователь предоставляет email** → 
5. **Тикет обновляется с email** → 
6. **Подтверждение получено**

## Сценарии тестирования

### 🧪 Тест 1: Создание тикета с запросом email

```bash
# Отправляем проблемное сообщение
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Help! My wallet connection is not working",
    "userId": "test-user-email-1",
    "language": "en"
  }'
```

**Ожидаемый результат:**
- Создается тикет
- Бот отвечает запросом email
- `emailRequested: true` в ответе

### 🧪 Тест 2: Предоставление email

```bash
# Отправляем email тем же пользователем
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "user@example.com",
    "userId": "test-user-email-1",
    "language": "en"
  }'
```

**Ожидаемый результат:**
- Email добавляется к тикету
- Бот подтверждает получение email
- `emailCollected: true` в ответе

### 🧪 Тест 3: Русский язык

```bash
# Проблема на русском
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Ошибка при подключении кошелька",
    "userId": "test-user-ru",
    "language": "ru"
  }'
```

**Ожидаемый результат:**
- Запрос email на русском языке

### 🧪 Тест 4: Проверка статуса pending ticket

```bash
# Проверяем есть ли у пользователя тикет в ожидании
curl http://localhost:3000/api/chat/users/test-user-email-1/pending-ticket
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "data": {
    "hasPendingTicket": true,
    "ticketId": "TICKET_123",
    "createdAt": "2025-05-27T...",
    "expiresAt": "2025-05-27T...",
    "conversationId": "conv_id"
  }
}
```

### 🧪 Тест 5: Статистика тикетов с email

```bash
# Получаем статистику по сбору email
curl http://localhost:3000/api/chat/ticket-email-stats
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "data": {
    "pendingTickets": {
      "total": 1,
      "active": 1,
      "expired": 0,
      "timeout": 300
    },
    "timestamp": "2025-05-27T..."
  }
}
```

## Ключевые изменения в коде

### 1. Chat API (`server/api/chat.js`)

**Новые функции:**
- Проверка pending tickets для пользователя
- Обработка email сообщений
- Интеграция с `ticketEmailService`
- Новые API эндпойнты

**Новые эндпойнты:**
- `GET /api/chat/users/:userId/pending-ticket`
- `GET /api/chat/ticket-email-stats`

### 2. Claude Service (`server/services/claude.js`)

**Упрощения:**
- Убрана сложная логика анализа проблемных сообщений
- Теперь ищет только явные указания Claude на создание тикета
- Основная логика создания тикетов перенесена в chat.js

### 3. Ticket Email Service (`server/services/ticketEmail.js`)

**Основные функции:**
- `shouldCreateTicket()` - анализ необходимости создания тикета
- `createPendingTicket()` - создание тикета с запросом email
- `isEmailMessage()` - определение email сообщений
- `updateTicketWithEmail()` - обновление тикета с email

## Проблемы которые решили

1. **Проблема:** Claude говорил "обратитесь в службу поддержки" вместо создания тикетов
   **Решение:** Интегрировали `ticketEmailService` который автоматически создает тикеты и запрашивает email

2. **Проблема:** Тикеты создавались без возможности связи с пользователем
   **Решение:** Добавили автоматический сбор email при создании тикета

3. **Проблема:** Логика создания тикетов была слишком сложной в claude.js
   **Решение:** Упростили и перенесли основную логику в chat.js

## Отладка

### Логи для мониторинга:
```bash
# Фильтруем логи по тикетам с email
grep "🎫\|email" logs/app.log

# Фильтруем логи по ticketEmailService
grep "Pending ticket\|Email collected" logs/app.log
```

### Полезные команды:
```bash
# Очистка всех pending tickets (для тестирования)
# Нужно будет добавить API эндпойнт или перезапустить сервер

# Проверка здоровья системы
curl http://localhost:3000/api/chat/health
```

## Следующие шаги

1. **Тестирование в продакшене** с реальными пользователями
2. **Добавление уведомлений** команде поддержки о новых тикетах
3. **Интеграция с email сервисом** для отправки подтверждений
4. **Админ-панель** для управления тикетами с email

## Конфигурация

Убедитесь что в `.env` есть:
```env
# Таймаут ожидания email (в миллисекундах)
EMAIL_TIMEOUT=300000  # 5 минут по умолчанию
```

---

🍄 **Готово к тестированию!** Теперь бот будет корректно создавать тикеты и собирать email для связи с пользователями.