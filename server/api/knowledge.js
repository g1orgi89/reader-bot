/**
 * Knowledge Base API Routes - Enhanced multilingual search
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
 * @desc Search knowledge documents by text with enhanced multilingual support
 * @access Public
 * @param {string} q - Search query
 * @param {string} [language] - Filter by language
 * @param {string} [category] - Filter by category
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q: searchQuery,
      language,
      category,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // Use enhanced search service
    const result = await knowledgeService.search(searchQuery, {
      language,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit)
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
      searchType: result.searchType
    });

    logger.info(`Knowledge search performed: "${searchQuery}" (${result.searchType}) - ${result.count} results`);
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
 * @desc Test vector search in Qdrant with different thresholds
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

    // Используем тестовый метод для диагностики поиска
    const result = await vectorStoreService.testSearch(
      searchQuery, 
      parseFloat(threshold)
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

    logger.info(`Vector search test performed: "${searchQuery}" with threshold ${threshold}`);
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
 * @route GET /api/knowledge/diagnose
 * @desc Diagnose vector store health and configuration
 * @access Private (Admin only)
 */
router.get('/diagnose', requireAdminAuth, async (req, res) => {
  try {
    // Проверка векторного хранилища
    const vectorStatus = await vectorStoreService.diagnose();
    
    // Информация о хранилище документов
    const docsCount = await KnowledgeDocument.countDocuments();
    
    // Статистика векторного хранилища
    const vectorStats = await vectorStoreService.getStats();
    
    res.json({
      success: true,
      vector: vectorStatus,
      mongoDb: {
        documentsCount: docsCount,
        status: docsCount > 0 ? 'ok' : 'warning'
      },
      vectorStats,
      timestamp: new Date().toISOString()
    });

    logger.info(`Vector store diagnostics performed`);
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
 * @desc Синхронизация существующих документов с векторным хранилищем
 * @access Private (Admin only)
 */
router.post('/sync-vector-store', requireAdminAuth, async (req, res) => {
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
    
    // Получаем все документы из MongoDB
    const documents = await KnowledgeDocument.find({ status: 'published' }).lean();
    
    if (documents.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to sync',
        count: 0
      });
    }
    
    logger.info(`Found ${documents.length} documents to sync with vector store`);
    
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
    logger.info('Vector collection cleared');
    
    // Добавляем документы пакетами по 10 штук
    const batchSize = 10;
    let successCount = 0;
    
    for (let i = 0; i < vectorDocs.length; i += batchSize) {
      const batch = vectorDocs.slice(i, i + batchSize);
      const added = await vectorStoreService.addDocuments(batch);
      
      if (added) {
        successCount += batch.length;
      }
      
      logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectorDocs.length / batchSize)}`);
    }
    
    res.json({
      success: true,
      message: 'Vector store synchronized successfully',
      totalDocuments: documents.length,
      syncedDocuments: successCount
    });
    
    logger.info(`Vector store synchronization completed: ${successCount}/${documents.length} documents synced`);
  } catch (error) {
    logger.error(`Error synchronizing vector store: ${error.message}`);
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
 * @desc Get knowledge base statistics for admin dashboard
 * @access Private (Admin only)
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    // Получаем статистику документов
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
    
    res.json({
      success: true,
      data: {
        total: totalDocs,
        published: publishedDocs,
        draft: draftDocs,
        byLanguage: languageStats,
        byCategory: categoryStats,
        recentlyUpdated: recentlyUpdated,
        lastUpdated: new Date().toISOString()
      }
    });

    logger.info(`Knowledge base statistics retrieved`);
  } catch (error) {
    logger.error(`Error retrieving knowledge base statistics: ${error.message}`);
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
 * @desc Create a new knowledge document
 * @access Private (Admin only)
 * @body {string} title - Document title
 * @body {string} content - Document content
 * @body {string} category - Document category
 * @body {string} [language=en] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [authorId] - Author ID
 */
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      language = 'en',
      tags = [],
      authorId
    } = req.body;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, content, and category are required',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await knowledgeService.addDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      language,
      tags: Array.isArray(tags) ? tags : [],
      authorId: authorId || req.admin.id
    });

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
      message: 'Document created successfully'
    });

    logger.info(`Knowledge document created by ${req.admin.username}: ${result.data.id} - "${title}"`);
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
 * @desc Update a knowledge document
 * @access Private (Admin only)
 * @param {string} id - Document ID
 * @body {string} [title] - Document title
 * @body {string} [content] - Document content
 * @body {string} [category] - Document category
 * @body {string} [language] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [status] - Document status
 */
router.put('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await knowledgeService.updateDocument(id, updateData);

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
      message: 'Document updated successfully'
    });

    logger.info(`Knowledge document updated by ${req.admin.username}: ${id}`);
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
 * @desc Delete a knowledge document
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

    logger.info(`Knowledge document deleted by ${req.admin.username}: ${id}`);
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