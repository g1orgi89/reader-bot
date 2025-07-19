/**
 * Основной файл сервера для Reader Bot
 * @file server/index.js
 */

// Загружаем переменные окружения в самом начале
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Импорт конфигурации и типов
const { config } = require('./config');
const { ERROR_CODES } = require('./types');

// Middleware
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const chatRoutes = require('./api/chat');
const ticketRoutes = require('./api/tickets');
const adminRoutes = require('./api/admin');
const promptRoutes = require('./api/prompts');
const reportRoutes = require('./api/reports'); // 📖 Маршруты отчетов
const analyticsRoutes = require('./api/analytics'); // 📊 Маршруты аналитики

// 📋 НОВЫЕ API ROUTES для системы управления данными
const bookCatalogRoutes = require('./api/bookCatalog');
const announcementsRoutes = require('./api/announcements');
const promoCodesRoutes = require('./api/promoCodes');
const categoriesRoutes = require('./api/categories');
const targetAudiencesRoutes = require('./api/targetAudiences');
const utmTemplatesRoutes = require('./api/utmTemplates');
const annaPersonaRoutes = require('./api/annaPersona');

// 🔧 ИСПРАВЛЕНИЕ: Возвращаем полный knowledge API с детальным логированием ошибок
let knowledgeRoutes, usersRoutes, quotesRoutes;

// 🔍 Попробуем загрузить полный knowledge API с детальной диагностикой
try {
  logger.info('🔍 [KNOWLEDGE] Starting full knowledge.js file loading...');
  
  // Проверим зависимости одну за одной
  logger.info('📦 [KNOWLEDGE] Checking multer...');
  require('multer');
  logger.info('✅ [KNOWLEDGE] multer - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking mammoth...');
  require('mammoth');
  logger.info('✅ [KNOWLEDGE] mammoth - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking XLSX...');
  require('xlsx');
  logger.info('✅ [KNOWLEDGE] XLSX - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking models/knowledge...');
  require('./models/knowledge');
  logger.info('✅ [KNOWLEDGE] KnowledgeDocument model - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking services/knowledge...');
  require('./services/knowledge');
  logger.info('✅ [KNOWLEDGE] knowledgeService - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking services/vectorStore...');
  require('./services/vectorStore');
  logger.info('✅ [KNOWLEDGE] vectorStoreService - OK');
  
  logger.info('📦 [KNOWLEDGE] Checking middleware/adminAuth...');
  require('./middleware/adminAuth');
  logger.info('✅ [KNOWLEDGE] adminAuth - OK');
  
  logger.info('📦 [KNOWLEDGE] All dependencies checked, loading full API...');
  knowledgeRoutes = require('./api/knowledge');
  logger.info('✅ [KNOWLEDGE] Full knowledge routes imported successfully');
  
} catch (error) {
  logger.error('❌ [KNOWLEDGE] Failed to import knowledge routes:', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name
  });
  
  // Попробуем выяснить, какая именно зависимость проблемная
  if (error.message.includes('Cannot find module')) {
    const moduleName = error.message.match(/'([^']+)'/)?.[1];
    logger.error(`❌ [KNOWLEDGE] Missing module: ${moduleName}`);
  }
  
  // Создаем fallback router с детальной информацией об ошибке
  knowledgeRoutes = express.Router();
  knowledgeRoutes.all('*', (req, res) => {
    res.status(500).json({
      success: false,
      error: 'Knowledge routes failed to load',
      details: error.message,
      code: 'KNOWLEDGE_ROUTES_ERROR',
      errorName: error.name,
      stack: config.app.isDevelopment ? error.stack : undefined
    });
  });
}

try {
  logger.info('🔧 Attempting to import users routes...');
  usersRoutes = require('./api/users');
  logger.info('✅ Users routes imported successfully');
} catch (error) {
  logger.error('❌ Failed to import users routes:', error);
  usersRoutes = express.Router();
  usersRoutes.get('*', (req, res) => {
    res.status(500).json({
      success: false,
      error: 'Users routes failed to load',
      details: error.message
    });
  });
}

try {
  logger.info('🔧 Attempting to import quotes routes...');
  quotesRoutes = require('./api/quotes');
  logger.info('✅ Quotes routes imported successfully');
} catch (error) {
  logger.error('❌ Failed to import quotes routes:', error);
  quotesRoutes = express.Router();
  quotesRoutes.get('*', (req, res) => {
    res.status(500).json({
      success: false,
      error: 'Quotes routes failed to load',
      details: error.message
    });
  });
}

// Services
const dbService = require('./services/database');
const vectorStoreService = require('./services/vectorStore');
const claude = require('./services/claude');
const promptService = require('./services/promptService');
const simpleLanguageService = require('./services/simpleLanguage');
const conversationService = require('./services/conversation');
const messageService = require('./services/message');
const ticketService = require('./services/ticketing');
const ticketEmailService = require('./services/ticketEmail');

// 📖 Безопасная загрузка CronService и TelegramReportService
let cronService, telegramReportService;
try {
  const { CronService } = require('./services/cronService');
  cronService = new CronService();
  logger.info('✅ CronService loaded successfully');
} catch (error) {
  logger.warn('⚠️ CronService not available:', error.message);
  cronService = null;
}

try {
  telegramReportService = require('./services/telegramReportService');
  logger.info('✅ TelegramReportService loaded successfully');
} catch (error) {
  logger.warn('⚠️ TelegramReportService not available:', error.message);
  telegramReportService = null;
}

/**
 * @typedef {import('./types').ShroomsError} ShroomsError
 * @typedef {import('./types').ChatMessage} ChatMessage
 * @typedef {import('./types').ChatResponse} ChatResponse
 * @typedef {import('./types').SocketMessageData} SocketMessageData
 */

// Создание приложения Express
const app = express();
const server = http.createServer(app);

// Socket.IO настройка
const io = socketIo(server, {
  cors: {
    origin: config.cors.origin,
    methods: config.cors.methods,
    credentials: config.cors.credentials
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 60000
  }
});

// Middleware для заголовков
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// CORS middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders
}));

// JSON parser middleware
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  type: 'application/x-www-form-urlencoded',
  parameterLimit: 1000
}));

// JSON parse error handler
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
      code: 'INVALID_JSON',
      details: config.app.isDevelopment ? error.message : undefined
    });
  }
  next(error);
});

// HTTP logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`🌐 HTTP ${req.method} ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`🌐 HTTP ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '../client'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
}));

// Health check endpoint - ВАЖНО: должен быть ПЕРЕД API роутами
app.get(`${config.app.apiPrefix}/health`, async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      services: {
        database: 'ok',
        knowledge: 'checking...'
      }
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
logger.info('🔧 Registering API routes...');

// Основные API роуты
app.use(`${config.app.apiPrefix}/chat`, chatRoutes);
app.use(`${config.app.apiPrefix}/tickets`, ticketRoutes);
app.use(`${config.app.apiPrefix}/admin`, adminRoutes);
app.use(`${config.app.apiPrefix}/knowledge`, knowledgeRoutes);
app.use(`${config.app.apiPrefix}/prompts`, promptRoutes);
app.use(`${config.app.apiPrefix}/reports`, reportRoutes);
app.use(`${config.app.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.app.apiPrefix}/users`, usersRoutes);
app.use(`${config.app.apiPrefix}/quotes`, quotesRoutes);

// 📋 НОВЫЕ API РОУТЫ для системы управления данными Reader Bot
logger.info('📋 Registering Reader Bot data management API routes...');
app.use(`${config.app.apiPrefix}/book-catalog`, bookCatalogRoutes);
app.use(`${config.app.apiPrefix}/announcements`, announcementsRoutes);
app.use(`${config.app.apiPrefix}/promo-codes`, promoCodesRoutes);
app.use(`${config.app.apiPrefix}/categories`, categoriesRoutes);
app.use(`${config.app.apiPrefix}/target-audiences`, targetAudiencesRoutes);
app.use(`${config.app.apiPrefix}/utm-templates`, utmTemplatesRoutes);
app.use(`${config.app.apiPrefix}/anna-persona`, annaPersonaRoutes);

logger.info('✅ All API routes registered successfully');

// 404 handler для API - ВАЖНО: должен быть ПОСЛЕ всех API роутов
app.use(`${config.app.apiPrefix}/*`, (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: ERROR_CODES.NOT_FOUND,
    path: req.path
  });
});

// Serve admin panel
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin-panel/index.html'));
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Global error handler
app.use(errorHandler);

/**
 * Запуск сервера
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    logger.info('🚀 Starting Reader Bot Server...');
    logger.info(`Environment: ${config.app.environment}`);
    logger.info(`Version: ${config.app.version}`);
    
    logger.info('📡 Connecting to MongoDB...');
    await dbService.connect();
    logger.info('✅ MongoDB connected successfully');
    
    logger.info('🍄 Initializing PromptService...');
    try {
      await promptService.initialize();
      logger.info('✅ PromptService initialized successfully');
    } catch (error) {
      logger.warn('⚠️ PromptService initialization failed, will use fallback prompts:', error.message);
    }
    
    const PORT = config.app.port;
    
    // 🔧 ИСПРАВЛЕНИЕ: Явно указываем что сервер должен слушать на всех интерфейсах
    await new Promise((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    logger.info(`🚀 Reader Bot Server running on port ${PORT}`);
    logger.info(`🌐 Server listening on all interfaces (0.0.0.0:${PORT})`);
    logger.info(`🌐 API available at: http://localhost:${PORT}${config.app.apiPrefix}`);
    logger.info(`🏠 Client available at: http://localhost:${PORT}`);
    logger.info(`🔍 Knowledge API: ${config.app.apiPrefix}/knowledge`);
    logger.info(`📋 Data Management APIs:`);
    logger.info(`   📚 Book Catalog: ${config.app.apiPrefix}/book-catalog`);
    logger.info(`   📢 Announcements: ${config.app.apiPrefix}/announcements`);
    logger.info(`   🎁 Promo Codes: ${config.app.apiPrefix}/promo-codes`);
    logger.info(`   📂 Categories: ${config.app.apiPrefix}/categories`);
    logger.info(`   🎯 Target Audiences: ${config.app.apiPrefix}/target-audiences`);
    logger.info(`   🔗 UTM Templates: ${config.app.apiPrefix}/utm-templates`);
    logger.info(`   👩 Anna Persona: ${config.app.apiPrefix}/anna-persona`);
    
    return server;
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 * @param {string} signal - Сигнал завершения
 */
async function gracefulShutdown(signal) {
  logger.info(`🔄 Received ${signal}, shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('✅ HTTP server closed');
    
    try {
      await dbService.disconnect();
      logger.info('✅ Database disconnected');
    } catch (error) {
      logger.error('❌ Error disconnecting from database:', error);
    }
    
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('⏰ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Обработка сигналов завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise
  });
});

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', {
    message: error.message,
    stack: error.stack
  });
  
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Экспорт для тестирования
module.exports = {
  app,
  server,
  io,
  startServer
};

// Запуск сервера только если файл запущен напрямую
if (require.main === module) {
  startServer().catch(error => {
    logger.error('❌ Startup failed:', error);
    process.exit(1);
  });
}
