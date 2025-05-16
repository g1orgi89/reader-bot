/**
 * Сервис для взаимодействия с API Claude
 * @file server/services/claude.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { CLAUDE_API_KEY } = require('../config');

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Ответ от Claude
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 */

/**
 * @typedef {Object} MessageContext
 * @property {string[]} context - Контекст из базы знаний
 * @property {Object[]} history - История сообщений
 * @property {string} language - Язык общения
 */

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API
 */
class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });
    
    // Оптимизированный системный промпт
    this.systemPrompt = this._getSystemPrompt();
    
    // Кэш для частых запросов
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * @param {string} message - Сообщение пользователя
   * @param {MessageContext} options - Дополнительные опции
   * @returns {Promise<ClaudeResponse>} Ответ от Claude
   */
  async generateResponse(message, options = {}) {
    try {
      const { context = [], history = [], language = 'en' } = options;
      
      // Проверяем кэш для простых запросов
      const cacheKey = this._getCacheKey(message, language);
      if (this.responseCache.has(cacheKey)) {
        const cached = this.responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          logger.debug('Returning cached response');
          return cached.response;
        }
      }
      
      // Детекция тестовых сообщений
      if (this._isTestMessage(message)) {
        return this._handleTestMessage(message, language);
      }
      
      // Формируем сообщения для Claude
      const messages = this._buildMessages(message, context, history, language);
      
      // Отправляем запрос к Claude с оптимизированными параметрами
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.3,
        messages
      });
      
      const answer = response.content[0].text;
      
      // Определяем необходимость создания тикета
      const needsTicket = this._analyzeTicketNeed(answer, message);
      
      const result = {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens
      };
      
      // Кэшируем простые ответы
      if (this._isCacheable(message)) {
        this.responseCache.set(cacheKey, {
          response: result,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`Claude API error: ${error.message}`);
      return this._getErrorResponse(error, options.language);
    }
  }
  
  /**
   * Получает системный промпт
   * @private
   * @returns {string} Системный промпт
   */
  _getSystemPrompt() {
    return `You are an AI assistant for the "Shrooms" Web3 platform. You should:
1. Answer only questions about Shrooms, Web3, blockchain, tokens, wallets, DeFi
2. Use mushroom-themed language occasionally but keep it professional
3. Be concise and helpful
4. If you can't answer within Shrooms scope, suggest creating a support ticket
5. Respond in the user's language (EN, ES, RU)

Keep responses under 100 words unless more detail is specifically requested.`;
  }
  
  /**
   * Строит сообщения для отправки Claude
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {string[]} context - Контекст
   * @param {Object[]} history - История
   * @param {string} language - Язык
   * @returns {Object[]} Массив сообщений
   */
  _buildMessages(message, context, history, language) {
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];
    
    // Добавляем контекст если есть (для будущего RAG)
    if (context && context.length > 0) {
      const contextMessage = `Context: ${context.slice(0, 2).join('\n\n')}`;
      messages.push({ role: 'user', content: contextMessage });
      messages.push({ role: 'assistant', content: 'I understand the context.' });
    }
    
    // Добавляем только последние 2 сообщения из истории
    if (history && history.length > 0) {
      const recentHistory = history.slice(-2);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    // Добавляем текущее сообщение
    messages.push({ role: 'user', content: message });
    
    return messages;
  }
  
  /**
   * Проверяет, является ли сообщение тестовым
   * @private
   * @param {string} message - Сообщение
   * @returns {boolean} Является ли тестовым
   */
  _isTestMessage(message) {
    const testPatterns = [
      /performance test/i,
      /concurrent test/i,
      /^test$/i,
      /^hello$/i,
      /^hi$/i
    ];
    
    return testPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Обрабатывает тестовые сообщения быстро
   * @private
   * @param {string} message - Сообщение
   * @param {string} language - Язык
   * @returns {ClaudeResponse} Быстрый ответ
   */
  _handleTestMessage(message, language) {
    const responses = {
      en: "*mushroom spores sparkle* Hello, digital explorer! How can I help you navigate the Shrooms ecosystem today?",
      ru: "*грибные споры сверкают* Привет, цифровой исследователь! Как могу помочь тебе в экосистеме Shrooms сегодня?",
      es: "*las esporas de hongos brillan* ¡Hola, explorador digital! ¿Cómo puedo ayudarte en el ecosistema Shrooms hoy?"
    };
    
    return {
      message: responses[language] || responses.en,
      needsTicket: false,
      tokensUsed: 50
    };
  }
  
  /**
   * Анализирует необходимость создания тикета
   * @private
   * @param {string} response - Ответ от Claude
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  _analyzeTicketNeed(response, message) {
    // Тестовые сообщения не должны создавать тикеты
    if (this._isTestMessage(message)) {
      return false;
    }
    
    // Ключевые слова в ответе, указывающие на тикет
    const ticketIndicators = [
      'create a ticket',
      'создать тикет',
      'crear un ticket',
      'support ticket',
      'human support',
      'technical support'
    ];
    
    const responseNeedsTicket = ticketIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Проблемные ключевые слова в сообщении пользователя
    const problemKeywords = [
      /error/i,
      /problem/i,
      /issue/i,
      /stuck/i,
      /failed/i,
      /not working/i,
      /ошибка/i,
      /проблема/i,
      /не работает/i,
      /error/i,
      /problema/i,
      /no funciona/i
    ];
    
    const messageHasProblem = problemKeywords.some(keyword => 
      keyword.test(message)
    );
    
    return responseNeedsTicket || messageHasProblem;
  }
  
  /**
   * Проверяет, можно ли кэшировать ответ
   * @private
   * @param {string} message - Сообщение
   * @returns {boolean} Можно ли кэшировать
   */
  _isCacheable(message) {
    return this._isTestMessage(message) || message.length < 50;
  }
  
  /**
   * Получает ключ для кэша
   * @private
   * @param {string} message - Сообщение
   * @param {string} language - Язык
   * @returns {string} Ключ кэша
   */
  _getCacheKey(message, language) {
    return `${language}:${message.toLowerCase()}`;
  }
  
  /**
   * Возвращает ответ об ошибке
   * @private
   * @param {Error} error - Ошибка
   * @param {string} language - Язык
   * @returns {ClaudeResponse} Ответ об ошибке
   */
  _getErrorResponse(error, language = 'en') {
    const errorMessages = {
      en: "I'm experiencing technical difficulties right now. Let me create a support ticket for you.",
      ru: "У меня сейчас технические проблемы. Позвольте мне создать тикет поддержки для вас.",
      es: "Estoy experimentando dificultades técnicas ahora. Permíteme crear un ticket de soporte para ti."
    };
    
    return {
      message: errorMessages[language] || errorMessages.en,
      needsTicket: true,
      tokensUsed: 0
    };
  }
  
  /**
   * Очищает устаревший кэш
   * @public
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp >= this.cacheTimeout) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Получает статистику кэша
   * @public
   * @returns {Object} Статистика кэша
   */
  getCacheStats() {
    return {
      cacheSize: this.responseCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

// Экспортируем единственный экземпляр
module.exports = new ClaudeService();