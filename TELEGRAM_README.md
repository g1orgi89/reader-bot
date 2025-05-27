# 🍄 Shrooms Telegram Bot Integration

Полная интеграция Telegram бота в существующую архитектуру Shrooms Support Bot с поддержкой базы знаний, RAG, и мультиязычности.

## ✨ Возможности Telegram бота

- 🌍 **Мультиязычность**: Поддержка английского, русского и испанского языков
- 🧠 **RAG интеграция**: Автоматический поиск релевантной информации в базе знаний
- 🎫 **Автоматическое создание тикетов**: Создание тикетов поддержки при сложных вопросах
- 📝 **Markdown форматирование**: Красивые ответы с эмодзи и форматированием
- 🔄 **Разбивка длинных сообщений**: Автоматическое разделение длинных ответов
- 📱 **Typing indicator**: Индикатор набора текста для лучшего UX
- 💾 **История диалогов**: Сохранение контекста разговора

## 🚀 Быстрый старт

### 1. Настройка Telegram бота

1. Создайте бота через [@BotFather](https://t.me/BotFather):
   ```
   /newbot
   ```

2. Скопируйте токен бота и добавьте в `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
   ```

### 2. Миграция промптов

Добавьте специальные промпты для Telegram:

```bash
npm run migrate:telegram-prompts
```

### 3. Запуск бота

#### Режим разработки:
```bash
npm run telegram:dev
```

#### Продакшн режим:
```bash
npm run start:telegram:prod
```

## 🛠️ Архитектура интеграции

### Схема взаимодействия

```
Telegram User
    ↓
ShroomsTelegramBot (telegram/index.js)
    ↓
ClaudeService (с поддержкой платформ)
    ↓
PromptService (Telegram-специфичные промпты)
    ↓
VectorStore + Knowledge Base
    ↓
MongoDB (сохранение диалогов и тикетов)
```

### Ключевые компоненты

1. **ShroomsTelegramBot** (`telegram/index.js`)
   - Основной класс бота с полной интеграцией
   - Обработка команд `/start` и `/help`
   - Автоматическое определение языка
   - Разбивка длинных сообщений

2. **ClaudeService** (обновлен)
   - Поддержка платформ (`web`, `telegram`)
   - Специальные промпты для Telegram
   - Markdown форматирование для Telegram

3. **Telegram Prompts** (`scripts/addTelegramPrompts.js`)
   - Специальные промпты с Markdown и эмодзи
   - Мультиязычная поддержка
   - Интеграция с базой знаний

## 📋 Команды

### Пользовательские команды

- `/start` - Приветствие и информация о боте
- `/help` - Справочная информация

### NPM скрипты

- `npm run telegram` - Запуск бота
- `npm run telegram:dev` - Запуск в режиме разработки
- `npm run migrate:telegram-prompts` - Миграция промптов
- `npm run setup:telegram` - Полная настройка Telegram бота

## 🔧 Конфигурация

### Переменные окружения

```bash
# Обязательные
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
MONGODB_URI=mongodb://localhost:27017/shrooms-support
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Опциональные
TELEGRAM_MAX_MESSAGE_LENGTH=4096
ENABLE_RAG=true
LOG_LEVEL=info
```

### Настройка промптов

Промпты автоматически загружаются из базы знаний с названиями:
- `telegram_basic_en` - Основной промпт для английского
- `telegram_basic_ru` - Основной промпт для русского  
- `telegram_basic_es` - Основной промпт для испанского
- `telegram_rag_*` - RAG промпты для каждого языка

## 🧪 Тестирование

### Ручное тестирование

1. Запустите бота: `npm run telegram:dev`
2. Найдите бота в Telegram по username
3. Отправьте `/start`
4. Протестируйте различные сценарии:
   - Простые вопросы
   - Технические проблемы (должны создавать тикеты)
   - Разные языки
   - Длинные сообщения

### Проверка статистики

```javascript
// В коде бота
const stats = await bot.getStats();
console.log(stats);
```

## 🐛 Отладка

### Логи

Все действия логируются с префиксом 🍄:

```bash
# Просмотр логов
npm run logs

# Логи только ошибок
npm run logs:error
```

### Типичные проблемы

1. **Бот не отвечает**
   - Проверьте токен в `.env`
   - Убедитесь, что MongoDB работает
   - Проверьте логи на ошибки

2. **Промпты не загружаются**
   - Запустите миграцию: `npm run migrate:telegram-prompts`
   - Проверьте подключение к MongoDB

3. **RAG не работает**
   - Убедитесь, что `ENABLE_RAG=true`
   - Проверьте подключение к Qdrant
   - Загрузите документы в базу знаний

## 🔐 Безопасность

- Все токены храните в `.env` файле
- Не коммитьте `.env` в репозиторий
- Используйте HTTPS в продакшне
- Регулярно обновляйте зависимости

## 📈 Мониторинг

### Метрики бота

```javascript
const stats = await bot.getStats();
// {
//   botInfo: { id, username, firstName },
//   systemMessages: { loaded: 6, languages: ['en', 'ru', 'es'] },
//   status: { initialized: true, uptime: 3600 }
// }
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## 🚀 Деплой

### Docker

```dockerfile
# Добавьте в Dockerfile
COPY telegram/ ./telegram/
CMD ["npm", "run", "start:telegram:prod"]
```

### PM2

```javascript
// ecosystem.config.js
{
  name: 'shrooms-telegram-bot',
  script: 'telegram/start.js',
  env: {
    NODE_ENV: 'production'
  }
}
```

## 🤝 Вклад в разработку

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Следуйте стилю кода с JSDoc
4. Добавьте тесты для новой функциональности
5. Создайте Pull Request

## 📚 Дополнительная документация

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegraf.js документация](https://telegraf.js.org/)
- [Anthropic Claude API](https://docs.anthropic.com/)

---

🍄 **Создано с любовью командой Shrooms для грибного сообщества!** 🌱