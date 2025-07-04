/**
 * @fileoverview Сервис аналитики Reader Bot - ДИАГНОСТИКА ПРОБЛЕМЫ
 * @description Детальное логирование для выявления проблемы с моделями
 * @version 3.2.1 - DIAGNOSTIC VERSION
 */

const logger = require('../utils/logger');

class AnalyticsService {
  constructor() {
    this.name = 'AnalyticsService';
    this._models = null;
    
    logger.info('📊 AnalyticsService конструктор запущен');
  }

  /**
   * Диагностическая загрузка моделей с детальным логированием
   */
  getModels() {
    if (this._models) {
      logger.info('📊 Возвращаем кэшированные модели');
      return this._models;
    }

    try {
      logger.info('📊 Начинаем загрузку моделей...');
      
      // Проверяем путь к моделям
      const modelsPath = '../models';
      logger.info(`📊 Путь к моделям: ${modelsPath}`);
      
      const models = require(modelsPath);
      logger.info(`📊 require('../models') выполнен, тип: ${typeof models}`);
      logger.info(`📊 Ключи models: ${Object.keys(models)}`);
      
      // Проверяем каждую модель отдельно
      const modelNames = ['UserProfile', 'Quote', 'UTMClick', 'PromoCodeUsage', 'UserAction'];
      const modelStatus = {};
      
      for (const modelName of modelNames) {
        const model = models[modelName];
        modelStatus[modelName] = {
          exists: !!model,
          type: typeof model,
          isFunction: typeof model === 'function',
          hasSchema: !!(model && model.schema)
        };
        logger.info(`📊 Модель ${modelName}: exists=${!!model}, type=${typeof model}`);
      }
      
      this._models = {
        UserProfile: models.UserProfile,
        Quote: models.Quote,
        UTMClick: models.UTMClick,
        PromoCodeUsage: models.PromoCodeUsage,
        UserAction: models.UserAction,
        WeeklyReport: models.WeeklyReport,
        MonthlyReport: models.MonthlyReport
      };
      
      // Проверяем критические модели
      const requiredModels = ['UserProfile', 'Quote'];
      const missingModels = requiredModels.filter(model => !this._models[model]);
      
      if (missingModels.length > 0) {
        logger.error(`📊 Отсутствуют критические модели: ${missingModels.join(', ')}`);
        logger.error(`📊 Статус всех моделей: ${JSON.stringify(modelStatus, null, 2)}`);
        this._models = null;
        return null;
      }
      
      logger.info('📊 ✅ Все модели успешно загружены');
      return this._models;
      
    } catch (error) {
      logger.error('📊 ❌ Ошибка загрузки моделей:', error.message);
      logger.error('📊 ❌ Stack trace:', error.stack);
      
      // Дополнительная диагностика
      try {
        const fs = require('fs');
        const path = require('path');
        const modelsDir = path.join(__dirname, '../models');
        logger.info(`📊 Диагностика: проверяем директорию ${modelsDir}`);
        
        if (fs.existsSync(modelsDir)) {
          const files = fs.readdirSync(modelsDir);
          logger.info(`📊 Файлы в директории models: ${files.join(', ')}`);
        } else {
          logger.error(`📊 Директория ${modelsDir} не существует!`);
        }
        
        // Пробуем загрузить index.js напрямую
        const indexPath = path.join(modelsDir, 'index.js');
        if (fs.existsSync(indexPath)) {
          logger.info(`📊 Файл ${indexPath} существует`);
        } else {
          logger.error(`📊 Файл ${indexPath} не найден!`);
        }
      } catch (diagnosticError) {
        logger.error('📊 Ошибка диагностики:', diagnosticError.message);
      }
      
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
      
      const stats = {
        overview: {
          totalUsers,
          newUsers,
          totalQuotes,
          avgQuotesPerUser: totalUsers > 0 ? Math.round((totalQuotes / totalUsers) * 10) / 10 : 0,
          activeUsers,
          promoUsage: 0
        },
        sourceStats: [],
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