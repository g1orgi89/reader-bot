/**
 * @file Типы для работы с базой знаний
 * @description Определения типов для документов, метаданных и embeddings
 */

/**
 * @typedef {Object} DocumentMetadata
 * @property {string} source - Путь к исходному файлу
 * @property {string} title - Заголовок документа
 * @property {string} language - Код языка (en, es, ru)
 * @property {string} category - Категория документа
 * @property {string[]} [tags] - Теги документа
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата последнего обновления
 * @property {number} [version] - Версия документа
 * @property {Object} [customMetadata] - Дополнительные метаданные
 */

/**
 * @typedef {Object} DocumentChunk
 * @property {string} id - Уникальный идентификатор чанка
 * @property {string} text - Текст чанка
 * @property {DocumentMetadata} metadata - Метаданные чанка
 * @property {number} startIndex - Начальная позиция в оригинальном тексте
 * @property {number} endIndex - Конечная позиция в оригинальном тексте
 * @property {number} [order] - Порядковый номер в документе
 */

/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} path - Путь к файлу относительно knowledge директории
 * @property {string} content - Содержимое документа
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {string} [hash] - Хеш содержимого для проверки изменений
 */

/**
 * @typedef {Object} EmbeddingVector
 * @property {string} id - Идентификатор вектора
 * @property {number[]} vector - Массив чисел, представляющий вектор
 * @property {DocumentMetadata} metadata - Метаданные, связанные с вектором
 * @property {string} text - Текст, для которого создан вектор
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} id - Идентификатор найденного документа
 * @property {number} score - Оценка релевантности (0-1)
 * @property {string} text - Содержимое чанка
 * @property {DocumentMetadata} metadata - Метаданные документа
 */

/**
 * @typedef {Object} ProcessingOptions
 * @property {number} [chunkSize] - Размер чанка в символах
 * @property {number} [chunkOverlap] - Перекрытие между чанками
 * @property {string} [splitter] - Тип разделителя ('sentence', 'paragraph', 'recursive')
 * @property {boolean} [preserveStructure] - Сохранять структуру документа
 * @property {boolean} [includeMetadata] - Включать метаданные в чанки
 */

/**
 * @typedef {Object} LoadingStats
 * @property {number} totalFiles - Общее количество найденных файлов
 * @property {number} processedFiles - Количество обработанных файлов
 * @property {number} skippedFiles - Количество пропущенных файлов
 * @property {number} totalChunks - Общее количество созданных чанков
 * @property {number} totalVectors - Общее количество созданных векторов
 * @property {LoadingError[]} errors - Массив ошибок
 * @property {Date} startTime - Время начала процесса
 * @property {Date} [endTime] - Время окончания процесса
 */

/**
 * @typedef {Object} LoadingError
 * @property {string} file - Путь к файлу, где произошла ошибка
 * @property {string} error - Описание ошибки
 * @property {string} [type] - Тип ошибки ('read', 'parse', 'process', 'upload')
 * @property {number} [line] - Номер строки, где произошла ошибка
 */

/**
 * @typedef {Object} FileType
 * @property {string} extension - Расширение файла
 * @property {string} mimeType - MIME тип
 * @property {Function} loader - Функция для загрузки файла
 * @property {ProcessingOptions} [defaultOptions] - Опции обработки по умолчанию
 */

/**
 * @typedef {Object} LanguageConfig
 * @property {string} code - Код языка (ISO 639-1)
 * @property {string} name - Название языка
 * @property {string[]} patterns - Паттерны для определения языка
 * @property {Object} [stopWords] - Список стоп-слов для языка
 * @property {Object} [processingOptions] - Специфичные опции обработки
 */

/**
 * @typedef {Object} CategoryConfig
 * @property {string} name - Название категории
 * @property {string} description - Описание категории
 * @property {string[]} paths - Пути к директориям с документами этой категории
 * @property {ProcessingOptions} [options] - Специфичные опции обработки
 * @property {number} [priority] - Приоритет категории при обработке
 */

module.exports = {
  // Все типы экспортируются как JSDoc типы для использования в других файлах
};