# 📖 Reader Bot

AI-бот "Читатель" для Анны Бусел - персональный дневник цитат с аналитикой и рекомендациями книг.

## 🚀 Быстрый запуск

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка базы данных Reader Bot
```bash
# Создать отдельную БД для Reader Bot (НЕ конфликтует с Shrooms)
npm run db:setup
```

### 3. Настройка переменных окружения
```bash
cp .env.example .env
# Отредактировать .env файл с вашими API ключами
```

### 4. Запуск сервера Reader Bot
```bash
# Development mode
npm run dev

# Production mode  
npm run start
```

### 5. Доступ к системе
- **Веб-сервер**: http://localhost:3002
- **Админ-панель**: http://localhost:3002/reader-admin
- **API**: http://localhost:3002/api/reader
- **Health check**: http://localhost:3002/api/reader/health

## 🔧 Конфигурация

### Порты (НЕ конфликтуют с Shrooms Support Bot):
- **Reader Bot**: 3002 (веб-сервер)
- **Shrooms Bot**: 3000 (веб-сервер)

### Базы данных:
- **Reader Bot**: `reader_bot`
- **Shrooms Bot**: `shrooms_support`

### Особенности Reader Bot:
- **RAG отключен** - нет поиска по базе знаний
- **Цитаты** - основная функциональность
- **Еженедельные отчеты** - автоматическая отправка в Telegram
- **AI анализ** - через Claude API без документов

## 📖 Основные команды

```bash
# Проверка базы данных
npm run db:check

# Запуск сервера с Telegram ботом (webhook mode)
npm start

# Development mode
npm run dev

# Тестирование еженедельных отчетов
npm run test:weekly

# Проверка здоровья системы
npm run check-health

# Просмотр логов
npm run logs
npm run logs:error
```

## 🤖 Telegram Bot (Webhook Mode)

Бот теперь работает в режиме webhook, интегрированном с основным сервером.

**⚠️ Важно**: `bot/start.js` устарел. Не используйте `npm run bot:start` для запуска бота.

### Настройка Webhook

1. **Получите токен бота** от [@BotFather](https://t.me/botfather)

2. **Настройте переменные окружения** в `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ENABLE_SIMPLE_BOT=true
   TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
   ENABLE_REMINDER_CRON=true
   ```

3. **Запустите сервер**:
   ```bash
   npm start
   ```

Бот автоматически:
- Зарегистрирует webhook в Telegram
- Инициализирует ReminderService
- Запустит cron задачи для напоминаний

📚 **Подробная инструкция**: См. [WEBHOOK_SETUP_GUIDE.md](./WEBHOOK_SETUP_GUIDE.md)

### Функции бота

- **Точка входа** в Mini App
- **Уведомления** пользователям
- **Напоминания** (3 слота: утро, день, вечер)
- **Cron задачи** для автоматической отправки

## 🏗️ Архитектура

```
reader-bot/
├── server/              # Веб-сервер и API
├── telegram/            # Telegram бот
├── client/admin-panel/  # Админ-панель
├── scripts/             # Скрипты инициализации
└── .env                # Конфигурация Reader Bot
```

## 📊 Функции

### Пользователи:
- 📝 Онбординг с тестом (7 вопросов)
- 💬 Отправка цитат через Telegram
- 📊 Еженедельные отчеты с AI-анализом
- 🎯 Рекомендации книг от Анны
- 🏆 Система достижений

### Администратор:
- 📈 Дашборд с аналитикой
- 👥 Управление пользователями
- 📖 Статистика цитат
- 🎫 Система поддержки
- 💰 UTM аналитика и промокоды

## 🔧 Переменные окружения

Основные настройки в `.env`:

```bash
# Сервер
PORT=3002
MONGODB_URI=mongodb://localhost:27017/reader_bot

# AI
ANTHROPIC_API_KEY=your_api_key
ENABLE_RAG=false

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Админ
ADMIN_USERNAME=reader_admin
ADMIN_PASSWORD=your_password
```

## 🚨 Решение проблем

### Ошибка "Connection error" / "🍄 Search failed":
- Проверьте, что используется правильная база данных: `reader_bot`
- Убедитесь, что `ENABLE_RAG=false` в .env
- Перезапустите сервер: `npm run dev`

### Конфликт портов:
- Reader Bot: порт 3002
- Если порт занят, измените PORT в .env

### База данных:
```bash
# Пересоздать базу Reader Bot
npm run db:setup

# Проверить подключение
npm run db:check
```

## 📝 Разработка

### Тестирование:
```bash
npm test                    # Все тесты
npm run test:reports       # Тесты отчетов
npm run test:claude        # Тест Claude API
```

### Линтинг:
```bash
npm run lint               # Проверка кода
npm run lint:fix          # Автоисправление
```

## 🤝 Поддержка

Если возникли проблемы:

1. Проверьте, что база данных `reader_bot` создана: `npm run db:setup`
2. Убедитесь, что используется порт 3002 (не 3000)
3. Проверьте, что RAG отключен: `ENABLE_RAG=false`
4. Посмотрите логи: `npm run logs:error`

---

**📖 Reader Bot v1.0.0** - Создано для проекта Анны Бусел