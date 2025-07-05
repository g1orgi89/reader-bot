/**
 * Modern Telegram bot for Reader project with elegant UX design
 * @file telegram/modernBot.js
 * 🎨 VISUAL UX: Beautiful panels, modern navigation, elegant design
 * 📖 READER THEME: Book-focused design with Anna Busel persona
 * ✨ FEATURES: Smart classification, modern panels, achievements
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
          // Show modern main menu
          await this.navigationHandler.showMainMenu(ctx, userProfile);
        } else {
          // Start modern onboarding
          await this.onboardingHandler.handleStart(ctx);
        }
        
      } catch (error) {
        logger.error(`🎨 Error in /start: ${error.message}`);
        await this._sendFallbackMessage(ctx, 'start');
      }
    });

    // /menu - Modern navigation interface
    this.bot.command('menu', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          await this.navigationHandler.showMainMenu(ctx, userProfile);
        } else {
          await ctx.reply('📖 Пожалуйста, сначала пройдите регистрацию. Используйте /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /menu: ${error.message}`);
        await this._sendFallbackMessage(ctx, 'menu');
      }
    });

    // /help - Beautiful help interface
    this.bot.help(async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          await this.navigationHandler.showHelp(ctx);
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
          await this.navigationHandler.showStats(ctx);
        } else {
          await ctx.reply('📖 Сначала пройдите регистрацию: /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /stats: ${error.message}`);
        await ctx.reply('📊 Произошла ошибка при загрузке статистики. Попробуйте /menu');
      }
    });

    this.bot.command('diary', async (ctx) => {
      try {
        const userProfile = await UserProfile.findOne({ userId: ctx.from.id.toString() });
        if (userProfile && userProfile.isOnboardingComplete) {
          await this.navigationHandler.showDiary(ctx, 1);
        } else {
          await ctx.reply('📖 Сначала пройдите регистрацию: /start');
        }
      } catch (error) {
        logger.error(`🎨 Error in /diary: ${error.message}`);
        await ctx.reply('📚 Произошла ошибка при загрузке дневника. Попробуйте /menu');
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

        // Smart message classification
        const classification = await this.messageClassifier.classifyMessage(messageText, {
          userId,
          userProfile
        });

        logger.info(`🎨 Message classified as: ${classification.type} (${classification.confidence})`);

        // Route based on classification
        await this._routeClassifiedMessage(ctx, messageText, classification, userProfile);

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
        
        const nonTextResponse = `
╭─────────────────────────╮
│   📎 ФАЙЛЫ НЕ ПРИНИМАЮ  │
╰─────────────────────────╯

Спасибо за ${messageType}! Но я принимаю 
только текстовые цитаты.

💡 Если у вас есть интересная цитата 
   из изображения или документа, 
   пожалуйста, перепечатайте ее.

📝 Пример:
   "В каждом слове — целая жизнь"
   (Марина Цветаева)

┌─────────────────────────┐
│      КАК ОТПРАВИТЬ:     │
└─────────────────────────┘
✨ Просто напишите цитату текстом
📖 Укажите автора в скобках (если знаете)
🌟 Без фотографий и файлов`;

        await ctx.reply(nonTextResponse, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📖 Главное меню", callback_data: "nav_main" }],
              [{ text: "❓ Как пользоваться", callback_data: "nav_help" }]
            ]
          }
        });

      } catch (error) {
        logger.error(`🎨 Error processing non-text message: ${error.message}`);
        await ctx.reply('📖 Я принимаю только текстовые цитаты. Попробуйте написать текстом.');
      }
    });
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

        // Handle message classification callbacks
        if (callbackData.startsWith('classify_')) {
          await this._handleClassificationCallback(ctx, callbackData);
          return;
        }

        // Try navigation handler first
        if (await this.navigationHandler.handleCallback(ctx, callbackData)) {
          await ctx.answerCbQuery(); // Acknowledge callback
          return;
        }

        // Try onboarding handler
        if (await this.onboardingHandler.handleCallback(ctx)) {
          await ctx.answerCbQuery();
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
   * Route classified message to appropriate handler
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Original message
   * @param {Object} classification - Classification result
   * @param {Object} userProfile - User profile
   */
  async _routeClassifiedMessage(ctx, messageText, classification, userProfile) {
    try {
      switch (classification.type) {
        case 'quote':
          await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
          break;

        case 'question':
        case 'complex_question':
          await this._handleQuestion(ctx, messageText, userProfile);
          break;

        case 'ambiguous':
          await this._handleAmbiguousMessage(ctx, messageText, classification);
          break;

        default:
          await this._handleGeneralMessage(ctx, messageText, userProfile);
          break;
      }
    } catch (error) {
      logger.error(`🎨 Error routing classified message: ${error.message}`);
      await this._sendErrorMessage(ctx, error);
    }
  }

  /**
   * Handle ambiguous messages with user clarification
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Original message
   * @param {Object} classification - Classification result
   */
  async _handleAmbiguousMessage(ctx, messageText, classification) {
    try {
      const userId = ctx.from.id.toString();
      
      // Store for later processing
      this.pendingClassifications.set(userId, {
        message: messageText,
        timestamp: Date.now(),
        classification
      });

      const clarificationPanel = `
╭─────────────────────────╮
│   🤔 УТОЧНИТЕ, ПОЖАЛУЙСТА │
╰─────────────────────────╯

Ваше сообщение:
"${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"

💭 Я не совсем понял, что вы хотели:

┌─────────────────────────┐
│     ЭТО ЦИТАТА ИЛИ      │
│       ВОПРОС?           │
└─────────────────────────┘

Помогите мне понять, чтобы я мог 
лучше вам ответить.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📖 Это цитата", callback_data: "classify_quote_confirm" },
            { text: "❓ Это вопрос", callback_data: "classify_question_confirm" }
          ],
          [
            { text: "❌ Отменить", callback_data: "classify_cancel" }
          ]
        ]
      };

      await ctx.reply(clarificationPanel, { reply_markup: keyboard });

      // Auto-cleanup after 5 minutes
      setTimeout(() => {
        if (this.pendingClassifications.has(userId)) {
          this.pendingClassifications.delete(userId);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.error(`🎨 Error handling ambiguous message: ${error.message}`);
      await this._handleGeneralMessage(ctx, messageText, userProfile);
    }
  }

  /**
   * Handle classification callbacks
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   */
  async _handleClassificationCallback(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      
      if (callbackData === 'classify_cancel') {
        this.pendingClassifications.delete(userId);
        await ctx.editMessageText('📖 Отменено. Попробуйте еще раз, если нужно.');
        await ctx.answerCbQuery('❌ Отменено');
        return;
      }

      const pendingMessage = this.pendingClassifications.get(userId);
      if (!pendingMessage) {
        await ctx.answerCbQuery('⏰ Время истекло, попробуйте еще раз');
        return;
      }

      const userProfile = await UserProfile.findOne({ userId });
      const messageText = pendingMessage.message;
      
      if (callbackData === 'classify_quote_confirm') {
        await ctx.editMessageText('📖 Обрабатываю как цитату...');
        await ctx.answerCbQuery('✅ Принято как цитата');
        
        await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
        
      } else if (callbackData === 'classify_question_confirm') {
        await ctx.editMessageText('💬 Обрабатываю как вопрос...');
        await ctx.answerCbQuery('✅ Принято как вопрос');
        
        await this._handleQuestion(ctx, messageText, userProfile);
      }
      
      this.pendingClassifications.delete(userId);
      
    } catch (error) {
      logger.error(`🎨 Error handling classification callback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
    }
  }

  /**
   * Handle questions from users
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Question text
   * @param {Object} userProfile - User profile
   */
  async _handleQuestion(ctx, messageText, userProfile) {
    try {
      // For now, provide a helpful response and offer to contact Anna
      const questionResponse = `
╭─────────────────────────╮
│     💬 ВАШ ВОПРОС       │
╰─────────────────────────╯

Спасибо за вопрос! Я передам его 
Анне для персонального ответа.

┌─────────────────────────┐
│    АННА СВЯЖЕТСЯ С      │
│    ВАМИ ЧЕРЕЗ:          │
└─────────────────────────┘
📧 Email: ${userProfile.email}
📱 Telegram: @${userProfile.telegramUsername || ctx.from.username}

⏰ Обычно отвечает в течение 24 часов

💡 А пока можете:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📚 Посмотреть дневник", callback_data: "nav_diary" },
            { text: "💎 Рекомендации", callback_data: "nav_recommendations" }
          ],
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" },
            { text: "📖 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await ctx.reply(questionResponse, { reply_markup: keyboard });

      // TODO: Integrate with ticketing system for complex questions
      
    } catch (error) {
      logger.error(`🎨 Error handling question: ${error.message}`);
      await ctx.reply('💬 Спасибо за вопрос! Анна ответит в ближайшее время.');
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
      const generalResponse = `
╭─────────────────────────╮
│    💭 ПОНЯЛ ВАС!        │
╰─────────────────────────╯

Спасибо за сообщение! 

Если это была цитата, попробуйте 
отправить ее еще раз в таком формате:

📝 "Текст цитаты" (Автор)
или просто: Текст цитаты

┌─────────────────────────┐
│     ЧТО МОЖНО ДЕЛАТЬ:   │
└─────────────────────────┘`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" },
            { text: "❓ Помощь", callback_data: "nav_help" }
          ],
          [
            { text: "📖 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await ctx.reply(generalResponse, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`🎨 Error handling general message: ${error.message}`);
      await ctx.reply('📖 Спасибо за сообщение! Используйте /menu для навигации.');
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
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Попробовать снова", callback_data: "nav_main" }],
            [{ text: "❓ Помощь", callback_data: "nav_help" }]
          ]
        }
      });
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
      await ctx.reply(message);
      
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
      const reminderMessage = `
╭─────────────────────────╮
│   📋 НУЖНА РЕГИСТРАЦИЯ  │
╰─────────────────────────╯

Для использования бота необходимо 
пройти быструю регистрацию.

💡 Это займет всего 2 минуты!

┌─────────────────────────┐
│      ЧТО ПОЛУЧИТЕ:      │
└─────────────────────────┘
📚 Персональный дневник цитат
📊 Еженедельные отчеты от Анны
💎 Рекомендации книг специально для вас
🏆 Достижения и статистику`;

      await ctx.reply(reminderMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Начать регистрацию", callback_data: "start_beautiful_test" }]
          ]
        }
      });
      
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
      const helpMessage = `
╭─────────────────────────╮
│    📖 О ПРОЕКТЕ         │
╰─────────────────────────╯

«Читатель» - персональный дневник 
цитат с AI-анализом от психолога 
Анны Бусел.

┌─────────────────────────┐
│      КАК РАБОТАЕТ:      │
└─────────────────────────┘
1️⃣ Отправляете боту цитаты
2️⃣ ИИ анализирует ваши интересы
3️⃣ Получаете персональные отчеты
4️⃣ Анна рекомендует подходящие книги

💡 Для начала работы нужна регистрация:`;

      await ctx.reply(helpMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Пройти регистрацию", callback_data: "start_beautiful_test" }]
          ]
        }
      });
      
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
      const errorPanel = `
╭─────────────────────────╮
│      ❌ ОШИБКА         │
╰─────────────────────────╯

Произошла ошибка при обработке 
вашего сообщения.

💡 Попробуйте:
• Перефразировать сообщение
• Использовать /menu для навигации
• Обратиться в поддержку`;

      await ctx.reply(errorPanel, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Попробовать снова", callback_data: "nav_main" }],
            [{ text: "💬 Поддержка", callback_data: "nav_contact" }]
          ]
        }
      });
      
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
      logger.info('🎨 ModernReaderBot started successfully with elegant UX design');
      
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
      this.navigationHandler.cleanup();
      this.onboardingHandler.cleanup();
      this.quoteHandler.cleanup();
      
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
          navigation: this.navigationHandler.getStats(),
          onboarding: this.onboardingHandler.getStats(),
          quotes: this.quoteHandler.getStats(),
          classification: this.messageClassifier.getStats()
        },
        features: {
          modernUX: true,
          visualPanels: true,
          smartClassification: true,
          ambiguityResolution: true,
          elegantDesign: true,
          beautifulOnboarding: true,
          modernNavigation: true,
          enhancedQuotes: true
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
          navigationActive: this.navigationHandler.userStates?.size || 0,
          onboardingActive: this.onboardingHandler.userStates?.size || 0,
          pendingClassifications: this.pendingClassifications.size,
          modernUXEnabled: this.config.enableModernUX
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
      this.navigationHandler.cleanup();
      this.onboardingHandler.cleanup();
      this.quoteHandler.cleanup();
      
      // Clear pending classifications
      this.pendingClassifications.clear();
      
      logger.info('🎨 ModernReaderBot cleanup completed');
    } catch (error) {
      logger.error(`🎨 Error during cleanup: ${error.message}`);
    }
  }
}

module.exports = ModernReaderBot;