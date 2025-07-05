/**
 * Enhanced Quote Handler with beautiful confirmation and UI for Reader bot
 * @file telegram/handlers/modernQuoteHandler.js
 * 🎨 VISUAL UX: Beautiful quote cards, elegant confirmations
 * 📖 READER THEME: Book-focused quote processing with Anna Busel persona
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');
const claudeService = require('../../server/services/claude');

/**
 * @typedef {Object} QuoteProcessingResult
 * @property {boolean} success - Whether processing succeeded
 * @property {Object} quote - Processed quote object
 * @property {Object} analysis - AI analysis results
 * @property {Array} achievements - Any new achievements unlocked
 */

/**
 * @class ModernQuoteHandler
 * @description Modern quote handler with beautiful UI and enhanced processing
 */
class ModernQuoteHandler {
  constructor() {
    this.maxQuotesPerDay = 10;
    this.maxQuoteLength = 1000;
    this.processingStates = new Map(); // Track processing states
    
    // Quote templates for beautiful responses
    this.responseTemplates = [
      {
        pattern: 'author_quote',
        templates: [
          '✨ Прекрасная цитата! {author} умеет находить глубину в простых словах.',
          '📖 Замечательный выбор! {author} - один из моих любимых авторов.',
          '💫 Очень глубоко! Эта мысль {author} особенно актуальна.',
          '🌟 Сохранила в ваш личный дневник. {author} всегда вдохновляет!'
        ]
      },
      {
        pattern: 'no_author_quote',
        templates: [
          '💭 Прекрасная собственная мысль! Глубокие размышления.',
          '🌱 Замечательное наблюдение! Ваши мысли очень ценны.',
          '✨ Мудрые слова! Сохранила в ваш дневник.',
          '💡 Отличное размышление! Собственные инсайты особенно важны.'
        ]
      }
    ];

    // Category emojis for beautiful display
    this.categoryEmojis = {
      'Саморазвитие': '🌱',
      'Любовь': '❤️',
      'Философия': '🤔',
      'Мотивация': '💪',
      'Мудрость': '🧠',
      'Творчество': '🎨',
      'Отношения': '👥',
      'Счастье': '😊',
      'Жизнь': '🌟',
      'Успех': '🏆'
    };

    logger.info('🎨 ModernQuoteHandler initialized with beautiful UI');
  }

  /**
   * Handle quote submission with beautiful processing
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Quote text
   * @param {Object} userProfile - User profile
   */
  async handleQuote(ctx, messageText, userProfile) {
    try {
      const userId = ctx.from.id.toString();
      
      // Show processing indicator
      await ctx.sendChatAction('typing');
      
      // Set processing state
      this.processingStates.set(userId, {
        startTime: Date.now(),
        step: 'analyzing'
      });

      // Validate quote
      const validation = await this._validateQuote(userId, messageText);
      if (!validation.valid) {
        await this._sendValidationError(ctx, validation);
        this.processingStates.delete(userId);
        return;
      }

      // Parse quote
      const parsedQuote = this._parseQuote(messageText);
      
      // Update processing state
      this.processingStates.set(userId, {
        startTime: Date.now(),
        step: 'ai_analysis'
      });

      // AI analysis
      const analysis = await this._analyzeQuote(parsedQuote, userProfile);
      
      // Save quote
      const savedQuote = await this._saveQuote(userId, parsedQuote, analysis);
      
      // Update user statistics
      await this._updateUserStatistics(userId, parsedQuote.author);
      
      // Check for achievements
      const achievements = await this._checkAchievements(userId);
      
      // Generate beautiful response
      const response = await this._generateBeautifulResponse(
        parsedQuote, 
        analysis, 
        userProfile, 
        achievements
      );

      // Send response
      await this._sendQuoteConfirmation(ctx, response, savedQuote, achievements);
      
      // Clean up processing state
      this.processingStates.delete(userId);
      
      logger.info(`📖 Quote processed successfully for user ${userId}`);
      
    } catch (error) {
      logger.error(`🎨 Error handling quote: ${error.message}`);
      this.processingStates.delete(ctx.from.id.toString());
      await this._sendErrorMessage(ctx, error);
    }
  }

  /**
   * Validate quote submission
   * @private
   * @param {string} userId - User ID
   * @param {string} messageText - Quote text
   * @returns {Promise<Object>} - Validation result
   */
  async _validateQuote(userId, messageText) {
    try {
      // Check daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayQuotesCount = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      if (todayQuotesCount >= this.maxQuotesPerDay) {
        return {
          valid: false,
          error: 'daily_limit',
          message: `📖 Вы уже отправили ${this.maxQuotesPerDay} цитат сегодня. Возвращайтесь завтра за новыми открытиями!`,
          todayCount: todayQuotesCount
        };
      }

      // Check quote length
      if (messageText.length > this.maxQuoteLength) {
        return {
          valid: false,
          error: 'too_long',
          message: `📖 Цитата слишком длинная (${messageText.length} символов). Максимум ${this.maxQuoteLength} символов.`,
          length: messageText.length
        };
      }

      // Check minimum length
      if (messageText.trim().length < 10) {
        return {
          valid: false,
          error: 'too_short',
          message: '📖 Цитата слишком короткая. Минимум 10 символов для осмысленной мысли.',
          length: messageText.trim().length
        };
      }

      return {
        valid: true,
        todayCount: todayQuotesCount
      };

    } catch (error) {
      logger.error(`🎨 Error validating quote: ${error.message}`);
      return {
        valid: false,
        error: 'validation_error',
        message: '📖 Произошла ошибка при проверке цитаты. Попробуйте еще раз.'
      };
    }
  }

  /**
   * Parse quote text to extract author and content
   * @private
   * @param {string} messageText - Raw message text
   * @returns {Object} - Parsed quote
   */
  _parseQuote(messageText) {
    const text = messageText.trim();
    
    // Patterns to match: "Quote" (Author), Quote (Author), Quote - Author, etc.
    const patterns = [
      /^["«]([^"«»]+)["»]\s*\(\s*([^)]+)\s*\)$/,  // "Quote" (Author)
      /^([^(]+)\s*\(\s*([^)]+)\s*\)$/,             // Quote (Author)
      /^([^—–-]+)\s*[—–-]\s*(.+)$/,               // Quote — Author
      /^(.+)$/                                     // Just text
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          // Has author
          return {
            text: match[1].trim().replace(/^["«]|["»]$/g, ''),
            author: match[2].trim(),
            source: null,
            hasAuthor: true
          };
        } else {
          // No author
          return {
            text: match[1].trim().replace(/^["«]|["»]$/g, ''),
            author: null,
            source: null,
            hasAuthor: false
          };
        }
      }
    }

    // Fallback
    return {
      text: text.replace(/^["«]|["»]$/g, ''),
      author: null,
      source: null,
      hasAuthor: false
    };
  }

  /**
   * Analyze quote with AI
   * @private
   * @param {Object} quote - Parsed quote
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} - Analysis results
   */
  async _analyzeQuote(quote, userProfile) {
    try {
      const prompt = `Проанализируй эту цитату как психолог Анна Бусел для проекта "Читатель":

Цитата: "${quote.text}"
Автор: ${quote.author || 'Неизвестен'}

Контекст пользователя:
- Имя: ${userProfile.name}
- Интересы: ${userProfile.preferences?.mainThemes?.join(', ') || 'развитие'}
- Тип личности: ${userProfile.preferences?.personalityType || 'ищущий'}

Верни JSON анализ:
{
  "category": "одна из: Саморазвитие, Любовь, Философия, Мотивация, Мудрость, Творчество, Отношения, Счастье, Жизнь, Успех",
  "themes": ["тема1", "тема2"],
  "sentiment": "positive/neutral/negative",
  "personalRelevance": "почему эта цитата важна для этого пользователя",
  "insights": "краткий психологический инсайт от Анны",
  "bookRecommendation": "название книги которая подходит к теме цитаты, или null"
}`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'quote_analysis'
      });
      
      return JSON.parse(response.message);
      
    } catch (error) {
      logger.error(`🎨 Error analyzing quote: ${error.message}`);
      
      // Fallback analysis
      return {
        category: 'Мудрость',
        themes: ['размышления'],
        sentiment: 'positive',
        personalRelevance: 'Эта мысль важна для вашего личностного развития',
        insights: 'Глубокая мысль для размышления',
        bookRecommendation: null
      };
    }
  }

  /**
   * Save quote to database
   * @private
   * @param {string} userId - User ID
   * @param {Object} parsedQuote - Parsed quote
   * @param {Object} analysis - AI analysis
   * @returns {Promise<Object>} - Saved quote
   */
  async _saveQuote(userId, parsedQuote, analysis) {
    try {
      const quote = new Quote({
        userId,
        text: parsedQuote.text,
        author: parsedQuote.author,
        source: parsedQuote.source,
        category: analysis.category,
        themes: analysis.themes,
        sentiment: analysis.sentiment,
        weekNumber: this._getWeekNumber(),
        monthNumber: new Date().getMonth() + 1,
        yearNumber: new Date().getFullYear(),
        metadata: {
          personalRelevance: analysis.personalRelevance,
          insights: analysis.insights,
          bookRecommendation: analysis.bookRecommendation
        }
      });

      return await quote.save();
      
    } catch (error) {
      logger.error(`🎨 Error saving quote: ${error.message}`);
      throw new Error('Failed to save quote');
    }
  }

  /**
   * Update user statistics
   * @private
   * @param {string} userId - User ID
   * @param {string} author - Quote author
   */
  async _updateUserStatistics(userId, author) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) return;

      // Update total quotes count
      userProfile.statistics.totalQuotes += 1;

      // Update favorite authors
      if (author && author.trim()) {
        const authorName = author.trim();
        if (!userProfile.statistics.favoriteAuthors.includes(authorName)) {
          userProfile.statistics.favoriteAuthors.push(authorName);
          
          // Keep only last 20 authors
          if (userProfile.statistics.favoriteAuthors.length > 20) {
            userProfile.statistics.favoriteAuthors = 
              userProfile.statistics.favoriteAuthors.slice(-20);
          }
        }
      }

      // Update streak
      await this._updateStreak(userId, userProfile);

      // Update monthly stats
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const monthlyRecord = userProfile.statistics.monthlyQuotes.find(
        m => m.month === currentMonth && m.year === currentYear
      );
      
      if (monthlyRecord) {
        monthlyRecord.count += 1;
      } else {
        userProfile.statistics.monthlyQuotes.push({
          month: currentMonth,
          year: currentYear,
          count: 1
        });
      }

      await userProfile.save();
      
    } catch (error) {
      logger.error(`🎨 Error updating user statistics: ${error.message}`);
    }
  }

  /**
   * Update user streak
   * @private
   * @param {string} userId - User ID
   * @param {Object} userProfile - User profile
   */
  async _updateStreak(userId, userProfile) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if user had quotes yesterday
      const yesterdayQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: yesterday, $lt: today }
      });

      // Check if user had quotes today (before this one)
      const todayQuotesBefore = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      if (todayQuotesBefore === 1) {
        // First quote today
        if (yesterdayQuotes > 0) {
          // Continue streak
          userProfile.statistics.currentStreak += 1;
        } else {
          // Start new streak
          userProfile.statistics.currentStreak = 1;
        }

        // Update longest streak
        if (userProfile.statistics.currentStreak > userProfile.statistics.longestStreak) {
          userProfile.statistics.longestStreak = userProfile.statistics.currentStreak;
        }
      }
      
    } catch (error) {
      logger.error(`🎨 Error updating streak: ${error.message}`);
    }
  }

  /**
   * Check for new achievements
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - New achievements
   */
  async _checkAchievements(userId) {
    try {
      const userProfile = await UserProfile.findOne({ userId });
      const newAchievements = [];

      const achievements = [
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
          id: 'inspiration_seeker',
          name: 'Искатель вдохновения',
          description: '100 цитат собрано',
          icon: '⭐',
          requirement: 'quotes_count',
          target: 100
        }
      ];

      for (const achievement of achievements) {
        // Check if already has this achievement
        if (userProfile.achievements.some(a => a.achievementId === achievement.id)) {
          continue;
        }

        let unlocked = false;

        switch (achievement.requirement) {
          case 'quotes_count':
            unlocked = userProfile.statistics.totalQuotes >= achievement.target;
            break;
          case 'streak_days':
            unlocked = userProfile.statistics.currentStreak >= achievement.target;
            break;
        }

        if (unlocked) {
          userProfile.achievements.push({
            achievementId: achievement.id,
            unlockedAt: new Date()
          });
          newAchievements.push(achievement);
        }
      }

      if (newAchievements.length > 0) {
        await userProfile.save();
      }

      return newAchievements;
      
    } catch (error) {
      logger.error(`🎨 Error checking achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate beautiful response
   * @private
   * @param {Object} quote - Parsed quote
   * @param {Object} analysis - AI analysis
   * @param {Object} userProfile - User profile
   * @param {Array} achievements - New achievements
   * @returns {Promise<Object>} - Response data
   */
  async _generateBeautifulResponse(quote, analysis, userProfile, achievements) {
    try {
      // Select appropriate template
      const templateType = quote.hasAuthor ? 'author_quote' : 'no_author_quote';
      const templates = this.responseTemplates.find(t => t.pattern === templateType);
      const randomTemplate = templates.templates[Math.floor(Math.random() * templates.templates.length)];
      
      // Generate base response
      let baseResponse = randomTemplate.replace('{author}', quote.author || '');
      
      // Add category emoji
      const categoryEmoji = this.categoryEmojis[analysis.category] || '📖';
      
      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({
        userId: userProfile.userId,
        createdAt: { $gte: today }
      });

      // Build response object
      const response = {
        baseMessage: baseResponse,
        category: analysis.category,
        categoryEmoji,
        todayCount: todayQuotes,
        maxDaily: this.maxQuotesPerDay,
        insights: analysis.insights,
        personalRelevance: analysis.personalRelevance,
        bookRecommendation: analysis.bookRecommendation,
        achievements: achievements,
        totalQuotes: userProfile.statistics.totalQuotes + 1,
        currentStreak: userProfile.statistics.currentStreak
      };

      return response;
      
    } catch (error) {
      logger.error(`🎨 Error generating response: ${error.message}`);
      return {
        baseMessage: '✨ Цитата сохранена в ваш дневник!',
        category: 'Мудрость',
        categoryEmoji: '📖',
        todayCount: 1,
        maxDaily: this.maxQuotesPerDay,
        insights: 'Прекрасная мысль для размышления',
        personalRelevance: 'Важно для развития',
        bookRecommendation: null,
        achievements: [],
        totalQuotes: 1,
        currentStreak: 1
      };
    }
  }

  /**
   * Send beautiful quote confirmation
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Object} response - Response data
   * @param {Object} quote - Saved quote
   * @param {Array} achievements - New achievements
   */
  async _sendQuoteConfirmation(ctx, response, quote, achievements) {
    try {
      // Main confirmation message
      let confirmationText = `
╭─────────────────────────╮
│   ✅ ЦИТАТА СОХРАНЕНА   │
╰─────────────────────────╯

${response.baseMessage}

┌─────────────────────────┐
│       СТАТИСТИКА        │
└─────────────────────────┘
${response.categoryEmoji} Категория: ${response.category}
📊 Сегодня: ${response.todayCount}/${response.maxDaily}
📚 Всего цитат: ${response.totalQuotes}
🔥 Серия дней: ${response.currentStreak}

💡 ${response.insights}`;

      // Add book recommendation if available
      if (response.bookRecommendation) {
        confirmationText += `
        
📖 Кстати, если вас привлекает эта тема, 
   рекомендую разбор "${response.bookRecommendation}" 
   от Анны.`;
      }

      // Keyboard with actions
      const keyboard = {
        inline_keyboard: [
          [
            { text: "📚 Мой дневник", callback_data: "nav_diary" },
            { text: "📊 Статистика", callback_data: "nav_stats" }
          ],
          [
            { text: "✨ Еще цитату", callback_data: "nav_add_quote" },
            { text: "📖 Главное меню", callback_data: "nav_main" }
          ]
        ]
      };

      await ctx.reply(confirmationText, { reply_markup: keyboard });

      // Send achievement notifications separately
      if (achievements.length > 0) {
        for (const achievement of achievements) {
          const achievementMessage = `
🎉 *ПОЗДРАВЛЯЮ!*

Вы получили достижение:

${achievement.icon} *${achievement.name}*
${achievement.description}

Продолжайте собирать моменты вдохновения! 📖`;

          await ctx.reply(achievementMessage, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏆 Все достижения", callback_data: "nav_achievements" }]
              ]
            }
          });
        }
      }
      
    } catch (error) {
      logger.error(`🎨 Error sending quote confirmation: ${error.message}`);
      await ctx.reply('✅ Цитата сохранена в ваш дневник!\n\nИспользуйте /menu для навигации.');
    }
  }

  /**
   * Send validation error message
   * @private
   * @param {Object} ctx - Telegram context
   * @param {Object} validation - Validation result
   */
  async _sendValidationError(ctx, validation) {
    try {
      let errorPanel = `
╭─────────────────────────╮
│     ⚠️ ВНИМАНИЕ        │
╰─────────────────────────╯

${validation.message}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "📖 Главное меню", callback_data: "nav_main" }]
        ]
      };

      if (validation.error === 'daily_limit') {
        errorPanel += `

┌─────────────────────────┐
│    А ПОКА МОЖЕТЕ:       │
└─────────────────────────┘
📚 Посмотреть дневник цитат
📊 Изучить статистику
💎 Почитать рекомендации Анны

💡 Завтра вас ждут новые 
   возможности для сбора мудрости!`;

        keyboard.inline_keyboard.unshift(
          [
            { text: "📚 Мой дневник", callback_data: "nav_diary" },
            { text: "📊 Статистика", callback_data: "nav_stats" }
          ]
        );
      }

      await ctx.reply(errorPanel, { reply_markup: keyboard });
      
    } catch (error) {
      logger.error(`🎨 Error sending validation error: ${error.message}`);
      await ctx.reply(validation.message || '📖 Произошла ошибка при обработке цитаты.');
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
      let errorMessage = '📖 Произошла ошибка при обработке цитаты. Попробуйте еще раз через минуту.';

      if (error.message.includes('validation')) {
        errorMessage = '📖 Ошибка валидации цитаты. Проверьте формат и попробуйте снова.';
      } else if (error.message.includes('save')) {
        errorMessage = '📖 Ошибка сохранения цитаты. Попробуйте еще раз.';
      }

      const errorPanel = `
╭─────────────────────────╮
│      ❌ ОШИБКА         │
╰─────────────────────────╯

${errorMessage}

💡 Если проблема повторяется, 
   обратитесь к Анне через 
   раздел "Помощь".`;

      await ctx.reply(errorPanel, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Попробовать снова", callback_data: "nav_add_quote" }],
            [{ text: "💬 Связаться с Анной", callback_data: "nav_contact" }],
            [{ text: "📖 Главное меню", callback_data: "nav_main" }]
          ]
        }
      });
      
    } catch (sendError) {
      logger.error(`🎨 Failed to send error message: ${sendError.message}`);
      await ctx.reply('📖 Произошла ошибка. Попробуйте /start');
    }
  }

  /**
   * Get current week number
   * @private
   * @returns {number} - ISO week number
   */
  _getWeekNumber() {
    const date = new Date();
    const onejan = new Date(date.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    return Math.ceil((((date - onejan) / millisecsInDay) + onejan.getDay() + 1) / 7);
  }

  /**
   * Get quote handler statistics
   * @returns {Object} - Quote handler stats
   */
  getStats() {
    return {
      processingStates: this.processingStates.size,
      maxQuotesPerDay: this.maxQuotesPerDay,
      maxQuoteLength: this.maxQuoteLength,
      templateCount: this.responseTemplates.length,
      categoryCount: Object.keys(this.categoryEmojis).length
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.processingStates.clear();
    logger.info('🎨 ModernQuoteHandler cleanup completed');
  }
}

module.exports = { ModernQuoteHandler };