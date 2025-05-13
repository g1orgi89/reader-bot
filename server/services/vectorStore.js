/**
 * @file VectorStore Service for Shrooms AI Support Bot
 * @description Сервис для работы с векторной базой знаний с поддержкой Qdrant
 */

const { QdrantApi } = require('@qdrant/js-client-rest');
const logger = require('../utils/logger');

/**
 * @typedef {import('../types/index.js').VectorDocument} VectorDocument
 * @typedef {import('../types/index.js').VectorDocumentMetadata} VectorDocumentMetadata
 * @typedef {import('../types/index.js').SearchOptions} SearchOptions
 * @typedef {import('../types/index.js').SearchResult} SearchResult
 * @typedef {import('../types/index.js').VectorStoreOptions} VectorStoreOptions
 * @typedef {import('../types/index.js').EmbeddingProvider} EmbeddingProvider
 * @typedef {import('../types/index.js').VectorStoreInit} VectorStoreInit
 * @typedef {import('../types/index.js').BulkOperationResult} BulkOperationResult
 * @typedef {import('../types/index.js').VectorStoreStats} VectorStoreStats
 */

/**
 * @class VectorStoreService
 * @description Сервис для работы с векторной базой знаний
 * 
 * Поддерживаемые провайдеры embeddings:
 * - OpenAI
 * - Настраиваемые провайдеры
 */
class VectorStoreService {
  /**
   * @constructor
   * @param {VectorStoreOptions} options - Настройки векторного хранилища
   */
  constructor(options) {
    this.options = {
      dimensions: 1536,  // Default for OpenAI ada-002
      metric: 'cosine',
      ...options
    };
    
    this.client = null;
    this.isInitialized = false;
    this.queryCache = new Map();
    this.collectionName = options.collectionName || 'shrooms_knowledge';
    
    // Инициализация провайдера embeddings
    this._initEmbeddingProvider();
  }

  /**
   * Инициализация провайдера embeddings
   * @private
   */
  _initEmbeddingProvider() {
    const { provider, apiKey, model } = this.options.embeddingProvider;
    
    switch (provider) {
      case 'openai':
        const OpenAI = require('openai');
        this.embeddingClient = new OpenAI({
          apiKey: apiKey
        });
        this.embeddingModel = model || 'text-embedding-ada-002';
        break;
      
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  /**
   * Инициализация соединения с векторной базой данных
   * @returns {Promise<VectorStoreInit>}
   */
  async initialize() {
    try {
      this.client = new QdrantApi({
        url: this.options.url,
      });

      // Проверка существования коллекции и создание при необходимости
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.options.dimensions,
            distance: this._getDistanceMetric(this.options.metric)
          }
        });
        logger.info(`Created collection: ${this.collectionName}`);
      }

      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      logger.error(`Failed to initialize VectorStore: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Преобразование метрики расстояния для Qdrant
   * @private
   * @param {string} metric - Метрика (cosine, dot, euclidean)
   * @returns {string} Qdrant метрика
   */
  _getDistanceMetric(metric) {
    const metricMap = {
      'cosine': 'Cosine',
      'dot': 'Dot',
      'euclidean': 'Euclid'
    };
    return metricMap[metric] || 'Cosine';
  }

  /**
   * Генерация embeddings для текста
   * @param {string} text - Текст для обработки
   * @returns {Promise<number[]>} Векторное представление
   */
  async generateEmbedding(text) {
    try {
      const { provider } = this.options.embeddingProvider;

      if (provider === 'openai') {
        const response = await this.embeddingClient.embeddings.create({
          model: this.embeddingModel,
          input: text,
        });
        return response.data[0].embedding;
      }
      
      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      logger.error(`Error generating embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Добавление документов в векторную базу
   * @param {VectorDocument[]} documents - Документы для добавления
   * @returns {Promise<BulkOperationResult>}
   */
  async addDocuments(documents) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    // Batch processing для оптимизации
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        const points = await Promise.all(
          batch.map(async (doc) => {
            try {
              result.processed++;

              // Генерация embedding для документа
              const embedding = await this.generateEmbedding(doc.content);

              return {
                id: doc.id,
                vector: embedding,
                payload: {
                  content: doc.content,
                  metadata: doc.metadata
                }
              };
            } catch (error) {
              result.failed++;
              result.errors.push({
                documentId: doc.id,
                error: error.message
              });
              return null;
            }
          })
        );

        // Фильтрация успешных обработанных документов
        const validPoints = points.filter(point => point !== null);
        
        if (validPoints.length > 0) {
          await this.client.upsert(this.collectionName, {
            wait: true,
            points: validPoints
          });
          result.succeeded += validPoints.length;
        }
      } catch (error) {
        logger.error(`Batch insert error: ${error.message}`);
        result.errors.push({
          batch: i,
          error: error.message
        });
      }
    }

    logger.info(`Document insertion result: ${result.succeeded}/${result.processed} success`);
    return result;
  }

  /**
   * Поиск релевантных документов
   * @param {string} query - Поисковый запрос
   * @param {SearchOptions} options - Опции поиска
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      limit = 10,
      language,
      category,
      tags,
      threshold = 0.7
    } = options;

    try {
      // Проверка кэша для запросов
      const cacheKey = `${query}:${JSON.stringify(options)}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      // Генерация embedding для запроса
      const queryEmbedding = await this.generateEmbedding(query);

      // Формирование фильтров
      const filters = this._buildFilters({ language, category, tags });

      // Выполнение поиска в Qdrant
      const searchResults = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        score_threshold: threshold,
        with_payload: true,
        filter: filters
      });

      // Обработка и форматирование результатов
      const results = searchResults.map(result => ({
        document: {
          id: result.id,
          content: result.payload.content,
          metadata: result.payload.metadata
        },
        score: result.score,
        snippet: this._generateSnippet(result.payload.content, query)
      }));

      // Кэширование результата
      this.queryCache.set(cacheKey, results);
      
      // Очистка старых записей кэша
      if (this.queryCache.size > 1000) {
        const firstKey = this.queryCache.keys().next().value;
        this.queryCache.delete(firstKey);
      }

      return results;
    } catch (error) {
      logger.error(`Search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Создание фильтров для поиска
   * @private
   * @param {Object} filters - Параметры фильтрации
   * @returns {Object} Qdrant фильтры
   */
  _buildFilters({ language, category, tags }) {
    const conditions = [];

    if (language) {
      conditions.push({
        key: 'metadata.language',
        match: { value: language }
      });
    }

    if (category) {
      conditions.push({
        key: 'metadata.category',
        match: { value: category }
      });
    }

    if (tags && tags.length > 0) {
      conditions.push({
        key: 'metadata.tags',
        match: { any: tags }
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Генерация сниппета содержимого
   * @private
   * @param {string} content - Полное содержимое
   * @param {string} query - Поисковый запрос
   * @returns {string} Сниппет
   */
  _generateSnippet(content, query) {
    const maxLength = 200;
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    // Поиск первого вхождения любого слова из запроса
    let startIndex = 0;
    for (const word of queryWords) {
      const index = contentLower.indexOf(word);
      if (index !== -1) {
        startIndex = Math.max(0, index - 50);
        break;
      }
    }
    
    let snippet = content.substring(startIndex, startIndex + maxLength);
    
    // Обрезаем до ближайшего пробела
    if (snippet.length < content.length) {
      const lastSpace = snippet.lastIndexOf(' ');
      if (lastSpace > 0) {
        snippet = snippet.substring(0, lastSpace) + '...';
      }
    }
    
    return snippet;
  }

  /**
   * Удаление документа из векторной базы
   * @param {string} documentId - ID документа для удаления
   * @returns {Promise<boolean>}
   */
  async deleteDocument(documentId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.delete(this.collectionName, {
        points: [documentId]
      });
      
      // Очистка кэша
      this.queryCache.clear();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting document: ${error.message}`);
      return false;
    }
  }

  /**
   * Очистка всей коллекции
   * @returns {Promise<boolean>}
   */
  async clearCollection() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.delete(this.collectionName, {
        filter: {}
      });
      
      // Очистка кэша
      this.queryCache.clear();
      
      return true;
    } catch (error) {
      logger.error(`Error clearing collection: ${error.message}`);
      return false;
    }
  }

  /**
   * Получение статистики по векторной базе
   * @returns {Promise<VectorStoreStats>}
   */
  async getStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const info = await this.client.getCollection(this.collectionName);
      
      return {
        totalDocuments: info.vectors_count,
        totalVectors: info.vectors_count,
        languageDistribution: {},
        categoryDistribution: {}
      };
    } catch (error) {
      logger.error(`Error getting stats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = VectorStoreService;
