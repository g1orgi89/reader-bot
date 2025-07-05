/**
 * Main Telegram bot for Reader project - Personal quotes diary with AI analysis
 * @file telegram/index.js
 * 📖 READER BOT: Transformed from Shrooms for Anna Busel's book club
 * 📖 UPDATED: Complete integration with all handlers (Quote, Command, ComplexQuestion)
 * 📖 ADDED: Full Day 13-14 functionality with AI analysis and achievements
 * 📖 ADDED: WeeklyReportHandler integration and feedback support
 * 📖 ADDED: MonthlyReportService and FeedbackHandler integration (Day 18-19)
 * 📖 ADDED: NavigationHandler for modern UX with visual panels
 * 📖 ADDED: MessageClassifier integration for smart quote vs question detection
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
const { FeedbackHandler } = require('./handlers/feedbackHandler');
const { NavigationHandler } = require('./handlers/navigationHandler');
const { MessageClassifier } = require('./helpers/messageClassifier'); // NEW: Smart classifier
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
    this.feedbackHandler = new FeedbackHandler();
    this.navigationHandler = new NavigationHandler();
    this.messageClassifier = new MessageClassifier(); // NEW: Smart message classification
    
    // External services will be set externally
    this.weeklyReportHandler = null;
    this.monthlyReportService = null;
    
    // Store pending ambiguous messages for resolution
    this.pendingClassifications = new Map(); // userId -> { message, timestamp }
    
    logger.info('📖 ReaderTelegramBot constructor initialized with MessageClassifier for smart quote/question detection');
  }

  /**
   * Set external services (called from start.js)
   * @param {Object} services - External services
   * @param {Object} services.weeklyReportHandler - WeeklyReportHandler instance
   * @param {Object} services.monthlyReportService - MonthlyReportService instance
   */
  setExternalServices(services) {
    this.weeklyReportHandler = services.weeklyReportHandler;
    this.monthlyReportService = services.monthlyReportService;
    
    logger.info('📖 External services integrated into main bot');
  }

  /**
   * Initialize the Reader bot
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Initialize all handlers with dependencies
      await this._initializeHandlers();
      
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
      logger.info('📖 Reader Telegram bot initialized successfully with smart message classification system');
    } catch (error) {
      logger.error(`📖 Failed to initialize Reader Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize all handlers with dependencies
   * @private
   */
  async _initializeHandlers() {
    const models = require('../server/models');
    
    // Initialize FeedbackHandler
    this.feedbackHandler.initialize({
      bot: this.bot,
      models
    });
    
    logger.info('📖 All handlers initialized with dependencies including MessageClassifier');
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
      
      logger.info(`📖 Message from user ${userId}: \"${messageText}...\"`);
      
      await next();
      
      const duration = Date.now() - start;
      logger.info(`📖 Response sent to user ${userId} in ${duration}ms`);
    });

    // User state handling middleware
    this.bot.use(async (ctx, next) => {
      // Check for user states and handle accordingly
      if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
        const userId = ctx.from.id.toString();
        const userState = await this.feedbackHandler.getUserState(userId);
        
        if (userState) {
          await this._handleUserStateMessage(ctx, userState);
          return;
        }
      }
      
      await next();
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
   * Handle messages from users in specific states
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} userState - Current user state
   */
  async _handleUserStateMessage(ctx, userState) {
    const userId = ctx.from.id.toString();
    const messageText = ctx.message.text;

    try {
      // Handle monthly survey responses
      if (userState === 'awaiting_monthly_survey') {
        await ctx.reply("📝 Пожалуйста, выберите тему из предложенных кнопок выше.");
        return;
      }

      // Handle detailed feedback responses
      if (userState.startsWith('awaiting_feedback_')) {
        const parts = userState.split('_');
        const type = parts[2]; // weekly/monthly
        const reportId = parts.slice(3).join('_');
        
        await this.feedbackHandler.processDetailedFeedback(ctx, messageText, reportId, type);
        return;
      }

      // Clear unknown states
      await this.feedbackHandler.clearUserState(userId);
      
    } catch (error) {
      logger.error(`📖 Error handling user state message: ${error.message}`, error);
      await this.feedbackHandler.clearUserState(userId);
    }
  }

  /**
   * Setup command handlers
   * @private
   */
  _setupCommands() {
    // /start command - Begin onboarding or show modern navigation
    this.bot.start(async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        logger.info(`📖 Processing /start command for user ${userId}`);
        
        // Check if user completed onboarding
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          // Show modern navigation interface
          await this.navigationHandler.showMainMenu(ctx, userProfile);
        } else {
          // Start onboarding process
          await this.onboardingHandler.handleStart(ctx);
        }
        
      } catch (error) {
        logger.error(`📖 Error in /start command: ${error.message}`);
        await ctx.reply(`📖 Здравствуйте! Добро пожаловать в «Читатель» - ваш персональный дневник цитат от Анны Бусел.`);
      }
    });

    // /menu command - Show navigation interface
    this.bot.command('menu', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          await this.navigationHandler.showMainMenu(ctx, userProfile);
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /menu command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при загрузке меню. Попробуйте /start');
      }
    });

    // /help command
    this.bot.help(async (ctx) => {
      try {
        await this.commandHandler.handleHelp(ctx);
      } catch (error) {
        logger.error(`📖 Error in /help command: ${error.message}`);
        await ctx.reply('📖 Я могу помочь вам с сохранением цитат и рекомендациями книг! Попробуйте /menu для навигации.');
      }
    });

    // /stats command - Show user statistics (fallback for old interface)
    this.bot.command('stats', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          await this.navigationHandler.showStats(ctx);
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /stats command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при получении статистики. Попробуйте /menu');
      }
    });

    // /search command - Search user's quotes (fallback for old interface)
    this.bot.command('search', async (ctx) => {
      try {
        const userId = ctx.from.id.toString();
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && userProfile.isOnboardingComplete) {
          // Check if there's a search query
          const commandText = ctx.message.text;
          const searchQuery = commandText.replace('/search', '').trim();
          
          if (searchQuery) {
            await this.commandHandler.handleSearchWithQuery(ctx, searchQuery);
          } else {
            await this.navigationHandler.showDiary(ctx, 1);
          }
        } else {
          await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        }
      } catch (error) {
        logger.error(`📖 Error in /search command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при поиске цитат. Попробуйте /menu');
      }
    });

    // /settings command - User settings (fallback for old interface)
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
        await ctx.reply('📖 Произошла ошибка при загрузке настроек. Попробуйте /menu');
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

        // Handle message classification callbacks (NEW)
        if (callbackData.startsWith('classify_')) {
          await this._handleClassificationCallback(ctx, callbackData);
          return;
        }

        // Check if NavigationHandler can handle this callback
        if (await this.navigationHandler.handleCallback(ctx, callbackData)) {
          return; // NavigationHandler handled it
        }

        // Check if it's an onboarding callback
        if (this.onboardingHandler.isInOnboarding(userId) || 
            callbackData === 'start_test' || 
            callbackData.startsWith('test_') || 
            callbackData.startsWith('source_')) {
          
          if (await this.onboardingHandler.handleCallback(ctx)) {
            // After onboarding completion, show navigation menu
            const userProfile = await UserProfile.findOne({ userId });
            if (userProfile && userProfile.isOnboardingComplete) {
              setTimeout(async () => {
                await this.navigationHandler.showMainMenu(ctx, userProfile);
              }, 2000); // Show menu after 2 seconds
            }
            return;
          }
        }

        // Handle monthly survey callbacks
        if (callbackData.startsWith('monthly_survey_')) {
          const themeMapping = {
            'monthly_survey_confidence': 'Поиск уверенности',
            'monthly_survey_femininity': 'Женственность и нежность',
            'monthly_survey_balance': 'Баланс между «дать» и «взять»',
            'monthly_survey_love': 'Любовь и отношения',
            'monthly_survey_growth': 'Вдохновение и рост',
            'monthly_survey_family': 'Материнство и семья'
          };

          const selectedTheme = themeMapping[callbackData];
          
          if (selectedTheme && this.monthlyReportService) {
            await ctx.editMessageText('📝 Спасибо за ответ! Анализирую ваш месяц и готовлю персональный отчет...');
            await ctx.answerCbQuery('✅ Тема выбрана!');
            
            try {
              await this.monthlyReportService.processSurveyResponse(userId, selectedTheme);
            } catch (error) {
              logger.error(`📖 Error processing monthly survey: ${error.message}`);
              await ctx.reply('📖 Произошла ошибка при обработке опроса. Попробуйте позже.');
            }
          }
          return;
        }

        // Handle monthly rating callbacks
        if (callbackData.startsWith('monthly_rating_')) {
          const parts = callbackData.split('_');
          if (parts.length >= 4) {
            const rating = parts[2]; // 1-5
            const reportId = parts.slice(3).join('_');
            
            await this.feedbackHandler.handleMonthlyRating(ctx, rating, reportId);
            return;
          }
        }

        // Handle weekly report feedback callbacks
        if (callbackData.startsWith('feedback_')) {
          const parts = callbackData.split('_');
          if (parts.length >= 3) {
            const rating = parts[1]; // excellent/good/bad
            const reportId = parts.slice(2).join('_');
            
            await this.feedbackHandler.handleWeeklyFeedback(ctx, rating, reportId);
            return;
          }
        }

        // Handle settings callbacks (fallback to old system)
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
   * Handle message classification callbacks (NEW)
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   */
  async _handleClassificationCallback(ctx, callbackData) {
    const userId = ctx.from.id.toString();
    
    try {
      if (callbackData === 'classify_cancel') {
        // User cancelled classification
        this.pendingClassifications.delete(userId);
        await ctx.editMessageText('📖 Отменено. Попробуйте еще раз, если нужно.');
        await ctx.answerCbQuery('❌ Отменено');
        return;
      }

      // Get pending message
      const pendingMessage = this.pendingClassifications.get(userId);
      if (!pendingMessage) {
        await ctx.answerCbQuery('⏰ Время истекло, попробуйте еще раз');
        return;
      }

      const messageText = pendingMessage.message;
      
      if (callbackData.startsWith('classify_quote_')) {
        // User confirmed it's a quote
        await ctx.editMessageText('📖 Обрабатываю цитату...');
        await ctx.answerCbQuery('✅ Принято как цитата');
        
        const userProfile = await UserProfile.findOne({ userId });
        await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
        
        // Show menu option after quote processing
        setTimeout(async () => {
          await ctx.reply(
            '✅ Цитата сохранена!\n\n💡 Используйте /menu для навигации по дневнику.',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📖 Открыть меню", callback_data: "nav_main" }]
                ]
              }
            }
          );
        }, 1000);
        
      } else if (callbackData.startsWith('classify_question_')) {
        // User confirmed it's a question
        await ctx.editMessageText('💬 Обрабатываю вопрос...');
        await ctx.answerCbQuery('✅ Принято как вопрос');
        
        const userProfile = await UserProfile.findOne({ userId });
        
        // Check if it's a complex question
        if (this.complexQuestionHandler.isComplexQuestion(messageText)) {
          await this.complexQuestionHandler.handleComplexQuestion(ctx, messageText, userProfile);
        } else {
          // Handle as general conversation
          await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
        }
      }
      
      // Clean up pending message
      this.pendingClassifications.delete(userId);
      
    } catch (error) {
      logger.error(`📖 Error handling classification callback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
      this.pendingClassifications.delete(userId);
    }
  }

  /**
   * Setup text message handlers with smart classification
   * @private
   */
  _setupMessageHandlers() {
    this.bot.on('text', async (ctx) => {
      try {
        const messageText = ctx.message.text;
        const userId = ctx.from.id.toString();

        logger.info(`📖 Processing text message from user ${userId}: \"${messageText.substring(0, 30)}...\"`);

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

        // NEW: Use MessageClassifier for smart message detection
        const classification = await this.messageClassifier.classifyMessage(messageText, {
          userId,
          userProfile
        });

        logger.info(`📖 Message classified as: ${classification.type} (confidence: ${classification.confidence})`);

        // Route message based on classification
        switch (classification.type) {
          case 'quote':
            await this.quoteHandler.handleQuote(ctx, messageText, userProfile);
            
            // Show confirmation with menu option
            setTimeout(async () => {
              await ctx.reply(
                '✅ Цитата сохранена!\n\n💡 Используйте /menu для навигации по дневнику.',
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "📖 Открыть меню", callback_data: "nav_main" }]
                    ]
                  }
                }
              );
            }, 1000);
            break;

          case 'complex_question':
            await this.complexQuestionHandler.handleComplexQuestion(ctx, messageText, userProfile);
            break;

          case 'question':
            await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
            break;

          case 'command':
            // This shouldn't happen as commands are handled separately
            logger.warn(`📖 Command detected in text handler: ${messageText}`);
            await ctx.reply('📖 Неизвестная команда. Попробуйте /help для списка команд.');
            break;

          case 'ambiguous':
            // Ask user for clarification
            await this._handleAmbiguousMessage(ctx, messageText, classification);
            break;

          default:
            logger.warn(`📖 Unknown classification type: ${classification.type}`);
            await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
            break;
        }

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
          `Например: \"В каждом слове — целая жизнь\" (Марина Цветаева)`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📖 Открыть меню", callback_data: "nav_main" }]
              ]
            }
          }
        );

      } catch (error) {
        logger.error(`📖 Error processing non-text message: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка. Попробуйте отправить цитату текстом.');
      }
    });
  }

  /**
   * Handle ambiguous messages by asking user for clarification (NEW)
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Original message text
   * @param {Object} classification - Classification result
   */
  async _handleAmbiguousMessage(ctx, messageText, classification) {
    const userId = ctx.from.id.toString();
    
    try {
      // Store message for later processing
      this.pendingClassifications.set(userId, {
        message: messageText,
        timestamp: Date.now(),
        classification
      });

      // Create clarification keyboard
      const clarification = this.messageClassifier.createAmbiguityResolutionKeyboard(messageText);
      
      await ctx.reply(clarification.text, {
        reply_markup: clarification.keyboard
      });

      // Auto-cleanup after 5 minutes
      setTimeout(() => {
        if (this.pendingClassifications.has(userId)) {
          this.pendingClassifications.delete(userId);
          logger.info(`📖 Auto-cleaned up pending classification for user ${userId}`);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.error(`📖 Error handling ambiguous message: ${error.message}`);
      
      // Fallback to treating as question
      const userProfile = await UserProfile.findOne({ userId });
      await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);
    }
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

      ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📖 Главное меню", callback_data: "nav_main" }]
          ]
        }
      })
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

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📖 Главное меню", callback_data: "nav_main" }]
          ]
        }
      });
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
      logger.info('📖 Reader Telegram bot started successfully with smart message classification system');
      
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
      
      // Cleanup navigation states
      this.navigationHandler.cleanupStaleStates();
      
      // Cleanup pending classifications
      this.pendingClassifications.clear();
      
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

      // Feedback statistics
      const feedbackStats = await this.feedbackHandler.getFeedbackStats();

      // Classification statistics (NEW)
      const classificationStats = this.messageClassifier.getStats();

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
          uptime: process.uptime(),
          pendingClassifications: this.pendingClassifications.size // NEW
        },
        readerStats: {
          totalUsers,
          totalQuotes,
          onboardingUsers,
          averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0,
          todayQuotes,
          activeUsersToday: todayUsers.length
        },
        feedback: feedbackStats,
        classification: classificationStats, // NEW: Classification system stats
        handlers: {
          onboarding: this.onboardingHandler.getStats(),
          quotes: this.quoteHandler.getStats(),
          commands: this.commandHandler.getStats(),
          complexQuestions: this.complexQuestionHandler.getStats(),
          feedback: this.feedbackHandler.getDiagnostics(),
          navigation: this.navigationHandler.getStats(),
          helpers: BotHelpers.getStats(),
          weeklyReports: !!this.weeklyReportHandler,
          monthlyReports: !!this.monthlyReportService
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
          monthlyReports: !!this.monthlyReportService,
          feedbackSystem: true,
          scheduledTasks: true,
          modernNavigation: true,
          visualPanels: true,
          smartClassification: true, // NEW: Smart message classification
          ambiguityResolution: true // NEW: User clarification for unclear messages
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
      
      // Clean up navigation states
      this.navigationHandler.cleanupStaleStates();
      
      // Clean up pending classifications
      this.pendingClassifications.clear();
      
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
          navigationActive: this.navigationHandler.userStates.size,
          pendingClassifications: this.pendingClassifications.size, // NEW
          weeklyReportsEnabled: !!this.weeklyReportHandler,
          monthlyReportsEnabled: !!this.monthlyReportService,
          feedbackSystemEnabled: this.feedbackHandler.isReady(),
          modernUXEnabled: true,
          smartClassificationEnabled: true // NEW
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