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
const reportRoutes = require('./api/reports');
const analyticsRoutes = require('./api/analytics');

// 🐛 ДИАГНОСТИКА: Безопасный импорт users routes и quotes routes
let usersRoutes, quotesRoutes;

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

// Helper function for connection stats
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
        language: simpleLanguageService.healthCheck()
      },
      aiProvider: aiProviderInfo,
      promptService: {
        status: promptHealth.status,
        cacheStats: promptHealth.cacheStats,
        databaseConnection: promptHealth.databaseConnection
      },
      ticketEmailService: pendingTicketsStats,
      languageService: simpleLanguageService.getStats(),
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

// 404 handler для API
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} from ${socket.handshake.address}`);

  socket.on('join-conversation', (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
      logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
    }
  });

  socket.on('leave-conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
      logger.info(`Socket ${socket.id} left conversation ${conversationId}`);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
});

// Global error handler
app.use(errorHandler);

/**
 * Запуск сервера
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    logger.info('🚀 Starting Reader Bot server...');
    
    // Инициализация базы данных
    logger.info('📊 Connecting to database...');
    await dbService.connect();
    logger.info('✅ Database connected successfully');

    // Инициализация векторного хранилища (если включено)
    if (config.features.enableRAG) {
      logger.info('🔍 Initializing vector store...');
      await vectorStoreService.initialize();
      logger.info('✅ Vector store initialized');
    }

    // Инициализация сервиса промптов
    logger.info('📝 Initializing prompt service...');
    await promptService.initialize();
    logger.info('✅ Prompt service initialized');

    // Инициализация языкового сервиса
    logger.info('🌍 Initializing language service...');
    await simpleLanguageService.initialize();
    logger.info('✅ Language service initialized');

    // Инициализация сервиса тикетов
    logger.info('🎫 Initializing ticket service...');
    await ticketService.initialize();
    logger.info('✅ Ticket service initialized');

    // Инициализация email сервиса для тикетов
    logger.info('📧 Initializing ticket email service...');
    await ticketEmailService.initialize();
    logger.info('✅ Ticket email service initialized');

    // Запуск HTTP сервера
    const port = config.app.port;
    await new Promise((resolve, reject) => {
      server.listen(port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    logger.info(`✅ Reader Bot server running on port ${port}`);
    logger.info(`🌐 Environment: ${config.app.environment}`);
    logger.info(`🔧 Admin panel: http://localhost:${port}/admin`);
    logger.info(`📊 Health check: http://localhost:${port}${config.app.apiPrefix}/health`);

  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    throw error;
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`📴 Received ${signal}, starting graceful shutdown...`);

  try {
    // Закрываем HTTP сервер
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('✅ HTTP server closed');
        resolve();
      });
    });

    // Закрываем Socket.IO подключения
    io.close(() => {
      logger.info('✅ Socket.IO server closed');
    });

    // Закрываем подключение к базе данных
    if (dbService) {
      await dbService.disconnect();
      logger.info('✅ Database disconnected');
    }

    // Останавливаем векторное хранилище
    if (config.features.enableRAG && vectorStoreService) {
      await vectorStoreService.cleanup();
      logger.info('✅ Vector store cleaned up');
    }

    // Останавливаем email сервис
    if (ticketEmailService) {
      await ticketEmailService.cleanup();
      logger.info('✅ Ticket email service stopped');
    }

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Обработчики сигналов
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработчик необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
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