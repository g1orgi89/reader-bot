/**
 * Chat API routes for Shrooms Support Bot
 * @file server/api/chat.js
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * POST /api/chat/message
 * Process a chat message with optional context and history
 */
router.post('/message', async (req, res) => {
  try {
    const { message, language = 'en', context = [], history = [], userId } = req.body;
    
    // Validation
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string',
        errorCode: 'INVALID_MESSAGE'
      });
    }
    
    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty',
        errorCode: 'EMPTY_MESSAGE'
      });
    }
    
    // Get Claude service from app context
    const claudeService = req.app.get('claudeService');
    
    if (!claudeService) {
      logger.error('Claude service not available');
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    // Generate response
    const response = await claudeService.generateResponse(message, {
      language,
      context,
      history
    });
    
    // Log the interaction
    logger.logUserInteraction({
      userId,
      language,
      messageType: 'chat',
      responseTime: response.tokensUsed // Using tokens as proxy for processing time
    });
    
    res.json({
      success: true,
      data: {
        message: response.message,
        needsTicket: response.needsTicket,
        tokensUsed: response.tokensUsed,
        language: response.language,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Chat message error', {
      error: error.message,
      stack: error.stack,
      userId: req.body.userId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      errorCode: 'PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/chat/greeting
 * Generate a greeting message in the specified language
 */
router.post('/greeting', async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    
    // Validate language
    const supportedLanguages = ['en', 'es', 'ru'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported language. Supported languages: ${supportedLanguages.join(', ')}`,
        errorCode: 'UNSUPPORTED_LANGUAGE'
      });
    }
    
    // Get Claude service
    const claudeService = req.app.get('claudeService');
    
    if (!claudeService) {
      logger.error('Claude service not available');
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    // Generate greeting
    const greeting = await claudeService.generateGreeting(language);
    
    res.json({
      success: true,
      data: {
        message: greeting.message,
        language: greeting.language,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Greeting generation error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate greeting',
      errorCode: 'GREETING_ERROR'
    });
  }
});

/**
 * GET /api/chat/status
 * Get the status of the chat service
 */
router.get('/status', (req, res) => {
  try {
    const claudeService = req.app.get('claudeService');
    
    if (!claudeService) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    const status = claudeService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Status check error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      errorCode: 'STATUS_ERROR'
    });
  }
});

/**
 * POST /api/chat/estimate-tokens
 * Estimate token usage for a message with context
 */
router.post('/estimate-tokens', async (req, res) => {
  try {
    const { message, history = [], context = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        errorCode: 'INVALID_MESSAGE'
      });
    }
    
    const claudeService = req.app.get('claudeService');
    
    if (!claudeService) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        errorCode: 'SERVICE_UNAVAILABLE'
      });
    }
    
    const estimatedTokens = claudeService.estimateTokenUsage(message, history, context);
    
    res.json({
      success: true,
      data: {
        estimatedTokens,
        message: 'Token estimation completed',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Token estimation error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to estimate tokens',
      errorCode: 'ESTIMATION_ERROR'
    });
  }
});

module.exports = router;
