/**
 * @fileoverview Startup file for Reader Telegram bot with all services
 * @author g1orgi89
 * 📖 UPDATED: Complete integration with MonthlyReportService and FeedbackHandler
 * 📖 FINAL: Ready for production deployment
 */

const logger = require('../server/utils/logger');
const ReaderTelegramBot = require('./index');

// Import all services
const { CronService } = require('../server/services/cronService');
const { WeeklyReportHandler } = require('./handlers/weeklyReportHandler');
const { MonthlyReportService } = require('../server/services/monthlyReportService');
const { ReminderService } = require('../server/services/reminderService');

/**
 * @typedef {Object} TelegramServices
 * @property {ReaderTelegramBot} bot - Main Telegram bot instance
 * @property {WeeklyReportHandler} weeklyReportHandler - Weekly reports handler
 * @property {MonthlyReportService} monthlyReportService - Monthly reports service
 * @property {ReminderService} reminderService - Reminder service
 * @property {CronService} cronService - Scheduled tasks service
 */

class TelegramServiceManager {
  constructor() {
    this.services = {
      bot: null,
      weeklyReportHandler: null,
      monthlyReportService: null,
      reminderService: null,
      cronService: null
    };

    this.isInitialized = false;
    this.isStarted = false;
  }

  /**
   * Initialize all Telegram services
   * @returns {Promise<TelegramServices>}
   */
  async initialize() {
    try {
      logger.info('📖 Initializing Telegram services...');

      // 1. Initialize main Telegram bot
      this.services.bot = new ReaderTelegramBot({
        token: process.env.TELEGRAM_BOT_TOKEN,
        environment: process.env.NODE_ENV || 'production',
        maxMessageLength: 4096
      });

      // 2. Initialize WeeklyReportHandler
      this.services.weeklyReportHandler = new WeeklyReportHandler();
      await this.services.weeklyReportHandler.initialize({
        bot: this.services.bot.bot // Pass Telegraf instance
      });

      // 3. Initialize MonthlyReportService
      this.services.monthlyReportService = new MonthlyReportService();
      
      // 4. Initialize ReminderService
      this.services.reminderService = new ReminderService();
      await this.services.reminderService.initialize({
        bot: this.services.bot.bot // Pass Telegraf instance
      });

      // 5. Initialize CronService with all dependencies
      this.services.cronService = new CronService();
      this.services.cronService.initialize({
        bot: this.services.bot.bot,
        weeklyReportHandler: this.services.weeklyReportHandler,
        monthlyReportService: this.services.monthlyReportService,
        reminderService: this.services.reminderService
      });

      // 6. Set external services in main bot
      this.services.bot.setExternalServices({
        weeklyReportHandler: this.services.weeklyReportHandler,
        monthlyReportService: this.services.monthlyReportService
      });

      // 7. Initialize main bot
      await this.services.bot.initialize();

      this.isInitialized = true;
      logger.info('📖 All Telegram services initialized successfully');

      return this.services;

    } catch (error) {
      logger.error(`📖 Failed to initialize Telegram services: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Start all services
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('📖 Starting all Telegram services...');

      // 1. Start main Telegram bot
      await this.services.bot.start();

      // 2. Start cron service for scheduled tasks
      const cronStarted = this.services.cronService.start();
      if (!cronStarted) {
        logger.warn('📖 CronService failed to start, but continuing...');
      }

      this.isStarted = true;
      logger.info('📖 All Telegram services started successfully');

      // Send startup notification to admin
      await this.sendStartupNotification();

    } catch (error) {
      logger.error(`📖 Failed to start Telegram services: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Stop all services
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      logger.info('📖 Stopping all Telegram services...');

      // Stop services in reverse order
      if (this.services.cronService) {
        this.services.cronService.stop();
      }

      if (this.services.bot) {
        await this.services.bot.stop();
      }

      this.isStarted = false;
      logger.info('📖 All Telegram services stopped successfully');

    } catch (error) {
      logger.error(`📖 Error stopping services: ${error.message}`, error);
    }
  }

  /**
   * Send startup notification to admin
   * @private
   */
  async sendStartupNotification() {
    try {
      if (!process.env.ADMIN_TELEGRAM_ID) {
        logger.info('📖 No admin Telegram ID configured, skipping startup notification');
        return;
      }

      const stats = await this.getSystemStats();
      const message = `🚀 *Reader Bot запущен*

📊 *Статистика системы:*
└ Пользователей: ${stats.users.total}
└ Активных: ${stats.users.active}
└ Всего цитат: ${stats.quotes.total}
└ За сегодня: ${stats.quotes.today}

🤖 *Сервисы:*
└ Telegram Bot: ✅
└ Еженедельные отчеты: ${stats.services.weeklyReports ? '✅' : '❌'}
└ Месячные отчеты: ${stats.services.monthlyReports ? '✅' : '❌'}
└ Напоминания: ${stats.services.reminders ? '✅' : '❌'}
└ Cron задачи: ${stats.services.cron ? '✅' : '❌'}

⏰ *Время запуска:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК

Бот готов к работе! 📖`;

      await this.services.bot.sendMessageToUser(
        process.env.ADMIN_TELEGRAM_ID,
        message,
        { parseMode: 'Markdown' }
      );

      logger.info('📖 Startup notification sent to admin');

    } catch (error) {
      logger.error(`📖 Failed to send startup notification: ${error.message}`);
    }
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>}
   */
  async getSystemStats() {
    try {
      const { UserProfile, Quote } = require('../server/models');
      
      // User stats
      const totalUsers = await UserProfile.countDocuments({ isOnboardingComplete: true });
      const activeUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true,
        'statistics.currentStreak': { $gt: 0 }
      });

      // Quote stats
      const totalQuotes = await Quote.countDocuments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayQuotes = await Quote.countDocuments({ createdAt: { $gte: today } });

      // Service availability
      const serviceStats = {
        weeklyReports: !!this.services.weeklyReportHandler,
        monthlyReports: !!this.services.monthlyReportService,
        reminders: !!this.services.reminderService,
        cron: this.services.cronService?.isReady() || false
      };

      return {
        users: {
          total: totalUsers,
          active: activeUsers
        },
        quotes: {
          total: totalQuotes,
          today: todayQuotes
        },
        services: serviceStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`📖 Error getting system stats: ${error.message}`);
      return {
        users: { total: 0, active: 0 },
        quotes: { total: 0, today: 0 },
        services: { weeklyReports: false, monthlyReports: false, reminders: false, cron: false },
        error: error.message
      };
    }
  }

  /**
   * Get detailed service diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      initialized: this.isInitialized,
      started: this.isStarted,
      services: {
        bot: {
          initialized: !!this.services.bot?.isInitialized,
          status: this.services.bot ? 'ready' : 'not_initialized'
        },
        weeklyReports: {
          initialized: !!this.services.weeklyReportHandler,
          status: this.services.weeklyReportHandler ? 'ready' : 'not_initialized'
        },
        monthlyReports: {
          initialized: !!this.services.monthlyReportService,
          status: this.services.monthlyReportService ? 'ready' : 'not_initialized'
        },
        reminders: {
          initialized: !!this.services.reminderService,
          status: this.services.reminderService ? 'ready' : 'not_initialized'
        },
        cron: {
          initialized: !!this.services.cronService,
          ready: this.services.cronService?.isReady() || false,
          status: this.services.cronService ? 'ready' : 'not_initialized'
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        telegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
        adminId: !!process.env.ADMIN_TELEGRAM_ID,
        mongoUri: !!process.env.MONGODB_URI,
        claudeKey: !!process.env.ANTHROPIC_API_KEY
      }
    };
  }

  /**
   * Health check for all services
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      const health = {
        status: 'healthy',
        services: {},
        timestamp: new Date().toISOString()
      };

      // Check main bot
      if (this.services.bot) {
        health.services.bot = await this.services.bot.healthCheck();
      } else {
        health.services.bot = { status: 'not_initialized' };
        health.status = 'unhealthy';
      }

      // Check cron service
      if (this.services.cronService) {
        health.services.cron = this.services.cronService.getDiagnostics();
      } else {
        health.services.cron = { status: 'not_initialized' };
      }

      // Check other services
      health.services.weeklyReports = { 
        status: this.services.weeklyReportHandler ? 'ready' : 'not_initialized' 
      };
      health.services.monthlyReports = { 
        status: this.services.monthlyReportService ? 'ready' : 'not_initialized' 
      };
      health.services.reminders = { 
        status: this.services.reminderService ? 'ready' : 'not_initialized' 
      };

      return health;

    } catch (error) {
      logger.error(`📖 Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Manual trigger for testing services
   * @param {string} serviceName - Service to trigger
   * @returns {Promise<Object>}
   */
  async triggerService(serviceName) {
    try {
      switch (serviceName) {
        case 'weekly_reports':
          if (this.services.cronService) {
            return await this.services.cronService.triggerWeeklyReports();
          }
          throw new Error('CronService not available');

        case 'monthly_reports':
          if (this.services.cronService) {
            return await this.services.cronService.triggerMonthlyReports();
          }
          throw new Error('CronService not available');

        case 'reminders':
          if (this.services.cronService) {
            await this.services.cronService.triggerReminders();
            return { message: 'Reminders triggered successfully' };
          }
          throw new Error('CronService not available');

        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }

    } catch (error) {
      logger.error(`📖 Error triggering service ${serviceName}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service instances (for external access)
   * @returns {TelegramServices}
   */
  getServices() {
    return this.services;
  }

  /**
   * Check if all critical services are ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && 
           this.isStarted && 
           !!this.services.bot?.isInitialized &&
           !!this.services.weeklyReportHandler &&
           !!this.services.monthlyReportService;
  }
}

// Create service manager instance
const serviceManager = new TelegramServiceManager();

/**
 * Start all Telegram services
 * @returns {Promise<TelegramServices>}
 */
async function startTelegramServices() {
  try {
    logger.info('📖 Starting Reader Telegram services...');
    
    await serviceManager.start();
    
    logger.info('📖 Reader Telegram services started successfully');
    return serviceManager.getServices();
    
  } catch (error) {
    logger.error(`📖 Failed to start Telegram services: ${error.message}`, error);
    throw error;
  }
}

/**
 * Stop all Telegram services
 * @returns {Promise<void>}
 */
async function stopTelegramServices() {
  try {
    await serviceManager.stop();
  } catch (error) {
    logger.error(`📖 Error stopping Telegram services: ${error.message}`, error);
    throw error;
  }
}

/**
 * Get service manager diagnostics
 * @returns {Object}
 */
function getTelegramServicesDiagnostics() {
  return serviceManager.getDiagnostics();
}

/**
 * Health check for all services
 * @returns {Promise<Object>}
 */
async function telegramHealthCheck() {
  return await serviceManager.healthCheck();
}

/**
 * Manual trigger for testing
 * @param {string} serviceName - Service to trigger
 * @returns {Promise<Object>}
 */
async function triggerTelegramService(serviceName) {
  return await serviceManager.triggerService(serviceName);
}

// Export everything
module.exports = {
  TelegramServiceManager,
  serviceManager,
  startTelegramServices,
  stopTelegramServices,
  getTelegramServicesDiagnostics,
  telegramHealthCheck,
  triggerTelegramService
};

// If run directly, start services
if (require.main === module) {
  startTelegramServices()
    .then(() => {
      logger.info('📖 Reader Telegram bot started from command line');
    })
    .catch((error) => {
      logger.error(`📖 Failed to start from command line: ${error.message}`);
      process.exit(1);
    });
}
