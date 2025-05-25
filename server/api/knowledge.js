/**
 * Knowledge Base API Routes - Enhanced multilingual search with chunking support
 * @file server/api/knowledge.js
 */

const express = require('express');
const router = express.Router();
const KnowledgeDocument = require('../models/knowledge');
const knowledgeService = require('../services/knowledge');
const vectorStoreService = require('../services/vectorStore');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth'); // ИСПРАВЛЕНО: унифицировали middleware

// Middleware to ensure UTF-8 encoding
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/knowledge
 * @desc Get knowledge documents with optional filtering
 * @access Public
 * @param {string} [category] - Filter by category
 * @param {string} [language] - Filter by language
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      language,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    // Use knowledge service for better handling
    const result = await knowledgeService.getDocuments({
      category,
      language,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'RETRIEVAL_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

    logger.info(`Knowledge documents retrieved: ${result.data.length}`);
  } catch (error) {
    logger.error(`Error retrieving knowledge documents: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/search
 * @desc Search knowledge documents by text with enhanced multilingual support and vector search
 * @access Public
 * @param {string} q - Search query
 * @param {string} [language] - Filter by language
 * @param {string} [category] - Filter by category
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 * @param {boolean} [useVectorSearch=true] - Use vector search when available
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q: searchQuery,
      language,
      category,
      tags,
      page = 1,
      limit = 10,
      useVectorSearch = true
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // Use enhanced search service with chunking support
    const result = await knowledgeService.search(searchQuery, {
      language,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit),
      useVectorSearch: useVectorSearch !== 'false'
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'SEARCH_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
      query: searchQuery,
      count: result.count,
      searchType: result.searchType,
      chunkingUsed: result.chunkingUsed || false
    });

    logger.info(`🍄 Knowledge search performed: \"${searchQuery}\" (${result.searchType}) - ${result.count} results, chunking: ${result.chunkingUsed ? 'yes' : 'no'}`);
  } catch (error) {
    logger.error(`Error searching knowledge: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      errorCode: 'SEARCH_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/vector-search
 * @desc Test vector search in Qdrant with different thresholds and chunking info
 * @access Private (Admin only)
 * @param {string} q - Search query
 * @param {number} [threshold=0.4] - Score threshold
 * @param {string} [language] - Filter by language
 */
router.get('/vector-search', requireAdminAuth, async (req, res) => {
  try {
    const {
      q: searchQuery,
      threshold = 0.4,
      language
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // Используем тестовый метод для диагностики поиска с чанкингом
    const result = await vectorStoreService.testSearch(
      searchQuery, 
      parseFloat(threshold),
      language
    );

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'VECTOR_SEARCH_ERROR'
      });
    }

    res.json({
      success: true,
      data: result,
      query: searchQuery,
      threshold: parseFloat(threshold)
    });

    logger.info(`🍄 Vector search test performed: \"${searchQuery}\" with threshold ${threshold}, chunking: ${result.chunkingEnabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    logger.error(`Error testing vector search: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Vector search test failed',
      errorCode: 'VECTOR_SEARCH_ERROR'
    });
  }
});

/**
 * @route POST /api/knowledge/test-search
 * @desc Test RAG search functionality for admin panel with chunking support
 * @access Private (Admin only)
 * @body {string} query - Search query to test
 * @body {number} [limit=5] - Number of results to return
 */
router.post('/test-search', requireAdminAuth, async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    logger.info(`🍄 RAG test search initiated: \"${query}\"`);

    // Используем векторный поиск для тестирования с поддержкой чанкинга
    let results = [];
    let searchType = 'none';
    let chunkingUsed = false;
    
    if (vectorStoreService && typeof vectorStoreService.search === 'function') {
      // Пробуем векторный поиск
      const vectorResults = await vectorStoreService.search(query, { limit });
      
      if (vectorResults && vectorResults.length > 0) {
        results = vectorResults.map(result => {
          // ИСПРАВЛЕНО: правильная проверка чанков
          const isChunk = result.metadata?.id && result.metadata?.id.includes('_chunk_');
          const originalId = result.metadata?.originalId || result.id;
          
          return {
            id: result.id,
            title: result.metadata?.title || 'Без названия',
            content: result.content || '',
            category: result.metadata?.category || 'general',
            language: result.metadata?.language || 'en',
            score: result.score || 0,
            isChunk: isChunk,
            chunkInfo: isChunk ? {
              originalId: originalId,
              chunkIndex: result.metadata?.chunkIndex,
              totalChunks: result.metadata?.totalChunks,
              startPosition: result.metadata?.startPosition,
              endPosition: result.metadata?.endPosition
            } : null,
            // Дополнительная отладочная информация
            debug: {
              metadataId: result.metadata?.id,
              resultId: result.id,
              originalId: originalId,
              hasChunkIndex: result.metadata?.chunkIndex !== undefined
            }
          };
        });
        searchType = 'vector';
        chunkingUsed = results.some(r => r.isChunk);
      }
    }
    
    // Если векторный поиск не дал результатов, используем MongoDB поиск
    if (results.length === 0) {
      logger.info('🍄 Vector search returned no results, falling back to MongoDB search');
      
      const mongoResults = await KnowledgeDocument.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ],
        status: 'published'
      })
      .limit(parseInt(limit))
      .select('title content category language tags')
      .lean();
      
      results = mongoResults.map(doc => ({
        id: doc._id.toString(),
        title: doc.title,
        content: doc.content.substring(0, 500), // Обрезаем для превью
        category: doc.category,
        language: doc.language,
        score: 0.5, // Примерный score для MongoDB результатов
        isChunk: false,
        chunkInfo: null,
        debug: {
          source: 'mongodb'
        }
      }));
      searchType = 'mongodb';
    }

    res.json({
      success: true,
      data: {
        results,
        query,
        totalFound: results.length,
        searchType,
        chunkingUsed,
        chunksFound: results.filter(r => r.isChunk).length,
        documentsFound: results.filter(r => !r.isChunk).length,
        // Дополнительная диагностическая информация
        debug: {
          vectorSearchAttempted: true,
          vectorServiceAvailable: vectorStoreService && typeof vectorStoreService.search === 'function'
        }
      }
    });

    logger.info(`🍄 RAG test search completed: \"${query}\" - ${results.length} results found (${searchType}), chunking: ${chunkingUsed ? 'used' : 'not used'}`);
  } catch (error) {
    logger.error(`Error in RAG test search: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Test search failed',
      errorCode: 'TEST_SEARCH_ERROR',
      details: error.message
    });
  }
});

/**
 * @route GET /api/knowledge/diagnose
 * @desc Diagnose vector store health and configuration with chunking info
 * @access Private (Admin only)
 */
router.get('/diagnose', requireAdminAuth, async (req, res) => {
  try {
    // Проверка векторного хранилища с поддержкой чанкинга
    const vectorStatus = await vectorStoreService.diagnose();
    
    // Информация о хранилище документов
    const docsCount = await KnowledgeDocument.countDocuments();
    
    // Статистика векторного хранилища с чанкингом
    const vectorStats = await vectorStoreService.getStats();

    // Статистика knowledge service с чанкингом
    const knowledgeStats = await knowledgeService.getStats();
    
    res.json({
      success: true,
      vector: vectorStatus,
      mongoDb: {
        documentsCount: docsCount,
        status: docsCount > 0 ? 'ok' : 'warning'
      },
      vectorStats,
      knowledgeService: knowledgeStats,
      timestamp: new Date().toISOString()
    });

    logger.info(`🍄 Vector store diagnostics performed with chunking info`);
  } catch (error) {
    logger.error(`Error performing vector store diagnostics: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Diagnostics failed',
      errorCode: 'DIAGNOSTICS_ERROR',
      details: error.message
    });
  }
});

/**
 * @route POST /api/knowledge/sync-vector-store
 * @desc Синхронизация существующих документов с векторным хранилищем с чанкингом
 * @access Private (Admin only)
 * @body {boolean} [enableChunking=true] - Enable automatic chunking
 * @body {number} [chunkSize=500] - Chunk size in characters
 * @body {number} [overlap=100] - Overlap between chunks
 * @body {boolean} [preserveParagraphs=true] - Preserve paragraph integrity
 */
router.post('/sync-vector-store', requireAdminAuth, async (req, res) => {
  try {
    const {
      enableChunking = true,
      chunkSize = 500,
      overlap = 100,
      preserveParagraphs = true
    } = req.body;

    logger.info(`🍄 Starting vector store synchronization with chunking: ${enableChunking ? 'enabled' : 'disabled'}`);

    // Используем новый метод синхронизации с чанкингом
    const result = await knowledgeService.syncToVectorStore({
      enableChunking,
      chunkSize: parseInt(chunkSize),
      overlap: parseInt(overlap),
      preserveParagraphs
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'SYNC_ERROR'
      });
    }

    res.json({
      success: true,
      message: result.message,
      totalDocuments: result.total,
      processed: result.processed,
      errors: result.errors,
      chunkingUsed: result.chunkingUsed
    });

    logger.info(`🍄 Vector store synchronization completed: ${result.processed}/${result.total} documents, chunking: ${result.chunkingUsed ? 'used' : 'not used'}`);
  } catch (error) {
    logger.error(`🍄 Error synchronizing vector store: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to synchronize vector store',
      errorCode: 'SYNC_ERROR',
      details: error.message
    });
  }
});

/**
 * @route POST /api/knowledge/sync-vector-store-legacy
 * @desc Legacy синхронизация без чанкинга (для совместимости)
 * @access Private (Admin only)
 */
router.post('/sync-vector-store-legacy', requireAdminAuth, async (req, res) => {
  try {
    // Инициализация векторного хранилища
    const initialized = await vectorStoreService.initialize();
    
    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize vector store',
        errorCode: 'INITIALIZATION_ERROR'
      });
    }
    
    // Получаем ВСЕ документы из MongoDB (без фильтра status)
    const documents = await KnowledgeDocument.find({}).lean();
    
    if (documents.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to sync',
        count: 0
      });
    }
    
    logger.info(`🍄 Found ${documents.length} documents to sync with vector store (legacy mode - no chunking)`);

    // Подготавливаем документы для векторного хранилища
    const vectorDocs = documents.map(doc => ({
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
    }));
    
    // Очищаем текущую коллекцию и добавляем все документы заново
    await vectorStoreService.clearCollection();
    logger.info('🍄 Vector collection cleared');
    
    // Добавляем документы пакетами по 10 штук с отключенным чанкингом
    const batchSize = 10;
    let successCount = 0;
    
    for (let i = 0; i < vectorDocs.length; i += batchSize) {
      const batch = vectorDocs.slice(i, i + batchSize);
      const added = await vectorStoreService.addDocuments(batch, { enableChunking: false });
      
      if (added) {
        successCount += batch.length;
      }
      
      logger.info(`🍄 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectorDocs.length / batchSize)}`);
    }
    
    res.json({
      success: true,
      message: 'Vector store synchronized successfully (legacy mode)',
      totalDocuments: documents.length,
      syncedDocuments: successCount,
      chunkingUsed: false
    });
    
    logger.info(`🍄 Legacy vector store synchronization completed: ${successCount}/${documents.length} documents synced without chunking`);
  } catch (error) {
    logger.error(`🍄 Error synchronizing vector store (legacy): ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to synchronize vector store',
      errorCode: 'SYNC_ERROR',
      details: error.message
    });
  }
});

/**
 * @route GET /api/knowledge/stats
 * @desc Get knowledge base statistics for admin dashboard with chunking info
 * @access Private (Admin only)
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    // Получаем расширенную статистику с чанкингом
    const knowledgeStats = await knowledgeService.getStats();

    if (!knowledgeStats.success) {
      // Fallback на старую статистику
      const totalDocs = await KnowledgeDocument.countDocuments();
      const publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
      const draftDocs = await KnowledgeDocument.countDocuments({ status: 'draft' });
      
      // Статистика по языкам
      const languageStats = await KnowledgeDocument.aggregate([
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Статистика по категориям
      const categoryStats = await KnowledgeDocument.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Недавно обновленные документы
      const recentlyUpdated = await KnowledgeDocument.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title category language updatedAt');

      return res.json({
        success: true,
        data: {
          total: totalDocs,
          published: publishedDocs,
          draft: draftDocs,
          byLanguage: languageStats,
          byCategory: categoryStats,
          recentlyUpdated: recentlyUpdated,
          lastUpdated: new Date().toISOString(),
          chunkingEnabled: false
        }
      });
    }

    // Дополнительные традиционные статистики
    const totalDocs = knowledgeStats.mongodb.totalDocuments;
    const publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
    const draftDocs = totalDocs - publishedDocs;

    // Недавно обновленные документы
    const recentlyUpdated = await KnowledgeDocument.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title category language updatedAt');

    res.json({
      success: true,
      data: {
        total: totalDocs,
        published: publishedDocs,
        draft: draftDocs,
        byLanguage: [
          { _id: 'en', count: knowledgeStats.mongodb.languages.en },
          { _id: 'ru', count: knowledgeStats.mongodb.languages.ru },
          { _id: 'es', count: knowledgeStats.mongodb.languages.es }
        ],
        recentlyUpdated: recentlyUpdated,
        lastUpdated: new Date().toISOString(),
        chunkingEnabled: knowledgeStats.chunking?.enabled || false,
        vectorStore: knowledgeStats.vectorStore,
        chunking: knowledgeStats.chunking
      }
    });

    logger.info(`🍄 Knowledge base statistics retrieved with chunking info`);
  } catch (error) {
    logger.error(`🍄 Error retrieving knowledge base statistics: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      errorCode: 'STATS_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/:id
 * @desc Get a specific knowledge document
 * @access Public
 * @param {string} id - Document ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await knowledgeService.getDocumentById(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

    logger.info(`Knowledge document retrieved: ${id}`);
  } catch (error) {
    logger.error(`Error retrieving knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve document',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route POST /api/knowledge
 * @desc Create a new knowledge document with chunking support
 * @access Private (Admin only)
 * @body {string} title - Document title
 * @body {string} content - Document content
 * @body {string} category - Document category
 * @body {string} [language=en] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [authorId] - Author ID
 * @body {boolean} [enableChunking] - Override chunking for this document
 * @body {number} [chunkSize] - Custom chunk size for this document
 * @body {number} [overlap] - Custom overlap for this document
 */
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      language = 'en',
      tags = [],
      authorId,
      enableChunking,
      chunkSize,
      overlap
    } = req.body;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, content, and category are required',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Prepare chunking options if provided
    const chunkingOptions = {};
    if (enableChunking !== undefined) chunkingOptions.enableChunking = enableChunking;
    if (chunkSize !== undefined) chunkingOptions.chunkSize = parseInt(chunkSize);
    if (overlap !== undefined) chunkingOptions.overlap = parseInt(overlap);

    const result = await knowledgeService.addDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      language,
      tags: Array.isArray(tags) ? tags : [],
      authorId: authorId || req.admin.id
    }, chunkingOptions);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'CREATION_ERROR'
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Document created successfully',
      chunkingUsed: result.chunkingUsed
    });

    logger.info(`🍄 Knowledge document created by ${req.admin.username}: ${result.data.id} - \"${title}\", chunking: ${result.chunkingUsed ? 'used' : 'not used'}`);
  } catch (error) {
    logger.error(`Error creating knowledge document: ${error.message}`);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create document',
      errorCode: 'CREATION_ERROR'
    });
  }
});

/**
 * @route PUT /api/knowledge/:id
 * @desc Update a knowledge document with re-chunking support
 * @access Private (Admin only)
 * @param {string} id - Document ID
 * @body {string} [title] - Document title
 * @body {string} [content] - Document content
 * @body {string} [category] - Document category
 * @body {string} [language] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [status] - Document status
 * @body {boolean} [enableChunking] - Override chunking for this document
 * @body {number} [chunkSize] - Custom chunk size for this document
 * @body {number} [overlap] - Custom overlap for this document
 */
router.put('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Extract chunking options
    const chunkingOptions = {};
    if (updateData.enableChunking !== undefined) {
      chunkingOptions.enableChunking = updateData.enableChunking;
      delete updateData.enableChunking;
    }
    if (updateData.chunkSize !== undefined) {
      chunkingOptions.chunkSize = parseInt(updateData.chunkSize);
      delete updateData.chunkSize;
    }
    if (updateData.overlap !== undefined) {
      chunkingOptions.overlap = parseInt(updateData.overlap);
      delete updateData.overlap;
    }

    const result = await knowledgeService.updateDocument(id, updateData, chunkingOptions);

    if (!result.success) {
      const statusCode = result.error === 'Document not found' ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCode: statusCode === 404 ? 'DOCUMENT_NOT_FOUND' : 'UPDATE_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Document updated successfully',
      chunkingUsed: result.chunkingUsed
    });

    logger.info(`🍄 Knowledge document updated by ${req.admin.username}: ${id}, chunking: ${result.chunkingUsed ? 'used' : 'not used'}`);
  } catch (error) {
    logger.error(`Error updating knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update document',
      errorCode: 'UPDATE_ERROR'
    });
  }
});

/**
 * @route DELETE /api/knowledge/:id
 * @desc Delete a knowledge document and all its chunks
 * @access Private (Admin only)
 * @param {string} id - Document ID
 */
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await knowledgeService.deleteDocument(id);

    if (!result.success) {
      const statusCode = result.error === 'Document not found' ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCode: statusCode === 404 ? 'DOCUMENT_NOT_FOUND' : 'DELETION_ERROR'
      });
    }

    res.json({
      success: true,
      message: result.message
    });

    logger.info(`🍄 Knowledge document deleted by ${req.admin.username}: ${id}`);
  } catch (error) {
    logger.error(`Error deleting knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      errorCode: 'DELETION_ERROR'
    });
  }
});

module.exports = router;