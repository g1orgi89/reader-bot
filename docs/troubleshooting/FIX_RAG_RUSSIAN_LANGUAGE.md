# 🍄 ИСПРАВЛЕНИЕ ПРОБЛЕМ RAG ДЛЯ РУССКОГО ЯЗЫКА

## 🔍 ДИАГНОСТИРОВАННЫЕ ПРОБЛЕМЫ

### 1. СЛИШКОМ ВЫСОКИЕ ПОРОГИ РЕЛЕВАНТНОСТИ
```javascript
// В server/services/vectorStore.js строка 58-63
this.languageThresholds = {
  'ru': 0.75, // 🚨 СЛИШКОМ ВЫСОКИЙ! Снизить до 0.65
  'en': 0.7,  
  'es': 0.7   
};
```

### 2. ПУСТАЯ БАЗА ЗНАНИЙ
- Папки knowledge/* содержат только .gitkeep файлы
- Нет русскоязычного контента для поиска

### 3. ПРОБЛЕМЫ LANGUAGE DETECTION
```javascript
// В server/services/languageDetect.js - слишком сложная логика
// Короткие русские сообщения могут неправильно определяться
```

## 🛠️ ПЛАН ИСПРАВЛЕНИЯ

### ШАГ 1: Снижение порогов для русского языка
```javascript
// Изменить в server/services/vectorStore.js
this.languageThresholds = {
  'ru': 0.60, // Снижено с 0.75
  'en': 0.70,  
  'es': 0.70   
};
```

### ШАГ 2: Добавление русскоязычного контента
Создать файлы в knowledge/general/:
- `project-overview-ru.md`
- `token-info-ru.md` 
- `farming-guide-ru.md`

### ШАГ 3: Упрощение определения языка
```javascript
// Добавить в server/services/languageDetect.js
// Приоритет для кириллицы в коротких сообщениях
if (/[а-яё]/i.test(text)) {
  return 'ru'; // Принудительно русский
}
```

### ШАГ 4: Отладочные endpoint-ы
```javascript
// Добавить в API для тестирования
GET /api/debug/vector-search?q=токен&lang=ru
GET /api/debug/language-detect?text=Что такое SHROOMS?
```

## 🧪 ТЕСТИРОВАНИЕ

### Команды для проверки:
```bash
# 1. Тестирование определения языка
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Что такое токен SHROOMS?", "userId": "test-ru"}'

# 2. Тестирование векторного поиска
curl -X GET "http://localhost:3000/api/debug/vector-search?q=токен&lang=ru"

# 3. Проверка базы знаний
curl -X GET "http://localhost:3000/api/knowledge?language=ru"
```

## 🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

После исправлений:
- ✅ Русские запросы находят релевантные документы
- ✅ Снижен порог релевантности с 0.75 до 0.60
- ✅ Добавлен русскоязычный контент в базу знаний
- ✅ Упрощена логика определения языка для кириллицы
- ✅ Добавлены отладочные API для тестирования

## 🔄 ПРОЦЕСС ВНЕДРЕНИЯ

1. **Создать тестовые русские документы**
2. **Снизить пороги в vectorStore.js**
3. **Упростить languageDetect.js**
4. **Добавить отладочные endpoint-ы**
5. **Протестировать с русскими запросами**
6. **Настроить мониторинг RAG метрик**

## 📊 МЕТРИКИ ДЛЯ МОНИТОРИНГА

```javascript
// Добавить в статистику
{
  "rag_stats": {
    "searches_by_language": {
      "ru": 45,
      "en": 120,
      "es": 30
    },
    "documents_found_by_language": {
      "ru": 38, // Должно быть > 80% от searches
      "en": 115,
      "es": 28
    },
    "avg_relevance_scores": {
      "ru": 0.72,
      "en": 0.78,
      "es": 0.75
    }
  }
}
```
