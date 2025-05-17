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
        await this.client.healthCheck();
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
          
          // Создание embedding для текста документа
          const embedding = await this._createEmbedding(doc.content);
          
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
        } catch (docError) {
          logger.error(`Error processing document ${doc.id}: ${docError.message}`);
          // Продолжаем с другими документами
        }
      }
      
      // Добавление точек в Qdrant
      if (points.length > 0) {
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
      
      const { limit = 5, language, category, tags } = options;
      
      logger.info(`Searching for: "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}" with options: ${JSON.stringify({
        limit, language, category, tags: Array.isArray(tags) ? tags.length : tags
      })}`);
      
      // Создание embedding для запроса
      const embedding = await this._createEmbedding(query);
      
      // Подготовка фильтра
      const filter = {};
      const mustConditions = [];
      
      // Добавление фильтров для языка, категории и тегов
      if (language) {
        mustConditions.push({ 
          key: 'metadata.language', 
          match: { value: language } 
        });
      }
      
      if (category) {
        mustConditions.push({ 
          key: 'metadata.category', 
          match: { value: category } 
        });
      }
      
      // Для тегов используем should условие (хотя бы один из тегов)
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const tagsFilter = tags.map(tag => ({
          key: 'metadata.tags',
          match: { value: tag }
        }));
        
        if (tagsFilter.length > 0) {
          mustConditions.push({ should: tagsFilter });
        }
      }
      
      // Если есть условия, добавляем их в фильтр
      if (mustConditions.length > 0) {
        filter.must = mustConditions;
      }
      
      // Выполнение поиска
      const searchResults = await this.client.search(this.collectionName, {
        vector: embedding,
        limit: Math.min(limit, 20), // Ограничение максимального количества результатов
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        with_payload: true,
        score_threshold: 0.6 // Минимальный порог релевантности
      });
      
      // Форматирование результатов
      const results = searchResults.map(result => ({
        id: result.id,
        content: result.payload.content,
        metadata: result.payload.metadata,
        score: result.score
      }));
      
      logger.info(`Found ${results.length} relevant documents`);
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
      
      const qdrantHealth = await this.client.healthCheck();
      
      // Получение информации о коллекции
      const collectionInfo = await this.client.getCollection(this.collectionName);
      
      return {
        status: 'ok',
        message: 'Vector store is healthy',
        isInitialized: true,
        qdrantStatus: qdrantHealth,
        collection: {
          name: this.collectionName,
          vectorCount: collectionInfo.vectors_count,
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
      
      const collectionInfo = await this.client.getCollection(this.collectionName);
      
      return {
        status: 'ok',
        documentsCount: collectionInfo.vectors_count,
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
      return this.embeddingCache.get(normalizedText);
    }
    
    // Создание нового embedding
    const embedding = await this.embeddings.embedQuery(normalizedText);
    
    // Кэширование результата
    if (this.embeddingCache.size >= this.maxCacheSize) {
      // Удаляем первый элемент (самый старый) при достижении лимита
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(normalizedText, embedding);
    
    return embedding;
  }
}

// Экспортируем единственный экземпляр сервиса
module.exports = new VectorStoreService();
