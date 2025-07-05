/**
 * Modern Navigation Handler with elegant visual panels for Reader bot
 * @file telegram/handlers/modernNavigationHandler.js
 * 🎨 VISUAL UX: Beautiful panels, emojis, consistent design
 * 📖 READER THEME: Book-focused design with Anna Busel persona
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote, WeeklyReport, MonthlyReport } = require('../../server/models');

/**
 * @typedef {Object} NavigationState
 * @property {string} currentPanel - Current panel name
 * @property {number} page - Current page number
 * @property {Object} context - Additional context data
 * @property {number} lastActivity - Timestamp of last activity
 */

/**
 * @class ModernNavigationHandler
 * @description Modern visual navigation system with beautiful panels
 */
class ModernNavigationHandler {
  constructor() {
    /** @type {Map<string, NavigationState>} */
    this.userStates = new Map();
    this.stateCleanupInterval = 15 * 60 * 1000; // 15 minutes
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleStates();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
    
    logger.info('🎨 ModernNavigationHandler initialized with visual panels');
  }

  /**
   * Show main menu with beautiful visual design
   * @param {Object} ctx - Telegram context
   * @param {Object} userProfile - User profile
   */
  async showMainMenu(ctx, userProfile) {
    try {
      const stats = await this._getUserStats(userProfile.userId);
      
      const menuPanel = `
╭─────────────────────────╮
│  📖 ЧИТАТЕЛЬ  │  ${userProfile.name}   │
╰─────────────────────────╯

${this._getGreetingByTime()} ${userProfile.name}!

📊 Ваша статистика:
   📖 Цитат собрано: ${stats.totalQuotes}
   🔥 Серия дней: ${stats.currentStreak}
   ⭐ Любимая тема: ${stats.favoriteCategory || 'Мудрость'}

💡 Сегодня сохранено: ${stats.todayQuotes}/10

┌─────────────────────────┐
│     ГЛАВНОЕ МЕНЮ        │
└─────────────────────────┘`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📚 Мой дневник", callback_data: "nav_diary" },
            { text: "📊 Статистика", callback_data: "nav_stats" }
          ],
          [
            { text: "💎 Рекомендации", callback_data: "nav_recommendations" },
            { text: "🎯 Достижения", callback_data: "nav_achievements" }
          ],
          [
            { text: "⚙️ Настройки", callback_data: "nav_settings" },
            { text: "❓ Помощь", callback_data: "nav_help" }
          ],
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, menuPanel, keyboard);
      this._updateUserState(ctx.from.id.toString(), 'main_menu');
      
    } catch (error) {
      logger.error(`🎨 Error showing main menu: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке меню. Попробуйте /start');
    }
  }

  /**
   * Show diary with beautiful quote cards
   * @param {Object} ctx - Telegram context
   * @param {number} page - Page number
   */
  async showDiary(ctx, page = 1) {
    try {
      const userId = ctx.from.id.toString();
      const pageSize = 5;
      const skip = (page - 1) * pageSize;

      const quotes = await Quote.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

      const totalQuotes = await Quote.countDocuments({ userId });
      const totalPages = Math.ceil(totalQuotes / pageSize);

      if (quotes.length === 0) {
        const emptyDiary = `
╭─────────────────────────╮
│     📚 МОЙ ДНЕВНИК      │
╰─────────────────────────╯

📖 Ваш дневник цитат пока пуст

💡 Отправьте мне любую цитату, которая 
   вас вдохновила, и я сохраню её!

Пример:
"В каждом слове — целая жизнь" 
(Марина Цветаева)

┌─────────────────────────┐
│    НАЧНИТЕ СОБИРАТЬ     │
│      МУДРОСТЬ! 📖       │
└─────────────────────────┘`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "✨ Добавить первую цитату", callback_data: "nav_add_quote" }],
            [{ text: "🔙 Главное меню", callback_data: "nav_main" }]
          ]
        };

        await this._sendOrEditPanel(ctx, emptyDiary, keyboard);
        return;
      }

      let diaryPanel = `
╭─────────────────────────╮
│     📚 МОЙ ДНЕВНИК      │
╰─────────────────────────╯

📖 Страница ${page} из ${totalPages} (${totalQuotes} цитат)

`;

      quotes.forEach((quote, index) => {
        const date = quote.createdAt.toLocaleDateString('ru-RU');
        const author = quote.author ? ` — ${quote.author}` : '';
        const category = quote.category ? ` [${quote.category}]` : '';
        
        diaryPanel += `
┌─────────────────────────┐
│ ${(skip + index + 1).toString().padStart(2, '0')}. ${date}  ${category}    │
│                         │
│ "${this._truncateText(quote.text, 45)}"
│${author}
└─────────────────────────┘
`;
      });

      // Navigation buttons
      const navButtons = [];
      if (page > 1) {
        navButtons.push({ text: "⬅️ Пред.", callback_data: `nav_diary_page_${page - 1}` });
      }
      navButtons.push({ text: `📄 ${page}/${totalPages}`, callback_data: "nav_diary_info" });
      if (page < totalPages) {
        navButtons.push({ text: "След. ➡️", callback_data: `nav_diary_page_${page + 1}` });
      }

      const keyboard = {
        inline_keyboard: [
          navButtons,
          [
            { text: "🔍 Поиск", callback_data: "nav_search" },
            { text: "📊 Статистика", callback_data: "nav_stats" }
          ],
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" },
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, diaryPanel, keyboard);
      this._updateUserState(userId, 'diary', { page });
      
    } catch (error) {
      logger.error(`🎨 Error showing diary: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке дневника');
    }
  }

  /**
   * Show detailed statistics panel
   * @param {Object} ctx - Telegram context
   */
  async showStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });
      const stats = await this._getUserStats(userId);

      // Calculate additional stats
      const monthlyStats = await this._getMonthlyStats(userId);
      const topAuthors = await this._getTopAuthors(userId);
      const categoryStats = await this._getCategoryStats(userId);

      const statsPanel = `
╭─────────────────────────╮
│     📊 СТАТИСТИКА       │
╰─────────────────────────╯

👤 ${userProfile.name}
📅 С нами с: ${userProfile.registeredAt.toLocaleDateString('ru-RU')}

┌─────────────────────────┐
│      ОБЩАЯ СТАТИСТИКА   │
└─────────────────────────┘
📖 Всего цитат: ${stats.totalQuotes}
🔥 Текущая серия: ${stats.currentStreak} дней
⭐ Рекорд серии: ${stats.longestStreak} дней
📈 Среднее в день: ${stats.avgPerDay}

┌─────────────────────────┐
│     ЭТОТ МЕСЯЦ          │
└─────────────────────────┘
📖 Цитат: ${monthlyStats.count}
📈 Рост: ${monthlyStats.growth > 0 ? '+' : ''}${monthlyStats.growth}%

┌─────────────────────────┐
│    ЛЮБИМЫЕ АВТОРЫ       │
└─────────────────────────┘
${topAuthors.slice(0, 3).map((author, i) => `${i + 1}. ${author.name} (${author.count})`).join('\n')}

┌─────────────────────────┐
│    ТЕМЫ ИНТЕРЕСОВ       │
└─────────────────────────┘
${categoryStats.slice(0, 3).map((cat, i) => `${this._getCategoryEmoji(cat.category)} ${cat.category}: ${cat.count}`).join('\n')}

🏆 Достижений: ${userProfile.achievements?.length || 0}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏆 Достижения", callback_data: "nav_achievements" },
            { text: "📈 Подробная аналитика", callback_data: "nav_detailed_stats" }
          ],
          [
            { text: "📊 Экспорт данных", callback_data: "nav_export" },
            { text: "📚 Мой дневник", callback_data: "nav_diary" }
          ],
          [
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, statsPanel, keyboard);
      this._updateUserState(userId, 'stats');
      
    } catch (error) {
      logger.error(`🎨 Error showing stats: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке статистики');
    }
  }

  /**
   * Show achievements panel with beautiful badges
   * @param {Object} ctx - Telegram context
   */
  async showAchievements(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });
      const stats = await this._getUserStats(userId);

      // Define all available achievements
      const allAchievements = [
        {
          id: 'first_quote',
          name: 'Первые шаги',
          description: 'Сохранили первую цитату',
          icon: '🌱',
          requirement: 'quotes_count',
          target: 1
        },
        {
          id: 'wisdom_collector',
          name: 'Коллекционер мудрости',
          description: 'Собрали 25 цитат',
          icon: '📚',
          requirement: 'quotes_count',
          target: 25
        },
        {
          id: 'week_philosopher',
          name: 'Философ недели',
          description: '7 дней подряд с цитатами',
          icon: '🔥',
          requirement: 'streak_days',
          target: 7
        },
        {
          id: 'month_scholar',
          name: 'Ученый месяца',
          description: '30 дней подряд',
          icon: '🎓',
          requirement: 'streak_days',
          target: 30
        },
        {
          id: 'classics_lover',
          name: 'Любитель классики',
          description: '10 цитат классиков',
          icon: '📜',
          requirement: 'classics_count',
          target: 10
        },
        {
          id: 'inspiration_seeker',
          name: 'Искатель вдохновения',
          description: '100 цитат собрано',
          icon: '⭐',
          requirement: 'quotes_count',
          target: 100
        }
      ];

      let achievementsPanel = `
╭─────────────────────────╮
│     🏆 ДОСТИЖЕНИЯ       │
╰─────────────────────────╯

🎯 Прогресс развития

`;

      const userAchievements = userProfile.achievements || [];
      
      allAchievements.forEach(achievement => {
        const isUnlocked = userAchievements.some(ua => ua.achievementId === achievement.id);
        const progress = this._calculateAchievementProgress(achievement, stats);
        
        if (isUnlocked) {
          achievementsPanel += `
✅ ${achievement.icon} ${achievement.name}
   ${achievement.description}
   🎉 Получено!
`;
        } else {
          const progressBar = this._createProgressBar(progress.current, progress.target);
          achievementsPanel += `
⏳ ${achievement.icon} ${achievement.name}
   ${achievement.description}
   ${progressBar} ${progress.current}/${progress.target}
`;
        }
      });

      const unlockedCount = userAchievements.length;
      const totalCount = allAchievements.length;
      
      achievementsPanel += `
┌─────────────────────────┐
│   ПРОГРЕСС: ${unlockedCount}/${totalCount}       │
└─────────────────────────┘

🎯 Следующая цель: ${this._getNextAchievement(allAchievements, userAchievements, stats)}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 Статистика", callback_data: "nav_stats" },
            { text: "💎 Рекомендации", callback_data: "nav_recommendations" }
          ],
          [
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, achievementsPanel, keyboard);
      this._updateUserState(userId, 'achievements');
      
    } catch (error) {
      logger.error(`🎨 Error showing achievements: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке достижений');
    }
  }

  /**
   * Show personalized recommendations from Anna
   * @param {Object} ctx - Telegram context
   */
  async showRecommendations(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });
      const lastReport = await WeeklyReport.findOne({ userId }).sort({ sentAt: -1 });

      let recommendationsPanel = `
╭─────────────────────────╮
│   💎 РЕКОМЕНДАЦИИ АННЫ  │
╰─────────────────────────╯

Привет, ${userProfile.name}!

На основе ваших цитат я подобрала 
книги, которые будут вам близки.

`;

      if (lastReport && lastReport.recommendations) {
        lastReport.recommendations.forEach((rec, index) => {
          recommendationsPanel += `
┌─────────────────────────┐
│ ${index + 1}. ${rec.title}           │
└─────────────────────────┘

📝 ${rec.description}

💡 Почему именно вам:
   ${rec.reasoning}

💰 ${rec.price} | 🎁 Промокод: READER20

`;
        });
      } else {
        recommendationsPanel += `
📖 Пока рекомендаций нет - нужно больше 
   цитат для анализа ваших интересов!

💡 Добавьте несколько цитат, и я смогу 
   подобрать идеальные книги для вас.

┌─────────────────────────┐
│   НАЧНИТЕ С ЦИТАТ! 📖   │
└─────────────────────────┘`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📚 Все разборы", callback_data: "nav_all_books" },
            { text: "🎁 Промокоды", callback_data: "nav_promocodes" }
          ],
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" },
            { text: "📊 Статистика", callback_data: "nav_stats" }
          ],
          [
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, recommendationsPanel, keyboard);
      this._updateUserState(userId, 'recommendations');
      
    } catch (error) {
      logger.error(`🎨 Error showing recommendations: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке рекомендаций');
    }
  }

  /**
   * Show settings panel
   * @param {Object} ctx - Telegram context
   */
  async showSettings(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });

      const reminderStatus = userProfile.settings?.reminderEnabled ? '✅ Включены' : '❌ Выключены';
      const reminderTimes = userProfile.settings?.reminderTimes || ['09:00', '19:00'];

      const settingsPanel = `
╭─────────────────────────╮
│     ⚙️ НАСТРОЙКИ        │
╰─────────────────────────╯

👤 Профиль: ${userProfile.name}
📧 Email: ${userProfile.email}
📱 Источник: ${userProfile.source}

┌─────────────────────────┐
│      НАПОМИНАНИЯ        │
└─────────────────────────┘
🔔 Статус: ${reminderStatus}
⏰ Время: ${reminderTimes.join(', ')}

┌─────────────────────────┐
│        ДАННЫЕ           │
└─────────────────────────┘
📊 Экспорт цитат
🗑️ Удаление аккаунта
📋 Политика данных

┌─────────────────────────┐
│       ПОДДЕРЖКА         │
└─────────────────────────┘
❓ Часто задаваемые вопросы
💬 Связь с Анной`;

      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: userProfile.settings?.reminderEnabled ? "🔕 Выключить напоминания" : "🔔 Включить напоминания", 
              callback_data: "nav_toggle_reminders" 
            }
          ],
          [
            { text: "⏰ Изменить время", callback_data: "nav_change_time" },
            { text: "📧 Изменить email", callback_data: "nav_change_email" }
          ],
          [
            { text: "📊 Экспорт данных", callback_data: "nav_export" },
            { text: "❓ FAQ", callback_data: "nav_faq" }
          ],
          [
            { text: "💬 Связаться с Анной", callback_data: "nav_contact" },
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, settingsPanel, keyboard);
      this._updateUserState(userId, 'settings');
      
    } catch (error) {
      logger.error(`🎨 Error showing settings: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке настроек');
    }
  }

  /**
   * Show help panel
   * @param {Object} ctx - Telegram context
   */
  async showHelp(ctx) {
    try {
      const helpPanel = `
╭─────────────────────────╮
│       ❓ ПОМОЩЬ         │
╰─────────────────────────╯

📖 Как пользоваться ботом:

┌─────────────────────────┐
│    ДОБАВЛЕНИЕ ЦИТАТ     │
└─────────────────────────┘
✨ Просто отправьте цитату боту:
   "В каждом слове — целая жизнь"
   (Марина Цветаева)

📝 Можно без автора:
   "Жизнь прекрасна"

📊 Лимит: 10 цитат в день

┌─────────────────────────┐
│      ВОЗМОЖНОСТИ        │
└─────────────────────────┘
📚 Личный дневник цитат
📊 Статистика и аналитика
🏆 Система достижений
💎 Персональные рекомендации
📈 Еженедельные отчеты

┌─────────────────────────┐
│       КОМАНДЫ           │
└─────────────────────────┘
/start - главное меню
/menu - навигация
/help - эта справка

💬 Есть вопросы? Пишите прямо 
   в чат - я передам Анне!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✨ Добавить цитату", callback_data: "nav_add_quote" },
            { text: "📚 Мой дневник", callback_data: "nav_diary" }
          ],
          [
            { text: "💬 Связаться с Анной", callback_data: "nav_contact" },
            { text: "❓ FAQ", callback_data: "nav_faq" }
          ],
          [
            { text: "🔙 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await this._sendOrEditPanel(ctx, helpPanel, keyboard);
      this._updateUserState(ctx.from.id.toString(), 'help');
      
    } catch (error) {
      logger.error(`🎨 Error showing help: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при загрузке справки');
    }
  }

  /**
   * Handle callback queries for navigation
   * @param {Object} ctx - Telegram context
   * @param {string} callbackData - Callback data
   * @returns {Promise<boolean>} - True if handled
   */
  async handleCallback(ctx, callbackData) {
    try {
      const userId = ctx.from.id.toString();
      
      // Main navigation
      if (callbackData === 'nav_main') {
        const userProfile = await UserProfile.findOne({ userId });
        await this.showMainMenu(ctx, userProfile);
        await ctx.answerCbQuery('📖 Главное меню');
        return true;
      }

      if (callbackData === 'nav_diary') {
        await this.showDiary(ctx, 1);
        await ctx.answerCbQuery('📚 Дневник цитат');
        return true;
      }

      if (callbackData.startsWith('nav_diary_page_')) {
        const page = parseInt(callbackData.split('_')[3]);
        await this.showDiary(ctx, page);
        await ctx.answerCbQuery(`📄 Страница ${page}`);
        return true;
      }

      if (callbackData === 'nav_stats') {
        await this.showStats(ctx);
        await ctx.answerCbQuery('📊 Статистика');
        return true;
      }

      if (callbackData === 'nav_achievements') {
        await this.showAchievements(ctx);
        await ctx.answerCbQuery('🏆 Достижения');
        return true;
      }

      if (callbackData === 'nav_recommendations') {
        await this.showRecommendations(ctx);
        await ctx.answerCbQuery('💎 Рекомендации Анны');
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

      if (callbackData === 'nav_add_quote') {
        await ctx.editMessageText(
          `✨ Отправьте цитату для сохранения:\n\n` +
          `📝 Пример:\n` +
          `"В каждом слове — целая жизнь" (Марина Цветаева)\n\n` +
          `💡 Можно без автора: "Жизнь прекрасна"`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Назад", callback_data: "nav_main" }]
              ]
            }
          }
        );
        await ctx.answerCbQuery('✨ Ожидаю цитату');
        return true;
      }

      // Settings callbacks
      if (callbackData === 'nav_toggle_reminders') {
        await this._toggleReminders(ctx);
        return true;
      }

      if (callbackData === 'nav_contact') {
        await ctx.editMessageText(
          `💬 Связь с Анной Бусел:\n\n` +
          `📧 Email: anna@busel.com\n` +
          `📱 Telegram: @anna_busel\n\n` +
          `🤖 Также можете написать сложный вопрос прямо боту - ` +
          `я автоматически передам его Анне для персонального ответа.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Настройки", callback_data: "nav_settings" }]
              ]
            }
          }
        );
        await ctx.answerCbQuery('💬 Контакты Анны');
        return true;
      }

      // Unhandled callback
      return false;
      
    } catch (error) {
      logger.error(`🎨 Error in navigation callback: ${error.message}`);
      await ctx.answerCbQuery('❌ Произошла ошибка');
      return false;
    }
  }

  /**
   * Get user statistics
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User stats
   */
  async _getUserStats(userId) {
    try {
      const totalQuotes = await Quote.countDocuments({ userId });
      const userProfile = await UserProfile.findOne({ userId });
      
      // Calculate today's quotes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      // Calculate average per day
      const daysSinceStart = Math.max(1, Math.floor((Date.now() - userProfile.registeredAt) / (1000 * 60 * 60 * 24)));
      const avgPerDay = Math.round((totalQuotes / daysSinceStart) * 10) / 10;

      // Get favorite category
      const categoryStats = await Quote.aggregate([
        { $match: { userId, category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);

      return {
        totalQuotes,
        currentStreak: userProfile.statistics?.currentStreak || 0,
        longestStreak: userProfile.statistics?.longestStreak || 0,
        todayQuotes,
        avgPerDay,
        favoriteCategory: categoryStats[0]?._id
      };
    } catch (error) {
      logger.error(`🎨 Error getting user stats: ${error.message}`);
      return {
        totalQuotes: 0,
        currentStreak: 0,
        longestStreak: 0,
        todayQuotes: 0,
        avgPerDay: 0,
        favoriteCategory: null
      };
    }
  }

  /**
   * Get monthly statistics
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Monthly stats
   */
  async _getMonthlyStats(userId) {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const thisMonthCount = await Quote.countDocuments({
        userId,
        createdAt: { $gte: thisMonth, $lt: nextMonth }
      });

      const lastMonthCount = await Quote.countDocuments({
        userId,
        createdAt: { $gte: lastMonth, $lt: thisMonth }
      });

      const growth = lastMonthCount > 0 
        ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
        : thisMonthCount > 0 ? 100 : 0;

      return {
        count: thisMonthCount,
        growth
      };
    } catch (error) {
      logger.error(`🎨 Error getting monthly stats: ${error.message}`);
      return { count: 0, growth: 0 };
    }
  }

  /**
   * Get top authors
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Top authors
   */
  async _getTopAuthors(userId) {
    try {
      return await Quote.aggregate([
        { $match: { userId, author: { $ne: null, $ne: '' } } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { name: '$_id', count: 1, _id: 0 } }
      ]);
    } catch (error) {
      logger.error(`🎨 Error getting top authors: ${error.message}`);
      return [];
    }
  }

  /**
   * Get category statistics
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Category stats
   */
  async _getCategoryStats(userId) {
    try {
      return await Quote.aggregate([
        { $match: { userId, category: { $ne: null, $ne: '' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]);
    } catch (error) {
      logger.error(`🎨 Error getting category stats: ${error.message}`);
      return [];
    }
  }

  /**
   * Send or edit panel message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {string} text - Panel text
   * @param {Object} keyboard - Inline keyboard
   */
  async _sendOrEditPanel(ctx, text, keyboard) {
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(text, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      }
    } catch (error) {
      // If edit fails, send new message
      if (error.message.includes('message is not modified')) {
        await ctx.answerCbQuery('✅ Уже актуально');
        return;
      }
      
      try {
        await ctx.reply(text, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      } catch (sendError) {
        logger.error(`🎨 Failed to send panel: ${sendError.message}`);
      }
    }
  }

  /**
   * Update user navigation state
   * @private
   * @param {string} userId - User ID
   * @param {string} panel - Current panel
   * @param {Object} context - Additional context
   */
  _updateUserState(userId, panel, context = {}) {
    this.userStates.set(userId, {
      currentPanel: panel,
      context,
      lastActivity: Date.now()
    });
  }

  /**
   * Get greeting by time of day
   * @private
   * @returns {string} - Greeting
   */
  _getGreetingByTime() {
    const hour = new Date().getHours();
    
    if (hour < 6) return '🌙 Доброй ночи,';
    if (hour < 12) return '🌅 Доброе утро,';
    if (hour < 18) return '☀️ Добрый день,';
    return '🌆 Добрый вечер,';
  }

  /**
   * Truncate text for display
   * @private
   * @param {string} text - Original text
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  _truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Calculate achievement progress
   * @private
   * @param {Object} achievement - Achievement definition
   * @param {Object} stats - User stats
   * @returns {Object} - Progress data
   */
  _calculateAchievementProgress(achievement, stats) {
    switch (achievement.requirement) {
      case 'quotes_count':
        return {
          current: Math.min(stats.totalQuotes, achievement.target),
          target: achievement.target
        };
      case 'streak_days':
        return {
          current: Math.min(stats.currentStreak, achievement.target),
          target: achievement.target
        };
      default:
        return { current: 0, target: achievement.target };
    }
  }

  /**
   * Create progress bar
   * @private
   * @param {number} current - Current value
   * @param {number} target - Target value
   * @returns {string} - Progress bar
   */
  _createProgressBar(current, target) {
    const percentage = Math.min(100, Math.round((current / target) * 100));
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get category emoji
   * @private
   * @param {string} category - Category name
   * @returns {string} - Emoji
   */
  _getCategoryEmoji(category) {
    const emojis = {
      'Саморазвитие': '🌱',
      'Любовь': '❤️',
      'Философия': '🤔',
      'Мотивация': '💪',
      'Мудрость': '🧠',
      'Творчество': '🎨',
      'Отношения': '👥'
    };
    return emojis[category] || '📖';
  }

  /**
   * Get next achievement to work on
   * @private
   * @param {Array} allAchievements - All achievements
   * @param {Array} userAchievements - User's achievements
   * @param {Object} stats - User stats
   * @returns {string} - Next achievement description
   */
  _getNextAchievement(allAchievements, userAchievements, stats) {
    const unlockedIds = userAchievements.map(ua => ua.achievementId);
    const nextAchievement = allAchievements.find(a => !unlockedIds.includes(a.id));
    
    if (!nextAchievement) return 'Все достижения получены! 🎉';
    
    const progress = this._calculateAchievementProgress(nextAchievement, stats);
    return `${nextAchievement.icon} ${nextAchievement.name} (${progress.current}/${progress.target})`;
  }

  /**
   * Toggle reminders setting
   * @private
   * @param {Object} ctx - Telegram context
   */
  async _toggleReminders(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userProfile = await UserProfile.findOne({ userId });
      
      const newState = !userProfile.settings?.reminderEnabled;
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          $set: {
            'settings.reminderEnabled': newState
          }
        }
      );

      const message = newState 
        ? '🔔 Напоминания включены! Теперь вы будете получать уведомления о добавлении цитат.'
        : '🔕 Напоминания выключены. Вы можете включить их в любое время.';

      await ctx.editMessageText(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚙️ Настройки", callback_data: "nav_settings" }],
            [{ text: "🔙 Главное меню", callback_data: "nav_main" }]
          ]
        }
      });

      await ctx.answerCbQuery(newState ? '🔔 Включено' : '🔕 Выключено');
      
    } catch (error) {
      logger.error(`🎨 Error toggling reminders: ${error.message}`);
      await ctx.answerCbQuery('❌ Ошибка при изменении настроек');
    }
  }

  /**
   * Clean up stale navigation states
   */
  cleanupStaleStates() {
    const staleThreshold = Date.now() - this.stateCleanupInterval;
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates) {
      if (state.lastActivity < staleThreshold) {
        this.userStates.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🎨 Cleaned up ${cleanedCount} stale navigation states`);
    }
  }

  /**
   * Get navigation stats
   * @returns {Object} - Navigation statistics
   */
  getStats() {
    const panelCounts = {};
    for (const state of this.userStates.values()) {
      panelCounts[state.currentPanel] = (panelCounts[state.currentPanel] || 0) + 1;
    }

    return {
      activeStates: this.userStates.size,
      panelDistribution: panelCounts,
      staleCleanupInterval: this.stateCleanupInterval
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.userStates.clear();
    logger.info('🎨 ModernNavigationHandler cleanup completed');
  }
}

module.exports = { ModernNavigationHandler };