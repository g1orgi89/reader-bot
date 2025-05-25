# 🍄 PROMPT CONFLICTS RESOLUTION REPORT

## Проблема
Промпты из базы знаний не использовались из-за конфликтов между старой системой промптов (`prompts-fixed.js`) и новой системой (`PromptService`).

## Выполненные исправления

### ✅ ЭТАП 1: УБИРАЕМ КОНФЛИКТЫ (БЕЗОПАСНО)

#### 1. Исправлен `server/services/diagnostics.js`
**Проблема:** Импортировал устаревший `prompts-fixed.js`
```javascript
// БЫЛО:
const { DIAGNOSTIC_QUESTIONS, QUICK_SOLUTIONS } = require('../config/prompts-fixed');

// СТАЛО:
// Inline константы внутри файла (без внешних зависимостей)
```
**Результат:** ✅ Удалена зависимость от устаревшего файла

#### 2. Деактивирован `server/config/prompts-fixed.js`
**Проблема:** Файл создавал конфликты с `PromptService`
```javascript
// СТАЛО:
throw new Error(`🍄 ОШИБКА: prompts-fixed.js деактивирован!`);
```
**Результат:** ✅ Предотвращены конфликты импортов

#### 3. Создан backup `server/config/prompts-fixed-backup.js`
**Результат:** ✅ Сохранена резервная копия для справки

### ✅ ЭТАП 2: ПРОВЕРКА CLAUDE.JS

**Анализ файла `server/services/claude.js`:**
- ✅ Захардкоженные промпты ОТСУТСТВУЮТ
- ✅ Корректно использует `PromptService` 
- ✅ Есть fallback на дефолтные промпты
- ✅ Правильная интеграция с векторной базой

```javascript
// ПРАВИЛЬНАЯ ИНТЕГРАЦИЯ:
async _getSystemPrompt(language = 'en') {
  try {
    return await promptService.getActivePrompt('basic', language);
  } catch (error) {
    return promptService.getDefaultPrompt('basic', language);
  }
}
```

## Текущее состояние

### 🟢 РАБОТАЕТ:
1. **PromptService** - динамическое получение промптов из MongoDB
2. **Fallback система** - резервные промпты из `fallbackPrompts.js`
3. **DiagnosticsService** - inline константы без внешних зависимостей
4. **Claude.js** - корректная интеграция с PromptService

### 🟡 ВОЗМОЖНЫЕ ПРИЧИНЫ НЕИСПОЛЬЗОВАНИЯ RAG:

1. **Проблемы с векторной базой:**
   - Недостаточно документов в Qdrant
   - Высокий порог релевантности (0.7)
   - Проблемы с embeddings

2. **Проблемы с настройками:**
   - `ENABLE_RAG=false` в .env
   - Неправильная конфигурация Qdrant

3. **Проблемы с промптами в БД:**
   - Отсутствуют активные промпты в MongoDB
   - Используются только fallback промпты

## Рекомендации для диагностики

### 1. Проверить настройки RAG:
```bash
# В .env файле:
ENABLE_RAG=true
VECTOR_DB_URL=http://localhost:6333
```

### 2. Проверить содержимое векторной базы:
```javascript
// Через API /api/admin/knowledge/diagnose
// Или через vectorStoreService.healthCheck()
```

### 3. Проверить промпты в MongoDB:
```javascript
// Через API /api/admin/prompts
// Или через promptService.diagnose()
```

### 4. Проверить пороги релевантности:
```javascript
// В claude.js _getRelevantContext():
const score_threshold = 0.7; // Попробовать понизить до 0.4
```

## Следующие шаги

1. **Запустить диагностику** всех компонентов
2. **Проверить логи** на предмет ошибок RAG
3. **Протестировать** с разными порогами релевантности
4. **Добавить больше документов** в векторную базу при необходимости

## Файлы изменены:
- ✅ `server/services/diagnostics.js` - убрана зависимость от prompts-fixed.js
- ✅ `server/config/prompts-fixed.js` - деактивирован  
- ✅ `server/config/prompts-fixed-backup.js` - создан backup

## Файлы БЕЗ изменений (работают корректно):
- ✅ `server/services/claude.js` - уже правильно настроен
- ✅ `server/services/promptService.js` - работает корректно
- ✅ `server/config/fallbackPrompts.js` - резервные промпты готовы