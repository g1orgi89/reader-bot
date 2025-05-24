/**
 * Основной файл сервера для Shrooms AI Support Bot
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
const promptRoutes = require('./api/prompts'); // ДОБАВЛЕНО: импорт роута промптов

// Services
const dbService = require('./services/database');
const vectorStoreService = require('./services/vectorStore');
const claude = require('./services/claude'); // ИЗМЕНЕНО: claude вместо aiService
const promptService = require('./services/promptService'); // 🍄 ДОБАВЛЕНО: PromptService
const languageDetectService = require('./services/languageDetect');
const conversationService = require('./services/conversation');
const messageService = require('./services/message');
const ticketService = require('./services/ticketing');

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
app.use(`${config.app.apiPrefix}/prompts`, promptRoutes); // ДОБАВЛЕНО: регистрация роута промптов

// Health check endpoint
app.get(`${config.app.apiPrefix}/health`, async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    const vectorHealth = config.features.enableRAG 
      ? await vectorStoreService.healthCheck() 
      : { status: 'disabled' };

    // ИСПРАВЛЕНО: проверяем claude вместо aiService
    const aiProviderInfo = claude.getProviderInfo();
    
    // 🍄 ДОБАВЛЕНО: проверка здоровья PromptService
    const promptHealth = await promptService.diagnose();

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      services: {
        database: dbHealth,
        vectorStore: vectorHealth,
        ai: claude ? 'ok' : 'error',
        prompts: promptHealth // 🍄 ДОБАВЛЕНО: статус промпт-сервиса
      },
      aiProvider: aiProviderInfo,
      promptService: {
        status: promptHealth.status,
        cacheStats: promptHealth.cacheStats,
        databaseConnection: promptHealth.databaseConnection
      }, // 🍄 ДОБАВЛЕНО: детали PromptService
      features: config.features,
      // ДОБАВЛЕНО: информация о Socket.IO подключениях
      socketConnections: {
        total: io.engine.clientsCount,
        active: io.sockets.sockets.size
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
        active: io.sockets.sockets.size
      }
    });
  });
}

// ИСПРАВЛЕНО: Более контролируемый Socket.IO с логированием и ограничениями
const socketConnections = new Map(); // Отслеживание подключений

/**
 * Обработчик Socket.IO соединений
 */
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  // Проверяем количество подключений с одного IP
  const ipConnections = Array.from(socketConnections.values())
    .filter(conn => conn.ip === clientIp).length;
  
  if (ipConnections >= 3) { // Максимум 3 подключения с одного IP
    logger.warn(`🚫 Too many connections from IP: ${clientIp}`);
    socket.emit('error', {
      code: 'TOO_MANY_CONNECTIONS',
      message: 'Too many connections from your IP address'
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
  
  logger.info(`🔌 Socket connected: ${socket.id} from ${clientIp} (${socketConnections.size} total)`);
  
  // Отправляем приветственное сообщение
  socket.emit('system', {
    message: 'Connected to Shrooms Support Bot! 🍄',
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
      if (connection.messageCount > 10) { // Максимум 10 сообщений за сессию
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

      // ИСПРАВЛЕННОЕ определение языка с учетом контекста
      const detectedLanguage = data.language || 
        languageDetectService.detectLanguageWithContext(data.message, {
          userId: data.userId,
          conversationId: conversation._id.toString(),
          history: formattedHistory,
          previousLanguage: conversation.language
        });
      
      // Обновляем язык разговора, если он изменился
      if (conversation.language !== detectedLanguage) {
        await conversationService.updateLanguage(conversation._id, detectedLanguage);
        logger.info(`🌍 Language updated for conversation ${conversation._id}: ${conversation.language} → ${detectedLanguage}`);
      }
      
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
      
      // Проверка на создание тикета
      let ticketId = null;
      let ticketError = null;
      
      if (aiResponse.needsTicket) {
        try {
          const ticket = await ticketService.createTicket({
            userId: data.userId,
            conversationId: conversation._id,
            initialMessage: data.message, // ИСПРАВЛЕНО: изменено с 'message' на 'initialMessage'
            context: JSON.stringify({
              aiResponse: aiResponse.message,
              userMessage: data.message,
              history: formattedHistory.slice(-3),
              aiProvider: aiResponse.provider // Добавляем информацию о провайдере
            }),
            language: detectedLanguage,
            subject: `Support request: ${data.message.substring(0, 50)}...`,
            category: 'technical',
            metadata: {
              source: 'socket',
              aiProvider: aiResponse.provider
            }
          });
          ticketId = ticket.ticketId;
          logger.info(`🎫 Ticket created: ${ticketId} via ${aiResponse.provider}`);
        } catch (error) {
          logger.error('Failed to create ticket:', error);
          ticketError = error.message;
        }
      }
      
      // Замена TICKET_ID в ответе
      let botResponse = aiResponse.message;
      if (ticketId) {
        botResponse = botResponse.replace('#TICKET_ID', `#${ticketId}`);
      }
      
      // Сохранение ответа бота
      const botMessage = await messageService.create({
        text: botResponse,
        role: 'assistant',
        userId: data.userId,
        conversationId: conversation._id,
        metadata: {
          language: detectedLanguage,
          tokensUsed: aiResponse.tokensUsed,
          ticketCreated: aiResponse.needsTicket,
          ticketId,
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
        message: botResponse,
        conversationId: conversation._id.toString(),
        messageId: botMessage._id.toString(),
        needsTicket: aiResponse.needsTicket,
        ticketId,
        ticketError,
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
    logger.info('🚀 Starting Shrooms Support Bot Server...');
    logger.info(`Environment: ${config.app.environment}`);
    logger.info(`Version: ${config.app.version}`);
    logger.info(`Features: ${JSON.stringify(config.features, null, 2)}`);
    
    // Проверяем AI провайдера
    const aiProviderInfo = claude.getProviderInfo();
    logger.info(`🤖 AI Provider: ${aiProviderInfo.currentProvider}`);
    logger.info(`Models: ${JSON.stringify(aiProviderInfo.models, null, 2)}`);
    
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
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌐 API available at: http://localhost:${PORT}${config.app.apiPrefix}`);
      logger.info(`🏠 Client available at: http://localhost:${PORT}`);
      logger.info(`🔌 Socket.IO available at: http://localhost:${PORT}/socket.io/`);
      
      // Логируем URL для разных режимов
      if (config.app.isDevelopment) {
        logger.info('🔄 Development mode: Hot reload enabled');
      }
      
      // Устанавливаем таймер для очистки старых подключений
      setInterval(() => {
        const now = Date.now();
        for (const [socketId, connection] of socketConnections.entries()) {
          const age = now - connection.connectedAt.getTime();
          if (age > 3600000) { // 1 час
            logger.info(`🧹 Cleaning up old connection: ${socketId}`);
            socketConnections.delete(socketId);
          }
        }
      }, 300000); // Каждые 5 минут
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
