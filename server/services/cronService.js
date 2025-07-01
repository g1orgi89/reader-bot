/**
 * @fileoverview Сервис cron-задач для проекта "Читатель"
 * @author g1orgi89
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * @class CronService
 * @description Сервис для управления автоматическими задачами
 */
class CronService {
  constructor() {
    this.weeklyReportService = null;
    this.telegramReportService = null;
    this.jobs = new Map();
    this.isStarted = false;
    
    // Инициализация сервисов
    this._initializeServices();
  }

  /**
   * Инициализация зависимых сервисов
   * @private
   */
  _initializeServices() {
    try {
      this.weeklyReportService = require('./weeklyReportService');
      this.telegramReportService = require('./telegramReportService');
      logger.info('📖 CronService dependencies initialized');
    } catch (error) {
      logger.error(`📖 Failed to initialize CronService dependencies: ${error.message}`);
    }
  }

  /**
   * Запуск всех cron-задач
   * @returns {boolean} Успешность запуска
   */
  start() {
    if (this.isStarted) {
      logger.warn('📖 CronService is already started');
      return true;
    }

    try {
      this._scheduleWeeklyReports();
      this._scheduleDailyReminders();
      this._scheduleMonthlyReports();
      this._scheduleCleanupTasks();
      
      this.isStarted = true;
      logger.info('📖 CronService started successfully with all scheduled tasks');
      return true;
    } catch (error) {
      logger.error(`📖 Failed to start CronService: ${error.message}`);
      return false;
    }
  }

  /**
   * Остановка всех cron-задач
   */
  stop() {
    if (!this.isStarted) {
      logger.warn('📖 CronService is not started');
      return;
    }

    this.jobs.forEach((job, name) => {
      try {
        job.destroy();
        logger.info(`📖 Stopped cron job: ${name}`);
      } catch (error) {
        logger.error(`📖 Error stopping job ${name}: ${error.message}`);
      }
    });

    this.jobs.clear();
    this.isStarted = false;
    logger.info('📖 CronService stopped');
  }

  /**
   * Планировщик еженедельных отчетов (воскресенье 11:00 МСК)
   * @private
   */
  _scheduleWeeklyReports() {
    const job = cron.schedule('0 11 * * 0', async () => {
      logger.info('📖 Starting weekly reports generation...');
      
      try {
        const stats = await this.weeklyReportService.generateWeeklyReportsForAllUsers();
        logger.info(`📖 Weekly reports generated: ${JSON.stringify(stats)}`);
        
        // Отправка отчетов через Telegram
        await this._sendWeeklyReportsToTelegram(stats);
        
      } catch (error) {
        logger.error(`📖 Error in weekly reports cron job: ${error.message}`);
      }
    }, {
      timezone: "Europe/Moscow"
    });

    this.jobs.set('weeklyReports', job);
    logger.info('📖 Scheduled weekly reports job: Sundays at 11:00 MSK');
  }

  /**
   * Отправка еженедельных отчетов в Telegram
   * @private
   * @param {Object} stats - Статистика генерации
   */
  async _sendWeeklyReportsToTelegram(stats) {
    try {
      if (!this.telegramReportService) {
        logger.error('📖 TelegramReportService not available');
        return;
      }

      // Получаем все сгенерированные отчеты за последний час
      const recentReports = await this._getRecentReports();
      
      for (const report of recentReports) {
        try {
          await this.telegramReportService.sendWeeklyReport(report);
          logger.info(`📖 Sent weekly report to user ${report.userId}`);
        } catch (error) {
          logger.error(`📖 Failed to send report to user ${report.userId}: ${error.message}`);
        }
      }

      logger.info(`📖 Weekly reports sent to ${recentReports.length} users`);
    } catch (error) {
      logger.error(`📖 Error sending weekly reports to Telegram: ${error.message}`);
    }
  }

  /**
   * Получение недавно созданных отчетов
   * @private
   * @returns {Promise<Array>} Недавние отчеты
   */
  async _getRecentReports() {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const WeeklyReport = require('../models/weeklyReport');
      return await WeeklyReport.find({
        sentAt: { $gte: oneHourAgo }
      }).populate('quotes');
    } catch (error) {
      logger.error(`📖 Error getting recent reports: ${error.message}`);
      return [];
    }
  }

  /**
   * Планировщик ежедневных напоминаний
   * @private
   */
  _scheduleDailyReminders() {
    // Утренние напоминания (9:00 МСК)
    const morningJob = cron.schedule('0 9 * * *', async () => {
      logger.info('📖 Starting morning reminders...');
      try {
        await this._sendRemindersByTime('morning');
      } catch (error) {
        logger.error(`📖 Error in morning reminders: ${error.message}`);
      }
    }, {
      timezone: "Europe/Moscow"
    });

    // Вечерние напоминания (19:00 МСК)
    const eveningJob = cron.schedule('0 19 * * *', async () => {
      logger.info('📖 Starting evening reminders...');
      try {
        await this._sendRemindersByTime('evening');
      } catch (error) {
        logger.error(`📖 Error in evening reminders: ${error.message}`);
      }
    }, {
      timezone: "Europe/Moscow"
    });

    this.jobs.set('morningReminders', morningJob);
    this.jobs.set('eveningReminders', eveningJob);
    logger.info('📖 Scheduled daily reminders: 9:00 and 19:00 MSK');
  }

  /**
   * Отправка напоминаний по времени
   * @private
   * @param {string} timeType - Тип времени ('morning', 'evening')
   */
  async _sendRemindersByTime(timeType) {
    try {
      // Здесь будет логика напоминаний, пока заглушка
      logger.info(`📖 ${timeType} reminders sent (placeholder)`);
    } catch (error) {
      logger.error(`📖 Error sending ${timeType} reminders: ${error.message}`);
    }
  }

  /**
   * Планировщик месячных отчетов (1 числа каждого месяца в 12:00 МСК)
   * @private
   */
  _scheduleMonthlyReports() {
    const job = cron.schedule('0 12 1 * *', async () => {
      logger.info('📖 Starting monthly reports generation...');
      
      try {
        await this._generateMonthlyReportsForActiveUsers();
      } catch (error) {
        logger.error(`📖 Error in monthly reports cron job: ${error.message}`);
      }
    }, {
      timezone: "Europe/Moscow"
    });

    this.jobs.set('monthlyReports', job);
    logger.info('📖 Scheduled monthly reports job: 1st day of month at 12:00 MSK');
  }

  /**
   * Генерация месячных отчетов для активных пользователей
   * @private
   */
  async _generateMonthlyReportsForActiveUsers() {
    try {
      // Здесь будет логика месячных отчетов, пока заглушка
      logger.info('📖 Monthly reports generation completed (placeholder)');
    } catch (error) {
      logger.error(`📖 Error generating monthly reports: ${error.message}`);
    }
  }

  /**
   * Планировщик задач очистки
   * @private
   */
  _scheduleCleanupTasks() {
    // Очистка каждый день в 3:00 МСК
    const job = cron.schedule('0 3 * * *', async () => {
      logger.info('📖 Starting daily cleanup tasks...');
      
      try {
        await this._performDailyCleanup();
      } catch (error) {
        logger.error(`📖 Error in cleanup tasks: ${error.message}`);
      }
    }, {
      timezone: "Europe/Moscow"
    });

    this.jobs.set('dailyCleanup', job);
    logger.info('📖 Scheduled daily cleanup: 3:00 MSK');
  }

  /**
   * Выполнение ежедневной очистки
   * @private
   */
  async _performDailyCleanup() {
    try {
      const cleanupTasks = [];

      // Очистка старых логов (старше 30 дней)
      cleanupTasks.push(this._cleanupOldLogs());
      
      // Очистка просроченных промокодов
      cleanupTasks.push(this._cleanupExpiredPromoCodes());
      
      // Очистка кэша
      cleanupTasks.push(this._clearCaches());

      await Promise.all(cleanupTasks);
      logger.info('📖 Daily cleanup completed successfully');
    } catch (error) {
      logger.error(`📖 Error in daily cleanup: ${error.message}`);
    }
  }

  /**
   * Очистка старых логов
   * @private
   */
  async _cleanupOldLogs() {
    try {
      // Placeholder для очистки логов
      logger.info('📖 Old logs cleanup completed (placeholder)');
    } catch (error) {
      logger.error(`📖 Error cleaning up old logs: ${error.message}`);
    }
  }

  /**
   * Очистка просроченных промокодов
   * @private
   */
  async _cleanupExpiredPromoCodes() {
    try {
      const WeeklyReport = require('../models/weeklyReport');
      
      const expiredCount = await WeeklyReport.countDocuments({
        'promoCode.validUntil': { $lt: new Date() }
      });

      if (expiredCount > 0) {
        logger.info(`📖 Found ${expiredCount} expired promo codes (keeping for analytics)`);
      }
    } catch (error) {
      logger.error(`📖 Error checking expired promo codes: ${error.message}`);
    }
  }

  /**
   * Очистка кэшей
   * @private
   */
  async _clearCaches() {
    try {
      // Очистка кэша Claude service
      const claudeService = require('./claude');
      claudeService.clearExpiredCache();
      
      logger.info('📖 Caches cleared successfully');
    } catch (error) {
      logger.error(`📖 Error clearing caches: ${error.message}`);
    }
  }

  /**
   * Ручной запуск генерации еженедельных отчетов
   * @returns {Promise<Object>} Результат генерации
   */
  async runWeeklyReportsManually() {
    try {
      logger.info('📖 Manual weekly reports generation started');
      const stats = await this.weeklyReportService.generateWeeklyReportsForAllUsers();
      
      // Отправка в Telegram
      await this._sendWeeklyReportsToTelegram(stats);
      
      logger.info('📖 Manual weekly reports generation completed');
      return stats;
    } catch (error) {
      logger.error(`📖 Error in manual weekly reports generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение статуса всех задач
   * @returns {Object} Статус задач
   */
  getJobsStatus() {
    const status = {
      isStarted: this.isStarted,
      totalJobs: this.jobs.size,
      jobs: {},
      timezone: 'Europe/Moscow'
    };

    this.jobs.forEach((job, name) => {
      status.jobs[name] = {
        running: job.running || false,
        destroyed: job.destroyed || false
      };
    });

    return status;
  }

  /**
   * Получение расписания задач
   * @returns {Object} Расписание
   */
  getSchedule() {
    return {
      weeklyReports: {
        schedule: '0 11 * * 0',
        description: 'Weekly reports generation - Sundays at 11:00 MSK',
        timezone: 'Europe/Moscow'
      },
      morningReminders: {
        schedule: '0 9 * * *',
        description: 'Morning reminders - Daily at 9:00 MSK',
        timezone: 'Europe/Moscow'
      },
      eveningReminders: {
        schedule: '0 19 * * *',
        description: 'Evening reminders - Daily at 19:00 MSK',
        timezone: 'Europe/Moscow'
      },
      monthlyReports: {
        schedule: '0 12 1 * *',
        description: 'Monthly reports - 1st day of month at 12:00 MSK',
        timezone: 'Europe/Moscow'
      },
      dailyCleanup: {
        schedule: '0 3 * * *',
        description: 'Daily cleanup tasks - Daily at 3:00 MSK',
        timezone: 'Europe/Moscow'
      }
    };
  }

  /**
   * Перезапуск конкретной задачи
   * @param {string} jobName - Название задачи
   * @returns {boolean} Успешность перезапуска
   */
  restartJob(jobName) {
    try {
      if (!this.jobs.has(jobName)) {
        logger.error(`📖 Job ${jobName} not found`);
        return false;
      }

      // Останавливаем задачу
      const job = this.jobs.get(jobName);
      job.destroy();
      this.jobs.delete(jobName);

      // Запускаем заново
      switch (jobName) {
        case 'weeklyReports':
          this._scheduleWeeklyReports();
          break;
        case 'morningReminders':
        case 'eveningReminders':
          this._scheduleDailyReminders();
          break;
        case 'monthlyReports':
          this._scheduleMonthlyReports();
          break;
        case 'dailyCleanup':
          this._scheduleCleanupTasks();
          break;
        default:
          logger.error(`📖 Unknown job name: ${jobName}`);
          return false;
      }

      logger.info(`📖 Job ${jobName} restarted successfully`);
      return true;
    } catch (error) {
      logger.error(`📖 Error restarting job ${jobName}: ${error.message}`);
      return false;
    }
  }
}

// Экспортируем единственный экземпляр
module.exports = new CronService();