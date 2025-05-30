/**
 * Сервис для управления сбором email адресов для тикетов
 * @file server/services/ticketEmail.js
 */

const logger = require('../utils/logger');
const TicketService = require('./ticketing');

/**
 * @typedef {Object} PendingTicket
 * @property {string} ticketId - ID созданного тикета
 * @property {string} userId - ID пользователя  
 * @property {string} conversationId - ID разговора
 * @property {Date} createdAt - Время создания
 * @property {Date} expiresAt - Время истечения
 */

/**
 * @class TicketEmailService
 * @description Сервис для управления процессом сбора email для тикетов
 */
class TicketEmailService {
  constructor() {
    /**
     * Временное хранилище неполных тикетов, ожидающих email
     * @type {Map<string, PendingTicket>}
     */
    this.pendingTickets = new Map();
    
    /**
     * Время ожидания email в миллисекундах (10 минут)
     * @type {number}
     */
    this.EMAIL_TIMEOUT = 10 * 60 * 1000;
    
    // Запускаем очистку просроченных тикетов каждую минуту
    this.startCleanupTimer();
  }

  /**
   * Проверяет, требует ли сообщение создания тикета
   * @param {string} message - Сообщение пользователя
   * @param {string} language - Язык сообщения
   * @returns {boolean} True если нужно создать тикет
   */
  shouldCreateTicket(message, language = 'en') {
    const lowerMessage = message.toLowerCase();
    
    logger.info(`🍄 DEBUG: Checking if message should create ticket: "${message.substring(0, 30)}..." (language: ${language})`);
    
    // Ключевые слова проблем на разных языках
    const problemKeywords = {
      en: [
        'error', 'bug', 'problem', 'issue', 'not work', 'broken', 'failed', 'stuck',
        'can\'t', 'cannot', 'unable', 'help', 'support', 'urgent', 'crash',
        'wallet', 'transaction', 'balance', 'staking', 'farming', 'not working',
        'doesn\'t work', 'trouble', 'difficulty'
      ],
      ru: [
        'ошибка', 'баг', 'проблема', 'не работает', 'сломано', 'неисправность',
        'не могу', 'не получается', 'помощь', 'поддержка', 'срочно', 'авария',
        'кошелек', 'транзакция', 'баланс', 'стейкинг', 'фарминг', 'сбой',
        'не функционирует', 'неполадка'
      ],
      es: [
        'error', 'problema', 'fallo', 'roto', 'no funciona', 'ayuda', 'soporte',
        'urgente', 'billetera', 'transacción', 'balance', 'staking', 'farming',
        'no trabajo', 'dificultad'
      ]
    };

    const keywords = problemKeywords[language] || problemKeywords.en;
    
    // Проверяем наличие ключевых слов
    const hasKeywords = keywords.some(keyword => lowerMessage.includes(keyword));
    
    // Дополнительные проверки
    const hasQuestionMark = message.includes('?');
    const isLongMessage = message.length > 50; // Длинные сообщения часто содержат описания проблем
    const hasCriticalWords = ['urgent', 'help', 'срочно', 'помощь', 'ayuda'].some(word => 
      lowerMessage.includes(word)
    );
    
    const shouldCreate = hasKeywords || hasCriticalWords || (hasQuestionMark && isLongMessage);
    
    logger.info(`🍄 DEBUG: shouldCreateTicket result: ${shouldCreate} (hasKeywords: ${hasKeywords}, hasCriticalWords: ${hasCriticalWords}, hasQuestionMark: ${hasQuestionMark}, isLongMessage: ${isLongMessage})`);
    
    return shouldCreate;
  }

  /**
   * Создает тикет без email и добавляет его в ожидание
   * @param {Object} ticketData - Данные для создания тикета
   * @returns {Promise<Object>} Результат создания тикета
   */
  async createPendingTicket(ticketData) {
    try {
      logger.info(`🍄 DEBUG: Creating pending ticket for user ${ticketData.userId}`);
      
      // Создаем тикет без email со статусом open
      const ticket = await TicketService.createTicket({
        ...ticketData,
        email: null, // Специально не указываем email
        status: 'open', // Стандартный статус
        metadata: {
          ...ticketData.metadata,
          pendingEmail: true, // Помечаем что ожидаем email
          emailRequested: true,
          source: 'telegram'
        }
      });

      logger.info(`🍄 DEBUG: Ticket created with ID: ${ticket.ticketId}`);

      // Добавляем в временное хранилище
      const pendingTicket = {
        ticketId: ticket.ticketId, // Используем ticketId из созданного тикета
        userId: ticketData.userId,
        conversationId: ticketData.conversationId,
        mongoId: ticket._id, // Сохраняем MongoDB ID для обновлений
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.EMAIL_TIMEOUT)
      };

      this.pendingTickets.set(ticketData.userId, pendingTicket);
      
      logger.info(`🍄 Pending ticket created: ${ticket.ticketId} for user ${ticketData.userId} (expires in ${this.EMAIL_TIMEOUT/60000} minutes)`);
      
      return {
        success: true,
        ticket: {
          ticketId: ticket.ticketId, // Возвращаем правильный ticketId
          _id: ticket._id,
          userId: ticket.userId,
          subject: ticket.subject,
          status: ticket.status
        },
        pendingEmail: true,
        message: this.getEmailRequestMessage(ticketData.language)
      };
    } catch (error) {
      logger.error(`🍄 ERROR: Failed to create pending ticket: ${error.message}`);
      logger.error(`🍄 ERROR stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Проверяет, является ли сообщение email адресом
   * @param {string} message - Сообщение пользователя
   * @returns {boolean} True если это email
   */
  isEmailMessage(message) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedMessage = message.trim();
    
    // Проверяем на точное соответствие email
    const isExactEmail = emailRegex.test(trimmedMessage);
    
    // Или если это короткое сообщение содержащее @
    const isPotentialEmail = trimmedMessage.length < 50 && trimmedMessage.includes('@') && trimmedMessage.includes('.');
    
    logger.info(`🍄 DEBUG: isEmailMessage("${trimmedMessage}"): ${isExactEmail || isPotentialEmail}`);
    
    return isExactEmail || isPotentialEmail;
  }

  /**
   * Извлекает email из сообщения
   * @param {string} message - Сообщение содержащее email
   * @returns {string|null} Email адрес или null
   */
  extractEmail(message) {
    // Более строгая регулярка для email
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const trimmedMessage = message.trim();
    
    // Сначала проверяем, является ли все сообщение email
    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (simpleEmailRegex.test(trimmedMessage)) {
      const email = trimmedMessage.toLowerCase();
      logger.info(`🍄 DEBUG: Extracted email (full message): ${email}`);
      return email;
    }
    
    // Затем ищем email в тексте
    const match = trimmedMessage.match(emailRegex);
    if (match) {
      const email = match[1].toLowerCase();
      logger.info(`🍄 DEBUG: Extracted email (from text): ${email}`);
      return email;
    }
    
    logger.info(`🍄 DEBUG: No valid email found in message: "${trimmedMessage}"`);
    return null;
  }

  /**
   * Обновляет тикет с полученным email
   * @param {string} userId - ID пользователя
   * @param {string} email - Email адрес
   * @param {string} language - Язык пользователя
   * @returns {Promise<Object>} Результат обновления
   */
  async updateTicketWithEmail(userId, email, language = 'en') {
    try {
      const pendingTicket = this.pendingTickets.get(userId);
      
      logger.info(`🍄 DEBUG: Updating ticket with email for user ${userId}, pendingTicket exists: ${!!pendingTicket}`);
      
      if (!pendingTicket) {
        logger.warn(`🍄 WARNING: No pending ticket found for user: ${userId}`);
        return {
          success: false,
          message: 'No pending ticket found. Please create a new support request.'
        };
      }

      // Проверяем не истек ли тикет
      if (new Date() > pendingTicket.expiresAt) {
        this.pendingTickets.delete(userId);
        logger.warn(`🍄 WARNING: Pending ticket expired for user: ${userId}, ticketId: ${pendingTicket.ticketId}`);
        return {
          success: false,
          message: 'Ticket request expired. Please create a new support request.'
        };
      }

      logger.info(`🍄 DEBUG: Updating ticket ${pendingTicket.ticketId} with email: ${email}`);

      // Обновляем тикет с email используя MongoDB ID
      const updatedTicket = await TicketService.updateTicketById(
        pendingTicket.mongoId, 
        {
          email: email,
          'metadata.pendingEmail': false,
          'metadata.emailCollected': true,
          'metadata.emailCollectedAt': new Date()
        }
      );

      if (updatedTicket) {
        // Удаляем из ожидающих
        this.pendingTickets.delete(userId);
        
        logger.info(`🍄 SUCCESS: Email collected for ticket: ${pendingTicket.ticketId} - ${email}`);
        
        return {
          success: true,
          ticket: updatedTicket,
          ticketId: pendingTicket.ticketId,
          message: this.getEmailConfirmationMessage(language, pendingTicket.ticketId)
        };
      } else {
        logger.error(`🍄 ERROR: Failed to update ticket in database: ${pendingTicket.ticketId}`);
        return {
          success: false,
          message: 'Failed to update ticket with email. Please try again.'
        };
      }
    } catch (error) {
      logger.error(`🍄 ERROR: Error updating ticket with email: ${error.message}`);
      logger.error(`🍄 ERROR stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Проверяет есть ли у пользователя тикет в ожидании email
   * @param {string} userId - ID пользователя
   * @returns {PendingTicket|null} Тикет в ожидании или null
   */
  getPendingTicket(userId) {
    const pendingTicket = this.pendingTickets.get(userId);
    
    if (pendingTicket && new Date() > pendingTicket.expiresAt) {
      // Удаляем просроченный тикет
      this.pendingTickets.delete(userId);
      logger.info(`🍄 Removed expired pending ticket for user ${userId}: ${pendingTicket.ticketId}`);
      return null;
    }
    
    return pendingTicket;
  }

  /**
   * Получает сообщение-запрос email на нужном языке
   * @param {string} language - Язык сообщения
   * @returns {string} Сообщение запроса email
   */
  getEmailRequestMessage(language = 'en') {
    const messages = {
      en: "🎫 *Support ticket created!*\n\nTo help our mushroom experts reach you, please share your email address:\n\n_Or send /cancel to cancel_",
      ru: "🎫 *Тикет поддержки создан!*\n\nЧтобы наши грибные эксперты смогли с тобой связаться, поделись своим email адресом:\n\n_Или отправь /cancel для отмены_",
      es: "🎫 *¡Ticket de soporte creado!*\n\nPara que nuestros expertos en hongos puedan contactarte, comparte tu dirección de email:\n\n_O envía /cancel para cancelar_"
    };
    
    return messages[language] || messages.en;
  }

  /**
   * Получает сообщение подтверждения получения email
   * @param {string} language - Язык сообщения  
   * @param {string} ticketId - ID тикета для отображения
   * @returns {string} Сообщение подтверждения
   */
  getEmailConfirmationMessage(language = 'en', ticketId = '') {
    const messages = {
      en: `✅ *Perfect!* Your support ticket \`${ticketId}\` has been updated with your email.\n\nOur mushroom experts will contact you within 24 hours. Your spores are in good hands! 🍄`,
      ru: `✅ *Отлично!* Тикет поддержки \`${ticketId}\` обновлен с твоим email.\n\nНаши грибные эксперты свяжутся с тобой в течение 24 часов. Твои споры в надежных руках! 🍄`,
      es: `✅ *¡Perfecto!* Tu ticket de soporte \`${ticketId}\` ha sido actualizado con tu email.\n\nNuestros expertos en hongos te contactarán dentro de 24 horas. ¡Tus esporas están en buenas manos! 🍄`
    };
    
    return messages[language] || messages.en;
  }

  /**
   * Запускает таймер очистки просроченных тикетов
   * @private
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredTickets();
    }, 60000); // Каждую минуту
  }

  /**
   * Очищает просроченные тикеты из памяти
   * @private
   */
  cleanupExpiredTickets() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [userId, pendingTicket] of this.pendingTickets.entries()) {
      if (now > pendingTicket.expiresAt) {
        this.pendingTickets.delete(userId);
        cleanedCount++;
        logger.info(`🍄 Cleaned up expired pending ticket: ${pendingTicket.ticketId} for user ${userId}`);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`🍄 Cleaned up ${cleanedCount} expired pending tickets`);
    }
  }

  /**
   * Получает статистику по ожидающим тикетам
   * @returns {Object} Статистика
   */
  getPendingTicketsStats() {
    const now = new Date();
    let active = 0;
    let expired = 0;
    
    for (const pendingTicket of this.pendingTickets.values()) {
      if (now > pendingTicket.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.pendingTickets.size,
      active,
      expired,
      timeout: this.EMAIL_TIMEOUT / 1000 // в секундах
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new TicketEmailService();