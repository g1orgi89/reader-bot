/**
 * API маршруты для работы с чатом
 * @file server/api/chat.js
 */

const express = require('express');
const aiService = require('../services/aiService'); // Изменено с claude на aiService
const messageService = require('../services/message');
const conversationService = require('../services/conversation');
const languageDetectService = require('../services/languageDetect');
const vectorStoreService = require('../services/vectorStore');
const ticketService = require('../services/ticketing');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/chat (для совместимости с тестом)
 * @desc Обработка сообщения пользователя через REST API (альтернативный путь)
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { message, userId, conversationId, language } = req.body;

    // Валидация входных данных
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Message and userId are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Получение или создание разговора
    let conversation;
    if (conversationId) {
      conversation = await conversationService.getConversationById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found, creating new one`);
        // Создаем разговор с базовым языком
        conversation = await conversationService.createConversation(userId, {
          language: language || 'en',
          source: 'api'
        });
      }
    } else {
      // Создаем новый разговор с базовым языком
      conversation = await conversationService.createConversation(userId, {
        language: language || 'en',
        source: 'api'
      });
    }
    
    // Получение истории сообщений
    const history = await messageService.getRecentMessages(conversation._id, 10);
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    // Определение языка сообщения с учетом контекста
    const detectedLanguage = language || 
      languageDetectService.detectLanguageWithContext(message, {
        userId,
        conversationId: conversation._id.toString(),
        history: formattedHistory,
        previousLanguage: conversation.language
      });
    
    // Обновляем язык разговора, если он изменился
    if (conversation.language !== detectedLanguage) {
      await conversationService.updateLanguage(conversation._id, detectedLanguage);
    }
    
    // Получение контекста из базы знаний (если RAG включен)
    let context = [];
    if (process.env.ENABLE_RAG === 'true') {
      try {
        const contextResults = await vectorStoreService.search(message, {
          limit: 5,
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
      text: message,
      role: 'user',
      userId,
      conversationId: conversation._id,
      metadata: { 
        language: detectedLanguage,
        source: 'api'
      }
    });
    
    // Генерация ответа через AI Service
    const aiResponse = await aiService.generateResponse(message, {
      context,
      history: formattedHistory,
      language: detectedLanguage,
      userId // Добавляем userId для логирования
    });
    
    // Проверка на создание тикета
    let ticketId = null;
    let ticketError = null;
    
    if (aiResponse.needsTicket) {
      try {
        const ticket = await ticketService.createTicket({
          userId,
          conversationId: conversation._id,
          initialMessage: message,  // Исправлено: message -> initialMessage
          context: JSON.stringify({
            aiResponse: aiResponse.message,
            userMessage: message,
            history: formattedHistory.slice(-3),
            aiProvider: aiResponse.provider
          }),
          language: detectedLanguage,
          subject: `Support request: ${message.substring(0, 50)}...`,
          category: 'technical',
          metadata: {
            source: 'api',
            aiProvider: aiResponse.provider
          }
        });
        ticketId = ticket.ticketId;
        logger.info(`🎫 Ticket created: ${ticketId}`);
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
      userId,
      conversationId: conversation._id,
      metadata: {
        language: detectedLanguage,
        tokensUsed: aiResponse.tokensUsed,
        ticketCreated: aiResponse.needsTicket,
        ticketId,
        source: 'api',
        aiProvider: aiResponse.provider // Сохраняем информацию о провайдере
      }
    });
    
    // Обновление разговора
    await conversationService.incrementMessageCount(conversation._id);
    
    // Подготовка ответа
    const response = {
      success: true,
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
    
    res.json(response);
    logger.info(`✅ Chat API response sent for user: ${userId} (via ${aiResponse.provider})`);
    
  } catch (error) {
    logger.error(`❌ Chat API error:`, error);
    
    // Определяем тип ошибки и возвращаем соответствующий код
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Service temporarily unavailable. Please try again.';
    
    if (error.message.includes('Database')) {
      statusCode = 503;
      errorCode = 'DATABASE_ERROR';
    } else if (error.message.includes('OpenAI') || error.message.includes('Anthropic') || error.message.includes('AI Service')) {
      statusCode = 503;
      errorCode = 'AI_SERVICE_ERROR';
    } else if (error.message.includes('not initialized')) {
      statusCode = 503;
      errorCode = 'SERVICE_NOT_INITIALIZED';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/chat/message
 * @desc Обработка сообщения пользователя через REST API
 * @access Public
 */
router.post('/message', async (req, res) => {
  try {
    const { message, userId, conversationId, language } = req.body;

    // Валидация входных данных
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Message and userId are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Получение или создание разговора
    let conversation;
    if (conversationId) {
      conversation = await conversationService.getConversationById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found, creating new one`);
        // Создаем разговор с базовым языком
        conversation = await conversationService.createConversation(userId, {
          language: language || 'en',
          source: 'api'
        });
      }
    } else {
      // Создаем новый разговор с базовым языком
      conversation = await conversationService.createConversation(userId, {
        language: language || 'en',
        source: 'api'
      });
    }
    
    // Получение истории сообщений
    const history = await messageService.getRecentMessages(conversation._id, 10);
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    // Определение языка сообщения с учетом контекста
    const detectedLanguage = language || 
      languageDetectService.detectLanguageWithContext(message, {
        userId,
        conversationId: conversation._id.toString(),
        history: formattedHistory,
        previousLanguage: conversation.language
      });
    
    // Обновляем язык разговора, если он изменился
    if (conversation.language !== detectedLanguage) {
      await conversationService.updateLanguage(conversation._id, detectedLanguage);
    }
    
    // Получение контекста из базы знаний (если RAG включен)
    let context = [];
    if (process.env.ENABLE_RAG === 'true') {
      try {
        const contextResults = await vectorStoreService.search(message, {
          limit: 5,
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
      text: message,
      role: 'user',
      userId,
      conversationId: conversation._id,
      metadata: { 
        language: detectedLanguage,
        source: 'api'
      }
    });
    
    // Генерация ответа через AI Service
    const aiResponse = await aiService.generateResponse(message, {
      context,
      history: formattedHistory,
      language: detectedLanguage,
      userId // Добавляем userId для логирования
    });
    
    // Проверка на создание тикета
    let ticketId = null;
    let ticketError = null;
    
    if (aiResponse.needsTicket) {
      try {
        const ticket = await ticketService.createTicket({
          userId,
          conversationId: conversation._id,
          initialMessage: message,  // Исправлено: message -> initialMessage
          context: JSON.stringify({
            aiResponse: aiResponse.message,
            userMessage: message,
            history: formattedHistory.slice(-3),
            aiProvider: aiResponse.provider
          }),
          language: detectedLanguage,
          subject: `Support request: ${message.substring(0, 50)}...`,
          category: 'technical',
          metadata: {
            source: 'api',
            aiProvider: aiResponse.provider
          }
        });
        ticketId = ticket.ticketId;
        logger.info(`🎫 Ticket created: ${ticketId}`);
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
      userId,
      conversationId: conversation._id,
      metadata: {
        language: detectedLanguage,
        tokensUsed: aiResponse.tokensUsed,
        ticketCreated: aiResponse.needsTicket,
        ticketId,
        source: 'api',
        aiProvider: aiResponse.provider // Сохраняем информацию о провайдере
      }
    });
    
    // Обновление разговора
    await conversationService.incrementMessageCount(conversation._id);
    
    // Подготовка ответа
    const response = {
      success: true,
      data: {
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
      }
    };
    
    res.json(response);
    logger.info(`✅ Chat API response sent for user: ${userId} (via ${aiResponse.provider})`);
    
  } catch (error) {
    logger.error(`❌ Chat API error:`, error);
    
    // Определяем тип ошибки и возвращаем соответствующий код
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Service temporarily unavailable. Please try again.';
    
    if (error.message.includes('Database')) {
      statusCode = 503;
      errorCode = 'DATABASE_ERROR';
    } else if (error.message.includes('OpenAI') || error.message.includes('Anthropic') || error.message.includes('AI Service')) {
      statusCode = 503;
      errorCode = 'AI_SERVICE_ERROR';
    } else if (error.message.includes('not initialized')) {
      statusCode = 503;
      errorCode = 'SERVICE_NOT_INITIALIZED';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/chat/conversations/:userId
 * @desc Получение разговоров пользователя
 * @access Public
 */
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, skip = 0, activeOnly = false } = req.query;

    const conversations = await conversationService.findByUserId(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      activeOnly: activeOnly === 'true'
    });

    res.json({
      success: true,
      data: {
        conversations,
        count: conversations.length
      }
    });
  } catch (error) {
    logger.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/conversations/:conversationId/messages
 * @desc Получение сообщений разговора
 * @access Public
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await messageService.getByConversation(conversationId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    logger.error('❌ Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/conversations/:conversationId/close
 * @desc Закрытие разговора
 * @access Public
 */
router.post('/conversations/:conversationId/close', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await conversationService.endConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Conversation closed successfully',
        conversationId: conversation._id
      }
    });
  } catch (error) {
    logger.error('❌ Error closing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close conversation',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/languages
 * @desc Получение списка поддерживаемых языков
 * @access Public
 */
router.get('/languages', async (req, res) => {
  try {
    const supportedLanguages = languageDetectService.getSupportedLanguages();
    const stats = languageDetectService.getStats();

    res.json({
      success: true,
      data: {
        supportedLanguages,
        defaultLanguage: stats.defaultLanguage,
        stats
      }
    });
  } catch (error) {
    logger.error('❌ Error getting language info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language information',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/detect-language
 * @desc Определение языка текста
 * @access Public
 */
router.post('/detect-language', async (req, res) => {
  try {
    // Проверяем raw body и основной body
    const { text, userId, conversationId } = req.body;
    
    // Логируем входящий текст для отладки
    logger.info('Language detection request:', {
      originalText: text,
      rawBody: req.rawBody,
      headers: req.headers,
      contentType: req.headers['content-type']
    });

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
        code: 'VALIDATION_ERROR'
      });
    }

    // Проверяем, что текст не содержит знаки вопроса (признак неправильной кодировки)
    const hasQuestionMarks = /^\?+,?\s*\?+/.test(text.trim());
    if (hasQuestionMarks && req.rawBody) {
      // Пытаемся распарсить текст из rawBody
      try {
        const rawBodyParsed = JSON.parse(req.rawBody);
        if (rawBodyParsed.text && rawBodyParsed.text !== text) {
          logger.info('Using text from rawBody due to encoding issues');
          const correctedText = rawBodyParsed.text;
          req.body.text = correctedText;
        }
      } catch (parseError) {
        logger.warn('Failed to parse rawBody:', parseError.message);
      }
    }

    // Используем исправленный текст
    const processedText = req.body.text;
    let detectedLanguage;
    let method = 'basic';
    let history = [];

    // Если есть userId и conversationId, получаем историю для контекстного определения
    if (userId && conversationId) {
      try {
        const conversation = await conversationService.getConversationById(conversationId);
        if (conversation) {
          const recentMessages = await messageService.getRecentMessages(conversationId, 5);
          history = recentMessages.map(msg => ({
            role: msg.role,
            content: msg.text
          }));
          
          // Используем контекстное определение языка
          detectedLanguage = languageDetectService.detectLanguageWithContext(processedText, {
            userId,
            conversationId,
            history,
            previousLanguage: conversation.language
          });
          method = 'context-aware';
        } else {
          // Если разговор не найден, используем базовое определение
          detectedLanguage = languageDetectService.detectLanguage(processedText);
        }
      } catch (error) {
        logger.warn('Failed to get conversation history for language detection:', error);
        // Fallback к базовому определению
        detectedLanguage = languageDetectService.detectLanguage(processedText);
      }
    } else {
      // Используем базовое определение языка
      detectedLanguage = languageDetectService.detectLanguage(processedText);
    }

    // Подготавливаем безопасный вывод текста (ограничиваем длину)
    const safeText = processedText.substring(0, 50) + (processedText.length > 50 ? '...' : '');

    res.json({
      success: true,
      data: {
        detectedLanguage,
        text: safeText,
        method,
        metadata: {
          hasHistory: history.length > 0,
          historyCount: history.length,
          textLength: processedText.length,
          encoding: 'utf-8'
        }
      }
    });
  } catch (error) {
    logger.error('❌ Error detecting language:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect language',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/stats
 * @desc Получение статистики чата
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    // Объединяем статистику из разных сервисов
    const [messagesStats, conversationsStats, languageStats, aiStats] = await Promise.all([
      messageService.getStats(),
      conversationService.getConversationStats(),
      Promise.resolve(languageDetectService.getStats()),
      Promise.resolve(aiService.getProviderInfo()) // Добавляем статистику AI
    ]);

    res.json({
      success: true,
      data: {
        messages: messagesStats,
        conversations: conversationsStats,
        language: languageStats,
        ai: aiStats, // Добавляем информацию о провайдере AI
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/messages/:messageId/edit
 * @desc Редактирование сообщения
 * @access Public
 */
router.post('/messages/:messageId/edit', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newText, editedBy } = req.body;

    if (!newText) {
      return res.status(400).json({
        success: false,
        error: 'New text is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const editedMessage = await messageService.editMessage(messageId, newText, editedBy);

    if (!editedMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: editedMessage,
        editHistory: editedMessage.editHistory
      }
    });
  } catch (error) {
    logger.error('❌ Error editing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit message',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/search
 * @desc Поиск сообщений
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, userId, conversationId, language, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      userId,
      conversationId,
      language
    };

    const messages = await messageService.searchMessages(q, searchOptions);

    res.json({
      success: true,
      data: {
        messages,
        query: q,
        count: messages.length,
        options: searchOptions
      }
    });
  } catch (error) {
    logger.error('❌ Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/health
 * @desc Проверка здоровья API чата
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    // Проверяем здоровье всех зависимых сервисов
    const healthChecks = await Promise.allSettled([
      // AI service health
      aiService.isHealthy ? aiService.isHealthy() : Promise.resolve(true),
      // Message service health
      messageService.healthCheck ? messageService.healthCheck() : Promise.resolve({ status: 'ok' }),
      // Conversation service health
      conversationService.healthCheck ? conversationService.healthCheck() : Promise.resolve({ status: 'ok' }),
      // Vector store health (optional, может не быть инициализирован)
      vectorStoreService.healthCheck ? vectorStoreService.healthCheck() : Promise.resolve({ status: 'ok' })
    ]);

    // Обрабатываем результаты проверок
    const [aiHealth, messageHealth, conversationHealth, vectorHealth] = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason?.message }
    );

    // Определяем общее состояние здоровья
    const isAiHealthy = aiHealth === true || aiHealth?.status === 'ok';
    const isMessageHealthy = messageHealth?.status === 'ok';
    const isConversationHealthy = conversationHealth?.status === 'ok';
    const isVectorHealthy = vectorHealth?.status === 'ok' || vectorHealth?.status === 'error'; // Vector store опциональный

    const overall = isAiHealthy && isMessageHealthy && isConversationHealthy;

    const services = {
      ai: isAiHealthy ? 'ok' : 'error',
      messages: messageHealth?.status || 'error',
      conversations: conversationHealth?.status || 'error',
      vectorStore: vectorHealth?.status || 'not_initialized'
    };

    // Добавляем информацию о текущем AI провайдере
    const aiProviderInfo = aiService.getProviderInfo();

    res.status(overall ? 200 : 503).json({
      success: overall,
      status: overall ? 'healthy' : 'unhealthy',
      services,
      details: {
        ai: isAiHealthy ? `Service is responding (${aiProviderInfo.currentProvider})` : 'Service not available',
        messages: messageHealth?.message || 'Unknown status',
        conversations: conversationHealth?.message || 'Unknown status',
        vectorStore: vectorHealth?.status === 'error' ? 'Not initialized (RAG disabled)' : 'Available'
      },
      aiProvider: aiProviderInfo, // Добавляем детальную информацию о AI провайдере
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/chat/users/:userId/clear-language-cache
 * @desc Очищает кеш языковых предпочтений пользователя
 * @access Public
 */
router.post('/users/:userId/clear-language-cache', async (req, res) => {
  try {
    const { userId } = req.params;
    
    languageDetectService.clearLanguageCache(userId);
    
    res.json({
      success: true,
      data: {
        message: `Language cache cleared for user: ${userId}`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error clearing language cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear language cache',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/switch-ai-provider
 * @desc Переключение AI провайдера без перезапуска сервера
 * @access Public (в production должен требовать авторизации)
 */
router.post('/switch-ai-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider || !['openai', 'anthropic', 'both'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Must be one of: openai, anthropic, both',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Переключаем провайдера
    aiService.switchProvider(provider);
    
    // Получаем обновленную информацию
    const providerInfo = aiService.getProviderInfo();
    
    res.json({
      success: true,
      data: {
        message: `AI provider switched to: ${provider}`,
        providerInfo,
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`AI provider switched to: ${provider}`);
  } catch (error) {
    logger.error('❌ Error switching AI provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'PROVIDER_SWITCH_ERROR'
    });
  }
});

module.exports = router;