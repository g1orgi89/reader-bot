/**
 * Main Telegram bot for Reader project - Clean UX with menu button
 * @file telegram/index.js
 * 🎨 CLEAN UX: Menu button navigation, simple text responses, no visual spam
 */

const { Telegraf } = require('telegraf');
const logger = require('../server/utils/logger');

// Import Reader bot services
const claudeService = require('../server/services/claude');
const { UserProfile, Quote } = require('../server/models');

// Import CLEAN handlers
const { ModernOnboardingHandler } = require('./handlers/modernOnboardingHandler');
const { ModernQuoteHandler } = require('./handlers/modernQuoteHandler');
const { CommandHandler } = require('./handlers/commandHandler');
const { ComplexQuestionHandler } = require('./handlers/complexQuestionHandler');
const { WeeklyReportHandler } = require('./handlers/weeklyReportHandler');

class ReaderTelegramBot {
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      maxMessageLength: config.maxMessageLength || 4096,
      platform: 'telegram',
      maxQuotesPerDay: 10
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    // Initialize CLEAN handlers
    this.onboardingHandler = new ModernOnboardingHandler();
    this.quoteHandler = new ModernQuoteHandler();
    this.commandHandler = new CommandHandler();
    this.complexQuestionHandler = new ComplexQuestionHandler();
    this.weeklyReportHandler = new WeeklyReportHandler();
    
    logger.info('✅ ReaderTelegramBot initialized with clean UX');
  }

  /**
   * Initialize the bot
   */
  async initialize() {
    try {
      // Setup menu button and commands
      await this.onboardingHandler.setupMenuButton(this.bot);
      
      // Setup bot handlers
      this._setupCommands();
      this._setupMessageHandlers();
      this._setupCallbackHandlers();
      this._setupErrorHandling();
      
      // Set bot instance for handlers that need it
      this.weeklyReportHandler.setBotInstance(this.bot);
      
      this.isInitialized = true;
      logger.info('✅ Reader bot initialized with menu button navigation');
    } catch (error) {
      logger.error(`Failed to initialize bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup commands
   */
  _setupCommands() {
    // /start command
    this.bot.start(async (ctx) => {
      try {
        await this.onboardingHandler.handleStart(ctx);
      } catch (error) {
        logger.error(`Error in /start: ${error.message}`);
        await ctx.reply('📖 Здравствуйте! Добро пожаловать в «Читатель».');
      }
    });

    // /help command
    this.bot.help(async (ctx) => {
      try {
        await this.commandHandler.handleHelp(ctx);
      } catch (error) {
        logger.error(`Error in /help: ${error.message}`);
        await ctx.reply('📖 Используйте кнопку меню 📋 для навигации');
      }
    });

    // /stats command
    this.bot.command('stats', async (ctx) => {
      try {
        await this.commandHandler.handleStats(ctx);
      } catch (error) {
        logger.error(`Error in /stats: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при получении статистики');
      }
    });

    // /search command
    this.bot.command('search', async (ctx) => {
      try {
        await this.commandHandler.handleSearch(ctx);
      } catch (error) {
        logger.error(`Error in /search: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при поиске цитат');
      }
    });

    // /settings command
    this.bot.command('settings', async (ctx) => {
      try {
        await this.commandHandler.handleSettings(ctx);
      } catch (error) {
        logger.error(`Error in /settings: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при загрузке настроек');
      }
    });
  }

  /**
   * Setup message handlers
   */
  _setupMessageHandlers() {
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();

        // Skip commands
        if (messageText.startsWith('/')) return;

        // Check onboarding
        if (await this.onboardingHandler.handleTextMessage(ctx)) {
          return;
        }

        // Check if user exists
        const userProfile = await UserProfile.findOne({ userId });
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await ctx.reply('📖 Пожалуйста, сначала пройдите регистрацию: /start');
          return;
        }

        // Check if it's settings message
        if (this.commandHandler.isSettingsMessage(messageText)) {
          await this.commandHandler.handleSettingsText(ctx, messageText);
          return;
        }

        // Check if it's a quote
        if (this.quoteHandler.isQuote(messageText)) {
          await this.quoteHandler.handleQuote(ctx, messageText);
          return;
        }

        // Check if it's a complex question
        if (await this.complexQuestionHandler.detectComplexQuestion(messageText)) {
          await this.complexQuestionHandler.createTicketForAnna(ctx, messageText);
          return;
        }

        // Handle as general message
        await this._handleGeneralMessage(ctx, messageText);

      } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз.');
      }
    });

    // Handle non-text messages
    this.bot.on(['photo', 'document', 'voice', 'video', 'sticker'], async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await ctx.reply('📖 Пожалуйста, сначала пройдите регистрацию: /start');
          return;
        }

        await ctx.reply(
          '📖 Спасибо! Но я принимаю только текстовые цитаты.\n\n' +
          'Если у вас есть интересная цитата из изображения, ' +
          'пожалуйста, перепечатайте ее текстом.\n\n' +
          'Например: "В каждом слове — целая жизнь" (Марина Цветаева)'
        );

      } catch (error) {
        logger.error(`Error processing non-text: ${error.message}`);
        await ctx.reply('📖 Отправьте цитату текстом, пожалуйста.');
      }
    });
  }

  /**
   * Setup callback handlers
   */
  _setupCallbackHandlers() {
    this.bot.on('callback_query', async (ctx) => {
      try {
        const callbackData = ctx.callbackQuery.data;

        // Handle onboarding callbacks
        if (await this.onboardingHandler.handleCallback(ctx)) {
          return;
        }

        // Handle weekly report feedback
        if (await this.weeklyReportHandler.handleFeedback(ctx)) {
          return;
        }

        // Handle settings callbacks
        if (await this.commandHandler.handleSettingsCallback(ctx)) {
          return;
        }

        // Unknown callback
        await ctx.answerCbQuery('❓ Неизвестная команда');

      } catch (error) {
        logger.error(`Error handling callback: ${error.message}`);
        await ctx.answerCbQuery('❌ Произошла ошибка');
      }
    });
  }

  /**
   * Handle general messages with AI
   */
  async _handleGeneralMessage(ctx, messageText) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });

      const prompt = `Ты помощник психолога Анны Бусел в боте "Читатель". 
Пользователь написал: "${messageText}"

Ответь в стиле Анны Бусел:
- Тон: теплый, поддерживающий
- Обращение на "Вы"
- Если это вопрос о книгах/психологии - дай совет
- Если это благодарность - отвечай скромно
- Если непонятно - переспроси деликатно
- Максимум 2-3 предложения

Если вопрос слишком сложный, предложи написать Анне лично.`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: userId
      });

      await ctx.reply(response.message);

    } catch (error) {
      logger.error(`Error in general message: ${error.message}`);
      await ctx.reply(
        '📖 Спасибо за сообщение! Если у вас есть сложный вопрос, ' +
        'я передам его Анне для персонального ответа.'
      );
    }
  }

  /**
   * Setup error handling
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`Bot error: ${err.message}`);
      
      let errorMessage = '📖 Произошла ошибка. Попробуйте еще раз.';
      
      if (err.code === 429) {
        errorMessage = '📖 Слишком много запросов. Подождите немного.';
      } else if (err.code === 403) {
        errorMessage = '📖 Нет доступа. Проверьте, не заблокировали ли вы бота.';
      }

      ctx.reply(errorMessage).catch(sendError => {
        logger.error(`Failed to send error message: ${sendError.message}`);
      });
    });
  }

  /**
   * Start the bot
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('✅ Reader bot started with clean UX');
      
      // Graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`Stopping bot (${signal})...`);
      
      // Cleanup handlers
      this.onboardingHandler.cleanupStaleStates();
      
      await this.bot.stop(signal);
      logger.info('✅ Bot stopped successfully');
    } catch (error) {
      logger.error(`Error stopping bot: ${error.message}`);
    }
  }

  /**
   * Send message to user
   */
  async sendMessageToUser(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: options.parseMode,
        reply_markup: options.replyMarkup,
        disable_web_page_preview: true
      });
      
      logger.info(`Message sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get bot statistics
   */
  async getStats() {
    try {
      const me = await this.bot.telegram.getMe();
      const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
      const totalQuotes = await Quote.countDocuments();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({ createdAt: { $gte: today } });

      return {
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        stats: {
          totalUsers,
          totalQuotes,
          todayQuotes,
          averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0,
          onboardingUsers: this.onboardingHandler.userStates.size
        },
        status: {
          initialized: this.isInitialized,
          cleanUXEnabled: true,
          menuButtonEnabled: true
        }
      };
    } catch (error) {
      logger.error(`Error getting stats: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const me = await this.bot.telegram.getMe();
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
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ReaderTelegramBot;
