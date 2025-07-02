/**
 * @fileoverview Обработчик обратной связи от пользователей для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/logger');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').MonthlyReport} MonthlyReport
 * @typedef {import('../types/reader').UserProfile} UserProfile
 */

/**
 * Обработчик обратной связи от пользователей
 */
class FeedbackHandler {
  constructor() {
    this.bot = null;
    this.models = null;
    
    logger.info('📖 FeedbackHandler initialized');
  }

  /**
   * Инициализация обработчика с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.bot - Telegram bot
   * @param {Object} dependencies.models - Модели базы данных
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    this.models = dependencies.models;
    
    logger.info('📖 FeedbackHandler dependencies initialized');
  }

  /**
   * Обработка обратной связи на еженедельный отчет
   * @param {Object} ctx - Telegram context
   * @param {string} rating - Рейтинг (excellent, good, bad)
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async handleWeeklyFeedback(ctx, rating, reportId) {
    try {
      const { WeeklyReport } = this.models;
      
      // Обновляем отчет с обратной связью
      const report = await WeeklyReport.findByIdAndUpdate(reportId, {
        'feedback.rating': this.convertRatingToNumber(rating),
        'feedback.respondedAt': new Date()
      }, { new: true });

      if (!report) {
        logger.warn(`📖 Weekly report ${reportId} not found for feedback`);
        await ctx.answerCbQuery('Отчет не найден');
        return;
      }

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
          responseMessage = "Спасибо за обратную связь!";
      }

      // Редактируем исходное сообщение
      await ctx.editMessageText(responseMessage);
      await ctx.answerCbQuery('✅ Спасибо за отзыв!');

      // Запрашиваем детальную обратную связь если нужно
      if (needsDetailedFeedback) {
        await this.requestDetailedFeedback(ctx, reportId, 'weekly');
      }

      // Логируем обратную связь
      logger.info(`📖 Weekly feedback received: ${rating} for report ${reportId} from user ${ctx.from.id}`);

      // Уведомляем админа о негативной обратной связи
      if (rating === 'bad') {
        await this.notifyAdminAboutNegativeFeedback(ctx.from.id, reportId, 'weekly', rating);
      }

    } catch (error) {
      logger.error(`📖 Error handling weekly feedback: ${error.message}`, error);
      await ctx.answerCbQuery('❌ Произошла ошибка');
    }
  }

  /**
   * Обработка рейтинга месячного отчета
   * @param {Object} ctx - Telegram context
   * @param {number} rating - Рейтинг 1-5 звезд
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async handleMonthlyRating(ctx, rating, reportId) {
    try {
      const { MonthlyReport } = this.models;
      
      const report = await MonthlyReport.findByIdAndUpdate(reportId, {
        'feedback.rating': parseInt(rating),
        'feedback.respondedAt': new Date()
      }, { new: true });

      if (!report) {
        logger.warn(`📖 Monthly report ${reportId} not found for rating`);
        await ctx.answerCbQuery('Отчет не найден');
        return;
      }

      let responseMessage;
      
      if (parseInt(rating) >= 4) {
        responseMessage = "⭐ Благодарю за высокую оценку! Продолжаем развиваться вместе.";
        await ctx.editMessageText(responseMessage);
      } else {
        responseMessage = "📝 Спасибо за честную оценку. Что бы вы хотели улучшить?";
        await ctx.editMessageText(responseMessage);
        await this.requestDetailedFeedback(ctx, reportId, 'monthly');
      }

      await ctx.answerCbQuery(`✅ Оценка ${rating} ⭐ учтена!`);

      logger.info(`📖 Monthly rating received: ${rating} stars for report ${reportId} from user ${ctx.from.id}`);

      // Уведомляем админа о низкой оценке
      if (parseInt(rating) <= 2) {
        await this.notifyAdminAboutNegativeFeedback(ctx.from.id, reportId, 'monthly', `${rating} stars`);
      }

    } catch (error) {
      logger.error(`📖 Error handling monthly rating: ${error.message}`, error);
      await ctx.answerCbQuery('❌ Произошла ошибка');
    }
  }

  /**
   * Запрос детальной обратной связи
   * @param {Object} ctx - Telegram context
   * @param {string} reportId - ID отчета
   * @param {string} type - Тип отчета (weekly/monthly)
   * @returns {Promise<void>}
   */
  async requestDetailedFeedback(ctx, reportId, type = 'weekly') {
    try {
      const message = type === 'monthly' 
        ? "📝 Расскажите подробнее, что хотели бы изменить или добавить в месячные отчеты:"
        : "📝 Что бы вы хотели изменить в еженедельных отчетах?";

      await ctx.reply(message, {
        reply_markup: { force_reply: true }
      });

      // Устанавливаем состояние ожидания детального отзыва
      await this.setUserState(ctx.from.id, `awaiting_feedback_${type}_${reportId}`);

      logger.info(`📖 Detailed feedback requested for ${type} report ${reportId} from user ${ctx.from.id}`);

    } catch (error) {
      logger.error(`📖 Error requesting detailed feedback: ${error.message}`, error);
    }
  }

  /**
   * Обработка детальной обратной связи
   * @param {Object} ctx - Telegram context
   * @param {string} feedback - Текст обратной связи
   * @param {string} reportId - ID отчета
   * @param {string} type - Тип отчета
   * @returns {Promise<void>}
   */
  async processDetailedFeedback(ctx, feedback, reportId, type) {
    try {
      const { WeeklyReport, MonthlyReport } = this.models;

      // Сохраняем детальную обратную связь
      if (type === 'monthly') {
        await MonthlyReport.findByIdAndUpdate(reportId, {
          'feedback.whatImprove': feedback
        });
      } else {
        await WeeklyReport.findByIdAndUpdate(reportId, {
          'feedback.comment': feedback
        });
      }

      await ctx.reply("💌 Спасибо за подробный отзыв! Ваше мнение поможет сделать отчеты лучше.");

      // Очищаем состояние пользователя
      await this.clearUserState(ctx.from.id);

      logger.info(`📖 Detailed feedback saved for ${type} report ${reportId} from user ${ctx.from.id}`);

      // Уведомляем админа о детальной обратной связи
      if (feedback.length > 10) {
        await this.notifyAdminAboutDetailedFeedback(ctx.from.id, feedback, type, reportId);
      }

    } catch (error) {
      logger.error(`📖 Error processing detailed feedback: ${error.message}`, error);
      await ctx.reply("❌ Произошла ошибка при сохранении отзыва.");
    }
  }

  /**
   * Обработка расширенной обратной связи на месячный отчет
   * @param {Object} ctx - Telegram context
   * @param {Object} feedbackData - Данные обратной связи
   * @param {string} feedbackData.whatLikes - Что нравится
   * @param {string} feedbackData.whatImprove - Что улучшить
   * @param {string} feedbackData.newFeatures - Новые функции
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async handleExtendedMonthlyFeedback(ctx, feedbackData, reportId) {
    try {
      const { MonthlyReport } = this.models;

      await MonthlyReport.findByIdAndUpdate(reportId, {
        'feedback.whatLikes': feedbackData.whatLikes,
        'feedback.whatImprove': feedbackData.whatImprove,
        'feedback.newFeatures': feedbackData.newFeatures,
        'feedback.respondedAt': new Date()
      });

      await ctx.reply("🙏 Благодарю за развернутую обратную связь! Ваши пожелания очень важны для улучшения сервиса.");

      logger.info(`📖 Extended monthly feedback saved for report ${reportId} from user ${ctx.from.id}`);

      // Отправляем админу полную обратную связь
      await this.notifyAdminAboutExtendedFeedback(ctx.from.id, feedbackData, reportId);

    } catch (error) {
      logger.error(`📖 Error handling extended monthly feedback: ${error.message}`, error);
      await ctx.reply("❌ Произошла ошибка при сохранении отзыва.");
    }
  }

  /**
   * Уведомление админа о негативной обратной связи
   * @param {string} userId - ID пользователя
   * @param {string} reportId - ID отчета
   * @param {string} type - Тип отчета
   * @param {string} rating - Оценка
   * @returns {Promise<void>}
   */
  async notifyAdminAboutNegativeFeedback(userId, reportId, type, rating) {
    try {
      if (!process.env.ADMIN_TELEGRAM_ID) {
        return;
      }

      const { UserProfile } = this.models;
      const user = await UserProfile.findOne({ userId });

      if (!user) {
        return;
      }

      const adminMessage = `🔔 *Негативная обратная связь*

*Тип отчета:* ${type === 'monthly' ? 'месячный' : 'еженедельный'}
*Оценка:* ${rating}
*Пользователь:* ${user.name} (@${user.telegramUsername || 'не указан'})
*Email:* ${user.email}
*ID отчета:* ${reportId}

*Дата:* ${new Date().toLocaleDateString()}

Требуется внимание для улучшения качества отчетов.`;

      await this.bot.telegram.sendMessage(
        process.env.ADMIN_TELEGRAM_ID,
        adminMessage,
        { parse_mode: 'Markdown' }
      );

      logger.info(`📖 Admin notified about negative feedback from user ${userId}`);

    } catch (error) {
      logger.error(`📖 Error notifying admin about negative feedback: ${error.message}`, error);
    }
  }

  /**
   * Уведомление админа о детальной обратной связи
   * @param {string} userId - ID пользователя
   * @param {string} feedback - Текст обратной связи
   * @param {string} type - Тип отчета
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async notifyAdminAboutDetailedFeedback(userId, feedback, type, reportId) {
    try {
      if (!process.env.ADMIN_TELEGRAM_ID) {
        return;
      }

      const { UserProfile } = this.models;
      const user = await UserProfile.findOne({ userId });

      if (!user) {
        return;
      }

      const adminMessage = `📝 *Детальная обратная связь*

*Пользователь:* ${user.name} (@${user.telegramUsername || 'не указан'})
*Email:* ${user.email}
*Тип отчета:* ${type === 'monthly' ? 'месячный' : 'еженедельный'}
*ID отчета:* ${reportId}

*Отзыв:*
${feedback}

*Дата:* ${new Date().toLocaleDateString()}`;

      await this.bot.telegram.sendMessage(
        process.env.ADMIN_TELEGRAM_ID,
        adminMessage,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      logger.error(`📖 Error notifying admin about detailed feedback: ${error.message}`, error);
    }
  }

  /**
   * Уведомление админа о расширенной обратной связи
   * @param {string} userId - ID пользователя
   * @param {Object} feedbackData - Данные обратной связи
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async notifyAdminAboutExtendedFeedback(userId, feedbackData, reportId) {
    try {
      if (!process.env.ADMIN_TELEGRAM_ID) {
        return;
      }

      const { UserProfile } = this.models;
      const user = await UserProfile.findOne({ userId });

      if (!user) {
        return;
      }

      const adminMessage = `📋 *Расширенная обратная связь по месячному отчету*

*Пользователь:* ${user.name} (@${user.telegramUsername || 'не указан'})
*Email:* ${user.email}
*ID отчета:* ${reportId}

*Что нравится:*
${feedbackData.whatLikes || 'Не указано'}

*Что улучшить:*
${feedbackData.whatImprove || 'Не указано'}

*Новые функции:*
${feedbackData.newFeatures || 'Не указано'}

*Дата:* ${new Date().toLocaleDateString()}`;

      await this.bot.telegram.sendMessage(
        process.env.ADMIN_TELEGRAM_ID,
        adminMessage,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      logger.error(`📖 Error notifying admin about extended feedback: ${error.message}`, error);
    }
  }

  /**
   * Получение статистики обратной связи
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Object>} Статистика
   */
  async getFeedbackStats(startDate = null) {
    try {
      const { WeeklyReport, MonthlyReport } = this.models;

      const match = {};
      if (startDate) {
        match['feedback.respondedAt'] = { $gte: startDate };
      } else {
        match['feedback.respondedAt'] = { $exists: true, $ne: null };
      }

      // Статистика еженедельных отчетов
      const weeklyStats = await WeeklyReport.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalFeedbacks: { $sum: 1 },
            averageRating: { $avg: '$feedback.rating' },
            ratingDistribution: {
              $push: '$feedback.rating'
            }
          }
        }
      ]);

      // Статистика месячных отчетов
      const monthlyStats = await MonthlyReport.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalFeedbacks: { $sum: 1 },
            averageRating: { $avg: '$feedback.rating' },
            ratingDistribution: {
              $push: '$feedback.rating'
            }
          }
        }
      ]);

      // Подсчитываем распределение оценок
      const processRatingDistribution = (ratings) => {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(rating => {
          if (rating >= 1 && rating <= 5) {
            distribution[rating]++;
          }
        });
        return distribution;
      };

      return {
        weekly: {
          totalFeedbacks: weeklyStats[0]?.totalFeedbacks || 0,
          averageRating: Math.round((weeklyStats[0]?.averageRating || 0) * 10) / 10,
          ratingDistribution: weeklyStats[0] ? processRatingDistribution(weeklyStats[0].ratingDistribution) : {}
        },
        monthly: {
          totalFeedbacks: monthlyStats[0]?.totalFeedbacks || 0,
          averageRating: Math.round((monthlyStats[0]?.averageRating || 0) * 10) / 10,
          ratingDistribution: monthlyStats[0] ? processRatingDistribution(monthlyStats[0].ratingDistribution) : {}
        }
      };

    } catch (error) {
      logger.error(`📖 Error getting feedback stats: ${error.message}`, error);
      return {
        weekly: { totalFeedbacks: 0, averageRating: 0, ratingDistribution: {} },
        monthly: { totalFeedbacks: 0, averageRating: 0, ratingDistribution: {} }
      };
    }
  }

  /**
   * Получение последних комментариев
   * @param {number} [limit=10] - Количество комментариев
   * @returns {Promise<Array>} Комментарии
   */
  async getRecentComments(limit = 10) {
    try {
      const { WeeklyReport, MonthlyReport } = this.models;

      // Получаем комментарии из еженедельных отчетов
      const weeklyComments = await WeeklyReport.find({
        'feedback.comment': { $exists: true, $ne: null, $ne: '' }
      })
      .sort({ 'feedback.respondedAt': -1 })
      .limit(limit)
      .select('userId feedback.comment feedback.respondedAt feedback.rating')
      .lean();

      // Получаем комментарии из месячных отчетов
      const monthlyComments = await MonthlyReport.find({
        $or: [
          { 'feedback.whatImprove': { $exists: true, $ne: null, $ne: '' } },
          { 'feedback.whatLikes': { $exists: true, $ne: null, $ne: '' } },
          { 'feedback.newFeatures': { $exists: true, $ne: null, $ne: '' } }
        ]
      })
      .sort({ 'feedback.respondedAt': -1 })
      .limit(limit)
      .select('userId feedback')
      .lean();

      // Объединяем и сортируем
      const allComments = [
        ...weeklyComments.map(c => ({
          type: 'weekly',
          userId: c.userId,
          comment: c.feedback.comment,
          rating: c.feedback.rating,
          respondedAt: c.feedback.respondedAt
        })),
        ...monthlyComments.map(c => ({
          type: 'monthly',
          userId: c.userId,
          whatLikes: c.feedback.whatLikes,
          whatImprove: c.feedback.whatImprove,
          newFeatures: c.feedback.newFeatures,
          rating: c.feedback.rating,
          respondedAt: c.feedback.respondedAt
        }))
      ];

      return allComments
        .sort((a, b) => new Date(b.respondedAt) - new Date(a.respondedAt))
        .slice(0, limit);

    } catch (error) {
      logger.error(`📖 Error getting recent comments: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Вспомогательные методы
   */

  /**
   * Конвертация текстового рейтинга в число
   * @param {string} rating - Текстовый рейтинг
   * @returns {number} Числовой рейтинг
   */
  convertRatingToNumber(rating) {
    switch (rating) {
      case 'excellent': return 5;
      case 'good': return 4;
      case 'bad': return 2;
      default: return 3;
    }
  }

  /**
   * Установка состояния пользователя
   * @param {string} userId - ID пользователя
   * @param {string} state - Состояние
   * @returns {Promise<void>}
   */
  async setUserState(userId, state) {
    try {
      const { UserProfile } = this.models;
      await UserProfile.findOneAndUpdate(
        { userId },
        { currentState: state },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`📖 Error setting user state: ${error.message}`, error);
    }
  }

  /**
   * Очистка состояния пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async clearUserState(userId) {
    try {
      const { UserProfile } = this.models;
      await UserProfile.findOneAndUpdate(
        { userId },
        { $unset: { currentState: 1 } }
      );
    } catch (error) {
      logger.error(`📖 Error clearing user state: ${error.message}`, error);
    }
  }

  /**
   * Проверка состояния пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<string|null>} Текущее состояние
   */
  async getUserState(userId) {
    try {
      const { UserProfile } = this.models;
      const user = await UserProfile.findOne({ userId }).select('currentState');
      return user?.currentState || null;
    } catch (error) {
      logger.error(`📖 Error getting user state: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Проверка готовности обработчика
   * @returns {boolean} Готовность к работе
   */
  isReady() {
    return !!(this.bot && this.models);
  }

  /**
   * Получение диагностической информации
   * @returns {Object} Диагностика
   */
  getDiagnostics() {
    return {
      initialized: this.isReady(),
      hasBot: !!this.bot,
      hasModels: !!this.models,
      supportedFeedbackTypes: ['weekly', 'monthly'],
      adminNotifications: !!process.env.ADMIN_TELEGRAM_ID
    };
  }
}

module.exports = { FeedbackHandler };
