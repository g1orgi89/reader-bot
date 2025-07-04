/**
 * @fileoverview Сервис аналитики Reader Bot - ИСПРАВЛЕНИЕ ПРЯМОЙ ИМПОРТ
 * @description Пробуем импортировать модели напрямую без models/index.js
 * @version 3.2.2 - DIRECT IMPORT APPROACH
 */

const logger = require('../utils/logger');

class AnalyticsService {
  constructor() {
    this.name = 'AnalyticsService';
    this._models = null;
    
    logger.info('📊 AnalyticsService инициализирован с прямым импортом моделей');
  }

  /**
   * Прямая загрузка моделей без models/index.js
   */
  getModels() {
    if (this._models) {
      logger.info('📊 Возвращаем кэшированные модели');
      return this._models;
    }

    try {
      logger.info('📊 Начинаем ПРЯМУЮ загрузку моделей...');
      
      // Пробуем импортировать модели напрямую
      const UserProfile = require('../models/userProfile');
      const Quote = require('../models/quote');
      
      logger.info(`📊 UserProfile загружен: ${typeof UserProfile}`);
      logger.info(`📊 Quote загружен: ${typeof Quote}`);
      
      // Пробуем analytics модели отдельно
      let UTMClick, PromoCodeUsage, UserAction;
      try {
        const analytics = require('../models/analytics');
        UTMClick = analytics.UTMClick;
        PromoCodeUsage = analytics.PromoCodeUsage;
        UserAction = analytics.UserAction;
        
        logger.info(`📊 Analytics модели загружены: UTMClick=${typeof UTMClick}, PromoCodeUsage=${typeof PromoCodeUsage}, UserAction=${typeof UserAction}`);
      } catch (analyticsError) {
        logger.warn('📊 Ошибка загрузки analytics моделей:', analyticsError.message);
        UTMClick = null;
        PromoCodeUsage = null;
        UserAction = null;
      }
      
      // Пробуем другие модели
      let WeeklyReport, MonthlyReport;
      try {
        WeeklyReport = require('../models/weeklyReport');
        MonthlyReport = require('../models/monthlyReport');
        logger.info(`📊 Report модели загружены: WeeklyReport=${typeof WeeklyReport}, MonthlyReport=${typeof MonthlyReport}`);
      } catch (reportError) {
        logger.warn('📊 Ошибка загрузки report моделей:', reportError.message);
        WeeklyReport = null;
        MonthlyReport = null;
      }
      
      this._models = {
        UserProfile,
        Quote,
        UTMClick,
        PromoCodeUsage,
        UserAction,
        WeeklyReport,
        MonthlyReport
      };
      
      // Проверяем критические модели
      const requiredModels = ['UserProfile', 'Quote'];
      const missingModels = requiredModels.filter(model => !this._models[model]);
      
      if (missingModels.length > 0) {
        logger.error(`📊 Отсутствуют критические модели: ${missingModels.join(', ')}`);
        this._models = null;
        return null;
      }
      
      logger.info('📊 ✅ Модели успешно загружены прямым импортом');
      return this._models;
      
    } catch (error) {
      logger.error('📊 ❌ Ошибка прямой загрузки моделей:', error.message);
      logger.error('📊 ❌ Stack trace:', error.stack);
      this._models = null;
      return null;
    }
  }

  /**
   * Простой тест подключения к базе данных
   */
  async testDatabaseConnection() {
    try {
      const mongoose = require('mongoose');
      const isConnected = mongoose.connection.readyState === 1;
      
      logger.info(`📊 Статус подключения MongoDB: ${isConnected ? 'подключено' : 'отключено'}`);
      logger.info(`📊 MongoDB readyState: ${mongoose.connection.readyState}`);
      logger.info(`📊 MongoDB connection name: ${mongoose.connection.name}`);
      
      return isConnected;
    } catch (error) {
      logger.error('📊 Ошибка проверки подключения к базе:', error.message);
      return false;
    }
  }

  /**
   * Получение статистики дашборда с диагностикой
   */
  async getDashboardStats(dateRange = '7d') {
    try {
      logger.info(`📊 ===== НАЧАЛО getDashboardStats(${dateRange}) =====`);
      
      // Проверяем подключение к базе
      const dbConnected = await this.testDatabaseConnection();
      if (!dbConnected) {
        logger.error('📊 База данных не подключена!');
        return this.getEmptyStats(dateRange, 'Database not connected');
      }
      
      // Пробуем загрузить модели
      const models = this.getModels();
      
      if (!models) {
        logger.error('📊 Модели недоступны, возвращаем пустые данные');
        return this.getEmptyStats(dateRange, 'Models not available');
      }

      logger.info(`📊 Модели загружены успешно, начинаем получение данных`);
      
      // Простой тест - пробуем получить хотя бы общее количество пользователей
      const totalUsers = await this.getTotalUsers();
      logger.info(`📊 Тест получения пользователей: ${totalUsers}`);
      
      if (totalUsers === 0) {
        // Возможно, данных нет в базе - проверим напрямую
        const testCount = await models.UserProfile.countDocuments({});
        logger.info(`📊 Прямой подсчет всех UserProfile: ${testCount}`);
        
        if (testCount > 0) {
          const completedCount = await models.UserProfile.countDocuments({ isOnboardingComplete: true });
          logger.info(`📊 Пользователи с завершенным онбордингом: ${completedCount}`);
        }
      }
      
      const startDate = this.getStartDate(dateRange);
      logger.info(`📊 Дата начала периода: ${startDate.toISOString()}`);
      
      // Получаем данные по частям с логированием
      const totalQuotes = await this.getTotalQuotes(startDate);
      const newUsers = await this.getNewUsers(startDate);
      const activeUsers = await this.getActiveUsers(startDate);
      const sourceStats = await this.getSourceStats(startDate);
      
      const stats = {
        overview: {
          totalUsers,
          newUsers,
          totalQuotes,
          avgQuotesPerUser: totalUsers > 0 ? Math.round((totalQuotes / totalUsers) * 10) / 10 : 0,
          activeUsers,
          promoUsage: 0
        },
        sourceStats: sourceStats || [],
        utmStats: [],
        period: dateRange,
        timestamp: new Date().toISOString(),
        fallbackMode: false,
        dataSource: 'mongodb'
      };

      logger.info(`📊 ===== РЕЗУЛЬТАТ getDashboardStats =====`);
      logger.info(`📊 Результат: ${JSON.stringify(stats.overview, null, 2)}`);
      
      return stats;

    } catch (error) {
      logger.error('📊 ❌ Ошибка в getDashboardStats:', error.message);
      logger.error('📊 ❌ Stack trace:', error.stack);
      return this.getEmptyStats(dateRange, error.message);
    }
  }

  async getUserRetentionStats() {
    logger.info('📊 ===== getUserRetentionStats =====');
    const models = this.getModels();
    
    if (!models || !models.UserProfile || !models.Quote) {
      logger.warn('📊 Модели недоступны для retention анализа');
      return [];
    }

    // Пока возвращаем пустой массив, фокусируемся на основной проблеме
    return [];
  }

  async getTopQuotesAndAuthors(dateRange = '30d') {
    logger.info(`📊 ===== getTopQuotesAndAuthors(${dateRange}) =====`);
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

    // Пока возвращаем пустые данные, фокусируемся на основной проблеме
    return {
      topAuthors: [],
      topCategories: [],
      popularQuotes: [],
      dataSource: 'mongodb',
      period: dateRange
    };
  }

  // Упрощенные методы для диагностики
  async getTotalUsers() {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна в getTotalUsers');
        return 0;
      }
      
      logger.info('📊 Выполняем UserProfile.countDocuments...');
      const count = await models.UserProfile.countDocuments({ isOnboardingComplete: true });
      logger.info(`📊 Результат подсчета пользователей: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка в getTotalUsers:', error.message);
      return 0;
    }
  }

  async getNewUsers(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна в getNewUsers');
        return 0;
      }
      
      const count = await models.UserProfile.countDocuments({
        isOnboardingComplete: true,
        registeredAt: { $gte: startDate }
      });
      logger.info(`📊 Новые пользователи с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка в getNewUsers:', error.message);
      return 0;
    }
  }

  async getTotalQuotes(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.Quote) {
        logger.warn('📊 Quote модель недоступна в getTotalQuotes');
        return 0;
      }
      
      const count = await models.Quote.countDocuments({ createdAt: { $gte: startDate } });
      logger.info(`📊 Цитат с ${startDate.toISOString()}: ${count}`);
      return count;
    } catch (error) {
      logger.error('📊 Ошибка в getTotalQuotes:', error.message);
      return 0;
    }
  }

  async getActiveUsers(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.Quote) {
        logger.warn('📊 Quote модель недоступна в getActiveUsers');
        return 0;
      }
      
      const activeUsers = await models.Quote.distinct('userId', { 
        createdAt: { $gte: startDate } 
      });
      logger.info(`📊 Активные пользователи: ${activeUsers.length}`);
      return activeUsers.length;
    } catch (error) {
      logger.error('📊 Ошибка в getActiveUsers:', error.message);
      return 0;
    }
  }

  async getSourceStats(startDate) {
    try {
      const models = this.getModels();
      
      if (!models || !models.UserProfile) {
        logger.warn('📊 UserProfile модель недоступна в getSourceStats');
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
      logger.error('📊 Ошибка в getSourceStats:', error.message);
      return [];
    }
  }

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

  // Заглушки для методов трекинга
  async trackUTMClick() { /* заглушка */ }
  async trackPromoCodeUsage() { /* заглушка */ }
  async trackUserAction() { /* заглушка */ }
}

module.exports = new AnalyticsService();