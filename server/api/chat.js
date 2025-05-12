/**
 * Chat API routes with type safety
 * @file server/api/chat.js
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { validateChatRequest } = require('../utils/validators');
const claudeService = require('../services/claude');
// Remove direct import of vectorStoreService - it will be obtained from app settings
const messageService = require('../services/message');
const ticketService = require('../services/ticketing');
const languageDetect = require('../utils/languageDetect');
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
 * POST /api/chat/message
 * Send a message to the AI assistant
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/message', validateChatMiddleware, async (req, res) => {
  try {
    /** @type {ChatRequest} */
    const chatRequest = req.body;
    
    // Get VectorStore service from app settings
    const vectorStoreService = req.app.get('vectorStoreService');
    if (!vectorStoreService) {
      logger.error('VectorStore service not available');
      const errorResponse = createErrorResponse('VECTOR_SERVICE_UNAVAILABLE');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    // Auto-detect language if not provided
    if (!chatRequest.language) {
      chatRequest.language = languageDetect.detect(chatRequest.message);
    }
    
    // Generate or use existing conversation ID
    const conversationId = chatRequest.conversationId || uuidv4();
    
    logger.info('Processing chat message', {
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
    
    // Get conversation history
    const history = await messageService.getRecentMessages(conversationId, 10);
    
    // Generate response using Claude
    const claudeResponse = await claudeService.generateResponse(
      chatRequest.message,
      {
        context,
        history,
        language: chatRequest.language
      }
    );
    
    // Save user message
    const userMessage = await messageService.createMessage({
      conversationId,
      userId: chatRequest.userId,
      role: 'user',
      text: chatRequest.message,
      language: chatRequest.language
    });
    
    // Save assistant response
    const assistantMessage = await messageService.createMessage({
      conversationId,
      userId: chatRequest.userId,
      role: 'assistant',
      text: claudeResponse.message,
      language: chatRequest.language,
      tokensUsed: claudeResponse.tokensUsed
    });
    
    // Handle ticket creation if needed
    let ticketId = null;
    if (claudeResponse.needsTicket) {
      try {
        const ticket = await ticketService.createTicket({
          userId: chatRequest.userId,
          conversationId,
          subject: extractSubjectFromMessage(chatRequest.message),
          initialMessage: chatRequest.message,
          priority: 'medium',
          category: 'technical',
          language: chatRequest.language
        });
        
        ticketId = ticket.ticketId;
        
        // Update assistant message with ticket ID
        await messageService.updateMessage(assistantMessage.id, {
          ticketCreated: true,
          ticketId
        });
        
        logger.info('Ticket created for conversation', {
          ticketId,
          conversationId,
          userId: chatRequest.userId
        });
      } catch (ticketError) {
        logger.error('Failed to create ticket', {
          error: ticketError.message,
          conversationId,
          userId: chatRequest.userId
        });
      }
    }
    
    /** @type {ChatResponse} */
    const response = {
      message: claudeResponse.message,
      conversationId,
      messageId: assistantMessage.id,
      needsTicket: claudeResponse.needsTicket,
      ticketId,
      tokensUsed: claudeResponse.tokensUsed,
      language: chatRequest.language,
      timestamp: new Date()
    };
    
    logger.info('Chat message processed successfully', {
      conversationId,
      userId: chatRequest.userId,
      responseLength: response.message.length,
      tokensUsed: response.tokensUsed,
      ticketCreated: Boolean(ticketId)
    });
    
    res.json(response);
  } catch (error) {
    logger.error('Error processing chat message', {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      conversationId: req.body?.conversationId
    });
    
    const errorCode = determineErrorCode(error);
    const errorResponse = createErrorResponse(
      errorCode,
      'An error occurred while processing your message. Please try again.',
      {
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' ? { originalError: error.message } : {})
      }
    );
    
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/chat/conversation/:conversationId
 * Get conversation history
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    if (!conversationId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Conversation ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    
    logger.info('Fetching conversation history', {
      conversationId,
      page: pageNum,
      limit: limitNum
    });
    
    const messages = await messageService.getMessages(conversationId, {
      page: pageNum,
      limit: limitNum
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
        }
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
  return 'INTERNAL_ERROR';
}

module.exports = router;
