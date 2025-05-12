/**
 * @file Типы для работы с embeddings и векторной базой данных
 * @description Определения типов для embeddings, векторного поиска и интеграций
 */

/**
 * @typedef {Object} EmbeddingConfig
 * @property {string} provider - Провайдер embeddings ('openai', 'voyage', 'cohere')
 * @property {string} model - Модель для создания embeddings
 * @property {string} apiKey - API ключ провайдера
 * @property {number} dimensions - Размерность векторов
 * @property {EmbeddingOptions} [options] - Дополнительные опции
 */

/**
 * @typedef {Object} EmbeddingOptions
 * @property {number} [maxTokens] - Максимальное количество токенов
 * @property {boolean} [normalize] - Нормализовать векторы
 * @property {string} [inputType] - Тип входных данных ('search_document', 'search_query')
 * @property {string} [language] - Язык для специфичных моделей
 * @property {Object} [customOptions] - Дополнительные опции провайдера
 */

/**
 * @typedef {Object} VectorStoreConfig
 * @property {string} type - Тип векторной базы ('qdrant', 'pinecone', 'chroma')
 * @property {string} url - URL подключения к базе
 * @property {string} apiKey - API ключ (если требуется)
 * @property {string} collectionName - Название коллекции
 * @property {VectorStoreOptions} [options] - Дополнительные опции
 */

/**
 * @typedef {Object} VectorStoreOptions
 * @property {number} [timeout] - Таймаут подключения в мс
 * @property {number} [retries] - Количество попыток переподключения
 * @property {boolean} [enableLogging] - Включить логирование
 * @property {Object} [metadata] - Метаданные коллекции
 */

/**
 * @typedef {Object} SearchQuery
 * @property {string} text - Текст запроса
 * @property {number} [limit] - Максимальное количество результатов
 * @property {number} [threshold] - Пороговое значение score
 * @property {SearchFilter} [filter] - Фильтры для поиска
 * @property {boolean} [includeVectors] - Включать векторы в результат
 */

/**
 * @typedef {Object} SearchFilter
 * @property {string} [language] - Фильтр по языку
 * @property {string} [category] - Фильтр по категории
 * @property {string[]} [tags] - Фильтр по тегам
 * @property {DateRange} [dateRange] - Фильтр по дате
 * @property {Object} [customFilters] - Дополнительные фильтры
 */

/**
 * @typedef {Object} DateRange
 * @property {Date} [from] - Дата начала
 * @property {Date} [to] - Дата окончания
 */

/**
 * @typedef {Object} BatchOperation
 * @property {string} operation - Тип операции ('insert', 'update', 'delete')
 * @property {string[]} ids - Массив ID документов
 * @property {EmbeddingVector[]} [vectors] - Векторы для операции
 * @property {Object} [metadata] - Метаданные операции
 */

/**
 * @typedef {Object} VectorStoreStats
 * @property {number} totalDocuments - Общее количество документов
 * @property {number} totalVectors - Общее количество векторов
 * @property {Object<string, number>} documentsByLanguage - Документы по языкам
 * @property {Object<string, number>} documentsByCategory - Документы по категориям
 * @property {Date} lastUpdated - Дата последнего обновления
 * @property {Object} storageUsed - Информация об использовании хранилища
 */

/**
 * @typedef {Object} EmbeddingTask
 * @property {string} id - Уникальный ID задачи
 * @property {string} text - Текст для создания embedding
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {string} status - Статус задачи ('pending', 'processing', 'completed', 'failed')
 * @property {Date} createdAt - Время создания задачи
 * @property {Date} [completedAt] - Время завершения задачи
 * @property {string} [error] - Сообщение об ошибке
 * @property {number} [retryCount] - Количество попыток
 */

/**
 * @typedef {Object} EmbeddingQueue
 * @property {number} maxConcurrency - Максимальное количество параллельных задач
 * @property {number} retryAttempts - Количество попыток повтора
 * @property {number} retryDelay - Задержка между попытками (мс)
 * @property {EmbeddingTask[]} tasks - Массив задач в очереди
 * @property {EmbeddingTask[]} processing - Обрабатываемые задачи
 * @property {EmbeddingTask[]} completed - Завершенные задачи
 * @property {EmbeddingTask[]} failed - Неудачные задачи
 */

/**
 * @typedef {Object} ContextualEmbedding
 * @property {string} documentId - ID документа
 * @property {string} chunkId - ID чанка
 * @property {number[]} embedding - Вектор embedding
 * @property {string} context - Контекст (предыдущий + текущий + следующий чанк)
 * @property {Object} contextMetadata - Метаданные контекста
 */

/**
 * @typedef {Object} SemanticSearchConfig
 * @property {boolean} enableReranking - Включить переранжирование
 * @property {string} [rerankingModel] - Модель для переранжирования
 * @property {boolean} hybridSearch - Включить гибридный поиск
 * @property {number} [vectorWeight] - Вес векторного поиска (0-1)
 * @property {number} [keywordWeight] - Вес ключевого поиска (0-1)
 * @property {boolean} expandQuery - Расширять запрос синонимами
 */

/**
 * @typedef {Object} IndexUpdate
 * @property {string} type - Тип обновления ('full', 'incremental', 'single')
 * @property {string[]} [documentIds] - ID документов для обновления
 * @property {boolean} [rebuild] - Полностью пересобрать индекс
 * @property {Object} [options] - Дополнительные опции обновления
 */

/**
 * @typedef {Object} VectorBackup
 * @property {string} id - ID бэкапа
 * @property {Date} createdAt - Дата создания
 * @property {string} path - Путь к файлу бэкапа
 * @property {VectorStoreStats} stats - Статистика на момент бэкапа
 * @property {string} format - Формат бэкапа ('json', 'binary')
 * @property {boolean} compressed - Сжатый ли бэкап
 */

module.exports = {
  // Все типы экспортируются как JSDoc типы для использования в других файлах
};