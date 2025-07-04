/**
 * @fileoverview Сервис аналитики Reader Bot - ТОЛЬКО РЕАЛЬНЫЕ ДАННЫЕ
 * @description Показывает исключительно данные из MongoDB, НЕТ fallback данных
 * @version 3.1.0
 */

// Правильный импорт моделей из index.js
const { UserProfile, Quote, UTMClick, PromoCodeUsage, UserAction } = require('../models');

/**
 * @typedef {import('../types/reader').DashboardStats} DashboardStats
 * @typedef {import('../types/reader').RetentionData} RetentionData
 * @typedef {import('../types/reader').UTMClickData} UTMClickData
 * @typedef {import('../types/reader').PromoCodeUsageData} PromoCodeUsageData
 */

class AnalyticsService {
  constructor() {
    this.name = 'AnalyticsService';
    console.log('📊 AnalyticsService инициализирован (только реальные данные)');
  }

  /**
   * Получение статистики дашборда - ТОЛЬКО реальные данные
   * @param {string} dateRange - Период (1d, 7d, 30d, 90d)
   * @returns {Promise<DashboardStats>}
   */
  async getDashboardStats(dateRange = '7d') {
    try {
      console.log(`📊 Получение РЕАЛЬНОЙ статистики дашборда для периода: ${dateRange}`);
      
      const startDate = this.getStartDate(dateRange);
      
      // Получаем реальные данные
      const [
        totalUsers,
        newUsers,
        totalQuotes,
        activeUsers,
        promoUsage,
        sourceStats,
        utmStats
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getNewUsers(startDate),
        this.getTotalQuotes(startDate),
        this.getActiveUsers(startDate),
        this.getPromoUsage(startDate),
        this.getSourceStats(startDate),
        this.getUTMStats(startDate)
      ]);

      const avgQuotesPerUser = totalUsers > 0 ? 
        Math.round((totalQuotes / totalUsers) * 10) / 10 : 0;

      const stats = {
        overview: {
          totalUsers,
          newUsers,
          totalQuotes,
          avgQuotesPerUser,
          activeUsers,
          promoUsage
        },
        sourceStats: sourceStats || [],
        utmStats: utmStats || [],
        period: dateRange,
        timestamp: new Date().toISOString(),
        fallbackMode: false,
        dataSource: 'mongodb'
      };

      console.log('📊 Реальные данные дашборда получены:', {
        totalUsers,
        newUsers,
        totalQuotes,
        activeUsers,
        sources: sourceStats.length,
        utmCampaigns: utmStats.length
      });

      return stats;

    } catch (error) {
      console.error('📊 Ошибка получения данных дашборда:', error);
      
      // Возвращаем пустую структуру вместо fallback
      return {
        overview: {
          totalUsers: 0,
          newUsers: 0,
          totalQuotes: 0,
          avgQuotesPerUser: 0,
          activeUsers: 0,
          promoUsage: 0
        },
        sourceStats: [],
        utmStats: [],
        period: dateRange,
        timestamp: new Date().toISOString(),
        fallbackMode: false,
        dataSource: 'error',
        error: error.message
      };
    }
  }

  /**
   * Получение данных retention - ТОЛЬКО реальные данные
   * @returns {Promise<RetentionData[]>}
   */
  async getUserRetentionStats() {
    try {
      console.log('📊 Получение РЕАЛЬНОЙ статистики retention');
      
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
            users: { $push: '$userId' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      if (!cohorts || cohorts.length === 0) {
        console.log('📊 Нет данных когорт для retention анализа');
        return [];
      }

      const retentionData = [];

      for (const cohort of cohorts.slice(-6)) { // Последние 6 когорт
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

        // Рассчитываем retention для каждой недели
        for (let week = 1; week <= 4; week++) {
          const weekStart = new Date(cohortDate);
          weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const activeInWeek = await Quote.distinct('userId', {
            userId: { $in: cohortUsers },
            createdAt: { $gte: weekStart, $lt: weekEnd }
          });

          retention[`week${week}`] = cohortUsers.length > 0 ?
            Math.round((activeInWeek.length / cohortUsers.length) * 100) : 0;
        }

        retentionData.push(retention);
      }

      console.log(`📊 Реальные данные retention получены: ${retentionData.length} когорт`);
      return retentionData;

    } catch (error) {
      console.error('📊 Ошибка получения retention данных:', error);
      return []; // Возвращаем пустой массив вместо fallback
    }
  }

  /**
   * Получение топ контента - ТОЛЬКО реальные данные
   * @param {string} dateRange - Период
   * @returns {Promise<Object>}
   */
  async getTopQuotesAndAuthors(dateRange = '30d') {
    try {
      console.log(`📊 Получение РЕАЛЬНОГО топ контента для периода: ${dateRange}`);
      
      const startDate = this.getStartDate(dateRange);

      // Топ авторы
      const topAuthors = await Quote.aggregate([
        { 
          $match: { 
            createdAt: { $gte: startDate }, 
            author: { $ne: null, $ne: '' } 
          } 
        },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Топ категории
      const topCategories = await Quote.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Популярные цитаты (повторяющиеся)
      const popularQuotes = await Quote.aggregate([
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
      ]);

      const topContent = {
        topAuthors: topAuthors || [],
        topCategories: topCategories || [],
        popularQuotes: popularQuotes || [],
        dataSource: 'mongodb',
        period: dateRange
      };

      console.log('📊 Реальный топ контент получен:', {
        authors: topAuthors.length,
        categories: topCategories.length,
        popularQuotes: popularQuotes.length
      });

      return topContent;

    } catch (error) {
      console.error('📊 Ошибка получения топ контента:', error);
      return {
        topAuthors: [],
        topCategories: [],
        popularQuotes: [],
        dataSource: 'error',
        error: error.message
      };
    }
  }

  /**
   * Трекинг UTM кликов
   * @param {UTMClickData} utmParams - UTM параметры
   * @param {string} userId - ID пользователя
   */
  async trackUTMClick(utmParams, userId) {
    try {
      // Проверяем доступность модели UTMClick
      if (!UTMClick) {
        console.warn('📊 Модель UTMClick недоступна');
        return;
      }
      
      const click = new UTMClick({
        userId,
        source: utmParams.utm_source,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        content: utmParams.utm_content,
        userAgent: utmParams.user_agent,
        referrer: utmParams.referrer,
        ipAddress: utmParams.ip_address,
        sessionId: utmParams.session_id,
        timestamp: new Date()
      });

      await click.save();
      console.log(`📊 UTM клик записан: ${utmParams.utm_campaign} от ${userId}`);

    } catch (error) {
      console.error('📊 Ошибка записи UTM клика:', error);
      // Не прерываем выполнение, просто логируем
    }
  }

  /**
   * Трекинг использования промокодов
   * @param {string} promoCode - Промокод
   * @param {string} userId - ID пользователя
   * @param {number} orderValue - Сумма заказа
   * @param {Object} metadata - Дополнительные данные
   */
  async trackPromoCodeUsage(promoCode, userId, orderValue, metadata = {}) {
    try {
      // Проверяем доступность модели PromoCodeUsage
      if (!PromoCodeUsage) {
        console.warn('📊 Модель PromoCodeUsage недоступна');
        return;
      }
      
      const usage = new PromoCodeUsage({
        promoCode,
        userId,
        orderValue,
        discount: this.getDiscountForPromoCode(promoCode),
        source: metadata.source || 'telegram_bot',
        reportType: metadata.reportType,
        booksPurchased: metadata.booksPurchased,
        timestamp: new Date()
      });

      await usage.save();
      console.log(`📊 Промокод записан: ${promoCode} от ${userId}, сумма ${orderValue}`);

    } catch (error) {
      console.error('📊 Ошибка записи промокода:', error);
    }
  }

  /**
   * Трекинг действий пользователей
   * @param {string} userId - ID пользователя
   * @param {string} action - Тип действия
   * @param {Object} metadata - Метаданные
   */
  async trackUserAction(userId, action, metadata = {}) {
    try {
      // Проверяем доступность модели UserAction
      if (!UserAction) {
        console.warn('📊 Модель UserAction недоступна');
        return;
      }
      
      const userAction = new UserAction({
        userId,
        action,
        metadata,
        timestamp: new Date()
      });

      await userAction.save();
      console.log(`📊 Действие записано: ${action} от ${userId}`);

    } catch (error) {
      console.error('📊 Ошибка записи действия пользователя:', error);
    }
  }

  // ========================================
  // МЕТОДЫ ДЛЯ РАБОТЫ С РЕАЛЬНЫМИ ДАННЫМИ
  // ========================================

  async getTotalUsers() {
    try {
      if (!UserProfile) {
        console.error('📊 UserProfile модель недоступна');
        return 0;
      }
      const count = await UserProfile.countDocuments({ isOnboardingComplete: true });
      console.log(`📊 Общее количество пользователей: ${count}`);
      return count;
    } catch (error) {
      console.error('📊 Ошибка получения общего количества пользователей:', error);
      return 0;
    }
  }

  async getNewUsers(startDate) {
    try {
      if (!UserProfile) {
        console.error('📊 UserProfile модель недоступна');
        return 0;
      }
      const count = await UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });
      console.log(`📊 Новые пользователи с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      console.error('📊 Ошибка получения новых пользователей:', error);
      return 0;
    }
  }

  async getTotalQuotes(startDate) {
    try {
      if (!Quote) {
        console.error('📊 Quote модель недоступна');
        return 0;
      }
      const count = await Quote.countDocuments({ createdAt: { $gte: startDate } });
      console.log(`📊 Цитат с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      console.error('📊 Ошибка получения количества цитат:', error);
      return 0;
    }
  }

  async getActiveUsers(startDate) {
    try {
      if (!Quote) {
        console.error('📊 Quote модель недоступна');
        return 0;
      }
      const activeUsers = await Quote.distinct('userId', { 
        createdAt: { $gte: startDate } 
      });
      console.log(`📊 Активные пользователи с ${startDate.toISOString()}: ${activeUsers.length}`);
      return activeUsers.length;
    } catch (error) {
      console.error('📊 Ошибка получения активных пользователей:', error);
      return 0;
    }
  }

  async getPromoUsage(startDate) {
    try {
      if (!PromoCodeUsage) {
        console.warn('📊 Модель PromoCodeUsage недоступна');
        return 0;
      }
      const count = await PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      });
      console.log(`📊 Использование промокодов с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      console.warn('📊 Модель промокодов недоступна или ошибка:', error.message);
      return 0;
    }
  }

  async getSourceStats(startDate) {
    try {
      if (!UserProfile) {
        console.error('📊 UserProfile модель недоступна');
        return [];
      }
      const stats = await UserProfile.aggregate([
        { 
          $match: { 
            registeredAt: { $gte: startDate },
            isOnboardingComplete: true
          } 
        },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log(`📊 Статистика источников: ${stats.length} источников`);
      return stats;
    } catch (error) {
      console.error('📊 Ошибка получения статистики источников:', error);
      return [];
    }
  }

  async getUTMStats(startDate) {
    try {
      if (!UTMClick) {
        console.warn('📊 Модель UTMClick недоступна');
        return [];
      }
      const stats = await UTMClick.aggregate([
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
      console.log(`📊 UTM статистика: ${stats.length} кампаний`);
      return stats;
    } catch (error) {
      console.warn('📊 Модель UTM недоступна или ошибка:', error.message);
      return [];
    }
  }

  // ========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ========================================

  /**
   * Получение даты начала периода
   */
  getStartDate(dateRange) {
    const now = new Date();
    switch (dateRange) {
      case '1d': 
        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return oneDayAgo;
      case '7d': 
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return sevenDaysAgo;
      case '30d': 
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return thirtyDaysAgo;
      case '90d': 
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ninetyDaysAgo;
      default: 
        const defaultDate = new Date(now);
        defaultDate.setDate(defaultDate.getDate() - 7);
        return defaultDate;
    }
  }

  /**
   * Получение размера скидки для промокода
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
    return discountMap[promoCode] || 10;
  }
}

module.exports = new AnalyticsService();