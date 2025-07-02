/**
 * @fileoverview Интеграция геймификации с существующим Reader Bot (ФИНАЛЬНАЯ ВЕРСИЯ)
 * @author g1orgi89
 */

const QuoteHandler = require('./quoteHandler');
const CommandHandler = require('./commandHandler');
const AchievementService = require('./achievementService');
const logger = require('../utils/logger');

/**
 * Сервис интеграции геймификации с основным ботом
 */
class GameificationIntegration {
  constructor() {
    this.quoteHandler = new QuoteHandler();
    this.commandHandler = new CommandHandler();
    this.achievementService = new AchievementService();
    
    // Флаг инициализации
    this.isInitialized = false;
  }

  /**
   * Инициализация интеграции геймификации
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('🎮 Initializing Gamification Integration...');
      
      // Инициализируем компоненты
      this.isInitialized = true;
      
      logger.info('🎮 Gamification Integration initialized successfully');
      
      // Логируем доступные достижения
      const achievements = this.achievementService.getAllAchievements();
      logger.info(`🏆 Loaded ${achievements.length} achievements for Reader Bot`);
      
    } catch (error) {
      logger.error(`🎮 Failed to initialize Gamification Integration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обработка текстового сообщения от пользователя
   * @param {string} userId - ID пользователя Telegram
   * @param {string} messageText - Текст сообщения
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<Object>} Результат обработки
   */
  async handleMessage(userId, messageText, ctx) {
    if (!this.isInitialized) {
      throw new Error('Gamification Integration not initialized');
    }

    try {
      // Обрабатываем сообщение как цитату
      const result = await this.quoteHandler.handleQuote(userId, messageText);
      
      if (result.success) {
        // Отправляем основной ответ
        await ctx.reply(result.message, { parse_mode: 'Markdown' });
        
        // Если есть новые достижения, отправляем уведомления
        if (result.newAchievements && result.newAchievements.length > 0) {
          await this._sendAchievementNotifications(ctx, result.newAchievements);
        }
        
        logger.info(`📖 Quote processed for user ${userId}: ${result.todayCount} quotes today`);
      } else {
        // Отправляем сообщение об ошибке или лимите
        await ctx.reply(result.message);
        
        if (result.limitReached) {
          logger.info(`📖 Daily limit reached for user ${userId}`);
        }
      }

      return result;
      
    } catch (error) {
      logger.error(`🎮 Error handling message for user ${userId}: ${error.message}`);
      
      // Отправляем сообщение об ошибке пользователю
      await ctx.reply('Произошла ошибка при обработке цитаты. Попробуйте еще раз.');
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обработка команд бота
   * @param {string} command - Команда (/help, /stats, /search, /settings)
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleCommand(command, ctx) {
    if (!this.isInitialized) {
      throw new Error('Gamification Integration not initialized');
    }

    try {
      switch (command) {
        case '/help':
          await this.commandHandler.handleHelp(ctx);
          break;
        
        case '/stats':
          await this.commandHandler.handleStats(ctx);
          break;
        
        case '/search':
          await this.commandHandler.handleSearch(ctx);
          break;
        
        case '/settings':
          await this.commandHandler.handleSettings(ctx);
          break;
        
        default:
          await ctx.reply(`Неизвестная команда: ${command}

Доступные команды:
/help - справка
/stats - статистика и достижения
/search - поиск цитат
/settings - настройки`);
          break;
      }
      
      logger.info(`🎮 Command ${command} processed for user ${ctx.from.id}`);
      
    } catch (error) {
      logger.error(`🎮 Error handling command ${command}: ${error.message}`);
      await ctx.reply('Произошла ошибка при выполнении команды. Попробуйте позже.');
    }
  }

  /**
   * Обработка callback запросов (кнопки)
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleCallback(ctx) {
    if (!this.isInitialized) {
      throw new Error('Gamification Integration not initialized');
    }

    try {
      await this.commandHandler.handleCallback(ctx);
      logger.info(`🎮 Callback processed: ${ctx.callbackQuery.data}`);
      
    } catch (error) {
      logger.error(`🎮 Error handling callback: ${error.message}`);
      await ctx.answerCbQuery('Произошла ошибка');
    }
  }

  /**
   * Поиск цитат пользователя
   * @param {string} userId - ID пользователя
   * @param {string} searchText - Текст для поиска
   * @param {Object} ctx - Контекст Telegram бота
   * @returns {Promise<void>}
   */
  async handleTextSearch(userId, searchText, ctx) {
    if (!this.isInitialized) {
      throw new Error('Gamification Integration not initialized');
    }

    try {
      await this.commandHandler.handleTextSearch(ctx, searchText);
      logger.info(`🎮 Text search processed for user ${userId}: "${searchText}"`);
      
    } catch (error) {
      logger.error(`🎮 Error handling text search: ${error.message}`);
      await ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
    }
  }

  /**
   * Отправка уведомлений о достижениях
   * @param {Object} ctx - Контекст Telegram бота
   * @param {Object[]} achievements - Новые достижения
   * @returns {Promise<void>}
   * @private
   */
  async _sendAchievementNotifications(ctx, achievements) {
    try {
      for (const achievement of achievements) {
        const message = this.achievementService.formatAchievementNotification(achievement);
        
        // Отправляем с небольшой задержкой между уведомлениями
        await new Promise(resolve => setTimeout(resolve, 1000));
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
        logger.info(`🏆 Achievement notification sent: ${achievement.name} to user ${ctx.from.id}`);
      }
    } catch (error) {
      logger.error(`🏆 Error sending achievement notifications: ${error.message}`);
    }
  }

  /**
   * Получение статистики геймификации
   * @returns {Promise<Object>} Статистика
   */
  async getGamificationStats() {
    try {
      const { UserProfile, Quote } = require('../models');
      
      // Общая статистика
      const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
      const totalQuotes = await Quote.countDocuments();
      const averageQuotesPerUser = totalUsers > 0 ? Math.round(totalQuotes / totalUsers) : 0;
      
      // Статистика достижений
      const achievementStats = {};
      const achievements = this.achievementService.getAllAchievements();
      
      for (const achievement of achievements) {
        const usersWithAchievement = await UserProfile.countDocuments({
          'achievements.achievementId': achievement.id
        });
        
        achievementStats[achievement.id] = {
          name: achievement.name,
          usersUnlocked: usersWithAchievement,
          percentage: totalUsers > 0 ? Math.round((usersWithAchievement / totalUsers) * 100) : 0
        };
      }
      
      // Топ пользователи по цитатам
      const topUsers = await UserProfile.find({
        isOnboardingComplete: true
      })
      .sort({ 'statistics.totalQuotes': -1 })
      .limit(10)
      .select('name statistics.totalQuotes statistics.currentStreak achievements');
      
      // Статистика серий
      const streakStats = await UserProfile.aggregate([
        { $match: { isOnboardingComplete: true } },
        {
          $group: {
            _id: null,
            avgStreak: { $avg: '$statistics.currentStreak' },
            maxStreak: { $max: '$statistics.longestStreak' },
            usersWithStreak: {
              $sum: {
                $cond: [{ $gt: ['$statistics.currentStreak', 0] }, 1, 0]
              }
            }
          }
        }
      ]);
      
      return {
        overview: {
          totalUsers,
          totalQuotes,
          averageQuotesPerUser,
          totalAchievements: achievements.length
        },
        achievements: achievementStats,
        topUsers: topUsers.map(user => ({
          name: user.name,
          totalQuotes: user.statistics.totalQuotes,
          currentStreak: user.statistics.currentStreak,
          achievementsCount: user.achievements.length
        })),
        streaks: streakStats.length > 0 ? {
          averageCurrentStreak: Math.round(streakStats[0].avgStreak),
          maxStreak: streakStats[0].maxStreak,
          usersWithActiveStreak: streakStats[0].usersWithStreak
        } : {
          averageCurrentStreak: 0,
          maxStreak: 0,
          usersWithActiveStreak: 0
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error(`🎮 Error getting gamification stats: ${error.message}`);
      return {
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Проверка и разблокировка достижений для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object[]>} Новые достижения
   */
  async checkUserAchievements(userId) {
    try {
      return await this.achievementService.checkAndUnlockAchievements(userId);
    } catch (error) {
      logger.error(`🏆 Error checking achievements for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Получение информации о сервисе
   * @returns {Object} Информация о сервисе
   */
  getServiceInfo() {
    const achievements = this.achievementService.getAllAchievements();
    
    return {
      service: 'GameificationIntegration',
      isInitialized: this.isInitialized,
      components: {
        quoteHandler: !!this.quoteHandler,
        commandHandler: !!this.commandHandler,
        achievementService: !!this.achievementService
      },
      features: [
        'quote_processing',
        'daily_limits',
        'achievements_system',
        'user_statistics',
        'command_handling',
        'search_functionality',
        'settings_management',
        'integrated_achievements_display' // ОБНОВЛЕНО
      ],
      commands: [
        '/help - справка по боту',
        '/stats - статистика и все достижения', // ОБНОВЛЕНО
        '/search - поиск по цитатам',
        '/settings - настройки'
      ],
      achievements: {
        total: achievements.length,
        types: [...new Set(achievements.map(a => a.type))],
        list: achievements.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          targetValue: a.targetValue
        }))
      }
    };
  }

  /**
   * Проверка здоровья сервиса
   * @returns {Promise<Object>} Статус здоровья
   */
  async healthCheck() {
    try {
      const { UserProfile, Quote } = require('../models');
      
      // Проверяем доступность моделей
      const userCount = await UserProfile.countDocuments().limit(1);
      const quoteCount = await Quote.countDocuments().limit(1);
      
      // Проверяем инициализацию компонентов
      const componentsHealth = {
        quoteHandler: !!this.quoteHandler,
        commandHandler: !!this.commandHandler,
        achievementService: !!this.achievementService
      };
      
      const allComponentsHealthy = Object.values(componentsHealth).every(status => status);
      
      return {
        status: this.isInitialized && allComponentsHealthy ? 'healthy' : 'unhealthy',
        isInitialized: this.isInitialized,
        components: componentsHealth,
        database: {
          userProfileModel: typeof userCount === 'number',
          quoteModel: typeof quoteCount === 'number'
        },
        commands: {
          help: true,
          stats: true, // включает достижения
          search: true,
          settings: true
        },
        achievements: {
          integratedInStats: true, // НОВОЕ
          separateCommand: false   // НОВОЕ
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

// Экспортируем единственный экземпляр
module.exports = new GameificationIntegration();