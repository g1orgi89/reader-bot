/**
 * @fileoverview Cron сервис для автоматических задач бота "Читатель"
 * @author g1orgi89
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Cron сервис для автоматических задач
 */
class CronService {
  constructor() {
    this.weeklyReportHandler = null;
    this.reminderService = null;
    this.bot = null;
    this.jobs = new Map();
    
    logger.info('📖 CronService initialized');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} bot - Telegram bot instance
   * @param {Object} weeklyReportHandler - Handler для еженедельных отчетов
   * @param {Object} reminderService - Сервис напоминаний
   */
  initialize(bot, weeklyReportHandler, reminderService = null) {
    this.bot = bot;
    this.weeklyReportHandler = weeklyReportHandler;
    this.reminderService = reminderService;
    
    logger.info('📖 CronService dependencies initialized');
  }

  /**
   * Запуск всех cron задач
   */
  start() {
    if (!this.weeklyReportHandler) {
      logger.error('📖 Cannot start CronService: weeklyReportHandler not initialized');
      return false;
    }

    try {
      // Еженедельные отчеты: каждое воскресенье в 11:00 МСК
      const weeklyReportsJob = cron.schedule('0 11 * * 0', async () => {
        logger.info('📖 Starting weekly reports generation...');
        await this.generateWeeklyReportsForAllUsers();
      }, {
        timezone: "Europe/Moscow",
        scheduled: false
      });

      this.jobs.set('weekly_reports', weeklyReportsJob);

      // Ежедневные напоминания (если сервис доступен)
      if (this.reminderService) {
        const dailyRemindersJob = cron.schedule('0 9,19 * * *', async () => {
          logger.info('📖 Sending daily reminders...');
          await this.reminderService.sendDailyReminders();
        }, {
          timezone: "Europe/Moscow",
          scheduled: false
        });

        this.jobs.set('daily_reminders', dailyRemindersJob);
      }

      // Месячные отчеты: 1 числа каждого месяца в 12:00 МСК
      const monthlyReportsJob = cron.schedule('0 12 1 * *', async () => {
        logger.info('📖 Starting monthly reports generation...');
        await this.generateMonthlyReportsForActiveUsers();
      }, {
        timezone: "Europe/Moscow",
        scheduled: false
      });

      this.jobs.set('monthly_reports', monthlyReportsJob);

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
   * 📖 ИСПРАВЛЕНО: Генерация еженедельных отчетов для всех пользователей
   * @returns {Promise<void>}
   */
  async generateWeeklyReportsForAllUsers() {
    try {
      const startTime = Date.now();
      
      // 🔧 FIX: Используем метод sendReportsToAllUsers вместо несуществующего метода
      if (!this.weeklyReportHandler || !this.weeklyReportHandler.sendReportsToAllUsers) {
        logger.error('📖 WeeklyReportHandler not properly initialized or missing sendReportsToAllUsers method');
        return;
      }

      const stats = await this.weeklyReportHandler.sendReportsToAllUsers();
      
      const duration = Date.now() - startTime;
      
      logger.info(`📖 Weekly reports completed in ${duration}ms: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped} skipped`);

      // Отправляем статистику администратору
      if (process.env.ADMIN_TELEGRAM_ID && this.bot) {
        const adminMessage = `📊 *Еженедельные отчеты отправлены*\n\n✅ Успешно: ${stats.sent}\n❌ Ошибки: ${stats.failed}\n⏭ Пропущено (пустые недели): ${stats.skipped}\n📊 Всего пользователей: ${stats.total}\n⏱ Время выполнения: ${Math.round(duration / 1000)}с\n\n${stats.errors.length > 0 ? `\\n*Ошибки:*\\n${stats.errors.slice(0, 5).map(e => `• ${e.userId}: ${e.error}`).join('\\n')}` : ''}`;

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
   * Генерация месячных отчетов для активных пользователей
   * @returns {Promise<void>}
   */
  async generateMonthlyReportsForActiveUsers() {
    try {
      const { UserProfile } = require('../models');
      
      // Получаем пользователей, которые активны больше месяца
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const activeUsers = await UserProfile.find({
        isOnboardingComplete: true,
        registeredAt: { $lte: oneMonthAgo },
        'statistics.totalQuotes': { $gte: 5 } // Минимум 5 цитат за все время
      });

      let generated = 0;
      let failed = 0;

      logger.info(`📖 Starting monthly reports for ${activeUsers.length} users`);

      for (const user of activeUsers) {
        try {
          // Здесь будет логика генерации месячного отчета
          // TODO: Реализовать MonthlyReportService когда будет готов
          // await this.generateMonthlyReport(user.userId);
          generated++;
          
          // Небольшая задержка
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          failed++;
          logger.error(`📖 Failed to generate monthly report for user ${user.userId}: ${error.message}`);
        }
      }

      logger.info(`📖 Monthly reports completed: ${generated} generated, ${failed} failed`);

    } catch (error) {
      logger.error(`📖 Error in generateMonthlyReportsForActiveUsers: ${error.message}`, error);
    }
  }

  /**
   * Ежедневная очистка старых данных
   * @returns {Promise<void>}
   */
  async performDailyCleanup() {
    try {
      const { WeeklyReport, Quote } = require('../models');
      
      // Удаляем старые еженедельные отчеты (старше 6 месяцев)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deletedReports = await WeeklyReport.deleteMany({
        sentAt: { $lt: sixMonthsAgo }
      });

      // Можно добавить другие задачи очистки
      // Например, удаление старых логов, временных файлов и т.д.

      logger.info(`📖 Daily cleanup completed: ${deletedReports.deletedCount} old reports deleted`);

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
    
    // Возвращаем статистику
    if (this.weeklyReportHandler && this.weeklyReportHandler.getReportStats) {
      return await this.weeklyReportHandler.getReportStats(7);
    }
    
    return { message: 'Weekly reports triggered, but stats not available' };
  }

  /**
   * Ручной запуск напоминаний (для тестирования)
   * @returns {Promise<void>}
   */
  async triggerReminders() {
    if (this.reminderService) {
      logger.info('📖 Manual trigger of reminders');
      await this.reminderService.sendDailyReminders();
    } else {
      logger.warn('📖 ReminderService not initialized, cannot trigger reminders');
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
      initialized: !!this.weeklyReportHandler
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
   * 📖 НОВОЕ: Получение расписания задач для health check
   * @returns {Object} Расписание задач
   */
  getSchedule() {
    return {
      weekly_reports: 'Sundays at 11:00 MSK',
      daily_reminders: '9:00 and 19:00 MSK daily (if enabled)',
      monthly_reports: '1st day of month at 12:00 MSK',
      daily_cleanup: '3:00 MSK daily'
    };
  }

  /**
   * 📖 НОВОЕ: Проверка готовности сервиса
   * @returns {boolean} Готовность к работе
   */
  isReady() {
    return !!this.weeklyReportHandler;
  }

  /**
   * 📖 НОВОЕ: Получение подробной диагностики
   * @returns {Object} Диагностическая информация
   */
  getDiagnostics() {
    return {
      initialized: !!this.weeklyReportHandler,
      hasReminderService: !!this.reminderService,
      hasBot: !!this.bot,
      jobsCount: this.jobs.size,
      activeJobs: Array.from(this.jobs.keys()),
      nextRuns: {
        weekly_reports: this.getNextRunTime('weekly_reports'),
        daily_reminders: this.getNextRunTime('daily_reminders'),
        monthly_reports: this.getNextRunTime('monthly_reports'),
        daily_cleanup: this.getNextRunTime('daily_cleanup')
      },
      timezone: 'Europe/Moscow'
    };
  }
}

module.exports = { CronService };