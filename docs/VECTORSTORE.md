# VectorStore Service - Документация

## Обзор

VectorStore Service - это компонент системы Shrooms AI Support Bot, отвечающий за работу с векторной базой знаний. Он реализован следуя лучшим практикам из Anthropic Cookbook и обеспечивает эффективный поиск релевантной информации для RAG-системы.

## Ключевые особенности

- ✅ **Полная типизация** - все функции и объекты типизированы с помощью JSDoc
- ✅ **Contextual Embeddings** - поддержка контекстных embeddings для улучшения релевантности
- ✅ **Мультиязычность** - поддержка английского, испанского и русского языков
- ✅ **Intelligent Chunking** - умное разделение документов с учетом структуры
- ✅ **Кэширование запросов** - автоматическое кэширование для повышения производительности
- ✅ **Batch операции** - эффективная обработка больших объемов данных

## Архитектура

```
VectorStore Service
├── VectorStoreService (основной класс)
├── TextProcessor (обработка текста)
├── Knowledge API (REST API)
└── Configuration (настройки)
```

## Использование

### 1. Инициализация

```javascript
const VectorStoreService = require('./server/services/vectorStore');
const { getVectorStoreConfig } = require('./server/config/vectorStore');

// Получение конфигурации
const config = getVectorStoreConfig(process.env.NODE_ENV);

// Создание экземпляра сервиса
const vectorStore = new VectorStoreService(config);

// Инициализация
await vectorStore.initialize();
```

### 2. Добавление документов

```javascript
const documents = [
  {
    id: 'doc_1',
    content: 'Содержимое документа...',
    metadata: {
      source: 'manual_upload',
      category: 'general',
      language: 'ru',
      tags: ['shrooms', 'web3']
    }
  }
];

const result = await vectorStore.addDocuments(documents);
console.log(`Added ${result.succeeded} documents successfully`);
```

### 3. Поиск документов

```javascript
const results = await vectorStore.search('как подключить кошелек', {
  limit: 5,
  threshold: 0.7,
  language: 'ru',
  category: 'user-guide'
});

console.log(`Found ${results.length} relevant documents`);
```

### 4. Обработка текста с chunking

```javascript
const TextProcessor = require('./server/utils/textProcessor');

const processor = new TextProcessor({
  chunkSize: 800,
  chunkOverlap: 200,
  useBoundaryDetection: true
});

const result = await processor.createChunks(content, metadata);
console.log(`Created ${result.chunks.length} chunks`);
```

## API Endpoints

### POST /api/knowledge/documents
Добавление нового документа в базу знаний.

```json
{
  "title": "Заголовок документа",
  "content": "Содержимое документа",
  "category": "general",
  "language": "ru",
  "tags": ["tag1", "tag2"]
}
```

### GET /api/knowledge/search
Поиск документов в базе знаний.

Параметры:
- `q` - поисковый запрос (обязательный)
- `language` - язык документов
- `category` - категория документов
- `limit` - количество результатов (по умолчанию 10)
- `threshold` - минимальный порог релевантности (по умолчанию 0.7)

### POST /api/knowledge/upload
Загрузка файлов в базу знаний.

### GET /api/knowledge/stats
Получение статистики базы знаний.

### GET /api/knowledge/health
Проверка работоспособности сервиса.

## Конфигурация

### Переменные окружения

```env
# Qdrant Vector Database
VECTOR_DB_URL=http://localhost:6333

# Embedding provider (voyage или openai)
EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-2
VOYAGE_API_KEY=your-voyage-api-key

# Альтернативно для OpenAI
OPENAI_API_KEY=your-openai-api-key
```

### Настройка провайдеров embeddings

#### Voyage AI (рекомендуется)
```javascript
{
  provider: 'voyage',
  model: 'voyage-2',           // или voyage-large-2
  apiKey: process.env.VOYAGE_API_KEY
}
```

#### OpenAI
```javascript
{
  provider: 'openai',
  model: 'text-embedding-ada-002',
  apiKey: process.env.OPENAI_API_KEY
}
```

## Загрузка початей базы знаний

### Автоматическая загрузка

```bash
# Запуск скрипта загрузки
node scripts/loadKnowledge.js
```

### Ручная загрузка

```javascript
const KnowledgeLoader = require('./scripts/loadKnowledge');

const loader = new KnowledgeLoader();
await loader.loadKnowledgeBase();
```

## Лучшие практики

### 1. Структура документов

Организуйте документы в следующую структуру:

```
knowledge/
├── general/
│   ├── en/
│   ├── es/
│   └── ru/
├── user-guide/
├── tokenomics/
├── technical/
└── troubleshooting/
```

### 2. Оптимизация поиска

- Используйте `inputType: 'query'` для embeddings поисковых запросов
- Настройте `threshold` в зависимости от требований к точности
- Группируйте похожие документы по категориям

### 3. Chunking

- Для технического контента увеличьте размер чанков (1000+ токенов)
- Для FAQ используйте меньшие чанки (400-600 токенов)
- Используйте `preserveCodeBlocks: true` для документации с кодом

### 4. Мониторинг

Отслеживайте следующие метрики:
- Средний scores поиска
- Количество пустых результатов
- Время отклика
- Размер кэша запросов

## Troubleshooting

### Проблемы с подключением к Qdrant

1. Проверьте доступность Qdrant:
```bash
curl http://localhost:6333/collections
```

2. Убедитесь в правильности конфигурации:
```javascript
const health = await vectorStore.getStats();
console.log(health);
```

### Низкое качество поиска

1. Проверьте качество embeddings:
   - Убедитесь в корректности `inputType`
   - Проверьте модель embeddings

2. Настройте chunking:
   - Уменьшите размер чанков
   - Увеличьте overlap между чанками

### Производительность

1. Используйте batch операции:
```javascript
// Вместо цикла отдельных вставок
for (const doc of documents) {
  await vectorStore.addDocuments([doc]);
}

// Используйте batch
await vectorStore.addDocuments(documents);
```

2. Настройте кэширование:
```javascript
// Увеличьте размер кэша для часто используемых запросов
const options = {
  cache: {
    maxSize: 2000,
    ttl: 48 * 60 * 60 * 1000 // 48 hours
  }
};
```

## Интеграция с Claude

### Настройка contextual embeddings

```javascript
const contextualChunks = await textProcessor.createContextualEmbeddings(
  chunks,
  fullDocument,
  claudeClient
);
```

### Использование в RAG

```javascript
// 1. Поиск релевантных документов
const searchResults = await vectorStore.search(userQuery, {
  limit: 5,
  language: userLanguage
});

// 2. Формирование контекста для Claude
const context = searchResults.map(result => result.document.content).join('\n\n');

// 3. Отправка запроса к Claude с контекстом
const response = await claudeClient.messages.create({
  model: 'claude-3-haiku-20240307',
  messages: [{
    role: 'user',
    content: `Контекст: ${context}\n\nВопрос: ${userQuery}`
  }]
});
```

## Расширения и кастомизация

### Добавление нового провайдера embeddings

1. Расширьте конфигурацию:
```javascript
// server/config/vectorStore.js
const providers = {
  // ...existing providers
  custom: {
    models: ['custom-model-1'],
    dimensions: { 'custom-model-1': 768 }
  }
};
```

2. Добавьте логику в VectorStoreService:
```javascript
// server/services/vectorStore.js
case 'custom':
  this.embeddingClient = new CustomEmbeddingClient({
    apiKey: apiKey,
    apiUrl: this.options.embeddingProvider.apiUrl
  });
  break;
```

### Кастомные метрики поиска

```javascript
// Добавление custom scoring
class CustomVectorStore extends VectorStoreService {
  async search(query, options = {}) {
    const results = await super.search(query, options);
    
    // Применение custom scoring
    return results.map(result => ({
      ...result,
      customScore: this.calculateCustomScore(result)
    }));
  }
  
  calculateCustomScore(result) {
    // Custom scoring logic
    return result.score * someCustomWeight;
  }
}
```

## Заключение

VectorStore Service обеспечивает мощную и гибкую систему поиска для проекта Shrooms. Следуя приведенным рекомендациям и лучшим практикам, вы сможете создать эффективную и масштабируемую систему на основе RAG.

Для получения дополнительной помощи обращайтесь к:
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)
- [Документации Qdrant](https://qdrant.tech/documentation/)
- [Voyage AI Documentation](https://docs.voyageai.com/)

---

*Документация создана для проекта Shrooms AI Support Bot*