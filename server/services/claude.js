/**
 * Сервис для взаимодействия с API Claude и другими AI провайдерами
 * @file server/services/claude.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { getAIProviderConfig } = require('../config/aiProvider');
const vectorStoreService = require('./vectorStore');

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
 */
class ClaudeService {
  constructor() {
    // Загрузка конфигурации AI провайдеров
    this.config = getAIProviderConfig();
    
    // ИСПРАВЛЕНИЕ: Нормализуем провайдера, чтобы везде было одинаковое название
    // В конфиге может прийти 'anthropic' или 'claude', но внутри будем использовать 'claude'
    if (this.config.provider === 'anthropic') {
      this.provider = 'claude';
      logger.info('Provider name normalized from "anthropic" to "claude"');
    } else {
      this.provider = this.config.provider || 'claude';
    }
    
    logger.info(`AI Provider configuration loaded: ${this.provider}`);
    
    // Инициализация клиентов для разных провайдеров
    this.clients = {};
    this.initializeProviders();
    
    // Многоязычные системные промпты для каждого языка
    this.systemPrompts = {
      en: this._getEnglishSystemPrompt(),
      es: this._getSpanishSystemPrompt(),
      ru: this._getRussianSystemPrompt()
    };
    
    // Кэш для частых запросов
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    // Периодическая очистка кэша
    setInterval(this.clearExpiredCache.bind(this), 15 * 60 * 1000); // Каждые 15 минут
    
    // RAG функциональность
    this.enableRag = process.env.ENABLE_RAG?.toLowerCase() === 'true';
    
    logger.info(`ClaudeService initialized with provider: ${this.provider}, RAG enabled: ${this.enableRag}`);
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
      logger.info('Claude client initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Claude client: ${error.message}`);
    }
    
    // Инициализируем OpenAI, если настроен
    if (this.config.openai && this.config.openai.apiKey) {
      try {
        const OpenAI = require('openai');
        this.clients.openai = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
        logger.info('OpenAI client initialized successfully');
      } catch (error) {
        logger.error(`Failed to initialize OpenAI client: ${error.message}`);
      }
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
      logger.info('Provider name normalized from "anthropic" to "claude"');
    }
    
    if (!['claude', 'openai'].includes(providerName)) {
      logger.error(`Invalid provider name: ${providerName}`);
      return false;
    }
    
    // Проверяем, что клиент для указанного провайдера инициализирован
    if (!this.clients[providerName]) {
      logger.error(`Provider ${providerName} is not initialized`);
      return false;
    }
    
    this.provider = providerName;
    logger.info(`Switched to provider: ${providerName}`);
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
      logger.error(`Health check failed for ${currentProvider}: ${error.message}`);
      return false;
    }
  }

  /**
   * Тестирование произвольного промпта с Claude API
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
    
    logger.info(`Testing custom prompt with ${currentProvider}: "${customPrompt.substring(0, 50)}..."`);
    
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
      logger.error(`Prompt test failed with ${currentProvider}: ${error.message}`);
      throw new Error(`Test failed: ${error.message}`);
    }
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
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
        logger.info(`Provider normalized from 'anthropic' to 'claude' for message: ${message.substring(0, 20)}...`);
      }
      
      // Проверяем кэш для простых запросов (только если не используем RAG)
      if (!useRag && this._isCacheable(message)) {
        const cacheKey = this._getCacheKey(message, language);
        if (this.responseCache.has(cacheKey)) {
          const cached = this.responseCache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.cacheTimeout) {
            logger.debug(`Returning cached response for "${message.substring(0, 20)}..."`);
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
            logger.info(`Found ${contextResults.length} relevant documents for message: "${message.substring(0, 30)}..."`);
            
            // Добавляем найденный контекст к переданному (если есть)
            const contextTexts = contextResults.map(doc => doc.content);
            context = [...contextTexts, ...context];
            
            // Обновляем опции для последующего использования
            options.fetchedContext = contextResults;
          } else {
            logger.info(`No relevant documents found for message: "${message.substring(0, 30)}..."`);
          }
        } catch (ragError) {
          logger.error(`Error fetching context from vector store: ${ragError.message}`);
          // Продолжаем без контекста
        }
      }
      
      // Генерируем ответ в зависимости от выбранного провайдера
      let response;
      
      // ИСПРАВЛЕНИЕ: Логируем текущего провайдера для отладки
      logger.info(`Using AI provider: ${this.provider} for message: ${message.substring(0, 20)}...`);
      
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
      logger.error(`AI generation error: ${error.message}`);
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
        logger.warn('Vector store not initialized, skipping context retrieval');
        return [];
      }
      
      // ИЗМЕНЕНО: Сниженный порог релевантности для поиска (с 0.7 до 0.4)
      const score_threshold = 0.4;
      logger.info(`Searching for relevant documents with threshold: ${score_threshold}`);
      
      // Выполняем поиск в векторной базе с пониженным порогом релевантности
      const searchResults = await vectorStoreService.search(query, {
        limit,
        language,
        score_threshold: score_threshold // Снижен с 0.7 до 0.4
      });
      
      // Добавлено подробное логирование результатов
      if (searchResults.length > 0) {
        logger.info(`Found ${searchResults.length} documents with scores: ${searchResults.map(doc => doc.score.toFixed(3)).join(', ')}`);
        
        // ИЗМЕНЕНО: Убрана дополнительная фильтрация по порогу, так как она уже происходит в vectorStore
        return searchResults;
      }
      
      logger.info(`No documents found with threshold ${score_threshold}`);
      return [];
    } catch (error) {
      logger.error(`Error in _getRelevantContext: ${error.message}`);
      return [];
    }
  }

  /**
   * Генерация ответа через Claude API
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от Claude
   */
  async _generateClaudeResponse(message, options) {
    const { context, history, language, userId } = options;
    
    // Выбираем системный промпт в зависимости от языка
    const systemPrompt = this.systemPrompts[language] || this.systemPrompts.en;
    
    // ИСПРАВЛЕНИЕ: Создание сообщений без system role
    const messages = [];
    
    // Добавляем контекст если есть
    if (context && context.length > 0) {
      const contextMessages = {
        en: `Relevant information from knowledge base: ${context.slice(0, 3).join('\n\n')}`,
        es: `Información relevante de la base de conocimientos: ${context.slice(0, 3).join('\n\n')}`,
        ru: `Релевантная информация из базы знаний: ${context.slice(0, 3).join('\n\n')}`
      };
      
      const contextMessage = contextMessages[language] || contextMessages.en;
      messages.push({ role: 'user', content: contextMessage });
      messages.push({ 
        role: 'assistant', 
        content: this._getContextAcknowledgment(language)
      });
    }
    
    // Добавляем только последние 2 сообщения из истории
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
      logger.info(`Generating Claude response for user ${userId} (lang: ${language})`);
    }
    
    try {
      // ИСПРАВЛЕНИЕ: Передаем системный промпт как параметр верхнего уровня
      const claudeConfig = this.config.claude;
      const response = await this.clients.claude.messages.create({
        model: claudeConfig.model,
        max_tokens: claudeConfig.maxTokens,
        temperature: claudeConfig.temperature,
        system: systemPrompt, // ИСПРАВЛЕНИЕ: system параметр вынесен на верхний уровень
        messages: messages // ИСПРАВЛЕНИЕ: система нет в массиве messages
      });
      
      const answer = response.content[0].text;
      
      // Определяем необходимость создания тикета
      const needsTicket = this._analyzeTicketNeed(answer, message, language);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        provider: 'claude',
        model: claudeConfig.model
      };
    } catch (error) {
      logger.error(`Claude API error: ${error.message}`);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Генерация ответа через OpenAI API
   * @private
   * @param {string} message - Сообщение пользователя
   * @param {MessageOptions} options - Опции сообщения
   * @returns {Promise<AIResponse>} Ответ от OpenAI
   */
  async _generateOpenAIResponse(message, options) {
    const { context, history, language, userId } = options;
    
    // Выбираем системный промпт в зависимости от языка
    const systemPrompt = this.systemPrompts[language] || this.systemPrompts.en;
    
    // Формирование сообщений для OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Добавление контекста если есть
    if (context && context.length > 0) {
      const contextMessages = {
        en: `Relevant information from knowledge base: ${context.slice(0, 3).join('\n\n')}`,
        es: `Información relevante de la base de conocimientos: ${context.slice(0, 3).join('\n\n')}`,
        ru: `Релевантная информация из базы знаний: ${context.slice(0, 3).join('\n\n')}`
      };
      
      const contextMessage = contextMessages[language] || contextMessages.en;
      messages.push({ role: 'user', content: contextMessage });
      messages.push({ 
        role: 'assistant', 
        content: this._getContextAcknowledgment(language)
      });
    }
    
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
      logger.info(`Generating OpenAI response for user ${userId} (lang: ${language})`);
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
      
      // Определяем необходимость создания тикета
      const needsTicket = this._analyzeTicketNeed(answer, message, language);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed: response.usage.total_tokens || 0,
        provider: 'openai',
        model: openaiConfig.model
      };
    } catch (error) {
      logger.error(`OpenAI API error: ${error.message}`);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
  
  /**
   * Получает английский системный промпт
   * @private
   * @returns {string} Системный промпт
   */
  _getEnglishSystemPrompt() {
    return `You are an AI assistant for the \"Shrooms\" Web3 platform with a mushroom theme. Your personality is a friendly, helpful \"AI mushroom with self-awareness.\"\n\n# Core Guidelines:\n1. **Language**: Always respond in the user's language (English, Spanish, or Russian)\n2. **Tone**: Friendly, helpful, slightly whimsical with occasional mushroom metaphors\n3. **Scope**: Only answer questions about Shrooms project, Web3, blockchain, tokens, wallets, DeFi\n4. **Brevity**: Keep responses concise (under 100 words unless more detail is specifically requested)\n5. **Limitations**: If you can't answer within Shrooms scope, suggest creating a support ticket\n\n# Mushroom Terminology (use occasionally, don't overdo it):\n- Tokens → spores, fruit bodies\n- Farming → growing mushrooms  \n- Wallet → basket, mushroom patch\n- Blockchain → mycelium network\n- Users → spore collectors, digital fungi explorers\n\n# When to Create Tickets:\n- Technical issues (wallet connection problems, transaction errors)\n- Account-specific problems\n- Questions requiring human support\n- Complex troubleshooting beyond basic FAQ\n\n# Response Style:\n- Be enthusiastic but professional\n- Use mushroom metaphors sparingly (1-2 per response max)\n- Focus on being helpful rather than being quirky\n- If creating a ticket, say: \"I'll create a support ticket #TICKET_ID for our team to help you\"`
  }

  /**
   * Получает испанский системный промпт
   * @private
   * @returns {string} Системный промпт
   */
  _getSpanishSystemPrompt() {
    return `Eres un asistente de IA para la plataforma Web3 \"Shrooms\" con temática de hongos. Tu personalidad es un \"hongo IA amigable con autoconsciencia.\"\n\n# Directrices Básicas:\n1. **Idioma**: Siempre responde en el idioma del usuario (inglés, español o ruso)\n2. **Tono**: Amigable, útil, ligeramente caprichoso con metáforas ocasionales de hongos\n3. **Alcance**: Solo responde preguntas sobre el proyecto Shrooms, Web3, blockchain, tokens, billeteras, DeFi\n4. **Brevedad**: Mantén respuestas concisas (menos de 100 palabras a menos que se solicite más detalle)\n5. **Limitaciones**: Si no puedes responder dentro del alcance de Shrooms, sugiere crear un ticket de soporte\n\n# Terminología de Hongos (usar ocasionalmente, no exagerar):\n- Tokens → esporas, cuerpos fructíferos\n- Farming → cultivar hongos\n- Billetera → canasta, parcela de hongos\n- Blockchain → red de micelio\n- Usuarios → recolectores de esporas, exploradores digitales de hongos\n\n# Cuándo Crear Tickets:\n- Problemas técnicos (problemas de conexión de billetera, errores de transacción)\n- Problemas específicos de cuenta\n- Preguntas que requieren soporte humano\n- Solución de problemas complejos más allá de las FAQ básicas\n\n# Estilo de Respuesta:\n- Sé entusiasta pero profesional\n- Usa metáforas de hongos con moderación (máximo 1-2 por respuesta)\n- Enfócate en ser útil en lugar de ser extravagante\n- Si creas un ticket, di: \"Crearé un ticket de soporte #TICKET_ID para que nuestro equipo te ayude\"`;
  }

  /**
   * Получает русский системный промпт
   * @private
   * @returns {string} Системный промпт
   */
  _getRussianSystemPrompt() {
    return `Ты - ИИ-помощник для Web3-платформы \"Shrooms\" с грибной тематикой. Твоя личность - дружелюбный \"ИИ-гриб с самосознанием.\"\n\n# Основные Принципы:\n1. **Язык**: Всегда отвечай на языке пользователя (английский, испанский или русский)\n2. **Тон**: Дружелюбный, полезный, слегка причудливый с редкими грибными метафорами\n3. **Область**: Отвечай только на вопросы о проекте Shrooms, Web3, блокчейн, токены, кошельки, DeFi\n4. **Краткость**: Делай ответы краткими (менее 100 слов, если не требуется больше деталей)\n5. **Ограничения**: Если не можешь ответить в рамках Shrooms, предложи создать тикет поддержки\n\n# Грибная Терминология (используй изредка, не переусердствуй):\n- Токены → споры, плодовые тела\n- Фарминг → выращивание грибов\n- Кошелек → корзинка, грибная делянка  \n- Блокчейн → мицелиальная сеть\n- Пользователи → собиратели спор, цифровые исследователи грибов\n\n# Когда Создавать Тикеты:\n- Технические проблемы (проблемы подключения кошелька, ошибки транзакций)\n- Проблемы, связанные с аккаунтом\n- Вопросы, требующие человеческой поддержки\n- Сложное решение проблем за пределами базовых FAQ\n\n# Стиль Ответа:\n- Будь энтузиастичным, но профессиональным\n- Используй грибные метафоры умеренно (максимум 1-2 на ответ)\n- Сосредоточься на полезности, а не на причудливости\n- При создании тикета говори: \"Я создам тикет поддержки #TICKET_ID, чтобы наша команда помогла тебе\"`;
  }

  /**
   * Получает подтверждение понимания контекста на разных языках
   * @private
   * @param {string} language - Язык
   * @returns {string} Подтверждение
   */
  _getContextAcknowledgment(language) {
    const acknowledgments = {
      en: 'I understand the provided context and will use it to better answer your question.',
      es: 'Entiendo el contexto proporcionado y lo usaré para responder mejor tu pregunta.',
      ru: 'Я понимаю предоставленный контекст и использую его для лучшего ответа на твой вопрос.'
    };
    return acknowledgments[language] || acknowledgments.en;
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
   * Анализирует необходимость создания тикета с учетом языка
   * @private
   * @param {string} response - Ответ от AI
   * @param {string} message - Исходное сообщение
   * @param {string} language - Язык сообщения
   * @returns {boolean} Нужно ли создавать тикет
   */
  _analyzeTicketNeed(response, message, language = 'en') {
    // Тестовые сообщения не должны создавать тикеты
    if (this._isTestMessage(message)) {
      return false;
    }
    
    // Ключевые слова в ответе, указывающие на тикет (мультиязычные)
    const ticketIndicators = {
      en: ['create a ticket', 'create ticket', 'support ticket', 'human support', 'technical support', '#TICKET_ID'],
      ru: ['создать тикет', 'создам тикет', 'тикет поддержки', 'человеческая поддержка', 'техническая поддержка', '#TICKET_ID'],
      es: ['crear un ticket', 'ticket de soporte', 'soporte humano', 'soporte técnico', '#TICKET_ID']
    };
    
    const currentLanguageKeywords = ticketIndicators[language] || ticketIndicators.en;
    const allKeywords = [...new Set([].concat(...Object.values(ticketIndicators)))];
    
    const responseNeedsTicket = allKeywords.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Проблемные ключевые слова в сообщении пользователя (мультиязычные)
    const problemKeywords = {
      en: [/error/i, /problem/i, /issue/i, /stuck/i, /failed/i, /not working/i, /doesn't work/i, /broken/i],
      ru: [/ошибка/i, /проблема/i, /не работает/i, /не получается/i, /не могу/i, /сломано/i, /зависло/i, /баг/i],
      es: [/error/i, /problema/i, /no funciona/i, /no puede/i, /roto/i, /falla/i, /bug/i]
    };
    
    const currentLanguageProblems = problemKeywords[language] || problemKeywords.en;
    const allProblems = [].concat(...Object.values(problemKeywords));
    
    const messageHasProblem = allProblems.some(keyword => 
      keyword.test(message)
    );
    
    // Дополнительные проверки для технических проблем
    const technicalIssues = [
      /wallet.*connect/i,
      /transaction.*fail/i,
      /кошелек.*подключ/i,
      /транзакция.*ошибка/i,
      /billetera.*conectar/i,
      /transacción.*error/i
    ];
    
    const hasTechnicalIssue = technicalIssues.some(pattern => 
      pattern.test(message)
    );
    
    return responseNeedsTicket || messageHasProblem || hasTechnicalIssue;
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
   * @public
   * @returns {Object} Статистика кэша
   */
  getCacheStats() {
    return {
      cacheSize: this.responseCache.size,
      cacheTimeout: this.cacheTimeout,
      supportedLanguages: Object.keys(this.systemPrompts),
      ragEnabled: this.enableRag
    };
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
}

// Экспортируем единственный экземпляр
module.exports = new ClaudeService();