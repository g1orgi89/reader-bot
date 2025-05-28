/**
 * Основной Telegram бот для проекта Shrooms с грибной тематикой
 * @file telegram/index.js
 * 🍄 ИСПРАВЛЕНО: Убрана устаревшая языковая логика, используются универсальные промпты
 * 🍄 DEBUG: Добавлено детальное логирование для диагностики проблем
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Импорт существующих сервисов
const claudeService = require('../server/services/claude');
const ticketingService = require('../server/services/ticketing');
const conversationService = require('../server/services/conversation');
const messageService = require('../server/services/message');

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
 * @class ShroomsTelegramBot
 * @description Telegram бот для поддержки проекта Shrooms с упрощенной архитектурой
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
      platform: 'telegram'
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    logger.info('🍄 ShroomsTelegramBot constructor initialized (simplified version)');
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
      logger.info('🍄 Telegram bot initialized successfully (simplified)');
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

        // Создаем тикет если необходимо
        if (response.needsTicket) {
          try {
            logger.info(`🍄 DEBUG: Creating support ticket`);
            const ticketData = {
              userId,
              conversationId,
              message: messageText,
              platform: 'telegram',
              userInfo: {
                telegramId: userId,
                chatId: chatId,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
                username: ctx.from.username
              },
              context: response.context || []
            };

            const ticket = await ticketingService.createTicket(ticketData);
            
            const ticketMessage = `🎫 *Support Ticket Created*\n\nI've created ticket \`${ticket.ticketId}\` for our mushroom experts team! \n\nOur growers will review your question and get back to you soon.\n\n*Thank you for helping our mycelium grow stronger!* 🍄`;
            await ctx.replyWithMarkdown(ticketMessage);
            
            logger.info(`🍄 Ticket ${ticket.ticketId} created for user ${userId}`);
          } catch (error) {
            logger.error(`🍄 Error creating ticket: ${error.message}`);
          }
        }

      } catch (error) {
        logger.error(`🍄 CRITICAL ERROR processing message: ${error.message}`);
        logger.error(`🍄 CRITICAL ERROR stack: ${error.stack}`);
        await this._sendErrorMessage(ctx, error);
      }
    });
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
      logger.info('🍄 Telegram bot started successfully');
      
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
      
      return {
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        config: {
          environment: this.config.environment,
          maxMessageLength: this.config.maxMessageLength,
          platform: this.config.platform
        },
        status: {
          initialized: this.isInitialized,
          uptime: process.uptime()
        },
        languageSupport: 'universal', // 🍄 ИСПРАВЛЕНО: Универсальная поддержка языков
        systemMessages: 'none' // 🍄 ИСПРАВЛЕНО: Системные сообщения не используются
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