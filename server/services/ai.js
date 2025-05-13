/**
 * @file Universal AI Service
 * @description Универсальный сервис для работы с различными AI провайдерами
 */

const logger = require('../utils/logger');
const { getAIProviderConfig } = require('../config/aiProvider');

/**
 * @class AIService
 * @description Универсальный сервис для работы с различными AI провайдерами
 */
class AIService {
  /**
   * @constructor
   */
  constructor() {
    this.config = getAIProviderConfig();
    this.provider = this.config.provider;
    this.systemPrompt = '';
    this.initializeProvider();
  }

  /**
   * Инициализация выбранного провайдера
   * @private
   */
  initializeProvider() {
    switch (this.provider) {
      case 'claude':
        const { Anthropic } = require('@anthropic-ai/sdk');
        this.client = new Anthropic({
          apiKey: this.config.claude.apiKey
        });
        this.model = this.config.claude.model;
        this.maxTokens = this.config.claude.maxTokens;
        this.temperature = this.config.claude.temperature;
        break;
      
      case 'openai':
        const OpenAI = require('openai');
        this.client = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
        this.model = this.config.openai.model;
        this.maxTokens = this.config.openai.maxTokens;
        this.temperature = this.config.openai.temperature;
        break;
      
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
    
    logger.info(`AI Service initialized with provider: ${this.provider}`);
  }

  /**
   * Установка системного промпта
   * @param {string} prompt - Системный промпт
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }

  /**
   * Генерация ответа
   * @param {string} message - Сообщение пользователя
   * @param {Object} options - Опции генерации
   * @param {string[]} options.context - Контекст из базы знаний
   * @param {Object[]} options.history - История сообщений
   * @param {string} options.language - Язык общения
   * @returns {Promise<Object>} Ответ AI
   */
  async generateResponse(message, options = {}) {
    try {
      const { context = [], history = [], language = 'en' } = options;
      
      if (this.provider === 'claude') {
        return await this.generateClaudeResponse(message, { context, history, language });
      } else if (this.provider === 'openai') {
        return await this.generateOpenAIResponse(message, { context, history, language });
      }
      
      throw new Error(`Unknown provider: ${this.provider}`);
    } catch (error) {
      logger.error(`AI generation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Генерация ответа через Claude API
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {Object} options - Опции
   * @returns {Promise<Object>} Ответ от Claude
   */
  async generateClaudeResponse(message, options) {
    const { context, history, language } = options;
    
    // Формирование сообщений для Claude
    const messages = [];
    
    // Добавление истории
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.text || msg.content
        });
      }
    }
    
    // Формирование основного сообщения с контекстом
    let userMessage = message;
    if (context && context.length > 0) {
      userMessage = `Контекст из базы знаний:\n${context.join('\n\n')}\n\nВопрос: ${message}`;
    }
    
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: this.systemPrompt,
      messages
    });
    
    const answer = response.content[0].text;
    
    return {
      message: answer,
      needsTicket: this.detectTicketCreation(answer, message),
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model: this.model,
      provider: 'claude'
    };
  }

  /**
   * Генерация ответа через OpenAI API
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {Object} options - Опции
   * @returns {Promise<Object>} Ответ от OpenAI
   */
  async generateOpenAIResponse(message, options) {
    const { context, history, language } = options;
    
    // Формирование сообщений для OpenAI
    const messages = [];
    
    // Добавление системного промпта
    if (this.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Добавление истории
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.text || msg.content
        });
      }
    }
    
    // Формирование основного сообщения с контекстом
    let userMessage = message;
    if (context && context.length > 0) {
      userMessage = `Контекст из базы знаний:\n${context.join('\n\n')}\n\nВопрос: ${message}`;
    }
    
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature
    });
    
    const answer = response.choices[0].message.content;
    
    return {
      message: answer,
      needsTicket: this.detectTicketCreation(answer, message),
      tokensUsed: response.usage?.total_tokens || 0,
      model: this.model,
      provider: 'openai'
    };
  }

  /**
   * Определение необходимости создания тикета
   * @private
   * @param {string} response - Ответ AI
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message) {
    // Ключевые слова, указывающие на необходимость создания тикета
    const ticketKeywords = [
      'создать тикет',
      'create a ticket',
      'более глубокого погружения',
      'requires deeper investigation',
      'свяжутся с вами',
      'will contact you',
      'создал тикет',
      'created a ticket',
      'TICKET_ID'
    ];
    
    // Проверка наличия ключевых слов в ответе
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Ключевые слова в вопросе пользователя, указывающие на техническую проблему
    const problemKeywords = [
      'не работает',
      'ошибка',
      'problem',
      'error',
      'issue',
      'не могу',
      'can\'t',
      'не удается',
      'bug',
      'баг',
      'сбой',
      'поломка',
      'stuck',
      'зависло',
      'failed',
      'failure'
    ];
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return hasTicketKeywords || hasProblemKeywords;
  }

  /**
   * Получение информации о текущем провайдере
   * @returns {Object} Информация о провайдере
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    };
  }
}

module.exports = AIService;
