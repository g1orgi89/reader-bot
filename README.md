# Shrooms Support Bot 🍄

AI Support Bot для проекта "Shrooms" с грибной тематикой, построенный на базе Claude API с поддержкой RAG и Telegram интеграцией.

## ✨ Новое: Telegram Bot с Email Workflow

**Система автоматического сбора email для тикетов поддержки**

- 🎫 **Автоматическое создание тикетов** при обнаружении проблемных сообщений
- 📧 **Сбор email адресов** для персональной поддержки
- 🌍 **Многоязычная поддержка** (EN, RU, ES)
- ⏰ **Умное управление состояниями** с автоочисткой
- 🚫 **Возможность отмены** процесса сбора email

## 🚀 Быстрый старт

### Предварительные требования

1. **Node.js 18+** и **npm**
2. **MongoDB** (локально или в облаке)
3. **API ключ Anthropic Claude** (обязательно)
4. **Telegram Bot Token** (для Telegram функциональности)
5. **Qdrant** (опционально, для RAG)
6. **OpenAI API ключ** (опционально, для эмбеддингов)

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте переменные окружения:**
```bash
cp .env.example .env
```

Отредактируйте `.env` файл и добавьте как минимум:
```env
MONGODB_URI=mongodb://localhost:27017/shrooms-support
ANTHROPIC_API_KEY=ваш_ключ_claude_api
TELEGRAM_BOT_TOKEN=ваш_токен_telegram_бота
```

4. **Убедитесь, что MongoDB запущен**

5. **Запустите основной сервер:**
```bash
npm start
```

6. **Запустите Telegram бота (в отдельном терминале):**
```bash
npm run telegram
```

## 🤖 Telegram Bot

### Основные функции

- **Умные ответы**: Использует Claude API для генерации ответов
- **RAG поддержка**: Поиск информации в базе знаний
- **Автоматические тикеты**: Создание тикетов для сложных вопросов
- **Сбор email**: Запрос email для персональной поддержки
- **Многоязычность**: Поддержка английского, русского и испанского

### Команды Telegram бота

```
/start   - Начать работу с ботом
/help    - Получить справку
/cancel  - Отменить сбор email (если активен)
```

### Workflow создания тикета

1. **Пользователь отправляет проблемное сообщение** (например: "У меня ошибка с кошельком")
2. **Бот автоматически распознает проблему** и создает тикет
3. **Запрашивается email адрес** для связи с экспертами
4. **Пользователь вводит email** (с валидацией)
5. **Тикет обновляется** и отправляется подтверждение

### Запуск Telegram бота

```bash
# Запуск Telegram бота отдельно
npm run telegram

# Или запуск в режиме разработки с автоперезагрузкой
npm run telegram:dev
```

## 🧠 RAG (Retrieval-Augmented Generation)

### Что такое RAG?

RAG (Retrieval-Augmented Generation) - это технология, которая улучшает генерацию ответов AI, дополняя её информацией из внешней базы знаний. Это позволяет боту давать более точные и контекстно-релевантные ответы на вопросы пользователей.

### Настройка RAG

1. **Установите Qdrant:**
```bash
docker run -d -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

2. **Настройте переменные окружения для RAG:**
```env
ENABLE_RAG=true
OPENAI_API_KEY=ваш_ключ_openai
VECTOR_DB_URL=http://localhost:6333
VECTOR_COLLECTION_NAME=shrooms_knowledge
EMBEDDING_MODEL=text-embedding-ada-002
```

3. **Подготовьте базу знаний:**
   - Создайте Markdown (.md) или текстовые (.txt) файлы в директории `knowledge/`
   - Рекомендуемая структура:
     ```
     knowledge/
     ├── general/           # Общая информация о проекте
     ├── tokenomics/        # Информация о токенах
     ├── user-guide/        # Руководство пользователя
     └── troubleshooting/   # Решение проблем
     ```
   - Для многоязычной поддержки, добавьте суффикс к имени файла:
     - Английский: `file.md` или `file-en.md`
     - Русский: `file-ru.md`
     - Испанский: `file-es.md`

4. **Загрузите базу знаний в Qdrant:**
```bash
npm run load-kb
```

## 🎫 Система тикетов

### Создание тикетов

Тикеты создаются автоматически когда:
- Пользователь упоминает проблемы (ошибки, баги, неисправности)
- Запрашивается помощь или поддержка
- Обнаруживаются ключевые слова проблем

### Управление тикетами

Доступно через админ-панель: http://localhost:3000/client/admin-panel/

**Логин/пароль по умолчанию**: admin/password123

### Email Workflow

- **Автоматический сбор**: email запрашивается при создании тикета
- **Валидация**: проверка корректности email адреса
- **Таймаут**: 10 минут на ввод email
- **Отмена**: возможность отменить через `/cancel`
- **Многоязычность**: запросы на языке пользователя

## 🔧 Конфигурация

### Обязательные настройки

- `MONGODB_URI` - URI подключения к MongoDB
- `ANTHROPIC_API_KEY` - API ключ Claude (получить на [console.anthropic.com](https://console.anthropic.com))
- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота (получить у [@BotFather](https://t.me/BotFather))

### Дополнительные настройки

- `OPENAI_API_KEY` - для эмбеддингов и RAG
- `VECTOR_DB_URL` - URL Qdrant для векторного поиска (по умолчанию `http://localhost:6333`)
- `ENABLE_RAG` - включить/выключить RAG функциональность (по умолчанию `true`)

## 📋 Команды

```bash
# Разработка
npm run dev              # Запуск в режиме разработки с автоперезагрузкой
npm run dev:debug        # Запуск с отладкой

# Telegram бот
npm run telegram         # Запуск Telegram бота
npm run telegram:dev     # Запуск с автоперезагрузкой

# Тестирование
npm test                 # Запуск всех тестов
npm run test:db          # Тест подключения к MongoDB
npm run test:claude      # Тест Claude API
npm run test:telegram    # Тест Telegram бота

# Данные
npm run load-kb          # Загрузка базы знаний в векторную БД

# Продакшн
npm run start:prod       # Запуск в production режиме
```

## 🧪 Тестирование

### 1. Тест MongoDB соединения
```bash
npm run test:db
```

### 2. Тест веб-интерфейса
Запустите сервер и откройте в браузере:
- http://localhost:3000/test-chat.html
- http://localhost:3000/test-email-workflow.html (новое!)

### 3. Тест API
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Привет!", "userId": "test-user"}'
```

### 4. Тест Telegram бота
1. Запустите бота: `npm run telegram`
2. Найдите вашего бота в Telegram
3. Отправьте команду `/start`
4. Попробуйте различные сценарии:
   - Обычные вопросы: "Что такое Shrooms?"
   - Проблемные сообщения: "У меня ошибка с транзакцией"
   - Введите email когда запросится
   - Попробуйте `/cancel` для отмены

**Подробное руководство по тестированию**: См. [TELEGRAM_EMAIL_WORKFLOW_TESTING.md](TELEGRAM_EMAIL_WORKFLOW_TESTING.md)

## 🏗️ Архитектура

```
shrooms-support-bot/
├── server/              # Серверная часть
│   ├── api/            # REST API эндпоинты
│   ├── services/       # Бизнес-логика
│   │   ├── claude.js   # Интеграция с Claude API
│   │   ├── ticketEmail.js # 🆕 Сервис сбора email
│   │   ├── ticketing.js # Управление тикетами
│   │   └── vectorStore.js # RAG система
│   ├── models/         # Модели данных
│   ├── middleware/     # Express middleware
│   ├── utils/          # Утилиты
│   └── types/          # TypeScript типы (JSDoc)
├── client/             # Клиентская часть
│   └── admin-panel/    # Админ-панель
├── telegram/           # 🆕 Telegram бот
│   ├── index.js        # Основной файл бота
│   └── start.js        # Запуск бота
├── tests/              # Тесты
├── knowledge/          # База знаний для RAG
└── scripts/            # Скрипты для обслуживания
```

## 🔌 API Endpoints

### Chat API
- `POST /api/chat` - Отправка сообщения
- `GET /api/chat/conversations/:userId` - Получение разговоров
- `GET /api/chat/health` - Проверка здоровья API

### Tickets API
- `GET /api/tickets` - Получение списка тикетов
- `POST /api/tickets` - Создание тикета
- `GET /api/tickets/:id` - Получение тикета

### Admin API
- `GET /api/admin/tickets` - Управление тикетами (требует авторизации)
- `DELETE /api/admin/tickets/:id` - Удаление тикета

## 📊 Мониторинг

- **Health Check**: `GET /api/health`
- **Telegram Bot Stats**: Встроенная статистика в коде бота
- **Логи**: Доступны в папке `logs/`
- **Админ-панель**: http://localhost:3000/client/admin-panel/

### Статистика Telegram бота

```javascript
// Пример статистики бота
{
  "userStates": {
    "total": 5,
    "awaitingEmail": 2
  },
  "pendingTickets": {
    "total": 2
  },
  "features": {
    "emailWorkflow": true,
    "stateManagement": true,
    "ticketCreation": true
  }
}
```

## 🔍 Устранение проблем

### Ошибки подключения к MongoDB

1. Убедитесь, что MongoDB запущен:
```bash
# MongoDB Community
sudo systemctl start mongod

# MongoDB в Docker
docker run -d -p 27017:27017 mongo:latest
```

2. Проверьте URI подключения в `.env`

### Ошибки Claude API

1. Проверьте корректность API ключа
2. Убедитесь, что у вас есть кредиты в аккаунте Anthropic
3. Проверьте лимиты запросов

### Ошибки Telegram бота

1. Проверьте токен бота в `.env`:
```env
TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
```

2. Убедитесь, что бот не запущен в другом месте
3. Проверьте логи: `tail -f logs/combined.log`

### RAG не работает

1. Убедитесь, что Qdrant запущен:
```bash
docker run -p 6333:6333 qdrant/qdrant
```

2. Проверьте переменные:
  - `ENABLE_RAG=true`
  - `OPENAI_API_KEY` должен быть правильным
  - `VECTOR_DB_URL` должен указывать на работающий Qdrant

3. Проверьте логи на наличие ошибок инициализации
```bash
tail -f logs/error.log
```

4. Перезагрузите базу знаний
```bash
npm run load-kb -- --clear --test
```

### Email workflow не работает

1. Проверьте MongoDB подключение
2. Убедитесь, что сервис ticketEmail инициализирован
3. Проверьте логи на ошибки создания тикетов
4. Проверьте, что состояния пользователей корректно управляются

## 🔒 Безопасность

- API ключи хранятся в `.env` файле
- Логи не содержат чувствительной информации
- Rate limiting настроен по умолчанию
- Email адреса защищены и используются только для связи

## 📝 Логирование

Логи сохраняются в папке `logs/`:
- `combined.log` - все логи
- `error.log` - только ошибки
- `exceptions.log` - необработанные исключения

Для Telegram бота добавлены специальные логи с префиксом 🍄:
```
🍄 Telegram message from user 123456789: "У меня проблема..."
🍄 Ticket TKT-20250529-001 created, awaiting email from user 123456789
🍄 Email user@example.com collected for ticket TKT-20250529-001
```

## 🚀 Новые возможности в этой версии

### 🎫 Email Workflow для тикетов
- Автоматическое создание тикетов при проблемных сообщениях
- Интеллектуальный сбор email адресов
- Валидация email с понятными сообщениями об ошибках
- Поддержка отмены процесса через `/cancel`

### 🔄 State Management
- Умное отслеживание состояний пользователей
- Автоматическая очистка устаревших состояний
- Таймауты для предотвращения зависания

### 🌍 Улучшенная многоязычность
- Автоматическое определение языка пользователя
- Локализованные сообщения для всех этапов workflow
- Поддержка английского, русского и испанского языков

### 📊 Расширенная аналитика
- Статистика по состояниям пользователей
- Мониторинг pending тикетов
- Детальное логирование всех операций

## 🤝 Участие в разработке

1. Форкните проект
2. Создайте ветку для фичи (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🐛 Сообщение об ошибках

Если вы нашли ошибку, пожалуйста:
1. Проверьте [существующие issues](https://github.com/g1orgi89/shrooms-support-bot/issues)
2. Создайте новый issue с подробным описанием
3. Приложите логи из `logs/error.log`

---

**Создано с 🍄 для сообщества Shrooms**