/**
 * @fileoverview Сервис отправки отчетов в Telegram для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/logger');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').TelegramBot} TelegramBot
 */

/**
 * @class TelegramReportService
 * @description Сервис для отправки еженедельных отчетов в Telegram
 */
class TelegramReportService {
  constructor() {
    this.bot = null;
    this._initializeTelegramBot();
  }

  /**
   * Инициализация Telegram bot
   * @private
   */
  _initializeTelegramBot() {
    try {
      // Подключаем bot через telegram/index.js
      const telegramIndex = require('../../telegram/index');
      this.bot = telegramIndex.bot;
      
      if (this.bot) {
        logger.info('📖 TelegramReportService initialized with bot instance');
      } else {
        logger.warn('📖 Telegram bot not available in TelegramReportService');
      }
    } catch (error) {
      logger.error(`📖 Failed to initialize Telegram bot: ${error.message}`);
    }
  }

  /**
   * 📖 НОВОЕ: Отправка еженедельных отчетов всем активным пользователям
   * @returns {Promise<Object>} Статистика отправки
   */
  async sendReportsToAllUsers() {
    logger.info('📖 Starting weekly reports generation for all users...');
    
    try {
      // Получаем все модели
      const { UserProfile, Quote } = require('../models');
      const WeeklyReportService = require('./weeklyReportService');
      const weeklyReportService = new WeeklyReportService();
      
      // Получаем активных пользователей
      const activeUsers = await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': { $ne: false } // Не отключили уведомления
      });

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const errors = [];

      const currentWeek = this._getCurrentWeekNumber();
      const currentYear = new Date().getFullYear();

      logger.info(`📖 Found ${activeUsers.length} active users for weekly reports`);

      for (const user of activeUsers) {
        try {
          // Получаем цитаты пользователя за текущую неделю
          const weekQuotes = await Quote.find({
            userId: user.userId,
            createdAt: {
              $gte: this._getWeekStartDate(),
              $lt: this._getWeekEndDate()
            }
          }).sort({ createdAt: 1 });

          if (weekQuotes.length === 0) {
            // Отправляем сообщение о пустой неделе
            await this.sendEmptyWeekMessage(user.userId, user);
            skipped++;
            logger.info(`📖 Empty week message sent to user ${user.userId}`);
          } else {
            // Генерируем полный отчет
            const report = await weeklyReportService.generateWeeklyReport(
              user.userId, 
              weekQuotes, 
              user
            );

            // Добавляем количество цитат в отчет для форматирования
            report.quotesCount = weekQuotes.length;
            report.quotes = weekQuotes;

            // Отправляем отчет
            const success = await this.sendWeeklyReport(report);
            if (success) {
              sent++;
            } else {
              failed++;
            }
          }

          // Небольшая задержка между отправками
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          failed++;
          errors.push({
            userId: user.userId,
            error: error.message
          });
          logger.error(`📖 Failed to send weekly report to user ${user.userId}: ${error.message}`);
        }
      }

      const stats = {
        total: activeUsers.length,
        sent,
        failed,
        skipped,
        errors,
        timestamp: new Date()
      };

      logger.info(`📖 Weekly reports completed: ${JSON.stringify(stats)}`);
      return stats;

    } catch (error) {
      logger.error(`📖 Error in sendReportsToAllUsers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает начало текущей недели
   * @private
   * @returns {Date} Начало недели
   */
  _getWeekStartDate() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Понедельник как начало недели
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Получает конец текущей недели
   * @private
   * @returns {Date} Конец недели
   */
  _getWeekEndDate() {
    const weekStart = this._getWeekStartDate();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return weekEnd;
  }

  /**
   * Получает номер текущей недели
   * @private
   * @returns {number} Номер недели
   */
  _getCurrentWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  /**
   * 📖 НОВОЕ: Получение статистики отчетов за период
   * @param {number} days - Количество дней назад
   * @returns {Promise<Object>} Статистика отчетов
   */
  async getReportStats(days = 7) {
    try {
      const { WeeklyReport } = require('../models');
      
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const reports = await WeeklyReport.find({
        sentAt: { $gte: sinceDate }
      });

      const stats = {
        totalReports: reports.length,
        period: `${days} days`,
        byDay: {},
        averageQuotes: 0,
        feedbackStats: {
          excellent: 0,
          good: 0,
          bad: 0,
          noFeedback: 0
        }
      };

      // Статистика по дням
      reports.forEach(report => {
        const day = report.sentAt.toDateString();
        if (!stats.byDay[day]) {
          stats.byDay[day] = 0;
        }
        stats.byDay[day]++;

        // Статистика фидбека
        if (report.feedback && report.feedback.rating) {
          if (report.feedback.rating >= 5) stats.feedbackStats.excellent++;
          else if (report.feedback.rating >= 4) stats.feedbackStats.good++;
          else stats.feedbackStats.bad++;
        } else {
          stats.feedbackStats.noFeedback++;
        }
      });

      return stats;
    } catch (error) {
      logger.error(`📖 Error getting report stats: ${error.message}`);
      return {
        totalReports: 0,
        period: `${days} days`,
        error: error.message
      };
    }
  }

  /**
   * Отправка еженедельного отчета пользователю
   * @param {WeeklyReport} report - Отчет для отправки
   * @returns {Promise<boolean>} Успешность отправки
   */
  async sendWeeklyReport(report) {
    if (!this.bot) {
      logger.error('📖 Telegram bot not available');
      return false;
    }

    try {
      const message = this._formatWeeklyReportMessage(report);
      const replyMarkup = this._createFeedbackButtons(report._id || 'temp_id');

      await this.bot.telegram.sendMessage(report.userId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      });

      // Обновляем отчет - устанавливаем telegramMessageId если нужно
      await this._updateReportSentStatus(report);

      logger.info(`📖 Weekly report sent to user ${report.userId}: ${report._id}`);
      return true;
    } catch (error) {
      logger.error(`📖 Failed to send weekly report to user ${report.userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Отправка сообщения о пустой неделе
   * @param {string} userId - ID пользователя
   * @param {Object} user - Профиль пользователя
   * @returns {Promise<boolean>} Успешность отправки
   */
  async sendEmptyWeekMessage(userId, user) {
    if (!this.bot) {
      logger.error('📖 Telegram bot not available');
      return false;
    }

    try {
      const message = this._formatEmptyWeekMessage(user);

      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown'
      });

      logger.info(`📖 Empty week message sent to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`📖 Failed to send empty week message to user ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Форматирование сообщения еженедельного отчета
   * @private
   * @param {WeeklyReport} report - Отчет
   * @returns {string} Отформатированное сообщение
   */
  _formatWeeklyReportMessage(report) {
    const quotesText = this._formatQuotesText(report.quotes);
    const recommendationsText = this._formatRecommendationsText(report.recommendations);
    const promoText = this._formatPromoCodeText(report.promoCode);

    return `📊 *Ваш отчет за неделю*\n\nЗа эту неделю вы сохранили ${report.quotesCount} ${this._declensionQuotes(report.quotesCount)}:\n\n${quotesText}\n\n🎯 *Анализ недели:*\n${report.analysis.insights}\n\n💎 *Рекомендации от Анны:*\n${recommendationsText}\n\n${promoText}\n\n---\n💬 Как вам этот отчет?`;
  }

  /**
   * Форматирование цитат в отчете
   * @private
   * @param {Array} quotes - Цитаты
   * @returns {string} Отформатированные цитаты
   */
  _formatQuotesText(quotes) {
    if (!quotes || quotes.length === 0) {
      return 'Цитаты не найдены';
    }

    return quotes.slice(0, 5).map((quote, index) => {
      const author = quote.author ? ` (${quote.author})` : '';
      const text = quote.text.length > 80 ? `${quote.text.substring(0, 80)}...` : quote.text;
      return `✅ "${text}"${author}`;
    }).join('\n');
  }

  /**
   * Форматирование рекомендаций в отчете
   * @private
   * @param {Array} recommendations - Рекомендации
   * @returns {string} Отформатированные рекомендации
   */
  _formatRecommendationsText(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return 'Рекомендации временно недоступны';
    }

    return recommendations.map((rec, index) => {
      return `${index + 1}. [${rec.title}](${rec.link}) - ${rec.price}\n   ${rec.description}`;
    }).join('\n\n');
  }

  /**
   * Форматирование промокода
   * @private
   * @param {Object} promoCode - Промокод
   * @returns {string} Отформатированный промокод
   */
  _formatPromoCodeText(promoCode) {
    if (!promoCode) {
      return '';
    }

    const validUntil = new Date(promoCode.validUntil).toLocaleDateString('ru-RU');
    return `🎁 *Промокод ${promoCode.code}* - скидка ${promoCode.discount}% до ${validUntil}!`;
  }

  /**
   * Форматирование сообщения о пустой неделе
   * @private
   * @param {Object} user - Профиль пользователя
   * @returns {string} Отформатированное сообщение
   */
  _formatEmptyWeekMessage(user) {
    return `📖 *Отчет за неделю*\n\nЗдравствуйте, ${user.name}!\n\nНа этой неделе вы не сохранили ни одной цитаты. \n\n💭 Помните: \"Хватит сидеть в телефоне - читайте книги!\"\n\nКаждая цитата - это ступенька к лучшему пониманию себя. Начните с одной прямо сейчас!\n\n📚 Попробуйте найти что-то вдохновляющее в книге, которую читаете, или вспомните мудрые слова, которые когда-то вас тронули.`;
  }

  /**
   * Создание кнопок обратной связи
   * @private
   * @param {string} reportId - ID отчета
   * @returns {Object} Разметка клавиатуры
   */
  _createFeedbackButtons(reportId) {
    return {
      inline_keyboard: [
        [
          { 
            text: "👍 Отлично", 
            callback_data: `feedback_excellent_${reportId}` 
          },
          { 
            text: "👌 Хорошо", 
            callback_data: `feedback_good_${reportId}` 
          },
          { 
            text: "👎 Плохо", 
            callback_data: `feedback_bad_${reportId}` 
          }
        ]
      ]
    };
  }

  /**
   * Обновление статуса отправки отчета
   * @private
   * @param {WeeklyReport} report - Отчет
   */
  async _updateReportSentStatus(report) {
    try {
      // Обновляем время отправки, если не установлено
      if (!report.sentAt && report.save) {
        report.sentAt = new Date();
        await report.save();
      }
    } catch (error) {
      logger.error(`📖 Failed to update report sent status: ${error.message}`);
    }
  }

  /**
   * Склонение слова "цитата"
   * @private
   * @param {number} count - Количество
   * @returns {string} Правильное склонение
   */
  _declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Обработка обратной связи по отчету
   * @param {string} callbackData - Данные callback'а
   * @param {Object} ctx - Контекст Telegram
   * @returns {Promise<boolean>} Успешность обработки
   */
  async handleReportFeedback(callbackData, ctx) {
    try {
      const parts = callbackData.split('_');
      if (parts.length < 3 || parts[0] !== 'feedback') {
        logger.error(`📖 Invalid feedback callback data: ${callbackData}`);
        return false;
      }

      const rating = parts[1]; // excellent, good, bad
      const reportId = parts.slice(2).join('_');

      // Конвертируем рейтинг в числовое значение
      const numericRating = this._convertRatingToNumber(rating);

      // Обновляем отчет (добавим позже когда будет модель WeeklyReport)
      // const weeklyReportService = require('./weeklyReportService');
      // await weeklyReportService.addReportFeedback(reportId, numericRating);

      // Отвечаем пользователю
      const responseMessage = this._getFeedbackResponseMessage(rating);
      await ctx.editMessageText(responseMessage, { parse_mode: 'Markdown' });

      // Если оценка плохая, предлагаем детальную обратную связь
      if (rating === 'bad' || rating === 'good') {
        await this._requestDetailedFeedback(ctx, reportId, rating);
      }

      logger.info(`📖 Feedback processed: ${rating} for report ${reportId}`);
      return true;
    } catch (error) {
      logger.error(`📖 Error handling report feedback: ${error.message}`);
      return false;
    }
  }

  /**
   * Конвертация рейтинга в число
   * @private
   * @param {string} rating - Рейтинг ('excellent', 'good', 'bad')
   * @returns {number} Числовой рейтинг
   */
  _convertRatingToNumber(rating) {
    switch (rating) {
      case 'excellent': return 5;
      case 'good': return 4;
      case 'bad': return 2;
      default: return 3;
    }
  }

  /**
   * Получение сообщения ответа на обратную связь
   * @private
   * @param {string} rating - Рейтинг
   * @returns {string} Сообщение ответа
   */
  _getFeedbackResponseMessage(rating) {
    switch (rating) {
      case 'excellent':
        return "🎉 Спасибо за отзыв! Рада, что отчет оказался полезным.";
      case 'good':
        return "👌 Спасибо! Что бы вы хотели улучшить в следующих отчетах?";
      case 'bad':
        return "😔 Извините, что отчет не оправдал ожиданий. Что бы вы хотели изменить?";
      default:
        return "Спасибо за обратную связь!";
    }
  }

  /**
   * Запрос детальной обратной связи
   * @private
   * @param {Object} ctx - Контекст Telegram
   * @param {string} reportId - ID отчета
   * @param {string} rating - Рейтинг
   */
  async _requestDetailedFeedback(ctx, reportId, rating) {
    try {
      const message = "📝 Напишите, что хотели бы изменить в еженедельных отчетах:";
      
      await ctx.reply(message, {
        reply_markup: { force_reply: true }
      });

      // Здесь можно установить состояние ожидания детального отзыва
      // Это будет обрабатываться в основном telegram handler'е
      
    } catch (error) {
      logger.error(`📖 Error requesting detailed feedback: ${error.message}`);
    }
  }

  /**
   * Массовая отправка отчетов
   * @param {Array} reports - Массив отчетов
   * @param {Object} options - Опции отправки
   * @returns {Promise<Object>} Статистика отправки
   */
  async sendBulkReports(reports, options = {}) {
    const { delayBetweenSends = 1000 } = options;
    
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const report of reports) {
      try {
        const success = await this.sendWeeklyReport(report);
        if (success) {
          sent++;
        } else {
          failed++;
        }
        
        // Задержка между отправками для избежания rate limit
        if (delayBetweenSends > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenSends));
        }
      } catch (error) {
        failed++;
        errors.push({
          reportId: report._id,
          userId: report.userId,
          error: error.message
        });
        logger.error(`📖 Failed to send report ${report._id}: ${error.message}`);
      }
    }

    const stats = {
      total: reports.length,
      sent,
      failed,
      errors,
      timestamp: new Date()
    };

    logger.info(`📖 Bulk reports sending completed: ${JSON.stringify(stats)}`);
    return stats;
  }

  /**
   * Проверка доступности Telegram bot
   * @returns {Promise<boolean>} Доступность бота
   */
  async isAvailable() {
    try {
      if (!this.bot) {
        return false;
      }

      // Проверяем доступность через getMe
      const me = await this.bot.telegram.getMe();
      return !!me.id;
    } catch (error) {
      logger.error(`📖 Telegram bot availability check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Получение информации о сервисе
   * @returns {Promise<Object>} Информация о сервисе
   */
  async getServiceInfo() {
    try {
      const isAvailable = await this.isAvailable();
      
      let botInfo = null;
      if (this.bot) {
        try {
          botInfo = await this.bot.telegram.getMe();
        } catch (error) {
          logger.error(`📖 Failed to get bot info: ${error.message}`);
        }
      }

      return {
        service: 'TelegramReportService',
        isAvailable,
        botInfo: botInfo ? {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name
        } : null,
        features: [
          'weekly_reports',
          'empty_week_messages',
          'feedback_buttons',
          'bulk_sending'
        ]
      };
    } catch (error) {
      return {
        service: 'TelegramReportService',
        isAvailable: false,
        error: error.message
      };
    }
  }
}

// Экспортируем единственный экземпляр
module.exports = new TelegramReportService();