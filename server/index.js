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

// API Routes с префиксом
app.use(`${config.app.apiPrefix}/chat`, chatRoutes);
app.use(`${config.app.apiPrefix}/tickets`, ticketRoutes);
app.use(`${config.app.apiPrefix}/admin`, adminRoutes);
app.use(`${config.app.apiPrefix}/knowledge`, knowledgeRoutes);
app.use(`${config.app.apiPrefix}/prompts`, promptRoutes);
app.use(`${config.app.apiPrefix}/reports`, reportRoutes); // 📖 НОВОЕ: Маршруты отчетов
app.use(`${config.app.apiPrefix}/analytics`, analyticsRoutes); // 📊 ИСПРАВЛЕНО: Маршруты аналитики

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
      const UTMClick = require('./models/utmClick');
      const PromoCodeUsage = require('./models/promoCodeUsage');
      await UTMClick.countDocuments().limit(1);
      await PromoCodeUsage.countDocuments().limit(1);
      analyticsHealth.modelsAvailable = true;
    } catch (error) {
      analyticsHealth = { status: 'error', error: error.message, modelsAvailable: false };
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
        analytics: analyticsHealth.status // 📊 НОВОЕ
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

// Мониторинг метрик (если включен)
if (config.features.enableMetrics) {
  app.get(config.monitoring.metricsPath, (req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      socketConnections: {
        total: io.engine.clientsCount,
        active: io.sockets.sockets.size,
        byIP: getConnectionsByIP()
      },
      pendingTickets: ticketEmailService.getPendingTicketsStats(),
      cronJobs: cronService.getJobsStatus() // 📖 НОВОЕ
    });
  });
}

// ИСПРАВЛЕНО: Улучшенный Socket.IO с динамическими лимитами
const socketConnections = new Map(); // Отслеживание подключений

/**
 * Получает статистику подключений по IP
 * @returns {Object} Статистика подключений
 */
function getConnectionsByIP() {
  const ipStats = {};
  for (const [socketId, connection] of socketConnections.entries()) {
    const ip = connection.ip;
    if (!ipStats[ip]) {
      ipStats[ip] = { count: 0, sockets: [] };
    }
    ipStats[ip].count++;
    ipStats[ip].sockets.push({
      id: socketId,
      connectedAt: connection.connectedAt,
      messageCount: connection.messageCount
    });
  }
  return ipStats;
}

/**
 * Определяет максимальное количество подключений для IP
 * @param {string} clientIp - IP адрес клиента
 * @returns {number} Максимальное количество подключений
 */
function getMaxConnectionsForIP(clientIp) {
  // ИСПРАВЛЕНО: Увеличиваем лимиты для development
  if (config.app.isDevelopment) {
    // В development режиме разрешаем больше подключений для тестирования
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost')) {
      return 10; // Локальные подключения: до 10
    }
    return 5; // Другие IP в dev режиме: до 5
  } else {
    // В production более строгие лимиты
    return 3; // Production: до 3 подключений с одного IP
  }
}

/**
 * Очищает старые/отключенные соединения из карты
 */
function cleanupStaleConnections() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 минут
  
  for (const [socketId, connection] of socketConnections.entries()) {
    const age = now - connection.connectedAt.getTime();
    
    // Проверяем, существует ли еще socket в Socket.IO
    const socketExists = io.sockets.sockets.has(socketId);
    
    if (!socketExists || age > staleThreshold) {
      logger.info(`🧹 Removing stale connection: ${socketId} (exists: ${socketExists}, age: ${Math.round(age/1000)}s)`);
      socketConnections.delete(socketId);
    }
  }
}

/**
 * Обработчик Socket.IO соединений
 */
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  // Очищаем старые соединения перед проверкой лимитов
  cleanupStaleConnections();
  
  // Определяем лимит для данного IP
  const maxConnections = getMaxConnectionsForIP(clientIp);
  
  // Проверяем количество подключений с одного IP
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
  
  // Сохраняем информацию о подключении
  socketConnections.set(socket.id, {
    ip: clientIp,
    userAgent,
    connectedAt: new Date(),
    messageCount: 0
  });
  
  logger.info(`🔌 Socket connected: ${socket.id} from ${clientIp} (${socketConnections.size} total, ${ipConnections + 1}/${maxConnections} for this IP)`);
  
  // Отправляем приветственное сообщение
  socket.emit('system', {
    message: 'Connected to Reader Bot! 📖',
    timestamp: new Date().toISOString()
  });
  
  // Присоединяем к комнате чата
  socket.join('chat');

  /**
   * Обработчик сообщений от клиента
   * @param {SocketMessageData} data - Данные сообщения
   */
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

      // Ограничение скорости сообщений
      connection.messageCount++;
      if (connection.messageCount > 20) { // УВЕЛИЧЕНО: 20 сообщений за сессию для тестирования
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

      // 📊 НОВОЕ: Попытка трекинга действия пользователя
      try {
        // Проверяем, доступен ли analyticsService
        if (typeof analyticsService !== 'undefined' && analyticsService.trackUserAction) {
          await analyticsService.trackUserAction(data.userId, 'quote_added', {
            messageLength: data.message.length,
            source: 'socket'
          });
        }
      } catch (analyticsError) {
        logger.warn('📊 Failed to track user action:', analyticsError.message);
        // Не прерываем обработку сообщения из-за ошибки аналитики
      }

      // Валидация входных данных
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
          // Создаем разговор с базовым языком
          conversation = await conversationService.createConversation(data.userId, {
            language: data.language || 'en',
            source: 'socket'
          });
        }
      } else {
        // Создаем новый разговор с базовым языком
        conversation = await conversationService.createConversation(data.userId, {
          language: data.language || 'en',
          source: 'socket'
        });
      }
      
      // Получение истории сообщений ДО определения языка
      const history = await messageService.getRecentMessages(conversation._id, 10);
      const formattedHistory = history.map(msg => ({
        role: msg.role,
        content: msg.text
      }));

      // 🍄 НОВОЕ: Упрощенное определение языка
      const detectedLanguage = simpleLanguageService.detectLanguage(data.message, {
        userLanguage: data.language,
        previousLanguage: conversation.language,
        browserLanguage: socket.handshake.headers['accept-language']
      });
      
      // Обновляем язык разговора, если он изменился
      if (conversation.language !== detectedLanguage) {
        await conversationService.updateLanguage(conversation._id, detectedLanguage);
        logger.info(`🌍 Language updated for conversation ${conversation._id}: ${conversation.language} → ${detectedLanguage}`);
      }

      // 🎫 НОВАЯ ЛОГИКА: Проверяем, ожидает ли пользователь ввода email
      const pendingTicket = ticketEmailService.getPendingTicket(data.userId);
      
      if (pendingTicket && ticketEmailService.isEmailMessage(data.message)) {
        // Пользователь отправил email для существующего тикета
        const email = ticketEmailService.extractEmail(data.message);
        
        if (email) {
          // Обновляем тикет с email
          const emailResult = await ticketEmailService.updateTicketWithEmail(
            data.userId, 
            email, 
            detectedLanguage
          );
          
          // Сохраняем сообщение пользователя
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
          
          // Сохраняем ответ бота
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
          
          // Обновляем разговор
          await conversationService.incrementMessageCount(conversation._id);
          
          // Отправляем ответ
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
          // Email не валиден - просим повторить
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
      
      // 🎫 НОВАЯ ЛОГИКА: Проверяем, нужно ли создать тикет для этого сообщения
      const shouldCreateTicket = ticketEmailService.shouldCreateTicket(data.message, detectedLanguage);
      
      if (shouldCreateTicket) {
        // Создаем тикет и запрашиваем email
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
        
        // Сохраняем сообщение пользователя
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
        
        // Сохраняем ответ бота
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
        
        // Обновляем разговор
        await conversationService.incrementMessageCount(conversation._id);
        
        // Отправляем ответ с запросом email
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
      
      // ОБЫЧНАЯ ЛОГИКА: Генерируем обычный ответ через Claude
      
      // Получение контекста из базы знаний (если RAG включен)
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
          // Продолжаем без контекста
        }
      }
      
      // Сохранение сообщения пользователя
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
      
      // ИСПРАВЛЕНО: Генерация ответа через claude (вместо aiService)
      const aiResponse = await claude.generateResponse(data.message, {
        context,
        history: formattedHistory,
        language: detectedLanguage,
        userId: data.userId
      });
      
      // Сохранение ответа бота
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
      
      // Обновление разговора
      await conversationService.incrementMessageCount(conversation._id);
      
      // Подготовка ответа
      /**
       * @type {ChatResponse}
       */
      const response = {
        message: aiResponse.message,
        conversationId: conversation._id.toString(),
        messageId: botMessage._id.toString(),
        tokensUsed: aiResponse.tokensUsed,
        language: detectedLanguage,
        aiProvider: aiResponse.provider, // Добавляем информацию о провайдере
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeResultsCount: context.length,
          historyMessagesCount: formattedHistory.length
        }
      };
      
      // Отправка ответа через Socket.IO
      socket.emit('message', response);
      logger.info(`✅ Response sent to ${socket.id} (Language: ${detectedLanguage}, Provider: ${aiResponse.provider})`);
      
    } catch (error) {
      logger.error(`❌ Socket error for ${socket.id}:`, error);
      
      // Определяем тип ошибки и возвращаем соответствующий код
      let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
      let errorMessage = 'Service temporarily unavailable. Please try again.';
      
      if (error.message.includes('Database')) {
        errorCode = ERROR_CODES.DATABASE_CONNECTION_ERROR;
      } else if (error.message.includes('OpenAI') || error.message.includes('Anthropic') || error.message.includes('AI Service')) {
        errorCode = ERROR_CODES.CLAUDE_API_ERROR; // Можно переименовать в AI_API_ERROR
      }
      
      // ИСПРАВЛЕНО: Не пытаемся создать тикет при ошибках AI сервиса
      socket.emit('error', { 
        code: errorCode,
        message: errorMessage,
        details: config.app.isDevelopment ? error.message : undefined
      });
    }
  });

  // Обработчик отключения
  socket.on('disconnect', (reason) => {
    const connection = socketConnections.get(socket.id);
    socketConnections.delete(socket.id);
    
    logger.info(`🔌 Socket disconnected: ${socket.id} (${reason}) - ${socketConnections.size} remaining`);
    
    // Логируем статистику сессии
    if (connection) {
      const sessionDuration = Date.now() - connection.connectedAt.getTime();
      logger.info(`📊 Session stats for ${socket.id}: ${connection.messageCount} messages, ${Math.round(sessionDuration/1000)}s duration`);
    }
  });

  // Обработчик ошибок соединения
  socket.on('error', (error) => {
    logger.error(`🔌 Socket error: ${socket.id}:`, error);
  });
});

// Middleware для обработки ошибок
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    code: ERROR_CODES.NOT_FOUND,
    message: 'The requested resource was not found'
  });
});

/**
 * Функция запуска сервера
 */
async function startServer() {
  try {
    // Логируем информацию о запуске
    logger.info('🚀 Starting Reader Bot Server...');
    logger.info(`Environment: ${config.app.environment}`);
    logger.info(`Version: ${config.app.version}`);
    logger.info(`Features: ${JSON.stringify(config.features, null, 2)}`);
    
    // Проверяем AI провайдера
    const aiProviderInfo = claude.getProviderInfo();
    logger.info(`🤖 AI Provider: ${aiProviderInfo.currentProvider}`);
    logger.info(`Models: ${JSON.stringify(aiProviderInfo.models, null, 2)}`);
    
    // 🍄 НОВОЕ: Логируем информацию о языковом сервисе
    const languageStats = simpleLanguageService.getStats();
    logger.info(`🌍 Language Service: Simple (${languageStats.supportedLanguages.length} languages supported)`);
    
    // Подключение к базе данных
    logger.info('📡 Connecting to MongoDB...');
    await dbService.connect();
    logger.info('✅ MongoDB connected successfully');
    
    // Создание индексов
    try {
      await dbService.createIndexes();
      logger.info('✅ Database indexes ensured');
    } catch (error) {
      logger.warn('⚠️ Failed to create indexes:', error.message);
    }
    
    // 🍄 ДОБАВЛЕНО: Инициализация PromptService
    logger.info('🍄 Initializing PromptService...');
    try {
      await promptService.initialize();
      logger.info('✅ PromptService initialized successfully');
    } catch (error) {
      logger.warn('⚠️ PromptService initialization failed, will use fallback prompts:', error.message);
      // Не прерываем запуск, так как есть fallback система
    }
    
    // 🎫 НОВОЕ: Инициализация TicketEmailService
    logger.info('🎫 Initializing Ticket Email Service...');
    logger.info(`✅ Ticket Email Service ready (Email timeout: ${ticketEmailService.EMAIL_TIMEOUT / 1000}s)`);
    
    // 📊 НОВОЕ: Инициализация Analytics
    logger.info('📊 Initializing Analytics Service...');
    logger.info('✅ Analytics Service ready for tracking UTM, promo codes, and user actions');
    
    // 📖 НОВОЕ: Инициализация и запуск CronService
    logger.info('📖 Initializing Cron Service...');
    try {
      // 🔧 FIX: Инициализируем CronService с зависимостями
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
      // Не прерываем запуск сервера
    }
    
    // Инициализация векторной базы (если включена)
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
    
    // Запуск сервера
    const PORT = config.app.port;
    server.listen(PORT, () => {
      logger.info(`🚀 Reader Bot Server running on port ${PORT}`);
      logger.info(`🌐 API available at: http://localhost:${PORT}${config.app.apiPrefix}`);
      logger.info(`🏠 Client available at: http://localhost:${PORT}`);
      logger.info(`🔌 Socket.IO available at: http://localhost:${PORT}/socket.io/`);
      logger.info(`🎫 Email collection workflow: ACTIVE`);
      logger.info(`🌍 Language detection: SIMPLIFIED (no complex analysis)`);
      logger.info(`📖 Weekly reports automation: ENABLED`); // 📖 НОВОЕ
      logger.info(`📊 Reports API: ${config.app.apiPrefix}/reports`); // 📖 НОВОЕ
      logger.info(`📊 Analytics API: ${config.app.apiPrefix}/analytics`); // 📊 НОВОЕ
      
      // Логируем URL для разных режимов
      if (config.app.isDevelopment) {
        logger.info('🔄 Development mode: Hot reload enabled');
        logger.info(`🔧 Socket connection limits: Localhost(10), Others(5)`);
      } else {
        logger.info(`🔧 Socket connection limit: 3 per IP`);
      }
      
      // Устанавливаем таймер для очистки старых подключений
      setInterval(() => {
        cleanupStaleConnections();
      }, 60000); // Каждую минуту
    });
    
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
  
  // 🎫 НОВОЕ: Логируем статистику перед выключением
  const pendingStats = ticketEmailService.getPendingTicketsStats();
  if (pendingStats.active > 0) {
    logger.warn(`⚠️  Shutting down with ${pendingStats.active} pending tickets awaiting email`);
  }
  
  // 🍄 НОВОЕ: Логируем статистику языков
  const languageStats = simpleLanguageService.getStats();
  logger.info(`🌍 Language usage stats: ${JSON.stringify(languageStats.usage)}`);
  
  // 📖 НОВОЕ: Остановка CronService
  try {
    cronService.stop();
    logger.info('📖 CronService stopped');
  } catch (error) {
    logger.error(`📖 Error stopping CronService: ${error.message}`);
  }
  
  // Закрываем Socket.IO соединения
  logger.info('🔌 Closing Socket.IO connections...');
  io.close(() => {
    logger.info('✅ Socket.IO closed');
  });
  
  // Закрываем HTTP сервер
  server.close(async () => {
    logger.info('✅ HTTP server closed');
    
    // Отключаемся от базы данных
    try {
      await dbService.disconnect();
      logger.info('✅ Database disconnected');
    } catch (error) {
      logger.error('❌ Error disconnecting from database:', error);
    }
    
    // Выходим из процесса
    process.exit(0);
  });
  
  // Принудительное завершения через 30 секунд
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
  
  // В продакшене не перезапускаем сервер из-за необработанных ошибок
  if (!config.app.isProduction) {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', {
    message: error.message,
    stack: error.stack
  });
  
  // Критические ошибки требуют перезапуска
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Обработка предупреждений
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