/**
 * @fileoverview Сервис для работы с векторной базой знаний Qdrant
 * Предоставляет методы для добавления, поиска и удаления документов
 */

const { QdrantClient } = require("@qdrant/js-client-rest");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Document } = require("langchain/document");
const logger = require('../utils/logger');

/**
 * @typedef {Object} DocumentMetadata
 * @property {string} id - Уникальный идентификатор документа
 * @property {string} title - Заголовок документа
 * @property {string} category - Категория документа
 * @property {string} language - Язык документа (en, ru, es)
 * @property {string[]} [tags] - Теги для документа
 * @property {string} [source] - Источник документа
 * @property {Date} [createdAt] - Дата создания
 * @property {Date} [updatedAt] - Дата обновления
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit=5] - Максимальное количество результатов
 * @property {string} [language] - Фильтр по языку
 * @property {string} [category] - Фильтр по категории
 * @property {string[]} [tags] - Фильтр по тегам
 * @property {number} [score_threshold=0.4] - Минимальный порог релевантности
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - ID документа
 * @property {string} content - Содержимое документа
 * @property {DocumentMetadata} metadata - Метаданные документа
 * @property {number} score - Релевантность (0-1)
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
    this.collectionName = process.env.VECTOR_COLLECTION_NAME || 'shrooms_knowledge';
    this.url = process.env.VECTOR_DB_URL || 'http://localhost:6333';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-ada-002';
    this.vectorDimension = 1536; // Размерность для text-embedding-ada-002
    
    // Создание клиента будет происходить при инициализации
    this.client = null;
    this.embeddings = null;
    
    // Кэш для embeddings для оптимизации запросов
    this.embeddingCache = new Map();
    this.maxCacheSize = 100;
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
        openAIApiKey: process.env.OPENAI_API_KEY,
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
            },
            on_disk_payload: true
          });
          
          // Создание индексов для фильтрации
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.language',
            field_schema: 'keyword'
          });
          
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.category',
            field_schema: 'keyword'
          });
          
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: 'metadata.tags',
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
      logger.info('Vector store initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize vector store: ${error.message}`);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Добавляет документы в векторную базу
   * @async
   * @param {Object[]} documents - Документы для добавления
   * @param {string} documents[].id - ID документа
   * @param {string} documents[].content - Содержимое документа
   * @param {DocumentMetadata} documents[].metadata - Метаданные документа
   * @returns {Promise<boolean>} Успешность операции
   */
  async addDocuments(documents) {
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
      
      logger.info(`Adding ${documents.length} documents to vector store`);
      
      // Подготовка документов для Qdrant
      const points = [];
      
      for (const doc of documents) {
        try {
          // Проверка наличия обязательных полей
          if (!doc.id || !doc.content) {
            logger.warn(`Document missing required fields (id, content): ${JSON.stringify(doc)}`);
            continue;
          }
          
          // Добавляем подробное логирование для отслеживания процесса добавления
          logger.debug(`Processing document ID: ${doc.id}, content length: ${doc.content.length} characters`);
          if (doc.metadata) {
            logger.debug(`Document metadata: language=${doc.metadata.language}, category=${doc.metadata.category}`);
          }
          
          // Создание embedding для текста документа
          const embedding = await this._createEmbedding(doc.content);
          logger.debug(`Created embedding for document ${doc.id}, embedding size: ${embedding.length}`);
          
          // Формирование точки для Qdrant
          points.push({
            id: doc.id,
            vector: embedding,
            payload: {
              content: doc.content,
              metadata: {
                ...doc.metadata,
                updatedAt: new Date().toISOString()
              }
            }
          });
          
          logger.debug(`Successfully processed document ${doc.id}`);
        } catch (docError) {
          logger.error(`Error processing document ${doc.id}: ${docError.message}`);
          // Продолжаем с другими документами
        }
      }
      
      // Добавление точек в Qdrant
      if (points.length > 0) {
        logger.info(`Upserting ${points.length} documents to Qdrant collection ${this.collectionName}`);
        await this.client.upsert(this.collectionName, {
          points
        });
        logger.info(`Successfully added ${points.length} documents to vector store`);
        return true;
      } else {
        logger.warn('No valid documents to add after processing');
        return false;
      }
    } catch (error) {
      logger.error(`Failed to add documents to vector store: ${error.message}`);
      return false;
    }
  }

  /**
   * Ищет документы, релевантные запросу
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
        language, 
        category, 
        tags,
        // ИЗМЕНЕНО: Снижен порог релевантности по умолчанию с 0.6 до 0.4
        score_threshold = 0.4
      } = options;
      
      logger.info(`Searching for: "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}" with options: ${JSON.stringify({
        limit, language, category, tags: Array.isArray(tags) ? tags.length : tags, score_threshold
      })}`);
      
      // Создание embedding для запроса
      const embedding = await this._createEmbedding(query);
      logger.debug(`Created embedding for search query, embedding size: ${embedding.length}`);
      
      // Подготовка фильтра
      const filter = {};
      const mustConditions = [];
      
      // Добавление фильтров для языка, категории и тегов
      if (language) {
        mustConditions.push({ 
          key: 'metadata.language', 
          match: { value: language } 
        });
        logger.debug(`Added language filter: ${language}`);
      }
      
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
      
      // Выполнение поиска
      logger.debug(`Executing search with score_threshold: ${score_threshold}`);
      const searchResults = await this.client.search(this.collectionName, {
        vector: embedding,
        limit: Math.min(limit, 20), // Ограничение максимального количества результатов
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        with_payload: true,
        score_threshold: score_threshold
      });
      
      // Подробное логирование результатов поиска
      if (searchResults.length > 0) {
        logger.debug(`Search returned ${searchResults.length} results with scores: ${searchResults.map(r => r.score.toFixed(3)).join(', ')}`);
      } else {
        logger.debug(`Search returned no results with threshold: ${score_threshold}`);
      }
      
      // Форматирование результатов
      const results = searchResults.map(result => ({
        id: result.id,
        content: result.payload.content,
        metadata: result.payload.metadata,
        score: result.score
      }));
      
      logger.info(`Found ${results.length} relevant documents`);
      
      // Добавляем подробное логирование результатов
      results.forEach((result, index) => {
        logger.debug(`Result #${index+1}: ID=${result.id}, Score=${result.score.toFixed(4)}, Language=${result.metadata?.language || 'unknown'}`);
        logger.debug(`Content preview: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
      });
      
      return results;
    } catch (error) {
      logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Удаляет документ из векторной базы
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
      
      logger.info(`Deleting document: ${documentId}`);
      
      await this.client.delete(this.collectionName, {
        points: [documentId]
      });
      
      logger.info(`Document deleted: ${documentId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete document: ${error.message}`);
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
          isInitialized: false
        };
      }
      
      // Проверка через запрос списка коллекций вместо healthCheck
      const collections = await this.client.getCollections();
      
      // Получение информации о коллекции
      let collectionInfo = { vectors_count: 0 };
      try {
        collectionInfo = await this.client.getCollection(this.collectionName);
      } catch (error) {
        logger.warn(`Could not get collection info: ${error.message}`);
      }
      
      return {
        status: 'ok',
        message: 'Vector store is healthy',
        isInitialized: true,
        qdrantStatus: { collections_count: collections.collections.length },
        collection: {
          name: this.collectionName,
          vectorCount: collectionInfo.vectors_count || 0,
          vectorDimension: this.vectorDimension
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Vector store health check failed: ${error.message}`,
        isInitialized: this.initialized
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
          cacheSize: this.embeddingCache.size,
          lastUpdate: null
        };
      }
      
      let collectionInfo = { vectors_count: 0 };
      try {
        collectionInfo = await this.client.getCollection(this.collectionName);
      } catch (error) {
        logger.warn(`Could not get collection info: ${error.message}`);
      }
      
      return {
        status: 'ok',
        documentsCount: collectionInfo.vectors_count || 0,
        cacheSize: this.embeddingCache.size,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to get stats: ${error.message}`);
      return {
        status: 'error',
        documentsCount: 0,
        cacheSize: this.embeddingCache.size,
        error: error.message
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
      
      logger.warn(`Clearing entire collection: ${this.collectionName}`);
      
      // Удаление и пересоздание коллекции
      await this.client.deleteCollection(this.collectionName);
      
      // Сбрасываем флаг инициализации
      this.initialized = false;
      
      // Инициализируем заново для создания пустой коллекции
      await this.initialize();
      
      logger.info(`Collection cleared: ${this.collectionName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear collection: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Создает embedding для текста с использованием кэша
   * @private
   * @param {string} text - Текст для создания embedding
   * @returns {Promise<number[]>} Embedding вектор
   */
  async _createEmbedding(text) {
    // Очистка и нормализация текста
    const normalizedText = text.trim().toLowerCase();
    
    // Проверка кэша
    if (this.embeddingCache.has(normalizedText)) {
      logger.debug('Using cached embedding');
      return this.embeddingCache.get(normalizedText);
    }
    
    try {
      // Создание нового embedding
      logger.debug(`Generating new embedding for text (length: ${normalizedText.length})`);
      const embedding = await this.embeddings.embedQuery(normalizedText);
      
      // Кэширование результата
      if (this.embeddingCache.size >= this.maxCacheSize) {
        // Удаляем первый элемент (самый старый) при достижении лимита
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
        logger.debug('Embedding cache limit reached, removing oldest entry');
      }
      this.embeddingCache.set(normalizedText, embedding);
      
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
   * @param {number} [threshold=0.4] - Порог релевантности для тестирования
   * @returns {Promise<Object>} Результат тестирования с различными порогами
   */
  async testSearch(query, threshold = 0.4) {
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
      
      // Создание embedding для запроса
      const embedding = await this._createEmbedding(query);
      
      // Выполнение поиска с различными порогами для сравнения
      const thresholds = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
      
      const results = {};
      
      // Тестирование с разными порогами
      for (const testThreshold of thresholds) {
        const searchResults = await this.client.search(this.collectionName, {
          vector: embedding,
          limit: 10,
          with_payload: true,
          score_threshold: testThreshold
        });
        
        results[testThreshold] = {
          count: searchResults.length,
          scores: searchResults.map(r => r.score.toFixed(4))
        };
      }
      
      // Возвращаем также результаты для текущего порога
      const currentResults = await this.client.search(this.collectionName, {
        vector: embedding,
        limit: 10,
        with_payload: true,
        score_threshold: threshold
      });
      
      const formattedResults = currentResults.map(result => ({
        id: result.id,
        score: result.score,
        content: result.payload.content.substring(0, 100) + (result.payload.content.length > 100 ? '...' : ''),
        metadata: result.payload.metadata
      }));
      
      return {
        query,
        threshold,
        resultsByThreshold: results,
        documentsFound: formattedResults.length,
        topResults: formattedResults
      };
    } catch (error) {
      logger.error(`Test search failed: ${error.message}`);
      return { error: `Test search failed: ${error.message}` };
    }
  }
  
  /**
   * Диагностика векторного хранилища
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
          initialized: false
        };
      }
      
      // Проверка соединения
      const connectionStatus = await this.client.getCollections()
        .then(() => ({ status: 'ok', message: 'Connected to Qdrant' }))
        .catch(error => ({ status: 'error', message: `Connection failed: ${error.message}` }));
      
      // Проверка коллекции
      let collectionStatus = { status: 'unknown' };
      try {
        const collectionInfo = await this.client.getCollection(this.collectionName);
        collectionStatus = {
          status: 'ok',
          message: `Collection ${this.collectionName} exists`,
          info: {
            vectorCount: collectionInfo.vectors_count || 0,
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
        const testEmbedding = await this._createEmbedding('test embedding for diagnostics');
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
      
      // Общий статус
      const overallStatus = 
        connectionStatus.status === 'ok' && 
        collectionStatus.status === 'ok' && 
        embeddingStatus.status === 'ok' ? 'ok' : 'error';
      
      return {
        status: overallStatus,
        connection: connectionStatus,
        collection: collectionStatus,
        embedding: embeddingStatus,
        config: {
          url: this.url,
          collectionName: this.collectionName,
          embeddingModel: this.embeddingModel,
          cacheSize: this.embeddingCache.size,
          maxCacheSize: this.maxCacheSize
        }
      };
    } catch (error) {
      logger.error(`Diagnostics failed: ${error.message}`);
      return {
        status: 'error',
        message: `Diagnostics failed: ${error.message}`
      };
    }
  }
}

// Экспортируем единственный экземпляр сервиса
module.exports = new VectorStoreService();
