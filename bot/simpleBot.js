/**
 * Simple Telegram Bot for Reader App - Entry point and notifications
 * @file bot/simpleBot.js
 * @author Reader Bot Team
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

/**
 * Simple Telegram Bot Class
 * Provides basic entry point functionality and notifications
 */
class SimpleTelegramBot {
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      appWebAppUrl: config.appWebAppUrl || process.env.APP_WEBAPP_URL || 'https://app.unibotz.com/mini-app/',
      ...config
    };

    if (!this.config.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    logger.info('🤖 SimpleTelegramBot initialized');
  }

  /**
   * Initialize the bot with handlers
   */
  async initialize() {
    try {
      logger.info('🤖 Initializing SimpleTelegramBot...');
      
      this._setupCommands();
      this._setupMessageHandlers();
      this._setupErrorHandling();
      
      this.isInitialized = true;
      logger.info('✅ SimpleTelegramBot initialized successfully');
      
    } catch (error) {
      logger.error(`❌ Failed to initialize SimpleTelegramBot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup bot commands
   * @private
   */
  _setupCommands() {
    // /start command - welcome with inline button to Mini App
    this.bot.start(async (ctx) => {
      try {
        const welcomeMessage = `👋 Привет! Я Анна Бусел, ваш психолог и автор приложения Reader.

В этом приложении вы сможете сохранять и анализировать цитаты, получать инсайты и рекомендации.

Присоединяйтесь! Просто откройте мини-приложение через кнопку внизу Telegram.

Если возникнут вопросы по работе приложения — введите команду /help !`;

        await ctx.reply(welcomeMessage,);
        
        logger.info(`🤖 /start command handled for user ${ctx.from.id}`);
        
      } catch (error) {
        logger.error(`❌ Error in /start command: ${error.message}`);
        await ctx.reply('🤖 Добро пожаловать в Reader Bot! Нажмите на кнопку меню, чтобы открыть приложение.');
      }
    });

    // /help command - brief help
    this.bot.help(async (ctx) => {
      try {
        const helpMessage = `📖 *Reader Bot - Помощь*

Этот бот является точкой входа в приложение Reader.

*Основные возможности:*
• Открытие Mini App для работы с цитатами
• Получение уведомлений от приложения

*Команды:*
/start - Главное меню с кнопкой входа в приложение
/help - Эта справка

Для полноценной работы используйте кнопку "📱 Открыть приложение".`;

        await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
        
        logger.info(`🤖 /help command handled for user ${ctx.from.id}`);
        
      } catch (error) {
        logger.error(`❌ Error in /help command: ${error.message}`);
        await ctx.reply('📖 Используйте /start для входа в приложение или кнопку меню для навигации.');
      }
    });
  }

  /**
   * Setup message handlers
   * @private
   */
  _setupMessageHandlers() {
    // Handle all text messages
    this.bot.on('text', async (ctx) => {
      try {
        // Skip if it's a command
        if (ctx.message.text.startsWith('/')) {
          return;
        }

        const responseMessage = `🤖 Этот бот служит точкой входа в приложение Reader.

Для работы с цитатами, поиска и анализа используйте приложение.

Нажмите /start чтобы открыть приложение.`;

        const keyboard = Markup.inlineKeyboard([
          Markup.button.webApp('📱 Открыть приложение', this.config.appWebAppUrl)
        ]);

        await ctx.reply(responseMessage, keyboard);
        
        logger.info(`🤖 Text message handled for user ${ctx.from.id}`);
        
      } catch (error) {
        logger.error(`❌ Error handling text message: ${error.message}`);
        await ctx.reply('🤖 Используйте /start для входа в приложение.');
      }
    });
  }

  /**
   * Setup error handling
   * @private
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`❌ SimpleTelegramBot error for user ${ctx?.from?.id}:`, err);
      
      if (ctx && ctx.reply) {
        ctx.reply('🤖 Произошла ошибка. Попробуйте использовать /start для входа в приложение.')
          .catch(replyErr => {
            logger.error('❌ Failed to send error message:', replyErr);
          });
      }
    });
  }

  /**
   * Start the bot in polling mode (deprecated - use webhook in production)
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('✅ SimpleTelegramBot started successfully (polling mode)');
      
      // Graceful shutdown handlers
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`❌ Failed to start SimpleTelegramBot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get webhook callback for Express integration
   * @param {string} webhookPath - Path for webhook endpoint (e.g., '/api/telegram/webhook')
   * @returns {Function} Express middleware function
   */
  webhookCallback(webhookPath) {
    if (!this.isInitialized) {
      throw new Error('Bot must be initialized before creating webhook callback');
    }

    logger.info(`🔗 Creating webhook callback for path: ${webhookPath}`);
    return this.bot.webhookCallback(webhookPath);
  }

  /**
   * Set webhook URL for Telegram Bot API
   * @param {string} webhookUrl - Full webhook URL (e.g., 'https://yourdomain.com/api/telegram/webhook')
   * @returns {Promise<boolean>} Success status
   */
  async setWebhook(webhookUrl) {
    if (!this.isInitialized) {
      throw new Error('Bot must be initialized before setting webhook');
    }

    try {
      logger.info(`🔗 Setting webhook URL: ${webhookUrl}`);
      await this.bot.telegram.setWebhook(webhookUrl);
      logger.info('✅ Webhook set successfully');
      return true;
    } catch (error) {
      logger.error(`❌ Failed to set webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get webhook info from Telegram
   * @returns {Promise<Object>} Webhook info
   */
  async getWebhookInfo() {
    try {
      const info = await this.bot.telegram.getWebhookInfo();
      return info;
    } catch (error) {
      logger.error(`❌ Failed to get webhook info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete webhook (switch back to polling mode)
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebhook() {
    try {
      logger.info('🔗 Deleting webhook...');
      await this.bot.telegram.deleteWebhook();
      logger.info('✅ Webhook deleted successfully');
      return true;
    } catch (error) {
      logger.error(`❌ Failed to delete webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the bot
   * @param {string} signal - Stop signal
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`🔄 Stopping SimpleTelegramBot (${signal})...`);
      
      await this.bot.stop(signal);
      logger.info('✅ SimpleTelegramBot stopped successfully');
      
    } catch (error) {
      logger.error(`❌ Error stopping SimpleTelegramBot: ${error.message}`);
    }
  }

  /**
   * Send notification to user
   * @param {string|number} userId - Telegram user ID
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   * @param {string} options.parseMode - Parse mode (Markdown, HTML)
   * @returns {Promise<Object>} Send result
   */
  async sendNotification(userId, message, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Bot is not initialized');
      }

      const sendOptions = {};
      
      if (options.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendMessage(userId, message, sendOptions);
      
      logger.info(`✅ Notification sent to user ${userId}`);
      return { success: true, messageId: result.message_id };
      
    } catch (error) {
      logger.error(`❌ Failed to send notification to user ${userId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      const me = await this.bot.telegram.getMe();
      
      return {
        status: 'healthy',
        initialized: this.isInitialized,
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        config: {
          environment: this.config.environment,
          appWebAppUrl: this.config.appWebAppUrl
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`❌ Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        initialized: this.isInitialized,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get bot info
   * @returns {Object}
   */
  getBotInfo() {
    return {
      initialized: this.isInitialized,
      environment: this.config.environment,
      appWebAppUrl: this.config.appWebAppUrl,
      hasToken: !!this.config.token
    };
  }
}

module.exports = SimpleTelegramBot;
