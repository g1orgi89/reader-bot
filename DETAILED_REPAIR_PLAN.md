# Детальный план исправлений

## ЭТАП 1: Анализ и подготовка (30 мин)

### 1.1. Создание карты зависимостей
```
Message Model (text) 
    ↓
Message Service (должен использовать text)
    ↓  
Chat API (должен использовать text)
    ↓
Frontend (будет использовать text)
```

### 1.2. Список файлов для изменения
- `server/models/message.js` - источник истины (уже correct: text)
- `server/services/message.js` - изменить с content на text
- `server/api/chat.js` - изменить с content на text
- `server/services/claude.js` - убрать FIX комментарий, унифицировать
- `server/types/api.js` - добавить недостающие типы

## ЭТАП 2: Исправление типов (30 мин)

### 2.1. Добавить недостающие типы в api.js
```javascript
/**
 * @typedef {Object} ChatMessage
 * @property {string} id - Message ID
 * @property {string} text - Message content (ВАЖНО: text, не content!)
 * @property {MessageRole} role - Message role
 * @property {string} userId - User ID
 * @property {string} conversationId - Conversation ID
 * @property {string} language - Language code
 * @property {Date} createdAt - Creation timestamp
 * @property {number} [tokensUsed] - Tokens used
 * @property {boolean} [ticketCreated] - Whether ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 */

/**
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message - Message content
 * @property {string} userId - User ID
 * @property {string} [conversationId] - Conversation ID
 * @property {string} [language] - Language code (en/es/ru)
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - AI response
 * @property {string} conversationId - Conversation ID
 * @property {string} messageId - Message ID
 * @property {boolean} needsTicket - Whether ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 * @property {number} tokensUsed - Tokens used
 * @property {string} language - Response language
 * @property {Date} timestamp - Response timestamp
 */

/**
 * @typedef {Object} ChatError
 * @property {boolean} success - Always false
 * @property {string} error - Error message
 * @property {string} errorCode - Error code
 * @property {Object} [details] - Error details
 */
```

## ЭТАП 3: Исправление совместимости полей (45 мин)

### 3.1. Message Service (server/services/message.js)
```javascript
// ИЗМЕНИТЬ:
// content: messageData.content
// НА:
// text: messageData.text

// Список мест в файле:
// - Строка ~45: создание Message
// - Строка ~103: toApiResponse
// - Строка ~130: формирование response
```

### 3.2. Chat API (server/api/chat.js)
```javascript
// ИЗМЕНИТЬ:
// - createMessage calls с content на text
// - response mappings с content на text
// Строки для изменения: ~95, ~110, ~125
```

### 3.3. Claude Service (server/services/claude.js)
```javascript
// УБРАТЬ FIX комментарий (строка 285)
// ИЗМЕНИТЬ formatHistory для единообразия:
// - всегда использовать text
// - удалить fallbacks на content/message
```

## ЭТАП 4: MongoDB подключение (15 мин)

### 4.1. server/index.js
```javascript
// Добавить после импортов:
const mongoose = require('mongoose');

// Добавить после createService:
// Database connection
mongoose.connect(config.getDatabaseConfig().uri, config.getDatabaseConfig().options)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });
```

## ЭТАП 5: Регистрация API routes (15 мин)

### 5.1. server/index.js
```javascript
// Добавить импорты:
const ticketRoutes = require('./api/tickets');
const knowledgeRoutes = require('./api/knowledge');
const adminRoutes = require('./api/admin');

// Добавить после chatRoutes:
app.use('/api/tickets', requireAdminAuth, ticketRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/admin', requireAdminAuth, adminRoutes);
```

## ЭТАП 6: Создание admin API (60 мин)

### 6.1. Создать server/api/admin.js
```javascript
// Эндпоинты:
// GET /api/admin/stats - общая статистика
// PUT /api/admin/farming-yield - обновить доходность
// GET /api/admin/users - список пользователей
// POST /api/admin/broadcast - отправить сообщение всем
```

## ЭТАП 7: Финальная проверка (30 мин)

### 7.1. Тестирование
- Проверить все API endpoints
- Проверить сохранение messages в MongoDB
- Проверить типизацию

### 7.2. Обновление документации
- Обновить CONTEXT_FIXES.md
- Обновить README.md

## КОНТРОЛЬ КАЧЕСТВА

### Принципы:
1. **Атомарность** - одно изменение за раз
2. **Проверяемость** - каждое изменение можно протестировать
3. **Обратимость** - можно откатить любое изменение
4. **Документированность** - фиксировать что и зачем меняем

### Checklist перед коммитом:
- [ ] Проверена типизация
- [ ] Протестирована функциональность
- [ ] Обновлена документация
- [ ] Проверена совместимость с другими компонентами
