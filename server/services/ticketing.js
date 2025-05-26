/**
 * Сервис для управления тикетами поддержки
 * @file server/services/ticketing.js
 */

const Ticket = require('../models/ticket');
const logger = require('../utils/logger');

/**
 * @typedef {Object} TicketFilter
 * @property {string} [status] - Статус тикета
 * @property {string} [priority] - Приоритет тикета
 * @property {string} [category] - Категория тикета
 * @property {string} [assignedTo] - Ответственный за тикет
 * @property {Object} [$or] - Условия поиска
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} page - Номер страницы
 * @property {number} limit - Количество элементов на странице
 * @property {string} sort - Поле для сортировки
 * @property {string} populate - Поля для популяции
 */

/**
 * @typedef {Object} TicketData
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} subject - Тема тикета
 * @property {string} initialMessage - Первоначальное сообщение
 * @property {string} [context] - Контекст разговора
 * @property {string} [priority] - Приоритет (low, medium, high, urgent)
 * @property {string} [category] - Категория (technical, account, billing, feature, other)
 * @property {string} [language] - Язык (en, es, ru)
 * @property {string} [email] - Email пользователя
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @class TicketService
 * @description Сервис для работы с тикетами поддержки
 */
class TicketService {
  /**
   * Генерирует уникальный ID тикета
   * @private
   * @returns {string} Уникальный ID тикета
   */
  generateTicketId() {
    const prefix = 'SHRM';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Создает новый тикет поддержки
   * @param {TicketData} ticketData - Данные для создания тикета
   * @returns {Promise<Object>} Созданный тикет
   */
  async createTicket(ticketData) {
    try {
      // Генерируем уникальный ID тикета
      const ticketId = this.generateTicketId();

      // Подготавливаем данные тикета
      const ticket = new Ticket({
        ticketId,
        userId: ticketData.userId,
        conversationId: ticketData.conversationId,
        subject: ticketData.subject,
        initialMessage: ticketData.initialMessage,
        context: ticketData.context || '',
        priority: ticketData.priority || 'medium',
        category: ticketData.category || 'technical',
        language: ticketData.language || 'en',
        email: ticketData.email,
        metadata: {
          source: ticketData.metadata?.source || 'api',
          tags: ticketData.metadata?.tags || [],
          createdBy: ticketData.metadata?.createdBy,
          ...ticketData.metadata
        },
        sla: {
          breached: false,
          responseTime: this.calculateSLAResponseTime(ticketData.priority),
          resolutionTime: this.calculateSLAResolutionTime(ticketData.priority)
        }
      });

      const savedTicket = await ticket.save();
      
      // Популируем данные разговора
      await savedTicket.populate('conversationId');
      
      logger.info(`Ticket created: ${ticketId} for user ${ticketData.userId}`);
      return savedTicket;
    } catch (error) {
      logger.error(`Error creating ticket: ${error.message}`);
      throw new Error(`Failed to create ticket: ${error.message}`);
    }
  }

  /**
   * Получает список тикетов с фильтрацией и пагинацией
   * @param {TicketFilter} filters - Фильтры для поиска
   * @param {PaginationOptions} options - Опции пагинации и сортировки
   * @returns {Promise<Object>} Список тикетов с метаданными пагинации
   */
  async getTickets(filters = {}, options = {}) {
    try {
      const page = Math.max(1, parseInt(options.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 10));
      const skip = (page - 1) * limit;
      const sort = options.sort || '-createdAt';

      // Строим запрос
      let query = Ticket.find(filters);

      // Применяем популяцию
      if (options.populate) {
        query = query.populate(options.populate);
      }

      // Подсчитываем общее количество
      const totalCount = await Ticket.countDocuments(filters);

      // Применяем сортировку, пагинацию и выполняем запрос
      const tickets = await query
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      // Рассчитываем метаданные пагинации
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        tickets,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      };
    } catch (error) {
      logger.error(`Error fetching tickets: ${error.message}`);
      throw new Error(`Failed to fetch tickets: ${error.message}`);
    }
  }

  /**
   * Получает тикет по его ID (MongoDB ObjectId)
   * @param {string} id - MongoDB ObjectId тикета
   * @returns {Promise<Object|null>} Тикет или null
   */
  async getTicketById(id) {
    try {
      const ticket = await Ticket.findById(id).populate('conversationId');
      return ticket;
    } catch (error) {
      logger.error(`Error fetching ticket by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Получает тикет по его читаемому ID
   * @param {string} ticketId - Читаемый ID тикета (например, SHRM...)
   * @returns {Promise<Object|null>} Тикет или null
   */
  async getTicketByTicketId(ticketId) {
    try {
      const ticket = await Ticket.findOne({ ticketId }).populate('conversationId');
      return ticket;
    } catch (error) {
      logger.error(`Error fetching ticket by ticketId ${ticketId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Обновляет тикет по MongoDB ObjectId
   * @param {string} id - MongoDB ObjectId тикета
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object|null>} Обновленный тикет или null
   */
  async updateTicketById(id, updateData) {
    try {
      const ticket = await Ticket.findByIdAndUpdate(
        id,
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      ).populate('conversationId');

      if (ticket) {
        logger.info(`Ticket updated: ${ticket.ticketId}`);
      }

      return ticket;
    } catch (error) {
      logger.error(`Error updating ticket by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Обновляет тикет по читаемому ID
   * @param {string} ticketId - Читаемый ID тикета
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object|null>} Обновленный тикет или null
   */
  async updateTicketByTicketId(ticketId, updateData) {
    try {
      const ticket = await Ticket.findOneAndUpdate(
        { ticketId },
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      ).populate('conversationId');

      if (ticket) {
        logger.info(`Ticket updated: ${ticket.ticketId}`);
      }

      return ticket;
    } catch (error) {
      logger.error(`Error updating ticket by ticketId ${ticketId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Добавляет комментарий к тикету по MongoDB ObjectId
   * @param {string} id - MongoDB ObjectId тикета
   * @param {Object} comment - Данные комментария
   * @returns {Promise<Object|null>} Обновленный тикет или null
   */
  async addCommentById(id, comment) {
    try {
      // Используем метод addComment из модели для корректного добавления
      const ticket = await Ticket.findById(id).populate('conversationId');
      
      if (!ticket) {
        return null;
      }

      // Добавляем комментарий и сохраняем
      await ticket.addComment(comment);
      
      logger.info(`Comment added to ticket: ${ticket.ticketId} by ${comment.authorId}`);
      return ticket;
    } catch (error) {
      logger.error(`Error adding comment to ticket by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Добавляет комментарий к тикету по читаемому ID
   * @param {string} ticketId - Читаемый ID тикета
   * @param {Object} comment - Данные комментария
   * @returns {Promise<Object|null>} Обновленный тикет или null
   */
  async addCommentByTicketId(ticketId, comment) {
    try {
      // Используем метод addComment из модели для корректного добавления
      const ticket = await Ticket.findOne({ ticketId }).populate('conversationId');
      
      if (!ticket) {
        return null;
      }

      // Добавляем комментарий и сохраняем
      await ticket.addComment(comment);
      
      logger.info(`Comment added to ticket: ${ticket.ticketId} by ${comment.authorId}`);
      return ticket;
    } catch (error) {
      logger.error(`Error adding comment to ticket by ticketId ${ticketId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Закрывает тикет по MongoDB ObjectId
   * @param {string} id - MongoDB ObjectId тикета
   * @param {string} resolution - Причина закрытия
   * @param {string} [closedBy] - Кто закрыл тикет
   * @returns {Promise<Object|null>} Закрытый тикет или null
   */
  async closeTicketById(id, resolution, closedBy) {
    try {
      const ticket = await Ticket.findById(id).populate('conversationId');
      
      if (!ticket) {
        return null;
      }

      // Используем метод close из модели
      await ticket.close(resolution, closedBy, req.user?.name || 'Administrator');
      
      logger.info(`Ticket closed: ${ticket.ticketId}`);
      return ticket;
    } catch (error) {
      logger.error(`Error closing ticket by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Закрывает тикет по читаемому ID
   * @param {string} ticketId - Читаемый ID тикета
   * @param {string} resolution - Причина закрытия
   * @param {string} [closedBy] - Кто закрыл тикет
   * @returns {Promise<Object|null>} Закрытый тикет или null
   */
  async closeTicketByTicketId(ticketId, resolution, closedBy) {
    try {
      const ticket = await Ticket.findOne({ ticketId }).populate('conversationId');
      
      if (!ticket) {
        return null;
      }

      // Используем метод close из модели
      await ticket.close(resolution, closedBy, 'Administrator');
      
      logger.info(`Ticket closed: ${ticket.ticketId}`);
      return ticket;
    } catch (error) {
      logger.error(`Error closing ticket by ticketId ${ticketId}: ${error.message}`);
      return null;
    }
  }

  /**
   * ФИЗИЧЕСКИ УДАЛЯЕТ тикет по MongoDB ObjectId
   * ⚠️ НЕОБРАТИМАЯ ОПЕРАЦИЯ - тикет будет полностью удален из базы данных
   * @param {string} id - MongoDB ObjectId тикета
   * @param {string} [deletedBy] - Кто удалил тикет (для логирования)
   * @returns {Promise<Object|null>} Удаленный тикет или null
   */
  async deleteTicketById(id, deletedBy = 'Administrator') {
    try {
      // Сначала получаем тикет для логирования
      const ticket = await Ticket.findById(id).populate('conversationId');
      
      if (!ticket) {
        logger.warn(`Attempt to delete non-existent ticket by ID: ${id}`);
        return null;
      }

      // Сохраняем информацию о тикете для логирования
      const ticketInfo = {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        userId: ticket.userId,
        status: ticket.status,
        createdAt: ticket.createdAt
      };

      // ФИЗИЧЕСКИ УДАЛЯЕМ тикет из базы данных
      const deletedTicket = await Ticket.findByIdAndDelete(id);
      
      if (deletedTicket) {
        logger.info(`🗑️ Ticket PERMANENTLY DELETED: ${ticketInfo.ticketId} by ${deletedBy}`, {
          ticketInfo,
          deletedBy,
          deletedAt: new Date().toISOString()
        });
      }

      return deletedTicket;
    } catch (error) {
      logger.error(`Error deleting ticket by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * ФИЗИЧЕСКИ УДАЛЯЕТ тикет по читаемому ID
   * ⚠️ НЕОБРАТИМАЯ ОПЕРАЦИЯ - тикет будет полностью удален из базы данных
   * @param {string} ticketId - Читаемый ID тикета (например, SHRM...)
   * @param {string} [deletedBy] - Кто удалил тикет (для логирования)
   * @returns {Promise<Object|null>} Удаленный тикет или null
   */
  async deleteTicketByTicketId(ticketId, deletedBy = 'Administrator') {
    try {
      // Сначала получаем тикет для логирования
      const ticket = await Ticket.findOne({ ticketId }).populate('conversationId');
      
      if (!ticket) {
        logger.warn(`Attempt to delete non-existent ticket by ticketId: ${ticketId}`);
        return null;
      }

      // Сохраняем информацию о тикете для логирования
      const ticketInfo = {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        userId: ticket.userId,
        status: ticket.status,
        createdAt: ticket.createdAt
      };

      // ФИЗИЧЕСКИ УДАЛЯЕМ тикет из базы данных
      const deletedTicket = await Ticket.findOneAndDelete({ ticketId });
      
      if (deletedTicket) {
        logger.info(`🗑️ Ticket PERMANENTLY DELETED: ${ticketInfo.ticketId} by ${deletedBy}`, {
          ticketInfo,
          deletedBy,
          deletedAt: new Date().toISOString()
        });
      }

      return deletedTicket;
    } catch (error) {
      logger.error(`Error deleting ticket by ticketId ${ticketId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Получает статистику по тикетам
   * @returns {Promise<Object>} Статистика тикетов
   */
  async getTicketStats() {
    try {
      const stats = await Ticket.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { 
              $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
            },
            inProgress: { 
              $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
            },
            resolved: { 
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
            },
            closed: { 
              $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
            },
            high: { 
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
            },
            urgent: { 
              $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            byStatus: {
              open: '$open',
              inProgress: '$inProgress',
              resolved: '$resolved',
              closed: '$closed'
            },
            byPriority: {
              high: '$high',
              urgent: '$urgent'
            }
          }
        }
      ]);

      // Статистика по категориям
      const categoryStats = await Ticket.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Статистика по языкам
      const languageStats = await Ticket.aggregate([
        {
          $group: {
            _id: '$language',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return {
        overview: stats[0] || {
          total: 0,
          byStatus: { open: 0, inProgress: 0, resolved: 0, closed: 0 },
          byPriority: { high: 0, urgent: 0 }
        },
        byCategory: categoryStats,
        byLanguage: languageStats
      };
    } catch (error) {
      logger.error(`Error fetching ticket stats: ${error.message}`);
      throw new Error(`Failed to fetch ticket statistics: ${error.message}`);
    }
  }

  /**
   * Рассчитывает время ответа SLA на основе приоритета
   * @private
   * @param {string} priority - Приоритет тикета
   * @returns {number} Время в минутах
   */
  calculateSLAResponseTime(priority) {
    const slaMap = {
      urgent: 15,    // 15 минут
      high: 60,      // 1 час
      medium: 240,   // 4 часа
      low: 1440      // 24 часа
    };

    return slaMap[priority] || slaMap.medium;
  }

  /**
   * Рассчитывает время разрешения SLA на основе приоритета
   * @private
   * @param {string} priority - Приоритет тикета
   * @returns {number} Время в минутах
   */
  calculateSLAResolutionTime(priority) {
    const slaMap = {
      urgent: 120,    // 2 часа
      high: 480,      // 8 часов
      medium: 1440,   // 1 день
      low: 2880       // 2 дня
    };

    return slaMap[priority] || slaMap.medium;
  }

  /**
   * Проверяет нарушения SLA для всех открытых тикетов
   * @returns {Promise<Array>} Список тикетов с нарушениями SLA
   */
  async checkSLAViolations() {
    try {
      const openTickets = await Ticket.find({
        status: { $in: ['open', 'in_progress'] },
        'sla.breached': false
      });

      const violations = [];
      const now = new Date();

      for (const ticket of openTickets) {
        const createdAt = new Date(ticket.createdAt);
        const minutesPassed = Math.floor((now - createdAt) / (1000 * 60));
        
        // Проверяем нарушение времени ответа
        if (minutesPassed > ticket.sla.responseTime) {
          violations.push({
            ...ticket.toObject(),
            violationType: 'response',
            minutesOverdue: minutesPassed - ticket.sla.responseTime
          });
          
          // Помечаем тикет как нарушивший SLA
          await Ticket.findByIdAndUpdate(ticket._id, {
            'sla.breached': true,
            'sla.breachedAt': now
          });
        }
      }

      return violations;
    } catch (error) {
      logger.error(`Error checking SLA violations: ${error.message}`);
      throw new Error(`Failed to check SLA violations: ${error.message}`);
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new TicketService();