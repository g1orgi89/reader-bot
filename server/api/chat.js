/**
 * API маршруты для чата
 * @file server/api/chat.js
 */

const express = require('express');
const router = express.Router();

// Services
const claudeService = require('../services/claude');
const vectorStoreService = require('../services/vectorStore');
const conversationService = require('../services/conversation');
const messageService = require('../services/message');
const ticketService = require('../services/ticketing');
const languageDetectService = require('../services/languageDetect');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ChatRequest
 * @property {string} message - Сообщение пользователя
 * @property {string} userId - ID пользователя
 * @property {string} [conversationId] - ID разговора (опционально)
 * @property {string} [language] - Язык (опционально)
 */

/**
 * @typedef {Object} ChatResponse
 * @property {boolean} success - Успешность операции
 * @property {string} message - Ответное сообщение
 * @property {string} conversationId - ID разговора
 * @property {string} messageId - ID сообщения
 * @property {boolean} needsTicket - Создан ли тикет
 * @property {string|null} ticketId - ID тикета (если создан)
 * @property {string|null} ticketError - Ошибка при создании тикета
 * @property {number} tokensUsed - Количество использованных токенов
 * @property {string} language - Язык ответа
 * @property {string} timestamp - Временная метка
 * @property {Object} metadata - Дополнительные данные
 */

/**
 * @route POST /api/chat/message
 * @desc Обработка сообщения пользователя
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
        message: 'Отсутствуют обязательные поля'
      });
    }
    
    logger.info(`Chat request from ${userId}: ${message.substring(0, 100)}...`);
    
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
        source: 'http'
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
        source: 'http'
      }
    });
    
    // Обновление разговора
    await conversationService.updateLastActivity(conversation._id);
    
    // Формирование ответа
    const response = {
      success: true,
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
    
    logger.info(`Chat response for ${userId}: success`);
    res.json(response);
    
  } catch (error) {
    logger.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: 'Service temporarily unavailable. Please try again.',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route GET /api/chat/conversations/:userId
 * @desc Получение списка разговоров пользователя
 * @access Public
 */
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const conversations = await conversationService.findByUserId(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      message: error.message
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
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await messageService.getMessagesByConversationId(conversationId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      message: error.message
    });
  }
});

module.exports = router;