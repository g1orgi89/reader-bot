/**
 * @fileoverview Обработчик сложных вопросов для бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile } = require('../../server/models');
const ticketingService = require('../../server/services/ticketing');

/**
 * @typedef {import('../../server/types/reader').UserProfile} UserProfile
 */

/**
 * Класс для обработки сложных вопросов - создание тикетов для Анны
 */
class ComplexQuestionHandler {
  constructor() {
    /**
     * @type {Array<RegExp>} - Паттерны для определения сложных вопросов
     */
    this.complexQuestionPatterns = [
      // Прямые просьбы о помощи
      /помогите/i,
      /помочь/i,
      /не понимаю/i,
      /не знаю что делать/i,
      /что делать/i,
      /как быть/i,
      
      // Проблемы и консультации
      /проблема/i,
      /консультация/i,
      /совет/i,
      /посоветуйте/i,
      /можете посоветовать/i,
      /помогите разобраться/i,
      
      // Технические проблемы
      /не работает/i,
      /ошибка/i,
      /баг/i,
      /сломался/i,
      
      // Психологические состояния
      /депрессия/i,
      /тревога/i,
      /стресс/i,
      /одиночество/i,
      /грустно/i,
      /плохо себя чувствую/i,
      /устала/i,
      /выгорание/i,
      
      // Личные проблемы
      /отношения/i,
      /муж/i,
      /жена/i,
      /дети/i,
      /семья/i,
      /развод/i,
      /расставание/i,
      
      // Вопросы о жизни
      /смысл жизни/i,
      /зачем жить/i,
      /цель в жизни/i,
      /предназначение/i
    ];

    /**
     * @type {Array<string>} - Ключевые слова для немедленной эскалации
     */
    this.urgentKeywords = [
      'суицид', 'самоубийство', 'покончить с собой', 'не хочу жить',
      'депрессия', 'панические атаки', 'насилие', 'избиение'
    ];

    logger.info('📖 ComplexQuestionHandler initialized');
  }

  /**
   * Проверка, является ли сообщение сложным вопросом
   * @param {string} message - Текст сообщения
   * @returns {boolean} true если сообщение требует внимания Анны
   */
  isComplexQuestion(message) {
    const lowerMessage = message.toLowerCase();
    
    // Проверка длины сообщения (очень длинные сообщения обычно содержат сложные вопросы)
    if (message.length > 500) return true;
    
    // Проверка на паттерны сложных вопросов
    const hasComplexPattern = this.complexQuestionPatterns.some(pattern => 
      pattern.test(message)
    );
    
    // Проверка на множественные вопросы
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount >= 3) return true;
    
    // Проверка на эмоциональную нагрузку (много восклицательных знаков)
    const exclamationCount = (message.match(/!/g) || []).length;
    if (exclamationCount >= 5) return true;
    
    return hasComplexPattern;
  }

  /**
   * Проверка на срочные случаи
   * @param {string} message - Текст сообщения
   * @returns {boolean} true если требуется срочное внимание
   */
  isUrgentCase(message) {
    const lowerMessage = message.toLowerCase();
    return this.urgentKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Обработка сложного вопроса
   * @param {Object} ctx - Telegram context
   * @param {string} message - Текст сообщения
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  async handleComplexQuestion(ctx, message, userProfile) {
    try {
      const isUrgent = this.isUrgentCase(message);
      
      // Создание тикета через ticketingService
      const ticket = await ticketingService.createTicket({
        userId: userProfile.userId,
        conversationId: ctx.chat.id.toString(),
        subject: `Вопрос от ${userProfile.name} (@${userProfile.telegramUsername || 'без_username'})`,
        initialMessage: message,
        context: this._buildContext(userProfile, ctx),
        priority: isUrgent ? 'high' : 'medium',
        category: this._categorizeQuestion(message),
        language: 'ru',
        email: userProfile.email,
        metadata: {
          source: 'telegram_bot',
          userRegistered: userProfile.registeredAt,
          totalQuotes: userProfile.statistics.totalQuotes,
          platform: 'reader_bot',
          isUrgent: isUrgent
        }
      });

      // Ответ пользователю
      const responseMessage = this._buildUserResponse(userProfile, ticket, isUrgent);
      await ctx.reply(responseMessage, { parse_mode: 'Markdown' });

      // Уведомление Анне
      await this._notifyAnna(ticket, userProfile, message, isUrgent);

      logger.info(`📖 Complex question ticket created: ${ticket.ticketId} for user ${userProfile.userId}`);
      
    } catch (error) {
      logger.error(`📖 Error handling complex question: ${error.message}`);
      await ctx.reply(
        "📖 Ваш вопрос очень важен, но произошла техническая ошибка. " +
        "Пожалуйста, попробуйте еще раз или напишите напрямую Анне."
      );
    }
  }

  /**
   * Построение контекста для тикета
   * @private
   * @param {UserProfile} userProfile - Профиль пользователя
   * @param {Object} ctx - Telegram context
   * @returns {string} Контекст
   */
  _buildContext(userProfile, ctx) {
    const registrationDays = Math.floor(
      (new Date() - userProfile.registeredAt) / (1000 * 60 * 60 * 24)
    );

    let context = `КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:\n`;
    context += `Имя: ${userProfile.name}\n`;
    context += `Email: ${userProfile.email}\n`;
    context += `Telegram: @${userProfile.telegramUsername || 'не указан'}\n`;
    context += `Зарегистрирован: ${userProfile.registeredAt.toLocaleDateString('ru-RU')} (${registrationDays} дней назад)\n`;
    context += `Всего цитат: ${userProfile.statistics.totalQuotes}\n`;
    context += `Текущая серия: ${userProfile.statistics.currentStreak} дней\n`;
    
    // Информация из теста
    if (userProfile.testResults) {
      context += `\nРЕЗУЛЬТАТЫ ПЕРВОНАЧАЛЬНОГО ТЕСТА:\n`;
      context += `Образ жизни: ${userProfile.testResults.question2_lifestyle || 'не указано'}\n`;
      context += `Время для себя: ${userProfile.testResults.question3_time || 'не указано'}\n`;
      context += `Приоритеты: ${userProfile.testResults.question4_priorities || 'не указано'}\n`;
      context += `Чувства при чтении: ${userProfile.testResults.question5_reading_feeling || 'не указано'}\n`;
      context += `Близкая фраза: ${userProfile.testResults.question6_phrase || 'не указано'}\n`;
      context += `Время чтения: ${userProfile.testResults.question7_reading_time || 'не указано'}\n`;
    }

    // Информация о предпочтениях
    if (userProfile.preferences && userProfile.preferences.mainThemes) {
      context += `\nИНТЕРЕСЫ:\n`;
      context += `Основные темы: ${userProfile.preferences.mainThemes.join(', ')}\n`;
    }

    // Источник трафика
    context += `\nИСТОЧНИК: ${userProfile.source}\n`;

    return context;
  }

  /**
   * Категоризация вопроса
   * @private
   * @param {string} message - Текст сообщения
   * @returns {string} Категория вопроса
   */
  _categorizeQuestion(message) {
    const lowerMessage = message.toLowerCase();

    if (this.isUrgentCase(message)) {
      return 'urgent_psychological';
    }

    if (lowerMessage.includes('отношения') || lowerMessage.includes('муж') || 
        lowerMessage.includes('жена') || lowerMessage.includes('семья')) {
      return 'relationships';
    }

    if (lowerMessage.includes('дети') || lowerMessage.includes('материнство') ||
        lowerMessage.includes('воспитание')) {
      return 'parenting';
    }

    if (lowerMessage.includes('работа') || lowerMessage.includes('карьера') ||
        lowerMessage.includes('профессия')) {
      return 'career';
    }

    if (lowerMessage.includes('самооценка') || lowerMessage.includes('уверенность') ||
        lowerMessage.includes('самопринятие')) {
      return 'self_esteem';
    }

    if (lowerMessage.includes('не работает') || lowerMessage.includes('ошибка') ||
        lowerMessage.includes('баг')) {
      return 'technical_issue';
    }

    return 'general_question';
  }

  /**
   * Построение ответа пользователю
   * @private
   * @param {UserProfile} userProfile - Профиль пользователя
   * @param {Object} ticket - Созданный тикет
   * @param {boolean} isUrgent - Срочный ли случай
   * @returns {string} Ответ пользователю
   */
  _buildUserResponse(userProfile, ticket, isUrgent) {
    let message = `📞 *Этот вопрос требует персонального внимания Анны.*\n\n`;
    
    if (isUrgent) {
      message += `🚨 *Ваше сообщение отмечено как срочное.*\n`;
      message += `Анна получит уведомление немедленно и постарается ответить как можно быстрее.\n\n`;
    } else {
      message += `Я передала ваше сообщение Анне, и она свяжется с вами в ближайшее время.\n\n`;
    }

    message += `*Ваши контакты для связи:*\n`;
    message += `📱 Telegram: @${userProfile.telegramUsername || 'контакт через бота'}\n`;
    message += `📧 Email: ${userProfile.email}\n\n`;

    message += `*Номер обращения:* \`${ticket.ticketId}\`\n\n`;

    if (isUrgent) {
      message += `💚 Анна понимает, что иногда нужна срочная поддержка. `;
      message += `Пожалуйста, позаботьтесь о себе, пока ждете ответа.\n\n`;
    }

    message += `Пока Анна готовит ответ, продолжайте собирать цитаты - `;
    message += `они помогают лучше понять себя и найти внутренние ресурсы.\n\n`;
    message += `📖 *Хватит сидеть в телефоне - читайте книги!*`;

    return message;
  }

  /**
   * Уведомление Анне о новом вопросе
   * @private
   * @param {Object} ticket - Созданный тикет
   * @param {UserProfile} userProfile - Профиль пользователя
   * @param {string} originalMessage - Исходное сообщение
   * @param {boolean} isUrgent - Срочный ли случай
   * @returns {Promise<void>}
   */
  async _notifyAnna(ticket, userProfile, originalMessage, isUrgent) {
    try {
      const urgencyIcon = isUrgent ? '🚨' : '📝';
      const urgencyText = isUrgent ? '*СРОЧНОЕ ОБРАЩЕНИЕ*' : 'Новое обращение';
      
      const adminNotification = `${urgencyIcon} *${urgencyText} пользователя*\n\n` +
        `*Билет:* \`${ticket.ticketId}\`\n` +
        `*От:* ${userProfile.name} (@${userProfile.telegramUsername || 'без_username'})\n` +
        `*Email:* ${userProfile.email}\n` +
        `*Категория:* ${this._getCategoryDisplayName(ticket.category)}\n\n` +
        `*Сообщение:*\n${originalMessage}\n\n` +
        `*Статистика пользователя:*\n` +
        `• Дата регистрации: ${userProfile.registeredAt.toLocaleDateString('ru-RU')}\n` +
        `• Всего цитат: ${userProfile.statistics.totalQuotes}\n` +
        `• Серия дней: ${userProfile.statistics.currentStreak}\n` +
        `• Источник: ${userProfile.source}\n\n` +
        `*Образ жизни:* ${userProfile.testResults?.question2_lifestyle || 'не указано'}\n` +
        `*Приоритеты:* ${userProfile.testResults?.question4_priorities || 'не указано'}`;

      // Отправка админу через Telegram (если настроен ADMIN_TELEGRAM_ID)
      if (process.env.ADMIN_TELEGRAM_ID) {
        const TelegramBot = require('../../telegram/index');
        const bot = new TelegramBot({ token: process.env.TELEGRAM_BOT_TOKEN });
        
        await bot.bot.telegram.sendMessage(
          process.env.ADMIN_TELEGRAM_ID,
          adminNotification,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📧 Открыть в админке", url: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/tickets/${ticket.ticketId}` }
                ],
                [
                  { text: "💬 Ответить через бота", callback_data: `reply_ticket_${ticket.ticketId}` }
                ]
              ]
            }
          }
        );
      }

      // Email уведомление (если настроен email сервис)
      if (process.env.SMTP_HOST && userProfile.email) {
        const emailSubject = isUrgent 
          ? `🚨 СРОЧНО: Новое обращение от ${userProfile.name}`
          : `📝 Новое обращение от ${userProfile.name}`;
          
        // Здесь должен быть вызов email сервиса
        // await emailService.sendNotification(process.env.ADMIN_EMAIL, emailSubject, ...);
      }

      logger.info(`📖 Admin notification sent for ticket ${ticket.ticketId}, urgent: ${isUrgent}`);
      
    } catch (error) {
      logger.error(`📖 Error sending admin notification: ${error.message}`);
    }
  }

  /**
   * Получить отображаемое название категории
   * @private
   * @param {string} category - Категория
   * @returns {string} Отображаемое название
   */
  _getCategoryDisplayName(category) {
    const categoryNames = {
      'urgent_psychological': '🚨 Срочная психологическая помощь',
      'relationships': '💕 Отношения',
      'parenting': '👶 Родительство',
      'career': '💼 Карьера',
      'self_esteem': '💪 Самооценка',
      'technical_issue': '🔧 Техническая проблема',
      'general_question': '❓ Общий вопрос'
    };

    return categoryNames[category] || '❓ Общий вопрос';
  }

  /**
   * Обработка ответа Анны через бота
   * @param {string} ticketId - ID тикета
   * @param {string} response - Ответ Анны
   * @returns {Promise<void>}
   */
  async handleAnnaResponse(ticketId, response) {
    try {
      // Получаем информацию о тикете
      const ticket = await ticketingService.getTicket(ticketId);
      if (!ticket) {
        logger.error(`📖 Ticket not found: ${ticketId}`);
        return;
      }

      // Отправляем ответ пользователю
      const TelegramBot = require('../../telegram/index');
      const bot = new TelegramBot({ token: process.env.TELEGRAM_BOT_TOKEN });

      const responseMessage = `💬 *Ответ от Анны Бусел:*\n\n${response}\n\n` +
        `_По тикету: ${ticketId}_\n\n` +
        `Если у вас есть дополнительные вопросы, просто напишите их здесь.`;

      await bot.bot.telegram.sendMessage(
        ticket.metadata.conversationId || ticket.userId,
        responseMessage,
        { parse_mode: 'Markdown' }
      );

      // Обновляем статус тикета
      await ticketingService.updateTicketStatus(ticketId, 'answered');

      logger.info(`📖 Anna's response sent for ticket ${ticketId}`);
      
    } catch (error) {
      logger.error(`📖 Error sending Anna's response: ${error.message}`);
    }
  }

  /**
   * Получить статистику обработки сложных вопросов
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      totalPatterns: this.complexQuestionPatterns.length,
      urgentKeywords: this.urgentKeywords.length,
      supportedCategories: [
        'urgent_psychological',
        'relationships', 
        'parenting',
        'career',
        'self_esteem',
        'technical_issue',
        'general_question'
      ],
      features: {
        automaticDetection: true,
        urgentCaseHandling: true,
        ticketCreation: true,
        adminNotifications: true,
        contextualAnalysis: true
      }
    };
  }

  /**
   * Обновить паттерны распознавания (для динамического обучения)
   * @param {Array<string>} newPatterns - Новые паттерны
   * @returns {void}
   */
  updatePatterns(newPatterns) {
    try {
      const patterns = newPatterns.map(pattern => new RegExp(pattern, 'i'));
      this.complexQuestionPatterns.push(...patterns);
      logger.info(`📖 Added ${newPatterns.length} new patterns for complex question detection`);
    } catch (error) {
      logger.error(`📖 Error updating patterns: ${error.message}`);
    }
  }
}

module.exports = { ComplexQuestionHandler };