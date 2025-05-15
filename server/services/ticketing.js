/**
 * Сервис для работы с тикетами поддержки
 * @file server/services/ticketing.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Схема тикета
 */
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['technical', 'account', 'billing', 'feature', 'other'],
    default: 'other'
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  context: {
    type: String
  },
  email: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: String
  },
  resolution: {
    type: String
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en'
  },
  metadata: {
    source: {
      type: String,
      enum: ['http', 'socket', 'telegram'],
      default: 'http'
    },
    userAgent: String,
    ip: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации запросов
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ status: 1, priority: -1, createdAt: 1 });
ticketSchema.index({ userId: 1, status: 1 });

// Модель тикета
const Ticket = mongoose.model('Ticket', ticketSchema);

/**
 * @class TicketingService
 * @description Сервис для работы с тикетами поддержки
 */
class TicketingService {
  /**
   * Генерирует уникальный ID для тикета
   * @returns {string} Уникальный ID тикета
   */
  generateTicketId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SHR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Создает новый тикет поддержки
   * @param {Object} ticketData - Данные тикета
   * @param {string} ticketData.userId - ID пользователя
   * @param {string} ticketData.conversationId - ID разговора
   * @param {string} ticketData.message - Сообщение/вопрос
   * @param {string} [ticketData.subject] - Тема тикета
   * @param {string} [ticketData.category] - Категория тикета
   * @param {string} [ticketData.language] - Язык обращения
   * @param {string} [ticketData.context] - Контекст разговора
   * @param {Object} [ticketData.metadata] - Дополнительные метаданные
   * @returns {Promise<Object>} Созданный тикет
   */
  async createTicket(ticketData) {
    try {
      const ticketId = this.generateTicketId();
      
      const ticket = new Ticket({
        ticketId,
        userId: ticketData.userId,
        conversationId: ticketData.conversationId,
        message: ticketData.message,
        subject: ticketData.subject || `Support request from ${ticketData.userId}`,
        category: ticketData.category || 'other',
        language: ticketData.language || 'en',
        context: ticketData.context,
        metadata: ticketData.metadata || {}
      });
      
      await ticket.save();
      
      logger.info(`Ticket created: ${ticketId} for user ${ticketData.userId}`);
      return ticket;
    } catch (error) {
      logger.error('Error creating ticket:', error);
      throw new Error(`Failed to create ticket: ${error.message}`);
    }
  }

  /**
   * Получает тикет по ID
   * @param {string} ticketId - ID тикета
   * @returns {Promise<Object|null>} Тикет или null
   */
  async getTicketById(ticketId) {
    try {
      const ticket = await Ticket.findOne({ ticketId })
        .populate('conversationId')
        .exec();
      return ticket;
    } catch (error) {
      logger.error('Error getting ticket by ID:', error);
      throw new Error(`Failed to get ticket: ${error.message}`);
    }
  }

  /**
   * Получает список тикетов с фильтрацией
   * @param {Object} [filters] - Параметры фильтрации
   * @param {string} [filters.status] - Фильтр по статусу
   * @param {string} [filters.userId] - Фильтр по пользователю
   * @param {string} [filters.assignedTo] - Фильтр по назначенному
   * @param {string} [filters.category] - Фильтр по категории
   * @param {Object} [pagination] - Параметры пагинации
   * @param {number} [pagination.page=1] - Номер страницы
   * @param {number} [pagination.limit=20] - Количество на странице
   * @returns {Promise<Object>} Объект с тикетами и метаданными
   */
  async getTickets(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const query = {};
      
      // Применяем фильтры
      if (filters.status) query.status = filters.status;
      if (filters.userId) query.userId = filters.userId;
      if (filters.assignedTo) query.assignedTo = filters.assignedTo;
      if (filters.category) query.category = filters.category;
      
      // Получаем тикеты с пагинацией
      const [tickets, totalCount] = await Promise.all([
        Ticket.find(query)
          .sort({ createdAt: -1 })
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .populate('conversationId')
          .exec(),
        Ticket.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        tickets,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting tickets:', error);
      throw new Error(`Failed to get tickets: ${error.message}`);
    }
  }

  /**
   * Обновляет тикет
   * @param {string} ticketId - ID тикета
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} Обновленный тикет
   */
  async updateTicket(ticketId, updateData) {
    try {
      const ticket = await Ticket.findOneAndUpdate(
        { ticketId },
        updateData,
        { new: true }
      );
      
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      
      logger.info(`Ticket updated: ${ticketId}`);
      return ticket;
    } catch (error) {
      logger.error('Error updating ticket:', error);
      throw new Error(`Failed to update ticket: ${error.message}`);
    }
  }

  /**
   * Изменяет статус тикета
   * @param {string} ticketId - ID тикета
   * @param {string} status - Новый статус
   * @param {string} [assignedTo] - Кому назначен тикет
   * @returns {Promise<Object>} Обновленный тикет
   */
  async updateTicketStatus(ticketId, status, assignedTo) {
    try {
      const updateData = { status };
      if (assignedTo) updateData.assignedTo = assignedTo;
      
      const ticket = await this.updateTicket(ticketId, updateData);
      
      logger.info(`Ticket ${ticketId} status changed to ${status}`);
      return ticket;
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      throw error;
    }
  }

  /**
   * Закрывает тикет с указанием причины
   * @param {string} ticketId - ID тикета
   * @param {string} resolution - Причина закрытия
   * @returns {Promise<Object>} Закрытый тикет
   */
  async closeTicket(ticketId, resolution) {
    try {
      const ticket = await this.updateTicket(ticketId, {
        status: 'closed',
        resolution
      });
      
      logger.info(`Ticket closed: ${ticketId}`);
      return ticket;
    } catch (error) {
      logger.error('Error closing ticket:', error);
      throw error;
    }
  }

  /**
   * Получает статистику тикетов
   * @param {Object} [filters] - Фильтры для статистики
   * @param {Date} [filters.startDate] - Начальная дата
   * @param {Date} [filters.endDate] - Конечная дата
   * @returns {Promise<Object>} Статистика тикетов
   */
  async getTicketStats(filters = {}) {
    try {
      const query = {};
      
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = filters.startDate;
        if (filters.endDate) query.createdAt.$lte = filters.endDate;
      }
      
      const [stats] = await Ticket.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
            byCategory: {
              $push: {
                category: '$category',
                priority: '$priority',
                language: '$language'
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            open: 1,
            inProgress: 1,
            resolved: 1,
            closed: 1,
            categoryStats: {
              $reduce: {
                input: '$byCategory',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [
                        [{ k: '$$this.category', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.category', input: '$$value' } }, 0] }, 1] } }]
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      ]);
      
      return stats || {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        categoryStats: {}
      };
    } catch (error) {
      logger.error('Error getting ticket stats:', error);
      throw new Error(`Failed to get ticket stats: ${error.message}`);
    }
  }

  /**
   * Ищет тикеты по тексту
   * @param {string} searchText - Текст для поиска
   * @param {Object} [pagination] - Параметры пагинации
   * @returns {Promise<Object[]>} Найденные тикеты
   */
  async searchTickets(searchText, pagination = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      
      const tickets = await Ticket.find({
        $or: [
          { ticketId: { $regex: searchText, $options: 'i' } },
          { subject: { $regex: searchText, $options: 'i' } },
          { message: { $regex: searchText, $options: 'i' } },
          { userId: { $regex: searchText, $options: 'i' } }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('conversationId')
        .exec();
      
      return tickets;
    } catch (error) {
      logger.error('Error searching tickets:', error);
      throw new Error(`Failed to search tickets: ${error.message}`);
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new TicketingService();