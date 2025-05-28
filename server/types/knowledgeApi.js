/**
 * @file Типы для Knowledge API
 * @description Строго типизированные определения для API управления базой знаний
 * 
 * Включает типы для:
 * - Search операций и фильтрации
 * - Добавления/обновления документов
 * - API запросов и ответов
 * - Совместимость с админ-панелью
 * 
 * Базируется на стандартах Anthropic для RAG систем
 */

/**
 * @typedef {Object} SearchQuery
 * @property {string} query - Поисковый запрос
 * @property {number} [limit=10] - Максимальное количество результатов
 * @property {number} [threshold=0.7] - Порог релевантности (0-1)
 * @property {string} [language] - Код языка для фильтрации (en, es, ru, none)
 * @property {string} [category] - Категория для фильтрации
 * @property {string[]} [tags] - Теги для фильтрации
 * @property {boolean} [includeMetadata=true] - Включать ли метаданные в результаты
 * @property {SearchSortBy} [sortBy='relevance'] - Сортировка результатов
 * @property {SearchOrderBy} [orderBy='desc'] - Порядок сортировки
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - Уникальный идентификатор чанка
 * @property {number} score - Оценка релевантности (0-1)
 * @property {string} content - Содержимое чанка
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {SearchHighlight[]} [highlights] - Подсвеченные фрагменты
 * @property {string} [rank] - Ранг в результатах поиска
 */

/**
 * @typedef {Object} SearchHighlight
 * @property {string} field - Поле с подсветкой ('content', 'title')
 * @property {number} start - Начальная позиция подсветки
 * @property {number} end - Конечная позиция подсветки
 * @property {string} [text] - Текст с подсветкой
 */

/**
 * @typedef {Object} SearchResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {SearchResult[]} results - Найденные документы
 * @property {number} totalResults - Общее количество найденных результатов
 * @property {SearchQuery} searchOptions - Использованные опции поиска
 * @property {SearchMetadata} metadata - Метаданные поиска
 * @property {string} [query] - Исходный поисковый запрос
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} SearchMetadata
 * @property {number} searchTime - Время выполнения поиска (мс)
 * @property {string} vectorStoreProvider - Провайдер векторной базы
 * @property {string} embedModelUsed - Модель для эмбеддингов
 * @property {number} totalDocuments - Общее количество документов в базе
 * @property {SearchFilters} appliedFilters - Примененные фильтры
 */

/**
 * @typedef {Object} SearchFilters
 * @property {string[]} [categories] - Отфильтрованные категории
 * @property {string[]} [languages] - Отфильтрованные языки
 * @property {string[]} [tags] - Отфильтрованные теги
 * @property {DateRange} [dateRange] - Диапазон дат
 */

/**
 * @typedef {Object} DateRange
 * @property {Date} [from] - Начальная дата
 * @property {Date} [to] - Конечная дата
 */

/**
 * @typedef {'relevance' | 'date_created' | 'date_updated' | 'title' | 'category'} SearchSortBy
 */

/**
 * @typedef {'desc' | 'asc'} SearchOrderBy
 */

/**
 * @typedef {Object} DocumentRequest
 * @property {string} title - Заголовок документа
 * @property {string} content - Содержимое документа
 * @property {string} category - Категория документа
 * @property {string} [language='none'] - Язык документа (none = универсальный)
 * @property {string[]} [tags=[]] - Теги документа
 * @property {DocumentMetadata} [metadata] - Дополнительные метаданные
 * @property {ProcessingOptions} [processingOptions] - Опции обработки
 */

/**
 * @typedef {Object} DocumentResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {string} [documentId] - ID созданного документа
 * @property {number} [chunksCreated] - Количество созданных чанков
 * @property {number} [totalTokens] - Общее количество токенов
 * @property {VectorStoreResult} [addResult] - Результат добавления в векторную базу
 * @property {ProcessingStats} [processingStats] - Статистика обработки
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} ProcessingStats
 * @property {number} originalSizeBytes - Размер исходного документа
 * @property {number} processedSizeBytes - Размер обработанного документа
 * @property {number} processingTimeMs - Время обработки (мс)
 * @property {ChunkingStats} chunkingStats - Статистика чанкинга
 */

/**
 * @typedef {Object} ChunkingStats
 * @property {number} totalChunks - Общее количество чанков
 * @property {number} averageChunkSize - Средний размер чанка
 * @property {number} maxChunkSize - Максимальный размер чанка
 * @property {number} minChunkSize - Минимальный размер чанка
 * @property {number} chunkOverlap - Перекрытие между чанками
 */

/**
 * @typedef {Object} VectorStoreResult
 * @property {boolean} success - Статус операции
 * @property {string[]} [addedIds] - ID добавленных документов
 * @property {number} [vectorsStored] - Количество сохраненных векторов
 * @property {EmbeddingStats} [embeddingStats] - Статистика эмбеддингов
 * @property {string} [error] - Сообщение об ошибке
 */

/**
 * @typedef {Object} EmbeddingStats
 * @property {string} provider - Провайдер эмбеддингов
 * @property {string} model - Модель эмбеддингов
 * @property {number} dimensions - Размерность векторов
 * @property {number} totalTokens - Общее количество токенов
 * @property {number} avgTokensPerChunk - Среднее количество токенов на чанк
 */

/**
 * @typedef {Object} FileUploadRequest
 * @property {File[]} files - Загружаемые файлы
 * @property {string} [category='general'] - Категория для всех файлов
 * @property {string} [language='none'] - Язык для всех файлов (none = универсальный)
 * @property {string[]} [tags] - Теги для всех файлов
 * @property {ProcessingOptions} [processingOptions] - Опции обработки
 * @property {boolean} [overwrite=false] - Перезаписывать ли существующие файлы
 */

/**
 * @typedef {Object} FileUploadResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {FileProcessingResult[]} results - Результаты обработки файлов
 * @property {UploadSummary} summary - Сводка по загрузке
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} FileProcessingResult
 * @property {string} filename - Имя файла
 * @property {boolean} success - Статус обработки файла
 * @property {string} [documentId] - ID созданного документа
 * @property {number} [chunksCreated] - Количество созданных чанков
 * @property {number} [totalTokens] - Количество токенов
 * @property {VectorStoreResult} [addResult] - Результат добавления в векторную базу
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} UploadSummary
 * @property {number} totalFiles - Общее количество файлов
 * @property {number} successfulFiles - Количество успешно обработанных файлов
 * @property {number} failedFiles - Количество файлов с ошибками
 * @property {number} totalChunks - Общее количество созданных чанков
 * @property {number} totalTokens - Общее количество токенов
 * @property {number} processingTimeMs - Общее время обработки (мс)
 */

/**
 * @typedef {Object} DocumentDeleteRequest
 * @property {string} id - ID документа для удаления
 * @property {boolean} [cascade=false] - Удалять ли связанные чанки
 * @property {boolean} [force=false] - Принудительное удаление
 */

/**
 * @typedef {Object} DocumentDeleteResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {string} [message] - Сообщение о результате
 * @property {DeletedDocument} [deletedDocument] - Информация об удаленном документе
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} DeletedDocument
 * @property {string} id - ID удаленного документа
 * @property {string} title - Заголовок удаленного документа
 * @property {number} chunksDeleted - Количество удаленных чанков
 * @property {number} vectorsDeleted - Количество удаленных векторов
 */

/**
 * @typedef {Object} KnowledgeStatsResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {KnowledgeStats} stats - Статистика базы знаний
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} KnowledgeStats
 * @property {number} totalDocuments - Общее количество документов
 * @property {number} totalChunks - Общее количество чанков
 * @property {number} totalVectors - Общее количество векторов
 * @property {CategoryStats[]} byCategory - Статистика по категориям
 * @property {LanguageStats[]} byLanguage - Статистика по языкам
 * @property {TagStats[]} byTags - Статистика по тегам
 * @property {StorageStats} storage - Статистика хранения
 * @property {Date} lastUpdated - Дата последнего обновления
 */

/**
 * @typedef {Object} CategoryStats
 * @property {string} category - Название категории
 * @property {number} documents - Количество документов
 * @property {number} chunks - Количество чанков
 * @property {number} totalSizeMb - Общий размер (МБ)
 */

/**
 * @typedef {Object} LanguageStats
 * @property {string} language - Код языка
 * @property {number} documents - Количество документов
 * @property {number} chunks - Количество чанков
 * @property {number} percentOfTotal - Процент от общего объема
 */

/**
 * @typedef {Object} TagStats
 * @property {string} tag - Тег
 * @property {number} usage - Количество использований
 * @property {number} documents - Количество документов с тегом
 */

/**
 * @typedef {Object} StorageStats
 * @property {number} totalSizeMb - Общий размер (МБ)
 * @property {number} vectorStoreSizeMb - Размер векторной базы (МБ)
 * @property {number} metadataStoreSizeMb - Размер хранения метаданных (МБ)
 * @property {string} storageProvider - Провайдер хранения
 * @property {string} compressionRatio - Коэффициент сжатия
 */

/**
 * @typedef {Object} HealthCheckResponse
 * @property {boolean} success - Статус выполнения проверки
 * @property {HealthStatus} status - Статус системы
 * @property {ComponentHealth[]} components - Статус компонентов
 * @property {number} responseTimeMs - Время ответа (мс)
 * @property {string} [error] - Сообщение об ошибке
 */

/**
 * @typedef {'healthy' | 'degraded' | 'unhealthy'} HealthStatus
 */

/**
 * @typedef {Object} ComponentHealth
 * @property {string} name - Название компонента
 * @property {HealthStatus} status - Статус компонента
 * @property {string} [message] - Дополнительное сообщение
 * @property {Date} lastChecked - Время последней проверки
 * @property {ComponentMetrics} [metrics] - Метрики компонента
 */

/**
 * @typedef {Object} ComponentMetrics
 * @property {number} [uptime] - Время работы (сек)
 * @property {number} [cpuUsage] - Использование CPU (%)
 * @property {number} [memoryUsage] - Использование памяти (%)
 * @property {number} [requestsPerSecond] - Запросов в секунду
 * @property {number} [avgResponseTime] - Среднее время ответа (мс)
 */

/**
 * @typedef {Object} ReindexRequest
 * @property {boolean} [clearFirst=false] - Очищать ли базу перед реиндексацией
 * @property {string[]} [categories] - Категории для реиндексации (все если не указано)
 * @property {string[]} [languages] - Языки для реиндексации (все если не указано)
 * @property {ProcessingOptions} [processingOptions] - Опции обработки
 * @property {boolean} [parallel=false] - Параллельная обработка
 */

/**
 * @typedef {Object} ReindexResponse
 * @property {boolean} success - Статус выполнения операции
 * @property {string} [message] - Сообщение о результате
 * @property {ReindexResults} [results] - Результаты реиндексации
 * @property {string} [error] - Сообщение об ошибке
 * @property {string} [errorCode] - Код ошибки
 */

/**
 * @typedef {Object} ReindexResults
 * @property {boolean} cleared - Была ли очищена база
 * @property {number} documentsProcessed - Количество обработанных документов
 * @property {number} chunksCreated - Количество созданных чанков
 * @property {number} vectorsStored - Количество сохраненных векторов
 * @property {number} totalTimeMs - Общее время обработки (мс)
 * @property {FileProcessingResult[]} [fileResults] - Результаты по файлам
 */

/**
 * @typedef {Object} APIErrorResponse
 * @property {boolean} success - Статус выполнения операции (всегда false)
 * @property {string} error - Сообщение об ошибке
 * @property {string} errorCode - Код ошибки
 * @property {ErrorDetails} [details] - Дополнительные детали ошибки
 * @property {string} [stack] - Стек ошибки (только в development)
 * @property {Date} timestamp - Время возникновения ошибки
 */

/**
 * @typedef {Object} ErrorDetails
 * @property {string} [field] - Поле с ошибкой
 * @property {string} [value] - Некорректное значение
 * @property {string} [expected] - Ожидаемое значение
 * @property {ValidationError[]} [validationErrors] - Ошибки валидации
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field - Поле с ошибкой
 * @property {string} message - Сообщение об ошибке
 * @property {string} code - Код ошибки валидации
 * @property {any} [value] - Некорректное значение
 */

// Константы для использования в API
/**
 * @readonly
 * @enum {string}
 */
const API_ERROR_CODES = {
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_ADD_ERROR: 'DOCUMENT_ADD_ERROR',
  SEARCH_ERROR: 'SEARCH_ERROR',
  DELETE_ERROR: 'DELETE_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  NO_FILES: 'NO_FILES',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  STATS_ERROR: 'STATS_ERROR',
  REINDEX_ERROR: 'REINDEX_ERROR',
  CLEAR_FAILED: 'CLEAR_FAILED',
  VECTOR_STORE_ERROR: 'VECTOR_STORE_ERROR',
  EMBEDDING_ERROR: 'EMBEDDING_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Поддерживаемые языки системы
 * @readonly
 * @enum {string}
 */
const SUPPORTED_LANGUAGES = {
  NONE: 'none',        // Универсальный (AI определяет язык автоматически)
  ENGLISH: 'en',       // Английский
  SPANISH: 'es',       // Испанский
  RUSSIAN: 'ru'        // Русский
};

/**
 * @readonly
 * @enum {string}
 */
const DOCUMENT_CATEGORIES = {
  GENERAL: 'general',
  USER_GUIDE: 'user-guide',
  TOKENOMICS: 'tokenomics',
  TECHNICAL: 'technical',
  TROUBLESHOOTING: 'troubleshooting'
};

/**
 * @readonly
 * @enum {string}
 */
const SUPPORTED_FILE_TYPES = {
  MARKDOWN: '.md',
  TEXT: '.txt',
  JSON: '.json',
  PDF: '.pdf'
};

/**
 * Экспорт типов для использования в других модулях
 */
module.exports = {
  // Константы
  API_ERROR_CODES,
  SUPPORTED_LANGUAGES,
  DOCUMENT_CATEGORIES,
  SUPPORTED_FILE_TYPES,
  
  // Функции-валидаторы
  validateSearchQuery: require('./validators/knowledgeValidators').validateSearchQuery,
  validateDocumentRequest: require('./validators/knowledgeValidators').validateDocumentRequest,
  validateFileUpload: require('./validators/knowledgeValidators').validateFileUpload
};