/**
 * Main Telegram bot for Reader project - Personal quotes diary with AI analysis
 * @file telegram/index.js
 * 📖 READER BOT: Transformed from Shrooms for Anna Busel's book club
 * 📖 ADDED: Onboarding with 7-question test + email collection + traffic source
 * 📖 ADDED: State management for Reader-specific flows
 * 📖 ADAPTED: From mushroom expert to book psychology expert Anna Busel
 */

const { Telegraf, Markup } = require('telegraf');
const logger = require('../server/utils/logger');

// Import Reader bot services
const claudeService = require('../server/services/claude');
const ticketingService = require('../server/services/ticketing');
const conversationService = require('../server/services/conversation');
const messageService = require('../server/services/message');

// Import Reader bot models
const { UserProfile, Quote } = require('../server/models');

// Import Reader bot handlers and helpers
const { OnboardingHandler } = require('./handlers/onboardingHandler');
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
    
    logger.info('📖 ReaderTelegramBot constructor initialized');
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
      logger.info('📖 Reader Telegram bot initialized successfully');
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
        const helpText = `📖 *Помощь по боту «Читатель»*

*Основные команды:*
/start - начать работу с ботом
/help - эта справка
/stats - ваша статистика чтения
/search - поиск по вашим цитатам

*Как пользоваться:*
• Просто отправляйте цитаты текстом
• Указывайте автора в скобках: (Толстой)
• Лимит: ${this.config.maxQuotesPerDay} цитат в день

*Отчеты:* каждое воскресенье в 11:00
*Вопросы:* пишите прямо в чат, я передам Анне

💡 Хватит сидеть в телефоне - читайте книги!`;

        await ctx.replyWithMarkdown(helpText);
        
      } catch (error) {
        logger.error(`📖 Error in /help command: ${error.message}`);
        await ctx.reply('📖 Я могу помочь вам с сохранением цитат и рекомендациями книг! Просто отправьте мне цитату.');
      }
    });

    // /stats command - Show user statistics
    this.bot.command('stats', async (ctx) => {
      try {
        await this._handleStatsCommand(ctx);
      } catch (error) {
        logger.error(`📖 Error in /stats command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при получении статистики. Попробуйте позже.');
      }
    });

    // /search command - Search user's quotes
    this.bot.command('search', async (ctx) => {
      try {
        await this._handleSearchCommand(ctx);
      } catch (error) {
        logger.error(`📖 Error in /search command: ${error.message}`);
        await ctx.reply('📖 Произошла ошибка при поиске цитат. Попробуйте позже.');
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
          
          await this.onboardingHandler.handleCallback(ctx);
          return;
        }

        // Handle other callbacks here (like feedback, recommendations, etc.)
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

        // Check if message looks like a quote
        if (await this._isQuoteMessage(messageText)) {
          await this._handleQuoteMessage(ctx, messageText, userProfile);
          return;
        }

        // Check if it's a complex question that needs Anna's attention
        if (await BotHelpers.isComplexQuestion(messageText)) {
          await BotHelpers.handleComplexQuestion(ctx, messageText, userProfile);
          return;
        }

        // Handle as general conversation with Anna Busel's AI
        await BotHelpers.handleGeneralMessage(ctx, messageText, userProfile);

      } catch (error) {
        logger.error(`📖 Error processing text message: ${error.message}`);
        await this._sendErrorMessage(ctx, error);
      }
    });
  }

  /**
   * Handle stats command
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _handleStatsCommand(ctx) {
    const userId = ctx.from.id.toString();
    
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
      return;
    }

    const totalQuotes = await Quote.countDocuments({ userId });
    const todayQuotes = await Quote.countDocuments({
      userId,
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    const statsText = `📊 *Ваша статистика в «Читателе»:*

📖 Цитат собрано: ${totalQuotes}
📅 Сегодня: ${todayQuotes}/${this.config.maxQuotesPerDay}
🔥 Текущая серия: ${userProfile.statistics.currentStreak} дней
⭐ Рекорд серии: ${userProfile.statistics.longestStreak} дней
📚 С ботом: ${this._getDaysWithBot(userProfile.registeredAt)} дней

*Любимые авторы:*
${userProfile.statistics.favoriteAuthors.slice(0, 3).map((author, i) => `${i + 1}. ${author}`).join('\n') || 'Пока нет'}

*Достижения:* ${userProfile.achievements.length}

💡 Продолжайте собирать моменты вдохновения!`;

    await ctx.replyWithMarkdown(statsText);
  }

  /**
   * Handle search command
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _handleSearchCommand(ctx) {
    const userId = ctx.from.id.toString();
    
    const quotes = await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (quotes.length === 0) {
      await ctx.reply("📖 У вас пока нет сохраненных цитат. Отправьте первую!");
      return;
    }

    let searchText = "🔍 *Ваши последние цитаты:*\n\n";
    quotes.forEach((quote, index) => {
      const author = quote.author ? ` (${quote.author})` : '';
      const truncated = quote.text.length > 80 ? quote.text.substring(0, 80) + '...' : quote.text;
      searchText += `${index + 1}. "${truncated}"${author}\n\n`;
    });

    await ctx.replyWithMarkdown(searchText);
  }

  /**
   * Check if message is a quote
   * @private
   * @param {string} message - Message text
   * @returns {Promise<boolean>}
   */
  async _isQuoteMessage(message) {
    // Simple heuristics for quote detection
    const quotePattterns = [
      /^".*"/, // Starts and ends with quotes
      /\([^)]+\)$/, // Ends with author in parentheses
      /^«.*»/, // Russian quotes
      /—\s*[А-ЯA-Z]/, // Dash followed by author name
    ];

    // Check if message matches quote patterns
    if (quotePattterns.some(pattern => pattern.test(message))) {
      return true;
    }

    // Check message length and content (quotes are usually thoughtful, not questions)
    if (message.length > 20 && message.length < 500 && !message.includes('?')) {
      return true;
    }

    return false;
  }

  /**
   * Handle quote message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Quote text
   * @param {Object} userProfile - User profile
   */
  async _handleQuoteMessage(ctx, messageText, userProfile) {
    const userId = ctx.from.id.toString();

    // Check daily quote limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayQuotesCount = await Quote.countDocuments({
      userId,
      createdAt: { $gte: today }
    });

    if (todayQuotesCount >= this.config.maxQuotesPerDay) {
      await ctx.reply(`📖 Вы уже отправили ${this.config.maxQuotesPerDay} цитат сегодня. Возвращайтесь завтра за новыми открытиями!\n\n💡 Хватит сидеть в телефоне - читайте книги!`);
      return;
    }

    // Parse quote (extract author, source)
    const { text, author, source } = this._parseQuote(messageText);
    
    // Save quote to database
    const quote = new Quote({
      userId,
      text,
      author,
      source,
      weekNumber: this._getWeekNumber(),
      monthNumber: new Date().getMonth() + 1,
      yearNumber: new Date().getFullYear()
    });

    await quote.save();

    // Update user statistics
    await BotHelpers.updateUserStatistics(userId, author);

    // Check for achievements
    const achievements = await BotHelpers.checkAchievements(userId);
    if (achievements.length > 0) {
      await BotHelpers.notifyAchievements(ctx, achievements);
    }

    // Generate Anna's response
    const response = await this._generateAnnaResponse(text, author, todayQuotesCount + 1);
    
    await ctx.reply(response);

    logger.info(`📖 Quote saved for user ${userId}: "${text.substring(0, 30)}..."`);
  }

  /**
   * Parse quote text to extract author and source
   * @private
   * @param {string} messageText - Raw message text
   * @returns {Object} Parsed quote data
   */
  _parseQuote(messageText) {
    const patterns = [
      /^"([^"]+)"\s*\(([^)]+)\)$/, // "Quote" (Author)
      /^([^(]+)\s*\(([^)]+)\)$/, // Quote (Author)  
      /^([^—]+)\s*—\s*(.+)$/, // Quote — Author
      /^«([^»]+)»\s*\(([^)]+)\)$/, // «Quote» (Author)
      /^(.+)$/ // Just text
    ];

    for (const pattern of patterns) {
      const match = messageText.trim().match(pattern);
      if (match) {
        if (match[2]) {
          return {
            text: match[1].trim(),
            author: match[2].trim(),
            source: null
          };
        } else {
          return {
            text: match[1].trim(),
            author: null,
            source: null
          };
        }
      }
    }

    return { text: messageText.trim(), author: null, source: null };
  }

  /**
   * Generate Anna Busel's response to a quote
   * @private
   * @param {string} text - Quote text
   * @param {string|null} author - Quote author
   * @param {number} todayCount - Number of quotes today
   * @returns {string}
   */
  async _generateAnnaResponse(text, author, todayCount) {
    const templates = [
      `✨ Прекрасная цитата! ${author ? `${author} умеет находить глубину в простых словах.` : 'Мудрые слова для размышления.'}`,
      `📖 Замечательный выбор! Эта мысль достойна размышления.`,
      `💭 Очень глубоко! ${author ? `${author} - один из моих любимых авторов.` : 'Прекрасная собственная мысль!'}`,
      `🌟 Сохранила в ваш личный дневник. ${author ? `${author} всегда вдохновляет.` : 'Отличная мысль!'}`
    ];

    const baseResponse = templates[Math.floor(Math.random() * templates.length)];
    
    let fullResponse = `${baseResponse}\n\nСохранил в ваш личный дневник 📖\nЦитат сегодня: ${todayCount}/${this.config.maxQuotesPerDay}`;

    // Add encouragement or book recommendation sometimes
    if (Math.random() < 0.3) {
      if (todayCount >= 3) {
        fullResponse += `\n\n💡 Вы сегодня особенно вдумчивы! Продолжайте собирать моменты мудрости.`;
      } else if (author && ['Толстой', 'Достоевский', 'Пушкин', 'Чехов'].includes(author)) {
        fullResponse += `\n\n📚 Кстати, у Анны есть разборы классической литературы, которые могут вас заинтересовать.`;
      }
    }

    return fullResponse;
  }

  /**
   * Helper methods
   */
  _getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  _getDaysWithBot(registrationDate) {
    const now = new Date();
    const diff = now - registrationDate;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  _setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      logger.error(`📖 Telegram bot error: ${err.message}`);
      ctx.reply('📖 Упс! Что-то пошло не так. Попробуйте еще раз.')
        .catch(sendError => {
          logger.error(`📖 Failed to send error message: ${sendError.message}`);
        });
    });
  }

  async _sendErrorMessage(ctx, error) {
    try {
      await ctx.reply('📖 Произошла ошибка. Попробуйте еще раз через минуту.');
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
      logger.info('📖 Reader Telegram bot started successfully');
      
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
          averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0
        },
        features: {
          onboardingFlow: true,
          quoteCollection: true,
          achievementSystem: true,
          complexQuestionHandling: true,
          annaPersona: true
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
}

module.exports = ReaderTelegramBot;