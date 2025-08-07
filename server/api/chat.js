/**
 * API маршруты для работы с чатом
 * @file server/api/chat.js
 * 🍄 ОБНОВЛЕНО: Замена сложной детекции языка на простой сервис
 */

const express = require('express');
const claude = require('../services/claude');
const messageService = require('../services/message');
const conversationService = require('../services/conversation');
const simpleLanguageService = require('../services/simpleLanguage'); // 🍄 ИЗМЕНЕНО: Простой сервис языков
const vectorStoreService = require('../services/vectorStore');
const ticketService = require('../services/ticketing');
const ticketEmailService = require('../services/ticketEmail'); // 🍄 НОВОЕ: Добавлен ticketEmailService
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route POST /api/chat и POST /api/chat/message
 * @desc Обработка сообщения пользователя через REST API
 * @access Public
 */
router.post(['/', '/message'], async (req, res) => {
  try {
    const { message, userId, conversationId, language, useRag = true } = req.body;

    // Валидация входных данных
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Message and userId are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // 🍄 НОВОЕ: Проверяем, есть ли у пользователя тикет в ожидании email
    const pendingTicket = ticketEmailService.getPendingTicket(userId);
    
    // 🍄 НОВОЕ: Если есть тикет в ожидании и сообщение содержит email
    if (pendingTicket && ticketEmailService.isEmailMessage(message)) {
      const email = ticketEmailService.extractEmail(message);
      
      if (email) {
        try {
          const result = await ticketEmailService.updateTicketWithEmail(
            userId, 
            email, 
            language || 'en'
          );
          
          if (result.success) {
            // Сохраняем сообщение пользователя с email
            await messageService.create({
              text: message,
              role: 'user',
              userId,
              conversationId: pendingTicket.conversationId,
              metadata: { 
                language: language || 'en',
                source: 'api',
                emailProvided: true,
                ticketId: result.ticket.ticketId
              }
            });
            
            // Сохраняем ответ бота
            await messageService.create({
              text: result.message,
              role: 'assistant',
              userId,
              conversationId: pendingTicket.conversationId,
              metadata: {
                language: language || 'en',
                source: 'api',
                emailCollected: true,
                ticketId: result.ticket.ticketId
              }
            });
            
            return res.json({
              success: true,
              data: {
                message: result.message,
                conversationId: pendingTicket.conversationId,
                ticketId: result.ticket.ticketId,
                emailCollected: true,
                language: language || 'en',
                timestamp: new Date().toISOString()
              }
            });
          }
        } catch (error) {
          logger.error(`🍄 Error updating ticket with email: ${error.message}`);
          // Продолжаем обычную обработку сообщения
        }
      }
    }

    // Получение или создание разговора
    let conversation;
    if (conversationId) {
      conversation = await conversationService.getConversationById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found, creating new one`);
        conversation = await conversationService.createConversation(userId, {
          language: language || 'en',
          source: 'api'
        });
      }
    } else {
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

    // 🍄 НОВОЕ: Упрощенное определение языка
    const detectedLanguage = simpleLanguageService.detectLanguage(message, {
      userLanguage: language,
      previousLanguage: conversation.language,
      browserLanguage: req.headers['accept-language']
    });
    
    // Обновляем язык разговора, если он изменился
    if (conversation.language !== detectedLanguage) {
      await conversationService.updateLanguage(conversation._id, detectedLanguage);
    }
    
    // RAG функциональность
    let context = [];
    let ragUsed = false;
    const enableRag = process.env.ENABLE_RAG !== 'false' && useRag !== false;
    
    if (enableRag) {
      try {
        logger.debug(`🍄 Searching for relevant documents for: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
        
        const contextResults = await vectorStoreService.search(message, {
          limit: 5,
          language: detectedLanguage
        });
        
        if (contextResults && contextResults.length > 0) {
          context = contextResults.map(result => result.content);
          ragUsed = true;
          logger.info(`🍄 Found ${context.length} relevant documents`);
          
          const scores = contextResults.map(r => r.score?.toFixed(3) || 'N/A').join(', ');
          logger.debug(`🍄 Document scores: [${scores}]`);
        } else {
          logger.info(`🍄 No relevant documents found for: "${message.substring(0, 30)}..."`);
        }
      } catch (error) {
        logger.warn('🍄 Failed to get context from vector store:', error.message);
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
        source: 'api',
        ragUsed
      }
    });
    
    // Генерация ответа через Claude
    const aiResponse = await claude.generateResponse(message, {
      context,
      history: formattedHistory,
      language: detectedLanguage,
      userId
    });
    
    // 🍄 ОБНОВЛЕНО: Обработка создания тикетов с использованием ticketEmailService
    let ticketId = null;
    let ticketError = null;
    let emailRequested = false;
    
    // Проверяем, нужно ли создать тикет используя ticketEmailService
    const shouldCreateTicket = aiResponse.needsTicket || 
      ticketEmailService.shouldCreateTicket(message, detectedLanguage);
    
    if (shouldCreateTicket) {
      try {
        // 🍄 НОВОЕ: Используем ticketEmailService для создания тикета с запросом email
        const ticketResult = await ticketEmailService.createPendingTicket({
          userId,
          conversationId: conversation._id,
          initialMessage: message,
          context: JSON.stringify({
            aiResponse: aiResponse.message,
            userMessage: message,
            history: formattedHistory.slice(-3),
            aiProvider: aiResponse.provider,
            ragUsed
          }),
          language: detectedLanguage,
          subject: `Support request: ${message.substring(0, 50)}...`,
          category: 'technical',
          metadata: {
            source: 'api',
            aiProvider: aiResponse.provider,
            ragUsed
          }
        });
        
        if (ticketResult.success) {
          ticketId = ticketResult.ticket.ticketId;
          emailRequested = ticketResult.pendingEmail;
          
          // Заменяем ответ Claude на запрос email
          aiResponse.message = ticketResult.message;
          
          logger.info(`🎫 Pending ticket created: ${ticketId}, email requested`);
        }
      } catch (error) {
        logger.error('Failed to create pending ticket:', error);
        ticketError = error.message;
        
        // Fallback к обычному созданию тикета
        try {
          const ticket = await ticketService.createTicket({
            userId,
            conversationId: conversation._id,
            initialMessage: message,
            context: JSON.stringify({
              aiResponse: aiResponse.message,
              userMessage: message,
              history: formattedHistory.slice(-3),
              aiProvider: aiResponse.provider,
              ragUsed
            }),
            language: detectedLanguage,
            subject: `Support request: ${message.substring(0, 50)}...`,
            category: 'technical',
            metadata: {
              source: 'api',
              aiProvider: aiResponse.provider,
              ragUsed
            }
          });
          ticketId = ticket.ticketId;
          logger.info(`🎫 Fallback ticket created: ${ticketId}`);
        } catch (fallbackError) {
          logger.error('Fallback ticket creation also failed:', fallbackError);
          ticketError = fallbackError.message;
        }
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
        ticketCreated: shouldCreateTicket,
        ticketId,
        emailRequested, // 🍄 НОВОЕ: Добавляем информацию о запросе email
        source: 'api',
        aiProvider: aiResponse.provider,
        ragUsed
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
        needsTicket: shouldCreateTicket,
        ticketId,
        ticketError,
        emailRequested, // 🍄 НОВОЕ: Информация о запросе email
        tokensUsed: aiResponse.tokensUsed,
        language: detectedLanguage,
        aiProvider: aiResponse.provider,
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeResultsCount: context.length,
          historyMessagesCount: formattedHistory.length,
          ragUsed
        }
      }
    };
    
    res.json(response);
    logger.info(`✅ Chat API response sent for user: ${userId} (via ${aiResponse.provider}, RAG: ${ragUsed}, Email requested: ${emailRequested})`);
    
  } catch (error) {
    logger.error(`❌ Chat API error:`, error);
    
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    const errorMessage = 'Service temporarily unavailable. Please try again.';
    
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
 * 🍄 НОВОЕ: Эндпойнт для получения статуса тикета в ожидании email
 * @route GET /api/chat/users/:userId/pending-ticket
 * @desc Получение информации о тикете в ожидании email
 * @access Public
 */
router.get('/users/:userId/pending-ticket', async (req, res) => {
  try {
    const { userId } = req.params;
    const pendingTicket = ticketEmailService.getPendingTicket(userId);
    
    if (pendingTicket) {
      res.json({
        success: true,
        data: {
          hasPendingTicket: true,
          ticketId: pendingTicket.ticketId,
          createdAt: pendingTicket.createdAt,
          expiresAt: pendingTicket.expiresAt,
          conversationId: pendingTicket.conversationId
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          hasPendingTicket: false
        }
      });
    }
  } catch (error) {
    logger.error('❌ Error getting pending ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending ticket status',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * 🍄 НОВОЕ: Эндпойнт для получения статистики по тикетам с email
 * @route GET /api/chat/ticket-email-stats
 * @desc Получение статистики по сбору email для тикетов
 * @access Public
 */
router.get('/ticket-email-stats', async (req, res) => {
  try {
    const stats = ticketEmailService.getPendingTicketsStats();
    
    res.json({
      success: true,
      data: {
        pendingTickets: stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting ticket email stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ticket email statistics',
      code: 'INTERNAL_SERVER_ERROR'
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
    const supportedLanguages = simpleLanguageService.getSupportedLanguages();
    const stats = simpleLanguageService.getStats();

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
 * @desc Определение языка текста (упрощенная версия)
 * @access Public
 */
router.post('/detect-language', async (req, res) => {
  try {
    const { text, userId, conversationId } = req.body;
    
    logger.info('Language detection request:', {
      originalText: text?.substring(0, 50),
      hasUserId: !!userId,
      hasConversationId: !!conversationId
    });

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
        code: 'VALIDATION_ERROR'
      });
    }

    let detectedLanguage;
    let method = 'simple';
    let previousLanguage = null;

    if (userId && conversationId) {
      try {
        const conversation = await conversationService.getConversationById(conversationId);
        if (conversation) {
          previousLanguage = conversation.language;
          method = 'context-aware';
        }
      } catch (error) {
        logger.warn('Failed to get conversation for language detection:', error);
      }
    }

    // 🍄 НОВОЕ: Используем простой сервис определения языка
    detectedLanguage = simpleLanguageService.detectLanguage(text, {
      previousLanguage,
      browserLanguage: req.headers['accept-language']
    });

    const safeText = text.substring(0, 50) + (text.length > 50 ? '...' : '');

    res.json({
      success: true,
      data: {
        detectedLanguage,
        text: safeText,
        method,
        metadata: {
          textLength: text.length,
          encoding: 'utf-8',
          previousLanguage,
          simplified: true // 🍄 НОВОЕ: Указываем, что используем упрощенную детекцию
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
    const [messagesStats, conversationsStats, languageStats, aiStats] = await Promise.all([
      messageService.getStats(),
      conversationService.getConversationStats(),
      Promise.resolve(simpleLanguageService.getStats()), // 🍄 ИЗМЕНЕНО: Простой сервис
      Promise.resolve(claude.getProviderInfo())
    ]);

    res.json({
      success: true,
      data: {
        messages: messagesStats,
        conversations: conversationsStats,
        language: languageStats,
        ai: aiStats,
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
    const healthChecks = await Promise.allSettled([
      claude.isHealthy ? claude.isHealthy() : Promise.resolve(true),
      messageService.healthCheck ? messageService.healthCheck() : Promise.resolve({ status: 'ok' }),
      conversationService.healthCheck ? conversationService.healthCheck() : Promise.resolve({ status: 'ok' }),
      vectorStoreService.healthCheck ? vectorStoreService.healthCheck() : Promise.resolve({ status: 'ok' })
    ]);

    const [aiHealth, messageHealth, conversationHealth, vectorHealth] = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason?.message }
    );

    const isAiHealthy = aiHealth === true || aiHealth?.status === 'ok';
    const isMessageHealthy = messageHealth?.status === 'ok';
    const isConversationHealthy = conversationHealth?.status === 'ok';
    const isVectorHealthy = vectorHealth?.status === 'ok' || vectorHealth?.status === 'error';

    const overall = isAiHealthy && isMessageHealthy && isConversationHealthy;

    const services = {
      ai: isAiHealthy ? 'ok' : 'error',
      messages: messageHealth?.status || 'error',
      conversations: conversationHealth?.status || 'error',
      vectorStore: vectorHealth?.status || 'not_initialized',
      language: simpleLanguageService.healthCheck().status // 🍄 НОВОЕ: Простой сервис
    };

    const aiProviderInfo = claude.getProviderInfo();

    res.status(overall ? 200 : 503).json({
      success: overall,
      status: overall ? 'healthy' : 'unhealthy',
      services,
      details: {
        ai: isAiHealthy ? `Service is responding (${aiProviderInfo.currentProvider})` : 'Service not available',
        messages: messageHealth?.message || 'Unknown status',
        conversations: conversationHealth?.message || 'Unknown status',
        vectorStore: vectorHealth?.status === 'error' ? 'Not initialized (RAG disabled)' : 'Available',
        language: 'Simple language service (no complex detection)' // 🍄 НОВОЕ
      },
      aiProvider: aiProviderInfo,
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
 * @desc Очищает кеш языковых предпочтений пользователя (упрощенная версия)
 * @access Public
 */
router.post('/users/:userId/clear-language-cache', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 🍄 НОВОЕ: В простом сервисе нет кеша, но поддерживаем совместимость API
    simpleLanguageService.clearLanguageCache(userId);
    
    res.json({
      success: true,
      data: {
        message: `Language cache cleared for user: ${userId} (simplified service)`,
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
    
    if (!provider || !['openai', 'claude'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Must be one of: openai, claude',
        code: 'VALIDATION_ERROR'
      });
    }
    
    claude.switchProvider(provider);
    
    const providerInfo = claude.getProviderInfo();
    
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

/**
 * @route POST /api/chat/test-rag
 * @desc Тестирование поиска в базе знаний с различными порогами
 * @access Public
 */
router.post('/test-rag', async (req, res) => {
  try {
    const { query, language = 'en', thresholds = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const results = {};
    
    for (const threshold of thresholds) {
      try {
        const searchResults = await vectorStoreService.search(query, {
          limit: 10,
          language: language,
          score_threshold: threshold
        });
        
        results[threshold] = {
          count: searchResults.length,
          scores: searchResults.map(r => r.score?.toFixed(4) || 'N/A'),
          documents: searchResults.map(r => ({
            id: r.id,
            score: r.score?.toFixed(4) || 'N/A',
            preview: r.content?.substring(0, 100) + '...'
          }))
        };
      } catch (error) {
        results[threshold] = {
          error: error.message
        };
      }
    }

    let autoResults = {};
    try {
      const autoSearch = await vectorStoreService.search(query, {
        limit: 5,
        language: language
      });
      autoResults = {
        count: autoSearch.length,
        scores: autoSearch.map(r => r.score?.toFixed(4) || 'N/A'),
        documents: autoSearch.map(r => ({
          id: r.id,
          score: r.score?.toFixed(4) || 'N/A',
          preview: r.content?.substring(0, 100) + '...'
        }))
      };
    } catch (error) {
      autoResults = { error: error.message };
    }

    res.json({
      success: true,
      data: {
        query,
        language,
        resultsByThreshold: results,
        automaticSearch: autoResults,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error testing RAG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test RAG functionality',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;