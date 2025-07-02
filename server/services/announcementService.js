/**
 * @fileoverview Система анонсов продуктов для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} AnnouncementData
 * @property {string} id - ID анонса
 * @property {string} title - Заголовок
 * @property {string} description - Описание
 * @property {string} price - Цена
 * @property {string[]} targetAudience - Целевая аудитория
 * @property {string} launchDate - Дата запуска
 * @property {string} utmCampaign - UTM кампания
 */

/**
 * @typedef {Object} AnnouncementStats
 * @property {number} sent - Отправлено анонсов
 * @property {number} failed - Ошибки отправки
 * @property {number} total - Всего пользователей
 * @property {Object[]} errors - Массив ошибок
 */

/**
 * Сервис анонсов продуктов (отправка с 25 числа каждого месяца)
 */
class AnnouncementService {
  constructor() {
    this.bot = null;
    logger.info('📖 AnnouncementService initialized');
  }

  /**
   * Инициализация сервиса с зависимостями
   * @param {Object} dependencies - Зависимости
   * @param {Object} dependencies.bot - Telegram bot instance
   */
  initialize(dependencies) {
    this.bot = dependencies.bot;
    logger.info('📖 AnnouncementService dependencies initialized');
  }

  /**
   * Отправка месячных анонсов всем активным пользователям
   * @returns {Promise<AnnouncementStats>}
   */
  async sendMonthlyAnnouncements() {
    if (!this.bot) {
      logger.error('📖 Bot not initialized in AnnouncementService');
      return { sent: 0, failed: 0, total: 0, errors: [] };
    }

    try {
      const stats = { sent: 0, failed: 0, total: 0, errors: [] };
      
      // Получаем всех активных пользователей
      const users = await this.getActiveUsers();
      stats.total = users.length;
      
      logger.info(`📖 Processing announcements for ${users.length} users`);

      // Получаем доступные анонсы
      const announcements = await this.getPersonalizedAnnouncements();
      
      if (announcements.length === 0) {
        logger.warn('📖 No announcements available for this month');
        return stats;
      }

      for (const user of users) {
        try {
          // Выбираем персонализированный анонс для пользователя
          const selectedAnnouncement = this.selectAnnouncementForUser(user, announcements);
          
          if (selectedAnnouncement) {
            await this.sendAnnouncementToUser(user.userId, selectedAnnouncement);
            stats.sent++;
            
            // Небольшая задержка между отправками
            await new Promise(resolve => setTimeout(resolve, 150));
          } else {
            logger.warn(`📖 No suitable announcement found for user ${user.userId}`);
          }
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            userId: user.userId,
            error: error.message
          });
          logger.error(`📖 Failed to send announcement to user ${user.userId}: ${error.message}`);
        }
      }

      logger.info(`📖 Announcements completed: ${stats.sent} sent, ${stats.failed} failed`);
      return stats;

    } catch (error) {
      logger.error(`📖 Error in sendMonthlyAnnouncements: ${error.message}`, error);
      return { sent: 0, failed: 0, total: 0, errors: [{ error: error.message }] };
    }
  }

  /**
   * Получение активных пользователей для анонсов
   * @returns {Promise<Array>} Пользователи
   */
  async getActiveUsers() {
    try {
      const { UserProfile } = require('../models');
      
      return await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true, // Отправляем только тем, кто не отключил уведомления
        // Пользователи должны быть зарегистрированы хотя бы неделю назад
        registeredAt: { 
          $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
        }
      });
    } catch (error) {
      logger.error(`📖 Error getting active users: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Выбор подходящего анонса для пользователя на основе персонализации
   * @param {Object} user - Пользователь
   * @param {AnnouncementData[]} announcements - Доступные анонсы
   * @returns {AnnouncementData|null} Выбранный анонс
   */
  selectAnnouncementForUser(user, announcements) {
    if (!announcements || announcements.length === 0) {
      return null;
    }

    const userPreferences = user.preferences?.mainThemes || [];
    const testResults = user.testResults || {};

    // Персонализация на основе результатов теста и активности
    
    // 1. Для мам - специальные курсы о материнстве
    if (testResults.lifestyle?.includes('мама')) {
      const mothersAnnouncement = announcements.find(a => 
        a.targetAudience.includes('mothers')
      );
      if (mothersAnnouncement) return mothersAnnouncement;
    }

    // 2. Для саморазвития
    if (userPreferences.includes('Саморазвитие') || userPreferences.includes('Мудрость')) {
      const selfDevAnnouncement = announcements.find(a => 
        a.targetAudience.includes('self_development')
      );
      if (selfDevAnnouncement) return selfDevAnnouncement;
    }

    // 3. Для тем любви и отношений
    if (userPreferences.includes('Любовь') || userPreferences.includes('Отношения')) {
      const relationshipsAnnouncement = announcements.find(a => 
        a.targetAudience.includes('relationships')
      );
      if (relationshipsAnnouncement) return relationshipsAnnouncement;
    }

    // 4. Для женственности (если есть соответствующие темы)
    if (testResults.priorities?.includes('баланс') || testResults.priorities?.includes('нежность')) {
      const womenAnnouncement = announcements.find(a => 
        a.targetAudience.includes('women')
      );
      if (womenAnnouncement) return womenAnnouncement;
    }

    // 5. Дефолтный анонс - первый доступный
    return announcements[0];
  }

  /**
   * Получение доступных анонсов на текущий месяц
   * @returns {Promise<AnnouncementData[]>} Массив анонсов
   */
  async getPersonalizedAnnouncements() {
    // В реальном проекте это может загружаться из базы данных
    // Пока используем статический набор с ротацией по месяцам
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const baseAnnouncements = [
      {
        id: 'new_book_club',
        title: 'Новый книжный клуб "Женщина и литература"',
        description: 'Месячный курс для тех, кто хочет глубже понять себя через книги',
        price: '$25',
        targetAudience: ['self_development', 'women'],
        launchDate: this.getMonthName(currentMonth) + ' ' + currentYear,
        utmCampaign: `${this.getMonthName(currentMonth).toLowerCase()}_book_club`
      },
      {
        id: 'mothers_course',
        title: 'Курс "Мудрая мама"',
        description: 'Как сохранить себя в материнстве и воспитать счастливых детей',
        price: '$20',
        targetAudience: ['mothers', 'family'],
        launchDate: this.getMonthName(currentMonth) + ' ' + currentYear,
        utmCampaign: `${this.getMonthName(currentMonth).toLowerCase()}_wise_mother`
      },
      {
        id: 'relationships_intensive',
        title: 'Интенсив "Любовь без драм"',
        description: 'Строим здоровые отношения на основе психологии и литературы',
        price: '$18',
        targetAudience: ['relationships', 'love'],
        launchDate: this.getMonthName(currentMonth) + ' ' + currentYear,
        utmCampaign: `${this.getMonthName(currentMonth).toLowerCase()}_love_intensive`
      },
      {
        id: 'self_discovery',
        title: 'Курс "Найти себя"',
        description: 'Путешествие к аутентичности через литературу и самопознание',
        price: '$22',
        targetAudience: ['self_development', 'personal_growth'],
        launchDate: this.getMonthName(currentMonth) + ' ' + currentYear,
        utmCampaign: `${this.getMonthName(currentMonth).toLowerCase()}_self_discovery`
      }
    ];

    // Ротация: в разные месяцы разные наборы анонсов
    const monthRotation = currentMonth % 4;
    const selectedAnnouncements = baseAnnouncements.slice(monthRotation, monthRotation + 2);
    
    // Если получилось меньше 2 анонсов, добавляем с начала
    if (selectedAnnouncements.length < 2) {
      selectedAnnouncements.push(...baseAnnouncements.slice(0, 2 - selectedAnnouncements.length));
    }

    logger.info(`📖 Generated ${selectedAnnouncements.length} announcements for ${this.getMonthName(currentMonth)}`);
    return selectedAnnouncements;
  }

  /**
   * Отправка анонса пользователю
   * @param {string} userId - ID пользователя
   * @param {AnnouncementData} announcement - Данные анонса
   * @returns {Promise<void>}
   */
  async sendAnnouncementToUser(userId, announcement) {
    const utmLink = this.generateUTMLink(announcement.utmCampaign, userId);
    
    const message = `🎉 *Специальный анонс от Анны Бусел*

📚 *${announcement.title}*

${announcement.description}

💰 Стоимость: ${announcement.price}
🗓 Старт: ${announcement.launchDate}

🎁 *Для подписчиков "Читателя" скидка 15%*
Промокод: READER15

[Узнать подробности и записаться](${utmLink})

---
_Анонсы приходят только раз в месяц с важными новостями от Анны_`;

    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
      logger.debug(`📖 Announcement sent to user ${userId}: ${announcement.title}`);
    } catch (error) {
      // Проверяем если пользователь заблокировал бота
      if (error.response && error.response.error_code === 403) {
        logger.info(`📖 User ${userId} blocked the bot, skipping announcements`);
        await this.disableAnnouncementsForUser(userId);
      } else {
        throw error;
      }
    }
  }

  /**
   * Генерация UTM ссылки для анонса
   * @param {string} campaign - Название кампании
   * @param {string} userId - ID пользователя
   * @returns {string} UTM ссылка
   */
  generateUTMLink(campaign, userId) {
    const baseUrl = process.env.ANNA_WEBSITE_URL || "https://anna-busel.com/courses";
    const utmParams = new URLSearchParams({
      utm_source: 'telegram_bot',
      utm_medium: 'monthly_announcement',
      utm_campaign: campaign,
      utm_content: 'reader_subscribers',
      user_id: userId,
      discount: 'READER15'
    });
    
    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Отключение анонсов для заблокированного пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async disableAnnouncementsForUser(userId) {
    try {
      const { UserProfile } = require('../models');
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { 'settings.reminderEnabled': false }
      );
      
      logger.info(`📖 Announcements disabled for blocked user ${userId}`);
    } catch (error) {
      logger.error(`📖 Error disabling announcements for user ${userId}: ${error.message}`, error);
    }
  }

  /**
   * Получение названия месяца
   * @param {number} monthNumber - Номер месяца (1-12)
   * @returns {string} Название месяца
   */
  getMonthName(monthNumber) {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[monthNumber - 1] || 'Неизвестный месяц';
  }

  /**
   * Ручной тест отправки анонса
   * @param {string} userId - ID пользователя для теста
   * @returns {Promise<boolean>} Успешность отправки
   */
  async testAnnouncement(userId) {
    try {
      const { UserProfile } = require('../models');
      
      const user = await UserProfile.findOne({ userId });
      if (!user) {
        logger.error(`📖 User ${userId} not found for announcement test`);
        return false;
      }

      const announcements = await this.getPersonalizedAnnouncements();
      const selectedAnnouncement = this.selectAnnouncementForUser(user, announcements);
      
      if (!selectedAnnouncement) {
        logger.error(`📖 No announcement selected for user ${userId}`);
        return false;
      }

      await this.sendAnnouncementToUser(userId, selectedAnnouncement);
      
      logger.info(`📖 Test announcement sent to user ${userId}: ${selectedAnnouncement.title}`);
      return true;

    } catch (error) {
      logger.error(`📖 Error sending test announcement: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Получение статистики анонсов
   * @returns {Promise<Object>} Статистика
   */
  async getAnnouncementStats() {
    try {
      const { UserProfile } = require('../models');
      
      const totalUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true
      });

      const eligibleUsers = await UserProfile.countDocuments({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true,
        registeredAt: { 
          $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
        }
      });

      // Группируем пользователей по предпочтениям
      const users = await UserProfile.find({
        isOnboardingComplete: true,
        'settings.reminderEnabled': true
      }, 'preferences testResults');

      const audienceBreakdown = {
        mothers: 0,
        self_development: 0,
        relationships: 0,
        women: 0,
        other: 0
      };

      users.forEach(user => {
        const preferences = user.preferences?.mainThemes || [];
        const testResults = user.testResults || {};

        if (testResults.lifestyle?.includes('мама')) {
          audienceBreakdown.mothers++;
        } else if (preferences.includes('Саморазвитие') || preferences.includes('Мудрость')) {
          audienceBreakdown.self_development++;
        } else if (preferences.includes('Любовь') || preferences.includes('Отношения')) {
          audienceBreakdown.relationships++;
        } else if (testResults.priorities?.includes('баланс')) {
          audienceBreakdown.women++;
        } else {
          audienceBreakdown.other++;
        }
      });

      const announcements = await this.getPersonalizedAnnouncements();

      return {
        totalUsers,
        eligibleUsers,
        disabledUsers: totalUsers - eligibleUsers,
        audienceBreakdown,
        availableAnnouncements: announcements.length,
        nextAnnouncementDate: this.getNextAnnouncementDate(),
        currentMonth: this.getMonthName(new Date().getMonth() + 1)
      };

    } catch (error) {
      logger.error(`📖 Error getting announcement stats: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Получение даты следующего анонса (25 число)
   * @returns {Date} Дата следующего анонса
   */
  getNextAnnouncementDate() {
    const now = new Date();
    const nextAnnouncement = new Date(now.getFullYear(), now.getMonth(), 25, 12, 0, 0);
    
    // Если 25 число уже прошло в этом месяце, берем следующий месяц
    if (nextAnnouncement <= now) {
      nextAnnouncement.setMonth(nextAnnouncement.getMonth() + 1);
    }
    
    return nextAnnouncement;
  }

  /**
   * Проверка должны ли мы отправлять анонсы сегодня (25 число)
   * @returns {boolean} Нужно ли отправлять анонсы
   */
  shouldSendAnnouncementsToday() {
    const today = new Date();
    return today.getDate() === 25;
  }

  /**
   * Получение диагностической информации
   * @returns {Object} Диагностика сервиса
   */
  getDiagnostics() {
    return {
      initialized: !!this.bot,
      nextAnnouncementDate: this.getNextAnnouncementDate(),
      shouldSendToday: this.shouldSendAnnouncementsToday(),
      currentMonth: this.getMonthName(new Date().getMonth() + 1),
      baseUrl: process.env.ANNA_WEBSITE_URL || "https://anna-busel.com/courses"
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

module.exports = { AnnouncementService };
