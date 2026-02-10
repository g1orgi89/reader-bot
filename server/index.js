/**
 * Основной файл сервера для Reader Bot
 * @file server/index.js
 */

// Загружаем переменные окружения в самом начале
require('dotenv').config();

// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});

// Импорт конфигурации и типов
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
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
const monthlyReportsRoutes = require('./api/monthlyReports');
const analyticsRoutes = require('./api/analytics'); // 📊 Маршруты аналитики
const readerRoutes = require('./api/reader'); // 📱 НОВОЕ: Reader Mini App API

// 🔍 БЕЗОПАСНАЯ ЗАГРУЗКА DEBUG API
let debugRoutes;
try {
  logger.info('🔍 [DEBUG] Attempting to load debug API...');
  debugRoutes = require('./api/debug');
  logger.info('✅ [DEBUG] Debug API loaded successfully');
} catch (error) {
  logger.error('❌ [DEBUG] Failed to load debug API:', error.message);
  logger.info('🔧 [DEBUG] Creating fallback debug API...');
  
  // Создаем безопасный fallback debug API
  debugRoutes = express.Router();
  
  // Простая в памяти база данных
  const sessions = new Map();
  const logs = [];
  
  // Health check
  debugRoutes.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Debug API is working (fallback version)',
      timestamp: new Date().toISOString(),
      stats: { activeSessions: sessions.size, totalLogs: logs.length }
    });
  });
  
  // Start session
  debugRoutes.post('/start-session', (req, res) => {
    try {
      const { userId, deviceInfo, telegramInfo } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      sessions.set(sessionId, {
        userId,
        deviceInfo: deviceInfo || {},
        telegramInfo: telegramInfo || {},
        startTime: Date.now(),
        logCount: 0
      });
      
      logger.info(`🔍 Debug session started: ${sessionId} for user ${userId}`);
      
      res.json({
        success: true,
        sessionId,
        message: 'Debug session started successfully'
      });
    } catch (error) {
      logger.error('❌ Error starting debug session:', error);
      res.status(500).json({ error: 'Failed to start debug session', details: error.message });
    }
  });
  
  // Log endpoint
  debugRoutes.post('/log', (req, res) => {
    try {
      const { sessionId, category, level, message, data, context } = req.body;
      
      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const logEntry = {
        sessionId, category, level, message,
        data: data || {},
        context: context || {},
        timestamp: Date.now() - session.startTime,
        createdAt: new Date()
      };

      logs.push(logEntry);
      session.logCount++;

      logger.info(`📝 Debug log [${sessionId}] ${category}/${level}: ${message}`);
      
      res.json({ success: true, message: 'Log recorded successfully' });
    } catch (error) {
      logger.error('❌ Error recording log:', error);
      res.status(500).json({ error: 'Failed to record log', details: error.message });
    }
  });
  
  // Batch log
  debugRoutes.post('/batch-log', (req, res) => {
    try {
      const { sessionId, logs: batchLogs } = req.body;
      
      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const results = [];
      for (const log of batchLogs || []) {
        const logEntry = {
          sessionId,
          category: log.category,
          level: log.level,
          message: log.message,
          data: log.data || {},
          context: log.context || {},
          timestamp: log.timestamp || (Date.now() - session.startTime),
          createdAt: new Date()
        };
        logs.push(logEntry);
        session.logCount++;
        results.push({ success: true });
        logger.info(`📝 Batch log [${sessionId}] ${log.category}/${log.level}: ${log.message}`);
      }

      res.json({ success: true, processed: results.length, results });
    } catch (error) {
      logger.error('❌ Error processing batch logs:', error);
      res.status(500).json({ error: 'Failed to process batch logs', details: error.message });
    }
  });
  
  // Session stats
  debugRoutes.get('/session/:sessionId/stats', (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = sessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionLogs = logs.filter(log => log.sessionId === sessionId);
      const stats = sessionLogs.reduce((acc, log) => {
        const key = `${log.category}_${log.level}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        stats: {
          sessionId,
          isActive: true,
          duration: Date.now() - session.startTime,
          totalLogs: sessionLogs.length,
          stats,
          deviceInfo: session.deviceInfo,
          telegramInfo: session.telegramInfo
        }
      });
    } catch (error) {
      logger.error('❌ Error getting session stats:', error);
      res.status(500).json({ error: 'Failed to get session stats', details: error.message });
    }
  });
  
  // Active sessions
  debugRoutes.get('/sessions/active', (req, res) => {
    try {
      const activeSessions = Array.from(sessions.entries()).map(([sessionId, session]) => ({
        sessionId,
        userId: session.userId,
        startTime: session.startTime,
        duration: Date.now() - session.startTime,
        logCount: session.logCount,
        isIOS: session.deviceInfo?.isIOS || false
      }));
      
      res.json({ success: true, count: activeSessions.length, sessions: activeSessions });
    } catch (error) {
      logger.error('❌ Error getting active sessions:', error);
      res.status(500).json({ error: 'Failed to get active sessions', details: error.message });
    }
  });
  
  // End session
  debugRoutes.post('/session/:sessionId/end', (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = sessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const finalStats = {
        sessionId,
        duration: Date.now() - session.startTime,
        totalLogs: session.logCount
      };

      sessions.delete(sessionId);
      logger.info(`✅ Debug session ended: ${sessionId}`, finalStats);
      
      res.json({ success: true, message: 'Debug session ended successfully', finalStats });
    } catch (error) {
      logger.error('❌ Error ending debug session:', error);
      res.status(500).json({ error: 'Failed to end debug session', details: error.message });
    }
  });
  
  // iOS issues
  debugRoutes.get('/ios-issues', (req, res) => {
    try {
      const { hours = 24 } = req.query;
      const sinceTime = Date.now() - (hours * 60 * 60 * 1000);
      
      const iosIssues = logs.filter(log => {
        const session = sessions.get(log.sessionId);
        return log.createdAt.getTime() > sinceTime &&
               session?.deviceInfo?.isIOS &&
               (log.category === 'NAVIGATION' || log.category === 'VIEWPORT') &&
               ['ERROR', 'CRITICAL'].includes(log.level);
      });

      res.json({
        success: true,
        period: `${hours} hours`,
        issuesFound: iosIssues.length,
        issues: iosIssues
      });
    } catch (error) {
      logger.error('❌ Error getting iOS issues:', error);
      res.status(500).json({ error: 'Failed to get iOS issues', details: error.message });
    }
  });
  
  logger.info('✅ [DEBUG] Fallback debug API created successfully');
}

// 📋 НОВЫЕ API ROUTES для системы управления данными
const bookCatalogRoutes = require('./api/bookCatalog');
const announcementsRoutes = require('./api/announcements');
const promoCodesRoutes = require('./api/promoCodes');
const categoriesRoutes = require('./api/categories');
const targetAudiencesRoutes = require('./api/targetAudiences');
const utmTemplatesRoutes = require('./api/utmTemplates');
const annaPersonaRoutes = require('./api/annaPersona');
const audioRoutes = require('./api/audio');

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

// 📖 Безопасная загрузка CronService
let cronService;
try {
  const { CronService } = require('./services/cronService');
  cronService = new CronService();
  logger.info('✅ CronService loaded successfully');
} catch (error) {
  logger.warn('⚠️ CronService not available:', error.message);
  cronService = null;
}

/**
 * @typedef {import('./types').ReaderError} ReaderError
 * @typedef {import('./types').ChatMessage} ChatMessage
 * @typedef {import('./types').ChatResponse} ChatResponse
 * @typedef {import('./types').SocketMessageData} SocketMessageData
 */

// Создание приложения Express
const app = express();
const server = http.createServer(app);

// 🤖 Initialize Simple Telegram Bot with webhook support - MUST BE BEFORE MIDDLEWARE
// This ensures Telegram webhook requests are handled correctly
let simpleBot = null;
let reminderService = null;
let reminderJobs = null;
let botInitPromise = null;

// 🤖 Register webhook handler BEFORE any other middleware to prevent 404
// The handler delegates to Telegraf once bot is initialized
const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/api/reader/telegram/webhook';
let webhookHandler = null;

if (process.env.ENABLE_SIMPLE_BOT === 'true') {
  // 🔍 DIAGNOSTIC: Multiple fallback webhook paths to guard against proxy/ingress path rewriting
  const webhookPaths = [
    '/api/reader/telegram/webhook',  // primary
    '/api/reader/telegram/webhook-dev',  // dev bot
    '/reader/telegram/webhook',       // fallback 1
    '/api/telegram/webhook',          // fallback 2
    '/telegram/webhook'               // fallback 3
  ];

  // 🔍 DIAGNOSTIC: Add local body parser for webhook routes BEFORE handler
  // This ensures req.body is parsed even if global parser comes later
  const webhookBodyParser = express.json({ 
    limit: '10mb',
    type: 'application/json'
  });

  // Register webhook routes with diagnostic logging for ALL fallback paths
  webhookPaths.forEach(path => {
    app.post(path, webhookBodyParser, (req, res, next) => {
      // 🔍 DIAGNOSTIC: Log every webhook hit with comprehensive info
      const forwardedFor = req.headers['x-forwarded-for'] || 'none';
      const realIp = req.headers['x-real-ip'] || 'none';
      const userAgent = req.headers['user-agent'] || 'none';
      const contentType = req.headers['content-type'] || 'none';
      
      // Trim body for logging (first 200 chars to avoid huge logs)
      const bodySnapshot = req.body ? JSON.stringify(req.body).substring(0, 200) + '...' : 'empty';
      
      logger.info(`>>> [WEBHOOK_HIT] ${req.method} ${req.originalUrl} | Path: ${req.path} | X-Forwarded-For: ${forwardedFor} | X-Real-IP: ${realIp} | UA: ${userAgent.substring(0, 100)} | Content-Type: ${contentType} | Body: ${bodySnapshot}`);
      
      if (webhookHandler) {
        // Bot is ready - delegate to cached Telegraf webhook handler
        logger.info(`[WEBHOOK] Delegating to Telegraf handler for ${path}`);
        return webhookHandler(req, res, next);
      } else {
        // Bot still initializing - return 200 OK so Telegram doesn't retry
        // This state only exists briefly during startup before server.listen()
        logger.warn(`⚠️ [WEBHOOK] Request received during bot initialization for ${path}`);
        return res.status(200).json({ ok: true, description: 'Bot initializing, please retry' });
      }
    });
    
    logger.info(`🔗 Webhook route registered at ${path}`);
  });
  
  logger.info(`🔗 Primary webhook path: ${webhookPath} (bot will initialize async)`);
  
  // Initialize bot async (completes before server starts listening via botInitPromise await in startServer)
  botInitPromise = (async () => {
    try {
      logger.info('🤖 Creating and initializing Simple Telegram Bot...');
      const SimpleTelegramBot = require('../bot/simpleBot');
      
      simpleBot = new SimpleTelegramBot({
        token: config.telegram.botToken,
        environment: config.app.environment,
        appWebAppUrl: process.env.APP_WEBAPP_URL || 'https://app.unibotz.com/mini-app/'
      });
      
      logger.info('✅ Simple Telegram Bot instance created');
      
      // Initialize bot handlers (commands, messages, etc.)
      await simpleBot.initialize();
      logger.info('✅ Simple Telegram Bot handlers initialized');
      
      // Create and cache the webhook handler
      webhookHandler = simpleBot.webhookCallback(webhookPath);
      logger.info(`✅ Webhook handler cached and ready`);
      logger.info(`✅ Telegram updates will be processed at primary path: ${webhookPath}`);
      
    } catch (error) {
      logger.error('❌ Failed to create/initialize Simple Telegram Bot:', error);
      simpleBot = null;
      throw error;
    }
  })();
} else {
  logger.info('🤖 ENABLE_SIMPLE_BOT not set to "true", Simple Telegram Bot will not be created');
  botInitPromise = Promise.resolve();
}
          
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
  origin: 'https://app.unibotz.com', // твой домен, НЕ '*'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization',
    'X-Telegram-Init-Data', 'X-User-Id', 'Cache-Control', 'Pragma'
  ]
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

// 🚩 Добавить ПЕРЕД общим static для /mini-app
app.use('/mini-app/assets/book-covers', express.static(
  path.join(__dirname, '../mini-app/assets/book-covers'),
  { fallthrough: false }
));

// === AVATAR STATIC REQUEST LOGGER (for debugging) ===
// Log all avatar requests to help diagnose 404 issues
app.use('/uploads/avatars', (req, res, next) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  logger.info(`📥 [avatar-static-request] ${req.method} ${req.originalUrl} - UA: ${userAgent.substring(0, 50)}`);
  next();
});

// 🖼️ Статические файлы для пользовательских аватаров
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    // Set proper cache headers for uploaded files
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    }
  },
  fallthrough: false
}));

// 🔧 DUAL MAPPING: Also serve uploads from server/uploads path for compatibility
// This ensures avatars saved under server/uploads are accessible
app.use('/server/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    }
  },
  fallthrough: false
}));

// 📸 Статические файлы для уведомлений (изображения)
logger.info('📸 Setting up notification assets...');
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    }
  },
  fallthrough: false
}));
logger.info('✅ Notification assets configured at /assets');

// 📱 ИСПРАВЛЕНИЕ: Статические файлы для Mini App
logger.info('📱 Setting up Mini App static files...');
app.use('/mini-app', express.static(path.join(__dirname, '../mini-app'), {
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

// Static files для основного клиента
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
app.get(`${config.app.apiPrefix}/system/health`, async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      services: {
        database: 'ok',
        knowledge: 'checking...',
        debug: debugRoutes ? 'ok' : 'fallback'
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
app.use(`${config.app.apiPrefix}/monthly-reports`, monthlyReportsRoutes);
app.use(`${config.app.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.app.apiPrefix}/users`, usersRoutes);
// app.use(`${config.app.apiPrefix}/quotes`, quotesRoutes);
app.use(`${config.app.apiPrefix}/debug`, debugRoutes);

// 📱 НОВОЕ: Reader Mini App API
logger.info('📱 Registering Reader Mini App API routes...');
app.use(`${config.app.apiPrefix}/reader`, readerRoutes);

// 📋 НОВЫЕ API РОУТЫ для системы управления данными Reader Bot
logger.info('📋 Registering Reader Bot data management API routes...');
app.use(`${config.app.apiPrefix}/book-catalog`, bookCatalogRoutes);
app.use(`${config.app.apiPrefix}/announcements`, announcementsRoutes);
app.use(`${config.app.apiPrefix}/promo-codes`, promoCodesRoutes);
app.use(`${config.app.apiPrefix}/categories`, categoriesRoutes);
app.use(`${config.app.apiPrefix}/target-audiences`, targetAudiencesRoutes);
app.use(`${config.app.apiPrefix}/utm-templates`, utmTemplatesRoutes);
app.use(`${config.app.apiPrefix}/anna-persona`, annaPersonaRoutes);

// 🎵 Audio API routes
logger.info('🎵 Registering Audio API routes...');
app.use(`${config.app.apiPrefix}/audio`, audioRoutes);

// 🔒 Protected audio streaming endpoint (outside /api prefix)
logger.info('🔒 Registering protected media stream route...');
app.get('/media/stream/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rawUserId = req.query.userId; // In production, get from auth token

    if (!rawUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { resolveUserObjectId } = require('./services/access/resolveUserId');
    const userId = await resolveUserObjectId(rawUserId);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user ID' });
    }

    // Normalize track ID: 'alice_wonderland-01' → 'alice_wonderland'
    const trackMatch = id.match(/^(.+)-(\d+)$/);
    const baseId = trackMatch ? trackMatch[1] : id;

    // Direct entitlement check in DB (no service layers)
    const UserEntitlement = require('./models/UserEntitlement');
    const ent = await UserEntitlement.findOne({
      userId,
      kind: 'audio',
      resourceId: baseId
    }).lean();

    const now = new Date();
    const isValid = !!ent && (!ent.expiresAt || new Date(ent.expiresAt) > now);

    if (!isValid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Map ID to protected file path
    let filePath;
    if (trackMatch) {
      const [, containerId, trackNumber] = trackMatch;
      filePath = `${containerId}/${trackNumber}.mp3`;
    } else {
      filePath = `${id}.mp3`;
    }

    // Serve via X-Accel-Redirect
    const protectedPath = `/media-protected/${filePath}`;
    res.setHeader('X-Accel-Redirect', protectedPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.status(200).end();
  } catch (error) {
    logger.error(`❌ Error in protected stream:`, error);
    res.status(500).json({ success: false, error: 'Failed to stream audio', details: error.message });
  }
});

logger.info('✅ All API routes registered successfully');

// Root API health check (before 404 handler)
app.get(`${config.app.apiPrefix}/health`, (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    message: 'Reader Bot API is running',
    timestamp: new Date().toISOString(),
    version: config.app.version || '1.0.0'
  });
});

// 404 handler для API - ВАЖНО: должен быть ПОСЛЕ всех API роутов
app.use(`${config.app.apiPrefix}/*`, (req, res) => {
  // 🔍 DIAGNOSTIC: Enhanced 404 logging to help diagnose missing routes
  logger.warn(`❌ [API_404] ${req.method} ${req.originalUrl} | Path: ${req.path} | From: ${req.ip}`);
  
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

// 📱 ИСПРАВЛЕНИЕ: Роут для Mini App
app.get('/mini-app*', (req, res) => {
  res.sendFile(path.join(__dirname, '../mini-app/index.html'));
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
    
    // 🤖 Wait for bot initialization (already started at module load time)
    // This ensures webhook handler is registered and ready before server starts accepting connections
    if (botInitPromise) {
      await botInitPromise;
    }
    
    logger.info('📡 Connecting to MongoDB...');
    await dbService.connect();
    logger.info('✅ MongoDB connected successfully');
    
    // 🔧 Run weekly report catch-up after database connection
    logger.info('🔄 Running weekly report catch-up service...');
    try {
      const WeeklyReportCatchUpService = require('./services/weeklyReportCatchUpService');
      const catchUpService = new WeeklyReportCatchUpService();
      const catchUpResult = await catchUpService.run();
      
      if (catchUpResult.totalGenerated > 0) {
        logger.info(`✅ Catch-up completed: ${catchUpResult.totalGenerated} reports generated across ${catchUpResult.weeksProcessed} weeks`);
      } else {
        logger.info('✅ Catch-up completed: no missing reports found');
      }
    } catch (catchUpError) {
      logger.error('❌ Error in catch-up service during startup:', catchUpError.message);
      // Don't fail server startup if catch-up fails
    }
    
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
    logger.info(`📱 Mini App available at: http://localhost:${PORT}/mini-app/`);
    logger.info(`🔍 Knowledge API: ${config.app.apiPrefix}/knowledge`);
    logger.info(`📱 Reader API: ${config.app.apiPrefix}/reader (Mini App endpoints)`);
    logger.info(`📋 Data Management APIs:`);
    logger.info(`   📚 Book Catalog: ${config.app.apiPrefix}/book-catalog`);
    logger.info(`   📢 Announcements: ${config.app.apiPrefix}/announcements`);
    logger.info(`   🎁 Promo Codes: ${config.app.apiPrefix}/promo-codes`);
    logger.info(`   📂 Categories: ${config.app.apiPrefix}/categories`);
    logger.info(`   🎯 Target Audiences: ${config.app.apiPrefix}/target-audiences`);
    logger.info(`   🔗 UTM Templates: ${config.app.apiPrefix}/utm-templates`);
    logger.info(`   👩 Anna Persona: ${config.app.apiPrefix}/anna-persona`);

    // Импортируйте сервис
    const WeeklyReportService = require('./services/weeklyReportService');
    const weeklyReportService = new WeeklyReportService();
    const MonthlyReportService = require('./services/monthlyReportService');
    const monthlyReportService = new MonthlyReportService();

    // 🤖 Setup webhook with Telegram and initialize reminder services
    if (simpleBot) {
      const { ReminderService } = require('./services/reminderService');
      const { initReminderCron, stopReminderCron } = require('./scheduler/reminderJobs');
      
      // 1. Setup webhook with Telegram (отдельный try-catch)
      try {
        const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
        if (webhookUrl) {
          logger.info(`🔗 Setting webhook URL with Telegram: ${webhookUrl}`);
          await simpleBot.setWebhook(webhookUrl);
          const webhookInfo = await simpleBot.getWebhookInfo();
          logger.info('✅ Webhook configured:', {
            url: webhookInfo.url,
            has_custom_certificate: webhookInfo.has_custom_certificate,
            pending_update_count: webhookInfo.pending_update_count,
            last_error_date: webhookInfo.last_error_date,
            last_error_message: webhookInfo.last_error_message
          });
          logger.info('✅ Simple Telegram Bot started in WEBHOOK mode');
        } else {
          logger.warn('⚠️ TELEGRAM_WEBHOOK_URL not set, bot will not start (webhook mode required)');
        }
      } catch (error) {
        logger.error('❌ Failed to setup webhook (will retry on next request):', error.message);
        // Продолжаем - reminder важнее webhook при старте
      }
      
      // 2. Initialize ReminderService (отдельный try-catch - КРИТИЧНО!)
      try {
        logger.info('🔔 Initializing ReminderService...');
        reminderService = new ReminderService();
        reminderService.initialize({ bot: simpleBot.bot });
        global.reminderService = reminderService;
        logger.info('✅ ReminderService initialized');
        
        // Initialize reminder cron jobs if enabled
        const enableCron = process.env.ENABLE_REMINDER_CRON !== 'false';
        if (enableCron) {
          logger.info('🔔 Initializing reminder cron jobs...');
          reminderJobs = initReminderCron({ reminderService });
          if (reminderJobs) {
            logger.info('✅ Reminder cron jobs started successfully');
          } else {
            logger.warn('⚠️ Failed to initialize reminder cron jobs');
          }
        } else {
          logger.info('⏸️ Reminder cron jobs disabled (ENABLE_REMINDER_CRON=false)');
        }
      } catch (error) {
        logger.error('❌ Failed to initialize ReminderService:', error);
      }
      
      global.simpleTelegramBot = simpleBot;
    } else {
      logger.info('🤖 Simple Telegram Bot not created, skipping webhook setup and reminder services');
    }
   
    // 📖 Initialize and start CronService
    if (cronService) {
      try {
        logger.info('📖 Initializing CronService...');
        
        // Initialize cronService with dependencies
        cronService.initialize({
          bot: simpleBot ? simpleBot.bot : null, // Pass bot instance if available
          weeklyReportHandler: null, // TelegramReportService removed
          weeklyReportService: weeklyReportService,
          monthlyReportService: monthlyReportService,
          reminderService: reminderService, // Pass reminderService if available
          announcementService: null
        });
        
        // Start cron jobs
        const startResult = cronService.start();
        if (startResult) {
          logger.info('✅ CronService started successfully');
        } else {
          logger.warn('⚠️ CronService start returned false');
        }
      } catch (cronError) {
        logger.error('❌ Failed to initialize/start CronService:', cronError.message);
      }
    } else {
      logger.warn('⚠️ CronService not available, cron jobs will not run');
    }
    
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
  
  // Stop reminder cron jobs
  if (reminderJobs) {
    try {
      const { stopReminderCron } = require('./scheduler/reminderJobs');
      stopReminderCron(reminderJobs);
      logger.info('✅ Reminder cron jobs stopped');
    } catch (error) {
      logger.error('❌ Error stopping reminder cron jobs:', error);
    }
  }
  
  // Stop Simple Telegram Bot
  if (simpleBot) {
    try {
      await simpleBot.stop(signal);
      logger.info('✅ Simple Telegram Bot stopped');
    } catch (error) {
      logger.error('❌ Error stopping bot:', error);
    }
  }
  
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
