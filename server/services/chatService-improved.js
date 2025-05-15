/**
 * Улучшенный сервис обработки чата с диагностикой
 * Интегрирует автоматическую диагностику проблем перед созданием тикетов
 * @file server/services/chatService-improved.js
 */

const claudeService = require('./claude');
const vectorStoreService = require('./vectorStore');
const ticketService = require('./ticketing');
const diagnosticsService = require('./diagnostics');
const languageDetect = require('../utils/languageDetect');
const logger = require('../utils/logger');
const { GREETING_TEMPLATES, BOT_NAME } = require('../config/prompts-fixed');

/**
 * @typedef {Object} ChatMessage
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль (user, assistant, system)
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Object} metadata - Дополнительные метаданные
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - Ответное сообщение
 * @property {boolean} ticketCreated - Был ли создан тикет
 * @property {string|null} ticketId - ID созданного тикета
 * @property {string} language - Определенный язык
 * @property {Object} metadata - Метаданные ответа
 */

/**
 * Улучшенный сервис для обработки сообщений чата
 */
class ChatService {
  constructor() {
    this.conversationContexts = new Map(); // Хранение контекстов разговоров
    this.userSessions = new Map(); // Сессии пользователей
  }

  /**
   * Обрабатывает сообщение пользователя
   * @param {string} message - Сообщение пользователя
   * @param {string} userId - ID пользователя
   * @param {string} [conversationId] - ID разговора
   * @param {Object} [options] - Дополнительные опции
   * @returns {Promise<ChatResponse>} Ответ чата
   */
  async processMessage(message, userId, conversationId = null, options = {}) {
    try {
      // Определяем язык сообщения
      const language = languageDetect.detect(message);
      
      // Получаем или создаем контекст разговора
      const context = this.getOrCreateConversationContext(userId, conversationId, language);
      
      // Проверяем, является ли это первое сообщение
      if (context.messages.length === 0) {
        return this.handleFirstMessage(message, userId, context, language);
      }
      
      // Добавляем сообщение пользователя в контекст
      context.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
      
      // Выполняем диагностику проблемы
      const diagnosis = await diagnosticsService.diagnose(message, language);
      
      // Если диагностика предоставила решения, используем их
      if (diagnosis.problemType && diagnosis.solutions.length > 0 && !diagnosis.needsTicket) {
        return this.handleDiagnosticResponse(diagnosis, userId, context, language);
      }
      
      // Поиск релевантной информации в базе знаний
      const searchResults = await this.searchKnowledgeBase(message, language);
      
      // Генерируем ответ с помощью Claude
      const claudeResponse = await claudeService.generateResponse(message, {
        context: searchResults,
        history: context.messages.slice(-5), // Последние 5 сообщений
        language: language
      });
      
      // Обработка создания тикета
      let ticketCreated = false;
      let ticketId = null;
      
      if (claudeResponse.needsTicket || diagnosis.needsTicket) {
        const ticket = await this.createSupportTicket(
          message,
          userId,
          context,
          language,
          diagnosis.problemType
        );
        ticketCreated = true;
        ticketId = ticket.ticketId;
        
        // Обновляем ответ с информацией о тикете
        claudeResponse.message = this.injectTicketInfo(
          claudeResponse.message,
          ticketId,
          language
        );
      }
      
      // Добавляем ответ ассистента в контекст
      context.messages.push({
        role: 'assistant',
        content: claudeResponse.message,
        timestamp: new Date(),
        ticketCreated,
        ticketId
      });
      
      // Обновляем статистику
      this.updateConversationStats(context, claudeResponse.tokensUsed || 0);
      
      return {
        message: claudeResponse.message,
        ticketCreated,
        ticketId,
        language,
        metadata: {
          tokensUsed: claudeResponse.tokensUsed || 0,
          problemType: diagnosis.problemType,
          searchResultsFound: searchResults.length,
          responseGenerated: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`ChatService error: ${error.message}`);
      return this.handleError(error, language);
    }
  }

  /**
   * Обрабатывает первое сообщение пользователя
   * @param {string} message - Сообщение
   * @param {string} userId - ID пользователя
   * @param {Object} context - Контекст разговора
   * @param {string} language - Язык
   * @returns {Promise<ChatResponse>} Ответ
   */
  async handleFirstMessage(message, userId, context, language) {
    // Для очень коротких сообщений показываем приветствие
    if (message.trim().length <= 3) {
      const greeting = GREETING_TEMPLATES[language] || GREETING_TEMPLATES.en;
      
      context.messages.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: greeting, timestamp: new Date() }
      );
      
      return {
        message: greeting,
        ticketCreated: false,
        ticketId: null,
        language,
        metadata: {
          isGreeting: true,
          firstMessage: true
        }
      };
    }
    
    // Для содержательных первых сообщений обрабатываем как обычно
    return this.processMessage(message, userId, context.conversationId, { isFirstMessage: true });
  }

  /**
   * Обрабатывает ответ с диагностикой
   * @param {Object} diagnosis - Результат диагностики
   * @param {string} userId - ID пользователя
   * @param {Object} context - Контекст разговора
   * @param {string} language - Язык
   * @returns {Promise<ChatResponse>} Ответ
   */
  async handleDiagnosticResponse(diagnosis, userId, context, language) {
    context.messages.push({
      role: 'assistant',
      content: diagnosis.response,
      timestamp: new Date(),
      diagnostic: true,
      problemType: diagnosis.problemType
    });
    
    return {
      message: diagnosis.response,
      ticketCreated: false,
      ticketId: null,
      language,
      metadata: {
        diagnostic: true,
        problemType: diagnosis.problemType,
        solutionsProvided: diagnosis.solutions.length,
        questionsAsked: diagnosis.questions.length
      }
    };
  }

  /**
   * Поиск в базе знаний
   * @param {string} query - Поисковый запрос
   * @param {string} language - Язык
   * @returns {Promise<string[]>} Результаты поиска
   */
  async searchKnowledgeBase(query, language) {
    try {
      const searchResults = await vectorStoreService.search(query, {
        limit: 3,
        language: language
      });
      
      return searchResults.map(result => result.content || result.pageContent || '');
    } catch (error) {
      logger.warn(`Knowledge base search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Создает тикет поддержки
   * @param {string} message - Исходное сообщение
   * @param {string} userId - ID пользователя
   * @param {Object} context - Контекст разговора
   * @param {string} language - Язык
   * @param {string|null} problemType - Тип проблемы
   * @returns {Promise<Object>} Созданный тикет
   */
  async createSupportTicket(message, userId, context, language, problemType = null) {
    const ticketData = {
      userId,
      conversationId: context.conversationId,
      subject: this.generateTicketSubject(message, problemType, language),
      initialMessage: message,
      context: this.formatConversationForTicket(context.messages),
      language,
      category: this.mapProblemTypeToCategory(problemType),
      priority: diagnosticsService.isCriticalProblem(problemType, message) ? 'high' : 'medium'
    };
    
    const ticket = await ticketService.createTicket(ticketData);
    
    // Сохраняем ссылку на тикет в контексте
    context.tickets = context.tickets || [];
    context.tickets.push(ticket.ticketId);
    
    logger.info(`Created ticket ${ticket.ticketId} for user ${userId}`);
    return ticket;
  }

  /**
   * Генерирует тему тикета
   * @param {string} message - Сообщение
   * @param {string|null} problemType - Тип проблемы
   * @param {string} language - Язык
   * @returns {string} Тема тикета
   */
  generateTicketSubject(message, problemType, language) {
    const subjects = {
      wallet_connection: {
        en: 'Wallet Connection Issue',
        ru: 'Проблема подключения кошелька',
        es: 'Problema de conexión de cartera'
      },
      transaction_stuck: {
        en: 'Transaction Stuck/Pending',
        ru: 'Транзакция зависла',
        es: 'Transacción atascada'
      },
      tokens_missing: {
        en: 'Missing/Lost Tokens',
        ru: 'Пропавшие токены',
        es: 'Tokens perdidos'
      },
      staking_issues: {
        en: 'Staking Problem',
        ru: 'Проблема со стейкингом',
        es: 'Problema de staking'
      },
      farming_issues: {
        en: 'Farming Issue',
        ru: 'Проблема с фармингом',
        es: 'Problema de farming'
      }
    };
    
    const defaultSubjects = {
      en: 'General Support Request',
      ru: 'Общий запрос поддержки',
      es: 'Solicitud de soporte general'
    };
    
    if (problemType && subjects[problemType]) {
      return subjects[problemType][language] || subjects[problemType].en;
    }
    
    return defaultSubjects[language] || defaultSubjects.en;
  }

  /**
   * Сопоставляет тип проблемы с категорией тикета
   * @param {string|null} problemType - Тип проблемы
   * @returns {string} Категория тикета
   */
  mapProblemTypeToCategory(problemType) {
    const mapping = {
      wallet_connection: 'technical',
      transaction_stuck: 'technical',
      tokens_missing: 'account',
      staking_issues: 'technical',
      farming_issues: 'technical'
    };
    
    return mapping[problemType] || 'other';
  }

  /**
   * Форматирует разговор для тикета
   * @param {Array} messages - Сообщения разговора
   * @returns {string} Форматированный контекст
   */
  formatConversationForTicket(messages) {
    return messages
      .slice(-5) // Последние 5 сообщений
      .map(msg => {
        const role = msg.role === 'user' ? 'Пользователь' : BOT_NAME;
        const time = msg.timestamp ? msg.timestamp.toISOString() : 'Unknown';
        return `[${time}] ${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Внедряет информацию о тикете в ответ
   * @param {string} message - Исходное сообщение
   * @param {string} ticketId - ID тикета
   * @param {string} language - Язык
   * @returns {string} Обновленное сообщение
   */
  injectTicketInfo(message, ticketId, language) {
    const ticketTemplates = {
      en: `\n\nI've created a support ticket #${ticketId} for our mushroom experts! They'll reach out to help your spores grow properly. 🌱`,
      ru: `\n\nЯ создал тикет поддержки #${ticketId} для наших грибных экспертов! Они свяжутся с вами, чтобы помочь вашим спорам правильно расти. 🌱`,
      es: `\n\n¡He creado un ticket de soporte #${ticketId} para nuestros expertos hongos! Te contactarán para ayudar a que tus esporas crezcan correctamente. 🌱`
    };
    
    const ticketInfo = ticketTemplates[language] || ticketTemplates.en;
    
    // Проверяем, есть ли уже информация о тикете в сообщении
    if (message.includes('#TICKET_ID') || message.includes('#')) {
      return message.replace('#TICKET_ID', `#${ticketId}`);
    }
    
    return message + ticketInfo;
  }

  /**
   * Получает или создает контекст разговора
   * @param {string} userId - ID пользователя
   * @param {string|null} conversationId - ID разговора
   * @param {string} language - Язык
   * @returns {Object} Контекст разговора
   */
  getOrCreateConversationContext(userId, conversationId, language) {
    const contextId = conversationId || `${userId}-${Date.now()}`;
    
    if (!this.conversationContexts.has(contextId)) {
      const context = {
        conversationId: contextId,
        userId,
        language,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        stats: {
          messagesCount: 0,
          tokensUsed: 0,
          ticketsCreated: 0
        }
      };
      
      this.conversationContexts.set(contextId, context);
    }
    
    const context = this.conversationContexts.get(contextId);
    context.lastActivity = new Date();
    
    return context;
  }

  /**
   * Обновляет статистику разговора
   * @param {Object} context - Контекст разговора
   * @param {number} tokensUsed - Использованные токены
   */
  updateConversationStats(context, tokensUsed) {
    context.stats.messagesCount += 1;
    context.stats.tokensUsed += tokensUsed;
    
    // Очистка старых контекстов (сохраняем только последние 24 часа)
    const now = new Date();
    for (const [id, ctx] of this.conversationContexts.entries()) {
      if (now - ctx.lastActivity > 24 * 60 * 60 * 1000) {
        this.conversationContexts.delete(id);
      }
    }
  }

  /**
   * Обрабатывает ошибки
   * @param {Error} error - Ошибка
   * @param {string} language - Язык
   * @returns {ChatResponse} Ответ об ошибке
   */
  handleError(error, language = 'en') {
    const errorMessages = {
      en: `🍄 I'm experiencing some technical difficulties in the mycelial network. Let me create a support ticket for you.`,
      ru: `🍄 У меня возникли технические трудности в грибной сети. Давайте создам тикет поддержки для вас.`,
      es: `🍄 Estoy experimentando dificultades técnicas en la red micelial. Permíteme crear un ticket de soporte para ti.`
    };

    return {
      message: errorMessages[language] || errorMessages.en,
      ticketCreated: false,
      ticketId: null,
      language,
      metadata: {
        error: true,
        errorMessage: error.message
      }
    };
  }

  /**
   * Получает статистику чата
   * @param {string} userId - ID пользователя
   * @returns {Object} Статистика
   */
  getChatStats(userId) {
    const userContexts = Array.from(this.conversationContexts.values())
      .filter(context => context.userId === userId);
    
    const totalStats = userContexts.reduce((acc, context) => ({
      conversations: acc.conversations + 1,
      messages: acc.messages + context.stats.messagesCount,
      tokensUsed: acc.tokensUsed + context.stats.tokensUsed,
      ticketsCreated: acc.ticketsCreated + context.stats.ticketsCreated
    }), {
      conversations: 0,
      messages: 0,
      tokensUsed: 0,
      ticketsCreated: 0
    });
    
    return totalStats;
  }
}

module.exports = new ChatService();
