# Knowledge API Documentation

## Обзор

Knowledge API предоставляет типизированный интерфейс для управления базой знаний проекта Shrooms. Все эндпоинты полностью типизированы с использованием JSDoc и включают автоматическую валидацию запросов.

## Ключевые особенности

- ✅ **Полная типизация**: Все запросы и ответы строго типизированы
- ✅ **Автоматическая валидация**: Валидация параметров на уровне API
- ✅ **Расширенный поиск**: Поддержка множественных фильтров и сортировки
- ✅ **Статистика и мониторинг**: Детальная информация о состоянии системы
- ✅ **Обработка ошибок**: Стандартизированные коды ошибок и сообщения
- ✅ **Админ-панель совместимость**: Готов к интеграции с админ-интерфейсом

## Список эндпоинтов

### 🔍 Поиск

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/api/knowledge/search` | Типизированный поиск с фильтрами |

### 📄 Управление документами

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/api/knowledge/documents` | Добавление нового документа |
| `DELETE` | `/api/knowledge/documents/:id` | Удаление документа |

### 📁 Загрузка файлов

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/api/knowledge/upload` | Массовая загрузка файлов |

### 📊 Статистика и мониторинг

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/api/knowledge/stats` | Полная статистика базы знаний |
| `GET` | `/api/knowledge/health` | Health check системы |

### 🔄 Операции обслуживания

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/api/knowledge/reindex` | Переиндексация базы знаний |

## Примеры использования

### Поиск с фильтрами

```javascript
// GET /api/knowledge/search
const searchParams = {
  q: "подключение кошелька",
  limit: 10,
  threshold: 0.7,
  category: "user-guide",
  language: "ru",
  sortBy: "relevance",
  orderBy: "desc"
};

// Типизированный ответ
const response = {
  success: true,
  results: [
    {
      id: "chunk_123",
      score: 0.95,
      content: "Для подключения кошелька...",
      metadata: {
        source: "wallet-guide.md",
        category: "user-guide",
        language: "ru"
      }
    }
  ],
  totalResults: 5,
  searchOptions: searchParams,
  metadata: {
    searchTime: 45,
    vectorStoreProvider: "qdrant",
    embedModelUsed: "voyage-2",
    totalDocuments: 150,
    appliedFilters: {
      categories: ["user-guide"],
      languages: ["ru"]
    }
  }
};
```

### Добавление документа

```javascript
// POST /api/knowledge/documents
const documentRequest = {
  title: "Как подключить кошелек",
  content: "Инструкция по подключению кошелька к платформе...",
  category: "user-guide",
  language: "ru",
  tags: ["wallet", "guide", "tutorial"]
};

// Типизированный ответ
const response = {
  success: true,
  documentId: "manual_upload_1643723400000",
  chunksCreated: 3,
  totalTokens: 450,
  processingStats: {
    originalSizeBytes: 1024,
    processedSizeBytes: 890,
    processingTimeMs: 125,
    chunkingStats: {
      totalChunks: 3,
      averageChunkSize: 297,
      maxChunkSize: 400,
      minChunkSize: 200,
      chunkOverlap: 50
    }
  }
};
```

### Загрузка файлов

```javascript
// POST /api/knowledge/upload
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('category', 'technical');
formData.append('language', 'en');
formData.append('tags', '["api", "integration"]');

// Типизированный ответ
const response = {
  success: true,
  results: [
    {
      filename: "api-guide.md",
      success: true,
      documentId: "api-guide.md",
      chunksCreated: 5,
      totalTokens: 800
    }
  ],
  summary: {
    totalFiles: 2,
    successfulFiles: 2,
    failedFiles: 0,
    totalChunks: 10,
    totalTokens: 1500,
    processingTimeMs: 250
  }
};
```

## Типы и интерфейсы

### Поисковые типы

```javascript
/**
 * @typedef {Object} SearchQuery
 * @property {string} query - Поисковый запрос
 * @property {number} [limit=10] - Максимальное количество результатов
 * @property {number} [threshold=0.7] - Порог релевантности (0-1)
 * @property {string} [language] - Код языка (en, es, ru)
 * @property {string} [category] - Категория документа
 * @property {string[]} [tags] - Теги для фильтрации
 * @property {SearchSortBy} [sortBy='relevance'] - Поле для сортировки
 * @property {SearchOrderBy} [orderBy='desc'] - Порядок сортировки
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - Уникальный идентификатор
 * @property {number} score - Оценка релевантности (0-1)
 * @property {string} content - Содержимое чанка
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {SearchHighlight[]} [highlights] - Подсвеченные фрагменты
 */
```

### Типы документов

```javascript
/**
 * @typedef {Object} DocumentRequest
 * @property {string} title - Заголовок документа
 * @property {string} content - Содержимое документа
 * @property {string} category - Категория документа
 * @property {string} [language='en'] - Язык документа
 * @property {string[]} [tags=[]] - Теги документа
 */

/**
 * @typedef {Object} DocumentResponse
 * @property {boolean} success - Статус операции
 * @property {string} documentId - ID созданного документа
 * @property {number} chunksCreated - Количество созданных чанков
 * @property {number} totalTokens - Общее количество токенов
 * @property {ProcessingStats} processingStats - Статистика обработки
 */
```

## Константы

### Поддерживаемые языки

```javascript
const SUPPORTED_LANGUAGES = {
  ENGLISH: 'en',
  SPANISH: 'es',
  RUSSIAN: 'ru'
};
```

### Категории документов

```javascript
const DOCUMENT_CATEGORIES = {
  GENERAL: 'general',
  USER_GUIDE: 'user-guide',
  TOKENOMICS: 'tokenomics',
  TECHNICAL: 'technical',
  TROUBLESHOOTING: 'troubleshooting'
};
```

### Поддерживаемые форматы файлов

```javascript
const SUPPORTED_FILE_TYPES = {
  MARKDOWN: '.md',
  TEXT: '.txt',
  JSON: '.json',
  PDF: '.pdf'
};
```

## Коды ошибок

Все API возвращают стандартизированные коды ошибок:

| Код | Описание |
|-----|----------|
| `MISSING_FIELDS` | Отсутствуют обязательные поля |
| `VALIDATION_ERROR` | Ошибка валидации данных |
| `DOCUMENT_NOT_FOUND` | Документ не найден |
| `SEARCH_ERROR` | Ошибка поиска |
| `UPLOAD_ERROR` | Ошибка загрузки файла |
| `NO_FILES` | Файлы не предоставлены |
| `UNSUPPORTED_FORMAT` | Неподдерживаемый формат файла |
| `FILE_TOO_LARGE` | Файл превышает максимальный размер |

### Пример обработки ошибок

```javascript
const response = {
  success: false,
  error: "Search query validation failed",
  errorCode: "VALIDATION_ERROR",
  details: {
    validationErrors: [
      {
        field: "query",
        message: "Query string is required and must be non-empty",
        code: "INVALID_VALUE"
      }
    ]
  },
  timestamp: "2025-05-12T17:30:00.000Z"
};
```

## Валидация

API включает автоматическую валидацию всех запросов:

- **Обязательные поля**: Проверка наличия всех обязательных полей
- **Типы данных**: Валидация типов всех параметров
- **Диапазоны значений**: Проверка числовых значений на соответствие допустимым диапазонам
- **Форматы**: Валидация форматов строк (языки, категории, etc.)
- **Размеры**: Контроль размеров файлов и строк

## Интеграция с админ-панелью

API полностью готов для интеграции с админ-панелью:

1. **Типизированные интерфейсы**: Все типы доступны для импорта
2. **Предсказуемые ответы**: Стандартизированная структура ответов
3. **Обработка ошибок**: Единообразные коды ошибок для UI
4. **Статистика в реальном времени**: Детальная информация о состоянии системы

### Пример интеграции с фронтендом

```javascript
// TypeScript интеграция
import type { 
  SearchQuery, 
  SearchResponse, 
  DocumentRequest, 
  DocumentResponse 
} from '@/types/knowledge-api';

// React Hook для поиска
const useKnowledgeSearch = () => {
  const search = async (query: SearchQuery): Promise<SearchResponse> => {
    const response = await fetch('/api/knowledge/search?' + 
      new URLSearchParams(query));
    return response.json();
  };
  
  return { search };
};
```

## Безопасность

- **Rate Limiting**: Ограничение количества запросов
- **Валидация входных данных**: Защита от инъекций
- **Авторизация**: Контроль доступа к приватным эндпоинтам
- **Sanitization**: Очистка пользовательского ввода

## Мониторинг

API предоставляет подробную информацию для мониторинга:

- **Health Checks**: Статус всех компонентов системы
- **Метрики производительности**: Время ответа, пропускная способность
- **Статистика использования**: Информация о запросах и операциях
- **Ошибки**: Детальное логирование всех ошибок

---

API готов к использованию и полностью совместим с архитектурными требованиями проекта Shrooms. Все эндпоинты покрыты типизацией и валидацией, что обеспечивает надежность и предсказуемость работы с базой знаний.