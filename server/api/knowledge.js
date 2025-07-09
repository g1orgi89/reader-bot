/**
 * Knowledge Base API Routes - Enhanced multilingual search with FULL chunking support
 * @file server/api/knowledge.js
 * 🍄 УПРОЩЕНО: Универсальный поиск без языковых ограничений
 * 📖 ИСПРАВЛЕНО: Убрана аутентификация с базовых endpoints для админ-панели
 */

const express = require('express');
const router = express.Router();
const KnowledgeDocument = require('../models/knowledge');
const knowledgeService = require('../services/knowledge');
const vectorStoreService = require('../services/vectorStore');
const logger = require('../utils/logger');
const { requireAdminAuth, optionalAdminAuth } = require('../middleware/adminAuth');

// Middleware to ensure UTF-8 encoding
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/knowledge
 * @desc Get knowledge documents with optional filtering
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для админ-панели)
 * @param {string} [category] - Filter by category
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 * 🍄 УПРОЩЕНО: Убран language фильтр
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    // Use knowledge service for better handling
    const result = await knowledgeService.getDocuments({
      category,
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
 * @desc Search knowledge documents by text with FULL chunking support
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для поиска)
 * @param {string} q - Search query
 * @param {string} [category] - Filter by category
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 * @param {boolean} [useVectorSearch=true] - Use vector search when available
 * @param {boolean} [returnChunks=false] - Return individual chunks instead of grouped documents
 * @param {number} [score_threshold] - Custom relevance threshold
 * 🍄 УПРОЩЕНО: Убран language фильтр
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q: searchQuery,
      category,
      tags,
      page = 1,
      limit = 10,
      useVectorSearch = true,
      returnChunks = false,
      score_threshold
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // 🍄 УПРОЩЕНО: Убрали language из опций поиска
    const searchOptions = {
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit),
      useVectorSearch: useVectorSearch !== 'false',
      returnChunks: returnChunks === 'true'
    };

    // 🍄 НОВОЕ: Передача custom threshold если указан
    if (score_threshold !== undefined) {
      searchOptions.score_threshold = parseFloat(score_threshold);
    }

    // Use enhanced search service with FULL chunking support
    const result = await knowledgeService.search(searchQuery, searchOptions);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'SEARCH_ERROR'
      });
    }

    // 🍄 УЛУЧШЕНО: Расширенная информация о результатах поиска
    const responseData = {
      success: true,
      data: result.data,
      query: searchQuery,
      count: result.count,
      searchType: result.searchType,
      chunkingUsed: result.chunkingUsed || false,
      returnChunks: returnChunks === 'true'
    };

    // 🍄 НОВОЕ: Добавляем статистику чанков если returnChunks=true
    if (returnChunks === 'true' && result.chunkingUsed) {
      const chunksCount = result.data.filter(item => item.isChunk).length;
      const documentsCount = new Set(result.data.map(item => item.chunkInfo?.originalId || item.id)).size;
      
      responseData.chunkStats = {
        totalResults: result.data.length,
        chunks: chunksCount,
        documents: documentsCount,
        averageScore: result.data.length > 0 ? 
          (result.data.reduce((sum, item) => sum + (item.score || 0), 0) / result.data.length).toFixed(4) : 0
      };
    }

    res.json(responseData);

    logger.info(`🍄 Knowledge search: "${searchQuery}" (${result.searchType}) - ${result.count} results, chunking: ${result.chunkingUsed ? 'yes' : 'no'}, returnChunks: ${returnChunks === 'true' ? 'yes' : 'no'}`);
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
 * @route GET /api/knowledge/stats
 * @desc Get knowledge base statistics for admin dashboard with chunking info
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для статистики админ-панели)
 */
router.get('/stats', async (req, res) => {
  try {
    // 📖 БЫСТРОЕ РЕШЕНИЕ: Сначала пробуем получить статистику из knowledgeService
    let knowledgeStats;
    try {
      knowledgeStats = await knowledgeService.getStats();
    } catch (error) {
      logger.warn('Knowledge service stats failed, using fallback:', error.message);
      knowledgeStats = { success: false };
    }

    if (!knowledgeStats.success) {
      // Fallback на прямую MongoDB статистику
      logger.info('Using fallback stats from MongoDB...');
      
      let totalDocs = 0;
      let publishedDocs = 0;
      let draftDocs = 0;
      let languageStats = [];
      let categoryStats = [];
      let recentlyUpdated = [];

      try {
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

      } catch (dbError) {
        logger.error('Database stats query failed:', dbError.message);
        // Возвращаем пустую статистику в случае ошибки
      }

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
      });
    }

    // Используем статистику из knowledgeService
    const totalDocs = knowledgeStats.mongodb.totalDocuments;
    let publishedDocs = 0;
    let draftDocs = 0;
    let recentlyUpdated = [];

    try {
      publishedDocs = await KnowledgeDocument.countDocuments({ status: 'published' });
      draftDocs = totalDocs - publishedDocs;

      recentlyUpdated = await KnowledgeDocument.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title category language updatedAt');
    } catch (dbError) {
      logger.warn('Failed to get additional stats:', dbError.message);
    }

    // 🍄 УПРОЩЕНО: Возвращаем языковую статистику в ожидаемом формате
    const languageArray = Object.entries(knowledgeStats.mongodb.languages || {}).map(([lang, count]) => ({
      _id: lang,
      count
    }));

    res.json({
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
        universalSearch: true // 🍄 НОВОЕ: индикатор универсального поиска
      }
    });

    logger.info(`🍄 Knowledge base statistics retrieved with universal search and chunking info`);
  } catch (error) {
    logger.error(`🍄 Error retrieving knowledge base statistics: ${error.message}`);
    
    // Возвращаем минимальную статистику в случае ошибки
    res.json({
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
    });
  }
});

/**
 * @route GET /api/knowledge/vector-search
 * @desc Test vector search in Qdrant with FULL chunking analysis
 * @access Private (Admin only)
 * @param {string} q - Search query
 * @param {number} [threshold=0.7] - Score threshold (now universal)
 * @param {boolean} [returnChunks=false] - Return individual chunks for analysis
 * @param {number} [limit=10] - Number of results
 * 🍄 УПРОЩЕНО: Убран language фильтр
 */
router.get('/vector-search', requireAdminAuth, async (req, res) => {
  try {
    const {
      q: searchQuery,
      threshold = 0.7, // 🍄 ИЗМЕНЕНО: универсальный порог по умолчанию
      returnChunks = false,
      limit = 10
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // 🍄 УПРОЩЕНО: Убрали language из поиска
    const searchResults = await vectorStoreService.search(searchQuery, {
      limit: parseInt(limit),
      score_threshold: parseFloat(threshold),
      returnChunks: returnChunks === 'true'
    });

    // 🍄 УПРОЩЕНО: Тестируем разные пороги без language
    const testResult = await vectorStoreService.testSearch(
      searchQuery, 
      parseFloat(threshold)
    );

    // 🍄 УЛУЧШЕНО: Расширенная статистика результатов
    const responseData = {
      success: true,
      query: searchQuery,
      threshold: parseFloat(threshold),
      universalSearch: true, // 🍄 НОВОЕ: индикатор универсального поиска
      returnChunks: returnChunks === 'true',
      results: searchResults,
      resultCount: searchResults.length,
      testAnalysis: testResult
    };

    // 🍄 НОВОЕ: Анализ чанков если returnChunks=true
    if (returnChunks === 'true') {
      const chunkAnalysis = {
        totalResults: searchResults.length,
        chunks: searchResults.filter(r => r.isChunk).length,
        documents: searchResults.filter(r => !r.isChunk).length,
        chunkDetails: searchResults
          .filter(r => r.isChunk)
          .map(r => ({
            id: r.id,
            originalId: r.chunkInfo?.originalId,
            chunkIndex: r.chunkInfo?.chunkIndex,
            totalChunks: r.chunkInfo?.totalChunks,
            score: r.score,
            contentLength: r.content?.length || 0
          })),
        scoreDistribution: {
          high: searchResults.filter(r => r.score >= 0.8).length,
          medium: searchResults.filter(r => r.score >= 0.6 && r.score < 0.8).length,
          low: searchResults.filter(r => r.score < 0.6).length
        }
      };
      responseData.chunkAnalysis = chunkAnalysis;
    }

    res.json(responseData);

    logger.info(`🍄 Universal vector search test: "${searchQuery}" threshold=${threshold}, returnChunks=${returnChunks === 'true'}, results=${searchResults.length}`);
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
 * @desc Test RAG search functionality with FULL chunking support
 * @access Private (Admin only)
 * @body {string} query - Search query to test
 * @body {number} [limit=5] - Number of results to return
 * @body {boolean} [returnChunks=false] - Return individual chunks for detailed analysis
 * @body {number} [score_threshold] - Custom relevance threshold
 * 🍄 УПРОЩЕНО: Убран language фильтр
 */
router.post('/test-search', requireAdminAuth, async (req, res) => {
  try {
    const { 
      query, 
      limit = 5, 
      returnChunks = false, 
      score_threshold
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    logger.info(`🍄 RAG test search initiated: "${query}" with returnChunks=${returnChunks}`);

    // 🍄 УПРОЩЕНО: Убрали language из опций поиска
    const searchOptions = {
      limit: parseInt(limit),
      returnChunks: Boolean(returnChunks)
    };

    if (score_threshold !== undefined) {
      searchOptions.score_threshold = parseFloat(score_threshold);
    }

    let results = [];
    let searchType = 'none';
    let chunkingUsed = false;
    let vectorStoreStats = null;
    
    if (vectorStoreService && typeof vectorStoreService.search === 'function') {
      // 🍄 УЛУЧШЕНО: Векторный поиск с полной поддержкой чанков
      const vectorResults = await vectorStoreService.search(query, searchOptions);
      
      if (vectorResults && vectorResults.length > 0) {
        results = vectorResults.map(result => {
          const isChunk = result.isChunk || (result.metadata?.originalId !== result.id);
          
          return {
            id: result.id,
            title: result.metadata?.title || 'Без названия',
            content: result.content || '',
            category: result.metadata?.category || 'general',
            language: result.metadata?.language || 'auto', // 🍄 ИЗМЕНЕНО
            score: result.score || 0,
            isChunk: isChunk,
            chunkInfo: result.chunkInfo || (isChunk ? {
              originalId: result.metadata?.originalId,
              chunkIndex: result.metadata?.chunkIndex,
              totalChunks: result.metadata?.totalChunks,
              startPosition: result.metadata?.startPosition,
              endPosition: result.metadata?.endPosition
            } : null),
            // 🍄 НОВОЕ: Расширенная отладочная информация
            debug: {
              metadataId: result.metadata?.id,
              resultId: result.id,
              originalId: result.metadata?.originalId || result.id,
              hasChunkMetadata: result.metadata?.chunkIndex !== undefined,
              contentLength: result.content?.length || 0,
              scoreThreshold: searchOptions.score_threshold || 'universal'
            }
          };
        });
        searchType = 'vector';
        chunkingUsed = results.some(r => r.isChunk);

        // 🍄 НОВОЕ: Получаем статистику векторного хранилища
        try {
          vectorStoreStats = await vectorStoreService.getStats();
        } catch (statsError) {
          logger.warn(`Could not get vector store stats: ${statsError.message}`);
        }
      }
    }
    
    // Fallback на MongoDB поиск если нет результатов от векторного поиска
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
        language: doc.language || 'auto', // 🍄 ИЗМЕНЕНО
        score: 0.5, // Примерный score для MongoDB результатов
        isChunk: false,
        chunkInfo: null,
        debug: {
          source: 'mongodb',
          contentLength: doc.content?.length || 0
        }
      }));
      searchType = 'mongodb';
    }

    // 🍄 НОВОЕ: Расширенная статистика результатов
    const responseData = {
      success: true,
      data: {
        results,
        query,
        totalFound: results.length,
        searchType,
        chunkingUsed,
        returnChunks: Boolean(returnChunks),
        chunksFound: results.filter(r => r.isChunk).length,
        documentsFound: results.filter(r => !r.isChunk).length,
        searchOptions,
        universalSearch: true, // 🍄 НОВОЕ: индикатор универсального поиска
        // 🍄 НОВОЕ: Детальная статистика
        statistics: {
          averageScore: results.length > 0 ? 
            (results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length).toFixed(4) : 0,
          scoreRange: results.length > 0 ? {
            min: Math.min(...results.map(r => r.score || 0)).toFixed(4),
            max: Math.max(...results.map(r => r.score || 0)).toFixed(4)
          } : null,
          contentLengths: {
            average: results.length > 0 ? 
              Math.round(results.reduce((sum, r) => sum + (r.debug?.contentLength || 0), 0) / results.length) : 0,
            total: results.reduce((sum, r) => sum + (r.debug?.contentLength || 0), 0)
          }
        },
        vectorStoreInfo: vectorStoreStats,
        debug: {
          vectorSearchAttempted: true,
          vectorServiceAvailable: vectorStoreService && typeof vectorStoreService.search === 'function',
          thresholdUsed: searchOptions.score_threshold || 'universal',
          timestamp: new Date().toISOString()
        }
      }
    };

    // 🍄 НОВОЕ: Добавляем анализ чанков если returnChunks=true
    if (returnChunks && chunkingUsed) {
      const chunkAnalysis = {
        chunkDistribution: {},
        documentCoverage: {},
        qualityMetrics: {
          highQualityChunks: results.filter(r => r.isChunk && r.score >= 0.8).length,
          mediumQualityChunks: results.filter(r => r.isChunk && r.score >= 0.6 && r.score < 0.8).length,
          lowQualityChunks: results.filter(r => r.isChunk && r.score < 0.6).length
        }
      };

      // Анализ распределения чанков по документам
      const chunksByDocument = {};
      results.filter(r => r.isChunk).forEach(chunk => {
        const originalId = chunk.chunkInfo?.originalId || chunk.id;
        if (!chunksByDocument[originalId]) {
          chunksByDocument[originalId] = [];
        }
        chunksByDocument[originalId].push({
          chunkIndex: chunk.chunkInfo?.chunkIndex,
          score: chunk.score,
          contentLength: chunk.debug?.contentLength
        });
      });

      chunkAnalysis.chunkDistribution = Object.entries(chunksByDocument).map(([docId, chunks]) => ({
        documentId: docId,
        chunkCount: chunks.length,
        averageScore: (chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length).toFixed(4),
        chunkIndices: chunks.map(c => c.chunkIndex).sort((a, b) => a - b)
      }));

      responseData.data.chunkAnalysis = chunkAnalysis;
    }

    res.json(responseData);

    logger.info(`🍄 RAG test search completed: "${query}" - ${results.length} results (${searchType}), chunking: ${chunkingUsed ? 'used' : 'not used'}, returnChunks: ${returnChunks ? 'yes' : 'no'}`);
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
 * @desc Diagnose vector store health with DETAILED chunking information
 * @access Private (Admin only)
 */
router.get('/diagnose', requireAdminAuth, async (req, res) => {
  try {
    // 🍄 УЛУЧШЕНО: Расширенная диагностика с детальной информацией о чанках
    const vectorStatus = await vectorStoreService.diagnose();
    
    // Информация о хранилище документов
    const docsCount = await KnowledgeDocument.countDocuments();
    
    // 🍄 НОВОЕ: Расширенная статистика векторного хранилища с чанками
    const vectorStats = await vectorStoreService.getStats();

    // Статистика knowledge service с чанкингом
    const knowledgeStats = await knowledgeService.getStats();
    
    // 🍄 НОВОЕ: Дополнительная диагностика чанкинга
    let chunkingDiagnostics = {
      status: 'unknown',
      details: {}
    };

    try {
      // Тестируем чанкинг функциональность
      const testDoc = {
        id: 'test-doc-chunking',
        content: 'This is a test document for chunking functionality. '.repeat(50), // ~2500 символов
        metadata: { title: 'Test Document', language: 'auto', category: 'test' }
      };
      
      const textChunker = require('../utils/textChunker');
      const chunks = textChunker.chunkDocument(testDoc);
      
      chunkingDiagnostics = {
        status: 'ok',
        details: {
          testDocumentLength: testDoc.content.length,
          chunksGenerated: chunks.length,
          averageChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length) : 0,
          chunkSizes: chunks.map(c => c.content.length),
          chunkingEnabled: vectorStatus.config?.chunkingConfig?.enableChunking || false,
          defaultChunkSize: vectorStatus.config?.chunkingConfig?.chunkSize || 'unknown',
          defaultOverlap: vectorStatus.config?.chunkingConfig?.overlap || 'unknown'
        }
      };
    } catch (chunkError) {
      chunkingDiagnostics = {
        status: 'error',
        error: chunkError.message
      };
    }

    // 🍄 НОВОЕ: Анализ качества чанков в векторной базе
    let chunkQualityAnalysis = {
      status: 'unknown'
    };

    try {
      if (vectorStats.chunksCount > 0) {
        // Простой тест поиска для анализа качества чанков
        const testSearchResults = await vectorStoreService.search('test query', { 
          limit: 5, 
          returnChunks: true 
        });
        
        chunkQualityAnalysis = {
          status: 'ok',
          details: {
            totalChunks: vectorStats.chunksCount,
            totalDocuments: vectorStats.documentsCount,
            averageChunksPerDocument: vectorStats.documentsCount > 0 ? 
              Math.round(vectorStats.chunksCount / vectorStats.documentsCount) : 0,
            testSearchResults: testSearchResults.length,
            sampleChunks: testSearchResults.slice(0, 3).map(chunk => ({
              id: chunk.id,
              isChunk: chunk.isChunk || false,
              contentLength: chunk.content?.length || 0,
              score: chunk.score,
              originalId: chunk.metadata?.originalId || chunk.id
            }))
          }
        };
      } else {
        chunkQualityAnalysis = {
          status: 'empty',
          message: 'No chunks found in vector store'
        };
      }
    } catch (qualityError) {
      chunkQualityAnalysis = {
        status: 'error',
        error: qualityError.message
      };
    }

    // 🍄 УЛУЧШЕНО: Расширенный ответ диагностики
    const diagnosticsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      vector: vectorStatus,
      mongoDb: {
        documentsCount: docsCount,
        status: docsCount > 0 ? 'ok' : 'warning'
      },
      vectorStats,
      knowledgeService: knowledgeStats,
      // 🍄 НОВОЕ: Детальная диагностика чанкинга
      chunking: {
        functionality: chunkingDiagnostics,
        quality: chunkQualityAnalysis,
        configuration: {
          enabled: vectorStatus.config?.chunkingConfig?.enableChunking || false,
          defaultOptions: vectorStatus.config?.chunkingConfig || {},
          universalThreshold: vectorStatus.config?.universalThreshold || 'unknown' // 🍄 ИЗМЕНЕНО
        }
      },
      // 🍄 НОВОЕ: Рекомендации на основе диагностики
      recommendations: []
    };

    // Генерируем рекомендации
    if (vectorStats.chunksCount === 0 && docsCount > 0) {
      diagnosticsResponse.recommendations.push({
        type: 'warning',
        message: 'MongoDB contains documents but vector store is empty. Consider running synchronization.',
        action: 'POST /api/knowledge/sync-vector-store'
      });
    }

    if (chunkingDiagnostics.status !== 'ok') {
      diagnosticsResponse.recommendations.push({
        type: 'error',
        message: 'Chunking functionality test failed. Check textChunker service.',
        action: 'Review server logs and textChunker configuration'
      });
    }

    if (vectorStats.documentsCount > 0 && vectorStats.chunksCount / vectorStats.documentsCount < 2) {
      diagnosticsResponse.recommendations.push({
        type: 'info',
        message: 'Low chunks per document ratio. Consider enabling chunking for better search quality.',
        action: 'Review chunking configuration'
      });
    }

    res.json(diagnosticsResponse);

    logger.info(`🍄 Enhanced vector store diagnostics performed with universal search and chunking analysis`);
  } catch (error) {
    logger.error(`Error performing enhanced vector store diagnostics: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Enhanced diagnostics failed',
      errorCode: 'DIAGNOSTICS_ERROR',
      details: error.message
    });
  }
});

/**
 * @route GET /api/knowledge/chunk-analysis/:documentId
 * @desc Analyze chunks for a specific document
 * @access Private (Admin only)
 * @param {string} documentId - Document ID to analyze
 */
router.get('/chunk-analysis/:documentId', requireAdminAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Получаем оригинальный документ
    const document = await KnowledgeDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Ищем все чанки этого документа в векторной базе
    const chunks = await vectorStoreService.search('', {
      limit: 100,
      returnChunks: true
    });

    const documentChunks = chunks.filter(chunk => 
      chunk.metadata?.originalId === documentId || chunk.id.startsWith(documentId)
    );

    // Анализируем чанки
    const analysis = {
      document: {
        id: documentId,
        title: document.title,
        category: document.category,
        language: document.language || 'auto', // 🍄 ИЗМЕНЕНО
        contentLength: document.content.length,
        tags: document.tags
      },
      chunks: {
        total: documentChunks.length,
        details: documentChunks.map(chunk => ({
          id: chunk.id,
          chunkIndex: chunk.metadata?.chunkIndex,
          contentLength: chunk.content?.length,
          startPosition: chunk.metadata?.startPosition,
          endPosition: chunk.metadata?.endPosition,
          content: chunk.content?.substring(0, 200) + '...'
        })).sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0))
      },
      statistics: {
        averageChunkSize: documentChunks.length > 0 ? 
          Math.round(documentChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0) / documentChunks.length) : 0,
        totalChunkContent: documentChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0),
        coverage: document.content.length > 0 ? 
          ((documentChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0) / document.content.length) * 100).toFixed(2) : 0
      }
    };

    res.json({
      success: true,
      data: analysis
    });

    logger.info(`🍄 Chunk analysis performed for document: ${documentId}`);
  } catch (error) {
    logger.error(`Error analyzing chunks for document ${req.params.documentId}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Chunk analysis failed',
      errorCode: 'CHUNK_ANALYSIS_ERROR'
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

    logger.info(`🍄 Starting vector store synchronization with universal search and chunking: ${enableChunking ? 'enabled' : 'disabled'}`);

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
 * @route GET /api/knowledge/:id
 * @desc Get a specific knowledge document
 * @access Public (📖 ИСПРАВЛЕНО: убрана аутентификация для получения документа)
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
 * @body {string} [language=auto] - Document language (auto-detected if not specified)
 * @body {string[]} [tags] - Document tags
 * @body {string} [authorId] - Author ID
 * @body {boolean} [enableChunking] - Override chunking for this document
 * @body {number} [chunkSize] - Custom chunk size for this document
 * @body {number} [overlap] - Custom overlap for this document
 * 🍄 УПРОЩЕНО: language по умолчанию 'auto'
 */
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      language = 'auto', // 🍄 ИЗМЕНЕНО: по умолчанию 'auto'
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

    logger.info(`🍄 Knowledge document created by ${req.admin.username}: ${result.data.id} - "${title}", chunking: ${result.chunkingUsed ? 'used' : 'not used'}`);
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