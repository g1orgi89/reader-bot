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
     * Время ожидания email в миллисекундах (5 минут)
     * @type {number}
     */
    this.EMAIL_TIMEOUT = 5 * 60 * 1000;
    
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
    
    // Ключевые слова проблем на разных языках
    const problemKeywords = {
      en: [
        'error', 'bug', 'problem', 'issue', 'not work', 'broken', 'failed', 'stuck',
        'can\'t', 'cannot', 'unable', 'help', 'support', 'urgent', 'crash',
        'wallet', 'transaction', 'balance', 'staking', 'farming'
      ],
      ru: [
        'ошибка', 'баг', 'проблема', 'не работает', 'сломано', 'неисправность',
        'не могу', 'не получается', 'помощь', 'поддержка', 'срочно', 'авария',
        'кошелек', 'транзакция', 'баланс', 'стейкинг', 'фарминг'
      ],
      es: [
        'error', 'problema', 'fallo', 'roto', 'no funciona', 'ayuda', 'soporte',
        'urgente', 'billetera', 'transacción', 'balance', 'staking', 'farming'
      ]
    };

    const keywords = problemKeywords[language] || problemKeywords.en;
    
    // Проверяем наличие ключевых слов
    const hasKeywords = keywords.some(keyword => lowerMessage.includes(keyword));
    
    // Дополнительные проверки
    const hasQuestionMark = message.includes('?');
    const isLongMessage = message.length > 50; // Длинные сообщения часто содержат описания проблем
    
    return hasKeywords || (hasQuestionMark && isLongMessage);
  }

  /**
   * Создает тикет без email и добавляет его в ожидание
   * @param {Object} ticketData - Данные для создания тикета
   * @returns {Promise<Object>} Результат создания тикета
   */
  async createPendingTicket(ticketData) {
    try {
      // Создаем тикет без email со статусом pending_email
      const ticket = await TicketService.createTicket({
        ...ticketData,
        email: null, // Специально не указываем email
        status: 'open', // Оставляем стандартный статус
        metadata: {
          ...ticketData.metadata,
          pendingEmail: true, // Помечаем что ожидаем email
          emailRequested: true
        }
      });

      // Добавляем в временное хранилище
      const pendingTicket = {
        ticketId: ticket.ticketId,
        userId: ticketData.userId,
        conversationId: ticketData.conversationId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.EMAIL_TIMEOUT)
      };

      this.pendingTickets.set(ticketData.userId, pendingTicket);
      
      logger.info(`Pending ticket created: ${ticket.ticketId} for user ${ticketData.userId}`);
      
      return {
        success: true,
        ticket,
        pendingEmail: true,
        message: this.getEmailRequestMessage(ticketData.language)
      };
    } catch (error) {
      logger.error(`Error creating pending ticket: ${error.message}`);
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
    
    // Проверяем на точное соответствие email или содержание email в коротком сообщении
    return emailRegex.test(trimmedMessage) || 
           (trimmedMessage.length < 50 && trimmedMessage.includes('@'));
  }

  /**
   * Извлекает email из сообщения
   * @param {string} message - Сообщение содержащее email
   * @returns {string|null} Email адрес или null
   */
  extractEmail(message) {
    const emailRegex = /([^\s@]+@[^\s@]+\.[^\s@]+)/;
    const match = message.match(emailRegex);
    return match ? match[1].toLowerCase() : null;
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
      
      if (!pendingTicket) {
        logger.warn(`No pending ticket found for user: ${userId}`);
        return {
          success: false,
          message: 'No pending ticket found'
        };
      }

      // Проверяем не истек ли тикет
      if (new Date() > pendingTicket.expiresAt) {
        this.pendingTickets.delete(userId);
        logger.warn(`Pending ticket expired for user: ${userId}`);
        return {
          success: false,
          message: 'Ticket request expired. Please create a new support request.'
        };
      }

      // Обновляем тикет с email
      const updatedTicket = await TicketService.updateTicketByTicketId(
        pendingTicket.ticketId, 
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
        
        logger.info(`Email collected for ticket: ${pendingTicket.ticketId} - ${email}`);
        
        return {
          success: true,
          ticket: updatedTicket,
          message: this.getEmailConfirmationMessage(language)
        };
      } else {
        logger.error(`Failed to update ticket: ${pendingTicket.ticketId}`);
        return {
          success: false,
          message: 'Failed to update ticket with email'
        };
      }
    } catch (error) {
      logger.error(`Error updating ticket with email: ${error.message}`);
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
      en: "🎫 I've created a support ticket for you! To help our mushroom experts reach you, please share your email address:",
      ru: "🎫 Я создал тикет поддержки для тебя! Чтобы наши грибные эксперты смогли с тобой связаться, поделись своим email адресом:",
      es: "🎫 ¡He creado un ticket de soporte para ti! Para que nuestros expertos en hongos puedan contactarte, comparte tu dirección de email:"
    };
    
    return messages[language] || messages.en;
  }

  /**
   * Получает сообщение подтверждения получения email
   * @param {string} language - Язык сообщения  
   * @returns {string} Сообщение подтверждения
   */
  getEmailConfirmationMessage(language = 'en') {
    const messages = {
      en: "✅ Perfect! Your ticket has been updated with your email. Our mushroom experts will contact you within 24 hours. Your spores are in good hands! 🍄",
      ru: "✅ Отлично! Тикет обновлен с твоим email. Наши грибные эксперты свяжутся с тобой в течение 24 часов. Твои споры в надежных руках! 🍄",
      es: "✅ ¡Perfecto! Tu ticket ha sido actualizado con tu email. Nuestros expertos en hongos te contactarán dentro de 24 horas. ¡Tus esporas están en buenas manos! 🍄"
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
        logger.info(`Cleaned up expired pending ticket: ${pendingTicket.ticketId}`);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired pending tickets`);
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