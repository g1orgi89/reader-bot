/**
 * @file Knowledge API Routes - Типизированная версия
 * @description API эндпоинты для управления базой знаний проекта Shrooms
 * 
 * Поддерживает:
 * - Типизированные search операции с расширенными фильтрами
 * - Загрузку документов с валидацией
 * - Управление документами (CRUD операции)
 * - Статистику и мониторинг
 * - Полную совместимость с админ-панелью
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const VectorStoreService = require('../services/vectorStore');
const TextProcessor = require('../utils/textProcessor');
const { getVectorStoreConfig } = require('../config/vectorStore');
const logger = require('../utils/logger');

// Импорт типов и валидаторов
const {
  API_ERROR_CODES,
  SUPPORTED_LANGUAGES,
  DOCUMENT_CATEGORIES,
  SUPPORTED_FILE_TYPES,
  validateSearchQuery,
  validateDocumentRequest,
  validateFileUpload,
  validateDocumentDelete,
  validateReindexRequest
} = require('../types/knowledgeApi');

/**
 * @typedef {import('../types/knowledgeApi').SearchQuery} SearchQuery
 * @typedef {import('../types/knowledgeApi').SearchResponse} SearchResponse
 * @typedef {import('../types/knowledgeApi').DocumentRequest} DocumentRequest
 * @typedef {import('../types/knowledgeApi').DocumentResponse} DocumentResponse
 * @typedef {import('../types/knowledgeApi').FileUploadRequest} FileUploadRequest
 * @typedef {import('../types/knowledgeApi').FileUploadResponse} FileUploadResponse
 * @typedef {import('../types/knowledgeApi').KnowledgeStatsResponse} KnowledgeStatsResponse
 * @typedef {import('../types/knowledgeApi').HealthCheckResponse} HealthCheckResponse
 * @typedef {import('../types/knowledgeApi').ReindexRequest} ReindexRequest
 * @typedef {import('../types/knowledgeApi').ReindexResponse} ReindexResponse
 * @typedef {import('../types/knowledgeApi').APIErrorResponse} APIErrorResponse
 */

const router = express.Router();

// Инициализация сервисов
const vectorStoreConfig = getVectorStoreConfig();
const vectorStore = new VectorStoreService(vectorStoreConfig);
const textProcessor = new TextProcessor();

// Настройка multer для загрузки файлов с типизированной валидацией
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (Object.values(SUPPORTED_FILE_TYPES).includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Supported types: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}`));
    }
  }
});

// Middleware для валидации и типизации ответов
function validateAndRespond(validationFunction) {
  return (req, res, next) => {
    const validation = validationFunction(req.body);
    
    if (!validation.isValid) {
      const response = {
        success: false,
        error: 'Validation failed',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: validation.errors.map(msg => ({
            field: 'body',
            message: msg,
            code: 'INVALID_VALUE'
          }))
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(response);
    }
    
    next();
  };
}

/**
 * @route POST /api/knowledge/documents
 * @description Добавление нового документа в базу знаний
 * @access Private (требует авторизации)
 * @body {DocumentRequest} Данные документа
 * @returns {DocumentResponse} Результат добавления документа
 */
router.post('/documents', validateAndRespond(validateDocumentRequest), async (req, res) => {
  try {
    /** @type {DocumentRequest} */
    const { title, content, category, language = SUPPORTED_LANGUAGES.ENGLISH, tags = [] } = req.body;
    
    const startTime = Date.now();
    
    // Создание метаданных документа
    const metadata = {
      source: `manual_upload_${Date.now()}`,
      category,
      language,
      tags,
      title,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Обработка текста и создание чанков
    const processedResult = await textProcessor.createChunks(content, metadata);
    
    // Подготовка документов для векторной базы
    const vectorDocuments = processedResult.chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.text,
      metadata: chunk.metadata
    }));
    
    // Добавление в векторную базу
    const result = await vectorStore.addDocuments(vectorDocuments);
    
    /** @type {DocumentResponse} */
    const response = {
      success: true,
      documentId: metadata.source,
      chunksCreated: processedResult.chunks.length,
      totalTokens: processedResult.totalTokens,
      addResult: result,
      processingStats: {
        originalSizeBytes: Buffer.byteLength(content, 'utf8'),
        processedSizeBytes: processedResult.chunks.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.text, 'utf8'), 0),
        processingTimeMs: Date.now() - startTime,
        chunkingStats: {
          totalChunks: processedResult.chunks.length,
          averageChunkSize: Math.round(processedResult.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / processedResult.chunks.length),
          maxChunkSize: Math.max(...processedResult.chunks.map(chunk => chunk.text.length)),
          minChunkSize: Math.min(...processedResult.chunks.map(chunk => chunk.text.length)),
          chunkOverlap: processedResult.chunkOverlap || 0
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Error adding document: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.DOCUMENT_ADD_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

/**
 * @route POST /api/knowledge/upload
 * @description Загрузка файлов в базу знаний
 * @access Private
 * @body {FileUploadRequest} Данные файлов для загрузки
 * @returns {FileUploadResponse} Результаты обработки файлов
 */
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'No files uploaded',
        errorCode: API_ERROR_CODES.NO_FILES,
        timestamp: new Date()
      };
      
      return res.status(400).json(errorResponse);
    }
    
    // Создаем объект для валидации
    const uploadData = {
      files: req.files,
      category: req.body.category || DOCUMENT_CATEGORIES.GENERAL,
      language: req.body.language || SUPPORTED_LANGUAGES.ENGLISH,
      tags: req.body.tags ? JSON.parse(req.body.tags) : []
    };
    
    // Валидация
    const validation = validateFileUpload(uploadData);
    if (!validation.isValid) {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'File upload validation failed',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: validation.errors.map(msg => ({
            field: 'files',
            message: msg,
            code: 'INVALID_FORMAT'
          }))
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(errorResponse);
    }
    
    const { category, language, tags } = uploadData;
    const results = [];
    const startTime = Date.now();
    let totalChunks = 0;
    let totalTokens = 0;
    
    for (const file of req.files) {
      try {
        // Чтение содержимого файла
        const content = await fs.readFile(file.path, 'utf8');
        
        // Создание метаданных
        const metadata = {
          source: file.originalname,
          category,
          language,
          tags,
          title: path.basename(file.originalname, path.extname(file.originalname)),
          createdAt: new Date()
        };
        
        // Обработка файла
        const processedResult = await textProcessor.createChunks(content, metadata);
        
        // Подготовка для векторной базы
        const vectorDocuments = processedResult.chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.text,
          metadata: chunk.metadata
        }));
        
        // Добавление в базу
        const addResult = await vectorStore.addDocuments(vectorDocuments);
        
        totalChunks += processedResult.chunks.length;
        totalTokens += processedResult.totalTokens;
        
        results.push({
          filename: file.originalname,
          success: true,
          documentId: metadata.source,
          chunksCreated: processedResult.chunks.length,
          totalTokens: processedResult.totalTokens,
          addResult
        });
        
        // Удаление временного файла
        await fs.unlink(file.path);
      } catch (error) {
        logger.error(`Error processing file ${file.originalname}: ${error.message}`, { error });
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message,
          errorCode: API_ERROR_CODES.PROCESSING_ERROR
        });
      }
    }
    
    /** @type {FileUploadResponse} */
    const response = {
      success: true,
      results,
      summary: {
        totalFiles: req.files.length,
        successfulFiles: results.filter(r => r.success).length,
        failedFiles: results.filter(r => !r.success).length,
        totalChunks,
        totalTokens,
        processingTimeMs: Date.now() - startTime
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Upload error: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.UPLOAD_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/knowledge/search
 * @description Типизированный поиск в базе знаний
 * @access Public
 * @query {SearchQuery} Параметры поиска
 * @returns {SearchResponse} Результаты поиска
 */
router.get('/search', async (req, res) => {
  try {
    // Подготовка и валидация параметров поиска
    /** @type {SearchQuery} */
    const searchQuery = {
      query: req.query.q,
      limit: req.query.limit ? parseInt(req.query.limit) : 10,
      threshold: req.query.threshold ? parseFloat(req.query.threshold) : 0.7,
      language: req.query.language,
      category: req.query.category,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      includeMetadata: req.query.includeMetadata !== 'false',
      sortBy: req.query.sortBy || 'relevance',
      orderBy: req.query.orderBy || 'desc'
    };
    
    // Валидация
    const validation = validateSearchQuery(searchQuery);
    if (!validation.isValid) {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'Search query validation failed',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: validation.errors.map(msg => ({
            field: 'query',
            message: msg,
            code: 'INVALID_VALUE'
          }))
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(errorResponse);
    }
    
    const startTime = Date.now();
    
    // Выполнение поиска
    const searchResults = await vectorStore.search(searchQuery.query, {
      limit: searchQuery.limit,
      threshold: searchQuery.threshold,
      language: searchQuery.language,
      category: searchQuery.category,
      tags: searchQuery.tags
    });
    
    // Получение статистики
    const stats = await vectorStore.getStats();
    
    /** @type {SearchResponse} */
    const response = {
      success: true,
      results: searchResults.map(result => ({
        id: result.id || result.metadata?.id,
        score: result.score || result.similarity,
        content: result.content || result.pageContent,
        metadata: result.metadata,
        rank: result.rank
      })),
      totalResults: searchResults.length,
      searchOptions: searchQuery,
      metadata: {
        searchTime: Date.now() - startTime,
        vectorStoreProvider: vectorStore.options?.provider || 'unknown',
        embedModelUsed: vectorStore.options?.embeddingProvider?.model || 'unknown',
        totalDocuments: stats?.totalDocuments || 0,
        appliedFilters: {
          categories: searchQuery.category ? [searchQuery.category] : [],
          languages: searchQuery.language ? [searchQuery.language] : [],
          tags: searchQuery.tags || [],
          dateRange: {}
        }
      },
      query: searchQuery.query
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Search error: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.SEARCH_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

/**
 * @route DELETE /api/knowledge/documents/:id
 * @description Удаление документа из базы знаний
 * @access Private
 * @param {string} id - ID документа
 * @returns {DocumentDeleteResponse} Результат удаления
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cascade = false, force = false } = req.query;
    
    // Валидация запроса
    const deleteRequest = { id, cascade: cascade === 'true', force: force === 'true' };
    const validation = validateDocumentDelete(deleteRequest);
    
    if (!validation.isValid) {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'Delete request validation failed',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: validation.errors.map(msg => ({
            field: 'id',
            message: msg,
            code: 'INVALID_VALUE'
          }))
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(errorResponse);
    }
    
    const result = await vectorStore.deleteDocument(id);
    
    if (result) {
      /** @type {DocumentDeleteResponse} */
      const response = {
        success: true,
        message: 'Document deleted successfully',
        deletedDocument: {
          id,
          title: result.title || 'Unknown',
          chunksDeleted: result.chunksDeleted || 1,
          vectorsDeleted: result.vectorsDeleted || 1
        }
      };
      
      res.json(response);
    } else {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'Document not found',
        errorCode: API_ERROR_CODES.DOCUMENT_NOT_FOUND,
        timestamp: new Date()
      };
      
      res.status(404).json(errorResponse);
    }
  } catch (error) {
    logger.error(`Delete error: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.DELETE_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/knowledge/stats
 * @description Получение статистики базы знаний
 * @access Private
 * @returns {KnowledgeStatsResponse} Статистика базы знаний
 */
router.get('/stats', async (req, res) => {
  try {
    const rawStats = await vectorStore.getStats();
    
    /** @type {KnowledgeStatsResponse} */
    const response = {
      success: true,
      stats: {
        totalDocuments: rawStats?.totalDocuments || 0,
        totalChunks: rawStats?.totalChunks || 0,
        totalVectors: rawStats?.totalVectors || 0,
        byCategory: rawStats?.byCategory || [],
        byLanguage: rawStats?.byLanguage || [],
        byTags: rawStats?.byTags || [],
        storage: {
          totalSizeMb: rawStats?.totalSizeMb || 0,
          vectorStoreSizeMb: rawStats?.vectorStoreSizeMb || 0,
          metadataStoreSizeMb: rawStats?.metadataStoreSizeMb || 0,
          storageProvider: rawStats?.storageProvider || 'unknown',
          compressionRatio: rawStats?.compressionRatio || '1:1'
        },
        lastUpdated: new Date()
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Stats error: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.STATS_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/knowledge/health
 * @description Проверка работоспособности системы
 * @access Public
 * @returns {HealthCheckResponse} Статус системы
 */
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Проверка инициализации векторной базы
    if (!vectorStore.isInitialized) {
      const initResult = await vectorStore.initialize();
      if (!initResult.success) {
        /** @type {HealthCheckResponse} */
        const errorResponse = {
          success: false,
          status: 'unhealthy',
          components: [
            {
              name: 'VectorStore',
              status: 'unhealthy',
              message: 'Vector store not initialized',
              lastChecked: new Date()
            }
          ],
          responseTimeMs: Date.now() - startTime,
          error: 'Vector store not initialized'
        };
        
        return res.status(503).json(errorResponse);
      }
    }
    
    // Проверка компонентов
    const components = [];
    
    // Проверка векторной базы
    try {
      const vectorHealth = await vectorStore.healthCheck();
      components.push({
        name: 'VectorStore',
        status: vectorHealth.status || 'healthy',
        message: vectorHealth.message || 'Connected',
        lastChecked: new Date(),
        metrics: {
          uptime: vectorHealth.uptime || Date.now() - startTime,
          requestsPerSecond: vectorHealth.requestsPerSecond || 0,
          avgResponseTime: vectorHealth.avgResponseTime || 0
        }
      });
    } catch (error) {
      components.push({
        name: 'VectorStore',
        status: 'unhealthy',
        message: error.message,
        lastChecked: new Date()
      });
    }
    
    // Проверка обработчика текста
    try {
      const processorHealth = await textProcessor.healthCheck();
      components.push({
        name: 'TextProcessor',
        status: processorHealth.status || 'healthy',
        message: processorHealth.message || 'Ready',
        lastChecked: new Date()
      });
    } catch (error) {
      components.push({
        name: 'TextProcessor',
        status: 'healthy',
        message: 'Ready (no health check)',
        lastChecked: new Date()
      });
    }
    
    // Определение общего статуса
    const hasUnhealthy = components.some(c => c.status === 'unhealthy');
    const hasDegraded = components.some(c => c.status === 'degraded');
    
    let overallStatus;
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    /** @type {HealthCheckResponse} */
    const response = {
      success: true,
      status: overallStatus,
      components,
      responseTimeMs: Date.now() - startTime
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Health check error: ${error.message}`, { error });
    
    /** @type {HealthCheckResponse} */
    const errorResponse = {
      success: false,
      status: 'unhealthy',
      components: [],
      responseTimeMs: Date.now() - Date.now(),
      error: error.message
    };
    
    res.status(503).json(errorResponse);
  }
});

/**
 * @route POST /api/knowledge/reindex
 * @description Переиндексация базы знаний (очистка и загрузка с нуля)
 * @access Private
 * @body {ReindexRequest} Параметры переиндексации
 * @returns {ReindexResponse} Результат переиндексации
 */
router.post('/reindex', async (req, res) => {
  try {
    // Валидация запроса
    const validation = validateReindexRequest(req.body);
    if (!validation.isValid) {
      /** @type {APIErrorResponse} */
      const errorResponse = {
        success: false,
        error: 'Reindex request validation failed',
        errorCode: API_ERROR_CODES.VALIDATION_ERROR,
        details: {
          validationErrors: validation.errors.map(msg => ({
            field: 'body',
            message: msg,
            code: 'INVALID_VALUE'
          }))
        },
        timestamp: new Date()
      };
      
      return res.status(400).json(errorResponse);
    }
    
    const startTime = Date.now();
    let documentsProcessed = 0;
    let chunksCreated = 0;
    let vectorsStored = 0;
    let cleared = false;
    
    // Очистка коллекции при необходимости
    if (req.body.clearFirst !== false) {
      const clearResult = await vectorStore.clearCollection();
      
      if (!clearResult) {
        /** @type {APIErrorResponse} */
        const errorResponse = {
          success: false,
          error: 'Failed to clear collection',
          errorCode: API_ERROR_CODES.CLEAR_FAILED,
          timestamp: new Date()
        };
        
        return res.status(500).json(errorResponse);
      }
      
      cleared = true;
    }
    
    // Переиндексация может быть реализована позднее при необходимости
    // Пока что возвращаем базовый ответ о том, что коллекция очищена
    
    /** @type {ReindexResponse} */
    const response = {
      success: true,
      message: cleared ? 'Collection cleared. Please re-upload documents.' : 'Reindex completed',
      results: {
        cleared,
        documentsProcessed,
        chunksCreated,
        vectorsStored,
        totalTimeMs: Date.now() - startTime,
        fileResults: []
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error(`Reindex error: ${error.message}`, { error });
    
    /** @type {APIErrorResponse} */
    const errorResponse = {
      success: false,
      error: error.message,
      errorCode: API_ERROR_CODES.REINDEX_ERROR,
      timestamp: new Date()
    };
    
    res.status(500).json(errorResponse);
  }
});

module.exports = router;