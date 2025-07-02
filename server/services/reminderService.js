/**
 * @fileoverview Оптимизированная система напоминаний для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} ReminderSchedule
 * @property {string} frequency - Частота напоминаний
 * @property {string[]} times - Время отправки
 */

/**
 * @typedef {Object} ReminderStats
 * @property {number} sent - Отправлено напоминаний
 * @property {number} skipped - Пропущено (неактивные пользователи)
 * @property {number} failed - Ошибки отправки
 * @property {Object[]} errors - Массив ошибок
 */

/**
 * Сервис напоминаний с оптимизированным расписанием
 */
class ReminderService {
  constructor() {
    this.bot = null;
    
    // Оптимизированное расписание (более редкие напоминания)
    this.optimizedSchedule = {
      week1: { 
        frequency: 'every_other_day', 
        times: ['19:00'] // Только вечером
      },
      week2_4: { 
        frequency: 'twice_weekly', 
        times: ['19:00'] // Понедельник и четверг
      },
      month_plus: { 
        frequency: 'weekly', 
        times: ['19:00'] // Только понедельник
      }
    };

    // Шаблоны напоминаний для разных стадий
    this.reminderTemplates = {
      week1: [
        "📖 Добрый вечер! Сегодня будет день, полный новых смыслов. Если встретили слова, которые заденут - поделитесь ими здесь.",
        "🌅 Какая мудрость встретилась вам сегодня?",
        "☀️ Возможно, сегодня вы нашли цитату, которая изменила ваш день?",
        "🌙 Время подумать о том, что важного вы прочитали сегодня.",
        "⭐ Время для рефлексии. Какие слова тронули вашу душу сегодня?"
      ],
      week2_4: [
        "📚 \"Цитата - это зеркало души\". Что отражается в вашем зеркале сегодня?",
        "💭 Как дела с вашим дневником цитат? Поделитесь мыслью, которая вас вдохновила.",
        "🔍 Помните: каждая цитата - это ключ к пониманию себя. Какой ключ найдете сегодня?",
        "📖 \"Хватит сидеть в телефоне - читайте книги!\" Что интересного читаете?"
      ],
      month_plus: [
        "🌟 Время для еженедельной порции мудрости! Какая цитата вдохновила вас на этой неделе?",
        "📖 \"Хорошая жизнь строится, а не дается по умолчанию\". Какие строительные блоки мудрости собрали на этой неделе?",
        "💎 Еженедельная встреча с мудростью! Поделитесь цитатой, которая заставила задуматься."
      ]
    };

    logger.info('📖 ReminderService initialized with optimized schedule');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.bot - Telegram bot instance
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    logger.info('📖 ReminderService dependencies initialized');
  }

  /**
   * Отправка ежедневных напоминаний (вызывается из cron)
   * @returns {Promise<ReminderStats>}
   */
  async sendDailyReminders() {
    if (!this.bot) {
      logger.error('📖 Bot not initialized in ReminderService');
      return { sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    try {
      const currentHour = new Date().getHours();
      const stats = { sent: 0, skipped: 0, failed: 0, errors: [] };

      // Получаем пользователей для текущего времени
      const activeUsers = await this.getActiveUsersForReminders(currentHour);
      
      logger.info(`📖 Processing reminders for ${activeUsers.length} users at ${currentHour}:00`);

      for (const user of activeUsers) {
        try {
          const reminderConfig = this.getReminderConfigForUser(user);
          const shouldSend = await this.shouldSendReminderToday(user, reminderConfig);

          if (shouldSend) {
            // Проверяем активность пользователя (пропускаем если был активен сегодня)
            const wasActiveToday = await this.wasUserActiveToday(user.userId);
            
            if (wasActiveToday) {
              stats.skipped++;
              logger.debug(`📖 Skipping reminder for ${user.userId} - user was active today`);
              continue;
            }

            await this.sendReminderToUser(user, reminderConfig);
            stats.sent++;
            
            // Небольшая задержка между отправками
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            stats.skipped++;
          }
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            userId: user.userId,
            error: error.message
          });
          logger.error(`📖 Failed to send reminder to user ${user.userId}: ${error.message}`);
        }
      }

      logger.info(`📖 Reminders completed: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.failed} failed`);
      return stats;

    } catch (error) {
      logger.error(`📖 Error in sendDailyReminders: ${error.message}`, error);
      return { sent: 0, skipped: 0, failed: 0, errors: [{ error: error.message }] };
    }
  }

  /**
   * Получение активных пользователей для напоминаний в текущий час
   * @param {number} currentHour - Текущий час
   * @returns {Promise<Array>} Пользователи
   */
  async getActiveUsersForReminders(currentHour) {
    try {
      const { UserProfile } = require('../models');
      const timeStr = `${currentHour.toString().padStart(2, '0')}:00`;
      
      return await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true,
        'settings.reminderTimes': timeStr
      });
    } catch (error) {
      logger.error(`📖 Error getting active users: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Определение конфигурации напоминаний для пользователя
   * @param {Object} user - Пользователь
   * @returns {ReminderSchedule} Конфигурация напоминаний
   */
  getReminderConfigForUser(user) {
    const registrationDate = new Date(user.registeredAt);
    const now = new Date();
    const daysSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24));
    const weeksSinceRegistration = Math.floor(daysSinceRegistration / 7);

    if (weeksSinceRegistration === 0) {
      return this.optimizedSchedule.week1;
    } else if (weeksSinceRegistration <= 3) {
      return this.optimizedSchedule.week2_4;
    } else {
      return this.optimizedSchedule.month_plus;
    }
  }

  /**
   * Проверка нужно ли отправлять напоминание сегодня
   * @param {Object} user - Пользователь
   * @param {ReminderSchedule} config - Конфигурация напоминаний
   * @returns {Promise<boolean>} Нужно ли отправлять
   */
  async shouldSendReminderToday(user, config) {
    const registrationDate = new Date(user.registeredAt);
    const now = new Date();
    const daysSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24));

    switch (config.frequency) {
      case 'every_other_day':
        return daysSinceRegistration % 2 === 0;
      
      case 'twice_weekly':
        const dayOfWeek = now.getDay();
        return dayOfWeek === 1 || dayOfWeek === 4; // Понедельник и четверг
      
      case 'weekly':
        return now.getDay() === 1; // Только понедельник
      
      default:
        return false;
    }
  }

  /**
   * Проверка был ли пользователь активен сегодня
   * @param {string} userId - ID пользователя
   * @returns {Promise<boolean>} Был ли активен
   */
  async wasUserActiveToday(userId) {
    try {
      const { Quote } = require('../models');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayQuotes = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      return todayQuotes > 0;
    } catch (error) {
      logger.error(`📖 Error checking user activity: ${error.message}`, error);
      return false; // В случае ошибки отправляем напоминание
    }
  }

  /**
   * Отправка напоминания пользователю
   * @param {Object} user - Пользователь
   * @param {ReminderSchedule} config - Конфигурация напоминаний
   * @returns {Promise<void>}
   */
  async sendReminderToUser(user, config) {
    const registrationDate = new Date(user.registeredAt);
    const now = new Date();
    const weeksSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24 * 7));

    // Выбираем подходящие шаблоны
    let templates;
    if (weeksSinceRegistration === 0) {
      templates = this.reminderTemplates.week1;
    } else if (weeksSinceRegistration <= 3) {
      templates = this.reminderTemplates.week2_4;
    } else {
      templates = this.reminderTemplates.month_plus;
    }

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    // Персонализация с именем
    const personalizedMessage = `${user.name}, ${randomTemplate}`;

    try {
      await this.bot.telegram.sendMessage(user.userId, personalizedMessage);
      
      // Логирование для аналитики
      logger.debug(`📖 Reminder sent to ${user.name} (${user.userId}), week ${weeksSinceRegistration + 1}`);
    } catch (error) {
      // Проверяем если пользователь заблокировал бота
      if (error.response && error.response.error_code === 403) {
        logger.info(`📖 User ${user.userId} blocked the bot, skipping reminders`);
        
        // Отключаем напоминания для заблокированного пользователя
        await this.disableRemindersForUser(user.userId);
      } else {
        throw error;
      }
    }
  }

  /**
   * Отключение напоминаний для заблокированного пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async disableRemindersForUser(userId) {
    try {
      const { UserProfile } = require('../models');
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { 'settings.reminderEnabled': false }
      );
      
      logger.info(`📖 Reminders disabled for blocked user ${userId}`);
    } catch (error) {
      logger.error(`📖 Error disabling reminders for user ${userId}: ${error.message}`, error);
    }
  }

  /**
   * Обновление настроек напоминаний пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} settings - Новые настройки
   * @param {boolean} settings.enabled - Включены ли напоминания
   * @param {string[]} settings.times - Время отправки
   * @returns {Promise<void>}
   */
  async updateReminderSettings(userId, settings) {
    try {
      const { UserProfile } = require('../models');
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'settings.reminderEnabled': settings.enabled,
          'settings.reminderTimes': settings.times
        }
      );
      
      logger.info(`📖 Reminder settings updated for user ${userId}: enabled=${settings.enabled}, times=${settings.times.join(',')}`);
    } catch (error) {
      logger.error(`📖 Error updating reminder settings: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получение статистики напоминаний за период
   * @param {number} days - Количество дней назад
   * @returns {Promise<Object>} Статистика
   */
  async getReminderStats(days = 7) {
    try {
      const { UserProfile } = require('../models');
      
      const totalUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true
      });

      const enabledUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true
      });

      // Группируем пользователей по стадиям
      const stages = {
        week1: 0,
        week2_4: 0,
        month_plus: 0
      };

      const users = await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true
      }, 'registeredAt');

      const now = new Date();
      users.forEach(user => {
        const weeksSinceRegistration = Math.floor((now - new Date(user.registeredAt)) / (1000 * 60 * 60 * 24 * 7));
        
        if (weeksSinceRegistration === 0) {
          stages.week1++;
        } else if (weeksSinceRegistration <= 3) {
          stages.week2_4++;
        } else {
          stages.month_plus++;
        }
      });

      return {
        totalUsers,
        enabledUsers,
        disabledUsers: totalUsers - enabledUsers,
        stages,
        schedule: this.optimizedSchedule
      };

    } catch (error) {
      logger.error(`📖 Error getting reminder stats: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Ручной тест отправки напоминания
   * @param {string} userId - ID пользователя для теста
   * @returns {Promise<boolean>} Успешность отправки
   */
  async testReminder(userId) {
    try {
      const { UserProfile } = require('../models');
      
      const user = await UserProfile.findOne({ userId });
      if (!user) {
        logger.error(`📖 User ${userId} not found for reminder test`);
        return false;
      }

      const config = this.getReminderConfigForUser(user);
      await this.sendReminderToUser(user, config);
      
      logger.info(`📖 Test reminder sent to user ${userId}`);
      return true;

    } catch (error) {
      logger.error(`📖 Error sending test reminder: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Получение диагностической информации
   * @returns {Object} Диагностика сервиса
   */
  getDiagnostics() {
    return {
      initialized: !!this.bot,
      schedule: this.optimizedSchedule,
      templateCounts: {
        week1: this.reminderTemplates.week1.length,
        week2_4: this.reminderTemplates.week2_4.length,
        month_plus: this.reminderTemplates.month_plus.length
      },
      timezone: 'Europe/Moscow'
    };
  }

  /**
   * Проверка готовности сервиса
   * @returns {boolean} Готовность к работе
   */
  isReady() {
    return !!this.bot;
  }
}

module.exports = { ReminderService };
