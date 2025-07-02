/**
 * @fileoverview Feedback Handler для проекта "Читатель"
 * Обрабатывает обратную связь от пользователей на отчеты
 */

const { WeeklyReport, MonthlyReport, UserProfile } = require('../../server/models');

/**
 * @typedef {Object} FeedbackData
 * @property {number} rating - Оценка от 1 до 5
 * @property {string} comment - Комментарий пользователя
 * @property {Date} respondedAt - Время ответа
 */

class FeedbackHandler {
  constructor() {
    this.ratingTexts = {
      'excellent': 5,
      'good': 4,
      'bad': 2,
      '5': 5,
      '4': 4,
      '3': 3,
      '2': 2,
      '1': 1
    };

    this.bot = null; // Will be set during initialization
  }

  /**
   * Initialize handler with dependencies
   * @param {Object} dependencies - Required dependencies
   * @param {Object} dependencies.bot - Telegram bot instance
   * @param {Object} dependencies.models - Database models
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    console.log('📝 FeedbackHandler initialized');
  }

  /**
   * Обрабатывает обратную связь на еженедельный отчет
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} rating - Рейтинг (excellent/good/bad)
   * @param {string} reportId - ID отчета
   */
  async handleWeeklyFeedback(ctx, rating, reportId) {
    try {
      const numericRating = this.convertRatingToNumber(rating);
      
      await WeeklyReport.findByIdAndUpdate(reportId, {
        'feedback.rating': numericRating,
        'feedback.respondedAt': new Date()
      });

      let responseMessage;
      let needsDetailedFeedback = false;

      switch (rating) {
        case 'excellent':
          responseMessage = "🎉 Спасибо за отзыв! Рада, что отчет оказался полезным.";
          break;
        case 'good':
          responseMessage = "👌 Спасибо! Что бы вы хотели улучшить в следующих отчетах?";
          needsDetailedFeedback = true;
          break;
        case 'bad':
          responseMessage = "😔 Извините, что отчет не оправдал ожиданий. Что бы вы хотели изменить?";
          needsDetailedFeedback = true;
          break;
        default:
          responseMessage = "📝 Спасибо за оценку!";
      }

      await ctx.editMessageText(responseMessage);

      if (needsDetailedFeedback) {
        await this.requestDetailedFeedback(ctx, reportId, 'weekly');
      }

      console.log(`📝 Weekly feedback processed: ${rating} for report ${reportId}`);

    } catch (error) {
      console.error(`❌ Failed to handle weekly feedback:`, error);
      await ctx.reply("Произошла ошибка при сохранении отзыва. Попробуйте позже.");
    }
  }

  /**
   * Обрабатывает рейтинг месячного отчета
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} rating - Рейтинг от 1 до 5
   * @param {string} reportId - ID отчета
   */
  async handleMonthlyRating(ctx, rating, reportId) {
    try {
      const numericRating = parseInt(rating);
      
      await MonthlyReport.findByIdAndUpdate(reportId, {
        'feedback.rating': numericRating,
        'feedback.respondedAt': new Date()
      });

      let responseMessage;
      let needsDetailedFeedback = false;

      if (numericRating >= 4) {
        responseMessage = "⭐ Благодарю за высокую оценку! Продолжаем развиваться вместе.";
      } else {
        responseMessage = "📝 Спасибо за честную оценку. Что бы вы хотели улучшить?";
        needsDetailedFeedback = true;
      }

      await ctx.editMessageText(responseMessage);

      if (needsDetailedFeedback) {
        await this.requestDetailedFeedback(ctx, reportId, 'monthly');
      }

      console.log(`📈 Monthly rating processed: ${rating} stars for report ${reportId}`);

    } catch (error) {
      console.error(`❌ Failed to handle monthly rating:`, error);
      await ctx.reply("Произошла ошибка при сохранении оценки. Попробуйте позже.");
    }
  }

  /**
   * Запрашивает детальную обратную связь
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} reportId - ID отчета
   * @param {string} type - Тип отчета (weekly/monthly)
   */
  async requestDetailedFeedback(ctx, reportId, type = 'weekly') {
    const message = type === 'monthly' 
      ? "📝 Напишите, что хотели бы изменить или добавить в месячные отчеты:"
      : "📝 Напишите, что хотели бы изменить в еженедельных отчетах:";

    try {
      await ctx.reply(message, {
        reply_markup: { force_reply: true }
      });

      // Устанавливаем состояние ожидания детального отзыва
      await this.setUserState(ctx.from.id, `awaiting_feedback_${type}_${reportId}`);

    } catch (error) {
      console.error(`❌ Failed to request detailed feedback:`, error);
    }
  }

  /**
   * Обрабатывает детальную обратную связь
   * @param {Object} ctx - Контекст Telegram бота
   * @param {string} feedback - Текст обратной связи
   * @param {string} reportId - ID отчета
   * @param {string} type - Тип отчета
   */
  async processDetailedFeedback(ctx, feedback, reportId, type) {
    try {
      if (type === 'monthly') {
        await MonthlyReport.findByIdAndUpdate(reportId, {
          'feedback.comment': feedback
        });
      } else {
        await WeeklyReport.findByIdAndUpdate(reportId, {
          'feedback.comment': feedback
        });
      }

      await ctx.reply("💌 Спасибо за подробный отзыв! Ваше мнение поможет сделать отчеты лучше.");

      // Очищаем состояние пользователя
      await this.clearUserState(ctx.from.id);

      // Уведомление админу о негативной обратной связи
      if (feedback.length > 10) {
        await this.notifyAdminAboutFeedback(ctx.from.id, feedback, type);
      }

      console.log(`💬 Detailed feedback processed for ${type} report ${reportId}`);

    } catch (error) {
      console.error(`❌ Failed to process detailed feedback:`, error);
      await ctx.reply("Произошла ошибка при сохранении отзыва.");
    }
  }

  /**
   * Конвертирует текстовый рейтинг в число
   * @param {string} rating - Текстовый рейтинг
   * @returns {number}
   */
  convertRatingToNumber(rating) {
    return this.ratingTexts[rating] || 3;
  }

  /**
   * Уведомляет админа о негативной обратной связи
   * @param {string} userId - ID пользователя
   * @param {string} feedback - Текст обратной связи
   * @param {string} type - Тип отчета
   */
  async notifyAdminAboutFeedback(userId, feedback, type) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user) return;
      
      const adminMessage = `
📝 *Обратная связь от пользователя*

*Пользователь:* ${user.name} (@${user.telegramUsername})
*Email:* ${user.email}
*Тип отчета:* ${type === 'monthly' ? 'месячный' : 'еженедельный'}

*Отзыв:*
${feedback}

*Дата:* ${new Date().toLocaleDateString()}
      `;

      if (process.env.ADMIN_TELEGRAM_ID && this.bot) {
        await this.bot.telegram.sendMessage(
          process.env.ADMIN_TELEGRAM_ID,
          adminMessage,
          { parse_mode: 'Markdown' }
        );
        console.log(`📧 Admin notified about feedback from user ${userId}`);
      }

    } catch (error) {
      console.error(`❌ Failed to notify admin about feedback:`, error);
    }
  }

  /**
   * Обрабатывает callback от кнопок обратной связи
   * @param {Object} ctx - Контекст Telegram бота
   */
  async handleFeedbackCallback(ctx) {
    const data = ctx.callbackQuery.data;
    
    try {
      if (data.startsWith('feedback_')) {
        // feedback_excellent_reportId или feedback_good_reportId
        const parts = data.split('_');
        const rating = parts[1];
        const reportId = parts[2];
        
        await this.handleWeeklyFeedback(ctx, rating, reportId);
        
      } else if (data.startsWith('monthly_rating_')) {
        // monthly_rating_5_reportId
        const parts = data.split('_');
        const rating = parts[2];
        const reportId = parts[3];
        
        await this.handleMonthlyRating(ctx, rating, reportId);
      }
      
    } catch (error) {
      console.error(`❌ Failed to handle feedback callback:`, error);
      await ctx.answerCbQuery("Произошла ошибка при обработке отзыва");
    }
  }

  /**
   * Получает состояние пользователя для проверки ожидания feedback
   * @param {string} userId - ID пользователя
   * @returns {Promise<string|null>} Текущее состояние или null
   */
  async getUserState(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      return user?.botState?.current || null;
    } catch (error) {
      console.error(`❌ Failed to get user state:`, error);
      return null;
    }
  }

  /**
   * Проверяет, ожидает ли пользователь ввода обратной связи
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object|null>} Информация о состоянии или null
   */
  async checkAwaitingFeedback(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user || !user.botState?.current) return null;

      const state = user.botState.current;
      if (state.startsWith('awaiting_feedback_')) {
        const parts = state.split('_');
        return {
          type: parts[2], // weekly или monthly
          reportId: parts[3]
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to check awaiting feedback state:`, error);
      return null;
    }
  }

  /**
   * Устанавливает состояние пользователя
   * @param {string} userId - ID пользователя
   * @param {string} state - Состояние
   */
  async setUserState(userId, state) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'botState.current': state,
          'botState.updatedAt': new Date()
        },
        { upsert: true }
      );
    } catch (error) {
      console.error(`❌ Failed to set user state:`, error);
    }
  }

  /**
   * Очищает состояние пользователя
   * @param {string} userId - ID пользователя
   */
  async clearUserState(userId) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'botState.current': 'active',
          'botState.updatedAt': new Date()
        }
      );
    } catch (error) {
      console.error(`❌ Failed to clear user state:`, error);
    }
  }

  /**
   * Получает статистику обратной связи для админ-панели
   * @param {Date} startDate - Начальная дата
   * @param {Date} endDate - Конечная дата
   * @returns {Promise<Object>}
   */
  async getFeedbackStats(startDate, endDate) {
    try {
      const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const defaultEndDate = endDate || new Date();

      const weeklyStats = await WeeklyReport.aggregate([
        {
          $match: {
            sentAt: { $gte: defaultStartDate, $lte: defaultEndDate },
            'feedback.rating': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$feedback.rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const monthlyStats = await MonthlyReport.aggregate([
        {
          $match: {
            sentAt: { $gte: defaultStartDate, $lte: defaultEndDate },
            'feedback.rating': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$feedback.rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const negativeComments = await WeeklyReport.find({
        sentAt: { $gte: defaultStartDate, $lte: defaultEndDate },
        'feedback.rating': { $lte: 3 },
        'feedback.comment': { $exists: true }
      }).populate('userId', 'name email');

      return {
        weekly: weeklyStats,
        monthly: monthlyStats,
        negativeComments: negativeComments.length,
        totalResponses: weeklyStats.length + monthlyStats.length
      };

    } catch (error) {
      console.error(`❌ Failed to get feedback stats:`, error);
      return { weekly: [], monthly: [], negativeComments: 0, totalResponses: 0 };
    }
  }

  /**
   * Проверяет готовность сервиса
   * @returns {boolean}
   */
  isReady() {
    return !!this.bot;
  }

  /**
   * Получает диагностическую информацию
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      initialized: !!this.bot,
      ratingOptions: Object.keys(this.ratingTexts),
      status: this.isReady() ? 'ready' : 'not_initialized'
    };
  }
}

module.exports = { FeedbackHandler };
