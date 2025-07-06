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
const reportRoutes = require('./api/reports'); // 📖 Маршруты отчетов
const analyticsRoutes = require('./api/analytics'); // 📊 Маршруты аналитики

// 🐛 ДИАГНОСТИКА: Безопасный импорт routes с обработкой ошибок
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
        quotes: quotesHealth.status
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

// Socket.IO connection handling
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

function cleanupStaleConnections() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 минут
  
  for (const [socketId, connection] of socketConnections.entries()) {
    const age = now - connection.connectedAt.getTime();
    const socketExists = io.sockets.sockets.has(socketId);
    
    if (!socketExists || age > staleThreshold) {
      logger.info(`🧹 Removing stale connection: ${socketId} (exists: ${socketExists}, age: ${Math.round(age/1000)}s)`);
      socketConnections.delete(socketId);
    }
  }
}

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  cleanupStaleConnections();
  
  const maxConnections = getMaxConnectionsForIP(clientIp);
  const ipConnections = Array.from(socketConnections.values())
    .filter(conn => conn.ip === clientIp).length;
  
  if (ipConnections >= maxConnections) {
    logger.warn(`🚫 Too many connections from IP: ${clientIp} (${ipConnections}/${maxConnections})`);
    socket.emit('error', {
      code: 'TOO_MANY_CONNECTIONS',
      message: `Too many connections from your IP address (${ipConnections}/${maxConnections}). Please close some browser tabs.`
    });
    socket.disconnect(true);
    return;
  }
  
  socketConnections.set(socket.id, {
    ip: clientIp,
    userAgent,
    connectedAt: new Date(),
    messageCount: 0
  });
  
  logger.info(`🔌 Socket connected: ${socket.id} from ${clientIp} (${socketConnections.size} total, ${ipConnections + 1}/${maxConnections} for this IP)`);
  
  socket.emit('system', {
    message: 'Connected to Reader Bot! 📖',
    timestamp: new Date().toISOString()
  });
  
  socket.join('chat');

  socket.on('sendMessage', async (data) => {
    try {
      const connection = socketConnections.get(socket.id);
      if (!connection) {
        socket.emit('error', {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Connection not found'
        });
        return;
      }

      connection.messageCount++;
      if (connection.messageCount > 20) {
        socket.emit('error', {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages. Please slow down.'
        });
        return;
      }

      logger.info(`📨 Message received from ${socket.id}:`, {
        message: data.message,
        userId: data.userId,
        messageCount: connection.messageCount
      });

      if (!data.message || !data.userId) {
        socket.emit('error', {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Message and userId are required'
        });
        return;
      }

      // Получение или создание разговора
      let conversation;
      if (data.conversationId) {
        conversation = await conversationService.getConversationById(data.conversationId);
        if (!conversation) {
          logger.warn(`Conversation ${data.conversationId} not found, creating new one`);
          conversation = await conversationService.createConversation(data.userId, {
            language: data.language || 'en',
            source: 'socket'
          });
        }
      } else {
        conversation = await conversationService.createConversation(data.userId, {
          language: data.language || 'en',
          source: 'socket'
        });
      }
      
      const history = await messageService.getRecentMessages(conversation._id, 10);
      const formattedHistory = history.map(msg => ({
        role: msg.role,
        content: msg.text
      }));

      const detectedLanguage = simpleLanguageService.detectLanguage(data.message, {
        userLanguage: data.language,
        previousLanguage: conversation.language,
        browserLanguage: socket.handshake.headers['accept-language']
      });
      
      if (conversation.language !== detectedLanguage) {
        await conversationService.updateLanguage(conversation._id, detectedLanguage);
        logger.info(`🌍 Language updated for conversation ${conversation._id}: ${conversation.language} → ${detectedLanguage}`);
      }

      // Проверка на создание тикета
      const pendingTicket = ticketEmailService.getPendingTicket(data.userId);
      
      if (pendingTicket && ticketEmailService.isEmailMessage(data.message)) {
        const email = ticketEmailService.extractEmail(data.message);
        
        if (email) {
          const emailResult = await ticketEmailService.updateTicketWithEmail(
            data.userId, 
            email, 
            detectedLanguage
          );
          
          await messageService.create({
            text: data.message,
            role: 'user',
            userId: data.userId,
            conversationId: conversation._id,
            metadata: { 
              language: detectedLanguage,
              source: 'socket',
              isEmailResponse: true,
              ticketId: pendingTicket.ticketId
            }
          });
          
          const botMessage = await messageService.create({
            text: emailResult.message,
            role: 'assistant',
            userId: data.userId,
            conversationId: conversation._id,
            metadata: {
              language: detectedLanguage,
              source: 'socket',
              ticketEmailCollected: true,
              ticketId: pendingTicket.ticketId
            }
          });
          
          await conversationService.incrementMessageCount(conversation._id);
          
          socket.emit('message', {
            message: emailResult.message,
            conversationId: conversation._id.toString(),
            messageId: botMessage._id.toString(),
            language: detectedLanguage,
            timestamp: new Date().toISOString(),
            emailCollected: true,
            ticketId: pendingTicket.ticketId
          });
          
          logger.info(`✅ Email collected for ticket: ${pendingTicket.ticketId} - ${email}`);
          return;
        } else {
          const errorMessage = detectedLanguage === 'ru' 
            ? "Пожалуйста, введите корректный email адрес (например: user@gmail.com):"
            : detectedLanguage === 'es'
            ? "Por favor, ingresa una dirección de email válida (ejemplo: user@gmail.com):"
            : "Please enter a valid email address (example: user@gmail.com):";
          
          socket.emit('message', {
            message: errorMessage,
            conversationId: conversation._id.toString(),
            language: detectedLanguage,
            timestamp: new Date().toISOString(),
            awaitingEmail: true
          });
          return;
        }
      }
      
      const shouldCreateTicket = ticketEmailService.shouldCreateTicket(data.message, detectedLanguage);
      
      if (shouldCreateTicket) {
        const ticketResult = await ticketEmailService.createPendingTicket({
          userId: data.userId,
          conversationId: conversation._id,
          subject: `Support request: ${data.message.substring(0, 50)}...`,
          initialMessage: data.message,
          context: JSON.stringify({
            userMessage: data.message,
            history: formattedHistory.slice(-3)
          }),
          language: detectedLanguage,
          category: 'technical',
          priority: 'medium',
          metadata: {
            source: 'socket',
            detectedProblem: true
          }
        });
        
        await messageService.create({
          text: data.message,
          role: 'user',
          userId: data.userId,
          conversationId: conversation._id,
          metadata: { 
            language: detectedLanguage,
            source: 'socket',
            ticketCreated: true,
            ticketId: ticketResult.ticket.ticketId
          }
        });
        
        const botMessage = await messageService.create({
          text: ticketResult.message,
          role: 'assistant',
          userId: data.userId,
          conversationId: conversation._id,
          metadata: {
            language: detectedLanguage,
            source: 'socket',
            ticketCreated: true,
            ticketId: ticketResult.ticket.ticketId,
            awaitingEmailResponse: true
          }
        });
        
        await conversationService.incrementMessageCount(conversation._id);
        
        socket.emit('message', {
          message: ticketResult.message,
          conversationId: conversation._id.toString(),
          messageId: botMessage._id.toString(),
          language: detectedLanguage,
          timestamp: new Date().toISOString(),
          ticketCreated: true,
          ticketId: ticketResult.ticket.ticketId,
          awaitingEmail: true
        });
        
        logger.info(`🎫 Ticket created and email requested: ${ticketResult.ticket.ticketId}`);
        return;
      }
      
      // Обычная логика генерации ответа
      let context = [];
      if (config.features.enableRAG) {
        try {
          const contextResults = await vectorStoreService.search(data.message, {
            limit: config.vectorStore.searchLimit,
            language: detectedLanguage
          });
          context = contextResults.map(result => result.content);
        } catch (error) {
          logger.warn('Failed to get context from vector store:', error.message);
        }
      }
      
      const userMessage = await messageService.create({
        text: data.message,
        role: 'user',
        userId: data.userId,
        conversationId: conversation._id,
        metadata: { 
          language: detectedLanguage,
          source: 'socket'
        }
      });
      
      const aiResponse = await claude.generateResponse(data.message, {
        context,
        history: formattedHistory,
        language: detectedLanguage,
        userId: data.userId
      });
      
      const botMessage = await messageService.create({
        text: aiResponse.message,
        role: 'assistant',
        userId: data.userId,
        conversationId: conversation._id,
        metadata: {
          language: detectedLanguage,
          tokensUsed: aiResponse.tokensUsed,
          source: 'socket',
          aiProvider: aiResponse.provider
        }
      });
      
      await conversationService.incrementMessageCount(conversation._id);
      
      const response = {
        message: aiResponse.message,
        conversationId: conversation._id.toString(),
        messageId: botMessage._id.toString(),
        tokensUsed: aiResponse.tokensUsed,
        language: detectedLanguage,
        aiProvider: aiResponse.provider,
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeResultsCount: context.length,
          historyMessagesCount: formattedHistory.length
        }
      };
      
      socket.emit('message', response);
      logger.info(`✅ Response sent to ${socket.id} (Language: ${detectedLanguage}, Provider: ${aiResponse.provider})`);
      
    } catch (error) {
      logger.error(`❌ Socket error for ${socket.id}:`, error);
      
      let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
      let errorMessage = 'Service temporarily unavailable. Please try again.';
      
      if (error.message.includes('Database')) {
        errorCode = ERROR_CODES.DATABASE_CONNECTION_ERROR;
      } else if (error.message.includes('OpenAI') || error.message.includes('Anthropic') || error.message.includes('AI Service')) {
        errorCode = ERROR_CODES.CLAUDE_API_ERROR;
      }
      
      socket.emit('error', { 
        code: errorCode,
        message: errorMessage,
        details: config.app.isDevelopment ? error.message : undefined
      });
    }
  });

  socket.on('disconnect', (reason) => {
    const connection = socketConnections.get(socket.id);
    socketConnections.delete(socket.id);
    
    logger.info(`🔌 Socket disconnected: ${socket.id} (${reason}) - ${socketConnections.size} remaining`);
    
    if (connection) {
      const sessionDuration = Date.now() - connection.connectedAt.getTime();
      logger.info(`📊 Session stats for ${socket.id}: ${connection.messageCount} messages, ${Math.round(sessionDuration/1000)}s duration`);
    }
  });

  socket.on('error', (error) => {
    logger.error(`🔌 Socket error: ${socket.id}:`, error);
  });
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
    logger.info(`Features: ${JSON.stringify(config.features, null, 2)}`);
    
    const aiProviderInfo = claude.getProviderInfo();
    logger.info(`🤖 AI Provider: ${aiProviderInfo.currentProvider}`);
    logger.info(`Models: ${JSON.stringify(aiProviderInfo.models, null, 2)}`);
    
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
    
    logger.info('🎫 Initializing Ticket Email Service...');
    logger.info(`✅ Ticket Email Service ready (Email timeout: ${ticketEmailService.EMAIL_TIMEOUT / 1000}s)`);
    
    logger.info('📊 Initializing Analytics Service...');
    logger.info('✅ Analytics Service ready for tracking UTM, promo codes, and user actions');
    
    logger.info('👥 Initializing Users Service...');
    logger.info('✅ Users Service ready with API endpoints /api/users/*');
    
    logger.info('📝 Initializing Quotes Service...');
    logger.info('✅ Quotes Service ready with API endpoints /api/quotes/*');
    
    // 📖 Безопасная инициализация CronService
    if (cronService) {
      logger.info('📖 Initializing Cron Service...');
      try {
        cronService.initialize(null, telegramReportService, null);
        cronService.start();
        
        const cronStatus = cronService.getJobsStatus();
        logger.info(`✅ Cron Service started with ${cronStatus.totalJobs} scheduled tasks`);
        logger.info(`📖 Weekly reports: Sundays at 11:00 MSK`);
        logger.info(`📖 Daily reminders: 9:00 and 19:00 MSK`);
        logger.info(`📖 Monthly reports: 1st day of month at 12:00 MSK`);
        logger.info(`📖 Daily cleanup: 3:00 MSK`);
        
      } catch (error) {
        logger.error(`❌ CronService initialization failed: ${error.message}`);
      }
    } else {
      logger.info('📖 CronService not available - skipping cron initialization');
    }
    
    logger.info('📖 Telegram bot will be started separately via telegram/start.js');
    
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
    logger.info(`🔌 Socket.IO available at: http://localhost:${PORT}/socket.io/`);
    logger.info(`🎫 Email collection workflow: ACTIVE`);
    logger.info(`🌍 Language detection: SIMPLIFIED (no complex analysis)`);
    logger.info(`📖 Weekly reports automation: ${cronService ? 'ENABLED' : 'DISABLED'}`);
    logger.info(`📊 Reports API: ${config.app.apiPrefix}/reports`);
    logger.info(`📊 Analytics API: ${config.app.apiPrefix}/analytics`);
    logger.info(`👥 Users API: ${config.app.apiPrefix}/users`);
    logger.info(`📝 Quotes API: ${config.app.apiPrefix}/quotes`);
    
    if (config.app.isDevelopment) {
      logger.info('🔄 Development mode: Hot reload enabled');
      logger.info(`🔧 Socket connection limits: Localhost(10), Others(5)`);
    } else {
      logger.info(`🔧 Socket connection limit: 3 per IP`);
    }
    
    setInterval(() => {
      cleanupStaleConnections();
    }, 60000);
    
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
  
  const pendingStats = ticketEmailService.getPendingTicketsStats();
  if (pendingStats.active > 0) {
    logger.warn(`⚠️  Shutting down with ${pendingStats.active} pending tickets awaiting email`);
  }
  
  const languageStats = simpleLanguageService.getStats();
  logger.info(`🌍 Language usage stats: ${JSON.stringify(languageStats.usage)}`);
  
  if (cronService) {
    try {
      cronService.stop();
      logger.info('📖 CronService stopped');
    } catch (error) {
      logger.error(`📖 Error stopping CronService: ${error.message}`);
    }
  }
  
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

process.on('warning', (warning) => {
  logger.warn('⚠️ Process Warning:', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  });
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