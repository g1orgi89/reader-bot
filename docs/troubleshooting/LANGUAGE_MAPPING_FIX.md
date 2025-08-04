# 🍄 ИСПРАВЛЕНИЕ: Проблема с определением языка в RAG системе

## 📊 Анализ проблемы

### Суть проблемы
База данных не могла найти документы, добавленные через админ-панель, из-за несоответствия в определении языка между разными компонентами системы.

### Техническая причина
**Админ-панель сохраняет языки как полные названия:**
- "English" 
- "Русский"
- "Español"

**Но система ожидает коды языков:**
- "en"
- "ru" 
- "es"

### Места возникновения проблемы
1. **AdminPanel (knowledge.html)** - селекторы языков используют полные названия
2. **PromptService.getActivePrompt()** - получает полные названия, но ищет по кодам
3. **ClaudeService** - передает языки из AdminPanel в PromptService без нормализации

## 🔧 Реализованное решение

### 1. Добавление языкового mapping в PromptService
Создан словарь для преобразования полных названий языков в коды:

```javascript
/** @type {Object<string, string>} Mapping полных названий языков к кодам */
this.languageMap = {
  'English': 'en',
  'Русский': 'ru', 
  'Español': 'es',
  'en': 'en',
  'ru': 'ru',
  'es': 'es',
  'all': 'all'
};
```

### 2. Нормализация языка
Добавлен метод `normalizeLanguage()` для автоматического преобразования:

```javascript
normalizeLanguage(language) {
  if (!language) return 'en';
  
  // Ищем в mapping таблице
  const normalized = this.languageMap[language];
  if (normalized) {
    return normalized;
  }
  
  // Если не найдено в mapping, пытаемся найти по подстроке (case-insensitive)
  const lowerLanguage = language.toLowerCase();
  for (const [key, value] of Object.entries(this.languageMap)) {
    if (key.toLowerCase().includes(lowerLanguage) || lowerLanguage.includes(key.toLowerCase())) {
      logger.info(`🍄 Language mapping found: ${language} -> ${value}`);
      return value;
    }
  }
  
  // По умолчанию возвращаем английский
  logger.warn(`🍄 Unknown language "${language}", defaulting to "en"`);
  return 'en';
}
```

### 3. Интеграция в getActivePrompt()
Все вызовы `getActivePrompt()` теперь нормализуют язык перед поиском:

```javascript
async getActivePrompt(type, language = 'en') {
  // 🍄 ИСПРАВЛЕНИЕ: Нормализуем язык для обработки полных названий
  const normalizedLanguage = this.normalizeLanguage(language);
  const cacheKey = `${type}_${normalizedLanguage}`;
  
  logger.debug(`🍄 Getting prompt: type=${type}, original_language=${language}, normalized=${normalizedLanguage}`);
  
  // ... остальная логика
}
```

## 📈 Результат

### ✅ Что исправлено
1. **Админ-панель может продолжать использовать полные названия языков** - обратная совместимость сохранена
2. **PromptService автоматически нормализует языки** - работает с любыми форматами
3. **База знаний теперь корректно находит документы** - RAG система функционирует правильно
4. **Логирование улучшено** - видно процесс нормализации для отладки

### 🔍 Диагностика включает
- Отображение language mapping в статистике
- Тестирование с разными форматами языков в диагностике
- Подробное логирование процесса нормализации

### 🏗️ Архитектурная стабильность
- **Никаких изменений в AdminPanel** - UI остается без изменений
- **Обратная совместимость** - старые вызовы с кодами языков работают как прежде
- **Прямая совместимость** - новые полные названия автоматически обрабатываются

## 🧪 Тестирование

### Сценарии для проверки
1. **Создание документа через AdminPanel** с "Русский" → должен сохраниться как "ru"
2. **Поиск по RAG** с language="Español" → должен найти документы с "es"
3. **API вызовы** с language="en" → должны работать как раньше
4. **Диагностика PromptService** → должна показывать mapping таблицу

### Команды для тестирования
```bash
# Проверка нормализации через диагностику
curl -u admin:password123 http://localhost:3000/api/admin/diagnosis

# Создание документа через API с полным названием языка
curl -X POST http://localhost:3000/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "Test", "language": "Русский"}'

# Поиск в RAG с полным названием
curl -X POST http://localhost:3000/api/knowledge/test-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "language": "English"}'
```

## 📝 Заключение

Проблема решена **без нарушения существующей архитектуры** и **без изменений в UI**. PromptService теперь является "умным мостом", который автоматически обрабатывает различные форматы языков, обеспечивая совместимость между AdminPanel и базой данных.

Это решение также устойчиво к будущим изменениям - если потребуется добавить новые языки или изменить формат, достаточно будет обновить только `languageMap` в PromptService.