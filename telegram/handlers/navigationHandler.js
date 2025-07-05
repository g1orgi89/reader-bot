/**
 * Navigation Handler for Reader Bot - Modern UX with single updating message
 * @file telegram/handlers/navigationHandler.js
 * 📖 READER BOT: Central navigation system with visual panels
 * 
 * Features:
 * - Single message navigation (like mobile app)
 * - Visual panels for diary, stats, profile
 * - State management for each user
 * - Beautiful formatting with borders and emojis
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');

/**
 * @typedef {Object} NavigationState
 * @property {string} currentView - Current active view (main, diary, stats, profile, settings)
 * @property {number} diaryPage - Current diary page
 * @property {Object} messageInfo - Telegram message info for editing
 * @property {Date} lastUpdate - Last update timestamp
 */

/**
 * @typedef {Object} UserStats
 * @property {number} totalQuotes - Total quotes collected
 * @property {number} currentStreak - Current daily streak
 * @property {number} longestStreak - Longest streak record
 * @property {string[]} favoriteAuthors - Top 3 favorite authors
 * @property {number} daysWithBot - Days since registration
 * @property {number} weekQuotes - Quotes this week
 * @property {Object[]} achievements - User achievements
 */

class NavigationHandler {
  constructor() {
    // Store navigation states for each user
    this.userStates = new Map();
    
    // Navigation views configuration
    this.views = {
      main: 'main_menu',
      diary: 'diary_view', 
      stats: 'stats_view',
      profile: 'profile_view',
      settings: 'settings_view',
      help: 'help_view'
    };

    // Visual configuration
    this.config = {
      maxQuotesPerPage: 5,
      maxMessageLength: 4000,
      stateTimeout: 30 * 60 * 1000, // 30 minutes
      borders: {
        top: '┌─────────────────────────────────┐',
        bottom: '└─────────────────────────────────┘',
        middle: '├─────────────────────────────────┤',
        separator: '─────────────────────────────────'
      }
    };

    logger.info('📖 NavigationHandler initialized with modern UX system');
  }

  /**
   * Get or create navigation state for user
   * @param {string} userId - User ID
   * @returns {NavigationState}
   */
  getUserState(userId) {
    if (!this.userStates.has(userId)) {
      this.userStates.set(userId, {
        currentView: 'main',
        diaryPage: 1,
        messageInfo: null,
        lastUpdate: new Date()
      });
    }
    return this.userStates.get(userId);
  }

  /**
   * Update user navigation state
   * @param {string} userId - User ID
   * @param {Partial<NavigationState>} updates - State updates
   */
  updateUserState(userId, updates) {
    const state = this.getUserState(userId);
    Object.assign(state, updates, { lastUpdate: new Date() });
  }

  /**
   * Clear user navigation state
   * @param {string} userId - User ID
   */
  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  /**
   * Show main navigation menu
   * @param {Object} ctx - Telegram context
   * @param {UserProfile} userProfile - User profile
   * @returns {Promise<void>}
   */
  async showMainMenu(ctx, userProfile = null) {
    try {
      const userId = ctx.from.id.toString();
      
      if (!userProfile) {
        userProfile = await UserProfile.findOne({ userId });
      }

      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      const stats = await this.getUserQuickStats(userId);
      const mainPanel = this.createMainPanel(userProfile.name, stats);
      const keyboard = this.createMainKeyboard();

      const state = this.getUserState(userId);
      
      if (state.messageInfo && state.currentView !== 'main') {
        // Update existing message
        try {
          await ctx.editMessageText(mainPanel, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            message_id: state.messageInfo.messageId
          });
        } catch (editError) {
          // If edit fails, send new message
          const message = await ctx.reply(mainPanel, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          this.updateUserState(userId, {
            messageInfo: { messageId: message.message_id, chatId: ctx.chat.id }
          });
        }
      } else {
        // Send new message
        const message = await ctx.reply(mainPanel, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        this.updateUserState(userId, {
          messageInfo: { messageId: message.message_id, chatId: ctx.chat.id }
        });
      }

      this.updateUserState(userId, { currentView: 'main' });
      
    } catch (error) {
      logger.error(`📖 Error showing main menu: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке главного меню.');
    }
  }

  /**
   * Show diary view with quotes
   * @param {Object} ctx - Telegram context
   * @param {number} [page=1] - Page number
   * @returns {Promise<void>}
   */
  async showDiary(ctx, page = 1) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });

      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      const quotes = await this.getUserQuotes(userId, page);
      const totalQuotes = await Quote.countDocuments({ userId });
      const totalPages = Math.ceil(totalQuotes / this.config.maxQuotesPerPage);

      const diaryPanel = this.createDiaryPanel(quotes, page, totalPages, totalQuotes);
      const keyboard = this.createDiaryKeyboard(page, totalPages);

      await this.updateNavigationMessage(ctx, userId, diaryPanel, keyboard);
      this.updateUserState(userId, { 
        currentView: 'diary', 
        diaryPage: page 
      });

    } catch (error) {
      logger.error(`📖 Error showing diary: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке дневника.');
    }
  }

  /**
   * Show statistics view
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async showStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });

      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      const stats = await this.getUserDetailedStats(userId, userProfile);
      const statsPanel = this.createStatsPanel(stats);
      const keyboard = this.createStatsKeyboard();

      await this.updateNavigationMessage(ctx, userId, statsPanel, keyboard);
      this.updateUserState(userId, { currentView: 'stats' });

    } catch (error) {
      logger.error(`📖 Error showing stats: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке статистики.');
    }
  }

  /**
   * Show profile view
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async showProfile(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });

      if (!userProfile || !userProfile.isOnboardingComplete) {
        await ctx.reply("📖 Пожалуйста, сначала пройдите регистрацию. Введите /start");
        return;
      }

      const profilePanel = this.createProfilePanel(userProfile);
      const keyboard = this.createProfileKeyboard();

      await this.updateNavigationMessage(ctx, userId, profilePanel, keyboard);
      this.updateUserState(userId, { currentView: 'profile' });

    } catch (error) {
      logger.error(`📖 Error showing profile: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке профиля.');
    }
  }

  /**
   * Handle navigation callback queries
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   * @returns {Promise<boolean>} - True if handled
   */
  async handleCallback(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      
      // Main navigation callbacks
      if (callbackData === 'nav_main') {
        await this.showMainMenu(ctx);
        await ctx.answerCbQuery('🏠 Главная');
        return true;
      }

      if (callbackData === 'nav_diary') {
        await this.showDiary(ctx, 1);
        await ctx.answerCbQuery('📖 Дневник');
        return true;
      }

      if (callbackData === 'nav_stats') {
        await this.showStats(ctx);
        await ctx.answerCbQuery('📊 Статистика');
        return true;
      }

      if (callbackData === 'nav_profile') {
        await this.showProfile(ctx);
        await ctx.answerCbQuery('👤 Профиль');
        return true;
      }

      if (callbackData === 'nav_settings') {
        await this.showSettings(ctx);
        await ctx.answerCbQuery('⚙️ Настройки');
        return true;
      }

      if (callbackData === 'nav_help') {
        await this.showHelp(ctx);
        await ctx.answerCbQuery('❓ Помощь');
        return true;
      }

      // Diary pagination callbacks
      if (callbackData.startsWith('diary_page_')) {
        const page = parseInt(callbackData.replace('diary_page_', ''));
        await this.showDiary(ctx, page);
        await ctx.answerCbQuery(`📄 Страница ${page}`);
        return true;
      }

      // Add quote callback
      if (callbackData === 'add_quote') {
        await this.showAddQuotePrompt(ctx);
        await ctx.answerCbQuery('➕ Добавить цитату');
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`📖 Error handling navigation callback: ${error.message}`);
      await ctx.answerCbQuery('Произошла ошибка');
      return false;
    }
  }

  /**
   * Create main panel display
   * @param {string} userName - User name
   * @param {Object} stats - Quick stats
   * @returns {string} - Formatted panel
   */
  createMainPanel(userName, stats) {
    return `${this.config.borders.top}
│     🌟 ЧИТАТЕЛЬ                 │
│ Персональный дневник цитат      │
│                                 │
│ 👤 ${userName.padEnd(26)} │
│ 📊 ${stats.quotesText.padEnd(26)} │
│                                 │
│ 💡 Отправьте цитату для         │
│    сохранения                   │
${this.config.borders.bottom}`;
  }

  /**
   * Create diary panel display
   * @param {Object[]} quotes - User quotes
   * @param {number} currentPage - Current page
   * @param {number} totalPages - Total pages
   * @param {number} totalQuotes - Total quotes count
   * @returns {string} - Formatted panel
   */
  createDiaryPanel(quotes, currentPage, totalPages, totalQuotes) {
    let panel = `${this.config.borders.top}
│       📖 МОЙ ДНЕВНИК ЦИТАТ      │
│                                 │`;

    if (quotes.length === 0) {
      panel += `│ Пока нет сохраненных цитат      │
│                                 │
│ 💡 Отправьте первую цитату:     │
│ "Текст цитаты" (Автор)          │`;
    } else {
      quotes.forEach((quote, index) => {
        const number = (currentPage - 1) * this.config.maxQuotesPerPage + index + 1;
        const date = quote.createdAt.toLocaleDateString('ru-RU', { 
          day: 'numeric', 
          month: 'short' 
        });
        
        // Truncate long quotes
        let text = quote.text.length > 30 ? quote.text.substring(0, 30) + '...' : quote.text;
        let author = quote.author || 'Неизвестен';
        
        panel += `│ **${number}.** "${text}" │
│        — ${author} │
│        📅 ${date} | 🏷 ${quote.category || 'Общее'} │
│                                 │`;
      });
    }

    panel += `│ ${this.config.borders.separator} │
│ 📄 Страница ${currentPage} из ${totalPages || 1}              │
${this.config.borders.bottom}`;

    return panel;
  }

  /**
   * Create stats panel display
   * @param {UserStats} stats - User statistics
   * @returns {string} - Formatted panel
   */
  createStatsPanel(stats) {
    const progressBar = this.createProgressBar(stats.currentStreak, 7); // 7 days target
    
    return `${this.config.borders.top}
│        📊 ВАША СТАТИСТИКА       │
│                                 │
│ 📖 **Цитаты:**                  │
│ ├── Всего собрано: ${String(stats.totalQuotes).padStart(12)} │
│ ├── На этой неделе: ${String(stats.weekQuotes).padStart(11)} │
│ ├── За сегодня: ${String(stats.todayQuotes || 0).padStart(15)} │
│                                 │
│ 🔥 **Активность:**              │
│ ├── Дней подряд: ${String(stats.currentStreak).padStart(13)} │
│ ├── Рекорд серии: ${String(stats.longestStreak).padStart(13)} │
│ ├── С ботом: ${String(stats.daysWithBot).padStart(18)} дней │
│                                 │
│ 🔥 Прогресс: ${progressBar}     │
│                                 │
│ 👤 **Любимые авторы:**          │
${stats.favoriteAuthors.slice(0, 3).map((author, i) => 
  `│ ${i + 1}. ${author.padEnd(28)} │`
).join('\n')}
│                                 │
│ 🏆 **Достижения:** ${String(stats.achievements.length).padStart(11)}/10         │
${this.config.borders.bottom}`;
  }

  /**
   * Create profile panel display
   * @param {UserProfile} userProfile - User profile
   * @returns {string} - Formatted panel
   */
  createProfilePanel(userProfile) {
    const registrationDate = userProfile.registeredAt.toLocaleDateString('ru-RU');
    
    return `${this.config.borders.top}
│        👤 ВАШ ПРОФИЛЬ           │
│                                 │
│ **Имя:** ${userProfile.name.padEnd(23)} │
│ **Email:** ${userProfile.email.padEnd(21)} │
│ **Telegram:** @${(userProfile.telegramUsername || 'не указан').padEnd(17)} │
│                                 │
│ **Источник:** ${userProfile.source.padEnd(19)} │
│ **Дата регистрации:** ${registrationDate.padEnd(9)} │
│                                 │
│ **Предпочтения:**               │
│ └ ${(userProfile.preferences?.mainThemes?.[0] || 'Не определены').padEnd(26)} │
│                                 │
│ **Настройки напоминаний:**      │
│ └ ${userProfile.settings?.reminderEnabled ? '✅ Включены' : '❌ Отключены'}               │
${this.config.borders.bottom}`;
  }

  /**
   * Create main keyboard
   * @returns {Object} - Telegram inline keyboard
   */
  createMainKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📖 Мой дневник", callback_data: "nav_diary" },
          { text: "📊 Статистика", callback_data: "nav_stats" }
        ],
        [
          { text: "👤 Профиль", callback_data: "nav_profile" },
          { text: "⚙️ Настройки", callback_data: "nav_settings" }
        ],
        [
          { text: "➕ Добавить цитату", callback_data: "add_quote" },
          { text: "❓ Помощь", callback_data: "nav_help" }
        ]
      ]
    };
  }

  /**
   * Create diary keyboard
   * @param {number} currentPage - Current page
   * @param {number} totalPages - Total pages
   * @returns {Object} - Telegram inline keyboard
   */
  createDiaryKeyboard(currentPage, totalPages) {
    const keyboard = [];
    
    // Add quote button
    keyboard.push([
      { text: "➕ Добавить цитату", callback_data: "add_quote" }
    ]);

    // Pagination
    if (totalPages > 1) {
      const paginationRow = [];
      
      if (currentPage > 1) {
        paginationRow.push({ text: "⬅️", callback_data: `diary_page_${currentPage - 1}` });
      }
      
      paginationRow.push({ text: `${currentPage}/${totalPages}`, callback_data: "noop" });
      
      if (currentPage < totalPages) {
        paginationRow.push({ text: "➡️", callback_data: `diary_page_${currentPage + 1}` });
      }
      
      keyboard.push(paginationRow);
    }

    // Navigation buttons
    keyboard.push([
      { text: "🔍 Поиск", callback_data: "search_quotes" },
      { text: "📅 По дате", callback_data: "filter_by_date" }
    ]);
    
    keyboard.push([
      { text: "📊 Статистика", callback_data: "nav_stats" },
      { text: "🔙 Главная", callback_data: "nav_main" }
    ]);

    return { inline_keyboard: keyboard };
  }

  /**
   * Create stats keyboard
   * @returns {Object} - Telegram inline keyboard
   */
  createStatsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📈 Подробный прогресс", callback_data: "detailed_progress" },
          { text: "🏆 Достижения", callback_data: "show_achievements" }
        ],
        [
          { text: "📖 Дневник", callback_data: "nav_diary" },
          { text: "🔙 Главная", callback_data: "nav_main" }
        ]
      ]
    };
  }

  /**
   * Create profile keyboard
   * @returns {Object} - Telegram inline keyboard
   */
  createProfileKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "✏️ Редактировать", callback_data: "edit_profile" },
          { text: "📝 Тест заново", callback_data: "retake_test" }
        ],
        [
          { text: "📊 Статистика", callback_data: "nav_stats" },
          { text: "🔙 Главная", callback_data: "nav_main" }
        ]
      ]
    };
  }

  /**
   * Update navigation message
   * @param {Object} ctx - Telegram context
   * @param {string} userId - User ID
   * @param {string} content - New content
   * @param {Object} keyboard - Inline keyboard
   * @returns {Promise<void>}
   */
  async updateNavigationMessage(ctx, userId, content, keyboard) {
    try {
      const state = this.getUserState(userId);
      
      if (state.messageInfo) {
        await ctx.editMessageText(content, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          message_id: state.messageInfo.messageId
        });
      } else {
        const message = await ctx.reply(content, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        this.updateUserState(userId, {
          messageInfo: { messageId: message.message_id, chatId: ctx.chat.id }
        });
      }
    } catch (error) {
      logger.error(`📖 Error updating navigation message: ${error.message}`);
      // Fallback: send new message
      const message = await ctx.reply(content, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      this.updateUserState(userId, {
        messageInfo: { messageId: message.message_id, chatId: ctx.chat.id }
      });
    }
  }

  /**
   * Get user quotes with pagination
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @returns {Promise<Object[]>} - User quotes
   */
  async getUserQuotes(userId, page = 1) {
    const skip = (page - 1) * this.config.maxQuotesPerPage;
    
    return await Quote.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(this.config.maxQuotesPerPage)
      .lean();
  }

  /**
   * Get user quick statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Quick stats
   */
  async getUserQuickStats(userId) {
    const totalQuotes = await Quote.countDocuments({ userId });
    
    // Get current streak (simplified)
    const userProfile = await UserProfile.findOne({ userId });
    const currentStreak = userProfile?.statistics?.currentStreak || 0;
    
    const quotesText = `${totalQuotes} цитат | 🔥 ${currentStreak} дней`;
    
    return {
      totalQuotes,
      currentStreak,
      quotesText
    };
  }

  /**
   * Get detailed user statistics
   * @param {string} userId - User ID
   * @param {UserProfile} userProfile - User profile
   * @returns {Promise<UserStats>} - Detailed stats
   */
  async getUserDetailedStats(userId, userProfile) {
    const totalQuotes = await Quote.countDocuments({ userId });
    
    // Week quotes
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekQuotes = await Quote.countDocuments({
      userId,
      createdAt: { $gte: oneWeekAgo }
    });

    // Today quotes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayQuotes = await Quote.countDocuments({
      userId,
      createdAt: { $gte: today }
    });

    // Days with bot
    const daysWithBot = Math.floor(
      (new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24)
    );

    // Favorite authors
    const authorStats = await Quote.aggregate([
      { $match: { userId, author: { $ne: null, $ne: '' } } },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    const favoriteAuthors = authorStats.map(stat => stat._id);

    return {
      totalQuotes,
      currentStreak: userProfile.statistics?.currentStreak || 0,
      longestStreak: userProfile.statistics?.longestStreak || 0,
      favoriteAuthors,
      daysWithBot,
      weekQuotes,
      todayQuotes,
      achievements: userProfile.achievements || []
    };
  }

  /**
   * Create progress bar visualization
   * @param {number} current - Current value
   * @param {number} target - Target value
   * @returns {string} - Progress bar
   */
  createProgressBar(current, target) {
    const percentage = Math.min(current / target, 1);
    const filled = Math.floor(percentage * 10);
    const empty = 10 - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${current}/${target}`;
  }

  /**
   * Show add quote prompt
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async showAddQuotePrompt(ctx) {
    const promptText = `${this.config.borders.top}
│      ➕ ДОБАВИТЬ ЦИТАТУ         │
│                                 │
│ Отправьте цитату в следующем    │
│ сообщении:                      │
│                                 │
│ 💡 **Форматы:**                 │
│ • "Текст цитаты" (Автор)        │
│ • "Текст цитаты" - Автор        │
│ • Просто текст цитаты           │
│                                 │
│ **Пример:**                     │
│ "Счастье внутри нас" (Будда)    │
│                                 │
│ ⏰ Ожидаю вашу цитату...        │
${this.config.borders.bottom}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "❌ Отменить", callback_data: "nav_main" },
          { text: "🔙 В дневник", callback_data: "nav_diary" }
        ]
      ]
    };

    const userId = ctx.from.id.toString();
    await this.updateNavigationMessage(ctx, userId, promptText, keyboard);
  }

  /**
   * Show settings view (placeholder)
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async showSettings(ctx) {
    // Will be implemented with SettingsHandler
    await ctx.reply("⚙️ Настройки временно недоступны. Используйте команду /settings");
    await this.showMainMenu(ctx);
  }

  /**
   * Show help view (placeholder)
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async showHelp(ctx) {
    // Will be implemented with HelpHandler
    await ctx.reply("❓ Справка временно недоступна. Используйте команду /help");
    await this.showMainMenu(ctx);
  }

  /**
   * Clean up stale user states
   * @returns {void}
   */
  cleanupStaleStates() {
    const now = new Date();
    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.lastUpdate > this.config.stateTimeout) {
        this.userStates.delete(userId);
        logger.info(`📖 Cleaned up stale navigation state for user ${userId}`);
      }
    }
  }

  /**
   * Get handler statistics
   * @returns {Object} - Handler stats
   */
  getStats() {
    return {
      activeUsers: this.userStates.size,
      views: this.views,
      configuredViews: Object.keys(this.views).length
    };
  }
}

module.exports = { NavigationHandler };
