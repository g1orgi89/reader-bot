/**
 * Modern Telegram bot for Reader project with elegant UX design
 * @file telegram/modernBot.js
 * 🎨 VISUAL UX: Beautiful panels, modern navigation, elegant design
 * 📖 READER THEME: Book-focused design with Anna Busel persona
 * ✨ FEATURES: Smart classification, modern panels, achievements
 * 📋 MENU BUTTON: Modern navigation with menu button
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Import Reader bot services
const claudeService = require('../server/services/claude');

// Import Reader bot models
const { UserProfile, Quote } = require('../server/models');

// Import modern handlers
const { ModernNavigationHandler } = require('./handlers/modernNavigationHandler');
const { ModernOnboardingHandler } = require('./handlers/modernOnboardingHandler');
const { ModernQuoteHandler } = require('./handlers/modernQuoteHandler');
const { MessageClassifier } = require('./helpers/messageClassifier');

/**
 * @typedef {Object} ModernReaderBotConfig
 * @property {string} token - Telegram bot token
 * @property {string} [environment] - Environment (development/production)
 * @property {boolean} [enableModernUX] - Enable modern UX features
 */

/**
 * @class ModernReaderBot
 * @description Modern Telegram bot with elegant UX for Reader project
 */
class ModernReaderBot {
  /**
   * @constructor
   * @param {ModernReaderBotConfig} config - Bot configuration
   */
  constructor(config) {
    this.config = {
      token: config.token,
      environment: config.environment || 'production',
      enableModernUX: config.enableModernUX !== false, // enabled by default
      platform: 'telegram',
      maxQuotesPerDay: 10
    };

    this.bot = new Telegraf(this.config.token);
    this.isInitialized = false;
    
    // Initialize modern handlers
    this.navigationHandler = new ModernNavigationHandler();
    this.onboardingHandler = new ModernOnboardingHandler();
    this.quoteHandler = new ModernQuoteHandler();
    this.messageClassifier = new MessageClassifier();
    
    // Store pending message classifications
    this.pendingClassifications = new Map();
    
    logger.info('🎨 ModernReaderBot constructor initialized with elegant UX design');
  }

  /**
   * Initialize the modern bot
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // 📋 SETUP MENU BUTTON FIRST
      await this.onboardingHandler.setupMenuButton(this.bot);
      logger.info('📋 Menu button and commands configured');
      
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
      logger.info('🎨 ModernReaderBot initialized successfully with elegant UX');
    } catch (error) {
      logger.error(`🎨 Failed to initialize ModernReaderBot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup middleware for modern UX
   * @private
   */
  _setupMiddleware() {
    // Logging middleware with emoji indicators
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const userId = ctx.from?.id;
      const messageType = ctx.message?.text ? '💬' : ctx.callbackQuery ? '🔘' : '📎';
      const content = ctx.message?.text?.substring(0, 30) || 
                     ctx.callbackQuery?.data || 'non-text';
      
      logger.info(`🎨 ${messageType} User ${userId}: "${content}..."`);
      
      await next();
      
      const duration = Date.now() - start;
      logger.info(`🎨 ✅ Response sent to ${userId} in ${duration}ms`);
    });

    // Modern typing indicators
    this.bot.use(async (ctx, next) => {
      if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
        await ctx.sendChatAction('typing');
        
        // Smart delay based on message complexity
        const messageLength = ctx.message.text.length;
        const delay = Math.min(2000, Math.max(800, messageLength * 20));
        
        setTimeout(async () => {
          await next();
        }, delay);
      } else {
        await next();
      }
    });

    // User state tracking for modern navigation
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id?.toString();
      if (userId) {
        // Update last seen
        await this._updateUserActivity(userId);
      }
      await next();
    });
  }

  /**
   * Setup modern command handlers
   * @private
   */
  _setupCommands() {
    // /start - Modern onboarding or navigation
    this.bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        logger.info(`🎨 /start command for user ${userId}`);
        
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          // Show simple welcome back message
          await ctx.reply(
            '📖 Добро пожаловать обратно!\n\n' +
            '💡 Используйте кнопку меню 📋 (рядом с прикреплением файлов) для навигации'
          );
        } else {
          // Start modern onboarding
          await this.onboardingHandler.handleStart(ctx);
        }
        
      } catch (error) {
        logger.error(`🎨 Error in /start: ${error.message}`);
        await this._sendFallbackMessage(ctx, 'start');
      }
    });

    // /help - Beautiful help interface
    this.bot.help(async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          const helpMessage = 
            '📖 **Справка по боту «Читатель»**\n\n' +
            '🎯 **Главная функция:**\n' +
            'Отправляйте мне цитаты текстом, и я сохраню их в ваш персональный дневник.\n\n' +
            '📝 **Формат цитат:**\n' +
            '• Просто текст: "Мудрая мысль"\n' +
            '• С автором: "Цитата" (Автор)\n' +
            '• Лимит: 10 цитат в день\n\n' +
            '📋 **Команды (через меню кнопку):**\n' +
            '• 📊 /stats - Ваша статистика\n' +
            '• 🔍 /search - Поиск по цитатам\n' +
            '• ⚙️ /settings - Настройки\n\n' +
            '📊 **Отчеты:**\n' +
            '• Еженедельно (воскресенье, 11:00)\n' +
            '• Анализ от Анны Бусел\n' +
            '• Рекомендации книг\n' +
            '• Промокоды\n\n' +
            '💡 **Навигация:**\n' +
            'Используйте кнопку меню 📋 рядом с прикреплением файлов';

          await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
        } else {
          await this._sendOnboardingHelp(ctx);
        }
      } catch (error) {
        logger.error(`🎨 Error in /help: ${error.message}`);
        await this._sendFallbackMessage(ctx, 'help');
      }
    });

    // Quick access commands for power users
    this.bot.command('stats', async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        if (userProfile && userProfile.isOnboardingComplete) {
          await this._showStats(ctx, userProfile);
        } else {
          await ctx.reply('📖 Сначала пройдите регистрацию: /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /stats: ${error.message}`);
        await ctx.reply('📊 Произошла ошибка при загрузке статистики. Попробуйте /start');
      }
    });

    this.bot.command('search', async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        if (userProfile && userProfile.isOnboardingComplete) {
          await this._showSearch(ctx);
        } else {
          await ctx.reply('📖 Сначала пройдите регистрацию: /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /search: ${error.message}`);
        await ctx.reply('🔍 Произошла ошибка при поиске. Попробуйте /start');
      }
    });

    this.bot.command('settings', async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        if (userProfile && userProfile.isOnboardingComplete) {
          await this._showSettings(ctx, userProfile);
        } else {
          await ctx.reply('📖 Сначала пройдите регистрацию: /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /settings: ${error.message}`);
        await ctx.reply('⚙️ Произошла ошибка при загрузке настроек. Попробуйте /start');
      }
    });
  }

  /**
   * Setup modern message handlers with smart classification
   * @private
   */
  _setupMessageHandlers() {
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();

        // Skip commands
        if (messageText.startsWith('/')) return;

        logger.info(`🎨 Processing text: "${messageText.substring(0, 50)}..."`);

        // Check if user is in onboarding
        if (await this.onboardingHandler.handleTextMessage(ctx)) {
          return; // Handled by onboarding
        }

        // Check if user completed onboarding
        const userProfile = await UserProfile.findOne({ userId });
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await this._sendOnboardingReminder(ctx);
          return;
        }

        // Simple quote detection and handling
        if (this._isQuote(messageText)) {
          await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
          return;
        }

        // Handle as general message
        await this._handleGeneralMessage(ctx, messageText, userProfile);

      } catch (error) {
        logger.error(`🎨 Error processing text message: ${error.message}`);
        await this._sendErrorMessage(ctx, error);
      }
    });

    // Handle non-text messages with beautiful responses
    this.bot.on(['photo', 'document', 'voice', 'video', 'sticker', 'audio'], async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (!userProfile || !userProfile.isOnboardingComplete) {
          await this._sendOnboardingReminder(ctx);
          return;
        }

        const messageType = this._getMessageType(ctx.message);
        
        const nonTextResponse = 
          '📎 Спасибо за ' + messageType + '! Но я принимаю только текстовые цитаты.\n\n' +
          '💡 Если у вас есть интересная цитата из изображения или документа, ' +
          'пожалуйста, перепечатайте ее текстом.\n\n' +
          '📝 Пример: "В каждом слове — целая жизнь" (Марина Цветаева)\n\n' +
          '📋 Используйте кнопку меню для навигации';

        await ctx.reply(nonTextResponse);

      } catch (error) {
        logger.error(`🎨 Error processing non-text message: ${error.message}`);
        await ctx.reply('📖 Я принимаю только текстовые цитаты. Попробуйте написать текстом.');
      }
    });
  }

  /**
   * Simple quote detection
   * @private
   */
  _isQuote(text) {
    // Simple heuristics for quote detection
    if (text.length < 10) return false;
    if (text.length > 1000) return false;
    
    // Has quotes or parentheses
    if (text.includes('"') || text.includes('(') || text.includes('—')) return true;
    
    // Philosophical/wisdom words
    const wisdomWords = ['жизнь', 'любовь', 'счастье', 'мудрость', 'душа', 'сердце', 'путь', 'цель', 'смысл'];
    const lowerText = text.toLowerCase();
    if (wisdomWords.some(word => lowerText.includes(word))) return true;
    
    // Default to treating meaningful text as potential quotes
    return text.length > 20;
  }

  /**
   * Setup modern callback handlers
   * @private
   */
  _setupCallbackHandlers() {
    this.bot.on('callback_query', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const callbackData = ctx.callbackQuery.data;
        
        logger.info(`🎨 Callback: ${callbackData} from user ${userId}`);

        // Try onboarding handler first
        if (await this.onboardingHandler.handleCallback(ctx)) {
          await ctx.answerCbQuery();
          return;
        }

        // Handle settings callbacks
        if (callbackData.startsWith('settings_')) {
          await this._handleSettingsCallback(ctx, callbackData);
          return;
        }

        // Handle unknown callbacks gracefully
        logger.warn(`🎨 Unhandled callback: ${callbackData}`);
        await ctx.answerCbQuery('🎨 Эта функция пока недоступна');

      } catch (error) {
        logger.error(`🎨 Error handling callback: ${error.message}`);
        await ctx.answerCbQuery('❌ Произошла ошибка');
      }
    });
  }

  /**
   * Show user statistics
   * @private
   */
  async _showStats(ctx, userProfile) {
    try {
      const totalQuotes = await Quote.countDocuments({ userId: userProfile.userId });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({ 
        userId: userProfile.userId, 
        createdAt: { $gte: today } 
      });

      const daysWithBot = Math.floor((Date.now() - userProfile.registeredAt.getTime()) / (1000 * 60 * 60 * 24));

      const statsMessage = 
        `📊 **Ваша статистика, ${userProfile.name}**\n\n` +
        `📖 Цитат собрано: ${totalQuotes}\n` +
        `📅 Сегодня добавлено: ${todayQuotes}\n` +
        `🔥 Текущая серия: ${userProfile.statistics.currentStreak} дней\n` +
        `⭐ Рекорд серии: ${userProfile.statistics.longestStreak} дней\n` +
        `🕐 С ботом: ${daysWithBot} дней\n\n` +
        `🏆 Достижения: ${userProfile.achievements.length}\n\n` +
        `📧 Email: ${userProfile.email}\n` +
        `📱 Источник: ${userProfile.source}`;

      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Error showing stats: ${error.message}`);
      await ctx.reply('📊 Произошла ошибка при загрузке статистики');
    }
  }

  /**
   * Show search interface
   * @private
   */
  async _showSearch(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const quotes = await Quote.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);

      if (quotes.length === 0) {
        await ctx.reply('🔍 У вас пока нет сохраненных цитат. Отправьте первую!');
        return;
      }

      let searchText = '🔍 **Ваши последние цитаты:**\n\n';
      quotes.forEach((quote, index) => {
        const author = quote.author ? ` (${quote.author})` : '';
        const shortText = quote.text.length > 100 ? quote.text.substring(0, 100) + '...' : quote.text;
        searchText += `${index + 1}. "${shortText}"${author}\n\n`;
      });

      await ctx.reply(searchText, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Error showing search: ${error.message}`);
      await ctx.reply('🔍 Произошла ошибка при поиске');
    }
  }

  /**
   * Show settings interface
   * @private
   */
  async _showSettings(ctx, userProfile) {
    try {
      const settingsMessage = 
        `⚙️ **Настройки бота**\n\n` +
        `👤 Имя: ${userProfile.name}\n` +
        `📧 Email: ${userProfile.email}\n` +
        `🔔 Напоминания: ${userProfile.settings.reminderEnabled ? 'Включены' : 'Выключены'}\n` +
        `⏰ Время: ${userProfile.settings.reminderTimes.join(', ')}\n\n` +
        `Выберите, что хотите изменить:`;

      const keyboard = {
        inline_keyboard: [
          [{ 
            text: userProfile.settings.reminderEnabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания',
            callback_data: 'settings_toggle_reminders'
          }],
          [{ text: '⏰ Изменить время напоминаний', callback_data: 'settings_change_time' }]
        ]
      };

      await ctx.reply(settingsMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      });
    } catch (error) {
      logger.error(`Error showing settings: ${error.message}`);
      await ctx.reply('⚙️ Произошла ошибка при загрузке настроек');
    }
  }

  /**
   * Handle settings callbacks
   * @private
   */
  async _handleSettingsCallback(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      
      if (callbackData === 'settings_toggle_reminders') {
        const userProfile = await UserProfile.findOne({ userId });
        const newState = !userProfile.settings.reminderEnabled;
        
        await UserProfile.findOneAndUpdate(
          { userId },
          { 'settings.reminderEnabled': newState }
        );

        const message = newState ? 
          '🔔 Напоминания включены' : 
          '🔕 Напоминания выключены';
          
        await ctx.answerCbQuery(message);
        
        // Refresh settings display
        const updatedProfile = await UserProfile.findOne({ userId });
        await this._showSettings(ctx, updatedProfile);
      }
    } catch (error) {
      logger.error(`Error handling settings callback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
    }
  }

  /**
   * Handle general messages
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Message text
   * @param {Object} userProfile - User profile
   */
  async _handleGeneralMessage(ctx, messageText, userProfile) {
    try {
      const generalResponse = 
        '📖 Спасибо за сообщение!\n\n' +
        'Если это была цитата, попробуйте отправить ее еще раз в таком формате:\n\n' +
        '📝 "Текст цитаты" (Автор)\n' +
        'или просто: Текст цитаты\n\n' +
        '💡 Используйте кнопку меню 📋 для навигации';

      await ctx.reply(generalResponse);
      
    } catch (error) {
      logger.error(`🎨 Error handling general message: ${error.message}`);
      await ctx.reply('📖 Спасибо за сообщение! Используйте кнопку меню 📋 для навигации.');
    }
  }

  /**
   * Setup modern error handling
   * @private
   */
  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`🎨 Bot error: ${err.message}`);
      
      let errorMessage = '🎨 Упс! Что-то пошло не так. Попробуйте еще раз.';
      
      if (err.code === 429) {
        errorMessage = '⏰ Слишком много запросов. Подождите немного.';
      } else if (err.code === 403) {
        errorMessage = '🚫 Нет доступа. Проверьте настройки бота.';
      }

      this._sendFallbackError(ctx, errorMessage)
        .catch(sendError => {
          logger.error(`🎨 Failed to send error message: ${sendError.message}`);
        });
    });
  }

  /**
   * Send fallback error message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} message - Error message
   */
  async _sendFallbackError(ctx, message) {
    try {
      await ctx.reply(message + '\n\n📋 Используйте кнопку меню для навигации');
    } catch (error) {
      logger.error(`🎨 Failed to send fallback error: ${error.message}`);
    }
  }

  /**
   * Send fallback message for failed commands
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} command - Failed command
   */
  async _sendFallbackMessage(ctx, command) {
    try {
      const fallbackMessages = {
        start: '📖 Здравствуйте! Добро пожаловать в «Читатель» - ваш персональный дневник цитат от Анны Бусел.',
        menu: '📖 Главное меню временно недоступно. Попробуйте /start',
        help: '📖 Справка: отправляйте мне цитаты, и я сохраню их в ваш личный дневник!'
      };

      const message = fallbackMessages[command] || fallbackMessages.start;
      await ctx.reply(message + '\n\n📋 Используйте кнопку меню для навигации');
      
    } catch (error) {
      logger.error(`🎨 Failed to send fallback message: ${error.message}`);
    }
  }

  /**
   * Send onboarding reminder
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _sendOnboardingReminder(ctx) {
    try {
      const reminderMessage = 
        '📋 Для использования бота необходимо пройти быструю регистрацию.\n\n' +
        '💡 Это займет всего 2 минуты!\n\n' +
        '📚 Что получите:\n' +
        '• Персональный дневник цитат\n' +
        '• Еженедельные отчеты от Анны\n' +
        '• Рекомендации книг специально для вас\n' +
        '• Достижения и статистику\n\n' +
        'Используйте /start для начала регистрации';

      await ctx.reply(reminderMessage);
      
    } catch (error) {
      logger.error(`🎨 Error sending onboarding reminder: ${error.message}`);
      await ctx.reply('📖 Пожалуйста, пройдите регистрацию командой /start');
    }
  }

  /**
   * Send onboarding help
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _sendOnboardingHelp(ctx) {
    try {
      const helpMessage = 
        '📖 **О проекте «Читатель»**\n\n' +
        '«Читатель» - персональный дневник цитат с AI-анализом от психолога Анны Бусел.\n\n' +
        '**Как работает:**\n' +
        '1️⃣ Отправляете боту цитаты\n' +
        '2️⃣ ИИ анализирует ваши интересы\n' +
        '3️⃣ Получаете персональные отчеты\n' +
        '4️⃣ Анна рекомендует подходящие книги\n\n' +
        'Для начала работы используйте /start';

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error(`🎨 Error sending onboarding help: ${error.message}`);
      await ctx.reply('📖 Используйте /start для начала работы с ботом');
    }
  }

  /**
   * Get message type description
   * @private
   * @param {Object} message - Telegram message
   * @returns {string} - Message type
   */
  _getMessageType(message) {
    if (message.photo) return 'фотографию';
    if (message.document) return 'документ';
    if (message.voice) return 'голосовое сообщение';
    if (message.video) return 'видео';
    if (message.audio) return 'аудио';
    if (message.sticker) return 'стикер';
    return 'файл';
  }

  /**
   * Update user activity
   * @private
   * @param {string} userId - User ID
   */
  async _updateUserActivity(userId) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { lastActivity: new Date() },
        { upsert: false }
      );
    } catch (error) {
      // Silently fail - not critical
      logger.debug(`🎨 Failed to update user activity: ${error.message}`);
    }
  }

  /**
   * Send error message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Error} error - Error object
   */
  async _sendErrorMessage(ctx, error) {
    try {
      const errorMessage = 
        '❌ Произошла ошибка при обработке вашего сообщения.\n\n' +
        '💡 Попробуйте:\n' +
        '• Перефразировать сообщение\n' +
        '• Использовать кнопку меню 📋 для навигации\n' +
        '• Обратиться в поддержку';

      await ctx.reply(errorMessage);
      
    } catch (sendError) {
      logger.error(`🎨 Failed to send error message: ${sendError.message}`);
      await ctx.reply('❌ Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Start the modern bot
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.bot.launch();
      logger.info('🎨 ModernReaderBot started successfully with menu button navigation');
      
      // Graceful stop handlers
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
      
    } catch (error) {
      logger.error(`🎨 Failed to start ModernReaderBot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the modern bot
   * @param {string} [signal] - Stop signal
   * @returns {Promise<void>}
   */
  async stop(signal = 'manual') {
    try {
      logger.info(`🎨 Stopping ModernReaderBot (${signal})...`);
      
      // Cleanup handlers
      if (this.navigationHandler && this.navigationHandler.cleanup) {
        this.navigationHandler.cleanup();
      }
      if (this.onboardingHandler && this.onboardingHandler.cleanupStaleStates) {
        this.onboardingHandler.cleanupStaleStates();
      }
      if (this.quoteHandler && this.quoteHandler.cleanup) {
        this.quoteHandler.cleanup();
      }
      
      // Clear pending classifications
      this.pendingClassifications.clear();
      
      await this.bot.stop(signal);
      logger.info('🎨 ModernReaderBot stopped successfully');
    } catch (error) {
      logger.error(`🎨 Error stopping bot: ${error.message}`);
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
        parse_mode: options.parseMode || 'HTML',
        reply_markup: options.replyMarkup,
        disable_web_page_preview: options.disablePreview !== false
      });
      
      logger.info(`🎨 Message sent to user ${userId}`);
    } catch (error) {
      logger.error(`🎨 Failed to send message to user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get modern bot statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const me = await this.bot.telegram.getMe();
      
      // Modern bot specific stats
      const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
      const totalQuotes = await Quote.countDocuments();
      
      // Today's activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({ createdAt: { $gte: today } });
      const activeUsers = await Quote.distinct('userId', { createdAt: { $gte: today } });

      return {
        botInfo: {
          id: me.id,
          username: me.username,
          firstName: me.first_name
        },
        config: {
          environment: this.config.environment,
          enableModernUX: this.config.enableModernUX,
          platform: this.config.platform,
          maxQuotesPerDay: this.config.maxQuotesPerDay
        },
        status: {
          initialized: this.isInitialized,
          uptime: process.uptime(),
          pendingClassifications: this.pendingClassifications.size
        },
        readerStats: {
          totalUsers,
          totalQuotes,
          averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0,
          todayQuotes,
          activeUsersToday: activeUsers.length
        },
        modernFeatures: {
          menuButton: true,
          modernUX: true,
          cleanDesign: true,
          simpleNavigation: true
        }
      };
    } catch (error) {
      logger.error(`🎨 Error getting bot stats: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Health check for the modern bot
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
        modernHandlers: {
          initialized: this.isInitialized,
          onboardingActive: this.onboardingHandler.userStates?.size || 0,
          pendingClassifications: this.pendingClassifications.size,
          modernUXEnabled: this.config.enableModernUX,
          menuButtonEnabled: true
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`🎨 Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      // Cleanup handlers
      if (this.navigationHandler && this.navigationHandler.cleanup) {
        this.navigationHandler.cleanup();
      }
      if (this.onboardingHandler && this.onboardingHandler.cleanupStaleStates) {
        this.onboardingHandler.cleanupStaleStates();
      }
      if (this.quoteHandler && this.quoteHandler.cleanup) {
        this.quoteHandler.cleanup();
      }
      
      // Clear pending classifications
      this.pendingClassifications.clear();
      
      logger.info('🎨 ModernReaderBot cleanup completed');
    } catch (error) {
      logger.error(`🎨 Error during cleanup: ${error.message}`);
    }
  }
}

module.exports = ModernReaderBot;
