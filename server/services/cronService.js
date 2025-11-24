/**
 * @fileoverview Cron сервис для автоматических задач бота "Читатель"
 * 
 * UPDATED: Added monthlyReport notification slot support
 * - Monthly reports generated at 12:00 MSK on 1st of each month
 * - Monthly report NOTIFICATIONS sent via reminderService after generation
 * 
 * @author g1orgi89
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Cron сервис для автоматических задач
 */
class CronService {
  constructor() {
    this.weeklyReportHandler = null; // Keep for backward compatibility
    this.weeklyReportService = null; // NEW: Modern service
    this.monthlyReportService = null;
    this.reminderService = null;
    this.announcementService = null;
    this.bot = null;
    this.jobs = new Map();
    
    logger.info('📖 CronService initialized');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.bot - Telegram bot instance
   * @param {Object} dependencies.weeklyReportHandler - Handler для еженедельных отчетов (legacy)
   * @param {Object} dependencies.weeklyReportService - NEW: Modern WeeklyReportService
   * @param {Object} dependencies.monthlyReportService - Сервис месячных отчетов
   * @param {Object} dependencies.reminderService - Сервис напоминаний
   * @param {Object} dependencies.announcementService - Сервис анонсов
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    this.weeklyReportHandler = dependencies.weeklyReportHandler; // Keep for backward compatibility
    this.weeklyReportService = dependencies.weeklyReportService; // NEW: Modern service
    this.monthlyReportService = dependencies.monthlyReportService;
    this.reminderService = dependencies.reminderService;
    this.announcementService = dependencies.announcementService;
    
    logger.info('📖 CronService dependencies initialized');
  }

  /**
   * Запуск всех cron задач
   */
  start() {
    try {
      // === ТЕСТ: Генерация отчётов (поменяй минуты/часы на своё время +5 мин) ===
      const monthlyReportsGenerationJob = cron.schedule('1 0 1 * *', async () => {
        logger.info('📖 Starting monthly reports generation...');
        await this.generateMonthlyReportsForActiveUsers();
      }, {
        timezone: "Europe/Moscow",
        scheduled: true
      });
      this.jobs.set('monthly_reports_generation', monthlyReportsGenerationJob);

      // === ТЕСТ: Уведомления (поменяй на своё время +7 мин) ===
      const monthlyReportsNotificationJob = cron.schedule('0 12 1 * *', async () => {
        logger.info('📖 Sending monthly report notifications...');
        await this.sendMonthlyReportNotifications();
      }, {
        timezone: "Europe/Moscow",
        scheduled: true
      });
      this.jobs.set('monthly_reports_notification', monthlyReportsNotificationJob);

      // Очистка старых данных: каждый день в 3:00 МСК
      const cleanupJob = cron.schedule('0 3 * * *', async () => {
        logger.info('📖 Running daily cleanup...');
        await this.performDailyCleanup();
      }, {
        timezone: "Europe/Moscow",
        scheduled: false
      });
      this.jobs.set('daily_cleanup', cleanupJob);

      // Запускаем все задачи
      this.jobs.forEach((job, name) => {
        job.start();
        logger.info(`📖 Cron job '${name}' started`);
      });

      logger.info(`📖 CronService started with ${this.jobs.size} jobs`);
      return true;

    } catch (error) {
      logger.error(`📖 Error starting CronService: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Остановка всех cron задач
   */
  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`📖 Cron job '${name}' stopped`);
    });

    this.jobs.clear();
    logger.info('📖 CronService stopped');
  }

  /**
   * Генерация еженедельных отчетов для всех пользователей
   * @returns {Promise<void>}
   */
  async generateWeeklyReportsForAllUsers() {
    try {
      const startTime = Date.now();
      
      // Используем новый WeeklyReportService вместо старого weeklyReportHandler
      if (!this.weeklyReportService) {
        logger.error('📖 WeeklyReportService not properly initialized');
        return;
      }

      const stats = await this._generateReportsWithWeeklyReportService();
      
      const duration = Date.now() - startTime;
      
      logger.info(`📖 Weekly reports completed in ${duration}ms: ${stats.generated} generated, ${stats.failed} failed, ${stats.skipped} skipped`);

      // Отправляем статистику администратору
      if (process.env.ADMIN_TELEGRAM_ID && this.bot) {
        const adminMessage = `📊 *Еженедельные отчеты созданы*\\n\\n✅ Сгенерировано: ${stats.generated}\\n❌ Ошибки: ${stats.failed}\\n⏭ Пропущено (нет цитат): ${stats.skipped}\\n📊 Всего пользователей: ${stats.total}\\n⏱ Время выполнения: ${Math.round(duration / 1000)}с\\n\\n${stats.errors.length > 0 ? `\\n*Ошибки:*\\n${stats.errors.slice(0, 5).map(e => `• ${e.userId}: ${e.error}`).join('\\n')}` : ''}`;

        try {
          await this.bot.telegram.sendMessage(
            process.env.ADMIN_TELEGRAM_ID,
            adminMessage,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`📖 Failed to send admin notification: ${error.message}`);
        }
      }

    } catch (error) {
      logger.error(`📖 Error in generateWeeklyReportsForAllUsers: ${error.message}`, error);
    }
  }

  /**
   * NEW: Generate reports using WeeklyReportService
   * @private
   * @returns {Promise<Object>} Generation statistics
   */
  async _generateReportsWithWeeklyReportService() {
    const { UserProfile, Quote, WeeklyReport } = require('../models');
    
    // Get previous week range
    const weekRange = this.weeklyReportService.getPreviousWeekRange();
    const { isoWeek: weekNumber, isoYear: year } = weekRange;
    
    logger.info(`📖 Generating reports for week ${weekNumber}/${year} (${weekRange.start.toISOString().split('T')[0]} to ${weekRange.end.toISOString().split('T')[0]})`);

    const stats = {
      generated: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      errors: []
    };

    try {
      // Find users who have quotes for the previous week but don't have a report yet
      const usersWithQuotes = await Quote.distinct('userId', {
        weekNumber,
        yearNumber: year
      });

      const usersWithReports = await WeeklyReport.distinct('userId', {
        weekNumber,
        year
      });

      // Filter out users who already have reports
      const usersNeedingReports = usersWithQuotes.filter(
        userId => !usersWithReports.includes(userId)
      );

      logger.info(`📖 Found ${usersWithQuotes.length} users with quotes, ${usersWithReports.length} already have reports, ${usersNeedingReports.length} need new reports`);

      stats.total = usersNeedingReports.length;

      // Generate reports for each user
      for (const userId of usersNeedingReports) {
        try {
          // Get user profile
          const userProfile = await UserProfile.findOne({ 
            userId,
            isOnboardingComplete: true,
            isActive: true,
            isBlocked: false
          });

          if (!userProfile) {
            logger.warn(`📖 Skipping user ${userId}: inactive or incomplete onboarding`);
            stats.skipped++;
            continue;
          }

          // Get user's quotes for the week
          const quotes = await Quote.find({
            userId,
            weekNumber,
            yearNumber: year
          }).sort({ createdAt: 1 });

          if (quotes.length === 0) {
            logger.warn(`📖 Skipping user ${userId}: no quotes found for week ${weekNumber}/${year}`);
            stats.skipped++;
            continue;
          }

          // Generate the report using WeeklyReportService with explicit week metadata
          const reportData = await this.weeklyReportService.generateWeeklyReport(userId, quotes, userProfile, {
            weekMeta: {
              isoWeek: weekNumber,
              isoYear: year,
              start: weekRange.start,
              end: weekRange.end
            }
          });

          // Save to database
          const weeklyReport = new WeeklyReport(reportData);
          await weeklyReport.save();

          // Send weekly report notification if enabled
          try {
            const userDoc = await UserProfile.findOne({ userId }).lean();
            const settings = userDoc?.getNormalizedSettings ? userDoc.getNormalizedSettings() : null;
            if (settings && settings.weeklyReports.enabled && this.bot) {
              const message = "📝 Ваш еженедельный отчёт готов. Откройте приложение, чтобы посмотреть инсайты.";
              await this.bot.telegram.sendMessage(userId, message);
              logger.info(`📝 Weekly report notification sent to user ${userId}`);
            }
          } catch (notificationError) {
            logger.error(`📝 Failed to send weekly report notification to user ${userId}:`, notificationError);
            // Don't fail the main report generation if notification fails
          }

          logger.info(`📖 Generated weekly report for user ${userId} with ${quotes.length} quotes`);
          stats.generated++;

          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          logger.error(`📖 Failed to generate report for user ${userId}: ${error.message}`);
          stats.failed++;
          stats.errors.push({
            userId,
            error: error.message
          });
        }
      }

      logger.info(`📖 Report generation completed: ${stats.generated} generated, ${stats.failed} failed, ${stats.skipped} skipped`);
      return stats;

    } catch (error) {
      logger.error(`📖 Error in _generateReportsWithWeeklyReportService: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📖 ОБНОВЛЕНО: Генерация месячных отчетов для активных пользователей
   * @returns {Promise<void>}
   */
  async generateMonthlyReportsForActiveUsers() {
    try {
      const startTime = Date.now();

      if (!this.monthlyReportService) {
        logger.warn('📖 MonthlyReportService not initialized, skipping monthly reports');
        return;
      }

      // Используем метод из MonthlyReportService
      const stats = await this.monthlyReportService.generateMonthlyReportsForAllUsers();
      
      const duration = Date.now() - startTime;
      
      logger.info(`📖 Monthly reports completed in ${duration}ms: ${stats.generated} generated, ${stats.failed} failed`);

      // Отправляем статистику администратору
      if (process.env.ADMIN_TELEGRAM_ID && this.bot) {
        const adminMessage = `📈 *Месячные отчеты сгенерированы*\\n\\n✅ Успешно: ${stats.generated}\\n❌ Ошибки: ${stats.failed}\\n📊 Всего пользователей: ${stats.total}\\n⏱ Время выполнения: ${Math.round(duration / 1000)}с\\n\\n${stats.errors.length > 0 ? `\\n*Ошибки:*\\n${stats.errors.slice(0, 3).map(e => `• ${e.userId}: ${e.error}`).join('\\n')}` : ''}`;

        try {
          await this.bot.telegram.sendMessage(
            process.env.ADMIN_TELEGRAM_ID,
            adminMessage,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`📖 Failed to send admin notification: ${error.message}`);
        }
      }

      return stats;

    } catch (error) {
      logger.error(`📖 Error in generateMonthlyReportsForActiveUsers: ${error.message}`, error);
    }
  }

  /**
   * 📖 NEW: Отправка уведомлений о месячных отчётах через reminderService
   * Использует шаблон monthlyReport из notificationTemplates
   * @returns {Promise<Object>} Статистика отправки
   */
  async sendMonthlyReportNotifications() {
    try {
      if (!this.reminderService) {
        logger.warn('📖 ReminderService not initialized, skipping monthly report notifications');
        return { sent: 0, skipped: 0, failed: 0, errors: [] };
      }

      const stats = await this.reminderService.sendSlotReminders('monthlyReport');
      
      logger.info(`📖 Monthly report notifications: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);

      // Отправляем статистику администратору
      if (process.env.ADMIN_TELEGRAM_ID && this.bot && stats.sent > 0) {
        const adminMessage = `📬 *Уведомления о месячных отчётах отправлены*\\n\\n✅ Отправлено: ${stats.sent}\\n⏭ Пропущено: ${stats.skipped}\\n❌ Ошибки: ${stats.failed}`;

        try {
          await this.bot.telegram.sendMessage(
            process.env.ADMIN_TELEGRAM_ID,
            adminMessage,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`📖 Failed to send admin notification: ${error.message}`);
        }
      }

      return stats;

    } catch (error) {
      logger.error(`📖 Error in sendMonthlyReportNotifications: ${error.message}`, error);
      return { sent: 0, skipped: 0, failed: 0, errors: [{ error: error.message }] };
    }
  }

  /**
   * 📖 НОВОЕ: Отправка месячных анонсов
   * @returns {Promise<void>}
   */
  async sendMonthlyAnnouncements() {
    try {
      const startTime = Date.now();

      if (!this.announcementService) {
        logger.warn('📖 AnnouncementService not initialized, skipping announcements');
        return;
      }

      const stats = await this.announcementService.sendMonthlyAnnouncements();
      
      const duration = Date.now() - startTime;
      
      logger.info(`📖 Monthly announcements completed in ${duration}ms: ${stats.sent} sent, ${stats.failed} failed`);

      // Отправляем статистику администратору
      if (process.env.ADMIN_TELEGRAM_ID && this.bot) {
        const adminMessage = `📢 *Месячные анонсы отправлены*\\n\\n✅ Успешно: ${stats.sent}\\n❌ Ошибки: ${stats.failed}\\n📊 Всего пользователей: ${stats.total}\\n⏱ Время выполнения: ${Math.round(duration / 1000)}с\\n\\n${stats.errors.length > 0 ? `\\n*Ошибки:*\\n${stats.errors.slice(0, 3).map(e => `• ${e.userId}: ${e.error}`).join('\\n')}` : ''}`;

        try {
          await this.bot.telegram.sendMessage(
            process.env.ADMIN_TELEGRAM_ID,
            adminMessage,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`📖 Failed to send admin notification: ${error.message}`);
        }
      }

    } catch (error) {
      logger.error(`📖 Error in sendMonthlyAnnouncements: ${error.message}`, error);
    }
  }

  /**
   * Ежедневная очистка старых данных
   * @returns {Promise<void>}
   */
  async performDailyCleanup() {
    try {
      const { WeeklyReport, MonthlyReport } = require('../models');
      
      // Удаляем старые еженедельные отчеты (старше 6 месяцев)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deletedWeeklyReports = await WeeklyReport.deleteMany({
        sentAt: { $lt: sixMonthsAgo }
      });

      // Удаляем старые месячные отчеты (старше 1 года)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const deletedMonthlyReports = await MonthlyReport.deleteMany({
        sentAt: { $lt: oneYearAgo }
      });

      logger.info(`📖 Daily cleanup completed: ${deletedWeeklyReports.deletedCount} weekly reports and ${deletedMonthlyReports.deletedCount} monthly reports deleted`);

    } catch (error) {
      logger.error(`📖 Error in performDailyCleanup: ${error.message}`, error);
    }
  }

  /**
   * Ручной запуск еженедельных отчетов (для тестирования)
   * @returns {Promise<Object>} Статистика отправки
   */
  async triggerWeeklyReports() {
    logger.info('📖 Manual trigger of weekly reports');
    await this.generateWeeklyReportsForAllUsers();
    
    // Return statistics based on available service
    if (this.weeklyReportService) {
      // NEW: Get stats from database
      const { WeeklyReport } = require('../models');
      const weekRange = this.weeklyReportService.getPreviousWeekRange();
      
      const reportsCount = await WeeklyReport.countDocuments({
        weekNumber: weekRange.isoWeek,
        year: weekRange.isoYear
      });
      
      return { 
        message: 'Weekly reports triggered using WeeklyReportService', 
        generated: reportsCount,
        week: `${weekRange.isoWeek}/${weekRange.isoYear}`
      };
    } else if (this.weeklyReportHandler && this.weeklyReportHandler.getReportStats) {
      // LEGACY: Use old handler stats
      return await this.weeklyReportHandler.getReportStats(7);
    }
    
    return { message: 'Weekly reports triggered, but stats not available' };
  }

  /**
   * 📖 ОБНОВЛЕНО: Ручной запуск месячных отчетов (для тестирования)
   * Включает генерацию + отправку уведомлений
   * @returns {Promise<Object>} Статистика отправки
   */
  async triggerMonthlyReports() {
    logger.info('📖 Manual trigger of monthly reports');
    
    if (!this.monthlyReportService) {
      logger.warn('📖 MonthlyReportService not initialized');
      return { message: 'MonthlyReportService not available' };
    }

    // 1. Generate reports
    const generationStats = await this.monthlyReportService.generateMonthlyReportsForAllUsers();
    
    // 2. Send notifications
    const notificationStats = await this.sendMonthlyReportNotifications();
    
    return {
      message: 'Monthly reports triggered (generation + notifications)',
      generation: generationStats,
      notifications: notificationStats
    };
  }

  /**
   * 📖 NEW: Ручной запуск только уведомлений о месячных отчётах
   * @returns {Promise<Object>} Статистика отправки
   */
  async triggerMonthlyReportNotifications() {
    logger.info('📖 Manual trigger of monthly report notifications only');
    return await this.sendMonthlyReportNotifications();
  }

  /**
   * 📖 ОБНОВЛЕНО: Ручной запуск напоминаний (для тестирования)
   * @returns {Promise<Object>} Статистика отправки
   */
  async triggerReminders() {
    if (this.reminderService) {
      logger.info('📖 Manual trigger of optimized reminders');
      const stats = await this.reminderService.sendDailyReminders();
      return {
        message: 'Optimized reminders triggered',
        ...stats
      };
    } else {
      logger.warn('📖 ReminderService not initialized, cannot trigger reminders');
      return { message: 'ReminderService not available' };
    }
  }

  /**
   * 📖 НОВОЕ: Ручной запуск анонсов (для тестирования)
   * @returns {Promise<Object>} Статистика отправки
   */
  async triggerAnnouncements() {
    if (this.announcementService) {
      logger.info('📖 Manual trigger of monthly announcements');
      const stats = await this.announcementService.sendMonthlyAnnouncements();
      return {
        message: 'Monthly announcements triggered',
        ...stats
      };
    } else {
      logger.warn('📖 AnnouncementService not initialized, cannot trigger announcements');
      return { message: 'AnnouncementService not available' };
    }
  }

  /**
   * Получение статуса всех cron задач
   * @returns {Object} Статус задач
   */
  getJobsStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        lastDate: job.lastDate,
        nextDate: job.nextDate
      };
    });

    return {
      totalJobs: this.jobs.size,
      jobs: status,
      initialized: !!(this.weeklyReportService || this.weeklyReportHandler), // Check for either service
      hasWeeklyReportService: !!this.weeklyReportService, // NEW
      hasWeeklyReportHandler: !!this.weeklyReportHandler, // LEGACY
      hasMonthlyService: !!this.monthlyReportService,
      hasReminderService: !!this.reminderService,
      hasAnnouncementService: !!this.announcementService
    };
  }

  /**
   * Остановка конкретной задачи
   * @param {string} jobName - Название задачи
   * @returns {boolean} Успех операции
   */
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`📖 Cron job '${jobName}' stopped manually`);
      return true;
    }
    return false;
  }

  /**
   * Запуск конкретной задачи
   * @param {string} jobName - Название задачи
   * @returns {boolean} Успех операции
   */
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`📖 Cron job '${jobName}' started manually`);
      return true;
    }
    return false;
  }

  /**
   * Получение следующего времени выполнения задачи
   * @param {string} jobName - Название задачи
   * @returns {Date|null} Следующее время выполнения
   */
  getNextRunTime(jobName) {
    const job = this.jobs.get(jobName);
    return job ? job.nextDate : null;
  }

  /**
   * 📖 ОБНОВЛЕНО: Получение расписания задач для health check
   * @returns {Object} Расписание задач
   */
  getSchedule() {
    return {
      monthly_reports: '1st day of month at 12:00 MSK (generation + notifications)',
      daily_cleanup: '3:00 MSK daily'
    };
  }

  /**
   * Проверка готовности сервиса
   * @returns {boolean} Готовность к работе
   */
  isReady() {
    return !!this.reminderService; // Service is ready if reminderService is available
  }

  /**
   * 📖 ОБНОВЛЕНО: Получение подробной диагностики
   * @returns {Object} Диагностическая информация
   */
  getDiagnostics() {
    return {
      initialized: !!this.reminderService,
      hasMonthlyReportService: !!this.monthlyReportService,
      hasReminderService: !!this.reminderService,
      hasBot: !!this.bot,
      jobsCount: this.jobs.size,
      activeJobs: Array.from(this.jobs.keys()),
      nextRuns: {
        morning_reminders: this.getNextRunTime('morning_reminders'),
        day_reminders: this.getNextRunTime('day_reminders'),
        evening_reminders: this.getNextRunTime('evening_reminders'),
        monthly_reports: this.getNextRunTime('monthly_reports'),
        daily_cleanup: this.getNextRunTime('daily_cleanup')
      },
      serviceStatuses: {
        reminderService: this.reminderService?.getDiagnostics() || { status: 'not_initialized' },
        monthlyReportService: !!this.monthlyReportService
      },
      timezone: 'Europe/Moscow'
    };
  }

  /**
   * 📖 НОВОЕ: Получение статистики всех сервисов
   * @returns {Promise<Object>} Общая статистика
   */
  async getAllServicesStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      cron: this.getJobsStatus()
    };

    try {
      if (this.reminderService) {
        stats.reminders = await this.reminderService.getReminderStats();
      }

      if (this.announcementService) {
        stats.announcements = await this.announcementService.getAnnouncementStats();
      }

      if (this.weeklyReportService) {
        // NEW: Get stats from database
        const { WeeklyReport } = require('../models');
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentReports = await WeeklyReport.countDocuments({
          sentAt: { $gte: oneWeekAgo }
        });
        
        stats.weeklyReports = { 
          recentReports,
          message: 'Using WeeklyReportService (modern)' 
        };
      } else if (this.weeklyReportHandler && this.weeklyReportHandler.getReportStats) {
        // LEGACY: Use old handler stats
        stats.weeklyReports = await this.weeklyReportHandler.getReportStats(7);
      }

      if (this.monthlyReportService && this.monthlyReportService.getStats) {
        stats.monthlyReports = await this.monthlyReportService.getStats();
      }

    } catch (error) {
      logger.error(`📖 Error getting services stats: ${error.message}`, error);
      stats.error = error.message;
    }

    return stats;
  }
}

module.exports = { CronService };
