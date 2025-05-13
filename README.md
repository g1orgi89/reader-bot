# Shrooms AI Support Bot

AI Support Bot для проекта "Shrooms" с интеграцией Claude API.

## Быстрый старт

### 1. Клонируйте репозиторий
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
```

### 2. Установите зависимости
```bash
npm install
```

### 3. Настройте переменные окружения
```bash
cp .env.example .env
# Отредактируйте .env файл, добавив необходимые API ключи
```

### 4. Запустите MongoDB и Qdrant
```bash
# MongoDB
mongod

# Qdrant (используя Docker)
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Загрузите базу знаний
```bash
npm run load-kb
```

### 6. Запустите проект
```bash
# Режим разработки
npm run dev

# Production режим
npm start

# Отдельно Telegram bot
npm run telegram
```

## Переменные окружения

Создайте `.env` файл на основе `.env.example` и заполните следующие обязательные переменные:

- `ANTHROPIC_API_KEY` - Ключ API Claude от Anthropic
- `MONGODB_URI` - Строка подключения к MongoDB
- `VECTOR_DB_URL` - URL Qdrant сервера (по умолчанию: http://localhost:6333)
- `OPENAI_API_KEY` - Ключ API OpenAI для создания эмбеддингов

Опциональные переменные:
- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота
- `JWT_SECRET` - Секретный ключ для JWT
- `PORT` - Порт для веб-сервера (по умолчанию: 3000)

## Архитектура проекта

```
server/
├── api/          # REST API endpoints
├── config/       # Настройки и конфигурация
├── models/       # MongoDB модели
├── services/     # Бизнес-логика
└── utils/        # Утилиты и хелперы

client/
├── chat-widget/  # Виджет чата для сайта
└── admin-panel/  # Панель администратора

telegram/         # Telegram бот
scripts/          # Скрипты для загрузки данных
tests/            # Тесты
```

## Функциональность

### Основные возможности:
- Обработка вопросов пользователей с помощью Claude API
- Интеграция с векторной базой знаний (Qdrant)
- Система тикетов поддержки
- Telegram бот
- Веб-интерфейс чата
- Админ-панель для управления

### Техническая реализация:
- Node.js + Express.js для API
- MongoDB для хранения данных
- Qdrant для векторной базы знаний
- Socket.IO для real-time чата
- Telegraf для Telegram бота

## Скрипты

- `npm start` - Запуск в production режиме
- `npm run dev` - Запуск в development режиме
- `npm run telegram` - Запуск только Telegram бота
- `npm run load-kb` - Загрузка базы знаний
- `npm test` - Запуск тестов
- `npm run lint` - Проверка кода

## База знаний

Документы базы знаний размещайте в папке `knowledge/`:
- `general/` - Общая информация о проекте
- `user-guide/` - Руководство пользователя
- `tokenomics/` - Информация о токенах
- `technical/` - Техническая документация
- `troubleshooting/` - Решение проблем

Поддерживаемые форматы: `.txt`, `.md`, `.pdf`, `.csv`

## API Endpoints

- `POST /api/chat/message` - Отправка сообщения боту
- `GET /api/tickets` - Список тикетов поддержки
- `POST /api/knowledge` - Добавление документа в базу знаний

Подробная документация API доступна в `/docs/API.md`

## Конфигурация

Основные настройки находятся в `server/config/`:
- `index.js` - Основные переменные
- `prompts.js` - Системные промты для Claude
- `db.js` - Настройки базы данных

## Безопасность

- Использование JWT для аутентификации
- Rate limiting для API
- Валидация входных данных
- Sanitization вывода

## Тестирование

```bash
# Все тесты
npm test

# Тесты с покрытием
npm run test:coverage

# Тесты в режиме наблюдения
npm run test:watch
```

## Логирование

Логи сохраняются в директории `/logs` и имеют следующие уровни:
- `error` - Ошибки
- `warn` - Предупреждения
- `info` - Информационные сообщения
- `debug` - Отладочные сообщения

## Разработка

### Требования:
- Node.js 18+
- MongoDB 5.0+
- Docker (для Qdrant)

### Работа с кодом:
1. Форкните репозиторий
2. Создайте feature branch
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## Лицензия

MIT License

## Поддержка

Если вы нашли баг или у вас есть предложения:
1. Создайте Issue в GitHub
2. Обратитесь в Telegram чат поддержки
3. Напишите на email: support@shrooms.io
