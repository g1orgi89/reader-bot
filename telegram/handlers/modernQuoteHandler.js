/**
 * Clean Quote Handler - simple responses for Reader bot
 * @file telegram/handlers/modernQuoteHandler.js
 * 🎨 CLEAN UX: Simple text responses, no visual spam
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');
const claudeService = require('../../server/services/claude');

class ModernQuoteHandler {
  constructor() {
    this.dailyQuoteLimit = 10;
    
    // Simple response templates
    this.responseTemplates = [
      '✨ Прекрасная цитата!',
      '📖 Замечательный выбор!',
      '💭 Очень глубоко!',
      '🌟 Сохранил в ваш личный дневник.',
      '💡 Мудрые слова!',
      '❤️ Прекрасная мысль!'
    ];

    logger.info('✅ ModernQuoteHandler initialized with clean responses');
  }

  /**
   * Handle quote submission
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Quote text
   */
  async handleQuote(ctx, messageText) {
    try {
      const userId = ctx.from.id.toString();
      
      // Check daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayQuotesCount = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      if (todayQuotesCount >= this.dailyQuoteLimit) {
        await ctx.reply(
          '📖 Вы уже отправили 10 цитат сегодня.\n\n' +
          'Возвращайтесь завтра за новыми открытиями!'
        );
        return;
      }

      // Parse quote
      const { text, author, source } = this._parseQuote(messageText);
      
      // Get user profile for personalized response
      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) {
        await ctx.reply('📖 Пожалуйста, сначала пройдите регистрацию: /start');
        return;
      }

      // AI analysis
      const analysis = await this._analyzeQuote(text, author);
      
      // Save quote
      const quote = new Quote({
        userId,
        text,
        author,
        source,
        category: analysis.category,
        themes: analysis.themes,
        sentiment: analysis.sentiment,
        weekNumber: this._getWeekNumber(),
        monthNumber: new Date().getMonth() + 1,
        yearNumber: new Date().getFullYear()
      });

      await quote.save();

      // Update user statistics
      await this._updateUserStatistics(userId, author);

      // Check achievements
      const achievements = await this._checkAchievements(userId);

      // Generate response
      const response = await this._generateResponse(text, author, analysis, userProfile, todayQuotesCount + 1);
      
      await ctx.reply(response);

      // Notify achievements
      if (achievements.length > 0) {
        await this._notifyAchievements(ctx, achievements);
      }

    } catch (error) {
      logger.error(`Error handling quote: ${error.message}`);
      await ctx.reply('📖 Произошла ошибка при сохранении цитаты. Попробуйте еще раз.');
    }
  }

  /**
   * Parse quote text to extract author and content
   * @private
   */
  _parseQuote(messageText) {
    // Remove extra whitespace
    const cleanText = messageText.trim();

    // Patterns to match: "Quote" (Author), Quote (Author), Quote - Author
    const patterns = [
      /^"([^"]+)"\s*\(([^)]+)\)$/,     // "Quote" (Author)
      /^([^(]+)\s*\(([^)]+)\)$/,       // Quote (Author)
      /^([^-]+)\s*-\s*(.+)$/,          // Quote - Author
      /^(.+)$/                         // Just text
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
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

    return { text: cleanText, author: null, source: null };
  }

  /**
   * Analyze quote with AI
   * @private
   */
  async _analyzeQuote(text, author) {
    try {
      const prompt = `Проанализируй эту цитату как психолог Анна Бусел:

Цитата: "${text}"
Автор: ${author || 'Неизвестен'}

Верни JSON с анализом:
{
  "category": "одна из: Саморазвитие, Любовь, Философия, Мотивация, Мудрость, Творчество, Отношения",
  "themes": ["тема1", "тема2"],
  "sentiment": "positive/neutral/negative",
  "insights": "краткий психологический инсайт"
}`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: 'quote_analysis'
      });
      
      return JSON.parse(response.message);
    } catch (error) {
      logger.error(`Error analyzing quote: ${error.message}`);
      
      // Fallback analysis
      return {
        category: 'Мудрость',
        themes: ['жизненный опыт'],
        sentiment: 'positive',
        insights: 'Глубокая мысль для размышления'
      };
    }
  }

  /**
   * Generate personalized response
   * @private
   */
  async _generateResponse(text, author, analysis, userProfile, weeklyCount) {
    const randomTemplate = this.responseTemplates[Math.floor(Math.random() * this.responseTemplates.length)];
    
    let response = randomTemplate;
    
    // Add author comment
    if (author) {
      response += ` ${author} умеет находить глубину в простых словах.`;
    } else {
      response += ' Прекрасная собственная мысль!';
    }

    // Add save confirmation
    response += '\n\n📊 Сохранил в ваш личный дневник';
    response += `\n📝 Цитат на этой неделе: ${weeklyCount}`;

    // Sometimes add book recommendation
    if (Math.random() < 0.3 && analysis.category) {
      const recommendation = await this._getBookRecommendation(analysis.category);
      if (recommendation) {
        response += `\n\n💡 Кстати, если вас привлекает тема ${analysis.category.toLowerCase()}, у Анны есть разбор "${recommendation}".`;
      }
    }

    return response;
  }

  /**
   * Get book recommendation based on category
   * @private
   */
  async _getBookRecommendation(category) {
    const recommendations = {
      'Саморазвитие': 'Быть собой',
      'Любовь': 'Искусство любить',
      'Философия': 'Письма к молодому поэту',
      'Мотивация': 'Алхимик',
      'Мудрость': 'Маленький принц',
      'Творчество': 'Письма к молодому поэту',
      'Отношения': 'Искусство любить'
    };

    return recommendations[category] || null;
  }

  /**
   * Update user statistics
   * @private
   */
  async _updateUserStatistics(userId, author) {
    try {
      const profile = await UserProfile.findOne({ userId });
      if (!profile) return;

      // Update total quotes
      profile.statistics.totalQuotes += 1;

      // Update favorite authors
      if (author && !profile.statistics.favoriteAuthors.includes(author)) {
        profile.statistics.favoriteAuthors.push(author);
        if (profile.statistics.favoriteAuthors.length > 10) {
          profile.statistics.favoriteAuthors = profile.statistics.favoriteAuthors.slice(-10);
        }
      }

      // Update streak
      const lastQuote = await Quote.findOne({ userId })
        .sort({ createdAt: -1 })
        .skip(1);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (lastQuote) {
        const lastQuoteDate = new Date(lastQuote.createdAt);
        lastQuoteDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today - lastQuoteDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Continue streak
          profile.statistics.currentStreak += 1;
          if (profile.statistics.currentStreak > profile.statistics.longestStreak) {
            profile.statistics.longestStreak = profile.statistics.currentStreak;
          }
        } else if (daysDiff > 1) {
          // Break streak
          profile.statistics.currentStreak = 1;
        }
      } else {
        // First quote
        profile.statistics.currentStreak = 1;
        profile.statistics.longestStreak = 1;
      }

      await profile.save();
    } catch (error) {
      logger.error(`Error updating user statistics: ${error.message}`);
    }
  }

  /**
   * Check for new achievements
   * @private
   */
  async _checkAchievements(userId) {
    try {
      const profile = await UserProfile.findOne({ userId });
      const newAchievements = [];

      const achievements = [
        {
          id: 'first_quote',
          name: 'Первые шаги',
          description: 'Сохранили первую цитату',
          icon: '🌱',
          targetValue: 1,
          type: 'quotes_count'
        },
        {
          id: 'wisdom_collector',
          name: 'Коллекционер мудрости', 
          description: 'Собрали 25 цитат',
          icon: '📚',
          targetValue: 25,
          type: 'quotes_count'
        },
        {
          id: 'week_philosopher',
          name: 'Философ недели',
          description: '7 дней подряд с цитатами',
          icon: '🔥',
          targetValue: 7,
          type: 'streak_days'
        },
        {
          id: 'classics_lover',
          name: 'Любитель классики',
          description: '10 цитат классиков',
          icon: '📖',
          targetValue: 10,
          type: 'classics_count'
        }
      ];

      for (const achievement of achievements) {
        // Check if already unlocked
        if (profile.achievements.some(a => a.achievementId === achievement.id)) {
          continue;
        }

        let unlocked = false;

        switch (achievement.type) {
          case 'quotes_count':
            unlocked = profile.statistics.totalQuotes >= achievement.targetValue;
            break;
          case 'streak_days':
            unlocked = profile.statistics.currentStreak >= achievement.targetValue;
            break;
          case 'classics_count':
            const classicsCount = await Quote.countDocuments({
              userId,
              author: { $in: ['Толстой', 'Достоевский', 'Пушкин', 'Чехов', 'Тургенев'] }
            });
            unlocked = classicsCount >= achievement.targetValue;
            break;
        }

        if (unlocked) {
          profile.achievements.push({
            achievementId: achievement.id,
            unlockedAt: new Date()
          });
          newAchievements.push(achievement);
        }
      }

      if (newAchievements.length > 0) {
        await profile.save();
      }

      return newAchievements;
    } catch (error) {
      logger.error(`Error checking achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Notify about achievements - simple messages
   * @private
   */
  async _notifyAchievements(ctx, achievements) {
    for (const achievement of achievements) {
      const message = 
        `🎉 Поздравляю!\n\n` +
        `Вы получили достижение:\n` +
        `${achievement.icon} ${achievement.name}\n` +
        `${achievement.description}\n\n` +
        `Продолжайте собирать моменты вдохновения!`;

      await ctx.reply(message);
    }
  }

  /**
   * Get current week number
   * @private
   */
  _getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  /**
   * Validate if message is a quote
   */
  isQuote(messageText) {
    if (!messageText || typeof messageText !== 'string') return false;
    
    const text = messageText.trim();
    
    // Too short
    if (text.length < 10) return false;
    
    // Too long
    if (text.length > 1000) return false;
    
    // Commands or obvious non-quotes
    if (text.startsWith('/')) return false;
    if (text.toLowerCase().includes('привет')) return false;
    if (text.toLowerCase().includes('спасибо')) return false;
    
    return true;
  }

  /**
   * Get quote statistics for user
   */
  async getQuoteStats(userId) {
    try {
      const profile = await UserProfile.findOne({ userId });
      const totalQuotes = await Quote.countDocuments({ userId });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: weekStart }
      });

      return {
        total: totalQuotes,
        today: todayQuotes,
        week: weekQuotes,
        streak: profile?.statistics?.currentStreak || 0,
        longestStreak: profile?.statistics?.longestStreak || 0,
        favoriteAuthors: profile?.statistics?.favoriteAuthors || [],
        achievements: profile?.achievements?.length || 0
      };
    } catch (error) {
      logger.error(`Error getting quote stats: ${error.message}`);
      return null;
    }
  }
}

module.exports = { ModernQuoteHandler };
