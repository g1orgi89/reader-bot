/**
 * @file server/services/aiService.js
 * Универсальный сервис для работы с разными AI провайдерами (OpenAI/Anthropic)
 */

const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * @typedef {Object} AIResponse
 * @property {string} message - Ответное сообщение
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 * @property {string} provider - Использованный провайдер
 */

/**
 * @typedef {Object} AIOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Object[]} [history] - История сообщений
 * @property {string} [language] - Язык общения (en/es/ru)
 * @property {string} [userId] - ID пользователя для логирования
 */

/**
 * @class AIService
 * @description Универсальный сервис для работы с разными AI провайдерами
 */
class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'anthropic';
    this.initializeClients();
    this.systemPrompts = this.loadSystemPrompts();
  }

  /**
   * Инициализация клиентов для разных провайдеров
   */
  initializeClients() {
    // Инициализация OpenAI клиента
    if (this.provider === 'openai' || this.provider === 'both') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
      }
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    }

    // Инициализация Anthropic клиента
    if (this.provider === 'anthropic' || this.provider === 'both') {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when using Anthropic provider');
      }
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      this.anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    }

    logger.info(`AI Service initialized with provider: ${this.provider}`);
  }

  /**
   * Загружает системные промпты
   */
  loadSystemPrompts() {
    const { SYSTEM_PROMPTS } = require('../config/prompts');
    return SYSTEM_PROMPTS;
  }

  /**
   * Генерирует ответ с использованием выбранного провайдера
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Дополнительные опции
   * @returns {Promise<AIResponse>} Ответ от AI
   */
  async generateResponse(message, options = {}) {
    try {
      switch (this.provider) {
        case 'openai':
          return await this.generateOpenAIResponse(message, options);
        case 'anthropic':
          return await this.generateAnthropicResponse(message, options);
        case 'both':
          // A/B тестирование или fallback
          return await this.generateResponseWithFallback(message, options);
        default:
          throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      logger.error(`AI Service error: ${error.message}`, { 
        provider: this.provider, 
        userId: options.userId 
      });
      throw error;
    }
  }

  /**
   * Генерирует ответ с помощью OpenAI
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Опции
   * @returns {Promise<AIResponse>} Ответ от OpenAI
   */
  async generateOpenAIResponse(message, options = {}) {
    const { context = [], history = [], language = 'en' } = options;
    
    const messages = [
      { role: 'system', content: this.getSystemPrompt(language, context.length > 0) },
      ...this.formatHistoryForOpenAI(history),
      ...this.formatContextForOpenAI(context),
      { role: 'user', content: message }
    ];

    // Проверка лимита токенов
    const estimatedTokens = this.estimateTokens(messages);
    if (estimatedTokens > 16000) {
      // Обрезаем историю если слишком много токенов
      const trimmedHistory = history.slice(-3);
      return this.generateOpenAIResponse(message, { 
        ...options, 
        history: trimmedHistory 
      });
    }

    const response = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const answer = response.choices[0].message.content;
    
    return {
      message: answer,
      needsTicket: this.detectTicketCreation(answer, message),
      tokensUsed: response.usage.total_tokens,
      provider: 'openai'
    };
  }

  /**
   * Генерирует ответ с помощью Anthropic Claude
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Опции
   * @returns {Promise<AIResponse>} Ответ от Anthropic
   */
  async generateAnthropicResponse(message, options = {}) {
    const { context = [], history = [], language = 'en' } = options;
    
    let systemPrompt = this.getSystemPrompt(language, context.length > 0);
    
    const messages = [
      ...this.formatHistoryForAnthropic(history),
      ...this.formatContextForAnthropic(context),
      { role: 'user', content: message }
    ];

    // Проверка лимита токенов для Claude
    const estimatedTokens = this.estimateTokens(messages) + systemPrompt.length / 4;
    if (estimatedTokens > 100000) {
      const trimmedHistory = history.slice(-5);
      return this.generateAnthropicResponse(message, { 
        ...options, 
        history: trimmedHistory 
      });
    }

    const response = await this.anthropicClient.messages.create({
      model: this.anthropicModel,
      max_tokens: 1000,
      temperature: 0.7,
      system: systemPrompt,
      messages
    });

    const answer = response.content[0].text;
    
    return {
      message: answer,
      needsTicket: this.detectTicketCreation(answer, message),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      provider: 'anthropic'
    };
  }

  /**
   * Генерирует ответ с fallback (сначала основной провайдер, потом запасной)
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Опции
   * @returns {Promise<AIResponse>} Ответ от AI
   */
  async generateResponseWithFallback(message, options = {}) {
    const primaryProvider = process.env.PRIMARY_AI_PROVIDER || 'anthropic';
    const fallbackProvider = primaryProvider === 'anthropic' ? 'openai' : 'anthropic';
    
    try {
      // Попытка с основным провайдером
      if (primaryProvider === 'anthropic') {
        return await this.generateAnthropicResponse(message, options);
      } else {
        return await this.generateOpenAIResponse(message, options);
      }
    } catch (error) {
      logger.warn(`Primary provider ${primaryProvider} failed, trying fallback: ${error.message}`);
      
      // Fallback на запасной провайдер
      try {
        if (fallbackProvider === 'anthropic') {
          return await this.generateAnthropicResponse(message, options);
        } else {
          return await this.generateOpenAIResponse(message, options);
        }
      } catch (fallbackError) {
        logger.error(`Fallback provider ${fallbackProvider} also failed: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
  }

  /**
   * Получает системный промпт в зависимости от языка и наличия контекста
   * @param {string} language - Язык (en/es/ru)
   * @param {boolean} hasContext - Есть ли контекст из базы знаний
   * @returns {string} Системный промпт
   */
  getSystemPrompt(language = 'en', hasContext = false) {
    const promptType = hasContext ? 'rag' : 'basic';
    return this.systemPrompts[promptType][language] || this.systemPrompts[promptType].en;
  }

  /**
   * Форматирует историю для OpenAI
   * @param {Object[]} history - История сообщений
   * @returns {Object[]} Форматированная история
   */
  formatHistoryForOpenAI(history) {
    if (!history || history.length === 0) return [];
    
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text || msg.content
    }));
  }

  /**
   * Форматирует историю для Anthropic
   * @param {Object[]} history - История сообщений
   * @returns {Object[]} Форматированная история
   */
  formatHistoryForAnthropic(history) {
    if (!history || history.length === 0) return [];
    
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text || msg.content
    }));
  }

  /**
   * Форматирует контекст для OpenAI
   * @param {string[]} context - Контекст из базы знаний
   * @returns {Object[]} Форматированный контекст
   */
  formatContextForOpenAI(context) {
    if (!context || context.length === 0) return [];
    
    const contextMessage = `### Релевантная информация из базы знаний:\n\n${context.join('\n\n')}\n\n### Используй приведенную выше информацию для ответа.`;
    
    return [
      { role: 'system', content: contextMessage }
    ];
  }

  /**
   * Форматирует контекст для Anthropic
   * @param {string[]} context - Контекст из базы знаний
   * @returns {Object[]} Форматированный контекст
   */
  formatContextForAnthropic(context) {
    if (!context || context.length === 0) return [];
    
    const contextMessage = `<relevant_knowledge>\n${context.join('\n\n')}\n</relevant_knowledge>\n\nИспользуй приведенную выше информацию для точного ответа на вопрос пользователя.`;
    
    return [
      { role: 'user', content: contextMessage },
      { role: 'assistant', content: 'Я изучил предоставленную информацию и готов ответить на вопрос пользователя, используя эти знания.' }
    ];
  }

  /**
   * Проверяет, нужно ли создавать тикет на основе ответа
   * @param {string} response - Ответ от AI
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message) {
    const ticketKeywords = [
      'создать тикет', 'create a ticket', 'crear un ticket',
      'более глубокого погружения', 'requires deeper investigation',
      'свяжутся с вами', 'will contact you', 'se pondrán en contacto',
      'создал тикет', 'created a ticket', 'creado un ticket',
      'TICKET_ID', '#'
    ];
    
    const problemKeywords = [
      'не работает', 'ошибка', 'problem', 'error', 'issue',
      'не могу', 'can\'t', 'cannot', 'no puedo', 'не удается',
      'bug', 'баг', 'сбой', 'поломка', 'stuck', 'зависло',
      'failed', 'failure', 'fallen', 'perdido', 'потерян'
    ];
    
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return hasTicketKeywords || hasProblemKeywords;
  }

  /**
   * Оценивает количество токенов в сообщениях
   * @param {Object[]} messages - Сообщения
   * @returns {number} Приблизительное количество токенов
   */
  estimateTokens(messages) {
    return messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + Math.ceil(content.length / 4); // Грубая оценка: 1 токен ≈ 4 символа
    }, 0);
  }

  /**
   * Получает информацию о текущем провайдере
   * @returns {Object} Информация о провайдере
   */
  getProviderInfo() {
    return {
      currentProvider: this.provider,
      availableProviders: ['openai', 'anthropic', 'both'],
      models: {
        openai: this.openaiModel,
        anthropic: this.anthropicModel
      }
    };
  }

  /**
   * Переключает провайдера (для runtime смены без перезапуска)
   * @param {string} newProvider - Новый провайдер
   */
  switchProvider(newProvider) {
    if (!['openai', 'anthropic', 'both'].includes(newProvider)) {
      throw new Error(`Invalid provider: ${newProvider}`);
    }
    
    this.provider = newProvider;
    this.initializeClients();
    logger.info(`Switched to AI provider: ${newProvider}`);
  }
}

// Создаем и экспортируем singleton экземпляр
const aiService = new AIService();

module.exports = aiService;