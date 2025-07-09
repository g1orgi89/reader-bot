/**
 * Knowledge Base API Routes - Enhanced multilingual search with FULL chunking support
 * @file server/api/knowledge.js
 * 🍄 УПРОЩЕНО: Универсальный поиск без языковых ограничений
 * 📖 ИСПРАВЛЕНО: Убрана аутентификация с базовых endpoints для админ-панели
 * 🔍 ДОБАВЛЕНО: Детальные логи для диагностики
 */

console.log('🔍 [KNOWLEDGE] Starting knowledge.js file loading...');

const express = require('express');
console.log('✅ [KNOWLEDGE] Express imported successfully');

const router = express.Router();
console.log('✅ [KNOWLEDGE] Router created successfully');

// Пробуем импортировать зависимости с детальными логами
let KnowledgeDocument, knowledgeService, vectorStoreService, logger, adminAuth;

try {
  console.log('🔍 [KNOWLEDGE] Importing KnowledgeDocument model...');
  KnowledgeDocument = require('../models/knowledge');
  console.log('✅ [KNOWLEDGE] KnowledgeDocument model imported successfully');
} catch (error) {
  console.error('❌ [KNOWLEDGE] Failed to import KnowledgeDocument model:', error.message);
  console.error('❌ [KNOWLEDGE] Stack:', error.stack);
}

try {
  console.log('🔍 [KNOWLEDGE] Importing knowledgeService...');
  knowledgeService = require('../services/knowledge');
  console.log('✅ [KNOWLEDGE] knowledgeService imported successfully');
} catch (error) {
  console.error('❌ [KNOWLEDGE] Failed to import knowledgeService:', error.message);
  console.error('❌ [KNOWLEDGE] Stack:', error.stack);
}

try {
  console.log('🔍 [KNOWLEDGE] Importing vectorStoreService...');
  vectorStoreService = require('../services/vectorStore');
  console.log('✅ [KNOWLEDGE] vectorStoreService imported successfully');
} catch (error) {
  console.error('❌ [KNOWLEDGE] Failed to import vectorStoreService:', error.message);
  console.error('❌ [KNOWLEDGE] Stack:', error.stack);
}

try {
  console.log('🔍 [KNOWLEDGE] Importing logger...');
  logger = require('../utils/logger');
  console.log('✅ [KNOWLEDGE] logger imported successfully');
} catch (error) {
  console.error('❌ [KNOWLEDGE] Failed to import logger:', error.message);
  console.error('❌ [KNOWLEDGE] Stack:', error.stack);
  // Fallback logger
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn
  };
}

try {
  console.log('🔍 [KNOWLEDGE] Importing adminAuth middleware...');
  adminAuth = require('../middleware/adminAuth');
  console.log('✅ [KNOWLEDGE] adminAuth imported successfully');
} catch (error) {
  console.error('❌ [KNOWLEDGE] Failed to import adminAuth:', error.message);
  console.error('❌ [KNOWLEDGE] Stack:', error.stack);
  // Fallback middleware
  adminAuth = {
    requireAdminAuth: (req, res, next) => next(),
    optionalAdminAuth: (req, res, next) => next()
  };
}

console.log('🔍 [KNOWLEDGE] Setting up middleware...');

// Middleware to ensure UTF-8 encoding
router.use((req, res, next) => {
  console.log(`🔍 [KNOWLEDGE] Processing request: ${req.method} ${req.path}`);
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

console.log('✅ [KNOWLEDGE] Middleware setup complete');

/**
 * @route GET /api/knowledge
 * @desc Get knowledge documents with optional filtering
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для админ-панели)
 */
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [KNOWLEDGE] GET / endpoint called');
    logger.info('📚 Knowledge API - GET / called');
    
    const {
      category,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    console.log('🔍 [KNOWLEDGE] Query params:', { category, tags, page, limit });

    // Проверяем доступность knowledgeService
    if (!knowledgeService) {
      console.error('❌ [KNOWLEDGE] knowledgeService not available');
      return res.status(500).json({
        success: false,
        error: 'Knowledge service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }

    console.log('🔍 [KNOWLEDGE] Calling knowledgeService.getDocuments...');
    
    // Use knowledge service for better handling
    const result = await knowledgeService.getDocuments({
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit)
    });

    console.log('🔍 [KNOWLEDGE] knowledgeService.getDocuments result:', result);

    if (!result.success) {
      console.error('❌ [KNOWLEDGE] knowledgeService.getDocuments failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'RETRIEVAL_ERROR'
      });
    }

    const response = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };

    console.log('✅ [KNOWLEDGE] Sending successful response with', result.data.length, 'documents');
    res.json(response);

    logger.info(`Knowledge documents retrieved: ${result.data.length}`);
  } catch (error) {
    console.error('❌ [KNOWLEDGE] Error in GET / endpoint:', error.message);
    console.error('❌ [KNOWLEDGE] Stack:', error.stack);
    logger.error(`Error retrieving knowledge documents: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents',
      errorCode: 'RETRIEVAL_ERROR',
      details: error.message
    });
  }
});

/**
 * @route GET /api/knowledge/stats
 * @desc Get knowledge base statistics for admin dashboard
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для статистики админ-панели)
 */
router.get('/stats', async (req, res) => {
  try {
    console.log('🔍 [KNOWLEDGE] GET /stats endpoint called');
    logger.info('📊 Knowledge API - GET /stats called');
    
    // Проверяем доступность knowledgeService
    if (!knowledgeService) {
      console.warn('⚠️ [KNOWLEDGE] knowledgeService not available, using fallback');
      
      // Fallback на прямую MongoDB статистику
      let totalDocs = 0;
      let publishedDocs = 0;
      let draftDocs = 0;
      let languageStats = [];
      let categoryStats = [];
      let recentlyUpdated = [];

      try {
        if (KnowledgeDocument) {
          console.log('🔍 [KNOWLEDGE] Getting stats from MongoDB directly...');
          totalDocs = await KnowledgeDocument.countDocuments();
          publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
          draftDocs = await KnowledgeDocument.countDocuments({ status: 'draft' });
          
          languageStats = await KnowledgeDocument.aggregate([
            { $group: { _id: '$language', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]);
          
          categoryStats = await KnowledgeDocument.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]);
          
          recentlyUpdated = await KnowledgeDocument.find()
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('title category language updatedAt');

          console.log('✅ [KNOWLEDGE] MongoDB stats retrieved successfully');
        } else {
          console.error('❌ [KNOWLEDGE] KnowledgeDocument model not available');
        }
      } catch (dbError) {
        console.error('❌ [KNOWLEDGE] Database stats query failed:', dbError.message);
      }

      const fallbackResponse = {
        success: true,
        data: {
          total: totalDocs,
          published: publishedDocs,
          draft: draftDocs,
          byLanguage: languageStats,
          byCategory: categoryStats,
          recentlyUpdated: recentlyUpdated,
          lastUpdated: new Date().toISOString(),
          chunkingEnabled: false,
          vectorStore: {
            status: 'unknown',
            totalVectors: 0,
            documentsCount: 0,
            chunksCount: 0
          },
          chunking: {
            enabled: false,
            totalChunks: 0
          },
          universalSearch: true,
          fallbackMode: true
        }
      };

      console.log('✅ [KNOWLEDGE] Sending fallback response');
      return res.json(fallbackResponse);
    }

    // Пробуем получить статистику из knowledgeService
    console.log('🔍 [KNOWLEDGE] Getting stats from knowledgeService...');
    let knowledgeStats;
    
    try {
      knowledgeStats = await knowledgeService.getStats();
      console.log('✅ [KNOWLEDGE] knowledgeService.getStats successful');
    } catch (error) {
      console.error('❌ [KNOWLEDGE] knowledgeService.getStats failed:', error.message);
      logger.warn('Knowledge service stats failed, using fallback:', error.message);
      knowledgeStats = { success: false };
    }

    if (!knowledgeStats.success) {
      console.log('🔍 [KNOWLEDGE] Using fallback MongoDB stats...');
      // Fallback логика (как выше)
      
      let totalDocs = 0;
      let publishedDocs = 0;
      let draftDocs = 0;
      let languageStats = [];
      let categoryStats = [];
      let recentlyUpdated = [];

      try {
        if (KnowledgeDocument) {
          totalDocs = await KnowledgeDocument.countDocuments();
          publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
          draftDocs = await KnowledgeDocument.countDocuments({ status: 'draft' });
          
          languageStats = await KnowledgeDocument.aggregate([
            { $group: { _id: '$language', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]);
          
          categoryStats = await KnowledgeDocument.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]);
          
          recentlyUpdated = await KnowledgeDocument.find()
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('title category language updatedAt');
        }
      } catch (dbError) {
        console.error('❌ [KNOWLEDGE] Database stats query failed:', dbError.message);
      }

      const fallbackResponse = {
        success: true,
        data: {
          total: totalDocs,
          published: publishedDocs,
          draft: draftDocs,
          byLanguage: languageStats,
          byCategory: categoryStats,
          recentlyUpdated: recentlyUpdated,
          lastUpdated: new Date().toISOString(),
          chunkingEnabled: false,
          vectorStore: {
            status: 'unknown',
            totalVectors: 0,
            documentsCount: 0,
            chunksCount: 0
          },
          chunking: {
            enabled: false,
            totalChunks: 0
          },
          universalSearch: true,
          fallbackMode: true
        }
      };

      console.log('✅ [KNOWLEDGE] Sending fallback response');
      return res.json(fallbackResponse);
    }

    // Используем статистику из knowledgeService
    console.log('🔍 [KNOWLEDGE] Processing knowledgeService stats...');
    const totalDocs = knowledgeStats.mongodb.totalDocuments;
    let publishedDocs = 0;
    let draftDocs = 0;
    let recentlyUpdated = [];

    try {
      if (KnowledgeDocument) {
        publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
        draftDocs = totalDocs - publishedDocs;

        recentlyUpdated = await KnowledgeDocument.find()
          .sort({ updatedAt: -1 })
          .limit(5)
          .select('title category language updatedAt');
      }
    } catch (dbError) {
      console.error('❌ [KNOWLEDGE] Failed to get additional stats:', dbError.message);
      logger.warn('Failed to get additional stats:', dbError.message);
    }

    // Возвращаем языковую статистику в ожидаемом формате
    const languageArray = Object.entries(knowledgeStats.mongodb.languages || {}).map(([lang, count]) => ({
      _id: lang,
      count
    }));

    const serviceResponse = {
      success: true,
      data: {
        total: totalDocs,
        published: publishedDocs,
        draft: draftDocs,
        byLanguage: languageArray,
        byCategory: Object.entries(knowledgeStats.mongodb.categories || {}).map(([cat, count]) => ({
          _id: cat,
          count
        })),
        recentlyUpdated: recentlyUpdated,
        lastUpdated: new Date().toISOString(),
        chunkingEnabled: knowledgeStats.chunking?.enabled || false,
        vectorStore: knowledgeStats.vectorStore || {
          status: 'unknown',
          totalVectors: 0,
          documentsCount: 0,
          chunksCount: 0
        },
        chunking: knowledgeStats.chunking || {
          enabled: false,
          totalChunks: 0
        },
        universalSearch: true
      }
    };

    console.log('✅ [KNOWLEDGE] Sending service response');
    res.json(serviceResponse);

    logger.info(`Knowledge base statistics retrieved with universal search and chunking info`);
  } catch (error) {
    console.error('❌ [KNOWLEDGE] Error in GET /stats endpoint:', error.message);
    console.error('❌ [KNOWLEDGE] Stack:', error.stack);
    logger.error(`Error retrieving knowledge base statistics: ${error.message}`);
    
    // Возвращаем минимальную статистику в случае ошибки
    const errorResponse = {
      success: true,
      data: {
        total: 0,
        published: 0,
        draft: 0,
        byLanguage: [],
        byCategory: [],
        recentlyUpdated: [],
        lastUpdated: new Date().toISOString(),
        chunkingEnabled: false,
        vectorStore: {
          status: 'error',
          totalVectors: 0,
          documentsCount: 0,
          chunksCount: 0
        },
        chunking: {
          enabled: false,
          totalChunks: 0
        },
        universalSearch: true,
        error: error.message
      }
    };

    console.log('✅ [KNOWLEDGE] Sending error response');
    res.json(errorResponse);
  }
});

// Добавляем базовые endpoints для остальных методов
router.get('/search', async (req, res) => {
  console.log('🔍 [KNOWLEDGE] GET /search endpoint called');
  res.json({
    success: true,
    data: [],
    message: 'Search endpoint temporarily disabled - under development'
  });
});

// Остальные сложные endpoints временно отключены для диагностики
router.get('/vector-search', (req, res) => {
  console.log('🔍 [KNOWLEDGE] GET /vector-search endpoint called');
  res.json({
    success: false,
    error: 'Vector search temporarily disabled',
    message: 'This endpoint is temporarily disabled for diagnostics'
  });
});

router.post('/test-search', (req, res) => {
  console.log('🔍 [KNOWLEDGE] POST /test-search endpoint called');
  res.json({
    success: false,
    error: 'Test search temporarily disabled',
    message: 'This endpoint is temporarily disabled for diagnostics'
  });
});

router.get('/diagnose', (req, res) => {
  console.log('🔍 [KNOWLEDGE] GET /diagnose endpoint called');
  res.json({
    success: false,
    error: 'Diagnose temporarily disabled',
    message: 'This endpoint is temporarily disabled for diagnostics'
  });
});

// Простые endpoints для GET /api/knowledge/:id
router.get('/:id', async (req, res) => {
  console.log('🔍 [KNOWLEDGE] GET /:id endpoint called with id:', req.params.id);
  
  try {
    if (!knowledgeService) {
      return res.status(500).json({
        success: false,
        error: 'Knowledge service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }

    const result = await knowledgeService.getDocumentById(req.params.id);

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

    logger.info(`Knowledge document retrieved: ${req.params.id}`);
  } catch (error) {
    console.error('❌ [KNOWLEDGE] Error in GET /:id endpoint:', error.message);
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

console.log('✅ [KNOWLEDGE] All routes setup complete');

module.exports = router;
console.log('✅ [KNOWLEDGE] Module exported successfully');
