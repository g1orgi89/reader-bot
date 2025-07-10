/**
 * @fileoverview Сервис для работы с векторной базой знаний Qdrant
 * Предоставляет методы для добавления, поиска и удаления документов
 * ОБНОВЛЕНО: Добавлена поддержка автоматического чанкинга документов
 * 🍄 УПРОЩЕНО: Универсальный поиск без языковых ограничений
 * 🔧 ИСПРАВЛЕНО: Добавлен timeout для embeddings API для предотвращения зависаний
 */

const { QdrantClient } = require("@qdrant/js-client-rest");
const { OpenAIEmbeddings } = require("@langchain/openai");
const logger = require('../utils/logger');
const textChunker = require('../utils/textChunker');
const { createHash } = require('crypto');

/**
 * @typedef {Object} DocumentMetadata
 * @property {string} id - Уникальный идентификатор документа
 * @property {string} title - Заголовок документа
 * @property {string} category - Категория документа
 * @property {string} language - Язык документа (хранится, но не используется для фильтрации)
 * @property {string[]} [tags] - Теги для документа
 * @property {string} [source] - Источник документа
 * @property {Date} [createdAt] - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit=5] - Максимальное количество результатов
 * @property {string} [category] - Фильтр по категории
 * @property {string[]} [tags] - Фильтр по тегам
 * @property {number} [score_threshold] - Минимальный порог релевантности
 * @property {boolean} [returnChunks=false] - Возвращать отдельные чанки вместо группировки по документам
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - ID документа
 * @property {string} content - Содержимое документа
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {number} score - Релевантность (0-1)
 * @property {boolean} [isChunk] - Является ли результат чанком (только при returnChunks=true)
 * @property {Object} [chunkInfo] - Информация о чанке (только при returnChunks=true)
 */

/**
 * @typedef {Object} ChunkingOptions
 * @property {boolean} [enableChunking=true] - Включить автоматический чанкинг
 * @property {number} [chunkSize=500] - Размер чанка в символах
 * @property {number} [overlap=100] - Перекрытие между чанками
 * @property {number} [minChunkSize=50] - Минимальный размер чанка
 * @property {boolean} [preserveParagraphs=true] - Сохранять целостность параграфов
 */

/**
 * Сервис для работы с векторной базой знаний Qdrant
 * @class VectorStoreService
 */
class VectorStoreService {
  /**
   * Создает экземпляр сервиса VectorStoreService
   * @constructor
   */
  constructor() {
    this.initialized = false;
    this.collectionName = process.env.VECTOR_COLLECTION_NAME || 'reader_knowledge';
    this.url = process.env.VECTOR_DB_URL || 'http://localhost:6333';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-ada-002';
    this.vectorDimension = 1536; // Размерность для text-embedding-ada-002
    
    // 🔧 ИСПРАВЛЕНО: Добавлены таймауты для предотвращения зависаний
    this.embeddingTimeout = 30000; // 30 секунд timeout для embeddings
    this.maxRetries = 2; // Максимум попыток создания embedding
    
    // Настройки чанкинга по умолчанию
    this.defaultChunkingOptions = {
      enableChunking: true,
      chunkSize: 500,      // Оптимально для качественных embeddings
      overlap: 100,        // Сохранение контекста между чанками
      minChunkSize: 50,    // Избегаем слишком маленьких чанков
      preserveParagraphs: true  // Сохраняем целостность параграфов
    };
    
    // 🍄 УПРОЩЕНО: Единый порог релевантности для всех языков
    this.defaultThreshold = 0.7; // Универсальный порог для всех языков
    
    // Создание клиента будет происходить при инициализации
    this.client = null;
    this.embeddings = null;
    
    // Кэш для embeddings для оптимизации запросов
    this.embeddingCache = new Map();
    this.maxCacheSize = 100;
    
    logger.info(`🔧 [VECTOR] Embedding timeout configured: ${this.embeddingTimeout}ms`);
  }

  /**
   * Определяет оптимальный порог релевантности (упрощенная версия)
   * @private
   * @param {number} [customThreshold] - Пользовательский порог
   * @returns {number} Порог релевантности
   */
  _getThreshold(customThreshold) {
    const threshold = customThreshold !== undefined ? customThreshold : this.defaultThreshold;
    logger.debug(`🍄 Using universal threshold: ${threshold}`);
    return threshold;
  }

  /**
   * Инициализирует подключение к векторной базе данных
   * @async
   * @returns {Promise<boolean>} Успешность инициализации
   */
  async initialize() {
    try {
      if (this.initialized) {
        return true;
      }

      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not set, vector store cannot be initialized');
        return false;
      }

      logger.info(`Initializing vector store: ${this.url}, collection: ${this.collectionName}`);
      
      // Инициализация клиента Qdrant
      this.client = new QdrantClient({ url: this.url });
      
      // Инициализация OpenAI Embeddings
      this.embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        model: this.embeddingModel
      });
      
      // Проверка подключения к Qdrant
      try {
        // Проверка соединения с Qdrant (без вызова healthCheck)
        await this.client.getCollections();
        logger.info('Successfully connected to Qdrant');
      } catch (error) {
        logger.error(`Failed to connect to Qdrant: ${error.message}`);
        return false;
      }
      
      // Проверка существования коллекции
      try {
        const collections = await this.client.getCollections();
        const collectionExists = collections.collections.some(c => c.name === this.collectionName);
        
        if (!collectionExists) {
          logger.info(`Creating collection: ${this.collectionName}`);
          
          // Создание коллекции, если не существует
          await this.client.createCollection(this.collectionName, {
            vectors: {
              size: this.vectorDimension,
              distance: 'Cosine'
            }
          });
          
          // 🍄 УПРОЩЕНО: Создание только необходимых индексов (без language)
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.category',
            field_schema: 'keyword'
          });
          
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.tags',
            field_schema: 'keyword'
          });

          // Индекс для фильтрации по originalId чанков
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.originalId',
            field_schema: 'keyword'
          });
        } else {
          logger.info(`Collection ${this.collectionName} already exists`);
        }
      } catch (error) {
        logger.error(`Failed to check/create collection: ${error.message}`);
        return false;
      }
      
      this.initialized = true;
      logger.info('🍄 Vector store initialized successfully with chunking support');
      logger.info(`🍄 Universal threshold configured: ${this.defaultThreshold}`);
      logger.info(`🍄 Default chunking options: ${JSON.stringify(this.defaultChunkingOptions)}`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize vector store: ${error.message}`);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Создает уникальный числовой ID из строки
   * @param {string} str - Строка для преобразования в числовой ID
   * @returns {number} Числовой ID
   */
  _createNumericalId(str) {
    const hash = createHash('md5').update(str).digest('hex');
    // Берем первые 8 символов и преобразуем в число
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Добавляет документы в векторную базу с автоматическим чанкингом
   * @async
   * @param {Object[]} documents - Документы для добавления
   * @param {string} documents[].id - ID документа
   * @param {string} documents[].content - Содержимое документа
   * @param {DocumentMetadata} documents[].metadata - Метаданные документа
   * @param {ChunkingOptions} [chunkingOptions={}] - Настройки чанкинга
   * @returns {Promise<boolean>} Успешность операции
   */
  async addDocuments(documents, chunkingOptions = {}) {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          logger.warn('Could not initialize vector store, skipping addDocuments');
          return false;
        }
      }
      
      if (!documents || documents.length === 0) {
        logger.warn('No documents provided to add');
        return false;
      }
      
      // Объединяем настройки чанкинга
      const chunkingConfig = { ...this.defaultChunkingOptions, ...chunkingOptions };
      
      logger.info(`🍄 Adding ${documents.length} documents to vector store with chunking: ${chunkingConfig.enableChunking ? 'enabled' : 'disabled'}`);
      
      // Сначала удаляем существующие чанки документов (если есть)
      for (const doc of documents) {
        await this._deleteDocumentChunks(doc.id);
      }
      
      let allChunks = [];
      
      // Чанкинг документов, если включен
      if (chunkingConfig.enableChunking) {
        logger.info(`🍄 Chunking documents with config: size=${chunkingConfig.chunkSize}, overlap=${chunkingConfig.overlap}`);
        allChunks = textChunker.chunkDocuments(documents, chunkingConfig);
        
        const stats = textChunker.getChunkingStats(allChunks);
        logger.info(`🍄 Chunking stats: ${stats.totalChunks} chunks from ${stats.uniqueDocuments} documents, avg size: ${stats.averageChunkSize} chars`);
      } else {
        // Без чанкинга - используем документы как есть
        allChunks = documents.map(doc => ({
          id: doc.id,
          content: doc.content,
          metadata: {
            ...doc.metadata,
            originalId: doc.id,
            chunkIndex: 0,
            totalChunks: 1
          }
        }));
      }
      
      if (allChunks.length === 0) {
        logger.warn('🍄 No chunks to add after processing');
        return false;
      }
      
      // Подготовка точек для Qdrant
      const points = [];
      let successfulChunks = 0;
      let failedChunks = 0;
      
      for (const chunk of allChunks) {
        try {
          // Проверка наличия обязательных полей
          if (!chunk.id || !chunk.content) {
            logger.warn(`🍄 Chunk missing required fields (id, content): ${JSON.stringify(chunk)}`);
            failedChunks++;
            continue;
          }
          
          // Добавляем подробное логирование для отслеживания процесса
          logger.info(`🍄 Processing chunk ${successfulChunks + 1}/${allChunks.length}: ${chunk.id}, content length: ${chunk.content.length} characters`);
          
          // Создание числового ID из строкового ID (Qdrant требует уникальные числовые ID)
          const pointId = this._createNumericalId(chunk.id.toString());
          
          // 🔧 ИСПРАВЛЕНО: Создание embedding с timeout защитой
          const embedding = await this._createEmbeddingWithTimeout(chunk.content);
          
          if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
            logger.error(`🍄 Invalid embedding for chunk ${chunk.id}: ${embedding ? 'Length: ' + embedding.length : 'null'}`);
            failedChunks++;
            continue;
          }
          
          logger.info(`🍄 ✅ Successfully created embedding for chunk ${chunk.id}, embedding size: ${embedding.length}`);
          
          // Формирование точки для Qdrant с правильной структурой
          points.push({
            id: pointId,
            vector: embedding,
            payload: {
              content: chunk.content,
              metadata: {
                id: chunk.id.toString(),
                originalId: chunk.metadata.originalId || chunk.id,
                title: chunk.metadata?.title || '',
                category: chunk.metadata?.category || '',
                language: chunk.metadata?.language || 'auto', // 🍄 ИЗМЕНЕНО: хранится, но не используется для фильтрации
                tags: Array.isArray(chunk.metadata?.tags) ? chunk.metadata.tags : [],
                chunkIndex: chunk.metadata.chunkIndex || 0,
                totalChunks: chunk.metadata.totalChunks || 1,
                startPosition: chunk.metadata.startPosition || 0,
                endPosition: chunk.metadata.endPosition || chunk.content.length,
                createdAt: chunk.metadata?.createdAt ? new Date(chunk.metadata.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }
          });
          
          successfulChunks++;
          logger.info(`🍄 ✅ Successfully processed chunk ${chunk.id} with point ID ${pointId} (${successfulChunks}/${allChunks.length})`);
        } catch (chunkError) {
          logger.error(`🍄 Error processing chunk ${chunk.id}: ${chunkError.message}`);
          failedChunks++;
          // Продолжаем с другими чанками вместо полного прерывания
        }
      }
      
      // Добавление точек в Qdrant
      if (points.length > 0) {
        logger.info(`🍄 Successfully processed ${successfulChunks} chunks, failed: ${failedChunks}`);
        logger.info(`🍄 Upserting ${points.length} chunks to Qdrant collection ${this.collectionName}`);
        
        try {
          // Пробуем добавить все точки за один запрос
          await this.client.upsert(this.collectionName, {
            points: points
          });
          logger.info(`🍄 ✅ Successfully added ${points.length} chunks to vector store (from ${documents.length} documents)`);
          return true;
        } catch (upsertError) {
          logger.error(`🍄 Upsert error: ${upsertError.message}`);
          
          // Если пакетное добавление не удалось, добавляем точки по одной
          let successCount = 0;
          for (const point of points) {
            try {
              await this.client.upsert(this.collectionName, {
                points: [point]
              });
              successCount++;
              logger.debug(`🍄 Successfully added chunk with ID ${point.id}`);
            } catch (singleUpsertError) {
              logger.error(`🍄 Failed to add chunk ${point.id}: ${singleUpsertError.message}`);
            }
          }
          
          if (successCount > 0) {
            logger.info(`🍄 Added ${successCount}/${points.length} chunks individually`);
            return successCount > 0;
          }
          
          return false;
        }
      } else {
        logger.warn('🍄 No valid chunks to add after processing');
        return false;
      }
    } catch (error) {
      logger.error(`🍄 Failed to add documents to vector store: ${error.message}`);
      return false;
    }
  }

  /**
   * Удаляет все чанки документа из векторной базы
   * @private
   * @param {string} originalId - ID оригинального документа
   * @returns {Promise<boolean>} Успешность операции
   */
  async _deleteDocumentChunks(originalId) {
    try {
      if (!this.initialized) {
        return false;
      }

      logger.debug(`🍄 Deleting chunks for document: ${originalId}`);
      
      // Ищем все чанки документа
      const searchResults = await this.client.scroll(this.collectionName, {
        filter: {
          must: [{
            key: 'metadata.originalId',
            match: { value: originalId }
          }]
        },
        limit: 1000,
        with_payload: false
      });

      if (searchResults.points.length > 0) {
        const pointIds = searchResults.points.map(point => point.id);
        
        await this.client.delete(this.collectionName, {
          points: pointIds
        });
        
        logger.debug(`🍄 Deleted ${pointIds.length} chunks for document ${originalId}`);
      }

      return true;
    } catch (error) {
      logger.error(`🍄 Failed to delete chunks for document ${originalId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Ищет документы, релевантные запросу (универсальный поиск)
   * @async
   * @param {string} query - Текст запроса
   * @param {SearchOptions} [options={}] - Опции поиска
   * @returns {Promise<SearchResult[]>} Результаты поиска
   */
  async search(query, options = {}) {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          logger.warn('Vector store not initialized, returning empty search results');
          return [];
        }
      }
      
      if (!query || typeof query !== 'string' || query.trim() === '') {
        logger.warn('Empty or invalid query provided to search');
        return [];
      }
      
      const { 
        limit = 5, 
        category, 
        tags,
        returnChunks = false,  // НОВАЯ ОПЦИЯ: для возврата отдельных чанков
        score_threshold
      } = options;
      
      // 🍄 УПРОЩЕНО: Определяем порог без языковой зависимости
      const threshold = this._getThreshold(score_threshold);
      
      logger.info(`🍄 Searching for relevant documents with universal threshold: ${threshold}`);
      logger.info(`Searching for: \"${query.substring(0, 30)}${query.length > 30 ? '...' : ''}\" with options: ${JSON.stringify({
        limit, category, tags: Array.isArray(tags) ? tags.length : tags, score_threshold: threshold, returnChunks
      })}`);
      
      // Создание embedding для запроса
      const embedding = await this._createEmbeddingWithTimeout(query);
      logger.debug(`Created embedding for search query, embedding size: ${embedding.length}`);
      
      // Подготовка фильтра (без language)
      const filter = {};
      const mustConditions = [];
      
      // 🍄 УПРОЩЕНО: Убрали language фильтр
      if (category) {
        mustConditions.push({ 
          key: 'metadata.category', 
          match: { value: category } 
        });
        logger.debug(`Added category filter: ${category}`);
      }
      
      // Для тегов используем should условие (хотя бы один из тегов)
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const tagsFilter = tags.map(tag => ({
          key: 'metadata.tags',
          match: { value: tag }
        }));
        
        if (tagsFilter.length > 0) {
          mustConditions.push({ should: tagsFilter });
          logger.debug(`Added tags filter with ${tagsFilter.length} tags`);
        }
      }
      
      // Если есть условия, добавляем их в фильтр
      if (mustConditions.length > 0) {
        filter.must = mustConditions;
        logger.debug(`Applied filter with ${mustConditions.length} conditions`);
      }
      
      // Выполнение поиска - увеличиваем лимит для поиска чанков
      const searchLimit = Math.min(limit * 3, 30); // Ищем больше чанков для лучшего покрытия
      logger.debug(`🍄 Executing search with universal threshold: ${threshold}, limit: ${searchLimit}`);
      const searchResults = await this.client.search(this.collectionName, {
        vector: embedding,
        limit: searchLimit,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        with_payload: true,
        score_threshold: threshold
      });
      
      // Подробное логирование результатов поиска
      if (searchResults.length > 0) {
        logger.debug(`🍄 Search returned ${searchResults.length} chunk results with scores: ${searchResults.map(r => r.score.toFixed(3)).join(', ')}`);
        logger.info(`🍄 Found ${searchResults.length} chunks above universal threshold ${threshold}`);
      } else {
        logger.debug(`🍄 Search returned no results with universal threshold: ${threshold}`);
        logger.info(`🍄 No chunks found above threshold ${threshold} - query may not be relevant to knowledge base`);
      }

      // НОВОЕ: Выбор между возвратом чанков или группировкой по документам
      if (returnChunks) {
        // Возвращаем чанки как есть для детального анализа
        const results = searchResults
          .slice(0, limit)
          .map(result => ({
            id: result.payload.metadata.id,
            content: result.payload.content,
            metadata: result.payload.metadata,
            score: result.score,
            isChunk: result.payload.metadata.originalId !== result.payload.metadata.id,
            chunkInfo: result.payload.metadata.originalId !== result.payload.metadata.id ? {
              originalId: result.payload.metadata.originalId,
              chunkIndex: result.payload.metadata.chunkIndex,
              totalChunks: result.payload.metadata.totalChunks,
              startPosition: result.payload.metadata.startPosition,
              endPosition: result.payload.metadata.endPosition
            } : null
          }));

        logger.info(`🍄 Found ${results.length} relevant chunks (detailed mode)`);
        return results;
      }
      
      // Группировка результатов по originalId и выбор лучшего чанка для каждого документа
      const groupedResults = new Map();
      
      searchResults.forEach(result => {
        const originalId = result.payload.metadata.originalId || result.payload.metadata.id;
        const existing = groupedResults.get(originalId);
        
        if (!existing || result.score > existing.score) {
          groupedResults.set(originalId, result);
        }
      });
      
      // Форматирование результатов - берем только лучшие чанки для каждого документа
      const results = Array.from(groupedResults.values())
        .sort((a, b) => b.score - a.score) // Сортируем по релевантности
        .slice(0, limit) // Ограничиваем количество документов
        .map(result => {
          const isChunk = result.payload.metadata.originalId !== result.payload.metadata.id;
          
          return {
            id: result.payload.metadata.originalId || result.payload.metadata.id,
            content: result.payload.content,
            metadata: {
              ...result.payload.metadata,
              // Убираем служебные поля чанкинга из пользовательского вывода при группировке
              chunkIndex: undefined,
              totalChunks: undefined,
              startPosition: undefined,
              endPosition: undefined,
              // Но добавляем информацию о том, что это результат из чанка
              sourceType: isChunk ? 'chunk' : 'document',
              sourceChunkIndex: isChunk ? result.payload.metadata.chunkIndex : undefined
            },
            score: result.score
          };
        });
      
      logger.info(`🍄 Found ${results.length} relevant documents (from ${searchResults.length} chunks)`);
      
      // Добавляем подробное логирование результатов
      results.forEach((result, index) => {
        const sourceInfo = result.metadata.sourceType === 'chunk' 
          ? `chunk ${result.metadata.sourceChunkIndex}` 
          : 'full document';
        logger.debug(`🍄 Result #${index+1}: ID=${result.id}, Score=${result.score.toFixed(4)}, Source=${sourceInfo}, Language=${result.metadata?.language || 'auto'}`);
        logger.debug(`🍄 Content preview: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
      });
      
      return results;
    } catch (error) {
      logger.error(`🍄 Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Удаляет документ из векторной базы (все его чанки)
   * @async
   * @param {string} documentId - ID документа для удаления
   * @returns {Promise<boolean>} Успешность операции
   */
  async deleteDocument(documentId) {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          logger.warn('Vector store not initialized, cannot delete document');
          return false;
        }
      }
      
      logger.info(`🍄 Deleting document and all its chunks: ${documentId}`);
      
      // Удаляем все чанки документа
      const success = await this._deleteDocumentChunks(documentId);
      
      if (success) {
        logger.info(`🍄 Document and chunks deleted: ${documentId}`);
      } else {
        logger.warn(`🍄 Failed to delete some chunks for document: ${documentId}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`🍄 Failed to delete document: ${error.message}`);
      return false;
    }
  }

  /**
   * Проверка здоровья сервиса
   * @returns {Promise<Object>} Статус здоровья
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          message: 'Vector store not initialized',
          isInitialized: false,
          chunkingEnabled: this.defaultChunkingOptions.enableChunking
        };
      }
      
      // Проверка через запрос списка коллекций вместо healthCheck
      const collections = await this.client.getCollections();
      
      // Получение информации о коллекции - используем правильное поле points_count
      let collectionInfo = { points_count: 0 };
      try {
        collectionInfo = await this.client.getCollection(this.collectionName);
      } catch (error) {
        logger.warn(`Could not get collection info: ${error.message}`);
      }
      
      return {
        status: 'ok',
        message: 'Vector store is healthy with universal search',
        isInitialized: true,
        qdrantStatus: { collections_count: collections.collections.length },
        collection: {
          name: this.collectionName,
          vectorCount: collectionInfo.points_count || 0,
          vectorDimension: this.vectorDimension,
        },
        universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО: убрали languageThresholds
        chunkingConfig: this.defaultChunkingOptions
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Vector store health check failed: ${error.message}`,
        isInitialized: this.initialized,
        chunkingEnabled: this.defaultChunkingOptions.enableChunking
      };
    }
  }

  /**
   * Получение статистики
   * @returns {Promise<Object>} Статистика
   */
  async getStats() {
    try {
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          documentsCount: 0,
          chunksCount: 0,
          cacheSize: this.embeddingCache.size,
          lastUpdate: null,
          universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО
          chunkingConfig: this.defaultChunkingOptions
        };
      }
      
      // Получение информации о коллекции - используем правильное поле points_count
      let collectionInfo = { points_count: 0 };
      try {
        collectionInfo = await this.client.getCollection(this.collectionName);
      } catch (error) {
        logger.warn(`Could not get collection info: ${error.message}`);
      }

      // Подсчет уникальных документов (по originalId)
      let uniqueDocuments = 0;
      try {
        const scrollResult = await this.client.scroll(this.collectionName, {
          limit: 10000,
          with_payload: ['metadata.originalId']
        });
        
        const originalIds = new Set();
        scrollResult.points.forEach(point => {
          const originalId = point.payload?.metadata?.originalId;
          if (originalId) {
            originalIds.add(originalId);
          }
        });
        uniqueDocuments = originalIds.size;
      } catch (error) {
        logger.warn(`Could not count unique documents: ${error.message}`);
      }
      
      return {
        status: 'ok',
        documentsCount: uniqueDocuments,
        chunksCount: collectionInfo.points_count || 0,
        cacheSize: this.embeddingCache.size,
        lastUpdate: new Date().toISOString(),
        universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО
        chunkingConfig: this.defaultChunkingOptions
      };
    } catch (error) {
      logger.error(`Failed to get stats: ${error.message}`);
      return {
        status: 'error',
        documentsCount: 0,
        chunksCount: 0,
        cacheSize: this.embeddingCache.size,
        error: error.message,
        universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО
        chunkingConfig: this.defaultChunkingOptions
      };
    }
  }
  
  /**
   * Очищает всю коллекцию
   * @async
   * @returns {Promise<boolean>} Успешность операции
   */
  async clearCollection() {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          logger.warn('Vector store not initialized, cannot clear collection');
          return false;
        }
      }
      
      logger.warn(`🍄 Clearing entire collection: ${this.collectionName}`);
      
      // Удаление и пересоздание коллекции
      await this.client.deleteCollection(this.collectionName);
      
      // Сбрасываем флаг инициализации
      this.initialized = false;
      
      // Инициализируем заново для создания пустой коллекции
      await this.initialize();
      
      logger.info(`🍄 Collection cleared: ${this.collectionName}`);
      return true;
    } catch (error) {
      logger.error(`🍄 Failed to clear collection: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 🔧 ИСПРАВЛЕНО: Создает embedding для текста с timeout защитой и кэшем
   * @private
   * @param {string} text - Текст для создания embedding
   * @returns {Promise<number[]>} Embedding вектор
   */
  async _createEmbeddingWithTimeout(text) {
    // Очистка и нормализация текста
    const normalizedText = text.trim().toLowerCase();
    
    // Проверка кэша
    if (this.embeddingCache.has(normalizedText)) {
      logger.debug('Using cached embedding');
      return this.embeddingCache.get(normalizedText);
    }
    
    try {
      // Создание нового embedding с timeout защитой
      logger.info(`🔧 Creating embedding with timeout ${this.embeddingTimeout}ms for text (length: ${normalizedText.length})`);
      
      const embedding = await Promise.race([
        this._createEmbedding(normalizedText),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Embedding timeout after ${this.embeddingTimeout}ms`)), this.embeddingTimeout)
        )
      ]);
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding returned: not an array');
      }
      
      if (embedding.length !== this.vectorDimension) {
        throw new Error(`Unexpected embedding dimension: got ${embedding.length}, expected ${this.vectorDimension}`);
      }
      
      // Кэширование результата
      if (this.embeddingCache.size >= this.maxCacheSize) {
        // Удаляем первый элемент (самый старый) при достижении лимита
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
        logger.debug('Embedding cache limit reached, removing oldest entry');
      }
      this.embeddingCache.set(normalizedText, embedding);
      
      logger.info(`🔧 ✅ Successfully created embedding, dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      logger.error(`🔧 ❌ Error creating embedding with timeout: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Создает embedding для текста с использованием кэша (базовый метод)
   * @private
   * @param {string} text - Текст для создания embedding
   * @returns {Promise<number[]>} Embedding вектор
   */
  async _createEmbedding(text) {
    try {
      // Попробуем использовать прямой вызов API OpenAI для эмбеддингов
      const embedding = await this.embeddings.embedQuery(text);
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding returned: not an array');
      }
      
      if (embedding.length !== this.vectorDimension) {
        throw new Error(`Unexpected embedding dimension: got ${embedding.length}, expected ${this.vectorDimension}`);
      }
      
      return embedding;
    } catch (error) {
      logger.error(`Error creating embedding: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Вспомогательный метод для тестирования поиска в векторном хранилище
   * @async
   * @param {string} query - Текст запроса
   * @param {number} [threshold] - Порог релевантности для тестирования
   * @returns {Promise<Object>} Результат тестирования с различными порогами
   */
  async testSearch(query, threshold) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return { error: 'Empty or invalid query provided' };
    }
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.initialized) {
        return { error: 'Vector store not initialized' };
      }
      
      // 🍄 УПРОЩЕНО: Определяем порог без языковой зависимости
      const testThreshold = this._getThreshold(threshold);
      
      // Создание embedding для запроса
      const embedding = await this._createEmbeddingWithTimeout(query);
      
      // Выполнение поиска с различными порогами для сравнения
      const thresholds = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
      
      const results = {};
      
      // Тестирование с разными порогами
      for (const testThresholdValue of thresholds) {
        const searchResults = await this.client.search(this.collectionName, {
          vector: embedding,
          limit: 10,
          with_payload: true,
          score_threshold: testThresholdValue
        });
        
        results[testThresholdValue] = {
          count: searchResults.length,
          scores: searchResults.map(r => r.score.toFixed(4))
        };
      }
      
      // Возвращаем также результаты для текущего порога
      const currentResults = await this.client.search(this.collectionName, {
        vector: embedding,
        limit: 10,
        with_payload: true,
        score_threshold: testThreshold
      });
      
      const formattedResults = currentResults.map(result => ({
        id: result.payload.metadata.id || result.id.toString(),
        originalId: result.payload.metadata.originalId,
        score: result.score,
        content: result.payload.content.substring(0, 100) + (result.payload.content.length > 100 ? '...' : ''),
        metadata: result.payload.metadata
      }));
      
      return {
        query,
        threshold: testThreshold,
        universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО
        resultsByThreshold: results,
        chunksFound: formattedResults.length,
        topResults: formattedResults,
        chunkingEnabled: this.defaultChunkingOptions.enableChunking
      };
    } catch (error) {
      logger.error(`🍄 Test search failed: ${error.message}`);
      return { error: `Test search failed: ${error.message}` };
    }
  }
  
  /**
   * Диагностика векторного хранилища с поддержкой чанкинга
   * @async
   * @returns {Promise<Object>} Диагностическая информация
   */
  async diagnose() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.initialized) {
        return { 
          status: 'error',
          message: 'Vector store not initialized',
          initialized: false,
          chunkingEnabled: this.defaultChunkingOptions.enableChunking
        };
      }
      
      // Проверка соединения
      const connectionStatus = await this.client.getCollections()
        .then(() => ({ status: 'ok', message: 'Connected to Qdrant' }))
        .catch(error => ({ status: 'error', message: `Connection failed: ${error.message}` }));
      
      // Проверка коллекции - используем правильное поле points_count
      let collectionStatus = { status: 'unknown' };
      try {
        const collectionInfo = await this.client.getCollection(this.collectionName);
        collectionStatus = {
          status: 'ok',
          message: `Collection ${this.collectionName} exists`,
          info: {
            vectorCount: collectionInfo.points_count || 0,
            vectorDimension: this.vectorDimension,
          }
        };
      } catch (error) {
        collectionStatus = {
          status: 'error',
          message: `Collection check failed: ${error.message}`
        };
      }
      
      // Проверка создания эмбеддингов
      let embeddingStatus = { status: 'unknown' };
      try {
        const testEmbedding = await this._createEmbeddingWithTimeout('test embedding for diagnostics');
        embeddingStatus = {
          status: 'ok',
          message: 'Embedding creation works',
          dimension: testEmbedding.length
        };
      } catch (error) {
        embeddingStatus = {
          status: 'error',
          message: `Embedding creation failed: ${error.message}`
        };
      }

      // Проверка чанкинга
      let chunkingStatus = { status: 'unknown' };
      try {
        const testDoc = {
          id: 'test-doc',
          content: 'This is a test document for chunking functionality. '.repeat(20),
          metadata: { title: 'Test', language: 'auto', category: 'test' }
        };
        
        const chunks = textChunker.chunkDocument(testDoc);
        chunkingStatus = {
          status: 'ok',
          message: 'Chunking functionality works',
          testChunks: chunks.length,
          chunkingEnabled: this.defaultChunkingOptions.enableChunking
        };
      } catch (error) {
        chunkingStatus = {
          status: 'error',
          message: `Chunking test failed: ${error.message}`
        };
      }
      
      // Общий статус
      const overallStatus = 
        connectionStatus.status === 'ok' && 
        collectionStatus.status === 'ok' && 
        embeddingStatus.status === 'ok' &&
        chunkingStatus.status === 'ok' ? 'ok' : 'error';
      
      return {
        status: overallStatus,
        connection: connectionStatus,
        collection: collectionStatus,
        embedding: embeddingStatus,
        chunking: chunkingStatus,
        config: {
          url: this.url,
          collectionName: this.collectionName,
          embeddingModel: this.embeddingModel,
          embeddingTimeout: this.embeddingTimeout,
          cacheSize: this.embeddingCache.size,
          maxCacheSize: this.maxCacheSize,
          universalThreshold: this.defaultThreshold, // 🍄 ИЗМЕНЕНО
          chunkingConfig: this.defaultChunkingOptions
        }
      };
    } catch (error) {
      logger.error(`🍄 Diagnostics failed: ${error.message}`);
      return {
        status: 'error',
        message: `Diagnostics failed: ${error.message}`,
        chunkingEnabled: this.defaultChunkingOptions.enableChunking
      };
    }
  }
}

// Экспортируем единственный экземпляр сервиса
module.exports = new VectorStoreService();