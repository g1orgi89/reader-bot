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

// Middleware
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const chatRoutes = require('./api/chat');
const ticketRoutes = require('./api/tickets');
const adminRoutes = require('./api/admin');
const knowledgeRoutes = require('./api/knowledge');

// Services
const dbService = require('./services/database');
const vectorStoreService = require('./services/vectorStore');
const claudeService = require('./services/claude');
const languageDetectService = require('./services/languageDetect');
const conversationService = require('./services/conversation');
const messageService = require('./services/message');
const ticketService = require('./services/ticketing');

// Создание приложения Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger.httpLogger);

// Static files
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.IO обработчик - исправленная версия
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  // Присоединение к комнате чата
  socket.emit('system', 'Socket.IO connected! Real-time chat active.');
  socket.join('chat');
  socket.emit('system', `Joined chat room (Socket ID: ${socket.id})`);

  socket.on('sendMessage', async (data) => {
    try {
      logger.info(`Socket message received from ${socket.id}:`, data);
      
      const { message, userId, conversationId, language } = data;
      
      if (!message || !userId) {
        socket.emit('error', { message: 'Message and userId are required' });
        return;
      }

      // Определение языка
      const detectedLanguage = language || languageDetectService.detectLanguage(message);
      
      // Получение контекста из базы знаний
      const contextResults = await vectorStoreService.search(message, {
        limit: 3,
        language: detectedLanguage
      });
      const context = contextResults.map(result => result.content);
      
      // Получение или создание разговора
      let conversation;
      if (conversationId) {
        conversation = await conversationService.findById(conversationId);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
      } else {
        conversation = await conversationService.create({
          userId,
          language: detectedLanguage,
          startedAt: new Date()
        });
      }
      
      // Получение истории сообщений
      const history = await messageService.getRecentMessages(conversation._id, 10);
      const formattedHistory = history.map(msg => ({
        role: msg.role,
        content: msg.text
      }));
      
      // Сохранение сообщения пользователя
      const userMessage = await messageService.create({
        text: message,
        role: 'user',
        userId,
        conversationId: conversation._id,
        metadata: { 
          language: detectedLanguage,
          source: 'socket'
        }
      });
      
      // Генерация ответа через Claude
      const claudeResponse = await claudeService.generateResponse(message, {
        context,
        history: formattedHistory,
        language: detectedLanguage
      });
      
      // Проверка на создание тикета
      let ticketId = null;
      let ticketError = null;
      
      if (claudeResponse.needsTicket) {
        try {
          const ticket = await ticketService.createTicket({
            userId,
            conversationId: conversation._id,
            message,
            context: JSON.stringify({
              claudeResponse: claudeResponse.message,
              userMessage: message,
              history: formattedHistory.slice(-3)
            }),
            language: detectedLanguage,
            subject: `Support request from ${userId}`,
            category: 'technical'
          });
          ticketId = ticket.ticketId;
          logger.info(`Ticket created: ${ticketId}`);
        } catch (error) {
          logger.error('Failed to create ticket:', error);
          ticketError = error.message;
        }
      }
      
      // Замена TICKET_ID в ответе
      let botResponse = claudeResponse.message;
      if (ticketId) {
        botResponse = botResponse.replace('TICKET_ID', ticketId);
      }
      
      // Сохранение ответа бота
      const botMessage = await messageService.create({
        text: botResponse,
        role: 'assistant',
        userId,
        conversationId: conversation._id,
        metadata: {
          language: detectedLanguage,
          tokensUsed: claudeResponse.tokensUsed,
          ticketCreated: claudeResponse.needsTicket,
          ticketId,
          source: 'socket'
        }
      });
      
      // Обновление разговора
      await conversationService.updateLastActivity(conversation._id);
      
      // Отправка ответа через Socket.IO
      const response = {
        message: botResponse,
        conversationId: conversation._id.toString(),
        messageId: botMessage._id.toString(),
        needsTicket: claudeResponse.needsTicket,
        ticketId,
        ticketError,
        tokensUsed: claudeResponse.tokensUsed,
        language: detectedLanguage,
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeResultsCount: contextResults.length,
          historyMessagesCount: formattedHistory.length
        }
      };
      
      socket.emit('message', response);
      logger.info(`Socket response sent to ${socket.id}`);
      
    } catch (error) {
      logger.error(`Socket error for ${socket.id}:`, error);
      socket.emit('error', { 
        message: 'Service temporarily unavailable. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Startup
async function startServer() {
  try {
    // Логируем переменные окружения для отладки
    logger.info('Environment variables:');
    logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`MONGODB_URI: ${process.env.MONGODB_URI}`);
    logger.info(`PORT: ${process.env.PORT}`);
    
    // Подключение к базе данных
    await dbService.connect();
    logger.info('Connected to MongoDB');
    
    // Инициализация векторной базы
    await vectorStoreService.initialize();
    logger.info('Vector store initialized');
    
    // Запуск сервера
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    dbService.disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    dbService.disconnect();
    process.exit(0);
  });
});

// Запуск сервера
startServer();