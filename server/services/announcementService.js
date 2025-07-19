/**
 * @fileoverview Система анонсов продуктов для проекта "Читатель"
 * @author g1orgi89
 * 📋 NEW: Интеграция с БД AnnouncementCatalog и UtmTemplate вместо хардкода
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
    this.initializeModels();
    logger.info('📖 AnnouncementService initialized');
  }

  /**
   * 📋 NEW: Инициализация MongoDB моделей
   * @private
   */
  initializeModels() {
    try {
      this.AnnouncementCatalog = require('../models/AnnouncementCatalog');
      this.TargetAudience = require('../models/TargetAudience');
      this.UtmTemplate = require('../models/UtmTemplate');
      this.PromoCode = require('../models/PromoCode');
      logger.info('📋 AnnouncementService: MongoDB models initialized');
    } catch (error) {
      logger.error('📋 AnnouncementService: Failed to initialize models:', error.message);
      // Fallback к хардкоду если модели недоступны
      this.AnnouncementCatalog = null;
    }
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

      // 📋 NEW: Получаем доступные анонсы из БД
      const announcements = await this.getPersonalizedAnnouncements();
      
      if (announcements.length === 0) {
        logger.warn('📖 No announcements available for this month');
        return stats;
      }

      for (const user of users) {
        try {
          // Выбираем персонализированный анонс для пользователя
          const selectedAnnouncement = await this.selectAnnouncementForUser(user, announcements);
          
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
   * 📋 NEW: Выбор подходящего анонса для пользователя на основе БД
   * @param {Object} user - Пользователь
   * @param {AnnouncementData[]} announcements - Доступные анонсы
   * @returns {Promise<AnnouncementData|null>} Выбранный анонс
   */
  async selectAnnouncementForUser(user, announcements) {
    if (!announcements || announcements.length === 0) {
      return null;
    }

    try {
      if (this.TargetAudience) {
        // Определяем подходящие аудитории для пользователя через БД
        const userAudiences = await this.TargetAudience.getForUser(user);
        
        if (userAudiences && userAudiences.length > 0) {
          // Ищем анонс для самой приоритетной аудитории
          for (const audience of userAudiences) {
            const matchingAnnouncement = announcements.find(a => 
              a.targetAudience.includes(audience.slug)
            );
            if (matchingAnnouncement) {
              logger.info(`📋 Selected announcement for user ${user.userId} based on audience: ${audience.name}`);
              return matchingAnnouncement;
            }
          }
        }
      }
      
      // Fallback к старой логике персонализации
      return this.selectAnnouncementFallback(user, announcements);
      
    } catch (error) {
      logger.error(`📋 Error selecting announcement from database: ${error.message}`);
      return this.selectAnnouncementFallback(user, announcements);
    }
  }

  /**
   * 📋 NEW: Fallback логика выбора анонса (старая логика)
   * @param {Object} user - Пользователь
   * @param {AnnouncementData[]} announcements - Доступные анонсы
   * @returns {AnnouncementData|null} Выбранный анонс
   */
  selectAnnouncementFallback(user, announcements) {
    const userPreferences = user.preferences?.mainThemes || [];
    const testResults = user.testResults || {};

    // Персонализация на основе результатов теста и активности
    
    // 1. Для мам - специальные курсы о материнстве
    if (testResults.lifestyle?.includes('мама')) {
      const mothersAnnouncement = announcements.find(a => 
        a.targetAudience.includes('mothers') || a.targetAudience.includes('mothers')
      );
      if (mothersAnnouncement) return mothersAnnouncement;
    }

    // 2. Для саморазвития
    if (userPreferences.includes('Саморазвитие') || userPreferences.includes('Мудрость')) {
      const selfDevAnnouncement = announcements.find(a => 
        a.targetAudience.includes('self_development') || a.targetAudience.includes('samorazvitie')
      );
      if (selfDevAnnouncement) return selfDevAnnouncement;
    }

    // 3. Для тем любви и отношений
    if (userPreferences.includes('Любовь') || userPreferences.includes('Отношения')) {
      const relationshipsAnnouncement = announcements.find(a => 
        a.targetAudience.includes('relationships') || a.targetAudience.includes('otnosheniya')
      );
      if (relationshipsAnnouncement) return relationshipsAnnouncement;
    }

    // 4. Для женственности (если есть соответствующие темы)
    if (testResults.priorities?.includes('баланс') || testResults.priorities?.includes('нежность')) {
      const womenAnnouncement = announcements.find(a => 
        a.targetAudience.includes('women') || a.targetAudience.includes('zhenshchiny')
      );
      if (womenAnnouncement) return womenAnnouncement;
    }

    // 5. Дефолтный анонс - первый доступный
    return announcements[0];
  }

  /**
   * 📋 NEW: Получение доступных анонсов из БД на текущий месяц
   * @returns {Promise<AnnouncementData[]>} Массив анонсов
   */
  async getPersonalizedAnnouncements() {
    try {
      const currentMonth = new Date().getMonth() + 1;
      
      if (this.AnnouncementCatalog) {
        // Получаем анонсы из БД для текущего месяца
        const announcements = await this.AnnouncementCatalog.getForMonth(currentMonth);
        
        if (announcements && announcements.length > 0) {
          // Форматируем анонсы для совместимости
          const formattedAnnouncements = announcements.map(a => ({
            id: a.announcementSlug,
            title: a.title,
            description: a.description,
            price: `$${a.price}`,
            targetAudience: a.targetAudience,
            launchDate: this.getMonthName(currentMonth) + ' ' + new Date().getFullYear(),
            utmCampaign: a.announcementSlug
          }));
          
          logger.info(`📋 Generated ${formattedAnnouncements.length} announcements from database`);
          return formattedAnnouncements;
        }
      }
      
      // Fallback к хардкоду если БД недоступна
      logger.warn('📋 Database not available, using fallback announcements');
      return this.getFallbackAnnouncements();
      
    } catch (error) {
      logger.error(`📋 Error getting announcements from database: ${error.message}`);
      return this.getFallbackAnnouncements();
    }
  }

  /**
   * 📋 NEW: Fallback анонсы (старая логика)
   * @returns {AnnouncementData[]} Массив анонсов
   */
  getFallbackAnnouncements() {
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

    logger.info(`📖 Generated ${selectedAnnouncements.length} fallback announcements for ${this.getMonthName(currentMonth)}`);
    return selectedAnnouncements;
  }

  /**
   * 📋 NEW: Отправка анонса пользователю с интеграцией БД
   * @param {string} userId - ID пользователя
   * @param {AnnouncementData} announcement - Данные анонса
   * @returns {Promise<void>}
   */
  async sendAnnouncementToUser(userId, announcement) {
    // 📋 NEW: Генерируем UTM ссылку из БД или используем fallback
    const utmLink = await this.generateUTMLink(announcement.utmCampaign, userId);
    
    // 📋 NEW: Получаем актуальный промокод из БД
    const promoCode = await this.getAnnouncementPromoCode();
    
    const message = `🎉 *Специальный анонс от Анны Бусел*\n\n📚 *${announcement.title}*\n\n${announcement.description}\n\n💰 Стоимость: ${announcement.price}\n🗓 Старт: ${announcement.launchDate}\n\n🎁 *Для подписчиков "Читателя" скидка ${promoCode.discount}%*\nПромокод: ${promoCode.code}\n\n[Узнать подробности и записаться](${utmLink})\n\n---\n_Анонсы приходят только раз в месяц с важными новостями от Анны_`;

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
   * 📋 NEW: Получение промокода для анонсов из БД
   * @returns {Promise<Object>} Промокод
   */
  async getAnnouncementPromoCode() {
    try {
      if (this.PromoCode) {
        const promoCode = await this.PromoCode.getRandomForContext('monthly_announcement');
        
        if (promoCode) {
          logger.info(`📋 Using promo code from database: ${promoCode.code}`);
          return {
            code: promoCode.code,
            discount: promoCode.discount
          };
        }
      }
      
      // Fallback к хардкоду
      logger.warn('📋 Database not available, using fallback promo code');
      return { code: 'READER15', discount: 15 };
      
    } catch (error) {
      logger.error(`📋 Error getting promo code from database: ${error.message}`);
      return { code: 'READER15', discount: 15 };
    }
  }

  /**
   * 📋 NEW: Генерация UTM ссылки из БД шаблонов
   * @param {string} campaign - Название кампании
   * @param {string} userId - ID пользователя
   * @returns {Promise<string>} UTM ссылка
   */
  async generateUTMLink(campaign, userId) {
    try {
      if (this.UtmTemplate) {
        // Получаем шаблон для месячных анонсов
        const templates = await this.UtmTemplate.getByContext('monthly_announcement');
        
        if (templates && templates.length > 0) {
          const template = templates[0];
          const variables = {
            campaignSlug: campaign,
            userId: userId,
            context: 'monthly_announcement'
          };
          
          const utmLink = template.generateLink(variables);
          logger.info(`📋 Generated UTM link from database template: ${template.name}`);
          return utmLink;
        }
      }
      
      // Fallback к старой логике
      return this.generateFallbackUTMLink(campaign, userId);
      
    } catch (error) {
      logger.error(`📋 Error generating UTM link from database: ${error.message}`);
      return this.generateFallbackUTMLink(campaign, userId);
    }
  }

  /**
   * 📋 NEW: Fallback UTM ссылка (старая логика)
   * @param {string} campaign - Название кампании
   * @param {string} userId - ID пользователя
   * @returns {string} UTM ссылка
   */
  generateFallbackUTMLink(campaign, userId) {
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
      const selectedAnnouncement = await this.selectAnnouncementForUser(user, announcements);
      
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
      databaseAvailable: !!this.AnnouncementCatalog,
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