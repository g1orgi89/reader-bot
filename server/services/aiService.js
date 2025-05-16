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
    this.loadSystemPrompts();
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
    const { getSystemPrompt, createContextPrompt, getLocalizedPrompt } = require('../config/prompts');
    this.getSystemPrompt = getSystemPrompt;
    this.createContextPrompt = createContextPrompt;
    this.getLocalizedPrompt = getLocalizedPrompt;
  }

  /**
   * Генерирует ответ с использованием выбранного провайдера
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Дополнительные опции
   * @returns {Promise<AIResponse>} Ответ от AI
   */
  async generateResponse(message, options = {}) {
    try {
      // Проверяем, связан ли вопрос с проектом Shrooms
      if (!this.isRelevantToShrooms(message, options.language)) {
        return {
          message: this.getOutOfScopeResponse(options.language),
          needsTicket: false,
          tokensUsed: 50,
          provider: this.provider
        };
      }

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
   * НОВОЕ: Проверяет, связан ли вопрос с проектом Shrooms
   * @param {string} message - Сообщение пользователя
   * @param {string} language - Язык
   * @returns {boolean} Относится ли к Shrooms
   */
  isRelevantToShrooms(message, language = 'en') {
    const shroomsKeywords = [
      // English
      'shrooms', 'mushroom', 'farming', 'staking', 'xverse', 'hiro', 'wallet',
      'spores', 'token', 'connect', 'stacks', 'mycelium',
      
      // Russian
      'грибы', 'гриб', 'фарминг', 'стейкинг', 'кошелек', 'токен', 'споры',
      'подключ', 'мицелий', 'сеть', 'блокчейн',
      
      // Spanish
      'hongos', 'setas', 'billetera', 'conectar', 'token', 'esporas',
      'farming', 'staking', 'red', 'blockchain'
    ];

    // Проверяем наличие ключевых слов Shrooms
    const hasKeywords = shroomsKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    // Исключения: очень общие вопросы, которые точно не о Shrooms
    const generalQuestions = [
      // English
      'what is bitcoin', 'what is crypto', 'how to invest', 'price prediction',
      'what time is it', 'weather', 'news', 'how to code',
      
      // Russian  
      'что такое биткоин', 'что такое крипта', 'как инвестировать', 'прогноз цены',
      'который час', 'погода', 'новости', 'как программировать',
      
      // Spanish
      'qué es bitcoin', 'qué es crypto', 'cómo invertir', 'predicción precio',
      'qué hora es', 'tiempo', 'noticias', 'cómo programar'
    ];

    const isGeneralQuestion = generalQuestions.some(question =>
      message.toLowerCase().includes(question.toLowerCase())
    );

    // Если есть ключевые слова Shrooms и это не общий вопрос
    return hasKeywords && !isGeneralQuestion;
  }

  /**
   * НОВОЕ: Возвращает ответ о выходе за рамки компетенции
   * @param {string} language - Язык
   * @returns {string} Ответ о выходе за рамки
   */
  getOutOfScopeResponse(language = 'en') {
    return this.getLocalizedPrompt('outOfScope', language);
  }

  /**
   * Генерирует ответ с помощью OpenAI
   * @param {string} message - Сообщение пользователя
   * @param {AIOptions} options - Опции
   * @returns {Promise<AIResponse>} Ответ от OpenAI
   */
  async generateOpenAIResponse(message, options = {}) {
    const { context = [], history = [], language = 'en' } = options;
    
    // Используем контекстный промпт, если есть контекст
    let systemPrompt;
    if (context.length > 0) {
      systemPrompt = this.createContextPrompt(context, message, language);
    } else {
      systemPrompt = this.getSystemPrompt('basic', language);
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.formatHistoryForOpenAI(history),
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
      needsTicket: this.detectTicketCreation(answer, message, language),
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
    
    // Используем контекстный промпт, если есть контекст
    let systemPrompt;
    if (context.length > 0) {
      systemPrompt = this.createContextPrompt(context, message, language);
    } else {
      systemPrompt = this.getSystemPrompt('basic', language);
    }
    
    const messages = [
      ...this.formatHistoryForAnthropic(history),
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
      needsTicket: this.detectTicketCreation(answer, message, language),
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
   * Форматирует историю для OpenAI
   * @param {Object[]} history - История сообщений
   * @returns {Object[]} Форматированная история
   */
  formatHistoryForOpenAI(history) {
    if (!history || history.length === 0) return [];
    
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text || msg.content
    })).slice(-6); // Ограничиваем историю до 6 сообщений
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
    })).slice(-6); // Ограничиваем историю до 6 сообщений
  }

  /**
   * Проверяет, нужно ли создавать тикет на основе ответа
   * @param {string} response - Ответ от AI
   * @param {string} message - Исходное сообщение
   * @param {string} language - Язык сообщения
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message, language = 'en') {
    // Ключевые слова в ответе, указывающие на тикет (мультиязычные)
    const ticketKeywords = [
      // English
      'create a ticket', 'create ticket', 'support ticket', 'human support', 
      'technical support', 'TICKET_ID', 'I\'ll create', 'will contact you',
      
      // Russian
      'создать тикет', 'создам тикет', 'тикет поддержки', 'человеческая поддержка', 
      'техническая поддержка', 'свяжутся с вами', 'я создам',
      
      // Spanish
      'crear un ticket', 'ticket de soporte', 'soporte humano', 'soporte técnico', 
      'se pondrán en contacto'
    ];
    
    // Проблемные ключевые слова в сообщении пользователя (мультиязычные)
    const problemKeywords = [
      // English - только о Shrooms
      'shrooms error', 'shrooms problem', 'wallet not connecting', 'transaction failed',
      'farming not working', 'staking issue', 'xverse problem', 'hiro wallet stuck',
      
      // Russian - только о Shrooms
      'ошибка shrooms', 'проблема с грибами', 'кошелек не подключается', 'транзакция не прошла',
      'фарминг не работает', 'проблемы стейкинга', 'проблема xverse', 'hiro зависло',
      
      // Spanish - только о Shrooms  
      'error shrooms', 'problema hongos', 'billetera no conecta', 'transacción falló',
      'farming no funciona', 'problema staking', 'problema xverse', 'hiro no funciona'
    ];
    
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Дополнительные проверки для технических проблем Shrooms
    const technicalIssues = [
      /shrooms.*wallet.*connect/i,
      /shrooms.*transaction.*fail/i,
      /shrooms.*farming.*error/i,
      /xverse.*shrooms/i,
      /hiro.*shrooms/i
    ];
    
    const hasTechnicalIssue = technicalIssues.some(pattern => 
      pattern.test(message)
    );
    
    return hasTicketKeywords || hasProblemKeywords || hasTechnicalIssue;
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
      },
      status: 'healthy'
    };
  }

  /**
   * Проверяет здоровье AI сервиса
   * @returns {Promise<boolean>} Здоров ли сервис
   */
  async isHealthy() {
    try {
      if (this.provider === 'anthropic' || this.provider === 'both') {
        if (!this.anthropicClient) return false;
      }
      if (this.provider === 'openai' || this.provider === 'both') {
        if (!this.openaiClient) return false;
      }
      return true;
    } catch (error) {
      logger.error(`AI Service health check failed: ${error.message}`);
      return false;
    }
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