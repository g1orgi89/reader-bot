/**
 * @file Knowledge API Routes
 * @description API эндпоинты для управления базой знаний проекта Shrooms
 * 
 * Поддерживает:
 * - Загрузку документов в векторную базу
 * - Поиск в базе знаний
 * - Управление документами (CRUD операции)
 * - Статистику и мониторинг
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const VectorStoreService = require('../services/vectorStore');
const TextProcessor = require('../utils/textProcessor');
const { getVectorStoreConfig } = require('../config/vectorStore');
const logger = require('../utils/logger');

/**
 * @import {VectorDocument, SearchOptions, SearchResult} from '../types/index.js'
 */

const router = express.Router();

// Инициализация сервисов
const vectorStoreConfig = getVectorStoreConfig();
const vectorStore = new VectorStoreService(vectorStoreConfig);
const textProcessor = new TextProcessor();

// Настройка multer для загрузки файлов
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
    const allowedTypes = ['.md', '.txt', '.json', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  }
});

/**
 * @route POST /api/knowledge/documents
 * @description Добавление нового документа в базу знаний
 * @access Private (требует авторизации)
 * @body {
 *   title: string,
 *   content: string,
 *   category: string,
 *   language: string,
 *   tags?: string[]
 * }
 * @returns {Object} Результат добавления документа
 */
router.post('/documents', async (req, res) => {
  try {
    const { title, content, category, language = 'en', tags = [] } = req.body;
    
    // Валидация входных данных
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, content, category',
        errorCode: 'MISSING_FIELDS'
      });
    }
    
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
    
    res.json({
      success: true,
      documentId: metadata.source,
      chunksCreated: processedResult.chunks.length,
      totalTokens: processedResult.totalTokens,
      addResult: result
    });
  } catch (error) {
    logger.error(`Error adding document: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'DOCUMENT_ADD_ERROR'
    });
  }
});

/**
 * @route POST /api/knowledge/upload
 * @description Загрузка файлов в базу знаний
 * @access Private
 */
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        errorCode: 'NO_FILES'
      });
    }
    
    const { category = 'general', language = 'en' } = req.body;
    const results = [];
    
    for (const file of req.files) {
      try {
        // Чтение содержимого файла
        const content = await fs.readFile(file.path, 'utf8');
        
        // Создание метаданных
        const metadata = {
          source: file.originalname,
          category,
          language,
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
        
        results.push({
          filename: file.originalname,
          success: true,
          chunksCreated: processedResult.chunks.length,
          totalTokens: processedResult.totalTokens,
          addResult
        });
        
        // Удаление временного файла
        await fs.unlink(file.path);
      } catch (error) {
        logger.error(`Error processing file ${file.originalname}: ${error.message}`);
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error(`Upload error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'UPLOAD_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/search
 * @description Поиск в базе знаний
 * @access Public
 * @query {
 *   q: string,
 *   language?: string,
 *   category?: string,
 *   limit?: number,
 *   threshold?: number
 * }
 * @returns {SearchResult[]} Результаты поиска
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, language, category, limit, threshold } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        errorCode: 'MISSING_QUERY'
      });
    }
    
    // Настройка опций поиска
    const searchOptions = {
      limit: parseInt(limit) || 10,
      threshold: parseFloat(threshold) || 0.7,
      language,
      category
    };
    
    // Выполнение поиска
    const results = await vectorStore.search(query, searchOptions);
    
    res.json({
      success: true,
      query,
      results,
      totalResults: results.length,
      searchOptions
    });
  } catch (error) {
    logger.error(`Search error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'SEARCH_ERROR'
    });
  }
});

/**
 * @route DELETE /api/knowledge/documents/:id
 * @description Удаление документа из базы знаний
 * @access Private
 * @param {string} id - ID документа
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await vectorStore.deleteDocument(id);
    
    if (result) {
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Document not found',
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }
  } catch (error) {
    logger.error(`Delete error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'DELETE_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/stats
 * @description Получение статистики базы знаний
 * @access Private
 * @returns {Object} Статистика базы знаний
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await vectorStore.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error(`Stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'STATS_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/health
 * @description Проверка работоспособности системы
 * @access Public
 * @returns {Object} Статус системы
 */
router.get('/health', async (req, res) => {
  try {
    // Проверка инициализации векторной базы
    if (!vectorStore.isInitialized) {
      const initResult = await vectorStore.initialize();
      if (!initResult.success) {
        return res.status(503).json({
          success: false,
          status: 'unhealthy',
          error: 'Vector store not initialized',
          details: initResult.error
        });
      }
    }
    
    res.json({
      success: true,
      status: 'healthy',
      vectorStore: vectorStore.isInitialized ? 'connected' : 'disconnected',
      embeddingProvider: vectorStore.options.embeddingProvider.provider,
      collection: vectorStore.collectionName
    });
  } catch (error) {
    logger.error(`Health check error: ${error.message}`);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @route POST /api/knowledge/reindex
 * @description Переиндексация базы знаний (очистка и загрузка с нуля)
 * @access Private
 * @returns {Object} Результат переиндексации
 */
router.post('/reindex', async (req, res) => {
  try {
    // Очистка существующей коллекции
    const clearResult = await vectorStore.clearCollection();
    
    if (!clearResult) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear collection',
        errorCode: 'CLEAR_FAILED'
      });
    }
    
    res.json({
      success: true,
      message: 'Collection cleared. Please re-upload documents.',
      cleared: true
    });
  } catch (error) {
    logger.error(`Reindex error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: 'REINDEX_ERROR'
    });
  }
});

module.exports = router;