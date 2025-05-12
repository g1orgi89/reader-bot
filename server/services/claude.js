/**
 * Claude Service for Shrooms AI Support Bot
 * @file server/services/claude.js
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const tokenCounter = require('../utils/tokenCounter');
const languageDetector = require('../utils/languageDetect');
const { SYSTEM_PROMPTS, GREETINGS, ERROR_MESSAGES, TICKET_MESSAGES } = require('../config/prompts');

/**
 * Claude Service for handling AI conversations
 */
class ClaudeService {
  /**
   * Initialize Claude Service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Anthropic API key
   * @param {string} [config.model='claude-3-haiku-20240307'] - Model to use
   * @param {number} [config.maxTokens=1000] - Maximum tokens per response
   * @param {number} [config.temperature=0.7] - Temperature for response generation
   * @param {boolean} [config.enableRAG=true] - Enable RAG functionality
   */
  constructor(config) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    this.config = {
      model: config.model || 'claude-3-haiku-20240307',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      enableRAG: config.enableRAG !== false,
      ...config
    };

    logger.info('Claude Service initialized', {
      model: this.config.model,
      enableRAG: this.config.enableRAG
    });
  }

  /**
   * Generate response using Claude API
   * @param {string} message - User message
   * @param {import('../types').ClaudeGenerateOptions} [options={}] - Generation options
   * @returns {Promise<import('../types').ClaudeResponse>} Claude response
   */
  async generateResponse(message, options = {}) {
    try {
      const {
        context = [],
        history = [],
        language = 'en',
        maxTokens = this.config.maxTokens,
        temperature = this.config.temperature
      } = options;

      // Auto-detect language if not provided - FIX: Use correct method name
      const detectedLanguage = language === 'en' ? 
        languageDetector.detect(message) : 
        language;

      // Prepare system prompt based on context availability
      let systemPrompt = SYSTEM_PROMPTS.basic;
      if (context && context.length > 0) {
        systemPrompt = SYSTEM_PROMPTS.rag;
      }

      // Build messages array - FIX: use 'text' instead of 'content'
      const messages = await this._buildMessageArray(
        message,
        history,
        context,
        detectedLanguage
      );

      // Check token limits
      const totalTokens = tokenCounter.countTotalTokens(systemPrompt, messages, context);
      
      if (!tokenCounter.isWithinLimit(totalTokens)) {
        logger.warn('Token limit exceeded, truncating messages', { 
          totalTokens,
          originalHistoryLength: history.length 
        });
        
        // Truncate history to fit within limits
        const truncatedHistory = tokenCounter.truncateMessages(
          history,
          80000, // Leave room for system prompt and context
          true   // Preserve system messages
        );
        
        return this.generateResponse(message, {
          ...options,
          history: truncatedHistory
        });
      }

      // Make the API call
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages
      });

      const answer = response.content[0].text;
      
      // Check if ticket creation is needed
      const needsTicket = await this._shouldCreateTicket(answer, message, detectedLanguage);
      
      // Log usage statistics
      const tokenUsage = tokenCounter.getTokenUsage(
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      
      const estimatedCost = tokenCounter.estimateCost(tokenUsage, this.config.model);
      
      logger.info('Claude response generated', {
        model: this.config.model,
        language: detectedLanguage,
        tokensUsed: tokenUsage.totalTokens,
        estimatedCost,
        needsTicket
      });

      return {
        message: answer,
        needsTicket,
        tokensUsed: tokenUsage.totalTokens,
        ticketReason: needsTicket ? 'Auto-detected based on message content' : null,
        language: detectedLanguage,
        usage: tokenUsage
      };

    } catch (error) {
      logger.error('Claude API error', {
        error: error.message,
        stack: error.stack,
        model: this.config.model
      });

      // Return graceful error response
      return this._getErrorResponse(error, options.language || 'en');
    }
  }

  /**
   * Create initial greeting message
   * @param {string} [language='en'] - Language for greeting
   * @returns {Promise<import('../types').ClaudeResponse>} Greeting response
   */
  async generateGreeting(language = 'en') {
    try {
      const greeting = GREETINGS[language] || GREETINGS.en;
      
      return {
        message: `${greeting.welcome}\\n\\n${greeting.how_can_help}`,
        needsTicket: false,
        tokensUsed: 0,
        language
      };
    } catch (error) {
      logger.error('Error generating greeting', { error: error.message });
      return this._getErrorResponse(error, language);
    }
  }

  /**
   * Build messages array for Claude API
   * @private
   * @param {string} message - Current user message
   * @param {import('../types').Message[]} history - Conversation history
   * @param {string[]} context - RAG context
   * @param {string} language - Language code
   * @returns {Promise<Object[]>} Formatted messages array
   */
  async _buildMessageArray(message, history, context, language) {
    const messages = [];

    // Add conversation history (excluding system messages, they go in system parameter)
    // FIX: Handle both 'text' and 'content' fields for compatibility
    const conversationHistory = history.filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.text || msg.content || msg.message || ''
      }));
    messages.push(...conversationHistory);

    // Add RAG context if available
    if (context && context.length > 0) {
      const contextMessage = {
        role: 'user',
        content: `### Релевантная информация из базы знаний:\n\n${context.join('\\n\\n')}\n\n### Используй приведенную выше информацию, чтобы ответить на следующий вопрос от пользователя.`
      };
      messages.push(contextMessage);
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    return messages;
  }

  /**
   * Check if a ticket should be created based on the response
   * @private
   * @param {string} response - Claude's response
   * @param {string} originalMessage - Original user message
   * @param {string} language - Language code
   * @returns {Promise<boolean>} Whether to create a ticket
   */
  async _shouldCreateTicket(response, originalMessage, language) {
    try {
      // Use a separate prompt for ticket detection
      const ticketDetectionPrompt = SYSTEM_PROMPTS.ticketCreation;
      
      const detectionMessage = {
        role: 'user',
        content: `Проанализируй следующие сообщения и определи, нужно ли создать тикет:\n\nСообщение пользователя: \"${originalMessage}\"\nОтвет ассистента: \"${response}\"\n\nЯзык общения: ${language}\n\nОтвечай только в формате:\nCREATE_TICKET: true/false\nREASON: [причина решения]\nCATEGORY: [technical/account/billing/feature/other] (если нужен тикет)\nPRIORITY: [low/medium/high/urgent] (если нужен тикет)`
      };

      const ticketResponse = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Use faster model for detection
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for more consistent results
        system: ticketDetectionPrompt,
        messages: [detectionMessage]
      });

      const analysisText = ticketResponse.content[0].text;
      
      // Parse the response
      const createTicketMatch = analysisText.match(/CREATE_TICKET:\\s*(true|false)/i);
      const shouldCreate = createTicketMatch && createTicketMatch[1].toLowerCase() === 'true';
      
      // Also check for explicit ticket keywords in assistant response
      const ticketKeywords = [
        'создал тикет', 'created.*ticket', 'creé.*ticket',
        'ticket.*#', 'тикет.*#', 'ticket número',
        'создать тикет', 'create.*ticket', 'crear.*ticket'
      ];
      
      const hasTicketKeywords = ticketKeywords.some(keyword => 
        new RegExp(keyword, 'i').test(response)
      );

      return shouldCreate || hasTicketKeywords;

    } catch (error) {
      logger.error('Error in ticket detection', { error: error.message });
      // Fallback to keyword detection
      return this._fallbackTicketDetection(response, originalMessage);
    }
  }

  /**
   * Fallback ticket detection using simple keywords
   * @private
   * @param {string} response - Claude's response
   * @param {string} originalMessage - Original user message
   * @returns {boolean} Whether to create a ticket
   */
  _fallbackTicketDetection(response, originalMessage) {
    const ticketIndicators = [
      // Response indicators
      'создал тикет', 'created a ticket', 'creé un ticket',
      'ticket #', 'тикет #', 'número de ticket',
      'команда поддержки', 'support team', 'equipo de soporte',
      
      // Message indicators
      'не работает', 'not working', 'no funciona',
      'ошибка', 'error', 'error',
      'проблема', 'problem', 'problema',
      'связаться с поддержкой', 'contact support', 'contactar soporte'
    ];

    const combined = `${response} ${originalMessage}`.toLowerCase();
    return ticketIndicators.some(indicator => combined.includes(indicator.toLowerCase()));
  }

  /**
   * Generate error response
   * @private
   * @param {Error} error - The error that occurred
   * @param {string} language - Language for error message
   * @returns {import('../types').ClaudeResponse} Error response
   */
  _getErrorResponse(error, language) {
    const errorMessages = ERROR_MESSAGES[language] || ERROR_MESSAGES.en;
    
    let message = errorMessages.generic;
    
    if (error.status === 429) {
      message = errorMessages.rate_limit;
    } else if (error.status >= 500) {
      message = errorMessages.api_error;
    }
    
    return {
      message,
      needsTicket: true,
      tokensUsed: 0,
      language,
      ticketReason: 'API error occurred'
    };
  }

  /**
   * Format history for context
   * @param {import('../types').Message[]} history - Conversation history
   * @param {number} [maxHistory=10] - Maximum number of messages to include
   * @returns {import('../types').Message[]} Formatted history
   */
  formatHistory(history, maxHistory = 10) {
    if (!Array.isArray(history)) {
      return [];
    }

    // Take the most recent messages
    const recentHistory = history.slice(-maxHistory);
    
    // Ensure proper format - FIX: handle both text and content fields
    return recentHistory.map(msg => ({
      role: msg.role,
      text: msg.text || msg.content || msg.message || '',
      timestamp: msg.timestamp || msg.createdAt
    }));
  }

  /**
   * Get token usage for a potential message
   * @param {string} message - Message to analyze
   * @param {import('../types').Message[]} [history=[]] - Conversation history
   * @param {string[]} [context=[]] - RAG context
   * @returns {number} Estimated token count
   */
  estimateTokenUsage(message, history = [], context = []) {
    return tokenCounter.countTotalTokens(SYSTEM_PROMPTS.basic, history, context) +
           tokenCounter.countTokensInText(message);
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: 'claude',
      model: this.config.model,
      status: 'active',
      enableRAG: this.config.enableRAG,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ClaudeService;
