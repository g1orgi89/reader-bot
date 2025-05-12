# Shrooms AI Support Bot - Типизированная архитектура

## Обзор

Этот проект реализует AI-бот поддержки для Web3-платформы "Shrooms" с полной поддержкой типизации JSDoc и интеграцией с Claude API.

## Структура типизации

### Типы для базы знаний (`server/types/knowledge.js`)

```javascript
/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} path - Путь к файлу
 * @property {string} content - Содержимое
 * @property {DocumentMetadata} metadata - Метаданные
 * @property {string} hash - Хеш содержимого
 */

/**
 * @typedef {Object} DocumentMetadata
 * @property {string} source - Исходный файл
 * @property {string} title - Заголовок
 * @property {string} language - Язык (en, es, ru)
 * @property {string} category - Категория
 * @property {string[]} tags - Теги
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */
```

### Типы для векторной базы (`server/types/vectorStore.js`)

```javascript
/**
 * @typedef {Object} EmbeddingConfig
 * @property {string} provider - Провайдер embeddings
 * @property {string} model - Модель для создания embeddings
 * @property {string} apiKey - API ключ провайдера
 * @property {number} dimensions - Размерность векторов
 * @property {EmbeddingOptions} options - Дополнительные опции
 */

/**
 * @typedef {Object} VectorStoreConfig
 * @property {string} type - Тип векторной базы
 * @property {string} url - URL подключения
 * @property {string} apiKey - API ключ
 * @property {string} collectionName - Название коллекции
 */
```

## Компоненты с типизацией

### 1. Типизированный скрипт загрузки (`scripts/loadKnowledge.js`)

#### Ключевые особенности:
- Полная типизация всех функций и методов
- Типизированная очередь для embeddings
- Конфигурируемые загрузчики для разных типов файлов
- Статистика с детальной типизацией

#### Использование:
```bash
npm run load-knowledge
```

#### Конфигурация через типы:
```javascript
const config = {
  maxConcurrency: 4,
  processingOptions: {
    chunkSize: 1000,
    chunkOverlap: 200,
    splitter: 'recursive'
  }
};

const loader = new TypedKnowledgeLoader(config);
```

### 2. Типизированные сервисы

#### VectorStoreService
- Полная типизация для Qdrant/Pinecone/другие провайдеры
- Типы для поиска и индексации
- Интерфейсы для операций с векторами

#### TextProcessor
- Типизированные методы создания чанков
- Конфигурируемые стратегии разделения
- Метаданные с полной типизацией

### 3. Конфигурация embeddings (`server/config/embeddings.js`)

#### Типизированные провайдеры:
```javascript
const embeddingConfig = getEmbeddingConfig('voyage', 'en');
// Returns fully typed EmbeddingConfig
```

#### Автоматический выбор провайдера:
```javascript
const optimal = getOptimalProviderForLanguage('ru');
// Returns 'cohere' for Russian text
```

## Паттерны типизации

### 1. Barrel Exports
```javascript
// server/types/index.js
module.exports = {
  // Все типы доступны в одном месте
  ...knowledgeTypes,
  ...vectorStoreTypes
};
```

### 2. JSDoc TypeDefs
```javascript
/**
 * @typedef {import('../types').DocumentMetadata} DocumentMetadata
 */
```

### 3. Валидация типов в runtime
```javascript
validateEmbeddingConfig(config);
// Выбрасывает ошибку, если конфигурация невалидна
```

## Workflow разработки

### 1. Создание нового компонента
1. Определить типы в `server/types/`
2. Использовать типы в реализации через `@typedef`
3. Добавить в barrel export
4. Написать тесты с типизацией

### 2. Модификация существующих типов
1. Обновить определения в `server/types/`
2. Проверить совместимость с существующим кодом
3. Обновить тесты и документацию

### 3. Добавление новых провайдеров
```javascript
// В embeddings.js
EMBEDDING_PROVIDERS.newProvider = {
  provider: 'newProvider',
  model: 'new-model',
  dimensions: 768,
  // ... полная типизация
};
```

## Тестирование типизации

### Unit тесты
- Полная типизация тестов
- Мокирование с сохранением типов
- Валидация типизированных результатов

### Пример теста:
```javascript
describe('TypedKnowledgeLoader', () => {
  /** @type {TypedKnowledgeLoader} */
  let loader;
  
  beforeEach(() => {
    loader = new TypedKnowledgeLoader();
  });
  
  test('should validate document types', () => {
    const doc = { /* fully typed document */ };
    const result = loader.validateDocuments([doc]);
    expect(result).toHaveLength(1);
  });
});
```

## Интеграция с существующим кодом

### Миграция от старой версии
1. Импортировать типы: `const { DocumentMetadata } = require('../types');`
2. Добавить типизацию к существующим функциям
3. Использовать типы в JSDoc комментариях
4. Валидировать типы в тестах

### Совместимость
- Все новые типы обратно совместимы
- Старый код работает без изменений
- Постепенное добавление типизации

## Преимущества типизации

1. **Безопасность типов**: Предотвращение ошибок на этапе разработки
2. **Улучшенный IDE опыт**: Автокомплит и проверка типов
3. **Лучшая документация**: Типы служат как документация
4. **Простота рефакторинга**: IDE может безопасно переименовывать
5. **Валидация в runtime**: Проверка типов во время выполнения

## Рекомендации

### Для разработчиков
1. Всегда определяйте типы перед реализацией
2. Используйте barrel exports для удобного импорта
3. Добавляйте валидацию для публичных API
4. Документируйте сложные типы примерами

### Для расширения проекта
1. Новые модули должны иметь полную типизацию
2. Типы должны быть в `server/types/`
3. Обновляйте tests при изменении типов
4. Поддерживайте backward compatibility

## Заключение

Типизированная архитектура обеспечивает:
- Более надежный код
- Лучший developer experience
- Простоту поддержки и расширения
- Автоматическую документацию

Все компоненты проекта следуют единым паттернам типизации, что обеспечивает консистентность и упрощает разработку.