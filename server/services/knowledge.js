/**
 * Knowledge Base Service - Enhanced with combined search and chunking support
 * @file server/services/knowledge.js
 */

const KnowledgeDocument = require('../models/knowledge');
const vectorStoreService = require('./vectorStore');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ChunkingOptions
 * @property {boolean} [enableChunking=true] - Включить автоматический чанкинг
 * @property {number} [chunkSize=500] - Размер чанка в символах
 * @property {number} [overlap=100] - Перекрытие между чанками
 * @property {number} [minChunkSize=50] - Минимальный размер чанка
 * @property {boolean} [preserveParagraphs=true] - Сохранять целостность параграфов
 */

/**
 * @class KnowledgeService
 * @description Service for managing knowledge base with enhanced search and chunking
 */
class KnowledgeService {
  /**
   * @constructor
   */
  constructor() {
    this.initialized = false;
    
    // Настройки чанкинга по умолчанию для разных типов документов
    this.defaultChunkingOptions = {
      enableChunking: true,
      chunkSize: 500,      // Оптимально для качественных embeddings
      overlap: 100,        // Сохранение контекста между чанками
      minChunkSize: 50,    // Избегаем слишком маленьких чанков
      preserveParagraphs: true  // Сохраняем целостность параграфов
    };
    
    // Специальные настройки чанкинга для разных категорий
    this.categoryChunkingOptions = {
      'user-guide': {
        chunkSize: 600,    // Больше для пошаговых инструкций
        overlap: 150,      // Больше overlap для сохранения последовательности
        preserveParagraphs: true
      },
      'technical': {
        chunkSize: 800,    // Больше для технической документации
        overlap: 200,      // Больше overlap для технических терминов
        preserveParagraphs: true
      },
      'troubleshooting': {
        chunkSize: 400,    // Меньше для быстрого поиска решений
        overlap: 100,
        preserveParagraphs: true
      },
      'tokenomics': {
        chunkSize: 500,    // Стандартный размер
        overlap: 100,
        preserveParagraphs: true
      }
    };
  }

  /**
   * Initialize the knowledge service
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      // Check if MongoDB text index exists
      const indexes = await KnowledgeDocument.collection.getIndexes();
      const hasTextIndex = Object.keys(indexes).some(indexName => 
        indexName.includes('text') || indexName === 'knowledge_text_search'
      );

      if (!hasTextIndex) {
        logger.info('Creating text search index for knowledge documents...');
        await KnowledgeDocument.collection.createIndex(
          { 
            title: 'text', 
            content: 'text',
            tags: 'text'
          },
          {
            weights: {
              title: 10,
              content: 5,
              tags: 3
            },
            name: 'knowledge_text_search',
            default_language: 'none', // Support all languages
            language_override: 'language'
          }
        );
        logger.info('Text search index created successfully');
      }

      this.initialized = true;
      logger.info('🍄 Knowledge service initialized successfully with chunking support');
      logger.info(`🍄 Default chunking options: ${JSON.stringify(this.defaultChunkingOptions)}`);
      
      return {
        success: true,
        message: 'Knowledge service initialized with chunking support',
        type: 'mongodb-enhanced-chunking',
        chunkingEnabled: this.defaultChunkingOptions.enableChunking
      };
    } catch (error) {
      logger.error('Knowledge service initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получает оптимальные настройки чанкинга для документа
   * @private
   * @param {string} category - Категория документа
   * @param {string} content - Содержимое документа
   * @param {ChunkingOptions} [userOptions={}] - Пользовательские настройки
   * @returns {ChunkingOptions} Оптимизированные настройки чанкинга
   */
  _getOptimalChunkingOptions(category, content, userOptions = {}) {
    // Базовые настройки по категории
    const categoryOptions = this.categoryChunkingOptions[category] || {};
    
    // Адаптация настроек в зависимости от размера документа
    const contentLength = content?.length || 0;
    let adaptiveOptions = {};
    
    if (contentLength < 1000) {
      // Маленькие документы - отключаем чанкинг
      adaptiveOptions = { enableChunking: false };
    } else if (contentLength < 2000) {
      // Средние документы - маленькие чанки
      adaptiveOptions = { chunkSize: 400, overlap: 80 };
    } else if (contentLength > 10000) {
      // Большие документы - большие чанки
      adaptiveOptions = { chunkSize: 600, overlap: 150 };
    }
    
    // Объединяем все настройки с приоритетом пользовательских
    const finalOptions = {
      ...this.defaultChunkingOptions,
      ...categoryOptions,
      ...adaptiveOptions,
      ...userOptions
    };
    
    logger.debug(`🍄 Chunking options for category '${category}' (${contentLength} chars): ${JSON.stringify(finalOptions)}`);
    
    return finalOptions;
  }

  /**
   * Add a document to the knowledge base with optimized chunking
   * @param {Object} docData - Document data
   * @param {string} docData.title - Document title
   * @param {string} docData.content - Document content
   * @param {string} docData.category - Document category
   * @param {string} [docData.language='en'] - Document language
   * @param {string[]} [docData.tags=[]] - Document tags
   * @param {string} [docData.authorId] - Author ID
   * @param {ChunkingOptions} [chunkingOptions={}] - Custom chunking options
   * @returns {Promise<Object>} Creation result
   */
  async addDocument(docData, chunkingOptions = {}) {
    try {
      // Сохраняем в MongoDB
      const document = new KnowledgeDocument(docData);
      await document.save();

      const result = document.toPublicJSON();
      logger.info(`🍄 Knowledge document added to MongoDB: ${result.id} - "${result.title}"`);

      // Добавляем документ также в векторное хранилище с чанкингом
      try {
        // Инициализируем векторное хранилище, если не инициализировано
        await vectorStoreService.initialize();
        
        // Определяем оптимальные настройки чанкинга
        const optimalChunkingOptions = this._getOptimalChunkingOptions(
          result.category, 
          result.content, 
          chunkingOptions
        );
        
        logger.info(`🍄 Adding document to vector store with chunking: ${optimalChunkingOptions.enableChunking ? 'enabled' : 'disabled'}`);
        
        // Добавляем документ в векторное хранилище
        const vectorSuccess = await vectorStoreService.addDocuments([{
          id: result.id,
          content: result.content,
          metadata: {
            title: result.title,
            category: result.category,
            language: result.language,
            tags: result.tags || [],
            authorId: result.authorId || docData.authorId,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
          }
        }], optimalChunkingOptions);
        
        if (vectorSuccess) {
          logger.info(`🍄 Knowledge document successfully vectorized: ${result.id}`);
        } else {
          logger.warn(`🍄 Failed to vectorize document: ${result.id}`);
        }
      } catch (vectorError) {
        // Если не удалось добавить в векторное хранилище, логируем ошибку, но продолжаем
        logger.error(`🍄 Failed to add document to vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        data: result,
        chunkingUsed: chunkingOptions.enableChunking !== false
      };
    } catch (error) {
      logger.error('🍄 Failed to add knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search documents by text query with enhanced multilingual support and FULL chunking support
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} [options.language] - Filter by language
   * @param {string} [options.category] - Filter by category
   * @param {string[]} [options.tags] - Filter by tags
   * @param {number} [options.limit=10] - Maximum results
   * @param {number} [options.page=1] - Page number
   * @param {boolean} [options.forceRegex=false] - Force regex search for Cyrillic
   * @param {boolean} [options.useVectorSearch=true] - Use vector search when available
   * @param {boolean} [options.returnChunks=false] - Return individual chunks instead of grouped documents (🍄 НОВОЕ!)
   * @param {number} [options.score_threshold] - Custom relevance threshold
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    try {
      const {
        language,
        category,
        tags = [],
        limit = 10,
        page = 1,
        forceRegex = false,
        useVectorSearch = true,
        returnChunks = false,  // 🍄 НОВЫЙ ПАРАМЕТР
        score_threshold
      } = options;

      // Попробуем сначала векторный поиск, если доступен
      if (useVectorSearch) {
        try {
          // 🍄 ИСПРАВЛЕНО: Передаем returnChunks в vectorStoreService
          const vectorSearchOptions = {
            language,
            category,
            tags,
            limit,
            returnChunks  // 🍄 ВАЖНО: передаем returnChunks дальше
          };

          // Передаем score_threshold если указан
          if (score_threshold !== undefined) {
            vectorSearchOptions.score_threshold = score_threshold;
          }

          const vectorResults = await vectorStoreService.search(query, vectorSearchOptions);
          
          if (vectorResults && vectorResults.length > 0) {
            logger.info(`🍄 Vector search found ${vectorResults.length} results for: "${query.substring(0, 50)}..."`);
            
            // 🍄 УЛУЧШЕНО: Правильное форматирование результатов с поддержкой returnChunks
            const formattedResults = vectorResults.map(doc => ({
              id: doc.id,
              title: doc.metadata?.title || '',
              content: doc.content,
              category: doc.metadata?.category || '',
              language: doc.metadata?.language || 'en',
              tags: doc.metadata?.tags || [],
              createdAt: doc.metadata?.createdAt,
              updatedAt: doc.metadata?.updatedAt,
              score: doc.score,
              // 🍄 НОВОЕ: добавляем информацию о чанках если returnChunks=true
              isChunk: doc.isChunk || false,
              chunkInfo: doc.chunkInfo || null
            }));

            // 🍄 НОВОЕ: Определяем, использовался ли чанкинг
            const chunkingUsed = formattedResults.some(result => result.isChunk);

            return {
              success: true,
              data: formattedResults,
              query,
              count: formattedResults.length,
              searchType: 'vector',
              chunkingUsed,  // 🍄 ДОБАВЛЕНО: информация об использовании чанкинга
              returnChunks   // 🍄 ДОБАВЛЕНО: подтверждение режима
            };
          }
        } catch (vectorError) {
          logger.warn(`🍄 Vector search failed, falling back to MongoDB: ${vectorError.message}`);
        }
      }

      // Fallback на MongoDB поиск
      // Check if query contains Cyrillic characters
      const hasCyrillic = /[а-яё]/i.test(query);
      
      let results;
      let searchType = 'text';

      // Use regex search for Cyrillic text or if explicitly requested
      if (hasCyrillic || forceRegex) {
        searchType = 'regex';
        results = await KnowledgeDocument.searchRegex(query, {
          language,
          category,
          tags,
          limit,
          page
        });
      } else {
        // Try combined search (text search with regex fallback)
        results = await KnowledgeDocument.combinedSearch(query, {
          language,
          category,
          tags,
          limit,
          page
        });
        
        // If results came from regex fallback, update search type
        if (results.length > 0 && !results[0].score) {
          searchType = 'regex';
        }
      }

      const formattedResults = results.map(doc => ({
        ...doc.toPublicJSON(),
        score: doc.score || null,
        // 🍄 НОВОЕ: MongoDB результаты никогда не являются чанками
        isChunk: false,
        chunkInfo: null
      }));

      logger.logKnowledgeSearch(query, formattedResults.length, searchType);

      return {
        success: true,
        data: formattedResults,
        query,
        count: formattedResults.length,
        searchType,
        chunkingUsed: false,  // 🍄 ДОБАВЛЕНО: MongoDB поиск не использует чанкинг
        returnChunks         // 🍄 ДОБАВЛЕНО: подтверждение режима
      };
    } catch (error) {
      logger.error('🍄 Knowledge search failed:', error);
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  /**
   * Get documents with filter options
   * @param {Object} filters - Filter options
   * @param {string} [filters.category] - Filter by category
   * @param {string} [filters.language] - Filter by language
   * @param {string[]} [filters.tags] - Filter by tags
   * @param {number} [filters.limit=10] - Maximum results
   * @param {number} [filters.page=1] - Page number
   * @returns {Promise<Object>} Filtered documents
   */
  async getDocuments(filters = {}) {
    try {
      const {
        category,
        language,
        tags,
        limit = 10,
        page = 1
      } = filters;

      // Build query
      const query = { status: 'published' };
      if (category) query.category = category;
      if (language) query.language = language;
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [documents, totalCount] = await Promise.all([
        KnowledgeDocument.find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        KnowledgeDocument.countDocuments(query)
      ]);

      const formattedDocs = documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        language: doc.language,
        tags: doc.tags || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }));

      return {
        success: true,
        data: formattedDocs,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('🍄 Failed to get knowledge documents:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a specific document by ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Document data
   */
  async getDocumentById(documentId) {
    try {
      const document = await KnowledgeDocument.findById(documentId).lean();

      if (!document || document.status !== 'published') {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      const result = {
        id: document._id,
        title: document.title,
        content: document.content,
        category: document.category,
        language: document.language,
        tags: document.tags || [],
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('🍄 Failed to get knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a document with re-chunking support
   * @param {string} documentId - Document ID
   * @param {Object} updateData - Data to update
   * @param {ChunkingOptions} [chunkingOptions={}] - Custom chunking options for re-vectorization
   * @returns {Promise<Object>} Update result
   */
  async updateDocument(documentId, updateData, chunkingOptions = {}) {
    try {
      // Remove fields that shouldn't be updated
      const cleanedData = { ...updateData };
      delete cleanedData._id;
      delete cleanedData.createdAt;
      delete cleanedData.authorId;

      const document = await KnowledgeDocument.findByIdAndUpdate(
        documentId,
        cleanedData,
        { new: true, runValidators: true }
      );

      if (!document) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      const result = document.toPublicJSON();
      logger.info(`🍄 Knowledge document updated in MongoDB: ${documentId}`);

      // Обновляем документ в векторном хранилище с новым чанкингом
      try {
        // Определяем оптимальные настройки чанкинга для обновленного документа
        const optimalChunkingOptions = this._getOptimalChunkingOptions(
          result.category, 
          result.content, 
          chunkingOptions
        );
        
        logger.info(`🍄 Re-vectorizing document with chunking: ${optimalChunkingOptions.enableChunking ? 'enabled' : 'disabled'}`);
        
        // Обновляем документ в векторном хранилище (addDocuments заменит существующие чанки)
        const vectorSuccess = await vectorStoreService.addDocuments([{
          id: result.id,
          content: result.content,
          metadata: {
            title: result.title,
            category: result.category,
            language: result.language,
            tags: result.tags || [],
            authorId: result.authorId,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
          }
        }], optimalChunkingOptions);
        
        if (vectorSuccess) {
          logger.info(`🍄 Knowledge document successfully re-vectorized: ${result.id}`);
        } else {
          logger.warn(`🍄 Failed to re-vectorize document: ${result.id}`);
        }
      } catch (vectorError) {
        logger.error(`🍄 Failed to update document in vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        data: result,
        chunkingUsed: chunkingOptions.enableChunking !== false
      };
    } catch (error) {
      logger.error('🍄 Failed to update knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a document and all its chunks
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDocument(documentId) {
    try {
      const document = await KnowledgeDocument.findByIdAndDelete(documentId);

      if (!document) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      logger.info(`🍄 Knowledge document deleted from MongoDB: ${documentId}`);

      // Удаляем документ и все его чанки из векторного хранилища
      try {
        const vectorSuccess = await vectorStoreService.deleteDocument(documentId);
        if (vectorSuccess) {
          logger.info(`🍄 Knowledge document and chunks deleted from vector store: ${documentId}`);
        } else {
          logger.warn(`🍄 Failed to delete some chunks from vector store: ${documentId}`);
        }
      } catch (vectorError) {
        logger.error(`🍄 Failed to delete document from vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        message: 'Document and all chunks deleted successfully'
      };
    } catch (error) {
      logger.error('🍄 Failed to delete knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get relevant context for a query using vector search with chunking
   * 🍄 ИСПРАВЛЕНО: Теперь правильно использует returnChunks=true для получения отдельных чанков
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} [options.language] - Filter by language
   * @param {number} [options.limit=3] - Maximum context documents/chunks
   * @param {boolean} [options.useVectorSearch=true] - Use vector search when available
   * @param {boolean} [options.returnChunks=true] - Return individual chunks for better context (🍄 НОВОЕ!)
   * @returns {Promise<Object>} Context documents/chunks
   */
  async getContextForQuery(query, options = {}) {
    try {
      const { 
        language, 
        limit = 3, 
        useVectorSearch = true,
        returnChunks = true  // 🍄 ИСПРАВЛЕНО: По умолчанию возвращаем чанки для лучшего контекста
      } = options;

      // 🍄 ИСПРАВЛЕНО: Сначала пробуем векторный поиск для лучшей релевантности с чанкингом
      if (useVectorSearch) {
        try {
          logger.info(`🍄 Searching context with chunking mode: ${returnChunks ? 'individual chunks' : 'grouped documents'}`);
          
          // 🍄 ИСПРАВЛЕНО: Теперь передаем returnChunks=true для получения отдельных чанков!
          const vectorResults = await vectorStoreService.search(query, {
            language,
            limit: returnChunks ? limit * 2 : limit,  // Ищем больше чанков если нужны отдельные чанки
            returnChunks  // 🍄 КРИТИЧЕСКИ ВАЖНО: теперь передаем этот параметр!
          });
          
          if (vectorResults && vectorResults.length > 0) {
            // Форматируем контекст из векторных результатов
            const context = vectorResults
              .slice(0, limit)  // Берем только нужное количество
              .map(doc => ({
                title: doc.metadata?.title || 'Untitled',
                content: doc.content,
                category: doc.metadata?.category || '',
                score: doc.score,
                language: doc.metadata?.language || language,
                source: 'vector',
                // 🍄 НОВОЕ: Добавляем информацию о чанкинге в контекст
                isChunk: doc.isChunk || false,
                chunkInfo: doc.chunkInfo || null
              }));

            const chunkingUsed = context.some(ctx => ctx.isChunk);
            const chunkCount = context.filter(ctx => ctx.isChunk).length;
            
            logger.info(`🍄 Vector search provided ${context.length} context items (${chunkCount} chunks, ${context.length - chunkCount} documents) with chunking`);

            return {
              success: true,
              data: context,
              count: context.length,
              searchType: 'vector',
              chunkingUsed,
              chunksReturned: chunkCount,
              documentsReturned: context.length - chunkCount,
              returnChunks
            };
          }
        } catch (vectorError) {
          logger.warn(`🍄 Vector context search failed, falling back to MongoDB: ${vectorError.message}`);
        }
      }

      // Fallback на обычный поиск (MongoDB)
      logger.info(`🍄 Using MongoDB fallback for context search`);
      
      const searchResult = await this.search(query, {
        language,
        limit,
        page: 1,
        forceRegex: /[а-яё]/i.test(query), // Force regex for Cyrillic
        useVectorSearch: false, // Избегаем рекурсии
        returnChunks: false     // MongoDB не поддерживает чанкинг
      });

      if (!searchResult.success) {
        return {
          success: false,
          error: searchResult.error
        };
      }

      // Format context
      const context = searchResult.data.map(doc => ({
        title: doc.title,
        content: doc.content,
        category: doc.category,
        score: doc.score,
        language: doc.language,
        source: 'mongodb',
        isChunk: false,
        chunkInfo: null
      }));

      return {
        success: true,
        data: context,
        count: context.length,
        searchType: searchResult.searchType,
        chunkingUsed: false,
        chunksReturned: 0,
        documentsReturned: context.length,
        returnChunks: false
      };
    } catch (error) {
      logger.error('🍄 Failed to get context for query:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Synchronize all documents to vector store with chunking
   * @param {ChunkingOptions} [globalChunkingOptions={}] - Global chunking options
   * @returns {Promise<Object>} Synchronization result
   */
  async syncToVectorStore(globalChunkingOptions = {}) {
    try {
      logger.info('🍄 Starting full synchronization to vector store with chunking...');
      
      // Get all published documents
      const allDocuments = await KnowledgeDocument.find({ status: 'published' }).lean();
      
      if (allDocuments.length === 0) {
        return {
          success: true,
          message: 'No documents to synchronize',
          processed: 0,
          errors: 0
        };
      }

      logger.info(`🍄 Found ${allDocuments.length} documents to synchronize`);
      
      // Clear existing collection to avoid duplicates
      await vectorStoreService.clearCollection();
      
      let processed = 0;
      let errors = 0;
      const batchSize = 5; // Process in small batches to avoid overwhelming the system
      
      // Process documents in batches
      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize);
        
        for (const doc of batch) {
          try {
            // Determine optimal chunking options for each document
            const optimalChunkingOptions = this._getOptimalChunkingOptions(
              doc.category, 
              doc.content, 
              globalChunkingOptions
            );
            
            const vectorSuccess = await vectorStoreService.addDocuments([{
              id: doc._id.toString(),
              content: doc.content,
              metadata: {
                title: doc.title,
                category: doc.category,
                language: doc.language,
                tags: doc.tags || [],
                authorId: doc.authorId,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt
              }
            }], optimalChunkingOptions);
            
            if (vectorSuccess) {
              processed++;
              logger.debug(`🍄 Synced document: ${doc._id} - "${doc.title}"`);
            } else {
              errors++;
              logger.warn(`🍄 Failed to sync document: ${doc._id}`);
            }
          } catch (docError) {
            errors++;
            logger.error(`🍄 Error syncing document ${doc._id}: ${docError.message}`);
          }
        }
        
        // Small delay between batches to prevent overwhelming
        if (i + batchSize < allDocuments.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logger.info(`🍄 Synchronization completed: ${processed} processed, ${errors} errors`);
      
      return {
        success: true,
        message: `Synchronization completed with chunking`,
        processed,
        errors,
        total: allDocuments.length,
        chunkingUsed: globalChunkingOptions.enableChunking !== false
      };
    } catch (error) {
      logger.error('🍄 Full synchronization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get knowledge service health status with chunking info
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'unhealthy',
          message: 'Knowledge service not initialized'
        };
      }

      // Check if we can query documents
      const testQuery = await KnowledgeDocument.countDocuments({ status: 'published' });

      // Check vector store health
      let vectorStoreHealth = { status: 'unknown' };
      try {
        vectorStoreHealth = await vectorStoreService.healthCheck();
      } catch (vectorError) {
        vectorStoreHealth = {
          status: 'error',
          message: vectorError.message
        };
      }

      return {
        status: 'healthy',
        message: 'Knowledge service is working with chunking support',
        documentCount: testQuery,
        type: 'mongodb-enhanced-chunking',
        vectorStore: vectorStoreHealth,
        chunkingEnabled: this.defaultChunkingOptions.enableChunking,
        categoryOptions: Object.keys(this.categoryChunkingOptions)
      };
    } catch (error) {
      logger.error('🍄 Knowledge service health check failed:', error);
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  /**
   * Get detailed statistics including chunking info
   * @returns {Promise<Object>} Detailed statistics
   */
  async getStats() {
    try {
      // MongoDB statistics
      const mongoStats = await Promise.all([
        KnowledgeDocument.countDocuments({ status: 'published' }),
        KnowledgeDocument.countDocuments({ status: 'published', language: 'en' }),
        KnowledgeDocument.countDocuments({ status: 'published', language: 'ru' }),
        KnowledgeDocument.countDocuments({ status: 'published', language: 'es' })
      ]);

      // Vector store statistics
      let vectorStats = { status: 'unknown', chunksCount: 0, documentsCount: 0 };
      try {
        vectorStats = await vectorStoreService.getStats();
      } catch (vectorError) {
        logger.warn(`🍄 Could not get vector store stats: ${vectorError.message}`);
      }

      return {
        success: true,
        mongodb: {
          totalDocuments: mongoStats[0],
          languages: {
            en: mongoStats[1],
            ru: mongoStats[2],
            es: mongoStats[3]
          }
        },
        vectorStore: vectorStats,
        chunking: {
          enabled: this.defaultChunkingOptions.enableChunking,
          defaultOptions: this.defaultChunkingOptions,
          categoryOptions: this.categoryChunkingOptions,
          averageChunksPerDocument: vectorStats.documentsCount > 0 
            ? Math.round(vectorStats.chunksCount / vectorStats.documentsCount) 
            : 0
        }
      };
    } catch (error) {
      logger.error('🍄 Failed to get knowledge service stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new KnowledgeService();