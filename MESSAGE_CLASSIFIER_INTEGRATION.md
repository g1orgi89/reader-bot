# 📖 MessageClassifier Integration Guide

## Умное разделение цитат от вопросов - РЕАЛИЗОВАНО ✅

### 🎯 Проблема решена
Пользователи хотели отправлять **и** цитаты для дневника **и** задавать вопросы боту, но нужно было их различать автоматически. Теперь эта проблема решена с помощью MessageClassifier.

---

## 🧠 Как работает MessageClassifier

### 1. Многоуровневая классификация

```javascript
async classifyMessage(messageText, context = {}) {
  // 1. Быстрое определение по формату
  const formatResult = this.detectByFormat(messageText);
  if (formatResult.confidence > 0.8) return formatResult;

  // 2. Определение по паттернам содержания
  const patternResult = this.detectByPatterns(messageText);
  if (patternResult.confidence > 0.7) return patternResult;

  // 3. AI-анализ через Claude для сложных случаев
  const aiResult = await this.classifyWithAI(messageText, context);
  if (aiResult.confidence > 0.6) return aiResult;

  // 4. Помечаем как неопределенное -> просим уточнить у пользователя
  return { type: 'ambiguous', confidence: 0.5 };
}
```

### 2. Типы сообщений

| Тип | Описание | Примеры |
|-----|----------|---------|
| `quote` | Цитаты, афоризмы, мудрые мысли | "Жизнь прекрасна" (Толстой) |
| `question` | Обычные вопросы боту | "Как настроить напоминания?" |
| `complex_question` | Вопросы для Анны | "У меня депрессия, помогите" |
| `command` | Команды боту | "/stats", "настройки" |
| `ambiguous` | Неопределенные сообщения | Требуют уточнения |

---

## 🔍 Детекция по формату (formatDetection)

### Паттерны цитат
```javascript
this.quotePatterns = [
  /^"([^"]+)"\s*\(([^)]+)\)$/,     // "Текст" (Автор)
  /^"([^"]+)"\s*-\s*(.+)$/,        // "Текст" - Автор
  /^([^-()]+)\s*\(([^)]+)\)$/,     // Текст (Автор)
  /^([^-()]+)\s*-\s*(.+)$/,        // Текст - Автор
  /^«([^»]+)»\s*\(([^)]+)\)$/,     // «Текст» (Автор)
];
```

**Примеры распознавания:**
- ✅ `"В каждом слове — целая жизнь" (Марина Цветаева)` → **quote** (0.9)
- ✅ `Счастье внутри нас (Будда)` → **quote** (0.9)
- ✅ `/stats` → **command** (0.95)
- ✅ `Как дела?` → **question** (0.8)

---

## 📊 Детекция по содержанию (patternDetection)

### Индикаторы вопросов
```javascript
this.questionIndicators = [
  /^(как|что|где|когда|почему|зачем|кто|какой)/i,
  /\?$/,
  /можете?.*помочь/i,
  /помогите/i,
  /не понимаю/i
];
```

### Сложные вопросы (для Анны)
```javascript
this.complexQuestionPatterns = [
  /не знаю что делать/i,
  /проблема/i,
  /депрессия/i,
  /консультация/i,
  /личн(ая|ые) проблем/i
];
```

### Ключевые слова мудрости
```javascript
const wisdomKeywords = [
  'мудрость', 'жизнь', 'любовь', 'счастье', 'истина', 
  'смысл', 'судьба', 'время', 'душа', 'сердце'
];
```

**Логика:** Если сообщение содержит слова мудрости, короткое (< 200 символов) и без знака вопроса → вероятно **цитата**.

---

## 🤖 AI-классификация через Claude

### Промпт для Claude
```
Определи тип сообщения для бота "Читатель" (личный дневник цитат от психолога Анны Бусел).

Сообщение: "В трудные моменты помни о прекрасном"

Пользователь может:
1. Присылать ЦИТАТЫ из книг или свои мысли для сохранения в дневник
2. Задавать ВОПРОСЫ боту или просить помощи
3. Отправлять КОМАНДЫ для управления ботом

Определи тип: QUOTE, QUESTION, COMPLEX_QUESTION, COMMAND или AMBIGUOUS
```

**Результат:** Claude анализирует контекст и возвращает тип с высокой точностью.

---

## 🎭 Обработка неопределенных сообщений

### Когда сообщение неопределенное
Если все методы дают низкую уверенность (< 0.6), бот спрашивает у пользователя:

```
📖 Не совсем понял, что вы хотели:

"В трудные моменты помни о прекрасном"

Это:
[📖 Цитата для дневника] [💬 Вопрос боту]
                    [❌ Отменить]
```

### Пример диалога
```
👤 Пользователь: "В трудные моменты помни о прекрасном"

🤖 Бот: Не совсем понял, что вы хотели:
       "В трудные моменты помни о прекрасном"
       Это:
       [📖 Цитата для дневника] [💬 Вопрос боту]

👤 Нажимает: [📖 Цитата для дневника]

🤖 Бот: ✅ Цитата сохранена в ваш дневник!
       📊 Цитат на этой неделе: 5
```

---

## ⚡ Интеграция в основной поток

### Замена старой логики
**Было:**
```javascript
// Старый способ
if (BotHelpers.isQuoteMessage(messageText)) {
  await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
} else {
  await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
}
```

**Стало:**
```javascript
// Новый умный способ
const classification = await this.messageClassifier.classifyMessage(messageText, {
  userId, userProfile
});

switch (classification.type) {
  case 'quote':
    await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
    break;
  case 'question':
    await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
    break;
  case 'complex_question':
    await this.complexQuestionHandler.handleComplexQuestion(ctx, messageText, userProfile);
    break;
  case 'ambiguous':
    await this._handleAmbiguousMessage(ctx, messageText, classification);
    break;
}
```

---

## 📈 Статистика и мониторинг

### Логирование классификации
```javascript
logger.info(`📖 Message classified as: ${classification.type} (confidence: ${classification.confidence})`);
```

### Статистика в /stats
```javascript
classification: {
  patterns: {
    quotePatterns: 6,
    questionIndicators: 8,
    commandIndicators: 6,
    complexQuestionPatterns: 7
  },
  features: {
    formatDetection: true,
    patternDetection: true,
    aiClassification: true,
    ambiguityResolution: true
  }
}
```

---

## 🔧 Технические детали

### Хранение ожидающих сообщений
```javascript
// Map для временного хранения неопределенных сообщений
this.pendingClassifications = new Map(); // userId -> { message, timestamp }

// Auto-cleanup через 5 минут
setTimeout(() => {
  if (this.pendingClassifications.has(userId)) {
    this.pendingClassifications.delete(userId);
  }
}, 5 * 60 * 1000);
```

### Callback handlers для уточнения
```javascript
// Обработка ответов пользователя
if (callbackData.startsWith('classify_')) {
  await this._handleClassificationCallback(ctx, callbackData);
  return;
}

// classify_quote_xxx -> обработать как цитату
// classify_question_xxx -> обработать как вопрос
// classify_cancel -> отменить
```

---

## 🎯 Примеры работы

### Успешная классификация
```
👤 "Жизнь прекрасна" (Толстой)
🧠 Классификация: quote (confidence: 0.9)
🤖 ✅ Цитата сохранена! Сохранил в ваш личный дневник 📖

👤 Как посмотреть статистику?
🧠 Классификация: question (confidence: 0.8)
🤖 📊 Для просмотра статистики используйте /stats

👤 У меня депрессия, помогите
🧠 Классификация: complex_question (confidence: 0.9)
🤖 Этот вопрос требует персонального внимания Анны...
```

### Неопределенное сообщение
```
👤 Сегодня хороший день
🧠 Классификация: ambiguous (confidence: 0.5)
🤖 Не совсем понял, что вы хотели:
   "Сегодня хороший день"
   Это:
   [📖 Цитата для дневника] [💬 Вопрос боту]

👤 [нажимает "📖 Цитата для дневника"]
🤖 ✅ Цитата сохранена!
```

---

## ✨ Преимущества решения

### ✅ Для пользователей
- **Интуитивно:** Просто отправляют сообщения как обычно
- **Без команд:** Не нужно помнить специальные префиксы
- **Понятно:** Если бот не уверен, он просто спрашивает
- **Гибко:** Можно исправить неправильную классификацию

### ✅ Для системы
- **Точно:** Многоуровневая классификация с high confidence
- **Умно:** AI помогает в сложных случаях
- **Надежно:** Fallback логика для edge cases
- **Масштабируемо:** Легко добавить новые типы сообщений

### ✅ Для аналитики
- **Прозрачно:** Логирование всех классификаций
- **Измеримо:** Статистика точности и уверенности
- **Оптимизируемо:** Можно улучшать паттерны на основе данных

---

## 🎉 Результат

**Проблема решена!** Пользователи могут свободно общаться с ботом, отправляя и цитаты, и вопросы. Бот умно различает их и обрабатывает соответствующим образом.

Интеграция MessageClassifier завершена и работает в production! 🚀📖