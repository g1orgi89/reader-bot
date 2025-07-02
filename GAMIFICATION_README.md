# Геймификация Reader Bot 🎮📖

Система геймификации для проекта "Читатель" с достижениями, статистикой и обработкой цитат.

## ✅ Что реализовано

### 🏆 Система достижений
- **"Первые шаги"** (🌱) - первая цитата
- **"Коллекционер мудрости"** (📚) - 25 цитат
- **"Философ недели"** (🔥) - 7 дней подряд с цитатами
- **"Любитель классики"** (📖) - 10 цитат классиков
- **"Мыслитель"** (💭) - 10 собственных мыслей
- **"Марафонец чтения"** (🏃‍♀️) - 50 цитат
- **"Разносторонний читатель"** (🌈) - 5 разных категорий
- **"Постоянство"** (⭐) - месяц активного использования

### 📖 Обработка цитат
- Парсинг различных форматов цитат
- AI-анализ через Claude (категория, темы, sentiment)
- Дневной лимит (10 цитат в день)
- Автоматическое определение классических авторов
- Рекомендации книг от Анны Бусел

### 📊 Команды бота
- `/help` - справка с примерами
- `/stats` - подробная статистика пользователя
- `/search` - поиск по цитатам (текст, автор, категория)
- `/settings` - настройки напоминаний

### 🎯 Интеграция
- **GameificationIntegration** - основной класс интеграции
- Автоматическая проверка достижений при каждой цитате
- Уведомления о новых достижениях
- Callback кнопки для поиска и настроек

## 📁 Структура файлов

```
server/services/
├── achievementService.js       # Система достижений
├── quoteHandler.js            # Обработка цитат + геймификация
├── commandHandler.js          # Команды Telegram бота
└── gamificationIntegration.js # Интеграция с основным ботом

server/tests/
└── gamificationTest.js        # Тесты геймификации
```

## 🚀 Как интегрировать

### 1. В основном Telegram боте

```javascript
const gamification = require('./services/gamificationIntegration');

// Инициализация
await gamification.initialize();

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const messageText = ctx.message.text;
  
  // Проверяем команды
  if (messageText.startsWith('/')) {
    await gamification.handleCommand(messageText, ctx);
  } else {
    // Обрабатываем как цитату
    await gamification.handleMessage(userId, messageText, ctx);
  }
});

// Обработка callback кнопок
bot.on('callback_query', async (ctx) => {
  await gamification.handleCallback(ctx);
});
```

### 2. В index.js сервера

```javascript
const gamification = require('./services/gamificationIntegration');

// В функции startServer()
await gamification.initialize();
logger.info('🎮 Gamification system ready');

// В health check
const gamificationHealth = await gamification.healthCheck();
health.services.gamification = gamificationHealth.status;
```

### 3. Добавить в модели (уже готово)

Модели `UserProfile` и `Quote` уже содержат необходимые поля:
- `UserProfile.statistics` - статистика пользователя
- `UserProfile.achievements[]` - достижения
- `Quote` - модель цитат с категориями

## 🧪 Тестирование

```bash
# Запуск тестов геймификации
node server/tests/gamificationTest.js
```

Тест покажет:
- ✅ Список всех достижений
- ✅ Примеры парсинга цитат
- ✅ Статус компонентов
- ✅ Справку по разблокировке достижений

## 📈 Статистика и мониторинг

### API endpoints (добавить в routes)

```javascript
// GET /api/gamification/stats
{
  "overview": {
    "totalUsers": 150,
    "totalQuotes": 2500,
    "averageQuotesPerUser": 17
  },
  "achievements": {
    "first_quote": {
      "usersUnlocked": 150,
      "percentage": 100
    },
    "wisdom_collector": {
      "usersUnlocked": 45,
      "percentage": 30
    }
  },
  "topUsers": [...],
  "streaks": {...}
}
```

### Health Check

```javascript
// Добавится в /api/health
"gamification": {
  "status": "healthy",
  "isInitialized": true,
  "components": {
    "quoteHandler": true,
    "commandHandler": true,
    "achievementService": true
  }
}
```

## 🎯 Примеры использования

### Отправка цитаты
```
Пользователь: "В каждом слове — целая жизнь" (Марина Цветаева)

Бот: ✨ Прекрасная цитата! Цветаева умеет находить глубину в простых словах.

Сохранил в ваш личный дневник 📖
Цитат на этой неделе: 3

💡 Кстати, если вас тянет к поэзии о внутреннем мире, у Анны есть разбор "Письма к молодому поэту" Рильке.

[Через секунду]
🎉 Поздравляю!

Вы получили достижение:
🌱 Первые шаги
Сохранили первую цитату в дневник мудрости

Продолжайте собирать моменты вдохновения! 📖
```

### Команда /stats
```
📊 Статистика Мария:

📖 Цитаты:
└ Всего собрано: 25
└ Текущая серия: 3 дня
└ Рекорд серии: 7 дней

🕐 Время с ботом:
└ 15 дней

👤 Любимые авторы:
1. Толстой
2. Цветаева
3. Фромм

🏆 Достижения:
└ Получено: 3/8
└ Прогресс: 38%

Последние достижения:
🌱 Первые шаги
📚 Коллекционер мудрости
💭 Мыслитель
```

## 🔧 Настройки и конфигурация

### Изменение лимитов
```javascript
// В quoteHandler.js
this.dailyQuoteLimit = 10; // Цитат в день
```

### Добавление новых достижений
```javascript
// В achievementService.js _initializeAchievements()
{
  id: 'new_achievement',
  name: 'Название',
  description: 'Описание достижения',
  icon: '🏆',
  targetValue: 100,
  type: 'quotes_count',
  checkCondition: async (userId) => {
    // Логика проверки
    return true/false;
  }
}
```

### Настройка ответов Анны
```javascript
// В quoteHandler.js _getBookRecommendation()
const recommendations = {
  'Новая_Категория': [
    'Рекомендация 1',
    'Рекомендация 2'
  ]
};
```

## ⚠️ Важные замечания

1. **Claude API** - убедитесь, что `claudeService` настроен правильно
2. **Модели MongoDB** - требуются обновленные модели из репозитория
3. **Telegram Bot** - интеграция требует основного бота
4. **Лимиты** - система учитывает дневные лимиты пользователей
5. **Производительность** - достижения проверяются асинхронно

## 📋 TODO для полной интеграции

- [ ] Добавить геймификацию в main Telegram bot handler
- [ ] Обновить index.js с инициализацией gamification
- [ ] Добавить API routes для статистики
- [ ] Интегрировать с weeklyReportService
- [ ] Добавить tests в CI/CD
- [ ] Настроить мониторинг достижений

---

🎮 **Геймификация готова к интеграции!** 

Следуйте инструкциям выше для подключения к основному боту "Читатель".