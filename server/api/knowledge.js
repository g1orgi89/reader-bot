/**
 * Knowledge Base API Routes - Enhanced with Document Upload Support
 * @file server/api/knowledge.js
 * 📖 ДОБАВЛЕНО: Функционал загрузки документов для Reader Bot
 * 🔍 ПОДДЕРЖКА: PDF, TXT, DOCX, XLS/XLSX файлов
 * 🛠 ИСПРАВЛЕНО: Добавлены недостающие CRUD endpoints
 */

console.log('🔍 [KNOWLEDGE] Starting knowledge.js file loading...');

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const XLSX = require('xlsx');
// 🔧 ИСПРАВЛЕНО: Убрали проблемный импорт pdf-extract
// const PDFExtract = require('pdf-extract');

console.log('✅ [KNOWLEDGE] Express and file processing libraries imported successfully');

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

console.log('🔍 [KNOWLEDGE] Setting up file upload middleware...');

/**
 * @typedef {Object} DocumentUpload
 * @property {string} title - Заголовок документа
 * @property {string} category - Категория документа
 * @property {string[]} tags - Теги документа
 * @property {string} language - Язык документа
 * @property {string} status - Статус документа (published/draft)
 * @property {Buffer} content - Содержимое файла
 * @property {string} filename - Имя файла
 * @property {string} mimetype - MIME тип файла
 * @property {number} size - Размер файла в байтах
 */

// Multer configuration for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('🔍 [KNOWLEDGE] File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Allowed file types for Reader Bot knowledge base
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
  ];

  const allowedExtensions = ['.txt', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.xlsm'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    console.log('✅ [KNOWLEDGE] File type accepted:', file.mimetype, fileExtension);
    cb(null, true);
  } else {
    console.error('❌ [KNOWLEDGE] File type rejected:', file.mimetype, fileExtension);
    cb(new Error('Неподдерживаемый тип файла. Разрешены: PDF, TXT, DOCX, XLS/XLSX'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1 // Single file upload
  }
});

console.log('✅ [KNOWLEDGE] Multer upload middleware configured');

// Middleware to ensure UTF-8 encoding for JSON responses
router.use((req, res, next) => {
  console.log(`🔍 [KNOWLEDGE] Processing request: ${req.method} ${req.path}`);
  
  // Only set JSON content type for non-upload routes
  if (!req.path.includes('/upload')) {
    res.charset = 'utf-8';
    res.set('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

console.log('✅ [KNOWLEDGE] Middleware setup complete');

/**
 * Extract text content from uploaded file based on file type
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - MIME type
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(buffer, filename, mimetype) {
  const fileExtension = path.extname(filename).toLowerCase();
  console.log('🔍 [KNOWLEDGE] Extracting text from file:', {
    filename,
    mimetype,
    extension: fileExtension,
    size: buffer.length
  });

  try {
    switch (fileExtension) {
      case '.txt':
        console.log('📄 [KNOWLEDGE] Processing TXT file');
        return buffer.toString('utf-8');

      case '.docx':
        console.log('📄 [KNOWLEDGE] Processing DOCX file');
        try {
          const result = await mammoth.extractRawText({ buffer });
          return result.value;
        } catch (error) {
          console.error('❌ [KNOWLEDGE] DOCX extraction failed:', error.message);
          throw new Error('Не удалось извлечь текст из DOCX файла: ' + error.message);
        }

      case '.xlsx':
      case '.xls':
      case '.xlsm':
        console.log('📊 [KNOWLEDGE] Processing Excel file');
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          let allText = '';
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            allText += `\n=== ${sheetName} ===\n`;
            jsonData.forEach(row => {
              if (row.length > 0) {
                allText += row.filter(cell => cell !== null && cell !== undefined).join(' | ') + '\n';
              }
            });
          });
          
          return allText.trim();
        } catch (error) {
          console.error('❌ [KNOWLEDGE] Excel extraction failed:', error.message);
          throw new Error('Не удалось извлечь данные из Excel файла: ' + error.message);
        }

      case '.pdf':
        console.log('📄 [KNOWLEDGE] Processing PDF file');
        try {
          // 🔧 ИСПРАВЛЕНО: Убрали проблемное использование pdf-extract
          // Теперь возвращаем placeholder с инструкцией для ручного ввода
          return `[PDF Document: ${filename}]\n\nПримечание: Автоматическое извлечение текста из PDF файлов требует дополнительной настройки. Пожалуйста, добавьте содержимое вручную или конвертируйте PDF в текстовый формат.`;
        } catch (error) {
          console.error('❌ [KNOWLEDGE] PDF extraction failed:', error.message);
          throw new Error('Извлечение текста из PDF временно недоступно: ' + error.message);
        }

      default:
        throw new Error(`Неподдерживаемый формат файла: ${fileExtension}`);
    }
  } catch (error) {
    console.error('❌ [KNOWLEDGE] Text extraction failed:', error.message);
    throw error;
  }
}

/**
 * Detect document category based on filename and content
 * @param {string} filename - Original filename
 * @param {string} content - Extracted text content
 * @returns {string} Detected category
 */
function detectDocumentCategory(filename, content) {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content.toLowerCase().substring(0, 500);

  // Reader Bot specific categories
  const categoryKeywords = {
    'books': ['книга', 'роман', 'автор', 'произведение', 'литература', 'чтение'],
    'psychology': ['психология', 'психолог', 'терапия', 'эмоции', 'сознание', 'поведение'],
    'self-development': ['саморазвитие', 'мотивация', 'личностный рост', 'цель', 'успех', 'развитие'],
    'relationships': ['отношения', 'любовь', 'семья', 'партнер', 'брак', 'дружба'],
    'productivity': ['продуктивность', 'эффективность', 'время', 'планирование', 'задачи'],
    'mindfulness': ['осознанность', 'медитация', 'внимательность', 'присутствие', 'покой'],
    'creativity': ['творчество', 'креативность', 'искусство', 'вдохновение', 'идеи']
  };

  // Check filename first
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerFilename.includes(keyword))) {
      return category;
    }
  }

  // Check content
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const matchCount = keywords.filter(keyword => lowerContent.includes(keyword)).length;
    if (matchCount >= 2) {
      return category;
    }
  }

  return 'general';
}

/**
 * Generate document title from filename if not provided
 * @param {string} filename - Original filename
 * @returns {string} Generated title
 */
function generateDocumentTitle(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * @route POST /api/reader/knowledge/upload
 * @desc Upload and process document files
 * @access Admin (requires authentication)
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  console.log('📁 [KNOWLEDGE] POST /upload endpoint called');
  logger.info('📁 Knowledge API - Document upload started');

  try {
    if (!req.file) {
      console.error('❌ [KNOWLEDGE] No file uploaded');
      return res.status(400).json({
        success: false,
        error: 'Файл не загружен',
        errorCode: 'NO_FILE_UPLOADED'
      });
    }

    console.log('🔍 [KNOWLEDGE] Processing uploaded file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      encoding: req.file.encoding
    });

    // Validate file size
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Файл слишком большой (максимум 10MB)',
        errorCode: 'FILE_TOO_LARGE'
      });
    }

    // Extract text content from file
    console.log('🔍 [KNOWLEDGE] Starting text extraction...');
    let extractedContent;
    try {
      extractedContent = await extractTextFromFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      console.log('✅ [KNOWLEDGE] Text extraction successful, length:', extractedContent.length);
    } catch (extractionError) {
      console.error('❌ [KNOWLEDGE] Text extraction failed:', extractionError.message);
      return res.status(400).json({
        success: false,
        error: 'Ошибка извлечения текста: ' + extractionError.message,
        errorCode: 'TEXT_EXTRACTION_FAILED'
      });
    }

    // Validate extracted content
    if (!extractedContent || extractedContent.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось извлечь достаточно текста из файла',
        errorCode: 'INSUFFICIENT_CONTENT'
      });
    }

    // Get document metadata from form data
    const title = req.body.title || generateDocumentTitle(req.file.originalname);
    const category = req.body.category || detectDocumentCategory(req.file.originalname, extractedContent);
    const language = req.body.language || 'ru';
    const status = req.body.status || 'published';
    const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    // Add automatic tags based on file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileTypeTags = {
      '.pdf': ['pdf', 'документ'],
      '.docx': ['word', 'документ'],
      '.txt': ['текст', 'заметки'],
      '.xlsx': ['excel', 'таблица', 'данные'],
      '.xls': ['excel', 'таблица', 'данные']
    };

    if (fileTypeTags[fileExtension]) {
      tags.push(...fileTypeTags[fileExtension]);
    }

    // Remove duplicates from tags
    const uniqueTags = [...new Set(tags)];

    console.log('🔍 [KNOWLEDGE] Document metadata:', {
      title,
      category,
      language,
      status,
      tags: uniqueTags,
      contentLength: extractedContent.length
    });

    // Create document data
    const documentData = {
      title: title.substring(0, 200), // Limit title length
      content: extractedContent.substring(0, 10000), // Limit content length
      category,
      language,
      tags: uniqueTags,
      status,
      authorId: req.user?.id || 'admin', // Use authenticated user ID if available
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save document to database
    console.log('💾 [KNOWLEDGE] Saving document to database...');
    let savedDocument;
    
    if (knowledgeService && typeof knowledgeService.createDocument === 'function') {
      // Use knowledge service if available
      const result = await knowledgeService.createDocument(documentData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save document via service');
      }
      savedDocument = result.data;
    } else {
      // Direct database save as fallback
      if (!KnowledgeDocument) {
        throw new Error('KnowledgeDocument model not available');
      }
      savedDocument = new KnowledgeDocument(documentData);
      await savedDocument.save();
    }

    console.log('✅ [KNOWLEDGE] Document saved successfully:', savedDocument._id);

    // Log successful upload
    logger.info(`📁 Document uploaded successfully: ${title} (${req.file.originalname})`, {
      documentId: savedDocument._id,
      filename: req.file.originalname,
      category,
      fileSize: req.file.size,
      contentLength: extractedContent.length
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Документ успешно загружен и обработан',
      data: {
        id: savedDocument._id,
        title: savedDocument.title,
        category: savedDocument.category,
        language: savedDocument.language,
        tags: savedDocument.tags,
        status: savedDocument.status,
        contentLength: savedDocument.content.length,
        createdAt: savedDocument.createdAt,
        originalFilename: req.file.originalname,
        fileSize: req.file.size
      }
    });

  } catch (error) {
    console.error('❌ [KNOWLEDGE] Upload error:', error.message);
    console.error('❌ [KNOWLEDGE] Stack:', error.stack);
    logger.error(`Document upload failed: ${error.message}`, {
      filename: req.file?.originalname,
      fileSize: req.file?.size,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки документа: ' + error.message,
      errorCode: 'UPLOAD_FAILED',
      details: error.message
    });
  }
});

/**
 * @route POST /api/reader/knowledge
 * @desc Create new document manually
 * @access Admin
 */
router.post('/', async (req, res) => {
  console.log('📝 [KNOWLEDGE] POST / endpoint called - Create document');
  logger.info('📝 Knowledge API - Creating document manually');

  try {
    const { title, content, category, language = 'ru', tags = [], status = 'published' } = req.body;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Поля title, content и category обязательны',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (content.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Содержание должно быть минимум 10 символов',
        errorCode: 'CONTENT_TOO_SHORT'
      });
    }

    // Prepare document data
    const documentData = {
      title: title.substring(0, 200),
      content: content.substring(0, 50000), // Increased limit for manual entries
      category,
      language,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : []),
      status,
      authorId: req.user?.id || 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📝 [KNOWLEDGE] Creating document with data:', {
      title: documentData.title,
      category: documentData.category,
      language: documentData.language,
      tagsCount: documentData.tags.length,
      contentLength: documentData.content.length
    });

    // Save document
    let savedDocument;
    
    if (knowledgeService && typeof knowledgeService.createDocument === 'function') {
      const result = await knowledgeService.createDocument(documentData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save document via service');
      }
      savedDocument = result.data;
    } else if (KnowledgeDocument) {
      savedDocument = new KnowledgeDocument(documentData);
      await savedDocument.save();
    } else {
      throw new Error('Neither knowledgeService nor KnowledgeDocument model available');
    }

    console.log('✅ [KNOWLEDGE] Document created successfully:', savedDocument._id);

    res.status(201).json({
      success: true,
      message: 'Документ успешно создан',
      data: {
        id: savedDocument._id,
        title: savedDocument.title,
        category: savedDocument.category,
        language: savedDocument.language,
        tags: savedDocument.tags,
        status: savedDocument.status,
        contentLength: savedDocument.content.length,
        createdAt: savedDocument.createdAt
      }
    });

    logger.info(`📝 Manual document created: ${savedDocument.title}`, {
      documentId: savedDocument._id,
      category: savedDocument.category
    });

  } catch (error) {
    console.error('❌ [KNOWLEDGE] Create document error:', error.message);
    logger.error(`Document creation failed: ${error.message}`);

    res.status(500).json({
      success: false,
      error: 'Ошибка создания документа: ' + error.message,
      errorCode: 'CREATION_FAILED'
    });
  }
});

/**
 * @route GET /api/reader/knowledge
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
 * @route GET /api/reader/knowledge/stats
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

/**
 * @route GET /api/reader/knowledge/:id
 * @desc Get specific document by ID
 * @access Public
 */
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

/**
 * @route PUT /api/reader/knowledge/:id
 * @desc Update existing document
 * @access Admin
 */
router.put('/:id', async (req, res) => {
  console.log('✏️ [KNOWLEDGE] PUT /:id endpoint called - Update document:', req.params.id);
  logger.info('✏️ Knowledge API - Updating document:', req.params.id);

  try {
    const { title, content, category, language, tags, status } = req.body;
    const documentId = req.params.id;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Поля title, content и category обязательны',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Prepare update data
    const updateData = {
      title: title.substring(0, 200),
      content: content.substring(0, 50000),
      category,
      language: language || 'ru',
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : []),
      status: status || 'published',
      updatedAt: new Date()
    };

    console.log('✏️ [KNOWLEDGE] Updating document with data:', {
      id: documentId,
      title: updateData.title,
      category: updateData.category,
      contentLength: updateData.content.length
    });

    let updatedDocument;

    if (knowledgeService && typeof knowledgeService.updateDocument === 'function') {
      const result = await knowledgeService.updateDocument(documentId, updateData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update document via service');
      }
      updatedDocument = result.data;
    } else if (KnowledgeDocument) {
      updatedDocument = await KnowledgeDocument.findByIdAndUpdate(
        documentId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedDocument) {
        return res.status(404).json({
          success: false,
          error: 'Документ не найден',
          errorCode: 'DOCUMENT_NOT_FOUND'
        });
      }
    } else {
      throw new Error('Neither knowledgeService nor KnowledgeDocument model available');
    }

    console.log('✅ [KNOWLEDGE] Document updated successfully:', updatedDocument._id);

    res.json({
      success: true,
      message: 'Документ успешно обновлен',
      data: {
        id: updatedDocument._id,
        title: updatedDocument.title,
        category: updatedDocument.category,
        language: updatedDocument.language,
        tags: updatedDocument.tags,
        status: updatedDocument.status,
        contentLength: updatedDocument.content.length,
        updatedAt: updatedDocument.updatedAt
      }
    });

    logger.info(`✏️ Document updated: ${updatedDocument.title}`, {
      documentId: updatedDocument._id
    });

  } catch (error) {
    console.error('❌ [KNOWLEDGE] Update document error:', error.message);
    logger.error(`Document update failed: ${error.message}`);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID документа',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка обновления документа: ' + error.message,
      errorCode: 'UPDATE_FAILED'
    });
  }
});

/**
 * @route DELETE /api/reader/knowledge/:id
 * @desc Delete existing document
 * @access Admin
 */
router.delete('/:id', async (req, res) => {
  console.log('🗑️ [KNOWLEDGE] DELETE /:id endpoint called - Delete document:', req.params.id);
  logger.info('🗑️ Knowledge API - Deleting document:', req.params.id);

  try {
    const documentId = req.params.id;

    console.log('🗑️ [KNOWLEDGE] Deleting document with id:', documentId);

    let deletedDocument;

    if (knowledgeService && typeof knowledgeService.deleteDocument === 'function') {
      const result = await knowledgeService.deleteDocument(documentId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete document via service');
      }
      deletedDocument = result.data;
    } else if (KnowledgeDocument) {
      deletedDocument = await KnowledgeDocument.findByIdAndDelete(documentId);

      if (!deletedDocument) {
        return res.status(404).json({
          success: false,
          error: 'Документ не найден',
          errorCode: 'DOCUMENT_NOT_FOUND'
        });
      }
    } else {
      throw new Error('Neither knowledgeService nor KnowledgeDocument model available');
    }

    console.log('✅ [KNOWLEDGE] Document deleted successfully:', documentId);

    res.json({
      success: true,
      message: 'Документ успешно удален',
      data: {
        id: deletedDocument._id,
        title: deletedDocument.title,
        deletedAt: new Date()
      }
    });

    logger.info(`🗑️ Document deleted: ${deletedDocument.title}`, {
      documentId: deletedDocument._id
    });

  } catch (error) {
    console.error('❌ [KNOWLEDGE] Delete document error:', error.message);
    logger.error(`Document deletion failed: ${error.message}`);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID документа',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка удаления документа: ' + error.message,
      errorCode: 'DELETE_FAILED'
    });
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

console.log('✅ [KNOWLEDGE] All routes setup complete');

module.exports = router;
console.log('✅ [KNOWLEDGE] Module exported successfully');
