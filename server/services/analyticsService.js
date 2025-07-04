/**
 * @fileoverview Сервис аналитики Reader Bot - ИСПРАВЛЕНИЕ ИМПОРТА МОДЕЛЕЙ
 * @description Показывает исключительно данные из MongoDB с ленивой загрузкой моделей
 * @version 3.2.0 - FIXED MODELS IMPORT
 */

const logger = require('../utils/logger');

/**
 * @typedef {import('../types/reader').DashboardStats} DashboardStats
 * @typedef {import('../types/reader').RetentionData} RetentionData
 * @typedef {import('../types/reader').UTMClickData} UTMClickData
 * @typedef {import('../types/reader').PromoCodeUsageData} PromoCodeUsageData
 */

class AnalyticsService {
  constructor() {
    this.name = 'AnalyticsService';
    this._models = null;
    
    logger.info('📊 AnalyticsService инициализирован с ленивой загрузкой моделей');
  }

  /**
   * Ленивая загрузка моделей
   * @returns {Object|null} Объект с моделями или null если не удалось загрузить
   */
  getModels() {
    if (this._models) {
      return this._models;
    }

    try {
      const models = require('../models');
      
      this._models = {
        UserProfile: models.UserProfile,
        Quote: models.Quote,
        UTMClick: models.UTMClick,
        PromoCodeUsage: models.PromoCodeUsage,
        UserAction: models.UserAction,
        WeeklyReport: models.WeeklyReport,
        MonthlyReport: models.MonthlyReport
      };
      
      // Проверяем, что все нужные модели доступны
      const requiredModels = ['UserProfile', 'Quote'];
      const missingModels = requiredModels.filter(model => !this._models[model]);
      
      if (missingModels.length > 0) {
        logger.error(`📊 Отсутствуют критические модели: ${missingModels.join(', ')}`);
        this._models = null;
        return null;
      }
      
      logger.info('📊 Модели успешно загружены в AnalyticsService');
      return this._models;
      
    } catch (error) {
      logger.error('📊 Ошибка загрузки моделей в AnalyticsService:', error.message);
      this._models = null;
      return null;
    }
  }

  /**
   * Проверка готовности сервиса
   * @returns {Object}
   */
  healthCheck() {
    const models = this.getModels();
    
    return {
      status: models ? 'ok' : 'limited',
      modelsAvailable: {
        UserProfile: !!(models && models.UserProfile),
        Quote: !!(models && models.Quote),
        UTMClick: !!(models && models.UTMClick),
        PromoCodeUsage: !!(models && models.PromoCodeUsage),
        UserAction: !!(models && models.UserAction)
      }
    };
  }

  /**
   * Получение статистики дашборда - ТОЛЬКО реальные данные
   * @param {string} dateRange - Период (1d, 7d, 30d, 90d)
   * @returns {Promise<DashboardStats>}
   */
  async getDashboardStats(dateRange = '7d') {
    try {
      const models = this.getModels();
      
      if (!models) {
        logger.warn('📊 Модели недоступны, возвращаем пустые данные');
        return this.getEmptyStats(dateRange);
      }

      logger.info(`📊 Получение РЕАЛЬНОЙ статистики дашборда для периода: ${dateRange}`);
      
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

      logger.info('📊 Реальные данные дашборда получены:', {
        totalUsers,
        newUsers,
        totalQuotes,
        activeUsers,
        sources: sourceStats.length,
        utmCampaigns: utmStats.length
      });

      return stats;

    } catch (error) {
      logger.error('📊 Ошибка получения данных дашборда:', error);
      return this.getEmptyStats(dateRange, error.message);
    }
  }

  /**
   * Получение данных retention - ТОЛЬКО реальные данные
   * @returns {Promise<RetentionData[]>}
   */
  async getUserRetentionStats() {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile || !models.Quote) {
        logger.warn('📊 Модели недоступны для retention анализа');
        return [];
      }

      logger.info('📊 Получение РЕАЛЬНОЙ статистики retention');
      
      const cohorts = await models.UserProfile.aggregate([
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
        logger.info('📊 Нет данных когорт для retention анализа');
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

          const activeInWeek = await models.Quote.distinct('userId', {
            userId: { $in: cohortUsers },
            createdAt: { $gte: weekStart, $lt: weekEnd }
          });

          retention[`week${week}`] = cohortUsers.length > 0 ?
            Math.round((activeInWeek.length / cohortUsers.length) * 100) : 0;
        }

        retentionData.push(retention);
      }

      logger.info(`📊 Реальные данные retention получены: ${retentionData.length} когорт`);
      return retentionData;

    } catch (error) {
      logger.error('📊 Ошибка получения retention данных:', error);
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
      const models = this.getModels();
      
      if (!models || !models.Quote) {
        logger.warn('📊 Модель Quote недоступна для топ контента');
        return {
          topAuthors: [],
          topCategories: [],
          popularQuotes: [],
          dataSource: 'unavailable'
        };
      }

      logger.info(`📊 Получение РЕАЛЬНОГО топ контента для периода: ${dateRange}`);
      
      const startDate = this.getStartDate(dateRange);

      // Топ авторы
      const topAuthors = await models.Quote.aggregate([
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
      const topCategories = await models.Quote.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Популярные цитаты (повторяющиеся)
      const popularQuotes = await models.Quote.aggregate([
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

      logger.info('📊 Реальный топ контент получен:', {
        authors: topAuthors.length,
        categories: topCategories.length,
        popularQuotes: popularQuotes.length
      });

      return topContent;

    } catch (error) {
      logger.error('📊 Ошибка получения топ контента:', error);
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
      const models = this.getModels();
      
      if (!models || !models.UTMClick) {
        logger.warn('📊 Модель UTMClick недоступна');
        return;
      }
      
      const click = new models.UTMClick({
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
      logger.info(`📊 UTM клик записан: ${utmParams.utm_campaign} от ${userId}`);

    } catch (error) {
      logger.error('📊 Ошибка записи UTM клика:', error);
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
      const models = this.getModels();
      
      if (!models || !models.PromoCodeUsage) {
        logger.warn('📊 Модель PromoCodeUsage недоступна');
        return;
      }
      
      const usage = new models.PromoCodeUsage({
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
      logger.info(`📊 Промокод записан: ${promoCode} от ${userId}, сумма ${orderValue}`);

    } catch (error) {
      logger.error('📊 Ошибка записи промокода:', error);
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
      const models = this.getModels();
      
      if (!models || !models.UserAction) {
        logger.warn('📊 Модель UserAction недоступна');
        return;
      }
      
      const userAction = new models.UserAction({
        userId,
        action,
        metadata,
        timestamp: new Date()
      });

      await userAction.save();
      logger.info(`📊 Действие записано: ${action} от ${userId}`);

    } catch (error) {
      logger.error('📊 Ошибка записи действия пользователя:', error);
    }
  }

  // ========================================
  // МЕТОДЫ ДЛЯ РАБОТЫ С РЕАЛЬНЫМИ ДАННЫМИ
  // ========================================

  async getTotalUsers() {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна');
        return 0;
      }
      
      const count = await models.UserProfile.countDocuments({ isOnboardingComplete: true });
      logger.info(`📊 Общее количество пользователей: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка получения общего количества пользователей:', error);
      return 0;
    }
  }

  async getNewUsers(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна');
        return 0;
      }
      
      const count = await models.UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });
      logger.info(`📊 Новые пользователи с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка получения новых пользователей:', error);
      return 0;
    }
  }

  async getTotalQuotes(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.Quote) {
        logger.warn('📊 Quote модель недоступна');
        return 0;
      }
      
      const count = await models.Quote.countDocuments({ createdAt: { $gte: startDate } });
      logger.info(`📊 Цитат с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка получения количества цитат:', error);
      return 0;
    }
  }

  async getActiveUsers(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.Quote) {
        logger.warn('📊 Quote модель недоступна');
        return 0;
      }
      
      const activeUsers = await models.Quote.distinct('userId', { 
        createdAt: { $gte: startDate } 
      });
      logger.info(`📊 Активные пользователи с ${startDate.toISOString()}: ${activeUsers.length}`);
      return activeUsers.length;
    } catch (error) {
      logger.error('📊 Ошибка получения активных пользователей:', error);
      return 0;
    }
  }

  async getPromoUsage(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.PromoCodeUsage) {
        logger.warn('📊 Модель PromoCodeUsage недоступна');
        return 0;
      }
      
      const count = await models.PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      });
      logger.info(`📊 Использование промокодов с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      logger.warn('📊 Модель промокодов недоступна или ошибка:', error.message);
      return 0;
    }
  }

  async getSourceStats(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна');
        return [];
      }
      
      const stats = await models.UserProfile.aggregate([
        { 
          $match: { 
            registeredAt: { $gte: startDate },
            isOnboardingComplete: true
          } 
        },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      logger.info(`📊 Статистика источников: ${stats.length} источников`);
      return stats;
    } catch (error) {
      logger.error('📊 Ошибка получения статистики источников:', error);
      return [];
    }
  }

  async getUTMStats(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.UTMClick) {
        logger.warn('📊 Модель UTMClick недоступна');
        return [];
      }
      
      const stats = await models.UTMClick.aggregate([
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
      logger.info(`📊 UTM статистика: ${stats.length} кампаний`);
      return stats;
    } catch (error) {
      logger.warn('📊 Модель UTM недоступна или ошибка:', error.message);
      return [];
    }
  }

  // ========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ========================================

  /**
   * Возвращает пустую структуру данных
   */
  getEmptyStats(dateRange, errorMessage = null) {
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
      dataSource: errorMessage ? 'error' : 'unavailable',
      error: errorMessage
    };
  }

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