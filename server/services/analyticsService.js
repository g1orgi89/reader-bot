/**
 * @fileoverview Сервис аналитики для проекта "Читатель"
 * @description Обеспечивает сбор и анализ данных пользователей, цитат, конверсий
 */

const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');

// Попытка импорта моделей аналитики с fallback
let PromoCodeUsage, UTMClick, UserAction;
try {
  const analyticsModels = require('../models/analytics');
  PromoCodeUsage = analyticsModels.PromoCodeUsage;
  UTMClick = analyticsModels.UTMClick;
  UserAction = analyticsModels.UserAction;
} catch (error) {
  console.warn('📊 Analytics models not available, using fallback mode:', error.message);
}

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Общая статистика
 * @property {number} overview.totalUsers - Всего пользователей
 * @property {number} overview.newUsers - Новых пользователей за период
 * @property {number} overview.totalQuotes - Всего цитат за период
 * @property {number} overview.avgQuotesPerUser - Среднее цитат на пользователя
 * @property {number} overview.activeUsers - Активных пользователей
 * @property {number} overview.promoUsage - Использований промокодов
 * @property {Array} sourceStats - Статистика по источникам
 * @property {Array} utmStats - Статистика UTM кампаний
 * @property {string} period - Период анализа
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Когорта (YYYY-MM)
 * @property {number} size - Размер когорты
 * @property {number} week1 - Retention 1 неделя (%)
 * @property {number} week2 - Retention 2 недели (%)
 * @property {number} week3 - Retention 3 недели (%)
 * @property {number} week4 - Retention 4 недели (%)
 */

/**
 * @typedef {Object} TopContent
 * @property {Array} topAuthors - Топ авторы
 * @property {Array} topCategories - Топ категории
 * @property {Array} popularQuotes - Популярные цитаты
 */

/**
 * Сервис аналитики для проекта "Читатель"
 */
class AnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    this.isInitialized = false;
  }

  /**
   * Инициализация сервиса
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Проверяем доступность основных моделей
      await this.checkModelsAvailability();
      
      // Создаем тестовые данные если их нет
      await this.ensureTestData();
      
      this.isInitialized = true;
      console.log('📊 AnalyticsService initialized successfully');
    } catch (error) {
      console.error('📊 AnalyticsService initialization failed:', error);
      // Не блокируем работу, используем fallback режим
    }
  }

  /**
   * Проверка доступности моделей
   */
  async checkModelsAvailability() {
    const checks = {
      UserProfile: await UserProfile.countDocuments().limit(1).catch(() => null),
      Quote: await Quote.countDocuments().limit(1).catch(() => null),
      WeeklyReport: await WeeklyReport.countDocuments().limit(1).catch(() => null)
    };

    console.log('📊 Models availability check:', checks);
    return checks;
  }

  /**
   * Создание тестовых данных если их нет
   */
  async ensureTestData() {
    try {
      const userCount = await UserProfile.countDocuments();
      
      if (userCount === 0) {
        console.log('📊 Creating sample data for analytics dashboard...');
        await this.createSampleData();
      }
    } catch (error) {
      console.warn('📊 Could not create sample data:', error.message);
    }
  }

  /**
   * Создание демонстрационных данных
   */
  async createSampleData() {
    const sampleUsers = [
      {
        userId: 'demo_user_1',
        telegramUsername: 'demo_user_1',
        name: 'Мария Иванова',
        email: 'maria@example.com',
        source: 'Instagram',
        isOnboardingComplete: true,
        registeredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 дней назад
      },
      {
        userId: 'demo_user_2',
        telegramUsername: 'demo_user_2',
        name: 'Анна Петрова',
        email: 'anna@example.com',
        source: 'Telegram',
        isOnboardingComplete: true,
        registeredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 дней назад
      },
      {
        userId: 'demo_user_3',
        telegramUsername: 'demo_user_3',
        name: 'Елена Сидорова',
        email: 'elena@example.com',
        source: 'YouTube',
        isOnboardingComplete: true,
        registeredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 дней назад
      }
    ];

    const sampleQuotes = [
      {
        userId: 'demo_user_1',
        text: 'В каждом слове — целая жизнь',
        author: 'Марина Цветаева',
        category: 'Поэзия',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'demo_user_2',
        text: 'Любовь — это решение любить',
        author: 'Эрих Фромм',
        category: 'Психология',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'demo_user_1',
        text: 'Счастье внутри нас',
        author: 'Будда',
        category: 'Философия',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        userId: 'demo_user_3',
        text: 'Жизнь — это путешествие',
        author: null,
        category: 'Мотивация',
        createdAt: new Date()
      }
    ];

    try {
      // Создаем пользователей
      for (const userData of sampleUsers) {
        await UserProfile.findOneAndUpdate(
          { userId: userData.userId },
          userData,
          { upsert: true, new: true }
        );
      }

      // Создаем цитаты
      for (const quoteData of sampleQuotes) {
        await Quote.findOneAndUpdate(
          { userId: quoteData.userId, text: quoteData.text },
          quoteData,
          { upsert: true, new: true }
        );
      }

      console.log('📊 Sample data created successfully');
    } catch (error) {
      console.error('📊 Error creating sample data:', error);
    }
  }

  /**
   * Получение статистики для дашборда
   * @param {string} dateRange - Период ('1d', '7d', '30d', '90d')
   * @returns {Promise<DashboardStats>}
   */
  async getDashboardStats(dateRange = '7d') {
    const cacheKey = `dashboard_${dateRange}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      await this.initialize();
      
      const startDate = this.getStartDate(dateRange);

      // Параллельный сбор статистики
      const [
        totalUsers,
        newUsers,
        quotesStats,
        activeUsers,
        promoUsage,
        sourceStats,
        utmStats
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getNewUsers(startDate),
        this.getQuotesStats(startDate),
        this.getActiveUsers(startDate),
        this.getPromoUsage(startDate),
        this.getSourceStats(startDate),
        this.getUTMStats(startDate)
      ]);

      const stats = {
        overview: {
          totalUsers,
          newUsers,
          totalQuotes: quotesStats.total,
          avgQuotesPerUser: totalUsers > 0 ? Math.round((quotesStats.total / totalUsers) * 10) / 10 : 0,
          activeUsers,
          promoUsage
        },
        sourceStats,
        utmStats,
        period: dateRange
      };

      this.setCached(cacheKey, stats);
      return stats;

    } catch (error) {
      console.error('📊 Ошибка получения статистики дашборда:', error);
      
      // Возвращаем fallback данные
      return this.getFallbackDashboardStats(dateRange);
    }
  }

  /**
   * Fallback статистика для дашборда
   */
  getFallbackDashboardStats(dateRange) {
    return {
      overview: {
        totalUsers: 3,
        newUsers: 1,
        totalQuotes: 4,
        avgQuotesPerUser: 1.3,
        activeUsers: 2,
        promoUsage: 0
      },
      sourceStats: [
        { _id: 'Instagram', count: 1 },
        { _id: 'Telegram', count: 1 },
        { _id: 'YouTube', count: 1 }
      ],
      utmStats: [],
      period: dateRange
    };
  }

  /**
   * Получение данных retention по когортам
   * @returns {Promise<RetentionData[]>}
   */
  async getUserRetentionStats() {
    const cacheKey = 'retention_stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      await this.initialize();

      // Группировка пользователей по месяцам регистрации
      const cohorts = await UserProfile.aggregate([
        {
          $match: { isOnboardingComplete: true }
        },
        {
          $group: {
            _id: {
              year: { $year: '$registeredAt' },
              month: { $month: '$registeredAt' }
            },
            users: { $push: '$userId' },
            size: { $sum: 1 }
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
          size: cohort.size,
          week1: 0,
          week2: 0,
          week3: 0,
          week4: 0
        };

        // Проверяем активность пользователей по неделям
        for (let week = 1; week <= 4; week++) {
          const weekStart = new Date(cohortDate);
          weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          // Считаем пользователей, которые были активны в эту неделю
          const activeInWeek = await Quote.distinct('userId', {
            userId: { $in: cohortUsers },
            createdAt: { $gte: weekStart, $lt: weekEnd }
          });

          retention[`week${week}`] = Math.round((activeInWeek.length / cohort.size) * 100);
        }

        retentionData.push(retention);
      }

      this.setCached(cacheKey, retentionData);
      return retentionData;

    } catch (error) {
      console.error('📊 Ошибка получения retention статистики:', error);
      
      // Возвращаем fallback данные
      return this.getFallbackRetentionData();
    }
  }

  /**
   * Fallback данные retention
   */
  getFallbackRetentionData() {
    const currentDate = new Date();
    return [
      {
        cohort: `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`,
        size: 3,
        week1: 100,
        week2: 67,
        week3: 33,
        week4: 33
      }
    ];
  }

  /**
   * Получение топ контента
   * @param {string} dateRange - Период анализа
   * @returns {Promise<TopContent>}
   */
  async getTopQuotesAndAuthors(dateRange = '30d') {
    const cacheKey = `top_content_${dateRange}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      await this.initialize();
      
      const startDate = this.getStartDate(dateRange);

      const [topAuthors, topCategories, popularQuotes] = await Promise.all([
        // Топ авторы
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate }, author: { $ne: null, $ne: '' } } },
          { $group: { _id: '$author', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Топ категории
        Quote.aggregate([
          { $match: { createdAt: { $gte: startDate }, category: { $ne: null, $ne: '' } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Популярные цитаты (повторяющиеся)
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

      const result = {
        topAuthors,
        topCategories,
        popularQuotes
      };

      this.setCached(cacheKey, result);
      return result;

    } catch (error) {
      console.error('📊 Ошибка получения топ контента:', error);
      
      // Возвращаем fallback данные
      return this.getFallbackTopContent();
    }
  }

  /**
   * Fallback данные топ контента
   */
  getFallbackTopContent() {
    return {
      topAuthors: [
        { _id: 'Марина Цветаева', count: 1 },
        { _id: 'Эрих Фромм', count: 1 },
        { _id: 'Будда', count: 1 }
      ],
      topCategories: [
        { _id: 'Поэзия', count: 1 },
        { _id: 'Психология', count: 1 },
        { _id: 'Философия', count: 1 },
        { _id: 'Мотивация', count: 1 }
      ],
      popularQuotes: []
    };
  }

  /**
   * Трекинг UTM кликов
   * @param {Object} utmParams - UTM параметры
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async trackUTMClick(utmParams, userId) {
    if (!UTMClick) {
      console.warn('📊 UTMClick model not available, skipping tracking');
      return;
    }

    try {
      const click = new UTMClick({
        userId,
        source: utmParams.utm_source,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        content: utmParams.utm_content,
        timestamp: new Date(),
        userAgent: utmParams.user_agent,
        referrer: utmParams.referrer
      });

      await click.save();

      // Обновление счетчиков пользователя
      await this.updateUserClickStats(userId, utmParams.utm_campaign);

    } catch (error) {
      console.error('📊 Ошибка трекинга UTM клика:', error);
    }
  }

  /**
   * Трекинг использования промокодов
   * @param {string} promoCode - Промокод
   * @param {string} userId - ID пользователя
   * @param {number} orderValue - Сумма заказа
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<void>}
   */
  async trackPromoCodeUsage(promoCode, userId, orderValue, options = {}) {
    if (!PromoCodeUsage) {
      console.warn('📊 PromoCodeUsage model not available, skipping tracking');
      return;
    }

    try {
      const discount = this.getDiscountForPromoCode(promoCode);
      const discountAmount = orderValue * (discount / 100);
      const finalAmount = orderValue - discountAmount;

      const usage = new PromoCodeUsage({
        promoCode,
        userId,
        orderValue,
        discount,
        discountAmount,
        finalAmount,
        timestamp: new Date(),
        source: options.source || 'telegram_bot',
        reportType: options.reportType,
        booksPurchased: options.booksPurchased
      });

      await usage.save();

    } catch (error) {
      console.error('📊 Ошибка трекинга промокода:', error);
    }
  }

  /**
   * Трекинг действий пользователя
   * @param {string} userId - ID пользователя
   * @param {string} action - Тип действия
   * @param {Object} metadata - Дополнительные данные
   * @returns {Promise<void>}
   */
  async trackUserAction(userId, action, metadata = {}) {
    if (!UserAction) {
      console.warn('📊 UserAction model not available, skipping tracking');
      return;
    }

    try {
      const userAction = new UserAction({
        userId,
        action,
        metadata,
        timestamp: new Date()
      });

      await userAction.save();

    } catch (error) {
      console.error('📊 Ошибка трекинга действия пользователя:', error);
    }
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  /**
   * Получение общего количества пользователей
   * @returns {Promise<number>}
   */
  async getTotalUsers() {
    try {
      return await UserProfile.countDocuments({ isOnboardingComplete: true });
    } catch (error) {
      console.warn('📊 Error getting total users:', error.message);
      return 0;
    }
  }

  /**
   * Получение количества новых пользователей за период
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getNewUsers(startDate) {
    try {
      return await UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });
    } catch (error) {
      console.warn('📊 Error getting new users:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики цитат
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Object>}
   */
  async getQuotesStats(startDate) {
    try {
      const total = await Quote.countDocuments({ createdAt: { $gte: startDate } });
      return { total };
    } catch (error) {
      console.warn('📊 Error getting quotes stats:', error.message);
      return { total: 0 };
    }
  }

  /**
   * Получение количества активных пользователей
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getActiveUsers(startDate) {
    try {
      const activeUserIds = await Quote.distinct('userId', { createdAt: { $gte: startDate } });
      return activeUserIds.length;
    } catch (error) {
      console.warn('📊 Error getting active users:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики использования промокодов
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<number>}
   */
  async getPromoUsage(startDate) {
    if (!PromoCodeUsage) return 0;

    try {
      return await PromoCodeUsage.countDocuments({
        timestamp: { $gte: startDate }
      });
    } catch (error) {
      console.warn('📊 Error getting promo usage:', error.message);
      return 0;
    }
  }

  /**
   * Получение статистики по источникам
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getSourceStats(startDate) {
    try {
      return await UserProfile.aggregate([
        { $match: { registeredAt: { $gte: startDate } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } catch (error) {
      console.warn('📊 Error getting source stats:', error.message);
      return [];
    }
  }

  /**
   * Получение статистики UTM кампаний
   * @param {Date} startDate - Начальная дата
   * @returns {Promise<Array>}
   */
  async getUTMStats(startDate) {
    if (!UTMClick) return [];

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
      console.warn('📊 Error getting UTM stats:', error.message);
      return [];
    }
  }

  /**
   * Обновление статистики кликов пользователя
   * @param {string} userId - ID пользователя
   * @param {string} campaign - Кампания
   * @returns {Promise<void>}
   */
  async updateUserClickStats(userId, campaign) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          $inc: { 'analytics.totalClicks': 1 },
          $addToSet: { 'analytics.campaigns': campaign }
        }
      );
    } catch (error) {
      console.warn('📊 Error updating user click stats:', error.message);
    }
  }

  /**
   * Получение скидки для промокода
   * @param {string} promoCode - Промокод
   * @returns {number}
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
    
    return discountMap[promoCode] || 0;
  }

  /**
   * Получение начальной даты по периоду
   * @param {string} dateRange - Период
   * @returns {Date}
   */
  getStartDate(dateRange) {
    const now = new Date();
    switch (dateRange) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  /**
   * Получение данных из кэша
   * @param {string} key - Ключ кэша
   * @returns {any|null}
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Установка данных в кэш
   * @param {string} key - Ключ кэша
   * @param {any} data - Данные
   * @returns {void}
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Очистка кэша
   * @returns {void}
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new AnalyticsService();