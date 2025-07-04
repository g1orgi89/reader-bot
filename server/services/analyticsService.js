/**
 * @fileoverview Сервис аналитики для проекта "Читатель"
 * @description Обеспечивает сбор и анализ данных пользователей, цитат, конверсий
 */

const UserProfile = require('../models/userProfile');
const Quote = require('../models/quote');
const WeeklyReport = require('../models/weeklyReport');
const MonthlyReport = require('../models/monthlyReport');
const { PromoCodeUsage, UTMClick } = require('../models/analytics');

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
      const startDate = this.getStartDate(dateRange);
      const now = new Date();

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
      throw new Error('Не удалось загрузить статистику дашборда');
    }
  }

  /**
   * Получение данных retention по когортам
   * @returns {Promise<RetentionData[]>}
   */
  async getUserRetentionStats() {
    const cacheKey = 'retention_stats';
    const cached = this.getCached(cacheKey);
    