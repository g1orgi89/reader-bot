/**
 * 🍄 Shrooms Chat API - Handles chat interactions with AI assistant
 * Based on Anthropic cookbook examples, adapted for Shrooms project
 * @file server/api/chat.js
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { validateChatRequest } = require('../utils/validators');
const messageService = require('../services/message');
const languageDetect = require('../utils/languageDetect');
const { requireServices } = require('../middleware/serviceManager');
const { 
  createErrorResponse,
  VALIDATION_ERRORS,
  CHAT_ERRORS,
  GENERIC_ERRORS
} = require('../constants/errorCodes');

const router = express.Router();

// Import types for JSDoc
require('../types');

/**
 * Middleware to validate chat requests
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {express.NextFunction} next 
 */
function validateChatMiddleware(req, res, next) {
  try {
    validateChatRequest(req.body);
    next();
  } catch (error) {
    logger.warn(`Chat request validation failed: ${error.message}`, {
      userId: req.body?.userId,
      error: error.message
    });
    
    const errorResponse = createErrorResponse(
      'VALIDATION_ERROR',
      error.message,
      { field: extractFieldFromError(error.message) }
    );
    
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
}

/**
 * Extract field name from validation error message
 * @param {string} errorMessage 
 * @returns {string}
 */
function extractFieldFromError(errorMessage) {
  if (errorMessage.includes('message')) return 'message';
  if (errorMessage.includes('userId')) return 'userId';
  if (errorMessage.includes('language')) return 'language';
  return 'unknown';
}

/**
 * 🍄 MAIN CHAT ENDPOINT
 * POST /api/chat
 * Send a message to the Shrooms AI assistant
 * @route POST /api/chat
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/', 
  requireServices(['claude', 'vectorStore']),
  validateChatMiddleware, 
  async (req, res) => {
    try {
      /** @type {ChatRequest} */
      const chatRequest = req.body;
      
      // Get services from middleware
      const { claude: claudeService, vectorStore: vectorStoreService, ticket: ticketService } = req.services;
      
      // Auto-detect language if not provided
      if (!chatRequest.language) {
        chatRequest.language = languageDetect.detect(chatRequest.message);
      }
      
      // Generate or use existing conversation ID
      let conversationId = chatRequest.conversationId;
      let conversationObjectId;
      
      if (!conversationId) {
        // Generate new conversation ID as MongoDB ObjectId for consistency
        conversationObjectId = new mongoose.Types.ObjectId();
        conversationId = conversationObjectId.toString();
      } else {
        // If provided, ensure it's a valid ObjectId, otherwise create new one
        if (mongoose.Types.ObjectId.isValid(conversationId)) {
          conversationObjectId = new mongoose.Types.ObjectId(conversationId);
        } else {
          conversationObjectId = new mongoose.Types.ObjectId();
          conversationId = conversationObjectId.toString();
          logger.info('Converted UUID conversationId to ObjectId', {
            original: chatRequest.conversationId,
            converted: conversationId
          });
        }
      }
      
      logger.info('🍄 Processing chat message', {
        userId: chatRequest.userId,
        conversationId,
        language: chatRequest.language,
        messageLength: chatRequest.message.length
      });
      
      // Search for relevant knowledge base content
      /** @type {VectorSearchResult[]} */
      const knowledgeResults = await vectorStoreService.search(
        chatRequest.message,
        { 
          language: chatRequest.language,
          limit: 5
        }
      );
      
      // Extract context from search results
      const context = knowledgeResults.map(result => result.content);
      
      // Get conversation history if messageService is available
      let history = [];
      try {
        if (messageService) {
          history = await messageService.getRecentMessages(conversationId, 10);
        }
      } catch (error) {
        logger.warn('Could not fetch conversation history:', error.message);
      }
      
      // Generate response using Claude with gribny context
      const claudeResponse = await claudeService.generateResponse(
        chatRequest.message,
        {
          context,
          history,
          language: chatRequest.language
        }
      );
      
      // Save user message (if messageService available)
      let userMessage = null;
      try {
        if (messageService) {
          userMessage = await messageService.createMessage({
            conversationId,
            userId: chatRequest.userId,
            role: 'user',
            text: chatRequest.message,
            language: chatRequest.language
          });
        }
      } catch (error) {
        logger.warn('Could not save user message:', error.message);
      }
      
      // Save assistant response (if messageService available)  
      let assistantMessage = null;
      try {
        if (messageService) {
          assistantMessage = await messageService.createMessage({
            conversationId,
            userId: chatRequest.userId,
            role: 'assistant',
            text: claudeResponse.message,
            language: chatRequest.language,
            tokensUsed: claudeResponse.tokensUsed,
            needsTicket: claudeResponse.needsTicket
          });
        }
      } catch (error) {
        logger.warn('Could not save assistant message:', error.message);
      }
      
      // Handle ticket creation if needed
      let ticketId = null;
      let ticketError = null;
      
      if (claudeResponse.needsTicket && ticketService) {
        try {
          // Extract subject from Claude analysis or use fallback
          const subject = claudeResponse.ticketInfo?.subject || 
                         extractSubjectFromMessage(chatRequest.message);
          
          const ticket = await ticketService.createTicket({
            userId: chatRequest.userId,
            conversationId: conversationObjectId, // Use ObjectId for MongoDB consistency
            subject: subject,
            initialMessage: chatRequest.message,
            priority: claudeResponse.ticketInfo?.priority || 'medium',
            category: claudeResponse.ticketInfo?.category || 'technical',
            language: chatRequest.language,
            context: JSON.stringify({
              claudeAnalysis: claudeResponse.ticketInfo?.reason || 'Automatically created by AI assistant',
              messageHistory: history.slice(-3) // Last 3 messages for context
            })
          });
          
          ticketId = ticket.ticketId; // Get the custom ticket ID (e.g., SHROOMMAO3XBM8NC8WH8)
          
          // Update assistant message with ticket ID (if available)
          if (messageService && assistantMessage) {
            await messageService.updateMessage(assistantMessage.id, {
              ticketCreated: true,
              ticketId
            });
          }
          
          logger.info('🍄 Ticket created for conversation', {
            ticketId,
            mongoId: ticket._id,
            conversationId,
            userId: chatRequest.userId,
            category: claudeResponse.ticketInfo?.category || 'technical',
            priority: claudeResponse.ticketInfo?.priority || 'medium'
          });
        } catch (error) {
          logger.error('Failed to create ticket', {
            error: error.message,
            stack: error.stack,
            conversationId,
            userId: chatRequest.userId
          });
          ticketError = error.message;
        }
      }
      
      /** @type {ChatResponse} */
      const response = {
        success: true,
        message: claudeResponse.message,
        conversationId,
        messageId: assistantMessage?.id || null,
        needsTicket: claudeResponse.needsTicket,
        ticketId,
        ticketError,
        tokensUsed: claudeResponse.tokensUsed,
        language: chatRequest.language,
        timestamp: new Date(),
        metadata: {
          knowledgeResultsCount: knowledgeResults.length,
          historyMessagesCount: history.length,
          servicesUsed: {
            claude: true,
            vectorStore: true,
            messageService: Boolean(messageService),
            ticketService: Boolean(ticketService)
          }
        }
      };
      
      logger.info('🍄 Chat message processed successfully', {
        conversationId,
        userId: chatRequest.userId,
        responseLength: response.message.length,
        tokensUsed: response.tokensUsed,
        ticketCreated: Boolean(ticketId),
        knowledgeResultsUsed: knowledgeResults.length
      });
      
      res.json(response);
    } catch (error) {
      logger.error('🍄 Error processing chat message', {
        error: error.message,
        stack: error.stack,
        userId: req.body?.userId,
        conversationId: req.body?.conversationId
      });
      
      const errorCode = determineErrorCode(error);
      const errorResponse = createErrorResponse(
        errorCode,
        '🍄 Произошла ошибка при обработке вашего сообщения. Наши грибники работают над исправлением!',
        {
          timestamp: new Date().toISOString(),
          service: determineFailedService(error),
          ...(process.env.NODE_ENV === 'development' ? { originalError: error.message } : {})
        }
      );
      
      res.status(errorResponse.httpStatus).json(errorResponse);
    }
  }
);

/**
 * 🍄 ALTERNATIVE MESSAGE ENDPOINT (for backward compatibility)
 * POST /api/chat/message
 */
router.post('/message', 
  requireServices(['claude', 'vectorStore']),
  validateChatMiddleware, 
  async (req, res) => {
    // Redirect to main chat endpoint
    req.url = '/';
    return router.handle(req, res);
  }
);

/**
 * GET /api/chat/conversation/:conversationId
 * Get conversation history
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = '1', limit = '50', includeMetadata = 'false' } = req.query;
    
    if (!conversationId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Conversation ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (!messageService) {
      return res.status(503).json({
        success: false,
        error: 'Message service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const shouldIncludeMetadata = includeMetadata === 'true';
    
    logger.info('Fetching conversation history', {
      conversationId,
      page: pageNum,
      limit: limitNum,
      includeMetadata: shouldIncludeMetadata
    });
    
    const messages = await messageService.getMessages(conversationId, {
      page: pageNum,
      limit: limitNum,
      includeMetadata: shouldIncludeMetadata
    });
    
    const totalCount = await messageService.getMessageCount(conversationId);
    
    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        conversationId,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching conversation history', {
      error: error.message,
      conversationId: req.params.conversationId
    });
    
    const errorResponse = createErrorResponse('CONVERSATION_FETCH_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * DELETE /api/chat/conversation/:conversationId
 * Delete conversation history
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.delete('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    
    if (!conversationId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Conversation ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (!messageService) {
      return res.status(503).json({
        success: false,
        error: 'Message service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    logger.info('Deleting conversation', {
      conversationId,
      userId
    });
    
    const deletedCount = await messageService.deleteConversation(conversationId, userId);
    
    if (deletedCount === 0) {
      const errorResponse = createErrorResponse(
        'CONVERSATION_NOT_FOUND',
        'Conversation not found or already deleted'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    res.json({
      success: true,
      data: {
        conversationId,
        deletedMessages: deletedCount,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error deleting conversation', {
      error: error.message,
      conversationId: req.params.conversationId
    });
    
    const errorResponse = createErrorResponse('CONVERSATION_DELETE_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/chat/stats/:userId
 * Get chat statistics for a user
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;
    
    const dayCount = Math.min(365, Math.max(1, parseInt(days)));
    
    if (!messageService) {
      return res.status(503).json({
        success: false,
        error: 'Message service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    logger.info('Fetching chat statistics', {
      userId,
      days: dayCount
    });
    
    const stats = await messageService.getUserStats(userId, dayCount);
    
    res.json({
      success: true,
      data: {
        ...stats,
        userId,
        periodDays: dayCount,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching chat statistics', {
      error: error.message,
      userId: req.params.userId
    });
    
    const errorResponse = createErrorResponse('STATS_FETCH_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/chat/health
 * Check chat service health
 */
router.get('/health', (req, res) => {
  try {
    const services = req.services || {};
    const health = {
      status: 'ok',
      services: {
        claude: Boolean(services.claude),
        vectorStore: Boolean(services.vectorStore),
        messageService: Boolean(messageService),
        ticketService: Boolean(services.ticket)
      },
      timestamp: new Date().toISOString()
    };
    
    const allServicesOk = Object.values(health.services).every(status => status);
    if (!allServicesOk) {
      health.status = 'degraded';
    }
    
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    logger.error('Chat health check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Extract subject from user message for ticket creation
 * @param {string} message 
 * @returns {string}
 */
function extractSubjectFromMessage(message) {
  // Get first 50 characters as subject, or use first sentence
  const firstSentence = message.split(/[.!?]/)[0];
  return firstSentence.length <= 50 ? firstSentence : message.substring(0, 50);
}

/**
 * Determine error code based on error type
 * @param {Error} error 
 * @returns {string}
 */
function determineErrorCode(error) {
  if (error.message.includes('Claude')) return 'CLAUDE_ERROR';
  if (error.message.includes('vector')) return 'VECTOR_SERVICE_UNAVAILABLE';
  if (error.message.includes('database')) return 'DATABASE_ERROR';
  if (error.message.includes('ticket')) return 'TICKET_CREATION_ERROR';
  if (error.message.includes('validation')) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

/**
 * Determine which service failed based on error
 * @param {Error} error 
 * @returns {string}
 */
function determineFailedService(error) {
  if (error.message.includes('Claude')) return 'claude';
  if (error.message.includes('vector')) return 'vectorStore';
  if (error.message.includes('database')) return 'database';
  if (error.message.includes('ticket')) return 'ticket';
  return 'unknown';
}

module.exports = router;
