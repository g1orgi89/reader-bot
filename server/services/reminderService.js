/**
 * @fileoverview Production-ready Telegram notification system for Reader Bot
 * Supports text-only, image-only, and text+image notifications
 * 
 * UPDATED: Added support for:
 * - button field in templates for inline keyboard
 * - monthlyReport slot for 1st of each month
 * 
 * @author g1orgi89
 */

const logger = require('../utils/logger');
const { notificationTemplates } = require('../config/notificationTemplates');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ReminderStats
 * @property {number} sent - Отправлено напоминаний
 * @property {number} skipped - Пропущено (неактивные пользователи)
 * @property {number} failed - Ошибки отправки
 * @property {Object[]} errors - Массив ошибок
 */

/**
 * Production-ready сервис напоминаний с поддержкой изображений и кнопок
 */
class ReminderService {
  constructor() {
    this.bot = null;
    this.templates = notificationTemplates;
    this.assetsPath = path.join(__dirname, '../assets/notifications');
    this.botUsername = process.env.BOT_USERNAME || 'reader_app_bot';

    logger.info('🔔 ReminderService initialized with date-based notification system');
    logger.info(`📂 Assets path: ${this.assetsPath}`);
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
   * Получить шаблон уведомления для конкретной даты и слота
   * @param {string} dateKey - Ключ даты в формате YYYY-MM-DD
   * @param {string} slot - Слот времени: 'report', 'monthlyReport', 'morning', 'day', 'evening'
   * @returns {Object|null} Объект шаблона или null
   */
  getNotificationTemplate(dateKey, slot) {
    const dayTemplates = this.templates[dateKey];
    
    if (!dayTemplates) {
      return null;
    }

    return dayTemplates[slot] || null;
  }

  /**
   * Проверить существование файла изображения
   * @param {string} imagePath - Путь к изображению
   * @returns {boolean}
   */
  imageExists(imagePath) {
    try {
      const fullPath = path.join(this.assetsPath, path.basename(imagePath));
      return fs.existsSync(fullPath);
    } catch (error) {
      logger.error(`🖼️ Error checking image existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Создать inline keyboard из button шаблона
   * @param {Object} buttonTemplate - Шаблон кнопки { text, url }
   * @returns {Object|undefined} Telegram reply_markup или undefined
   */
  createInlineKeyboard(buttonTemplate) {
    if (!buttonTemplate || !buttonTemplate.text || !buttonTemplate.url) {
      return undefined;
    }

    const deeplink = `https://t.me/${this.botUsername}/Reader?startapp=${buttonTemplate.url}`;
    
    return {
      inline_keyboard: [[{
        text: buttonTemplate.text,
        url: deeplink
      }]]
    };
  }

  /**
   * Отправка напоминаний для определенного слота
   * @param {string} slot - Слот времени: 'morning', 'day', 'evening', 'report', 'monthlyReport'
   * @returns {Promise<ReminderStats>}
   */
  async sendSlotReminders(slot) {
    if (!this.bot) {
      logger.warn('🔔 Bot not initialized, skipping reminder sending');
      return { sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    if (!['report', 'monthlyReport', 'morning', 'day', 'evening'].includes(slot)) {
      logger.error(`🔔 Invalid slot: ${slot}`);
      return { sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    try {
      const stats = { sent: 0, skipped: 0, failed: 0, errors: [] };
      
      // Получаем текущую дату в формате YYYY-MM-DD для Moscow timezone
      const dateKey = this.getCurrentMoscowDateKey();
      logger.info(`🔔 Processing ${slot} reminders for date: ${dateKey}`);

      // Получаем шаблон для этой даты и слота
      const template = this.getNotificationTemplate(dateKey, slot);
      
      if (!template) {
        logger.info(`🔔 No template found for date ${dateKey}, slot ${slot} - skipping`);
        return stats;
      }

      // Получаем пользователей для отправки напоминаний
      const eligibleUsers = await this.getEligibleUsers(slot);
      logger.info(`[DEBUG] eligibleUsers: ` + eligibleUsers.map(u => `${u.userId} (${u.name})`).join(', '));
      logger.info(`🔔 Processing ${slot} reminders for ${eligibleUsers.length} users`);

      for (const user of eligibleUsers) {
        try {
          const result = await this.sendReminderToUser(user, template, slot, dateKey);
          
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
   * Get current date key in Moscow timezone (YYYY-MM-DD)
   * @returns {string} Date key
   */
  getCurrentMoscowDateKey() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return formatter.format(new Date());
  }

  /**
   * Получить пользователей, которым нужно отправить напоминания
   * @param {string} slot - Слот времени
   * @returns {Promise<Array>}
   */
  async getEligibleUsers(slot) {
    try {
      const { UserProfile, Quote } = require('../models');
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Базовый запрос для активных пользователей
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
        
        // Проверяем включены ли напоминания
        if (!settings.reminders.enabled) {
          continue;
        }

        // Для слотов 'report' и 'monthlyReport' отправляем всем активным пользователям
        if (slot === 'report' || slot === 'monthlyReport') {
          eligibleUsers.push(user);
          continue;
        }

        // Для остальных слотов проверяем частоту
        const dayOfWeek = today.getDay();
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
   * Поддерживает 3 типа уведомлений:
   * 1. Только текст (text)
   * 2. Только изображение (image)
   * 3. Текст + изображение (text + image)
   * 
   * Все типы могут содержать inline кнопку (button)
   * 
   * @param {Object} user - Пользователь
   * @param {Object} template - Шаблон уведомления
   * @param {string} slot - Слот времени
   * @param {string} dateKey - Ключ даты
   * @returns {Promise<string>} 'sent' or 'skipped'
   */
  async sendReminderToUser(user, template, slot, dateKey) {
    const hasText = template.text && template.text.trim() !== '';
    const hasImage = template.image && template.image.trim() !== '';
    const replyMarkup = this.createInlineKeyboard(template.button);

    // Если нет ни текста, ни изображения - пропускаем
    if (!hasText && !hasImage) {
      logger.info(`🔔 Skipped ${slot} reminder for user ${user.userId} (${user.name}) - empty template for ${dateKey}`);
      return 'skipped';
    }

    try {
      // СЛУЧАЙ 1: Только изображение (без текста)
      if (hasImage && !hasText) {
        const imagePath = path.join(this.assetsPath, path.basename(template.image));
        
        if (!fs.existsSync(imagePath)) {
          logger.warn(`🖼️ Image not found: ${imagePath} - skipping for user ${user.userId}`);
          return 'skipped';
        }

        await this.bot.telegram.sendPhoto(
          user.userId,
          { source: fs.createReadStream(imagePath) },
          { reply_markup: replyMarkup }
        );

        logger.info(`🖼️ Sent image-only ${slot} reminder to user ${user.userId} (${user.name})${replyMarkup ? ' with button' : ''}`);
        return 'sent';
      }

      // СЛУЧАЙ 2: Только текст (без изображения)
      if (hasText && !hasImage) {
        let message = template.text;
        
        // Добавляем информацию о сегодняшних цитатах, если есть (только для обычных напоминаний)
        if (!['report', 'monthlyReport'].includes(slot)) {
          const todayCount = await this.getTodayQuotesCount(user.userId);
          if (todayCount > 0) {
            message += `\n\n📊 Сегодня уже добавлено: ${todayCount} цитат`;
          }
        }

        await this.bot.telegram.sendMessage(
          user.userId, 
          message,
          { reply_markup: replyMarkup }
        );
        
        logger.info(`📝 Sent text-only ${slot} reminder to user ${user.userId} (${user.name})${replyMarkup ? ' with button' : ''}`);
        return 'sent';
      }

      // СЛУЧАЙ 3: Текст + Изображение
      if (hasText && hasImage) {
        const imagePath = path.join(this.assetsPath, path.basename(template.image));
        
        // Если изображение не найдено - отправляем только текст
        if (!fs.existsSync(imagePath)) {
          logger.warn(`🖼️ Image not found: ${imagePath} - sending text only for user ${user.userId}`);
          
          let message = template.text;
          if (!['report', 'monthlyReport'].includes(slot)) {
            const todayCount = await this.getTodayQuotesCount(user.userId);
            if (todayCount > 0) {
              message += `\n\n📊 Сегодня уже добавлено: ${todayCount} цитат`;
            }
          }

          await this.bot.telegram.sendMessage(
            user.userId, 
            message,
            { reply_markup: replyMarkup }
          );
          
          logger.info(`📝 Sent text-only ${slot} reminder (image missing) to user ${user.userId} (${user.name})${replyMarkup ? ' with button' : ''}`);
          return 'sent';
        }

        // Отправляем изображение с текстом в caption
        let caption = template.text;
        if (!['report', 'monthlyReport'].includes(slot)) {
          const todayCount = await this.getTodayQuotesCount(user.userId);
          if (todayCount > 0) {
            caption += `\n\n📊 Сегодня уже добавлено: ${todayCount} цитат`;
          }
        }

        await this.bot.telegram.sendPhoto(
          user.userId,
          { source: fs.createReadStream(imagePath) },
          { 
            caption: caption,
            reply_markup: replyMarkup
          }
        );

        logger.info(`📸 Sent text+image ${slot} reminder to user ${user.userId} (${user.name})${replyMarkup ? ' with button' : ''}`);
        return 'sent';
      }

      return 'skipped';

    } catch (error) {
      logger.error(`🔔 Error sending reminder to user ${user.userId}:`, error);
      throw error;
    }
  }

  /**
   * Получить количество цитат пользователя за сегодня
   * @param {string} userId - ID пользователя
   * @returns {Promise<number>}
   */
  async getTodayQuotesCount(userId) {
    try {
      const { Quote } = require('../models');
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      return await Quote.countDocuments({
        userId: userId,
        createdAt: { $gte: startOfDay }
      });
    } catch (error) {
      logger.error(`🔔 Error getting today quotes count for user ${userId}:`, error);
      return 0;
    }
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
      slots: ['report', 'monthlyReport', 'morning', 'day', 'evening'],
      frequencies: ['off', 'rare', 'standard', 'often'],
      assetsPath: this.assetsPath,
      templateDates: Object.keys(this.templates).length,
      botUsername: this.botUsername
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
