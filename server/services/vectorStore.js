/**
 * Сервис для работы с векторной базой знаний (Qdrant)
 * @file server/services/vectorStore.js
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} SearchResult
 * @property {string} content - Содержимое документа
 * @property {number} score - Релевантность (0-1)
 * @property {Object} metadata - Метаданные документа
 * @property {string} id - ID документа
 */

/**
 * @typedef {Object} Document
 * @property {string} id - Уникальный ID документа
 * @property {string} content - Содержимое документа
 * @property {Object} [metadata] - Метаданные документа
 * @property {number[]} [vector] - Вектор эмбеддинга (опционально)
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit=5] - Количество результатов
 * @property {string} [language] - Язык документов для фильтрации
 * @property {number} [scoreThreshold=0.7] - Минимальный порог релевантности
 * @property {Object} [filters] - Дополнительные фильтры
 */

/**
 * @class VectorStoreService
 * @description Сервис для работы с векторной базой знаний на основе Qdrant
 */
class VectorStoreService {
  constructor() {
    this.initialized = false;
    this.client = null;
    this.collectionName = 'shrooms_knowledge';
    this.vectorSize = 1536; // Размер вектора для text-embedding-ada-002
    this.config = {
      url: process.env.VECTOR_DB_URL || 'http://localhost:6333',
      timeout: parseInt(process.env.VECTOR_DB_TIMEOUT) || 10000,
      batchSize: parseInt(process.env.VECTOR_BATCH_SIZE) || 100,
      searchLimit: parseInt(process.env.VECTOR_SEARCH_LIMIT) || 5
    };
    
    // Проверяем, включен ли RAG
    this.ragEnabled = process.env.ENABLE_RAG !== 'false';
    
    if (!this.ragEnabled) {
      logger.info('⚠️ RAG feature is disabled, VectorStore will run in stub mode');
    }
  }

  /**
   * Инициализирует подключение к Qdrant
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (!this.ragEnabled) {
        logger.info('📚 VectorStore initialized in stub mode (RAG disabled)');
        this.initialized = true;
        return;
      }

      logger.info('📡 Initializing vector store connection...');
      
      // Динамически импортируем qdrant-js только если RAG включен
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      this.client = new QdrantClient({
        url: this.config.url,
        timeout: this.config.timeout
      });

      // Проверяем соединение
      await this.client.getCollections();
      logger.info('✅ Connected to Qdrant successfully');

      // Создаем коллекцию если не существует
      await this.ensureCollection();
      
      this.initialized = true;
      logger.info('✅ Vector store initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize vector store:', error.message);
      
      // Если это ошибка подключения, работаем в режиме заглушки
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.warn('⚠️ Vector store unavailable, falling back to stub mode');
        this.ragEnabled = false;
        this.initialized = true;
        return;
      }
      
      throw error;
    }
  }

  /**
   * Проверяет и создает коллекцию если необходимо
   * @returns {Promise<void>}
   */
  async ensureCollection() {
    try {
      if (!this.ragEnabled || !this.client) {
        return;
      }

      // Проверяем существование коллекции
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`📚 Creating collection: ${this.collectionName}`);
        
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });

        logger.info(`✅ Collection created: ${this.collectionName}`);
      } else {
        logger.info(`📚 Collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      logger.error('❌ Failed to ensure collection:', error.message);
      throw error;
    }
  }

  /**
   * Поиск релевантных документов
   * @param {string} query - Поисковый запрос
   * @param {SearchOptions} options - Опции поиска
   * @returns {Promise<SearchResult[]>} Массив найденных документов
   */
  async search(query, options = {}) {
    try {
      // Если RAG отключен, возвращаем пустой массив
      if (!this.ragEnabled) {
        logger.info(`📚 Vector search (stub mode): "${query.substring(0, 50)}..."`);
        return [];
      }

      if (!this.initialized || !this.client) {
        logger.warn('Vector store not initialized, returning empty results');
        return [];
      }

      const {
        limit = this.config.searchLimit,
        language,
        scoreThreshold = 0.6,
        filters = {}
      } = options;

      // Получаем эмбеддинг для запроса
      const queryVector = await this.getEmbedding(query);

      // Готовим фильтры
      const searchFilters = this.buildFilters(language, filters);

      logger.info(`🔍 Vector search: "${query.substring(0, 50)}..."`);

      // Выполняем поиск
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        with_payload: true,
        with_vector: false,
        filter: searchFilters.length > 0 ? { must: searchFilters } : undefined,
        score_threshold: scoreThreshold
      });

      // Форматируем результаты
      const results = searchResult.map(item => ({
        id: item.id.toString(),
        content: item.payload.content,
        score: item.score,
        metadata: {
          title: item.payload.title,
          category: item.payload.category,
          language: item.payload.language,
          tags: item.payload.tags || [],
          ...item.payload.metadata
        }
      }));

      logger.info(`✅ Found ${results.length} relevant documents`);
      return results;
    } catch (error) {
      logger.error('❌ Vector search failed:', error.message);
      
      // В случае ошибки возвращаем пустой массив, чтобы чат продолжал работать
      return [];
    }
  }

  /**
   * Добавляет документы в векторную базу
   * @param {Document[]} documents - Документы для добавления
   * @returns {Promise<string[]>} Массив ID добавленных документов
   */
  async addDocuments(documents) {
    try {
      if (!this.ragEnabled) {
        logger.info(`📚 Adding ${documents.length} documents (stub mode)`);
        return documents.map((_, index) => `stub_${index}`);
      }

      if (!this.initialized || !this.client) {
        throw new Error('Vector store not initialized');
      }

      logger.info(`📚 Adding ${documents.length} documents to vector store`);

      const points = [];
      for (const doc of documents) {
        // Получаем вектор для документа
        const vector = doc.vector || await this.getEmbedding(doc.content);
        
        // Создаем точку для Qdrant
        const point = {
          id: doc.id || this.generateId(),
          vector,
          payload: {
            content: doc.content,
            title: doc.metadata?.title || '',
            category: doc.metadata?.category || 'general',
            language: doc.metadata?.language || 'en',
            tags: doc.metadata?.tags || [],
            created_at: new Date().toISOString(),
            ...doc.metadata
          }
        };
        points.push(point);
      }

      // Добавляем документы батчами
      const batches = this.chunkArray(points, this.config.batchSize);
      const addedIds = [];

      for (const batch of batches) {
        await this.client.upsert(this.collectionName, {
          wait: true,
          points: batch
        });
        addedIds.push(...batch.map(p => p.id.toString()));
      }

      logger.info(`✅ Successfully added ${addedIds.length} documents`);
      return addedIds;
    } catch (error) {
      logger.error('❌ Failed to add documents:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет документ из векторной базы
   * @param {string} documentId - ID документа для удаления
   * @returns {Promise<boolean>} Успешность операции
   */
  async deleteDocument(documentId) {
    try {
      if (!this.ragEnabled) {
        logger.info(`📚 Deleting document ${documentId} (stub mode)`);
        return true;
      }

      if (!this.initialized || !this.client) {
        throw new Error('Vector store not initialized');
      }

      await this.client.delete(this.collectionName, {
        wait: true,
        points: [documentId]
      });

      logger.info(`✅ Document deleted: ${documentId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to delete document ${documentId}:`, error.message);
      return false;
    }
  }

  /**
   * Получает информацию о коллекции
   * @returns {Promise<Object>} Информация о коллекции
   */
  async getCollectionInfo() {
    try {
      if (!this.ragEnabled || !this.initialized || !this.client) {
        return {
          status: 'stub',
          points_count: 0,
          indexed_vectors_count: 0,
          ram_usage_bytes: 0,
          disk_usage_bytes: 0
        };
      }

      const info = await this.client.getCollection(this.collectionName);
      return info;
    } catch (error) {
      logger.error('❌ Failed to get collection info:', error.message);
      throw error;
    }
  }

  /**
   * Проверяет здоровье векторной базы данных
   * @returns {Promise<Object>} Результат проверки здоровья
   */
  async healthCheck() {
    try {
      if (!this.ragEnabled) {
        return {
          status: 'ok',
          message: 'Vector store running in stub mode (RAG disabled)',
          mode: 'stub'
        };
      }

      if (!this.initialized) {
        return {
          status: 'error',
          message: 'Vector store not initialized'
        };
      }

      if (!this.client) {
        return {
          status: 'error',
          message: 'Vector store client not available'
        };
      }

      // Проверяем подключение
      await this.client.getCollections();
      
      // Получаем информацию о коллекции
      const collectionInfo = await this.getCollectionInfo();

      return {
        status: 'ok',
        message: 'Vector store is healthy and responding',
        mode: 'active',
        collection: this.collectionName,
        documents_count: collectionInfo.points_count || 0,
        config: {
          url: this.config.url,
          vectorSize: this.vectorSize
        }
      };
    } catch (error) {
      logger.error('Vector store health check failed:', error.message);
      return {
        status: 'error',
        message: 'Vector store health check failed',
        error: error.message
      };
    }
  }

  /**
   * Получает эмбеддинг для текста через OpenAI API
   * @param {string} text - Текст для векторизации
   * @returns {Promise<number[]>} Вектор эмбеддинга
   */
  async getEmbedding(text) {
    try {
      // Если OpenAI API недоступен, возвращаем случайный вектор
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OPENAI_API_KEY not set, using random vector');
        return Array.from({ length: this.vectorSize }, () => Math.random() - 0.5);
      }

      // Динамический импорт OpenAI
      const { OpenAI } = await import('openai');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        input: text.substring(0, 8192), // Ограничиваем длину текста
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to get embedding:', error.message);
      
      // Fallback: возвращаем случайный вектор
      logger.warn('Using random vector as fallback');
      return Array.from({ length: this.vectorSize }, () => Math.random() - 0.5);
    }
  }

  /**
   * Строит фильтры для поиска
   * @param {string} [language] - Язык для фильтрации
   * @param {Object} [additionalFilters] - Дополнительные фильтры
   * @returns {Array} Массив фильтров для Qdrant
   */
  buildFilters(language, additionalFilters = {}) {
    const filters = [];

    // Фильтр по языку
    if (language) {
      filters.push({
        key: 'language',
        match: { value: language }
      });
    }

    // Дополнительные фильтры
    Object.entries(additionalFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        filters.push({
          key,
          match: { any: value }
        });
      } else {
        filters.push({
          key,
          match: { value }
        });
      }
    });

    return filters;
  }

  /**
   * Разбивает массив на батчи
   * @param {Array} array - Массив для разбивки
   * @param {number} batchSize - Размер батча
   * @returns {Array[]} Массив батчей
   */
  chunkArray(array, batchSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += batchSize) {
      chunks.push(array.slice(i, i + batchSize));
    }
    return chunks;
  }

  /**
   * Генерирует уникальный ID для документа
   * @returns {string} Уникальный ID
   */
  generateId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Проверяет, инициализирован ли сервис
   * @returns {boolean} Статус инициализации
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Получает конфигурацию сервиса
   * @returns {Object} Конфигурация
   */
  getConfig() {
    return {
      ragEnabled: this.ragEnabled,
      initialized: this.initialized,
      collectionName: this.collectionName,
      vectorSize: this.vectorSize,
      url: this.config.url
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new VectorStoreService();