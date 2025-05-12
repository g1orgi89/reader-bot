/**
 * Shared types for Shrooms AI Support Bot
 * @fileoverview Общие типы для всех модулей системы
 */

/**
 * @typedef {Object} VectorDocument
 * @property {string} id - Уникальный идентификатор документа
 * @property {string} content - Текстовое содержимое документа
 * @property {VectorDocumentMetadata} metadata - Метаданные документа
 * @property {number[]} [embedding] - Векторное представление документа (опционально)
 */

/**
 * @typedef {Object} VectorDocumentMetadata
 * @property {string} source - Источник документа (путь к файлу)
 * @property {string} category - Категория документа (general, user-guide, etc.)
 * @property {string} language - Язык документа (en, es, ru)
 * @property {string[]} [tags] - Теги документа
 * @property {string} [title] - Заголовок документа
 * @property {number} [chunkIndex] - Индекс чанка в документе (если документ разделен)
 * @property {Date} createdAt - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit=10] - Максимальное количество результатов
 * @property {string} [language] - Фильтр по языку
 * @property {string} [category] - Фильтр по категории
 * @property {string[]} [tags] - Фильтр по тегам
 * @property {number} [threshold=0.7] - Минимальный порог схожести (0-1)
 */

/**
 * @typedef {Object} SearchResult
 * @property {VectorDocument} document - Найденный документ
 * @property {number} score - Оценка релевантности (0-1)
 * @property {string} snippet - Фрагмент содержимого
 */

/**
 * @typedef {Object} EmbeddingProvider
 * @property {string} provider - Название провайдера (voyage, openai, etc.)
 * @property {string} model - Модель для генерации embeddings
 * @property {string} apiKey - API ключ
 * @property {string} [apiUrl] - URL API (для custom провайдеров)
 */

/**
 * @typedef {Object} VectorStoreOptions
 * @property {string} url - URL к векторной базе данных
 * @property {string} collectionName - Название коллекции
 * @property {EmbeddingProvider} embeddingProvider - Параметры провайдера embeddings
 * @property {number} [dimensions=1024] - Размерность векторов
 * @property {string} [metric='cosine'] - Метрика для поиска (cosine, dot, euclidean)
 */

/**
 * @typedef {Object} DocumentChunk
 * @property {string} id - Уникальный ID чанка
 * @property {string} text - Текст чанка
 * @property {VectorDocumentMetadata} metadata - Метаданные
 * @property {number} startIndex - Начальная позиция в исходном документе
 * @property {number} endIndex - Конечная позиция в исходном документе
 */

/**
 * @typedef {Object} ContextualEmbeddingConfig
 * @property {boolean} enabled - Включено ли создание контекстных embeddings
 * @property {string} contextPrompt - Промпт для создания контекста
 * @property {number} maxContextTokens - Максимальное количество токенов контекста
 */

/**
 * @typedef {Object} VectorStoreInit
 * @property {boolean} success - Успешна ли инициализация
 * @property {string} [error] - Сообщение об ошибке
 * @property {Object} [info] - Дополнительная информация
 */

/**
 * @typedef {Object} BulkOperationResult
 * @property {number} processed - Количество обработанных документов
 * @property {number} succeeded - Количество успешных операций
 * @property {number} failed - Количество неудачных операций
 * @property {Object[]} errors - Массив ошибок
 */

/**
 * @typedef {Object} VectorStoreStats
 * @property {number} totalDocuments - Общее количество документов
 * @property {number} totalVectors - Общее количество векторов
 * @property {Object} languageDistribution - Распределение по языкам
 * @property {Object} categoryDistribution - Распределение по категориям
 */

// Экспорт типов для использования в других модулях
module.exports = {
  // Типы экспортируются через комментарии JSDoc
  // Это позволяет TypeScript и IDE понимать доступные типы
};