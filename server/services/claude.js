/**
 * Сервис для взаимодействия с API Claude и другими AI провайдерами
 * @file server/services/claude.js
 * 🍄 ОБНОВЛЕНО: Интеграция с PromptService для динамического управления промптами
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { getAIProviderConfig } = require('../config/aiProvider');
const vectorStoreService = require('./vectorStore');
const promptService = require('./promptService'); // 🍄 НОВОЕ: Интеграция с PromptService

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
 * @property {string} [language] - Язык общения
 * @property {string} [userId] - ID пользователя для логирования
 * @property {boolean} [useRag=true] - Использовать ли RAG функциональность
 * @property {number} [ragLimit=3] - Количество документов для RAG
 */

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API и другими провайдерами AI
 * 🍄 УЛУЧШЕНО: Динамические промпты через PromptService
 */
class ClaudeService {
  constructor() {
    // Загрузка конфигурации AI провайдеров
    this.config = getAIProviderConfig();
    
    // ИСПРАВЛЕНИЕ: Нормализуем провайдера, чтобы везде было одинаковое название
    // В конфиге может прийти 'anthropic' или 'claude', но внутри будем использовать 'claude'
    if (this.config.provider === 'anthropic') {
      this.provider = 'claude';
      logger.info('🍄 Provider name normalized from "anthropic" to "claude"');
    } else {
      this.provider = this.config.provider || 'claude';
    }
    
    logger.info(`🍄 AI Provider configuration loaded: ${this.provider}`);
    
    // Инициализация клиентов для разных провайдеров
    this.clients = {};
    this.initializeProviders();
    
    // 🍄 УБРАНО: Захардкоженные системные промпты
    // Теперь промпты получаются динамически через PromptService
    
    // Кэш для частых запросов
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    // Периодическая очистка кэша
    setInterval(this.clearExpiredCache.bind(this), 15 * 60 * 1000); // Каждые 15 минут
    
    // RAG функциональность
    this.enableRag = process.env.ENABLE_RAG?.toLowerCase() === 'true';
    
    logger.info(`🍄 ClaudeService initialized with provider: ${this.provider}, RAG enabled: ${this.enableRag}`);
  }

  /**
   * Инициализация доступных AI провайдеров
   * @private
   */
  initializeProviders() {
    // Инициализируем Claude
    try {
      this.clients.claude = new Anthropic({
        apiKey: this.config.claude.apiKey,
      });
      logger.info('🍄 Claude client initialized successfully');
    } catch (error) {
      logger.error(`🍄 Failed to initialize Claude client: ${error.message}`);
    }
    
    // Инициализируем OpenAI, если настроен
    if (this.config.openai && this.config.openai.apiKey) {
      try {
        const OpenAI = require('openai');
        this.clients.openai = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
        logger.info('🍄 OpenAI client initialized successfully');
      } catch (error) {
        logger.error(`🍄 Failed to initialize OpenAI client: ${error.message}`);
      }
    }
  }

  /**
   * 🍄 НОВОЕ: Получить системный промпт через PromptService
   * @private
   * @param {string} [language='en'] - Язык промпта
   * @returns {Promise<string>} Системный промпт
   */
  async _getSystemPrompt(language = 'en') {
    try {
      return await promptService.getActivePrompt('basic', language);
    } catch (error) {
      logger.error(`🍄 Error getting system prompt from PromptService: ${error.message}`);
      // Fallback на дефолтный промпт через PromptService
      return promptService.getDefaultPrompt('basic', language);
    }
  }

  /**
   * 🍄 НОВОЕ: Получить RAG промпт через PromptService
   * @private
   * @param {string} [language='en'] - Язык промпта
   * @returns {Promise<string>} RAG промпт
   */
  async _getRagPrompt(language = 'en') {
    try {
      return await promptService.getActivePrompt('rag', language);
    } catch (error) {
      logger.error(`🍄 Error getting RAG prompt from PromptService: ${error.message}`);
      return promptService.getDefaultPrompt('rag', language);
    }
  }
  
  /**
   * Переключение провайдера AI
   * @param {string} providerName - Имя провайдера ('claude', 'openai')
   * @returns {boolean} Успешность переключения
   */
  switchProvider(providerName) {
    // ИСПРАВЛЕНИЕ: Добавляем поддержку 'anthropic' как альтернативного имени для 'claude'
    if (providerName === 'anthropic') {
      providerName = 'claude';
      logger.info('🍄 Provider name normalized from "anthropic" to "claude"');
    }
    
    if (!['claude', 'openai'].includes(providerName)) {
      logger.error(`🍄 Invalid provider name: ${providerName}`);
      return false;
    }
    
    // Проверяем, что клиент для указанного провайдера инициализирован
    if (!this.clients[providerName]) {
      logger.error(`🍄 Provider ${providerName} is not initialized`);
      return false;
    }
    
    this.provider = providerName;
    logger.info(`🍄 Switched to provider: ${providerName}`);
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
      // 🍄 ОБНОВЛЕНО: Проверяем также работоспособность PromptService
      await promptService.getActivePrompt('basic', 'en');
      
      // Простая проверка для текущего провайдера
      if (currentProvider === 'claude') {
        // Простая генерация с Claude, минимизируем запрос
        await this.clients.claude.messages.create({
          model: this.config.claude.model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
        });
      } else if (currentProvider === 'openai') {
        // Простая генерация с OpenAI
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
      logger.error(`🍄 Health check failed for ${currentProvider}: ${error.message}`);
      return false;
    }
  }

  /**
   * Тестирование произвольного промпта с Claude API
   * 🍄 ОБНОВЛЕНО: Поддержка тестирования промптов из PromptService
   * @param {string} customPrompt - Промпт для тестирования
   * @param {string} testMessage - Тестовое сообщение пользователя
   * @param {Object} options - Опции тестирования
   * @param {string} [options.language=en] - Язык для ответа
   * @param {string} [options.provider] - Конкретный провайдер для использования
   * @returns {Promise<AIResponse>} Результат тестирования
   */
  async testPrompt(customPrompt, testMessage, options = {}) {
    const { language = 'en', provider } = options;
    
    // Используем указанный провайдер или текущий
    const currentProvider = provider || this.provider;
    
    if (!this.clients[currentProvider]) {
      throw new Error(`Provider ${currentProvider} is not available`);
    }
    
    logger.info(`🍄 Testing custom prompt with ${currentProvider}: "${customPrompt.substring(0, 50)}..."`);
    
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
          needsTicket: false, // Тестовые промпты не создают тикеты
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
      logger.error(`🍄 Prompt test failed with ${currentProvider}: ${error.message}`);
      throw new Error(`Test failed: ${error.message}`);
    }
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * 🍄 ОБНОВЛЕНО: Использование PromptService для получения промптов
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от AI
   */
  async generateResponse(message, options = {}) {
    try {
      let { 
        context = [], 
        history = [], 
        language = 'en', 
        userId, 
        useRag = this.enableRag,
        ragLimit = 3 
      } = options;
      
      // ИСПРАВЛЕНИЕ: Нормализация провайдера перед использованием
      if (this.provider === 'anthropic') {
        this.provider = 'claude';
        logger.info(`🍄 Provider normalized from 'anthropic' to 'claude' for message: ${message.substring(0, 20)}...`);
      }
      
      // Проверяем кэш для простых запросов (только если не используем RAG)
      if (!useRag && this._isCacheable(message)) {
        const cacheKey = this._getCacheKey(message, language);
        if (this.responseCache.has(cacheKey)) {
          const cached = this.responseCache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.cacheTimeout) {
            logger.debug(`🍄 Returning cached response for "${message.substring(0, 20)}..."`);
            return cached.response;
          }
        }
      }
      
      // Детекция тестовых сообщений
      if (this._isTestMessage(message)) {
        return this._handleTestMessage(message, language);
      }
      
      // Поиск дополнительного контекста из векторной базы, если RAG включен
      if (useRag && this.enableRag) {
        try {
          const contextResults = await this._getRelevantContext(message, language, ragLimit);
          
          if (contextResults && contextResults.length > 0) {
            // Логируем количество найденных документов
            logger.info(`🍄 Found ${contextResults.length} relevant documents for message: "${message.substring(0, 30)}..."`);
            
            // Добавляем найденный контекст к переданному (если есть)
            const contextTexts = contextResults.map(doc => doc.content);
            context = [...contextTexts, ...context];
            
            // Обновляем опции для последующего использования
            options.fetchedContext = contextResults;
          } else {
            logger.info(`🍄 No relevant documents found for message: "${message.substring(0, 30)}..."`);
          }
        } catch (ragError) {
          logger.error(`🍄 Error fetching context from vector store: ${ragError.message}`);
          // Продолжаем без контекста
        }
      }
      
      // Генерируем ответ в зависимости от выбранного провайдера
      let response;
      
      // ИСПРАВЛЕНИЕ: Логируем текущего провайдера для отладки
      logger.info(`🍄 Using AI provider: ${this.provider} for message: ${message.substring(0, 20)}...`);
      
      if (this.provider === 'claude') {
        response = await this._generateClaudeResponse(message, { ...options, context });
      } else if (this.provider === 'openai') {
        response = await this._generateOpenAIResponse(message, { ...options, context });
      } else {
        throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
      
      // Добавляем информацию о использованном контексте, если это RAG запрос
      if (useRag && options.fetchedContext) {
        response.context = options.fetchedContext;
      }
      
      // Кэшируем простые ответы (только если не использовался RAG)
      if (!useRag && this._isCacheable(message)) {
        const cacheKey = this._getCacheKey(message, language);
        this.responseCache.set(cacheKey, {
          response,
          timestamp: Date.now()
        });
      }
      
      return response;
    } catch (error) {
      logger.error(`🍄 AI generation error: ${error.message}`);
      return this._getErrorResponse(error, options.language);
    }
  }

  /**
   * Получает релевантный контекст из векторной базы знаний
   * @private
   * @param {string} query - Запрос пользователя
   * @param {string} language - Язык запроса
   * @param {number} [limit=3] - Количество документов для поиска
   * @returns {Promise<Array<Object>>} Найденные документы
   */
  async _getRelevantContext(query, language, limit = 3) {
    try {
      // Проверяем инициализацию векторной базы
      const vectorStoreReady = await vectorStoreService.initialize();
      
      if (!vectorStoreReady) {
        logger.warn('🍄 Vector store not initialized, skipping context retrieval');
        return [];
      }
      
      // ИЗМЕНЕНО: Повышенный порог релевантности для поиска (с 0.4 до 0.7)
      const score_threshold = 0.7;
      logger.info(`🍄 Searching for relevant documents with threshold: ${score_threshold}`);
      
      // Выполняем поиск в векторной базе с повышенным порогом релевантности
      const searchResults = await vectorStoreService.search(query, {
        limit,
        language,
        score_threshold: score_threshold // Повышен с 0.4 до 0.7
      });
      
      // Добавлено подробное логирование результатов
      if (searchResults.length > 0) {
        logger.info(`🍄 Found ${searchResults.length} documents with scores: ${searchResults.map(doc => doc.score.toFixed(3)).join(', ')}`);
        
        // ИЗМЕНЕНО: Убрана дополнительная фильтрация по порогу, так как она уже происходит в vectorStore
        return searchResults;
      }
      
      logger.info(`🍄 No documents found with threshold ${score_threshold}`);
      return [];
    } catch (error) {
      logger.error(`🍄 Error in _getRelevantContext: ${error.message}`);
      return [];
    }
  }

  /**
   * Генерация ответа через Claude API
   * 🍄 ИСПРАВЛЕНО: Убираем контекстные сообщения, которые затирают роль AI-гриба
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от Claude
   */
  async _generateClaudeResponse(message, options) {
    const { context, history, language, userId } = options;
    
    // 🍄 НОВОЕ: Получаем системный промпт динамически через PromptService
    let systemPrompt;
    try {
      if (context && context.length > 0) {
        // Если есть контекст, используем RAG промпт
        systemPrompt = await this._getRagPrompt(language);
      } else {
        // Иначе используем базовый промпт
        systemPrompt = await this._getSystemPrompt(language);
      }
    } catch (error) {
      logger.error(`🍄 Error getting prompt from PromptService: ${error.message}`);
      // Используем fallback промпт
      systemPrompt = promptService.getDefaultPrompt(context && context.length > 0 ? 'rag' : 'basic', language);
    }

    // 🍄 ИСПРАВЛЕНИЕ: Интегрируем контекст прямо в системный промпт
    let enhancedSystemPrompt = systemPrompt;

    if (context && context.length > 0) {
      enhancedSystemPrompt += `\n\nДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ИЗ БАЗЫ ЗНАНИЙ:\n${context.slice(0, 3).join('\n\n')}`;
    }
    
    // 🍄 ИСПРАВЛЕНИЕ: Создание сообщений БЕЗ дополнительных контекстных сообщений
    const messages = [];
    
    // ❌ УБИРАЕМ: Контекстные сообщения, которые затирают роль AI-гриба
    // if (context && context.length > 0) {
    //   const contextMessage = contextMessages[language] || contextMessages.en;
    //   messages.push({ role: 'user', content: contextMessage });
    //   messages.push({ role: 'assistant', content: this._getContextAcknowledgment(language) });
    // }
    
    // ✅ ОСТАВЛЯЕМ: Только последние 2 сообщения из истории для сохранения контекста разговора
    if (history && history.length > 0) {
      const recentHistory = history.slice(-2);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || msg.text
        });
      });
    }
    
    // Добавляем текущее сообщение
    messages.push({ role: 'user', content: message });
    
    // Loggers
    if (userId) {
      logger.info(`🍄 Generating Claude response for user ${userId} (lang: ${language})`);
    }
    
    try {
      // 🍄 ИСПРАВЛЕНИЕ: Передаем расширенный системный промпт как параметр верхнего уровня
      const claudeConfig = this.config.claude;
      const response = await this.clients.claude.messages.create({
        model: claudeConfig.model,
        max_tokens: claudeConfig.maxTokens,
        temperature: claudeConfig.temperature,
        system: enhancedSystemPrompt, // 🍄 ИСПРАВЛЕНИЕ: Контекст интегрирован в системный промпт
        messages: messages // 🍄 ИСПРАВЛЕНИЕ: Чистые сообщения без контекстного спама
      });
      
      const answer = response.content[0].text;
      
      // 🍄 ИСПРАВЛЕНО: Упрощенная логика определения необходимости создания тикета
      const needsTicket = this._analyzeTicketNeed(answer, message, language);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        provider: 'claude',
        model: claudeConfig.model
      };
    } catch (error) {
      logger.error(`🍄 Claude API error: ${error.message}`);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Генерация ответа через OpenAI API
   * 🍄 ИСПРАВЛЕНО: Убираем контекстные сообщения, которые затирают роль AI-гриба
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от OpenAI
   */
  async _generateOpenAIResponse(message, options) {
    const { context, history, language, userId } = options;
    
    // 🍄 НОВОЕ: Получаем системный промпт динамически через PromptService
    let systemPrompt;
    try {
      if (context && context.length > 0) {
        // Если есть контекст, используем RAG промпт
        systemPrompt = await this._getRagPrompt(language);
      } else {
        // Иначе используем базовый промпт
        systemPrompt = await this._getSystemPrompt(language);
      }
    } catch (error) {
      logger.error(`🍄 Error getting prompt from PromptService: ${error.message}`);
      // Используем fallback промпт
      systemPrompt = promptService.getDefaultPrompt(context && context.length > 0 ? 'rag' : 'basic', language);
    }

    // 🍄 ИСПРАВЛЕНИЕ: Интегрируем контекст прямо в системный промпт
    let enhancedSystemPrompt = systemPrompt;

    if (context && context.length > 0) {
      enhancedSystemPrompt += `\n\nДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ИЗ БАЗЫ ЗНАНИЙ:\n${context.slice(0, 3).join('\n\n')}`;
    }
    
    // Формирование сообщений для OpenAI
    const messages = [
      { role: 'system', content: enhancedSystemPrompt } // 🍄 ИСПРАВЛЕНИЕ: Контекст интегрирован в системный промпт
    ];
    
    // ❌ УБИРАЕМ: Контекстные сообщения, которые затирают роль AI-гриба
    // if (context && context.length > 0) {
    //   const contextMessage = contextMessages[language] || contextMessages.en;
    //   messages.push({ role: 'user', content: contextMessage });
    //   messages.push({ role: 'assistant', content: this._getContextAcknowledgment(language) });
    // }
    
    // Добавление истории сообщений
    if (history && history.length > 0) {
      const recentHistory = history.slice(-5); // больше историй для OpenAI
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || msg.text
        });
      });
    }
    
    // Добавление текущего сообщения
    messages.push({ role: 'user', content: message });
    
    // Loggers
    if (userId) {
      logger.info(`🍄 Generating OpenAI response for user ${userId} (lang: ${language})`);
    }
    
    try {
      // Отправка запроса к OpenAI API
      const openaiConfig = this.config.openai;
      const response = await this.clients.openai.chat.completions.create({
        model: openaiConfig.model,
        messages,
        max_tokens: openaiConfig.maxTokens,
        temperature: openaiConfig.temperature
      });
      
      const answer = response.choices[0].message.content;
      
      // 🍄 ИСПРАВЛЕНО: Упрощенная логика определения необходимости создания тикета
      const needsTicket = this._analyzeTicketNeed(answer, message, language);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.total_tokens || 0,
        provider: 'openai',
        model: openaiConfig.model
      };
    } catch (error) {
      logger.error(`🍄 OpenAI API error: ${error.message}`);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * 🍄 УБРАНО: Функция получения подтверждения контекста больше не используется
   * Контекст теперь интегрируется непосредственно в системный промпт
   */
  
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
      /^hi$/i,
      /^привет$/i,
      /^hola$/i
    ];
    
    return testPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Обрабатывает тестовые сообщения быстро на соответствующем языке
   * @private
   * @param {string} message - Сообщение
   * @param {string} language - Язык
   * @returns {AIResponse} Быстрый ответ
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
      tokensUsed: 50,
      provider: this.provider,
      model: this.provider === 'claude' ? this.config.claude.model : this.config.openai.model
    };
  }
  
  /**
   * 🍄 ИСПРАВЛЕНО: Упрощенная логика анализа необходимости создания тикета
   * Тикеты создаются только для СЕРЬЕЗНЫХ проблем, указанных в ответе Claude
   * @private
   * @param {string} response - Ответ от AI
   * @param {string} message - Исходное сообщение
   * @param {string} language - Язык сообщения
   * @returns {boolean} Нужно ли создавать тикет
   */
  _analyzeTicketNeed(response, message, language = 'en') {
    // Тестовые сообщения не создают тикеты
    if (this._isTestMessage(message)) {
      logger.debug('🍄 Test message detected, no ticket needed');
      return false;
    }
    
    // 🍄 НОВАЯ ЛОГИКА: Ищем ТОЛЬКО прямые указания на создание тикета в ответе Claude
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
      'садовники мицелия',
      'грибники-эксперты',
      'наша команда свяжется',
      'наши эксперты свяжутся'
    ];
    
    // Проверяем только ответ Claude на наличие прямых указаний на тикет
    const claudeWantsTicket = directTicketIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (claudeWantsTicket) {
      logger.info(`🍄 Ticket creation requested by Claude for message: "${message.substring(0, 30)}..."`);
    } else {
      logger.debug(`🍄 No ticket indicators in Claude response for message: "${message.substring(0, 30)}..."`);
    }
    
    // 🍄 УБРАНО: Анализ сообщения пользователя на "проблемные" слова
    // Теперь доверяем решению Claude, а не ключевым словам в вопросе
    
    return claudeWantsTicket;
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
   * Возвращает ответ об ошибке на соответствующем языке
   * @private
   * @param {Error} error - Ошибка
   * @param {string} language - Язык
   * @returns {AIResponse} Ответ об ошибке
   */
  _getErrorResponse(error, language = 'en') {
    const errorMessages = {
      en: "I'm experiencing technical difficulties right now. Let me create a support ticket for you so our team can help.",
      ru: "У меня сейчас технические проблемы. Позвольте мне создать тикет поддержки, чтобы наша команда могла помочь.",
      es: "Estoy experimentando dificultades técnicas ahora. Permíteme crear un ticket de soporte para que nuestro equipo pueda ayudarte."
    };
    
    return {
      message: errorMessages[language] || errorMessages.en,
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
   * 🍄 ОБНОВЛЕНО: Включает информацию о PromptService
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
        supportedLanguages: ['en', 'es', 'ru'],
        ragEnabled: this.enableRag
      };
    } catch (error) {
      return {
        responseCache: {
          size: this.responseCache.size,
          timeout: this.cacheTimeout
        },
        promptCache: { error: error.message },
        supportedLanguages: ['en', 'es', 'ru'],
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
      ragEnabled: this.enableRag
    };
  }
  
  /**
   * Получает информацию о RAG функциональности
   * @returns {Promise<Object>} Информация о RAG
   */
  async getRagInfo() {
    try {
      // Проверяем статус Vector Store
      const vectorStoreHealth = await vectorStoreService.healthCheck();
      
      return {
        enabled: this.enableRag,
        vectorStore: vectorStoreHealth,
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        defaultContextLimit: 3
      };
    } catch (error) {
      return {
        enabled: this.enableRag,
        vectorStore: {
          status: 'error',
          message: error.message
        },
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        defaultContextLimit: 3
      };
    }
  }

  /**
   * 🍄 НОВОЕ: Получает информацию о PromptService
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
        promptCounts: diagnosis.promptCounts
      };
    } catch (error) {
      return {
        service: 'PromptService',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 🍄 НОВОЕ: Очистка кеша промптов
   * @param {string} [type] - Тип промптов для очистки
   * @param {string} [language] - Язык промптов для очистки
   */
  clearPromptCache(type = null, language = null) {
    if (type) {
      promptService.clearCacheForType(type, language);
    } else {
      promptService.clearCache();
    }
    logger.info(`🍄 Prompt cache cleared for type: ${type || 'all'}, language: ${language || 'all'}`);
  }
}

// Экспортируем единственный экземпляр
module.exports = new ClaudeService();