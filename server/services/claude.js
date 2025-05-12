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
   * @param {string} [config.baseURL] - Custom base URL for Anthropic API
   */
  constructor(config) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Build Anthropic client configuration - only include baseURL if provided
    const clientConfig = {
      apiKey: config.apiKey,
    };

    // Only add baseURL to config if it's explicitly provided and not undefined
    if (config.baseURL) {
      clientConfig.baseURL = config.baseURL;
    }

    this.client = new Anthropic(clientConfig);

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

      // Auto-detect language if not provided
      const detectedLanguage = language === 'en' ? 
        languageDetector.detect(message) : 
        language;

      // Prepare system prompt based on context availability
      let systemPrompt = SYSTEM_PROMPTS.basic;
      if (context && context.length > 0) {
        systemPrompt = SYSTEM_PROMPTS.rag;
      }

      // Build messages array
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

      let answer = response.content[0].text;
      
      // Check if ticket creation is needed and get ticket info
      const ticketInfo = await this._analyzeTicketNeed(answer, message, detectedLanguage);
      
      // If ticket is needed, modify the response to include ticket information
      if (ticketInfo.needsTicket) {
        answer = await this._incorporateTicketInfo(answer, ticketInfo, detectedLanguage);
      }
      
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
        needsTicket: ticketInfo.needsTicket,
        ticketId: ticketInfo.ticketId || null
      });

      return {
        message: answer,
        needsTicket: ticketInfo.needsTicket,
        tokensUsed: tokenUsage.totalTokens,
        ticketReason: ticketInfo.reason || null,
        ticketId: ticketInfo.ticketId || null,
        ticketCategory: ticketInfo.category || null,
        ticketPriority: ticketInfo.priority || null,
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
        content: `### Релевантная информация из базы знаний:\\n\\n${context.join('\\n\\n')}\\n\\n### Используй приведенную выше информацию, чтобы ответить на следующий вопрос от пользователя.`
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
   * Analyze if a ticket is needed and gather ticket information
   * @private
   * @param {string} response - Claude's response
   * @param {string} originalMessage - Original user message
   * @param {string} language - Language code
   * @returns {Promise<Object>} Ticket analysis result
   */
  async _analyzeTicketNeed(response, originalMessage, language) {
    try {
      // First check if the assistant already mentioned creating a ticket
      const mentionsTicket = this._checkTicketMentioned(response);
      if (mentionsTicket) {
        return {
          needsTicket: true,
          reason: 'Assistant already mentioned creating a ticket',
          category: 'general',
          priority: 'medium',
          ticketId: this._generateTicketId()
        };
      }

      // Use Claude to analyze if ticket creation is needed
      const ticketDetectionPrompt = SYSTEM_PROMPTS.ticketCreation;
      
      const detectionMessage = {
        role: 'user',
        content: `Проанализируй следующие сообщения и определи, нужно ли создать тикет:\\n\\nСообщение пользователя: "${originalMessage}"\\nОтвет ассистента: "${response}"\\n\\nЯзык общения: ${language}\\n\\nОтвечай только в формате:\\nCREATE_TICKET: true/false\\nREASON: [причина решения]\\nCATEGORY: [technical/account/billing/feature/other] (если нужен тикет)\\nPRIORITY: [low/medium/high/urgent] (если нужен тикет)`
      };

      const ticketResponse = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0.3,
        system: ticketDetectionPrompt,
        messages: [detectionMessage]
      });

      const analysisText = ticketResponse.content[0].text;
      
      // Parse the response
      const createTicketMatch = analysisText.match(/CREATE_TICKET:\\s*(true|false)/i);
      const reasonMatch = analysisText.match(/REASON:\\s*(.+?)(?:\\n|$)/i);
      const categoryMatch = analysisText.match(/CATEGORY:\\s*(\\w+)/i);
      const priorityMatch = analysisText.match(/PRIORITY:\\s*(\\w+)/i);
      
      const shouldCreate = createTicketMatch && createTicketMatch[1].toLowerCase() === 'true';
      
      if (shouldCreate) {
        return {
          needsTicket: true,
          reason: reasonMatch ? reasonMatch[1].trim() : 'Auto-detected based on message content',
          category: categoryMatch ? categoryMatch[1] : 'other',
          priority: priorityMatch ? priorityMatch[1] : 'medium',
          ticketId: this._generateTicketId()
        };
      } else {
        return {
          needsTicket: false,
          reason: reasonMatch ? reasonMatch[1].trim() : 'No ticket needed'
        };
      }

    } catch (error) {
      logger.error('Error in ticket analysis', { error: error.message });
      // Fallback to keyword detection
      return this._fallbackTicketDetection(response, originalMessage);
    }
  }

  /**
   * Check if the response already mentions creating a ticket
   * @private
   * @param {string} response - Claude's response
   * @returns {boolean} Whether ticket creation is mentioned
   */
  _checkTicketMentioned(response) {
    const ticketKeywords = [
      'создал тикет', 'создаю тикет', 'создам тикет',
      'created.*ticket', 'creating.*ticket', 'create.*ticket',
      'creé.*ticket', 'creando.*ticket', 'crear.*ticket',
      'ticket.*#', 'тикет.*#', 'ticket.*número',
      '#TICKET_ID'
    ];
    
    return ticketKeywords.some(keyword => 
      new RegExp(keyword, 'i').test(response)
    );
  }

  /**
   * Generate a unique ticket ID
   * @private
   * @returns {string} Generated ticket ID
   */
  _generateTicketId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SHROOM${timestamp}${random}`.toUpperCase();
  }

  /**
   * Incorporate ticket information into the response
   * @private
   * @param {string} response - Original response
   * @param {Object} ticketInfo - Ticket information
   * @param {string} language - Language code
   * @returns {Promise<string>} Modified response with ticket info
   */
  async _incorporateTicketInfo(response, ticketInfo, language) {
    try {
      // Get ticket message template
      const ticketMessage = TICKET_MESSAGES[language] || TICKET_MESSAGES.en;
      const ticketText = ticketMessage.created.replace('{ticketId}', ticketInfo.ticketId);
      
      // If the response already mentions creating a ticket, replace placeholder
      if (response.includes('#TICKET_ID')) {
        return response.replace('#TICKET_ID', ticketInfo.ticketId);
      }
      
      // Otherwise, append ticket information to the response
      return `${response}\\n\\n${ticketText}`;
      
    } catch (error) {
      logger.error('Error incorporating ticket info', { error: error.message });
      return response;
    }
  }

  /**
   * Fallback ticket detection using simple keywords
   * @private
   * @param {string} response - Claude's response
   * @param {string} originalMessage - Original user message
   * @returns {Object} Ticket detection result
   */
  _fallbackTicketDetection(response, originalMessage) {
    const troubleIndicators = [
      // Problem keywords
      'не работает', 'not working', 'no funciona',
      'ошибка', 'error', 'error',
      'проблема', 'problem', 'problema',
      'сбой', 'bug', 'fallo',
      'не могу', 'can\'t', 'cannot', 'no puedo',
      
      // Support request keywords
      'поддержка', 'support', 'soporte',
      'помощь', 'help', 'ayuda',
      'связаться', 'contact', 'contactar'
    ];

    const combined = `${response} ${originalMessage}`.toLowerCase();
    const hasProblems = troubleIndicators.some(indicator => 
      combined.includes(indicator.toLowerCase())
    );

    if (hasProblems) {
      return {
        needsTicket: true,
        reason: 'Detected problem keywords in conversation',
        category: 'other',
        priority: 'medium',
        ticketId: this._generateTicketId()
      };
    }

    return {
      needsTicket: false,
      reason: 'No issues detected in conversation'
    };
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
    
    // Ensure proper format
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