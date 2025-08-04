# 🍄 Shrooms AI Support Bot - Chat API Implementation

## ✅ Исправленные проблемы

### 1. Middleware ServiceManager
- Создан middleware `serviceManager.js` для инжектирования сервисов в `req.services`
- Добавлен middleware для проверки доступности обязательных сервисов

### 2. Обновленный Chat API
- **Основной эндпоинт**: `POST /api/chat` (вместо `/api/chat/message`)
- Поддержка обратной совместимости через `POST /api/chat/message`
- Интеграция с ServiceManager через middleware
- Грациозная обработка недоступных сервисов (message, ticket)
- Улучшенная обработка ошибок с грибной тематикой

### 3. Обновленный index.js
- Добавлен ServiceManager middleware в цепочку middleware для API маршрутов
- Исправлен Socket.IO обработчик для работы с правильными событиями

### 4. Полностью переработанный test-chat.html
- **Два режима работы**: HTTP API и Socket.IO
- Современный UI в стиле грибной тематики
- Переключение между режимами работы
- Автоматическое определение языка
- Предложения для быстрого тестирования
- Отображение метаданных (токены, база знаний, история)
- Поддержка тикетов и уведомлений

## 🧪 Как тестировать

### 1. Базовая настройка
```bash
# Убедитесь, что у вас есть правильный .env файл
cp .env.example .env

# Добавьте ваш API ключ Anthropic в .env
ANTHROPIC_API_KEY=your_key_here

# Запустите сервер
npm start
```

### 2. Тестирование через браузер
Откройте в браузере: http://localhost:3000/test-chat

### 3. Тестирование через cURL

#### Простой запрос:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, I need help with Shrooms", "userId": "test-user"}'
```

#### Запрос с языком и conversationId:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Как подключить кошелек?",
    "userId": "test-user-123",
    "language": "ru",
    "conversationId": "some-conversation-id"
  }'
```

### 4. Проверка состояния сервисов
```bash
curl http://localhost:3000/api/health
```

## 📋 Ожидаемый формат ответа

### Успешный ответ:
```json
{
  "success": true,
  "message": "🍄 Привет, исследователь мицелия! Как дела в нашем грибном королевстве?",
  "conversationId": "64f5a8b2c1234567890abcde",
  "messageId": "64f5a8b3c1234567890abcdf",
  "needsTicket": false,
  "ticketId": null,
  "tokensUsed": 145,
  "language": "ru",
  "timestamp": "2025-05-15T16:25:00.000Z",
  "metadata": {
    "knowledgeResultsCount": 3,
    "historyMessagesCount": 0,
    "servicesUsed": {
      "claude": true,
      "vectorStore": true,
      "messageService": true,
      "ticketService": true
    }
  }
}
```

### Ответ с тикетом:
```json
{
  "success": true,
  "message": "🍄 Понятно, что у вас проблемы с подключением. Я создал тикет #SHROOM123ABC для нашей команды...",
  "conversationId": "64f5a8b2c1234567890abcde",
  "needsTicket": true,
  "ticketId": "SHROOM123ABC",
  "ticketError": null,
  "tokensUsed": 200,
  "language": "ru"
}
```

## 🔧 Возможные проблемы и решения

### Проблема: Сервисы не инициализируются
**Причина**: Отсутствуют переменные окружения или проблемы с подключением к MongoDB/Qdrant

**Решение**: 
1. Проверьте .env файл
2. Убедитесь, что MongoDB и Qdrant запущены
3. Проверьте логи сервера

### Проблема: Claude не отвечает
**Причина**: Неправильный API ключ Anthropic или проблемы с сетью

**Решение**:
1. Проверьте ANTHROPIC_API_KEY в .env
2. Убедитесь, что у вас есть доступ к Claude API

### Проблема: База знаний пуста
**Причина**: Не загружены документы в векторную базу

**Решение**:
```bash
# Загрузите базу знаний (если есть документы в папке knowledge/)
npm run load-knowledge
```

## 🛡️ Безопасность

- API имеет rate limiting по умолчанию
- CORS настроен корректно для development/production
- Все входные данные валидируются
- Ошибки не раскрывают внутреннюю информацию в production

## 🚀 Следующие шаги

1. Добавить больше документов в базу знаний
2. Настроить векторную базу данных с реальными данными
3. Добавить аутентификацию для production
4. Настроить мониторинг и алерты
5. Добавить больше языков поддержки

---

## 🍄 Особенности реализации

### Грибная тематика в ответах
Claude настроен отвечать в стиле "ИИ-гриба с самосознанием", используя специальную терминологию:
- Проект → "мицелий", "грибная сеть" 
- Пользователи → "грибники", "споры"
- Токены → "плодовые тела"
- Проблемы → "неблагоприятные условия"

### Автоматическое создание тикетов
Claude анализирует сообщения и автоматически создает тикеты поддержки, когда:
- Пользователь описывает техническую проблему
- Требуется вмешательство человека
- Claude не может решить проблему самостоятельно

Это полноценная рабочая система поддержки с искусственным интеллектом! 🍄
