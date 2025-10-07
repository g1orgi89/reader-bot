/**
 * @fileoverview Production-ready Telegram notification system for Reader Bot
 * @author g1orgi89
 */

const logger = require('../utils/logger');
const { notificationTemplates } = require('../config/notificationTemplates');

/**
 * @typedef {Object} ReminderStats
 * @property {number} sent - Отправлено напоминаний
 * @property {number} skipped - Пропущено (неактивные пользователи)
 * @property {number} failed - Ошибки отправки
 * @property {Object[]} errors - Массив ошибок
 */

/**
 * Production-ready сервис напоминаний с тремя фиксированными слотами
 */
class ReminderService {
  constructor() {
    this.bot = null;
    this.templates = notificationTemplates;

    logger.info('🔔 ReminderService initialized with weekday-based system');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.bot - Telegram bot instance
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    logger.info('🔔 ReminderService dependencies initialized');
  }

  /**
   * Отправка напоминаний для определенного слота
   * @param {string} slot - Слот времени: 'morning', 'day', 'evening'
   * @returns {Promise<ReminderStats>}
   */
  async sendSlotReminders(slot) {
    if (!this.bot) {
      logger.warn('🔔 Bot not initialized, skipping reminder sending');
      return { sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    if (!['morning', 'day', 'evening'].includes(slot)) {
      logger.error(`🔔 Invalid slot: ${slot}`);
      return { sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    try {
      const stats = { sent: 0, skipped: 0, failed: 0, errors: [] };
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Compute current weekday in Moscow timezone
      const dayName = this.getMoscowWeekday();
      logger.info(`🔔 Current Moscow weekday: ${dayName}`);

      // Получаем пользователей для отправки напоминаний
      const eligibleUsers = await this.getEligibleUsers(slot, dayOfWeek);
      logger.info(`[DEBUG] eligibleUsers: ` + eligibleUsers.map(u => `${u.userId} (${u.name})`).join(', '));
      logger.info(`🔔 Processing ${slot} reminders for ${eligibleUsers.length} users`);

      for (const user of eligibleUsers) {
        try {
          const result = await this.sendReminderToUser(user, slot, dayName);
          
          if (result === 'sent') {
            stats.sent++;
            // Обновляем lastSentAt только если отправлено
            await this.updateLastSentAt(user.userId);
          } else if (result === 'skipped') {
            stats.skipped++;
          }
          
        } catch (error) {
          logger.error(`🔔 Failed to send reminder to user ${user.userId}:`, error);
          stats.failed++;
          stats.errors.push({
            userId: user.userId,
            error: error.message,
            slot
          });
        }
      }

      logger.info(`🔔 ${slot} reminders completed: sent=${stats.sent}, skipped=${stats.skipped}, failed=${stats.failed}`);
      return stats;

    } catch (error) {
      logger.error(`🔔 Error in sendSlotReminders(${slot}):`, error);
      return { sent: 0, skipped: 0, failed: 0, errors: [{ error: error.message, slot }] };
    }
  }

  /**
   * Get current weekday name in Moscow timezone
   * @returns {string} Weekday name in Russian (capitalized)
   */
  getMoscowWeekday() {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      timeZone: 'Europe/Moscow'
    });
    const dayName = formatter.format(new Date());
    // Capitalize first letter
    return dayName.charAt(0).toUpperCase() + dayName.slice(1);
  }

  /**
   * Получить пользователей, которым нужно отправить напоминания
   * @param {string} slot - Слот времени
   * @param {number} dayOfWeek - День недели (0-6)
   * @returns {Promise<Array>}
   */
  async getEligibleUsers(slot, dayOfWeek) {
    try {
      const { UserProfile, Quote } = require('../models');
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Optimized MongoDB query with filtering
      const baseQuery = {
        isActive: true,
        isBlocked: { $ne: true },
        isOnboardingComplete: true,
        $or: [
          { 'settings.reminders.enabled': true },
          { 'settings.reminderEnabled': true } // legacy fallback
        ]
      };

      // Получаем пользователей с фильтрацией на уровне БД
      const allUsers = await UserProfile.find(baseQuery)
        .select({ userId: 1, name: 1, statistics: 1, settings: 1 });
      
      const eligibleUsers = [];

      for (const user of allUsers) {
        const settings = user.getNormalizedSettings();
        
        // Проверяем включены ли напоминания (double-check after DB query)
        if (!settings.reminders.enabled) {
          continue;
        }

        // Проверяем частоту и применяем логику слотов
        if (!this.shouldSendForFrequency(settings.reminders.frequency, slot, dayOfWeek)) {
          continue;
        }

        // Проверяем, не добавил ли пользователь уже 10+ цитат сегодня
        const todayQuotesCount = await Quote.countDocuments({
          userId: user.userId,
          createdAt: { $gte: startOfDay }
        });

        if (todayQuotesCount >= 10) {
          continue; // Пользователь уже активен сегодня
        }

        eligibleUsers.push(user);
      }

      return eligibleUsers;

    } catch (error) {
      logger.error('🔔 Error getting eligible users:', error);
      return [];
    }
  }

  /**
   * Проверить, нужно ли отправлять напоминание для данной частоты и слота
   * @param {string} frequency - Частота: 'often', 'standard', 'rare', 'off'
   * @param {string} slot - Слот времени
   * @param {number} dayOfWeek - День недели (0-6)
   * @returns {boolean}
   */
  shouldSendForFrequency(frequency, slot, dayOfWeek) {
    switch (frequency) {
      case 'off':
        return false;
      
      case 'often':
        return true; // Все три слота
      
      case 'standard':
        return slot === 'morning'; // Только утренний слот
      
      case 'rare':
        // Только вечерний слот И только вторник(2) и пятница(5)
        return slot === 'evening' && (dayOfWeek === 2 || dayOfWeek === 5);
      
      default:
        return false;
    }
  }

  /**
   * Отправить напоминание конкретному пользователю
   * @param {Object} user - Пользователь
   * @param {string} slot - Слот времени
   * @param {string} dayName - Название дня недели
   * @returns {Promise<string>} 'sent' or 'skipped'
   */
  async sendReminderToUser(user, slot, dayName) {
    // Get template for this weekday and slot
    const template = this.templates[dayName]?.[slot] || '';
    
    // If template is empty or whitespace-only, skip sending
    if (!template || template.trim() === '') {
      logger.info(`🔔 Skipped ${slot} reminder for user ${user.userId} (${user.name}) - empty template for ${dayName}`);
      return 'skipped';
    }

    // Build message from template (no user name prefix)
    let message = template;
    
    // Добавляем информацию о сегодняшних цитатах, если есть
    const { Quote } = require('../models');
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayCount = await Quote.countDocuments({
      userId: user.userId,
      createdAt: { $gte: startOfDay }
    });

    if (todayCount > 0) {
      message += `\n\n📊 Сегодня уже добавлено: ${todayCount} цитат`;
    }

    await this.bot.telegram.sendMessage(user.userId, message);
    logger.info(`🔔 Sent ${slot} reminder to user ${user.userId} (${user.name})`);
    return 'sent';
  }

  /**
   * Обновить время последней отправки напоминания
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async updateLastSentAt(userId) {
    try {
      const { UserProfile } = require('../models');
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'settings.reminders.lastSentAt': new Date()
        }
      );
    } catch (error) {
      logger.error(`🔔 Error updating lastSentAt for user ${userId}:`, error);
    }
  }

  /**
   * Получить диагностическую информацию
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      initialized: !!this.bot,
      status: this.bot ? 'ready' : 'bot_not_initialized',
      slots: ['morning', 'day', 'evening'],
      frequencies: ['off', 'rare', 'standard', 'often']
    };
  }

  // Сохраняем методы для обратной совместимости
  async sendDailyReminders() {
    logger.warn('🔔 sendDailyReminders() is deprecated, use sendSlotReminders() instead');
    const now = new Date();
    const hour = now.getHours();
    
    let slot;
    if (hour >= 9 && hour < 12) slot = 'morning';
    else if (hour >= 15 && hour < 18) slot = 'day';
    else if (hour >= 21 && hour < 24) slot = 'evening';
    else return { sent: 0, skipped: 0, failed: 0, errors: [] };
    
    return this.sendSlotReminders(slot);
  }

  async updateReminderSettings(userId, settings) {
    logger.warn('🔔 updateReminderSettings() is deprecated, use API endpoints instead');
    try {
      const { UserProfile } = require('../models');
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          'settings.reminderEnabled': settings.enabled,
          'settings.reminderTimes': settings.times
        }
      );
      
      logger.info(`🔔 Legacy reminder settings updated for user ${userId}`);
    } catch (error) {
      logger.error(`🔔 Error updating legacy reminder settings: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = { ReminderService };
