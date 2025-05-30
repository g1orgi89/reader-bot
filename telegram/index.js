/**
 * Основной Telegram бот для проекта Shrooms с грибной тематикой
 * @file telegram/index.js
 * 🍄 ДОБАВЛЕНО: Система сбора email для тикетов
 * 🍄 ДОБАВЛЕНО: State management для пользователей
 * 🍄 ИСПРАВЛЕНО: Убрана устаревшая языковая логика, используются универсальные промпты
 * 🍄 DEBUG: Добавлено детальное логирование для диагностики проблем
 * 🍄 ИСПРАВЛЕНО: Правильные параметры для shouldCreateTicket и улучшенная обработка email
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Импорт существующих сервисов
const claudeService = require('../server/services/claude');
const ticketingService = require('../server/services/ticketing');
const conversationService = require('../server/services/conversation');
const messageService = require('../server/services/message');
const ticketEmailService = require('../server/services/ticketEmail');

/**
 * @typedef {Object} TelegramBotConfig
 * @property {string} token - Токен Telegram бота
 * @property {string} [environment] - Окружение (development/production)
 * @property {number} [maxMessageLength] - Максимальная длина сообщения
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {string} text - Текст сообщения
 * @property {string} userId - ID пользователя Telegram
 * @property {string} chatId - ID чата
 * @property {string} firstName - Имя пользователя
 * @property {string} [lastName] - Фамилия пользователя
 * @property {string} [username] - Username пользователя
 */

/**
 * @typedef {Object} UserState
 * @property {string} state - Текущее состояние пользователя
 * @property {Object} data - Данные состояния
 * @property {Date} createdAt - Время создания состояния
 */

/**
 * @class ShroomsTelegramBot
 * @description Telegram бот для поддержки проекта Shrooms с упрощенной архитектурой и email workflow
 */
class ShroomsTelegramBot {
  /**
   * @constructor
   * @param {TelegramBotConfig} config - Конфигурация бота
   */
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      maxMessageLength: config.maxMessageLength || 4096,
      typingDelay: 1500,
      platform: 'telegram',
      emailTimeout: 10 * 60 * 1000 // 10 минут для ввода email
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    // 🍄 НОВОЕ: Maps для отслеживания состояний пользователей
    /**
     * Состояния пользователей
     * @type {Map<string, UserState>}
     */
    this.userStates = new Map();
    
    /**
     * Pending тикеты, ожидающие email
     * @type {Map<string, Object>}
     */
    this.pendingTickets = new Map();
    
    logger.info('🍄 ShroomsTelegramBot constructor initialized with email workflow');
    
    // Запускаем очистку состояний каждые 5 минут
    setInterval(() => {
      this._cleanupExpiredStates();
    }, 5 * 60 * 1000);
  }

  /**
   * Инициализация бота
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Настройка middleware
      this._setupMiddleware();
      
      // Настройка обработчиков команд
      this._setupCommands();
      
      // Настройка обработчиков сообщений
      this._setupMessageHandlers();
      
      // Обработка ошибок
      this._setupErrorHandling();
      
      this.isInitialized = true;
      logger.info('🍄 Telegram bot initialized successfully with email workflow');
    } catch (error) {
      logger.error(`🍄 Failed to initialize Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Настройка middleware для логирования и обработки
   * @private
   */
  _setupMiddleware() {
    // Логирование всех сообщений
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const userId = ctx.from?.id;
      const messageText = ctx.message?.text?.substring(0, 50) || 'non-text';
      
      logger.info(`🍄 Telegram message from user ${userId}: "${messageText}..."`);
      
      await next();
      
      const duration = Date.now() - start;
      logger.info(`🍄 Response sent to user ${userId} in ${duration}ms`);
    });

    // Typing indicator
    this.bot.use(async (ctx, next) => {
      if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
        await ctx.sendChatAction('typing');
        setTimeout(async () => {
          await next();
        }, this.config.typingDelay);
      } else {
        await next();
      }
    });
  }

  /**
   * Настройка обработчиков команд
   * @private
   */
  _setupCommands() {
    // Команда /start
    this.bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        
        logger.info(`🍄 DEBUG: Processing /start command for user ${userId}`);
        
        // Очищаем состояние пользователя при старте
        this._clearUserState(userId);
        
        // Сохраняем информацию о пользователе
        await this._saveUserInfo(ctx);
        
        // Отправляем приветствие через Claude
        logger.info(`🍄 DEBUG: Calling Claude for /start command`);
        const response = await claudeService.generateResponse('/start', {
          userId,
          platform: 'telegram',
          useRag: false
        });

        logger.info(`🍄 DEBUG: Claude response received: "${response.message.substring(0, 50)}..."`);
        await this._sendResponse(ctx, response.message);
        
        logger.info(`🍄 /start command handled for user ${userId}`);
      } catch (error) {
        logger.error(`🍄 ERROR in /start command: ${error.message}`);
        logger.error(`🍄 ERROR stack: ${error.stack}`);
        await ctx.reply('🍄 Welcome to Shrooms! How can I help you today?');
      }
    });

    // Команда /help
    this.bot.help(async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        
        logger.info(`🍄 DEBUG: Processing /help command for user ${userId}`);
        
        // Отправляем помощь через Claude
        const response = await claudeService.generateResponse('/help', {
          userId,
          platform: 'telegram',
          useRag: false
        });

        logger.info(`🍄 DEBUG: Claude /help response: "${response.message.substring(0, 50)}..."`);
        await this._sendResponse(ctx, response.message);
        
        logger.info(`🍄 /help command handled for user ${userId}`);
      } catch (error) {
        logger.error(`🍄 ERROR in /help command: ${error.message}`);
        logger.error(`🍄 ERROR stack: ${error.stack}`);
        await ctx.reply('🍄 I can help you with questions about Shrooms! Just ask me anything.');
      }
    });

    // 🍄 НОВОЕ: Команда /cancel для отмены ожидания email
    this.bot.command('cancel', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        
        logger.info(`🍄 DEBUG: Processing /cancel command for user ${userId}`);
        
        const userState = this.userStates.get(userId);
        if (userState && userState.state === 'awaiting_email') {
          this._clearUserState(userId);
          const pendingTicket = this.pendingTickets.get(userId);
          this.pendingTickets.delete(userId);
          
          if (pendingTicket) {
            logger.info(`🍄 Cancelled email collection for ticket ${pendingTicket.ticketId}`);
          }
          
          const language = this._detectLanguage(ctx);
          const cancelMessage = this._getCancelMessage(language);
          await ctx.reply(cancelMessage);
        } else {
          await ctx.reply('🍄 No active email request to cancel.');
        }
        
      } catch (error) {
        logger.error(`🍄 ERROR in /cancel command: ${error.message}`);
        await ctx.reply('🍄 Something went wrong with the cancel command.');
      }
    });
  }

  /**
   * Настройка обработчиков текстовых сообщений
   * @private
   */
  _setupMessageHandlers() {
    // Обработка текстовых сообщений
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();
        const chatId = ctx.chat.id.toString();

        logger.info(`🍄 Processing message from user ${userId}: "${messageText.substring(0, 30)}..."`);

        // 🍄 НОВОЕ: Проверка состояния ожидания email
        const userState = this.userStates.get(userId);
        if (userState && userState.state === 'awaiting_email') {
          await this._handleEmailCollection(ctx, messageText, userId);
          return;
        }

        // Получаем или создаем conversation через существующий сервис
        let conversationId;
        try {
          logger.info(`🍄 DEBUG: Getting conversation for user ${userId}`);
          const conversation = await conversationService.getOrCreateConversation(userId, {
            platform: 'telegram',
            chatId: chatId,
            userInfo: {
              firstName: ctx.from.first_name,
              lastName: ctx.from.last_name,
              username: ctx.from.username
            }
          });
          conversationId = conversation._id;
          logger.info(`🍄 DEBUG: Conversation ID: ${conversationId}`);
        } catch (error) {
          logger.error(`🍄 Error managing conversation: ${error.message}`);
          conversationId = null;
        }

        // Получаем историю сообщений
        let history = [];
        try {
          if (conversationId) {
            logger.info(`🍄 DEBUG: Getting message history for conversation ${conversationId}`);
            history = await messageService.getRecentMessages(conversationId, 5);
            logger.info(`🍄 DEBUG: Found ${history.length} historical messages`);
          }
        } catch (error) {
          logger.error(`🍄 Error getting message history: ${error.message}`);
          history = [];
        }

        // 🍄 ИСПРАВЛЕНО: Проверка необходимости создания тикета с правильными параметрами
        const language = this._detectLanguage(ctx);
        const shouldCreateTicket = ticketEmailService.shouldCreateTicket(messageText, language);
        
        logger.info(`🍄 DEBUG: shouldCreateTicket result: ${shouldCreateTicket} for message: "${messageText.substring(0, 30)}..."`);
        
        if (shouldCreateTicket) {
          await this._initiateTicketCreation(ctx, messageText, userId, conversationId);
          return;
        }

        // 🍄 УПРОЩЕНО: Прямая отправка в Claude без языковой логики
        logger.info(`🍄 Generating response for platform: telegram`);
        logger.info(`🍄 DEBUG: About to call Claude API with message: "${messageText}"`);
        
        let response;
        try {
          response = await claudeService.generateResponse(messageText, {
            userId,
            platform: 'telegram',
            history: history.map(msg => ({
              role: msg.role,
              content: msg.text
            })),
            useRag: true,
            ragLimit: 3
          });
          
          logger.info(`🍄 DEBUG: Claude API response received successfully`);
          logger.info(`🍄 DEBUG: Response message: "${response.message.substring(0, 100)}..."`);
          logger.info(`🍄 DEBUG: Needs ticket: ${response.needsTicket}`);
          logger.info(`🍄 DEBUG: Tokens used: ${response.tokensUsed}`);
          
        } catch (claudeError) {
          logger.error(`🍄 CRITICAL: Claude API call failed: ${claudeError.message}`);
          logger.error(`🍄 CRITICAL: Claude error stack: ${claudeError.stack}`);
          throw claudeError;
        }

        // Сохраняем сообщения через messageService
        if (conversationId) {
          try {
            logger.info(`🍄 DEBUG: Saving messages to database`);
            
            // Сохраняем пользовательское сообщение
            await messageService.create({
              text: messageText,
              role: 'user',
              userId,
              conversationId,
              metadata: {
                source: 'telegram',
                additional: {
                  telegramChatId: chatId,
                  firstName: ctx.from.first_name,
                  lastName: ctx.from.last_name,
                  username: ctx.from.username
                }
              }
            });

            // Сохраняем ответ ассистента
            await messageService.create({
              text: response.message,
              role: 'assistant',
              userId,
              conversationId,
              metadata: {
                source: 'telegram',
                tokensUsed: response.tokensUsed,
                additional: {
                  provider: response.provider,
                  model: response.model
                }
              }
            });

            logger.info(`🍄 DEBUG: Messages saved to database successfully`);

          } catch (error) {
            logger.error(`🍄 Error saving messages: ${error.message}`);
          }
        }

        // Отправляем ответ пользователю
        logger.info(`🍄 DEBUG: About to send response to user`);
        await this._sendResponse(ctx, response.message);
        logger.info(`🍄 DEBUG: Response sent to user successfully`);

      } catch (error) {
        logger.error(`🍄 CRITICAL ERROR processing message: ${error.message}`);
        logger.error(`🍄 CRITICAL ERROR stack: ${error.stack}`);
        await this._sendErrorMessage(ctx, error);
      }
    });
  }

  /**
   * 🍄 НОВОЕ: Инициация создания тикета с запросом email
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} message - Сообщение пользователя
   * @param {string} userId - ID пользователя
   * @param {string} conversationId - ID разговора
   */
  async _initiateTicketCreation(ctx, message, userId, conversationId) {
    try {
      logger.info(`🍄 DEBUG: Initiating ticket creation for user ${userId}`);
      
      const language = this._detectLanguage(ctx);
      
      // Создаем pending тикет
      const ticketResult = await ticketEmailService.createPendingTicket({
        userId,
        conversationId,
        subject: `Telegram Support: ${message.substring(0, 50)}...`,
        initialMessage: message,
        context: JSON.stringify({
          platform: 'telegram',
          userInfo: {
            telegramId: userId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username
          }
        }),
        language: language,
        category: 'technical',
        priority: 'medium'
      });

      if (!ticketResult.success) {
        throw new Error('Failed to create pending ticket');
      }

      logger.info(`🍄 DEBUG: Ticket creation result:`, ticketResult.ticket);

      // Сохраняем состояние пользователя
      this.userStates.set(userId, {
        state: 'awaiting_email',
        data: {
          ticketId: ticketResult.ticket.ticketId,
          conversationId
        },
        createdAt: new Date()
      });

      // Сохраняем pending тикет для быстрого доступа
      this.pendingTickets.set(userId, ticketResult.ticket);

      // Отправляем запрос email
      const emailRequest = ticketResult.message;
      await ctx.replyWithMarkdown(emailRequest);
      
      logger.info(`🍄 Ticket ${ticketResult.ticket.ticketId} created, awaiting email from user ${userId}`);
      
    } catch (error) {
      logger.error(`🍄 Error creating ticket: ${error.message}`);
      logger.error(`🍄 Error stack: ${error.stack}`);
      await ctx.reply('🍄 Sorry, there was an issue creating your support ticket. Please try again.');
    }
  }

  /**
   * 🍄 НОВОЕ: Обработка сбора email
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} messageText - Текст сообщения
   * @param {string} userId - ID пользователя
   */
  async _handleEmailCollection(ctx, messageText, userId) {
    try {
      logger.info(`🍄 DEBUG: Handling email collection from user ${userId}: "${messageText}"`);
      
      const email = ticketEmailService.extractEmail(messageText);
      
      if (!email) {
        // Неправильный email - просим повторить
        const errorMessage = this._getInvalidEmailMessage(this._detectLanguage(ctx));
        await ctx.reply(errorMessage);
        return;
      }

      logger.info(`🍄 DEBUG: Valid email received: ${email}`);

      // Обновляем тикет с email
      const language = this._detectLanguage(ctx);
      const emailResult = await ticketEmailService.updateTicketWithEmail(
        userId, 
        email, 
        language
      );

      if (!emailResult.success) {
        throw new Error(emailResult.message || 'Failed to update ticket with email');
      }

      // Очищаем состояние
      this._clearUserState(userId);
      const ticketData = this.pendingTickets.get(userId);
      this.pendingTickets.delete(userId);

      // Отправляем подтверждение
      await ctx.replyWithMarkdown(emailResult.message);
      
      logger.info(`🍄 SUCCESS: Email ${email} collected for ticket ${emailResult.ticketId || ticketData?.ticketId}`);
      
    } catch (error) {
      logger.error(`🍄 Error handling email collection: ${error.message}`);
      logger.error(`🍄 Error stack: ${error.stack}`);
      
      // Очищаем состояние при ошибке
      this._clearUserState(userId);
      this.pendingTickets.delete(userId);
      await ctx.reply('🍄 Sorry, there was an issue processing your email. Please try again.');
    }
  }

  /**
   * 🍄 НОВОЕ: Очистка состояния пользователя
   * @private
   * @param {string} userId - ID пользователя
   */
  _clearUserState(userId) {
    this.userStates.delete(userId);
    this.pendingTickets.delete(userId);
    logger.info(`🍄 Cleared state for user ${userId}`);
  }

  /**
   * 🍄 НОВОЕ: Очистка просроченных состояний
   * @private
   */
  _cleanupExpiredStates() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, state] of this.userStates.entries()) {
      if (state.state === 'awaiting_email') {
        const ticketData = this.pendingTickets.get(userId);
        if (ticketData && (now - state.createdAt.getTime()) > this.config.emailTimeout) {
          this._clearUserState(userId);
          cleanedCount++;
          logger.info(`🍄 Cleaned up expired email state for user ${userId}`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`🍄 Cleaned up ${cleanedCount} expired states`);
    }
  }

  /**
   * 🍄 НОВОЕ: Сообщения для запроса email на разных языках
   * @private
   * @param {string} language - Язык
   * @returns {string} Сообщение запроса email
   */
  _getEmailRequestMessage(language) {
    const messages = {
      'ru': '🎫 *Тикет поддержки создан!*\n\nДля связи с нашими экспертами, пожалуйста, укажите ваш email адрес:\n\n_Или отправьте /cancel для отмены_',
      'es': '🎫 *¡Ticket de soporte creado!*\n\nPara contactar con nuestros expertos, por favor proporciona tu dirección de email:\n\n_O envía /cancel para cancelar_',
      'en': '🎫 *Support ticket created!*\n\nTo connect with our experts, please provide your email address:\n\n_Or send /cancel to cancel_'
    };
    return messages[language] || messages['en'];
  }

  /**
   * 🍄 НОВОЕ: Сообщения об ошибке email
   * @private
   * @param {string} language - Язык
   * @returns {string} Сообщение об ошибке
   */
  _getInvalidEmailMessage(language) {
    const messages = {
      'ru': '❌ Пожалуйста, введите корректный email адрес (например: user@gmail.com):\n\n_Или отправьте /cancel для отмены_',
      'es': '❌ Por favor, ingresa una dirección de email válida (ejemplo: user@gmail.com):\n\n_O envía /cancel para cancelar_',
      'en': '❌ Please enter a valid email address (example: user@gmail.com):\n\n_Or send /cancel to cancel_'
    };
    return messages[language] || messages['en'];
  }

  /**
   * 🍄 НОВОЕ: Сообщения об отмене
   * @private
   * @param {string} language - Язык
   * @returns {string} Сообщение об отмене
   */
  _getCancelMessage(language) {
    const messages = {
      'ru': '🍄 Сбор email отменен. Можете продолжить обычное общение!',
      'es': '🍄 Recolección de email cancelada. ¡Puedes continuar la conversación normal!',
      'en': '🍄 Email collection cancelled. You can continue with normal conversation!'
    };
    return messages[language] || messages['en'];
  }

  /**
   * Определение языка пользователя
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @returns {string} Код языка
   */
  _detectLanguage(ctx) {
    const telegramLang = ctx.from?.language_code?.split('-')[0];
    const supportedLanguages = ['en', 'ru', 'es'];
    const detectedLang = supportedLanguages.includes(telegramLang) ? telegramLang : 'en';
    
    logger.info(`🍄 DEBUG: Detected language: ${detectedLang} (from Telegram: ${telegramLang})`);
    
    return detectedLang;
  }

  /**
   * Настройка обработки ошибок
   * @private
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`🍄 Telegram bot error for user ${ctx.from?.id}: ${err.message}`);
      logger.error(`🍄 Telegram bot error stack: ${err.stack}`);
      
      // Отправляем пользователю сообщение об ошибке
      ctx.reply('🍄 Oops! Something went wrong. Please try again in a moment.')
        .catch(sendError => {
          logger.error(`🍄 Failed to send error message: ${sendError.message}`);
        });
    });

    // Обработка необработанных ошибок
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🍄 Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Сохранение информации о пользователе
   * @private
   * @param {Object} ctx - Контекст Telegram
   */
  async _saveUserInfo(ctx) {
    try {
      const userInfo = {
        telegramId: ctx.from.id.toString(),
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        languageCode: ctx.from.language_code,
        chatId: ctx.chat.id.toString(),
        platform: 'telegram'
      };

      // Сохраняем через conversation service
      await conversationService.getOrCreateConversation(userInfo.telegramId, {
        platform: 'telegram',
        userInfo
      });

    } catch (error) {
      logger.error(`🍄 Error saving user info: ${error.message}`);
    }
  }

  /**
   * Отправка ответа с разбивкой длинных сообщений
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} message - Сообщение для отправки
   */
  async _sendResponse(ctx, message) {
    try {
      logger.info(`🍄 DEBUG: _sendResponse called with message length: ${message.length}`);
      
      // Разбиваем длинные сообщения
      const chunks = this._splitMessage(message);
      logger.info(`🍄 DEBUG: Message split into ${chunks.length} chunks`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          logger.info(`🍄 DEBUG: Sending chunk ${i + 1}/${chunks.length}`);
          // Пробуем отправить с Markdown форматированием
          await ctx.replyWithMarkdown(chunk);
          logger.info(`🍄 DEBUG: Chunk ${i + 1} sent successfully with Markdown`);
        } catch (markdownError) {
          // Если Markdown не работает, отправляем как обычный текст
          logger.warn(`🍄 Markdown formatting failed, sending as plain text: ${markdownError.message}`);
          await ctx.reply(chunk);
          logger.info(`🍄 DEBUG: Chunk ${i + 1} sent successfully as plain text`);
        }
        
        // Небольшая задержка между сообщениями
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      logger.info(`🍄 DEBUG: All chunks sent successfully`);
    } catch (error) {
      logger.error(`🍄 Error sending response: ${error.message}`);
      logger.error(`🍄 Error stack: ${error.stack}`);
      // Отправляем простое сообщение об ошибке
      await ctx.reply('🍄 I encountered an issue sending the response. Please try again.');
    }
  }

  /**
   * Разбивка длинного сообщения на части
   * @private
   * @param {string} message - Исходное сообщение
   * @returns {string[]} Массив частей сообщения
   */
  _splitMessage(message) {
    if (message.length <= this.config.maxMessageLength) {
      return [message];
    }

    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > this.config.maxMessageLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Если одна строка слишком длинная
        if (line.length > this.config.maxMessageLength) {
          const words = line.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if ((wordChunk + word + ' ').length > this.config.maxMessageLength) {
              if (wordChunk.trim()) {
                chunks.push(wordChunk.trim());
                wordChunk = '';
              }
            }
            wordChunk += word + ' ';
          }
          
          if (wordChunk.trim()) {
            currentChunk = wordChunk.trim() + '\n';
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Отправка сообщения об ошибке
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {Error} error - Ошибка
   */
  async _sendErrorMessage(ctx, error) {
    const errorMessage = '🍄 I\'m experiencing some technical difficulties. Please try again in a moment, or contact our support team if the issue persists.';

    try {
      await ctx.reply(errorMessage);
    } catch (sendError) {
      logger.error(`🍄 Failed to send error message: ${sendError.message}`);
    }
  }

  /**
   * Запуск бота
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('🍄 Telegram bot started successfully with email workflow');
      
      // Graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`🍄 Failed to start Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Остановка бота
   * @param {string} [signal] - Сигнал остановки
   * @returns {Promise<void>}
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`🍄 Stopping Telegram bot (${signal})...`);
      await this.bot.stop(signal);
      logger.info('🍄 Telegram bot stopped successfully');
    } catch (error) {
      logger.error(`🍄 Error stopping bot: ${error.message}`);
    }
  }

  /**
   * Получение статистики бота
   * @returns {Promise<Object>} Статистика
   */
  async getStats() {
    try {
      const me = await this.bot.telegram.getMe();
      
      // 🍄 НОВОЕ: Статистика состояний пользователей
      let awaitingEmailCount = 0;
      for (const state of this.userStates.values()) {
        if (state.state === 'awaiting_email') {
          awaitingEmailCount++;
        }
      }
      
      return {
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        config: {
          environment: this.config.environment,
          maxMessageLength: this.config.maxMessageLength,
          platform: this.config.platform,
          emailTimeout: this.config.emailTimeout
        },
        status: {
          initialized: this.isInitialized,
          uptime: process.uptime()
        },
        userStates: {
          total: this.userStates.size,
          awaitingEmail: awaitingEmailCount
        },
        pendingTickets: {
          total: this.pendingTickets.size
        },
        features: {
          emailWorkflow: true,
          stateManagement: true,
          ticketCreation: true
        },
        languageSupport: 'universal',
        systemMessages: 'none'
      };
    } catch (error) {
      logger.error(`🍄 Error getting bot stats: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = ShroomsTelegramBot;