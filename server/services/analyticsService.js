/**
 * @fileoverview Сервис аналитики для проекта "Читатель"
 * @description Обеспечивает сбор, анализ и предоставление данных аналитики для админ-панели
 * @author g1orgi89
 */

const { UTMClick, PromoCodeUsage, UserAction } = require('../models/analytics');
const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Общая статистика
 * @property {Array} sourceStats - Статистика источников 
 * @property {Array} utmStats - UTM статистика
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Название когорты
 * @property {number} size - Размер когорты
 * @property {number} week1 - Retention неделя 1 (%)
 * @property {number} week2 - Retention неделя 2 (%)
 * @property {number} week3 - Retention неделя 3 (%)
 * @property {number} week4 - Retention неделя 4 (%)
 */

/**
 * Сервис аналитики для проекта "Читатель"
 */
class AnalyticsService {
  constructor() {
    this.name = 'AnalyticsService';
  }

  /**
   * Записать клик по UTM ссылке
   * @param {Object} utmParams - UTM параметры
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async trackUTMClick(utmParams, userId) {
    try {
      await UTMClick.recordClick({
        userId,
        source: utmParams.utm_source,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        content: utmParams.utm_content,
        userAgent: utmParams.user_agent,
        referrer: utmParams.referrer,
        ipAddress: utmParams.ip_address,
        sessionId: utmParams.session_id
      });

      // Обновляем статистику пользователя
      await this.updateUserClickStats(userId, utmParams.utm_campaign);
    } catch (error) {
      console.error('📊 Ошибка записи UTM клика:', error);
      throw error;
    }
  }

  /**
   * Записать использование промокода
   * @param {string} promoCode - Промокод
   * @param {string} userId - ID пользователя  
   * @param {number} orderValue - Сумма заказа
   * @param {Object} [options] - Дополнительные опции
   * @returns {Promise<void>}
   */
  async trackPromoCodeUsage(promoCode, userId, orderValue, options = {}) {
    try {
      const discount = this.getDiscountForPromoCode(promoCode);
      
      await PromoCodeUsage.recordUsage({
        promoCode,
        userId,
        orderValue,
        discount,
        source: options.source || 'telegram_bot',
        reportType: options.reportType,
        booksPurchased: options.booksPurchased || []
      });
    } catch (error) {
      console.error('📊 Ошибка записи использования промокода:', error);
      throw error;
    }
  }

  /**
   * Записать действие пользователя
   * @param {string} userId - ID пользователя
   * @param {string} action - Тип действия
   * @param {Object} [metadata] - Дополнительные данные
   * @returns {Promise<void>}
   */
  async trackUserAction(userId, action, metadata = {}) {
    try {
      await UserAction.recordAction(userId, action, metadata);
    } catch (error) {
      console.error('📊 Ошибка записи действия пользователя:', error);
      throw error;
    }
  }

  /**
   * Получить статистику дашборда
   * @param {string} [period='7d'] - Период (1d, 7d, 30d, 90d)
   * @returns {Promise<DashboardStats>}
   */
  async getDashboardStats(period = '7d') {
    try {
      const startDate = this.getStartDate(period);
      
      const [overview, sourceStats, utmStats] = await Promise.all([
        this.getOverviewStats(startDate),
        this.getSourceStats(startDate),
        this.getUTMStats(startDate)
      ]);

      return {
        overview,
        sourceStats,
        utmStats,
        period
      };
    } catch (error) {
      console.error('📊 Ошибка получения статистики дашборда:', error);
      throw error;
    }
  }

  /**
   * Получить общую статистику
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Object>}
   */
  async getOverviewStats(startDate) {
    try {
      // Базовая статистика пользователей
      const totalUsers = await UserProfile.countDocuments({ 
        isOnboardingComplete: true 
      });
      
      const newUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });

      // Статистика цитат
      const totalQuotes = await Quote.countDocuments({ 
        createdAt: { $gte: startDate } 
      });
      
      const avgQuotesPerUser = totalUsers > 0 ? 
        Math.round((totalQuotes / totalUsers) * 10) / 10 : 0;

      // Активные пользователи (те, кто добавлял цитаты в период)
      const activeUserIds = await Quote.distinct('userId', { 
        createdAt: { $gte: startDate } 
      });
      const activeUsers = activeUserIds.length;

      // Использование промокодов
      const promoUsage = await PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      });

      // Предыдущий период для сравнения
      const previousPeriod = this.getPreviousPeriodDate(startDate);
      const previousStats = await this.getOverviewStats(previousPeriod);

      return {
        totalUsers,
        newUsers,
        totalQuotes,
        avgQuotesPerUser,
        activeUsers,
        promoUsage,
        // Изменения относительно предыдущего периода
        usersChange: this.calculateChange(totalUsers, previousStats?.totalUsers || 0),
        newUsersChange: this.calculateChange(newUsers, previousStats?.newUsers || 0),
        quotesChange: this.calculateChange(totalQuotes, previousStats?.totalQuotes || 0),
        avgQuotesChange: this.calculateChange(avgQuotesPerUser, previousStats?.avgQuotesPerUser || 0),
        activeUsersChange: this.calculateChange(activeUsers, previousStats?.activeUsers || 0),
        promoUsageChange: this.calculateChange(promoUsage, previousStats?.promoUsage || 0)
      };
    } catch (error) {
      console.error('📊 Ошибка получения общей статистики:', error);
      throw error;
    }
  }

  /**
   * Получить статистику источников
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getSourceStats(startDate) {
    try {
      return await UserProfile.aggregate([
        { 
          $match: { 
            registeredAt: { $gte: startDate },
            isOnboardingComplete: true 
          } 
        },
        { 
          $group: { 
            _id: '$source', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } }
      ]);
    } catch (error) {
      console.error('📊 Ошибка получения статистики источников:', error);
      throw error;
    }
  }

  /**
   * Получить UTM статистику
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getUTMStats(startDate) {
    try {
      return await UTMClick.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$campaign', 
            clicks: { $sum: 1 }, 
            users: { $addToSet: '$userId' } 
          } 
        },
        { 
          $project: { 
            campaign: '$_id', 
            clicks: 1, 
            uniqueUsers: { $size: '$users' } 
          } 
        },
        { $sort: { clicks: -1 } }
      ]);
    } catch (error) {
      console.error('📊 Ошибка получения UTM статистики:', error);
      throw error;
    }
  }

  /**
   * Получить статистику retention по когортам
   * @returns {Promise<Array<RetentionData>>}
   */
  async getUserRetentionStats() {
    try {
      // Получаем когорты пользователей по месяцам регистрации
      const cohorts = await UserProfile.aggregate([
        {
          $match: {
            isOnboardingComplete: true
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$registeredAt' },
              month: { $month: '$registeredAt' }
            },
            users: { $push: '$userId' },
            registrationDate: { $first: '$registeredAt' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      const retentionData = [];

      for (const cohort of cohorts) {
        const cohortUsers = cohort.users;
        const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
        
        const retention = {
          cohort: `${cohort._id.year}-${cohort._id.month.toString().padStart(2, '0')}`,
          size: cohortUsers.length,
          week1: 0,
          week2: 0, 
          week3: 0,
          week4: 0
        };

        // Проверяем активность пользователей в каждую неделю
        for (let week = 1; week <= 4; week++) {
          const weekStart = new Date(cohortDate);
          weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const activeInWeek = await Quote.distinct('userId', {
            userId: { $in: cohortUsers },
            createdAt: { $gte: weekStart, $lt: weekEnd }
          });

          retention[`week${week}`] = Math.round(
            (activeInWeek.length / cohortUsers.length) * 100
          );
        }

        retentionData.push(retention);
      }

      return retentionData;
    } catch (error) {
      console.error('📊 Ошибка получения retention статистики:', error);
      throw error;
    }
  }

  /**
   * Получить топ контент (авторы, категории, цитаты)
   * @param {string} [period='30d'] - Период
   * @returns {Promise<Object>}
   */
  async getTopQuotesAndAuthors(period = '30d') {
    try {
      const startDate = this.getStartDate(period);

      const [topAuthors, topCategories, popularQuotes] = await Promise.all([
        // Топ авторы
        Quote.aggregate([
          { 
            $match: { 
              createdAt: { $gte: startDate }, 
              author: { $ne: null, $ne: '' } 
            } 
          },
          { $group: { _id: '$author', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Топ категории
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Популярные цитаты (по тексту)
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { 
            $group: { 
              _id: '$text', 
              author: { $first: '$author' }, 
              count: { $sum: 1 } 
            } 
          },
          { $match: { count: { $gt: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      return {
        topAuthors,
        topCategories,
        popularQuotes
      };
    } catch (error) {
      console.error('📊 Ошибка получения топ контента:', error);
      throw error;
    }
  }

  /**
   * Обновить статистику кликов пользователя
   * @param {string} userId - ID пользователя
   * @param {string} campaign - UTM кампания
   * @returns {Promise<void>}
   * @private
   */
  async updateUserClickStats(userId, campaign) {
    try {
      // Можно добавить логику обновления профиля пользователя
      // с информацией о последних кликах
    } catch (error) {
      console.error('📊 Ошибка обновления статистики кликов:', error);
    }
  }

  /**
   * Получить размер скидки для промокода
   * @param {string} promoCode - Промокод
   * @returns {number} Размер скидки в процентах
   * @private
   */
  getDiscountForPromoCode(promoCode) {
    const discountMap = {
      'READER20': 20,
      'WISDOM20': 20,
      'QUOTES20': 20,
      'BOOKS20': 20,
      'MONTH25': 25,
      'READER15': 15
    };

    return discountMap[promoCode] || 10; // По умолчанию 10%
  }

  /**
   * Получить начальную дату для периода
   * @param {string} period - Период (1d, 7d, 30d, 90d)
   * @returns {Date}
   * @private
   */
  getStartDate(period) {
    const now = new Date();
    const startDate = new Date(now);

    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    return startDate;
  }

  /**
   * Получить дату предыдущего периода
   * @param {Date} currentStartDate - Текущая начальная дата
   * @returns {Date}
   * @private
   */
  getPreviousPeriodDate(currentStartDate) {
    const periodLength = Date.now() - currentStartDate.getTime();
    return new Date(currentStartDate.getTime() - periodLength);
  }

  /**
   * Вычислить процентное изменение
   * @param {number} current - Текущее значение
   * @param {number} previous - Предыдущее значение
   * @returns {number} Процентное изменение
   * @private
   */
  calculateChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}

module.exports = new AnalyticsService();