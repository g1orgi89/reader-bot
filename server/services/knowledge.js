/**
 * Knowledge Base Service - Enhanced with combined search
 * @file server/services/knowledge.js
 */

const KnowledgeDocument = require('../models/knowledge');
const vectorStoreService = require('./vectorStore');
const logger = require('../utils/logger');

/**
 * @class KnowledgeService
 * @description Service for managing knowledge base with enhanced search
 */
class KnowledgeService {
  /**
   * @constructor
   */
  constructor() {
    this.initialized = false;
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
      logger.info('Knowledge service initialized successfully');
      
      return {
        success: true,
        message: 'Knowledge service initialized',
        type: 'mongodb-enhanced'
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
   * Add a document to the knowledge base
   * @param {Object} docData - Document data
   * @param {string} docData.title - Document title
   * @param {string} docData.content - Document content
   * @param {string} docData.category - Document category
   * @param {string} [docData.language='en'] - Document language
   * @param {string[]} [docData.tags=[]] - Document tags
   * @param {string} [docData.authorId] - Author ID
   * @returns {Promise<Object>} Creation result
   */
  async addDocument(docData) {
    try {
      // Сохраняем в MongoDB
      const document = new KnowledgeDocument(docData);
      await document.save();

      const result = document.toPublicJSON();
      logger.info(`Knowledge document added to MongoDB: ${result.id} - "${result.title}"`);

      // ИСПРАВЛЕНО: Добавляем документ также в векторное хранилище
      try {
        // Инициализируем векторное хранилище, если не инициализировано
        await vectorStoreService.initialize();
        
        // Добавляем документ в векторное хранилище
        await vectorStoreService.addDocuments([{
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
        }]);
        
        logger.info(`Knowledge document added to vector store: ${result.id}`);
      } catch (vectorError) {
        // Если не удалось добавить в векторное хранилище, логируем ошибку, но продолжаем
        logger.error(`Failed to add document to vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Failed to add knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search documents by text query with enhanced multilingual support
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} [options.language] - Filter by language
   * @param {string} [options.category] - Filter by category
   * @param {string[]} [options.tags] - Filter by tags
   * @param {number} [options.limit=10] - Maximum results
   * @param {number} [options.page=1] - Page number
   * @param {boolean} [options.forceRegex=false] - Force regex search for Cyrillic
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
        forceRegex = false
      } = options;

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
        score: doc.score || null
      }));

      logger.logKnowledgeSearch(query, formattedResults.length, searchType);

      return {
        success: true,
        data: formattedResults,
        query,
        count: formattedResults.length,
        searchType
      };
    } catch (error) {
      logger.error('Knowledge search failed:', error);
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
      logger.error('Failed to get knowledge documents:', error);
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
      logger.error('Failed to get knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a document
   * @param {string} documentId - Document ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Update result
   */
  async updateDocument(documentId, updateData) {
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
      logger.info(`Knowledge document updated in MongoDB: ${documentId}`);

      // ИСПРАВЛЕНО: Обновляем документ в векторном хранилище
      try {
        // Обновляем документ в векторном хранилище
        await vectorStoreService.addDocuments([{
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
        }]);
        
        logger.info(`Knowledge document updated in vector store: ${result.id}`);
      } catch (vectorError) {
        logger.error(`Failed to update document in vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Failed to update knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a document
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

      logger.info(`Knowledge document deleted from MongoDB: ${documentId}`);

      // ИСПРАВЛЕНО: Удаляем документ из векторного хранилища
      try {
        await vectorStoreService.deleteDocument(documentId);
        logger.info(`Knowledge document deleted from vector store: ${documentId}`);
      } catch (vectorError) {
        logger.error(`Failed to delete document from vector store: ${vectorError.message}`);
      }

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      logger.error('Failed to delete knowledge document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get relevant context for a query (enhanced search)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} [options.language] - Filter by language
   * @param {number} [options.limit=3] - Maximum context documents
   * @returns {Promise<Object>} Context documents
   */
  async getContextForQuery(query, options = {}) {
    try {
      const { language, limit = 3 } = options;

      // Search for relevant documents
      const searchResult = await this.search(query, {
        language,
        limit,
        page: 1,
        forceRegex: /[а-яё]/i.test(query) // Force regex for Cyrillic
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
        language: doc.language
      }));

      return {
        success: true,
        data: context,
        count: context.length,
        searchType: searchResult.searchType
      };
    } catch (error) {
      logger.error('Failed to get context for query:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get knowledge service health status
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

      return {
        status: 'healthy',
        message: 'Knowledge service is working',
        documentCount: testQuery,
        type: 'mongodb-enhanced'
      };
    } catch (error) {
      logger.error('Knowledge service health check failed:', error);
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new KnowledgeService();