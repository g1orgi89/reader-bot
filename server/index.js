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
const knowledgeRoutes = require('./api/knowledge');
const promptRoutes = require('./api/prompts');
const reportRoutes = require('./api/reports'); // 📖 НОВОЕ: Маршруты отчетов
const analyticsRoutes = require('./api/analytics'); // 📊 ИСПРАВЛЕНО: Правильный путь
const quotesRoutes = require('./api/quotes'); // 📝 НОВОЕ: Маршруты цитат

// 🐛 ДИАГНОСТИКА: Безопасный импорт users routes с обработкой ошибок
let usersRoutes;
try {
  logger.info('🔧 Attempting to import users routes...');
  usersRoutes = require('./api/users');
  logger.info('✅ Users routes imported successfully');
} catch (error) {
  logger.error('❌ Failed to import users routes:', error);
  logger.error('❌ Error stack:', error.stack);
  // Создаем пустой роутер как fallback
  usersRoutes = express.Router();
  usersRoutes.get('*', (req, res) => {
    res.status(500).json({
      success: false,
      error: 'Users routes failed to load',
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
const { CronService } = require('./services/cronService'); // 🔧 FIX: Импорт класса
const telegramReportService = require('./services/telegramReportService'); // 📖 НОВОЕ

/**
 * @typedef {import('./types').ShroomsError} ShroomsError
 * @typedef {import('./types').ChatMessage} ChatMessage
 * @typedef {import('./types').ChatResponse} ChatResponse
 * @typedef {import('./types').SocketMessageData} SocketMessageData
 */

// Создание приложения Express
const app = express();
const server = http.createServer(app);

// ИСПРАВЛЕНО: Настройка Socket.IO с более строгими ограничениями
const io = socketIo(server, {
  cors: {
    origin: config.cors.origin,
    methods: config.cors.methods,
    credentials: config.cors.credentials
  },
  // Добавляем ограничения для предотвращения избыточных подключений
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000,
  // Ограничиваем количество подключений с одного IP
  connectionStateRecovery: {
    maxDisconnectionDuration: 60000
  }
});

// 🔧 FIX: Создание экземпляра CronService
const cronService = new CronService();

// ИСПРАВЛЕНО: Убираем проблемное req.setEncoding()
app.use((req, res, next) => {
  // Просто устанавливаем правильные заголовки без изменения encoding stream
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// Middleware CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders
}));

// ИСПРАВЛЕНО: Простое express.json middleware без verify функции
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

// Middleware для обработки JSON parse errors
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

// 🐛 ДОБАВЛЕНО: Детальное логирование HTTP запросов
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`🌐 HTTP ${req.method} ${req.path} - Query: ${JSON.stringify(req.query)} - Body: ${JSON.stringify(req.body)}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`🌐 HTTP ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Логирование HTTP запросов (если включено)
if (config.logging.enableHttpLogging) {
  app.use(logger.httpLogger);
}

// ИСПРАВЛЕННАЯ обслуживание статических файлов с правильными MIME типами
app.use(express.static(path.join(__dirname, '../client'), {
  setHeaders: (res, filePath) => {
    // Устанавливаем правильные MIME типы для разных файлов
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

// 🐛 ДОБАВЛЕНО: Логирование регистрации роутов
logger.info('🔧 Registering API routes...');

// API Routes с префиксом
logger.info(`🔧 Mounting /api/chat routes`);
app.use(`${config.app.apiPrefix}/chat`, chatRoutes);

logger.info(`🔧 Mounting /api/tickets routes`);
app.use(`${config.app.apiPrefix}/tickets`, ticketRoutes);

logger.info(`🔧 Mounting /api/admin routes`);
app.use(`${config.app.apiPrefix}/admin`, adminRoutes);

logger.info(`🔧 Mounting /api/knowledge routes`);
app.use(`${config.app.apiPrefix}/knowledge`, knowledgeRoutes);

logger.info(`🔧 Mounting /api/prompts routes`);
app.use(`${config.app.apiPrefix}/prompts`, promptRoutes);

logger.info(`🔧 Mounting /api/reports routes`);
app.use(`${config.app.apiPrefix}/reports`, reportRoutes); // 📖 НОВОЕ: Маршруты отчетов

logger.info(`🔧 Mounting /api/analytics routes`);
app.use(`${config.app.apiPrefix}/analytics`, analyticsRoutes); // 📊 ИСПРАВЛЕНО: Маршруты аналитики

logger.info(`🔧 Mounting /api/quotes routes`);
app.use(`${config.app.apiPrefix}/quotes`, quotesRoutes); // 📝 НОВОЕ: Маршруты цитат

logger.info(`🔧 Mounting /api/users routes`);
app.use(`${config.app.apiPrefix}/users`, usersRoutes); // 👥 ИСПРАВЛЕНО: Маршруты пользователей

logger.info('✅ All API routes registered successfully');

// Health check endpoint
app.get(`${config.app.apiPrefix}/health`, async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    const vectorHealth = config.features.enableRAG 
      ? await vectorStoreService.healthCheck() 
      : { status: 'disabled' };

    const aiProviderInfo = claude.getProviderInfo();
    const promptHealth = await promptService.diagnose();
    const pendingTicketsStats = ticketEmailService.getPendingTicketsStats();
    
    // 📖 НОВОЕ: Статус cron задач
    const cronStatus = cronService.getJobsStatus();

    // 📊 НОВОЕ: Проверка сервиса аналитики
    let analyticsHealth = { status: 'ok' };
    try {
      // Простая проверка доступности моделей аналитики
      const { UTMClick, PromoCodeUsage } = require('./models');
      await UTMClick.countDocuments().limit(1);
      await PromoCodeUsage.countDocuments().limit(1);
      analyticsHealth.modelsAvailable = true;
    } catch (error) {
      analyticsHealth = { status: 'error', error: error.message, modelsAvailable: false };
    }

    // 👥 НОВОЕ: Проверка пользовательских роутов
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

    // 📝 НОВОЕ: Проверка сервиса цитат
    let quotesHealth = { status: 'ok' };
    try {
      const Quote = require('./models/quote');
      await Quote.countDocuments().limit(1);
      quotesHealth.modelsAvailable = true;
    } catch (error) {
      quotesHealth = { status: 'error', error: error.message, modelsAvailable: false };
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
        cron: cronStatus.totalJobs > 0 ? 'ok' : 'stopped', // 📖 НОВОЕ: исправлено
        analytics: analyticsHealth.status, // 📊 НОВОЕ
        users: usersHealth.status, // 👥 НОВОЕ
        quotes: quotesHealth.status // 📝 НОВОЕ
      },
      aiProvider: aiProviderInfo,
      promptService: {
        status: promptHealth.status,
        cacheStats: promptHealth.cacheStats,
        databaseConnection: promptHealth.databaseConnection
      },
      ticketEmailService: pendingTicketsStats,
      languageService: simpleLanguageService.getStats(),
      // 📖 НОВОЕ: Информация о cron задачах
      cronService: {
        ...cronStatus,
        nextRuns: {
          weeklyReports: cronService.getNextRunTime('weekly_reports'),
          dailyReminders: cronService.getNextRunTime('daily_reminders'),
          monthlyReports: cronService.getNextRunTime('monthly_reports'),
          dailyCleanup: cronService.getNextRunTime('daily_cleanup')
        }
      },
      // 📊 НОВОЕ: Информация о сервисе аналитики
      analyticsService: analyticsHealth,
      // 👥 НОВОЕ: Информация о пользовательском сервисе
      usersService: usersHealth,
      // 📝 НОВОЕ: Информация о сервисе цитат
      quotesService: quotesHealth,
      features: config.features,
      // ДОБАВЛЕНО: информация о Socket.IO подключениях
      socketConnections: {
        total: io.engine.clientsCount,
        active: io.sockets.sockets.size,
        byIP: getConnectionsByIP()
      }
    };

    // Если какой-то сервис неработоспособен, возвращаем 503
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

// Остальная часть кода остается без изменений...
// (включая Socket.IO, graceful shutdown, и прочие функции)

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