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

// 🐛 ДИАГНОСТИКА: Временно используем минимальную версию knowledge API
let knowledgeRoutes, usersRoutes, quotesRoutes;

// 🔧 ВРЕМЕННОЕ ИСПРАВЛЕНИЕ: Используем минимальную версию для диагностики
try {
  logger.info('🔍 [KNOWLEDGE] Loading minimal knowledge API for diagnostics...');
  knowledgeRoutes = require('./api/knowledge-minimal');
  logger.info('✅ [KNOWLEDGE] Minimal knowledge routes loaded successfully');
} catch (error) {
  logger.error('❌ [KNOWLEDGE] Failed to import minimal knowledge routes:', {
    message: error.message,
    stack: error.stack,
    code: error.code
  });
  knowledgeRoutes = express.Router();
  knowledgeRoutes.get('*', (req, res) => {
    res.status(500).json({
      success: false,
      error: 'Knowledge routes failed to load completely',
      details: error.message,
      code: 'KNOWLEDGE_ROUTES_ERROR'
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

// 🔧 ИСПРАВЛЕНИЕ: Health check endpoint ПЕРЕД API роутами
function getConnectionsByIP() {
  const connections = {};
  if (io && io.sockets) {
    for (const [id, socket] of io.sockets.sockets) {
      const ip = socket.handshake.address;
      connections[ip] = (connections[ip] || 0) + 1;
    }
  }
  return connections;
}

// Health check endpoint - ВАЖНО: должен быть ПЕРЕД API роутами
app.get(`${config.app.apiPrefix}/health`, async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    const vectorHealth = config.features.enableRAG 
      ? await vectorStoreService.healthCheck() 
      : { status: 'disabled' };

    const aiProviderInfo = claude.getProviderInfo();
    const promptHealth = await promptService.diagnose();
    const pendingTicketsStats = ticketEmailService.getPendingTicketsStats();

    // 📖 Безопасная проверка CronService
    let cronStatus = { status: 'disabled', totalJobs: 0 };
    if (cronService && typeof cronService.getJobsStatus === 'function') {
      try {
        cronStatus = cronService.getJobsStatus();
        cronStatus.status = 'ok';
      } catch (error) {
        cronStatus = { status: 'error', error: error.message, totalJobs: 0 };
      }
    }

    // 📊 Безопасная проверка сервиса аналитики
    let analyticsHealth = { status: 'ok' };
    try {
      const { UTMClick, PromoCodeUsage } = require('./models');
      await UTMClick.countDocuments().limit(1);
      await PromoCodeUsage.countDocuments().limit(1);
      analyticsHealth.modelsAvailable = true;
    } catch (error) {
      analyticsHealth = { status: 'error', error: error.message, modelsAvailable: false };
    }

    // 👥 Безопасная проверка пользовательских роутов
    let usersHealth = { status: 'ok' };
    try {
      const UserProfile = require('./models/userProfile');
      const Quote = require('./models/quote');
      await UserProfile.countDocuments().limit(1);
      await Quote.countDocuments().limit(1);
      usersHealth.modelsAvailable = true;
    } catch (error) {
      usersHealth = { status: 'error', error: error.message, modelsAvailable: false };
    }

    // 📝 Безопасная проверка сервиса цитат
    let quotesHealth = { status: 'ok' };
    try {
      const Quote = require('./models/quote');
      await Quote.countDocuments().limit(1);
      quotesHealth.modelsAvailable = true;
    } catch (error) {
      quotesHealth = { status: 'error', error: error.message, modelsAvailable: false };
    }

    // 🔍 Безопасная проверка knowledge service
    let knowledgeHealth = { status: 'minimal_mode' };
    try {
      const KnowledgeDocument = require('./models/knowledge');
      await KnowledgeDocument.countDocuments().limit(1);
      knowledgeHealth.modelsAvailable = true;
    } catch (error) {
      knowledgeHealth = { status: 'error', error: error.message, modelsAvailable: false };
    }

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      services: {
        database: dbHealth,
        vectorStore: vectorHealth,
        ai: claude ? 'ok' : 'error',
        prompts: promptHealth,
        ticketEmail: 'ok',
        language: simpleLanguageService.healthCheck(),
        cron: cronStatus.status,
        analytics: analyticsHealth.status,
        users: usersHealth.status,
        quotes: quotesHealth.status,
        knowledge: knowledgeHealth.status
      },
      aiProvider: aiProviderInfo,
      promptService: {
        status: promptHealth.status,
        cacheStats: promptHealth.cacheStats,
        databaseConnection: promptHealth.databaseConnection
      },
      ticketEmailService: pendingTicketsStats,
      languageService: simpleLanguageService.getStats(),
      // 📖 Информация о cron задачах (если доступно)
      cronService: cronService ? {
        ...cronStatus,
        nextRuns: cronService.getNextRunTime ? {
          weeklyReports: cronService.getNextRunTime('weekly_reports'),
          dailyReminders: cronService.getNextRunTime('daily_reminders'),
          monthlyReports: cronService.getNextRunTime('monthly_reports'),
          dailyCleanup: cronService.getNextRunTime('daily_cleanup')
        } : {}
      } : { status: 'disabled' },
      // 📊 Информация о сервисе аналитики
      analyticsService: analyticsHealth,
      // 👥 Информация о пользовательском сервисе
      usersService: usersHealth,
      // 📝 Информация о сервисе цитат
      quotesService: quotesHealth,
      // 🔍 Информация о knowledge service
      knowledgeService: knowledgeHealth,
      features: config.features,
      socketConnections: {
        total: io.engine ? io.engine.clientsCount : 0,
        active: io.sockets ? io.sockets.sockets.size : 0,
        byIP: getConnectionsByIP()
      }
    };

    const hasError = Object.values(health.services).some(
      service => service.status === 'error'
    );

    res.status(hasError ? 503 : 200).json(health);
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

app.use(`${config.app.apiPrefix}/chat`, chatRoutes);
app.use(`${config.app.apiPrefix}/tickets`, ticketRoutes);
app.use(`${config.app.apiPrefix}/admin`, adminRoutes);
app.use(`${config.app.apiPrefix}/knowledge`, knowledgeRoutes);
app.use(`${config.app.apiPrefix}/prompts`, promptRoutes);
app.use(`${config.app.apiPrefix}/reports`, reportRoutes);
app.use(`${config.app.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.app.apiPrefix}/users`, usersRoutes);
app.use(`${config.app.apiPrefix}/quotes`, quotesRoutes);

logger.info('✅ All API routes registered successfully');
logger.info(`🔍 Knowledge API: MINIMAL MODE for diagnostics`);
logger.info(`🔍 Knowledge endpoints: GET /, GET /stats, POST /upload (stub)`);

// Мониторинг метрик (если включен)
if (config.features.enableMetrics) {
  app.get(config.monitoring.metricsPath, (req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      socketConnections: {
        total: io.engine ? io.engine.clientsCount : 0,
        active: io.sockets ? io.sockets.sockets.size : 0,
        byIP: getConnectionsByIP()
      },
      pendingTickets: ticketEmailService.getPendingTicketsStats(),
      cronJobs: cronService ? cronService.getJobsStatus() : { status: 'disabled' }
    });
  });
}

// Socket.IO connection handling - сокращенная версия для экономии места
const socketConnections = new Map();

function getMaxConnectionsForIP(clientIp) {
  if (config.app.isDevelopment) {
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost')) {
      return 10;
    }
    return 5;
  } else {
    return 3;
  }
}

io.on('connection', (socket) => {
  logger.info(`🔌 Socket connected: ${socket.id}`);
  
  socket.emit('system', {
    message: 'Connected to Reader Bot! 📖 (Minimal Knowledge Mode)',
    timestamp: new Date().toISOString()
  });
  
  socket.on('disconnect', (reason) => {
    logger.info(`🔌 Socket disconnected: ${socket.id} (${reason})`);
  });
});

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
    logger.info(`🔍 DIAGNOSTIC MODE: Using minimal knowledge API`);
    
    const aiProviderInfo = claude.getProviderInfo();
    logger.info(`🤖 AI Provider: ${aiProviderInfo.currentProvider}`);
    
    const languageStats = simpleLanguageService.getStats();
    logger.info(`🌍 Language Service: Simple (${languageStats.supportedLanguages.length} languages supported)`);
    
    logger.info('📡 Connecting to MongoDB...');
    await dbService.connect();
    logger.info('✅ MongoDB connected successfully');
    
    try {
      await dbService.createIndexes();
      logger.info('✅ Database indexes ensured');
    } catch (error) {
      logger.warn('⚠️ Failed to create indexes:', error.message);
    }
    
    logger.info('🍄 Initializing PromptService...');
    try {
      await promptService.initialize();
      logger.info('✅ PromptService initialized successfully');
    } catch (error) {
      logger.warn('⚠️ PromptService initialization failed, will use fallback prompts:', error.message);
    }
    
    logger.info('🔍 Knowledge Service: MINIMAL MODE (no full initialization)');
    
    if (config.features.enableRAG) {
      logger.info('📡 Initializing vector store...');
      try {
        await vectorStoreService.initialize();
        logger.info('✅ Vector store initialized');
      } catch (error) {
        logger.error('❌ Vector store initialization failed:', error.message);
        if (config.app.isProduction) {
          process.exit(1);
        }
      }
    } else {
      logger.info('⚠️ RAG feature disabled, skipping vector store initialization');
    }
    
    const PORT = config.app.port;
    await new Promise((resolve, reject) => {
      server.listen(PORT, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    logger.info(`🚀 Reader Bot Server running on port ${PORT}`);
    logger.info(`🌐 API available at: http://localhost:${PORT}${config.app.apiPrefix}`);
    logger.info(`🏠 Client available at: http://localhost:${PORT}`);
    logger.info(`🔍 Knowledge API: ${config.app.apiPrefix}/knowledge (MINIMAL MODE)`);
    logger.info(`🔍 Admin Panel: http://localhost:${PORT}/admin-panel/knowledge.html`);
    
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
  
  logger.info('🔌 Closing Socket.IO connections...');
  io.close(() => {
    logger.info('✅ Socket.IO closed');
  });
  
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
  
  if (!config.app.isProduction) {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
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
