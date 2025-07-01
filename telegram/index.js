/**
 * Main Telegram bot for Reader project - Personal quotes diary with AI analysis
 * @file telegram/index.js
 * 📖 READER BOT: Transformed from Shrooms for Anna Busel's book club
 * 📖 UPDATED: Complete integration with all handlers (Quote, Command, ComplexQuestion)
 * 📖 ADDED: Full Day 13-14 functionality with AI analysis and achievements
 * 📖 ADDED: WeeklyReportHandler integration and feedback support
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Import Reader bot services
const claudeService = require('../server/services/claude');
const ticketingService = require('../server/services/ticketing');

// Import Reader bot models
const { UserProfile, Quote } = require('../server/models');

// Import Reader bot handlers and helpers
const { OnboardingHandler } = require('./handlers/onboardingHandler');
const { QuoteHandler } = require('./handlers/quoteHandler');
const { CommandHandler } = require('./handlers/commandHandler');
const { ComplexQuestionHandler } = require('./handlers/complexQuestionHandler');
const BotHelpers = require('./helpers/botHelpers');

/**
 * @typedef {Object} ReaderTelegramBotConfig
 * @property {string} token - Telegram bot token
 * @property {string} [environment] - Environment (development/production)
 * @property {number} [maxMessageLength] - Maximum message length
 */

/**
 * @class ReaderTelegramBot
 * @description Telegram bot for Reader project - personal quotes diary with AI analysis by Anna Busel
 */
class ReaderTelegramBot {
  /**
   * @constructor
   * @param {ReaderTelegramBotConfig} config - Bot configuration
   */
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      maxMessageLength: config.maxMessageLength || 4096,
      typingDelay: 1500,
      platform: 'telegram',
      maxQuotesPerDay: 10 // Reader-specific limit
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    // Initialize Reader bot handlers
    this.onboardingHandler = new OnboardingHandler();
    this.quoteHandler = new QuoteHandler();
    this.commandHandler = new CommandHandler();
    this.complexQuestionHandler = new ComplexQuestionHandler();
    
    // WeeklyReportHandler will be set externally
    this.weeklyReportHandler = null;
    
    logger.info('📖 ReaderTelegramBot constructor initialized with all handlers');
  }

  /**
   * Set weekly report handler (called from start.js)
   * @param {Object} weeklyReportHandler - WeeklyReportHandler instance
   */
  setWeeklyReportHandler(weeklyReportHandler) {
    this.weeklyReportHandler = weeklyReportHandler;
    logger.info('📖 WeeklyReportHandler integrated into main bot');
  }

  /**
   * Initialize the Reader bot
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Setup middleware
      this._setupMiddleware();
      
      // Setup command handlers
      this._setupCommands();
      
      // Setup message handlers
      this._setupMessageHandlers();
      
      // Setup callback handlers
      this._setupCallbackHandlers();
      
      // Setup error handling
      this._setupErrorHandling();
      
      this.isInitialized = true;
      logger.info('📖 Reader Telegram bot initialized successfully with all Day 13-14 features');
    } catch (error) {
      logger.error(`📖 Failed to initialize Reader Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup middleware for logging and typing indicators
   * @private
   */
  _setupMiddleware() {
    // Logging middleware
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const userId = ctx.from?.id;
      const messageText = ctx.message?.text?.substring(0, 50) || 'non-text';
      
      logger.info(`📖 Message from user ${userId}: "${messageText}..."`);
      
      await next();
      
      const duration = Date.now() - start;
      logger.info(`📖 Response sent to user ${userId} in ${duration}ms`);
    });

    // Typing indicator for text messages
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
   * Setup command handlers
   * @private
   */
  _setupCommands() {
    // /start command - Begin onboarding or show welcome for existing users
    this.bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        logger.info(`📖 Processing /start command for user ${userId}`);
        
        await this.onboardingHandler.handleStart(ctx);
        
      } catch (error) {
        logger.error(`📖 Error in /start command: ${error.message}`);
        await ctx.reply(`📖 Здравствуйте! Добро пожаловать в «Читатель» - ваш персональный дневник цитат от Анны Бусел.`);
      }
    });

    // /help command
    this.bot.help(async (ctx) => {
      try {
        await this.commandHandler.handleHelp(ctx);
      } catch (error) {
        logger.error(`📖 Error in /help command: ${error.message}`);
        await ctx.reply('📖 Я могу помочь вам с сохранением цитат и рекомендациями книг! Просто отправьте мне цитату.');
      }
    });

    // /stats command - Show user statistics
    this.bot.command('stats', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        if (await this.commandHandler.hasAccess('stats', userId)) {
          await this.commandHandler.handleStats(ctx);
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /stats command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при получении статистики. Попробуйте позже.');
      }
    });

    // /search command - Search user's quotes
    this.bot.command('search', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        if (await this.commandHandler.hasAccess('search', userId)) {
          // Check if there's a search query
          const commandText = ctx.message.text;
          const searchQuery = commandText.replace('/search', '').trim();
          
          if (searchQuery) {
            await this.commandHandler.handleSearchWithQuery(ctx, searchQuery);
          } else {
            await this.commandHandler.handleSearch(ctx);
          }
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /search command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при поиске цитат. Попробуйте позже.');
      }
    });

    // /settings command - User settings
    this.bot.command('settings', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        if (await this.commandHandler.hasAccess('settings', userId)) {
          await this.commandHandler.handleSettings(ctx);
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /settings command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при загрузке настроек. Попробуйте позже.');
      }
    });
  }

  /**
   * Setup callback query handlers
   * @private
   */
  _setupCallbackHandlers() {
    this.bot.on('callback_query', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const callbackData = ctx.callbackQuery.data;
        
        logger.info(`📖 Callback query from user ${userId}: ${callbackData}`);

        // Check if it's an onboarding callback
        if (this.onboardingHandler.isInOnboarding(userId) || 
            callbackData === 'start_test' || 
            callbackData.startsWith('test_') || 
            callbackData.startsWith('source_')) {
          
          if (await this.onboardingHandler.handleCallback(ctx)) {
            return;
          }
        }

        // Handle weekly report feedback callbacks
        if (callbackData.startsWith('feedback_') && this.weeklyReportHandler) {
          const parts = callbackData.split('_');
          if (parts.length >= 3) {
            const rating = parts[1]; // excellent/good/bad
            const reportId = parts.slice(2).join('_'); // handle IDs with underscores
            
            await this.weeklyReportHandler.handleWeeklyFeedback(ctx, rating, reportId);
            return;
          }
        }

        // Handle user stats callback
        if (callbackData === 'show_user_stats') {
          await this.commandHandler.handleStats(ctx);
          await ctx.answerCbQuery();
          return;
        }

        // Handle settings callbacks
        if (callbackData.startsWith('toggle_') || 
            callbackData.startsWith('set_time_') ||
            callbackData.startsWith('change_') ||
            callbackData === 'show_settings' ||
            callbackData === 'export_quotes' ||
            callbackData === 'close_settings') {
          
          if (callbackData === 'show_settings') {
            await this.commandHandler.handleSettings(ctx);
            await ctx.answerCbQuery();
            return;
          }
          
          if (await this.commandHandler.handleSettingsCallback(ctx, callbackData)) {
            return;
          }
        }

        // Handle other callbacks through BotHelpers
        await BotHelpers.handleOtherCallbacks(ctx, callbackData);

      } catch (error) {
        logger.error(`📖 Error handling callback query: ${error.message}`);
        await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
      }
    });
  }

  /**
   * Setup text message handlers
   * @private
   */
  _setupMessageHandlers() {
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();

        logger.info(`📖 Processing text message from user ${userId}: "${messageText.substring(0, 30)}..."`);

        // Check if user is in onboarding process
        if (await this.onboardingHandler.handleTextMessage(ctx)) {
          return; // Message was handled by onboarding
        }

        // Check if user has completed onboarding
        const userProfile = await UserProfile.findOne({ userId });
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await ctx.reply(`📖 Пожалуйста, сначала пройдите регистрацию. Введите /start`);
          return;
        }

        // Check if it's a complex question that needs Anna's attention
        if (this.complexQuestionHandler.isComplexQuestion(messageText)) {
          await this.complexQuestionHandler.handleComplexQuestion(ctx, messageText, userProfile);
          return;
        }

        // Check if message looks like a quote
        if (BotHelpers.isQuoteMessage(messageText)) {
          await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
          return;
        }

        // Handle as general conversation with Anna Busel's AI
        await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);

      } catch (error) {
        logger.error(`📖 Error processing text message: ${error.message}`);
        await this._sendErrorMessage(ctx, error);
      }
    });

    // Handle non-text messages (photos, documents, etc.)
    this.bot.on(['photo', 'document', 'voice', 'video', 'sticker'], async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
          return;
        }

        const messageType = ctx.message.photo ? 'фото' : 
                           ctx.message.document ? 'документ' :
                           ctx.message.voice ? 'голосовое сообщение' :
                           ctx.message.video ? 'видео' : 'файл';

        await ctx.reply(
          `📖 Спасибо за ${messageType}! Но я принимаю только текстовые цитаты.\n\n` +
          `💡 Если у вас есть интересная цитата из изображения или документа, ` +
          `пожалуйста, перепечатайте ее текстом.\n\n` +
          `Например: "В каждом слове — целая жизнь" (Марина Цветаева)`
        );

      } catch (error) {
        logger.error(`📖 Error processing non-text message: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка. Попробуйте отправить цитату текстом.');
      }
    });
  }

  /**
   * Setup error handling
   * @private
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`📖 Telegram bot error: ${err.message}`);
      
      // Определяем подходящий ответ на основе типа ошибки
      let errorMessage = '📖 Упс! Что-то пошло не так. Попробуйте еще раз.';
      
      if (err.code === 429) {
        errorMessage = '📖 Слишком много запросов. Пожалуйста, подождите немного.';
      } else if (err.code === 403) {
        errorMessage = '📖 Нет доступа. Проверьте, не заблокировали ли вы бота.';
      } else if (err.message.includes('message is too long')) {
        errorMessage = '📖 Сообщение слишком длинное. Попробуйте разделить его на части.';
      }

      ctx.reply(errorMessage)
        .catch(sendError => {
          logger.error(`📖 Failed to send error message: ${sendError.message}`);
        });
    });
  }

  /**
   * Send error message to user
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Error} error - Error object
   */
  async _sendErrorMessage(ctx, error) {
    try {
      let message = '📖 Произошла ошибка. Попробуйте еще раз через минуту.';
      
      // Специальные сообщения для определенных ошибок
      if (error.message.includes('daily limit')) {
        message = '📖 Вы достигли дневного лимита цитат (10 штук). Возвращайтесь завтра!';
      } else if (error.message.includes('quote too long')) {
        message = '📖 Цитата слишком длинная. Максимум 1000 символов.';
      }

      await ctx.reply(message);
    } catch (sendError) {
      logger.error(`📖 Failed to send error message: ${sendError.message}`);
    }
  }

  /**
   * Start the bot
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('📖 Reader Telegram bot started successfully with all Day 13-14 features');
      
      // Graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`📖 Failed to start Reader Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the bot
   * @param {string} [signal] - Stop signal
   * @returns {Promise<void>}
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`📖 Stopping Reader Telegram bot (${signal})...`);
      await this.bot.stop(signal);
      logger.info('📖 Reader Telegram bot stopped successfully');
    } catch (error) {
      logger.error(`📖 Error stopping bot: ${error.message}`);
    }
  }

  /**
   * Send message to user (external API)
   * @param {string} userId - User ID
   * @param {string} message - Message text
   * @param {Object} [options] - Additional options
   * @returns {Promise<void>}
   */
  async sendMessageToUser(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: options.parseMode || 'Markdown',
        reply_markup: options.replyMarkup,
        disable_web_page_preview: options.disablePreview !== false
      });
      
      logger.info(`📖 Message sent to user ${userId}`);
    } catch (error) {
      logger.error(`📖 Failed to send message to user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bot statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const me = await this.bot.telegram.getMe();
      
      // Reader bot specific stats
      const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
      const totalQuotes = await Quote.countDocuments();
      const onboardingUsers = this.onboardingHandler.userStates.size;
      
      // Today's activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({ createdAt: { $gte: today } });
      const todayUsers = await Quote.distinct('userId', { createdAt: { $gte: today } });

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
          maxQuotesPerDay: this.config.maxQuotesPerDay
        },
        status: {
          initialized: this.isInitialized,
          uptime: process.uptime()
        },
        readerStats: {
          totalUsers,
          totalQuotes,
          onboardingUsers,
          averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0,
          todayQuotes,
          activeUsersToday: todayUsers.length
        },
        handlers: {
          onboarding: this.onboardingHandler.getStats(),
          quotes: this.quoteHandler.getStats(),
          commands: this.commandHandler.getStats(),
          complexQuestions: this.complexQuestionHandler.getStats(),
          helpers: BotHelpers.getStats(),
          weeklyReports: this.weeklyReportHandler ? true : false
        },
        features: {
          onboardingFlow: true,
          quoteCollection: true,
          aiAnalysis: true,
          achievementSystem: true,
          complexQuestionHandling: true,
          annaPersona: true,
          userCommands: true,
          settingsManagement: true,
          quoteExport: true,
          ticketingSystem: true,
          weeklyReports: !!this.weeklyReportHandler,
          scheduledTasks: true
        }
      };
    } catch (error) {
      logger.error(`📖 Error getting bot stats: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Clean up onboarding states
      this.onboardingHandler.cleanupStaleStates();
      
      logger.info('📖 Reader bot cleanup completed');
    } catch (error) {
      logger.error(`📖 Error during cleanup: ${error.message}`);
    }
  }

  /**
   * Health check for the bot
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      // Check if bot can communicate with Telegram
      const me = await this.bot.telegram.getMe();
      
      // Check database connectivity
      const userCount = await UserProfile.countDocuments();
      
      return {
        status: 'healthy',
        bot: {
          id: me.id,
          username: me.username,
          canReceiveMessages: true
        },
        database: {
          connected: true,
          userCount
        },
        handlers: {
          initialized: this.isInitialized,
          onboardingActive: this.onboardingHandler.userStates.size,
          weeklyReportsEnabled: !!this.weeklyReportHandler
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`📖 Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ReaderTelegramBot;