/**
 * @fileoverview Обработчик отправки еженедельных отчетов в Telegram
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { WeeklyReportService } = require('../../server/services/weeklyReportService');

/**
 * @typedef {import('../../server/types/reader').WeeklyReport} WeeklyReport
 */

/**
 * Обработчик отправки еженедельных отчетов
 */
class WeeklyReportHandler {
  constructor(bot) {
    this.bot = bot;
    this.weeklyReportService = new WeeklyReportService();
    
    logger.info('📖 WeeklyReportHandler initialized');
  }

  /**
   * Отправка еженедельного отчета пользователю
   * @param {string} userId - ID пользователя
   * @returns {Promise<boolean>} Успех отправки
   */
  async sendWeeklyReport(userId) {
    try {
      // Генерируем отчет
      const report = await this.weeklyReportService.generateWeeklyReport(userId);
      
      if (!report) {
        logger.warn(`📖 Failed to generate weekly report for user ${userId}`);
        return false;
      }

      // Отправляем отчет в Telegram
      const success = await this.sendReportToTelegram(userId, report);
      
      if (success) {
        logger.info(`📖 Weekly report sent successfully to user ${userId}`);
      } else {
        logger.error(`📖 Failed to send weekly report to user ${userId}`);
      }

      return success;

    } catch (error) {
      logger.error(`📖 Error sending weekly report to user ${userId}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Отправка отчета в Telegram
   * @param {string} userId - ID пользователя
   * @param {WeeklyReport} report - Отчет для отправки
   * @returns {Promise<boolean>} Успех отправки
   */
  async sendReportToTelegram(userId, report) {
    try {
      let message;

      if (report.quotes.length === 0) {
        // Отчет для недели без цитат
        message = this.formatEmptyWeekMessage(report);
      } else {
        // Полный отчет с цитатами
        message = await this.formatFullReportMessage(report);
      }

      // Отправляем основное сообщение
      const keyboard = this.createReportKeyboard(report);
      
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });

      return true;

    } catch (error) {
      logger.error(`📖 Error sending report message: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Форматирование сообщения для недели с цитатами
   * @param {WeeklyReport} report - Отчет
   * @returns {Promise<string>} Форматированное сообщение
   */
  async formatFullReportMessage(report) {
    const { Quote } = require('../../server/models');
    
    // Получаем полные данные цитат
    const quotes = await Quote.find({ _id: { $in: report.quotes } }).sort({ createdAt: 1 });
    
    const quotesCount = quotes.length;
    const quotesText = quotes.map((quote, index) => {
      const author = quote.author ? ` (${quote.author})` : '';
      return `✅ "${quote.text}"${author}`;
    }).join('\n');

    const recommendationsText = report.recommendations.map((rec, index) => {
      return `${index + 1}. [${rec.title}](${rec.link}) - ${rec.price}\n   ${rec.description}`;
    }).join('\n\n');

    const promoText = report.promoCode 
      ? `🎁 *Промокод ${report.promoCode.code}* - скидка ${report.promoCode.discount}% до ${report.promoCode.validUntil.toLocaleDateString()}!`
      : '';

    return `📊 *Ваш отчет за неделю*

За эту неделю вы сохранили ${quotesCount} ${this.weeklyReportService.declensionQuotes(quotesCount)}:

${quotesText}

🎯 *Анализ недели:*
${report.analysis.insights}

${report.recommendations.length > 0 ? `💎 *Рекомендации от Анны:*\n${recommendationsText}\n\n` : ''}${promoText}

---
💬 Как вам этот отчет?`;
  }

  /**
   * Форматирование сообщения для пустой недели
   * @param {WeeklyReport} report - Отчет
   * @returns {string} Форматированное сообщение
   */
  formatEmptyWeekMessage(report) {
    return `📖 *Отчет за неделю*

${report.analysis.insights}

💭 Помните: "Хватит сидеть в телефоне - читайте книги!"

Каждая цитата - это ступенька к лучшему пониманию себя. Начните с одной прямо сейчас!

📚 Попробуйте найти что-то вдохновляющее в книге, которую читаете, или вспомните мудрые слова, которые когда-то вас тронули.`;
  }

  /**
   * Создание клавиатуры для отчета
   * @param {WeeklyReport} report - Отчет
   * @returns {Object} Telegram inline keyboard
   */
  createReportKeyboard(report) {
    const keyboard = [];

    // Кнопки обратной связи (только для полных отчетов)
    if (report.quotes.length > 0) {
      keyboard.push([
        { text: "👍 Отлично", callback_data: `feedback_excellent_${report._id}` },
        { text: "👌 Хорошо", callback_data: `feedback_good_${report._id}` },
        { text: "👎 Плохо", callback_data: `feedback_bad_${report._id}` }
      ]);
    }

    // Кнопка для просмотра статистики
    keyboard.push([
      { text: "📈 Моя статистика", callback_data: "show_user_stats" }
    ]);

    // Кнопка настроек (если пользователь хочет изменить частоту отчетов)
    keyboard.push([
      { text: "⚙️ Настройки", callback_data: "show_settings" }
    ]);

    return {
      inline_keyboard: keyboard
    };
  }

  /**
   * Обработка обратной связи по отчету
   * @param {Object} ctx - Telegram context
   * @param {string} rating - Рейтинг (excellent/good/bad)
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async handleWeeklyFeedback(ctx, rating, reportId) {
    try {
      const { WeeklyReport } = require('../../server/models');
      
      // Обновляем отчет с обратной связью
      const ratingValue = this.convertRatingToNumber(rating);
      
      await WeeklyReport.findByIdAndUpdate(reportId, {
        'feedback.rating': ratingValue,
        'feedback.respondedAt': new Date()
      });

      let responseMessage;
      switch (rating) {
        case 'excellent':
          responseMessage = "🎉 Спасибо за отзыв! Рада, что отчет оказался полезным.";
          break;
        case 'good':
          responseMessage = "👌 Спасибо! Что бы вы хотели улучшить в следующих отчетах?";
          // Можно добавить запрос детальной обратной связи
          break;
        case 'bad':
          responseMessage = "😔 Извините, что отчет не оправдал ожиданий. Что бы вы хотели изменить?";
          // Можно добавить запрос детальной обратной связи
          break;
        default:
          responseMessage = "📝 Спасибо за обратную связь!";
      }

      await ctx.editMessageText(responseMessage);

      // Логируем обратную связь
      logger.info(`📖 Weekly report feedback received: user ${ctx.from.id}, rating ${rating}, report ${reportId}`);

      // Если рейтинг низкий, уведомляем администратора
      if (ratingValue <= 2) {
        await this.notifyAdminAboutLowRating(ctx.from.id, rating, reportId);
      }

    } catch (error) {
      logger.error(`📖 Error handling weekly feedback: ${error.message}`, error);
      await ctx.reply("Произошла ошибка при обработке отзыва. Попробуйте позже.");
    }
  }

  /**
   * Конвертация рейтинга в число
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
   * Уведомление администратора о низком рейтинге
   * @param {string} userId - ID пользователя
   * @param {string} rating - Рейтинг
   * @param {string} reportId - ID отчета
   * @returns {Promise<void>}
   */
  async notifyAdminAboutLowRating(userId, rating, reportId) {
    try {
      const { UserProfile } = require('../../server/models');
      const user = await UserProfile.findOne({ userId });
      
      if (!user) return;

      const adminMessage = `
📝 *Низкий рейтинг еженедельного отчета*

*Пользователь:* ${user.name} (@${user.telegramUsername || 'неизвестно'})
*Email:* ${user.email}
*Рейтинг:* ${rating} (${this.convertRatingToNumber(rating)}/5)
*ID отчета:* ${reportId}

*Статистика пользователя:*
- Дата регистрации: ${user.registeredAt.toLocaleDateString()}
- Всего цитат: ${user.statistics.totalQuotes}
- Источник: ${user.source}

Стоит связаться с пользователем для выяснения причин недовольства.
      `;

      // Отправляем уведомление администратору (если настроен ADMIN_TELEGRAM_ID)
      if (process.env.ADMIN_TELEGRAM_ID) {
        await this.bot.telegram.sendMessage(
          process.env.ADMIN_TELEGRAM_ID,
          adminMessage,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error) {
      logger.error(`📖 Error notifying admin about low rating: ${error.message}`, error);
    }
  }

  /**
   * Отправка отчетов всем активным пользователям
   * @returns {Promise<Object>} Статистика отправки
   */
  async sendReportsToAllUsers() {
    try {
      const { UserProfile } = require('../../server/models');
      
      // Получаем всех активных пользователей
      const activeUsers = await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true
      });

      const stats = {
        total: activeUsers.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      logger.info(`📖 Starting weekly reports sending to ${stats.total} users`);

      for (const user of activeUsers) {
        try {
          const success = await this.sendWeeklyReport(user.userId);
          
          if (success) {
            stats.sent++;
          } else {
            stats.failed++;
          }

          // Небольшая задержка между отправками чтобы не превысить лимиты Telegram API
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          stats.failed++;
          stats.errors.push({
            userId: user.userId,
            error: error.message
          });
          
          logger.error(`📖 Failed to send weekly report to user ${user.userId}: ${error.message}`);
        }
      }

      logger.info(`📖 Weekly reports sending completed: ${stats.sent} sent, ${stats.failed} failed`);
      
      return stats;

    } catch (error) {
      logger.error(`📖 Error in sendReportsToAllUsers: ${error.message}`, error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        errors: [{ error: error.message }]
      };
    }
  }

  /**
   * Получение статистики еженедельных отчетов
   * @param {number} days - Количество дней для анализа
   * @returns {Promise<Object>} Статистика
   */
  async getReportStats(days = 30) {
    try {
      const { WeeklyReport } = require('../../server/models');
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const reports = await WeeklyReport.find({
        sentAt: { $gte: startDate }
      });

      const stats = {
        totalReports: reports.length,
        reportsWithQuotes: reports.filter(r => r.quotes.length > 0).length,
        emptyReports: reports.filter(r => r.quotes.length === 0).length,
        averageQuotesPerReport: 0,
        feedbackStats: {
          total: 0,
          excellent: 0,
          good: 0,
          bad: 0,
          averageRating: 0
        }
      };

      // Подсчет средних значений
      if (stats.reportsWithQuotes > 0) {
        const totalQuotes = reports
          .filter(r => r.quotes.length > 0)
          .reduce((sum, r) => sum + r.quotes.length, 0);
        stats.averageQuotesPerReport = Math.round(totalQuotes / stats.reportsWithQuotes * 10) / 10;
      }

      // Статистика обратной связи
      const reportsWithFeedback = reports.filter(r => r.feedback && r.feedback.rating);
      stats.feedbackStats.total = reportsWithFeedback.length;

      if (reportsWithFeedback.length > 0) {
        stats.feedbackStats.excellent = reportsWithFeedback.filter(r => r.feedback.rating === 5).length;
        stats.feedbackStats.good = reportsWithFeedback.filter(r => r.feedback.rating === 4).length;
        stats.feedbackStats.bad = reportsWithFeedback.filter(r => r.feedback.rating <= 2).length;

        const totalRating = reportsWithFeedback.reduce((sum, r) => sum + r.feedback.rating, 0);
        stats.feedbackStats.averageRating = Math.round(totalRating / reportsWithFeedback.length * 10) / 10;
      }

      return stats;

    } catch (error) {
      logger.error(`📖 Error getting report stats: ${error.message}`, error);
      return null;
    }
  }
}

module.exports = { WeeklyReportHandler };