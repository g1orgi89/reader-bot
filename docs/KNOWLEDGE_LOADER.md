# Типизированный скрипт загрузки базы знаний

## Обзор

Улучшенная версия скрипта `loadKnowledge.js` с полной поддержкой JSDoc типизации и интегрированной совместимостью с системой типов проекта.

## Ключевые улучшения

### 1. Полная типизация JSDoc
- Все функции, методы и переменные имеют строгую типизацию
- Использование shared types из `server/types/`
- Валидация типов на всех уровнях обработки

### 2. Архитектурные улучшения
- Модульная архитектура с четким разделением ответственности
- Поддержка различных форматов файлов через типизированные загрузчики
- Конфигурируемые категории и языки с типизированными конфигурациями

### 3. Расширенная функциональность
- Контекстные embeddings с метаданными
- Параллельная обработка с ограничением concurrency
- Детальная статистика и мониторинг процесса
- Graceful shutdown и обработка ошибок

## Типы и интерфейсы

### Основные типы

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

### Конфигурационные типы

```javascript
/**
 * @typedef {Object} ProcessingOptions
 * @property {number} chunkSize - Размер чанка
 * @property {number} chunkOverlap - Перекрытие
 * @property {string} splitter - Тип разделителя
 * @property {boolean} preserveStructure - Сохранять структуру
 * @property {boolean} includeMetadata - Включать метаданные
 */

/**
 * @typedef {Object} FileType
 * @property {string} extension - Расширение файла
 * @property {string} mimeType - MIME тип
 * @property {Function} loader - Функция загрузки
 * @property {ProcessingOptions} defaultOptions - Опции по умолчанию
 */
```

## Использование

### Базовое использование

```bash
# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл

# Запуск скрипта
npm run load-knowledge
```

### Переменные окружения

```env
# Обязательные
VECTOR_DB_URL=http://localhost:6333
VECTOR_DB_TYPE=qdrant

# Один из провайдеров embeddings
VOYAGE_API_KEY=your_voyage_key
OPENAI_API_KEY=your_openai_key
COHERE_API_KEY=your_cohere_key

# Опциональные
MAX_CONCURRENCY=4
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
SPLITTER=recursive
```

### Программное использование

```javascript
const TypedKnowledgeLoader = require('./scripts/loadKnowledge');

// Создание экземпляра с кастомной конфигурацией
const loader = new TypedKnowledgeLoader({
  maxConcurrency: 8,
  processingOptions: {
    chunkSize: 1500,
    chunkOverlap: 300,
    splitter: 'sentence'
  }
});

// Запуск загрузки
const stats = await loader.loadKnowledgeBase();
console.log(`Processed ${stats.totalVectors} vectors`);
```

## Поддерживаемые форматы файлов

### Markdown (.md)
- Автоматическая обработка frontmatter
- Сохранение структуры документа
- Извлечение заголовков и тегов

### Текст (.txt)
- Обработка plain text
- Автоматическое определение языка
- Настраиваемое разделение на чанки

### JSON (.json)
- Структурированные данные
- Извлечение title, description, content
- Сохранение оригинальной структуры в метаданных

### PDF (.pdf)
- Заготовка для интеграции с pdf-parse
- Типизированный интерфейс готов к реализации

### CSV (.csv)  
- Заготовка для обработки табличных данных
- Типизированная структура для row-based splitting

## Категории и языки

### Категории
- `general` - Общая информация
- `user-guide` - Руководство пользователя
- `tokenomics` - Информация о токенах
- `technical` - Техническая документация
- `troubleshooting` - Решение проблем

### Языки
- `en` - English
- `ru` - Русский
- `es` - Español

Каждый язык и категория имеют типизированную конфигурацию с правилами обработки.

## Статистика и мониторинг

Скрипт предоставляет детальную статистику:

```javascript
{
  totalFiles: 15,          // Найдено файлов
  processedFiles: 14,      // Обработано успешно
  skippedFiles: 1,         // Пропущено
  totalChunks: 142,        // Создано чанков
  totalVectors: 138,       // Создано векторов
  errors: [               // Массив ошибок
    {
      file: 'path/to/file',
      error: 'Description',
      type: 'read'
    }
  ],
  startTime: Date,        // Время начала
  endTime: Date           // Время окончания
}
```

## Очередь Embeddings

Система включает типизированную очередь для создания embeddings:

```javascript
/**
 * @typedef {Object} EmbeddingQueue
 * @property {number} maxConcurrency - Макс. параллельность
 * @property {number} retryAttempts - Попытки повтора
 * @property {number} retryDelay - Задержка между попытками
 * @property {EmbeddingTask[]} tasks - Очередь задач
 * @property {EmbeddingTask[]} processing - Обрабатываемые
 * @property {EmbeddingTask[]} completed - Завершенные
 * @property {EmbeddingTask[]} failed - Неудачные
 */
```

## Обработка ошибок

- Типизированная система логирования ошибок
- Graceful shutdown при получении SIGINT/SIGTERM
- Retry механизм для embeddings
- Детальная информация об ошибках в статистике

## Расширение функциональности

### Добавление нового типа файлов

```javascript
// В initializeFileTypes() добавить:
fileTypes.set('.yaml', {
  extension: '.yaml',
  mimeType: 'application/yaml',
  loader: this.loadYamlFile.bind(this),
  defaultOptions: { preserveStructure: true }
});

// Реализовать загрузчик:
async loadYamlFile(document) {
  // Парсинг YAML содержимого
  return {
    content: processedContent,
    metadata: { type: 'yaml' }
  };
}
```

### Добавление новой категории

```javascript
// В initializeCategoryConfigs() добавить:
configs.set('api-docs', {
  name: 'api-docs',
  description: 'API документация',
  paths: ['api/', 'swagger/'],
  priority: 3,
  options: { chunkSize: 800 }
});
```

## Совместимость с архитектурой

Скрипт полностью совместим с архитектурой проекта Shrooms:

1. **Типизация**: Использует shared types из `server/types/`
2. **Сервисы**: Интегрируется с `VectorStoreService` и `TextProcessor`
3. **Логирование**: Использует единую систему логов
4. **Конфигурация**: Следует паттернам конфигурации проекта

## Миграция с предыдущей версии

Для обновления с предыдущей версии скрипта:

1. Обновите зависимости:
   ```bash
   npm install
   ```

2. Обновите переменные окружения согласно новому формату

3. Убедитесь в совместимости ваших кастомных форматов файлов

4. Запустите новую версию:
   ```bash
   npm run load-knowledge
   ```

## Заключение

Новая типизированная версия скрипта обеспечивает:
- Полную типобезопасность
- Лучшую производительность
- Расширенную функциональность
- Простоту расширения и поддержки
- Совместимость с архитектурой проекта

Все изменения обратно совместимы с существующей системой векторного поиска и базой знаний.