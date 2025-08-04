# ДЕТАЛЬНЫЙ ПЛАН ИСПРАВЛЕНИЯ ОШИБОК

> Создан: 2025-01-28
> Статус: Готов к исполнению

## 🚨 ПОРЯДОК ИСПРАВЛЕНИЙ (по критичности)

### 📝 ЭТАП 1: Исправление языкового детектора
- **Ошибка**: `languageDetector.detectLanguage()` не существует
- **Файл**: `server/services/claude.js:66`
- **Исправление**: Заменить на `languageDetector.detect()`
- **Сложность**: ⭐ (простое)
- **Время**: 5 мин

### 📝 ЭТАП 2: Исправление несовместимости полей
- **Ошибка**: `text` vs `content` поля
- **Файлы**: 
  - `server/services/claude.js:196-203`
  - `server/models/message.js:36`
- **Исправление**: Унифицировать к полю `text`
- **Сложность**: ⭐⭐ (средне)
- **Время**: 10 мин

### 📝 ЭТАП 3: Добавить инициализацию VectorStore
- **Ошибка**: VectorStore не инициализирован
- **Файл**: `server/index.js`
- **Исправление**: Добавить импорт и инициализацию
- **Сложность**: ⭐⭐ (средне)
- **Время**: 15 мин

### 📝 ЭТАП 4: Исправить baseURL в конструкторе
- **Ошибка**: `baseURL` может быть undefined
- **Файл**: `server/services/claude.js:23`
- **Исправление**: Добавить проверку или исключить undefined
- **Сложность**: ⭐ (простое)
- **Время**: 5 мин

### 📝 ЭТАП 5: Добавить недостающие типы
- **Ошибка**: `ClaudeGenerateOptions` и `ClaudeResponse` не определены
- **Файл**: `server/types/index.js`
- **Исправление**: Создать typedef для этих типов
- **Сложность**: ⭐⭐ (средне)
- **Время**: 20 мин

### 📝 ЭТАП 6: Улучшить создание тикетов
- **Ошибка**: Неопределенное поведение при создании тикетов
- **Файл**: `server/services/claude.js`
- **Исправление**: Четко определить логику создания тикетов
- **Сложность**: ⭐⭐⭐ (сложное)
- **Время**: 30 мин

### 📝 ЭТАП 7: Унифицировать поля metadata
- **Ошибка**: `createdTicket` vs `ticketCreated`
- **Файлы**: `server/models/message.js` и API модули
- **Исправление**: Использовать единое название
- **Сложность**: ⭐⭐ (средне)
- **Время**: 15 мин

### 📝 ЭТАП 8: Добавить middleware аутентификации
- **Ошибка**: Админ-роуты без проверки
- **Файл**: `server/index.js:76`
- **Исправление**: Создать и добавить auth middleware
- **Сложность**: ⭐⭐⭐ (сложное)
- **Время**: 45 мин

### 📝 ЭТАП 9: Стандартизировать коды ошибок
- **Ошибка**: Неконсистентные коды ошибок
- **Файлы**: Все API модули
- **Исправление**: Создать единые константы для кодов
- **Сложность**: ⭐⭐ (средне)
- **Время**: 25 мин

## 🔍 ДЕТАЛИ КАЖДОГО ИСПРАВЛЕНИЯ

### ЭТАП 1: Языковой детектор
```javascript
// ДО (строка 66):
languageDetector.detectLanguage(message, 'en')

// ПОСЛЕ:
languageDetector.detect(message)
```

### ЭТАП 2: Поля text/content
```javascript
// ДО (строка 200):
content: msg.text || msg.content || msg.message || ''

// ПОСЛЕ:
content: msg.text || ''
```

### ЭТАП 3: VectorStore инициализация
```javascript
// ДОБАВИТЬ в index.js:
const vectorStoreService = require('./services/vectorStore');

// В async блоке подключения к MongoDB:
await vectorStoreService.initialize();
app.set('vectorStoreService', vectorStoreService);
```

### ЭТАП 4: baseURL проверка
```javascript
// ДО:
this.client = new Anthropic({
  apiKey: config.apiKey,
  baseURL: config.baseURL,  // может быть undefined
});

// ПОСЛЕ:
const clientConfig = { apiKey: config.apiKey };
if (config.baseURL) {
  clientConfig.baseURL = config.baseURL;
}
this.client = new Anthropic(clientConfig);
```

### ЭТАП 5: Недостающие типы
```javascript
// ДОБАВИТЬ в types/index.js:
/**
 * @typedef {Object} ClaudeGenerateOptions
 * @property {string[]} [context] - Context from knowledge base
 * @property {Message[]} [history] - Conversation history
 * @property {string} [language] - Language code
 * @property {number} [maxTokens] - Maximum tokens
 * @property {number} [temperature] - Temperature for generation
 */

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Generated message
 * @property {boolean} needsTicket - Whether ticket should be created
 * @property {number} tokensUsed - Tokens consumed
 * @property {string} [ticketReason] - Reason for ticket creation
 * @property {string} language - Detected/used language
 * @property {Object} [usage] - Token usage details
 */
```

## 🧪 ТЕСТИРОВАНИЕ ПОСЛЕ КАЖДОГО ЭТАПА

1. **Статический анализ**: Проверить отсутствие синтаксических ошибок
2. **Запуск**: Убедиться, что сервер запускается без ошибок
3. **Базовое тестирование**: Отправить тестовое сообщение через API
4. **Интеграционное тестирование**: Проверить взаимодействие компонентов

## 📋 ЧЕКЛИСТ ДЛЯ КАЖДОГО ИСПРАВЛЕНИЯ

- [ ] Проверить синтаксис изменений
- [ ] Обновить документацию (JSDoc)
- [ ] Убедиться в обратной совместимости
- [ ] Добавить детали в CONTEXT_FIXES.md
- [ ] Закоммитить изменения с описательным сообщением
- [ ] Отметить как исправленное в CONTEXT_FIXES.md

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Порядок имеет значение**: Исправления должны выполняться в указанной последовательности
2. **Тестирование обязательно**: После каждого этапа проверять работоспособность
3. **Документирование**: Каждое изменение должно быть задокументировано
4. **Откат**: В случае проблем иметь возможность откатить изменения

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После всех исправлений:
- Сервер запускается без ошибок
- Все компоненты корректно взаимодействуют
- API работает стабильно
- Типизация JSDoc корректна
- Код соответствует лучшим практикам
