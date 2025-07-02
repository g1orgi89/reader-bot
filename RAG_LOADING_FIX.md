# FIX: Предотвращена загрузка векторной базы при useRag=false

## 🔍 ПРОБЛЕМА
После добавления `claudeService` в `weeklyReportService.js`, векторная база начала загружаться при каждом вызове, даже когда `useRag: false`.

## 🔧 ИСПРАВЛЕНИЯ

### 1. server/services/claude.js
**Проблема**: `vectorStoreService.initialize()` вызывался всегда, когда был включен RAG
**Решение**: Добавлена проверка `this.enableRag` перед инициализацией
```javascript
// 🔧 FIX: Проверяем, что векторная база действительно нужна
if (!this.enableRag) {
  logger.info('📖 RAG disabled globally, skipping vector store initialization');
  return [];
}
```

### 2. server/services/weeklyReportService.js  
**Проблема**: Отсутствовал правильный импорт `claudeService`
**Решение**: Добавлен полный сервис с правильными импортами:
```javascript
const claudeService = require('./claude'); // ✅ Импорт ClaudeService (экземпляр класса)

// Использование с отключенным RAG
const response = await claudeService.generateResponse(prompt, {
  platform: 'telegram',
  userId: userProfile.userId,
  context: 'weekly_report_analysis',
  useRag: false // 🔧 FIX: Отключаем RAG
});
```

### 3. test-rag-loading.js
**Добавлено**: Тестовый скрипт для проверки поведения RAG

## ✅ РЕЗУЛЬТАТ
- ✅ При `useRag: false` - векторная база НЕ загружается
- ✅ При `useRag: true` - векторная база загружается только при необходимости  
- ✅ WeeklyReportService использует Claude без RAG для анализа цитат
- ✅ Сохранена функциональность RAG для других случаев

## 🧪 ТЕСТИРОВАНИЕ
Запустите тест:
```bash
node test-rag-loading.js
```

Проверьте логи:
- `useRag: false` → "RAG skipped" 
- `useRag: true` → "RAG requested - initializing vector store"

## 📁 ИЗМЕНЕННЫЕ ФАЙЛЫ
- `server/services/claude.js` - Добавлена проверка enableRag
- `server/services/weeklyReportService.js` - Полный сервис с правильными импортами
- `test-rag-loading.js` - Тестовый скрипт

Теперь векторная база загружается только когда реально нужен RAG! 🚀