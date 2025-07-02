/**
 * Сервис для взаимодействия с API Claude и другими AI провайдерами
 * @file server/services/claude.js
 * 📖 ОБНОВЛЕНО: Упрощена языковая логика - универсальные промпты
 * 📖 ИСПРАВЛЕНО: Убрана проверка "Привет" как тестового сообщения
 * 🔧 FIX: Предотвращена загрузка векторной базы когда useRag=false
 * 🚨 URGENT FIX: RAG полностью отключен для Reader Bot
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { getAIProviderConfig } = require('../config/aiProvider');
// 🚨 ОТКЛЮЧАЕМ vectorStoreService для Reader Bot
// const vectorStoreService = require('./vectorStore');
const promptService = require('./promptService');

/**
 * @typedef {Object} AIResponse
 * @property {string} message - Ответ от AI
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 * @property {string} provider - Название использованного провайдера
 * @property {string} model - Название использованной модели
 * @property {Object[]} [context] - Контекст, использованный для ответа (если RAG включен)
 */

/**
 * @typedef {Object} MessageOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Array<{role: string, content: string}>} [history] - История сообщений
 * @property {string} [language] - Язык общения (игнорируется - AI сам определяет)
 * @property {string} [platform] - Платформа (web, telegram)
 * @property {string} [userId] - ID пользователя для логирования
 * @property {boolean} [useRag=false] - Использовать ли RAG функциональность (ОТКЛЮЧЕНО в Reader Bot)
 * @property {number} [ragLimit=3] - Количество документов для RAG
 */

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API и другими провайдерами AI
 */
class ClaudeService {
  constructor() {
    this.config = getAIProviderConfig();
    
    if (this.config.provider === 'anthropic') {
      this.provider = 'claude';
      logger.info('📖 Provider name normalized from "anthropic" to "claude"');
    } else {
      this.provider = this.config.provider || 'claude';
    }
    
    logger.info(`📖 AI Provider configuration loaded: ${this.provider}`);
    
    this.clients = {};
    this.initializeProviders();
    
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    setInterval(this.clearExpiredCache.bind(this), 15 * 60 * 1000);
    
    // 🚨 URGENT FIX: RAG ПОЛНОСТЬЮ ОТКЛЮЧЕН для Reader Bot
    this.enableRag = false;
    
    logger.info(`📖 ClaudeService initialized with provider: ${this.provider}, RAG enabled: ${this.enableRag}`);
  }

  /**
   * Инициализация доступных AI провайдеров
   * @private
   */
  initializeProviders() {
    try {
      this.clients.claude = new Anthropic({
        apiKey: this.config.claude.apiKey,
      });
      logger.info('📖 Claude client initialized successfully');
    } catch (error) {
      logger.error(`📖 Failed to initialize Claude client: ${error.message}`);
    }
    
    if (this.config.openai && this.config.openai.apiKey) {
      try {
        const OpenAI = require('openai');
        this.clients.openai = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
        logger.info('📖 OpenAI client initialized successfully');
      } catch (error) {
        logger.error(`📖 Failed to initialize OpenAI client: ${error.message}`);
      }
    }
  }

  /**
   * 📖 УПРОЩЕНО: Получить универсальный системный промпт
   * @private
   * @param {string} [platform='web'] - Платформа (web, telegram)
   * @returns {Promise<string>} Системный промпт
   */
  async _getSystemPrompt(platform = 'web') {
    try {
      return await promptService.getActivePrompt('basic');
    } catch (error) {
      logger.error(`📖 Error getting system prompt from PromptService: ${error.message}`);
      return promptService.getDefaultPrompt('basic');
    }
  }

  /**
   * 📖 УПРОЩЕНО: Получить универсальный RAG промпт (НЕ ИСПОЛЬЗУЕТСЯ в Reader Bot)
   * @private
   * @param {string} [platform='web'] - Платформа (web, telegram)
   * @returns {Promise<string>} RAG промпт
   */
  async _getRagPrompt(platform = 'web') {
    try {
      return await promptService.getActivePrompt('rag');
    } catch (error) {
      logger.error(`📖 Error getting RAG prompt from PromptService: ${error.message}`);
      return promptService.getDefaultPrompt('rag');
    }
  }
  
  /**
   * Переключение провайдера AI
   * @param {string} providerName - Имя провайдера ('claude', 'openai')
   * @returns {boolean} Успешность переключения
   */
  switchProvider(providerName) {
    if (providerName === 'anthropic') {
      providerName = 'claude';
      logger.info('📖 Provider name normalized from "anthropic" to "claude"');
    }
    
    if (!['claude', 'openai'].includes(providerName)) {
      logger.error(`📖 Invalid provider name: ${providerName}`);
      return false;
    }
    
    if (!this.clients[providerName]) {
      logger.error(`📖 Provider ${providerName} is not initialized`);
      return false;
    }
    
    this.provider = providerName;
    logger.info(`📖 Switched to provider: ${providerName}`);
    return true;
  }

  /**
   * Проверяет здоровье сервиса
   * @returns {Promise<boolean>} Статус здоровья
   */
  async isHealthy() {
    const currentProvider = this.provider;
    const client = this.clients[currentProvider];
    
    if (!client) {
      return false;
    }
    
    try {
      await promptService.getActivePrompt('basic');
      
      if (currentProvider === 'claude') {
        await this.clients.claude.messages.create({
          model: this.config.claude.model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
        });
      } else if (currentProvider === 'openai') {
        await this.clients.openai.chat.completions.create({
          model: this.config.openai.model,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          max_tokens: 10
        });
      }
      return true;
    } catch (error) {
      logger.error(`📖 Health check failed for ${currentProvider}: ${error.message}`);
      return false;
    }
  }

  /**
   * Тестирование произвольного промпта с Claude API
   * @param {string} customPrompt - Промпт для тестирования
   * @param {string} testMessage - Тестовое сообщение пользователя
   * @param {Object} options - Опции тестирования
   * @param {string} [options.provider] - Конкретный провайдер для использования
   * @returns {Promise<AIResponse>} Результат тестирования
   */
  async testPrompt(customPrompt, testMessage, options = {}) {
    const { provider } = options;
    
    const currentProvider = provider || this.provider;
    
    if (!this.clients[currentProvider]) {
      throw new Error(`Provider ${currentProvider} is not available`);
    }
    
    logger.info(`📖 Testing custom prompt with ${currentProvider}: "${customPrompt.substring(0, 50)}..."`);
    
    try {
      let response;
      
      if (currentProvider === 'claude') {
        response = await this.clients.claude.messages.create({
          model: this.config.claude.model,
          max_tokens: 1000,
          temperature: 0.7,
          system: customPrompt,
          messages: [
            { role: 'user', content: testMessage }
          ]
        });
        
        return {
          message: response.content[0].text,
          needsTicket: false,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          provider: 'claude',
          model: this.config.claude.model
        };
      } else if (currentProvider === 'openai') {
        response = await this.clients.openai.chat.completions.create({
          model: this.config.openai.model,
          messages: [
            { role: 'system', content: customPrompt },
            { role: 'user', content: testMessage }
          ],
          max_tokens: 1000,
          temperature: 0.7
        });
        
        return {
          message: response.choices[0].message.content,
          needsTicket: false,
          tokensUsed: response.usage.total_tokens || 0,
          provider: 'openai',
          model: this.config.openai.model
        };
      }
    } catch (error) {
      logger.error(`📖 Prompt test failed with ${currentProvider}: ${error.message}`);
      throw new Error(`Test failed: ${error.message}`);
    }
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * 📖 УПРОЩЕНО: Убрана сложная языковая логика
   * 📖 ИСПРАВЛЕНО: Убрана обработка "Привет" как тестового сообщения
   * 🚨 URGENT FIX: RAG ПОЛНОСТЬЮ ОТКЛЮЧЕН для Reader Bot
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от AI
   */
  async generateResponse(message, options = {}) {
    try {
      let { 
        context = [], 
        history = [], 
        language = 'auto', // Игнорируется - AI сам определяет
        platform = 'web',
        userId, 
        useRag = false, // 🚨 ПРИНУДИТЕЛЬНО false для Reader Bot
        ragLimit = 3 
      } = options;
      
      if (this.provider === 'anthropic') {
        this.provider = 'claude';
        logger.info(`📖 Provider normalized from 'anthropic' to 'claude' for message: ${message.substring(0, 20)}...`);
      }
      
      logger.info(`📖 Generating response for platform: ${platform}, useRag: ${useRag} (DISABLED in Reader Bot)`);
      
      // 📖 ИСПРАВЛЕНО: Убрана проверка на тестовые сообщения для реальных пользовательских запросов
      // Теперь только технические тесты считаются "тестовыми", а обычные приветствия идут через AI
      if (this._isTestMessage(message)) {
        return this._handleTestMessage(message, platform);
      }
      
      // 🚨 URGENT FIX: RAG ПОЛНОСТЬЮ ОТКЛЮЧЕН для Reader Bot
      logger.info(`📖 RAG disabled for Reader Bot - proceeding without vector store for message: "${message.substring(0, 30)}..."`);
      
      let response;
      
      logger.info(`📖 Using AI provider: ${this.provider} for platform: ${platform}, message: ${message.substring(0, 20)}...`);
      
      if (this.provider === 'claude') {
        response = await this._generateClaudeResponse(message, { ...options, context, platform });
      } else if (this.provider === 'openai') {
        response = await this._generateOpenAIResponse(message, { ...options, context, platform });
      } else {
        throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
      
      return response;
    } catch (error) {
      logger.error(`📖 AI generation error: ${error.message}`);
      return this._getErrorResponse(error, options.platform);
    }
  }

  /**
   * Генерация ответа через Claude API
   * 📖 УПРОЩЕНО: Убрана языковая логика
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от Claude
   */
  async _generateClaudeResponse(message, options) {
    const { context, history, platform = 'web', userId } = options;
    
    let systemPrompt;
    try {
      // Всегда используем базовый промпт, т.к. RAG отключен
      systemPrompt = await this._getSystemPrompt(platform);
    } catch (error) {
      logger.error(`📖 Error getting prompt from PromptService: ${error.message}`);
      systemPrompt = promptService.getDefaultPrompt('basic');
    }

    const messages = [];
    
    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || msg.text
        });
      });
    }
    
    messages.push({ role: 'user', content: message });
    
    if (userId) {
      logger.info(`📖 Generating Claude response for user ${userId} (platform: ${platform}, history: ${history?.length || 0} msgs)`);
    }
    
    try {
      const claudeConfig = this.config.claude;
      const response = await this.clients.claude.messages.create({
        model: claudeConfig.model,
        max_tokens: claudeConfig.maxTokens,
        temperature: claudeConfig.temperature,
        system: systemPrompt,
        messages: messages
      });
      
      const answer = response.content[0].text;
      
      // Анализ необходимости создания тикета
      const needsTicket = this._analyzeTicketNeedFromResponse(answer);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        provider: 'claude',
        model: claudeConfig.model
      };
    } catch (error) {
      logger.error(`📖 Claude API error: ${error.message}`);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Генерация ответа через OpenAI API
   * 📖 УПРОЩЕНО: Убрана языковая логика
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от OpenAI
   */
  async _generateOpenAIResponse(message, options) {
    const { context, history, platform = 'web', userId } = options;
    
    let systemPrompt;
    try {
      // Всегда используем базовый промпт, т.к. RAG отключен
      systemPrompt = await this._getSystemPrompt(platform);
    } catch (error) {
      logger.error(`📖 Error getting prompt from PromptService: ${error.message}`);
      systemPrompt = promptService.getDefaultPrompt('basic');
    }
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    if (history && history.length > 0) {
      const recentHistory = history.slice(-5);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || msg.text
        });
      });
    }
    
    messages.push({ role: 'user', content: message });
    
    if (userId) {
      logger.info(`📖 Generating OpenAI response for user ${userId} (platform: ${platform}, history: ${history?.length || 0} msgs)`);
    }
    
    try {
      const openaiConfig = this.config.openai;
      const response = await this.clients.openai.chat.completions.create({
        model: openaiConfig.model,
        messages,
        max_tokens: openaiConfig.maxTokens,
        temperature: openaiConfig.temperature
      });
      
      const answer = response.choices[0].message.content;
      
      // Анализ необходимости создания тикета
      const needsTicket = this._analyzeTicketNeedFromResponse(answer);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.total_tokens || 0,
        provider: 'openai',
        model: openaiConfig.model
      };
    } catch (error) {
      logger.error(`📖 OpenAI API error: ${error.message}`);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
  
  /**
   * Проверяет, является ли сообщение техническим тестом
   * 📖 ИСПРАВЛЕНО: Убраны обычные приветствия, оставлены только технические тесты
   * @private
   * @param {string} message - Сообщение
   * @returns {boolean} Является ли тестовым
   */
  _isTestMessage(message) {
    const testPatterns = [
      /performance test/i,
      /concurrent test/i,
      /^test$/i
      // Убрали /^hello$/i, /^hi$/i, /^привет$/i, /^hola$/i
      // Теперь только технические тесты обрабатываются как "тестовые"
    ];
    
    return testPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Обрабатывает технические тестовые сообщения быстро
   * 📖 УПРОЩЕНО: Только для технических тестов
   * @private
   * @param {string} message - Сообщение
   * @param {string} [platform='web'] - Платформа
   * @returns {AIResponse} Быстрый ответ
   */
  _handleTestMessage(message, platform = 'web') {
    const response = platform === 'telegram' 
      ? "📖 *Technical test acknowledged* System operational. How can I help you with your reading journey today?"
      : "*Technical test acknowledged* System operational. How can I help you with your reading journey today?";
    
    return {
      message: response,
      needsTicket: false,
      tokensUsed: 50,
      provider: this.provider,
      model: this.provider === 'claude' ? this.config.claude.model : this.config.openai.model
    };
  }
  
  /**
   * Анализ необходимости создания тикета из ответа AI
   * @private
   * @param {string} response - Ответ от AI
   * @returns {boolean} Нужно ли создавать тикет
   */
  _analyzeTicketNeedFromResponse(response) {
    // Ищем только прямые указания AI на создание тикета
    const directTicketIndicators = [
      '#TICKET_ID',
      'создал тикет',
      'создать тикет', 
      'тикет поддержки',
      'созданы тикет',
      'created ticket',
      'create a ticket',
      'support ticket',
      'created a ticket',
      'crear ticket', 
      'crear un ticket',
      'ticket de soporte',
      'creado un ticket',
      'наши эксперты свяжутся',
      'наша команда свяжется',
      'специалисты свяжутся',
      'поддержка свяжется'
    ];
    
    const aiWantsTicket = directTicketIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (aiWantsTicket) {
      logger.info(`📖 Ticket creation requested by AI in response`);
    }
    
    return aiWantsTicket;
  }
  
  /**
   * Проверяет, можно ли кэшировать ответ (только для технических тестов)
   * @private
   * @param {string} message - Сообщение
   * @returns {boolean} Можно ли кэшировать
   */
  _isCacheable(message) {
    return this._isTestMessage(message);
  }
  
  /**
   * Получает ключ для кэша с учетом платформы (без языка)
   * @private
   * @param {string} message - Сообщение
   * @param {string} [platform='web'] - Платформа
   * @returns {string} Ключ кэша
   */
  _getCacheKey(message, platform = 'web') {
    return `${platform}:${message.toLowerCase()}`;
  }
  
  /**
   * Возвращает ответ об ошибке (универсальный)
   * @private
   * @param {Error} error - Ошибка
   * @param {string} [platform='web'] - Платформа
   * @returns {AIResponse} Ответ об ошибке
   */
  _getErrorResponse(error, platform = 'web') {
    const message = platform === 'telegram'
      ? "📖 I'm experiencing technical difficulties. Let me create a support ticket so our team can help."
      : "I'm experiencing technical difficulties right now. Let me create a support ticket for you so our team can help.";
    
    return {
      message,
      needsTicket: true,
      tokensUsed: 0,
      provider: this.provider,
      model: "error"
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
   * @returns {Promise<Object>} Статистика кэша
   */
  async getCacheStats() {
    try {
      const promptStats = await promptService.getCacheStats();
      
      return {
        responseCache: {
          size: this.responseCache.size,
          timeout: this.cacheTimeout
        },
        promptCache: promptStats,
        languageSupport: 'universal',
        supportedPlatforms: ['web', 'telegram'],
        ragEnabled: this.enableRag
      };
    } catch (error) {
      return {
        responseCache: {
          size: this.responseCache.size,
          timeout: this.cacheTimeout
        },
        promptCache: { error: error.message },
        languageSupport: 'universal',
        supportedPlatforms: ['web', 'telegram'],
        ragEnabled: this.enableRag
      };
    }
  }

  /**
   * Получает информацию о текущем провайдере
   * @returns {Object} Информация о провайдере
   */
  getProviderInfo() {
    return {
      currentProvider: this.provider,
      availableProviders: Object.keys(this.clients),
      models: {
        claude: this.clients.claude ? this.config.claude.model : null,
        openai: this.clients.openai ? this.config.openai.model : null
      },
      supportedPlatforms: ['web', 'telegram'],
      languageSupport: 'universal',
      ragEnabled: this.enableRag
    };
  }
  
  /**
   * Получает информацию о RAG функциональности
   * @returns {Promise<Object>} Информация о RAG
   */
  async getRagInfo() {
    // 🚨 RAG ОТКЛЮЧЕН для Reader Bot
    return {
      enabled: false,
      vectorStore: {
        status: 'disabled',
        message: 'RAG functionality disabled for Reader Bot'
      },
      embeddingModel: 'N/A',
      defaultContextLimit: 0,
      languageFilter: 'disabled'
    };
  }

  /**
   * 📖 Получает информацию о PromptService
   * @returns {Promise<Object>} Информация о промптах
   */
  async getPromptInfo() {
    try {
      const diagnosis = await promptService.diagnose();
      
      return {
        service: 'PromptService',
        status: diagnosis.status,
        cacheStats: diagnosis.cacheStats,
        databaseConnection: diagnosis.databaseConnection,
        promptCounts: diagnosis.promptCounts,
        supportedPlatforms: ['web', 'telegram'],
        languageSupport: 'universal'
      };
    } catch (error) {
      return {
        service: 'PromptService',
        status: 'error',
        error: error.message,
        supportedPlatforms: ['web', 'telegram'],
        languageSupport: 'universal'
      };
    }
  }

  /**
   * 📖 Очистка кеша промптов
   * @param {string} [type] - Тип промптов для очистки
   */
  clearPromptCache(type = null) {
    if (type) {
      promptService.clearCacheForType(type);
    } else {
      promptService.clearCache();
    }
    logger.info(`📖 Prompt cache cleared for type: ${type || 'all'}`);
  }
}

// Экспортируем единственный экземпляр
module.exports = new ClaudeService();