/**
 * Сервис для управления системой тикетов поддержки
 * @file server/services/ticketing.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} TicketData
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} message - Сообщение/вопрос пользователя
 * @property {string} context - Контекст разговора
 * @property {string} [language] - Язык обращения
 * @property {string} [subject] - Тема тикета
 * @property {string} [category] - Категория тикета
 * @property {string} [priority] - Приоритет тикета
 * @property {string} [email] - Email пользователя
 */

/**
 * @typedef {Object} TicketDoc
 * @property {string} _id - MongoDB ID тикета
 * @property {string} ticketId - Уникальный ID тикета (для пользователей)
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {string} status - Статус тикета
 * @property {string} priority - Приоритет тикета
 * @property {string} category - Категория тикета
 * @property {string} subject - Тема тикета
 * @property {string} initialMessage - Первоначальное сообщение
 * @property {string} context - Контекст разговора
 * @property {string} language - Язык обращения
 * @property {string} [assignedTo] - Назначенный агент
 * @property {string} [resolution] - Решение тикета
 * @property {string} [email] - Email пользователя
 * @property {Date} createdAt - Время создания
 * @property {Date} updatedAt - Время обновления
 * @property {Date} [resolvedAt] - Время закрытия
 */

/**
 * @class TicketService
 * @description Сервис для управления тикетами поддержки
 */
class TicketService {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.initializeModel();
    
    // Категории тикетов
    this.categories = [
      'technical',
      'account',
      'billing',
      'feature',
      'bug',
      'wallet',
      'staking',
      'farming',
      'other'
    ];
    
    // Приоритеты тикетов
    this.priorities = [
      'low',
      'medium',
      'high',
      'urgent'
    ];
    
    // Статусы тикетов
    this.statuses = [
      'open',
      'in_progress',
      'waiting_response',
      'resolved',
      'closed'
    ];
  }

  /**
   * Инициализирует модель тикета
   */
  initializeModel() {
    try {
      // Схема для тикета
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
          required: true,
          index: true
        },
        status: {
          type: String,
          enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'],
          default: 'open',
          index: true
        },
        priority: {
          type: String,
          enum: ['low', 'medium', 'high', 'urgent'],
          default: 'medium',
          index: true
        },
        category: {
          type: String,
          enum: ['technical', 'account', 'billing', 'feature', 'bug', 'wallet', 'staking', 'farming', 'other'],
          default: 'other',
          index: true
        },
        subject: {
          type: String,
          required: true,
          trim: true,
          maxlength: 200
        },
        initialMessage: {
          type: String,
          required: true,
          maxlength: 10000
        },
        context: {
          type: String,
          maxlength: 50000
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
          match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
        },
        assignedTo: {
          type: String,
          index: true
        },
        resolution: {
          type: String,
          maxlength: 10000
        },
        language: {
          type: String,
          enum: ['en', 'es', 'ru'],
          default: 'en',
          index: true
        },
        // Метаданные
        metadata: {
          source: {
            type: String,
            enum: ['socket', 'api', 'telegram', 'email'],
            default: 'socket'
          },
          userAgent: String,
          ipAddress: String,
          tags: [String],
          internalNotes: String,
          estimatedTime: Number, // В минутах
          actualTime: Number, // В минутах
          satisfactionScore: {
            type: Number,
            min: 1,
            max: 5
          },
          feedback: String
        },
        // Даты
        resolvedAt: {
          type: Date,
          index: true
        },
        firstResponseAt: Date,
        lastAgentResponseAt: Date,
        // SLA метрики
        sla: {
          responseTime: Number, // Время первого ответа в минутах
          resolutionTime: Number, // Время закрытия в минутах
          breached: {
            type: Boolean,
            default: false
          }
        }
      }, {
        timestamps: true,
        collection: 'tickets'
      });

      // Составные индексы для оптимизации
      ticketSchema.index({ status: 1, priority: -1, createdAt: 1 });
      ticketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
      ticketSchema.index({ category: 1, status: 1, createdAt: -1 });
      ticketSchema.index({ createdAt: -1, status: 1 });
      
      // Текстовый индекс для поиска
      ticketSchema.index({ 
        subject: 'text', 
        initialMessage: 'text',
        resolution: 'text'
      });

      // Виртуальные поля
      ticketSchema.virtual('isOpen').get(function() {
        return ['open', 'in_progress', 'waiting_response'].includes(this.status);
      });

      ticketSchema.virtual('isClosed').get(function() {
        return ['resolved', 'closed'].includes(this.status);
      });

      ticketSchema.virtual('age').get(function() {
        return Date.now() - this.createdAt.getTime();
      });

      ticketSchema.virtual('ageInHours').get(function() {
        return Math.floor(this.age / (1000 * 60 * 60));
      });

      // Методы экземпляра
      ticketSchema.methods.assign = function(agentId) {
        this.assignedTo = agentId;
        if (this.status === 'open') {
          this.status = 'in_progress';
        }
        return this.save();
      };

      ticketSchema.methods.resolve = function(resolution, agentId) {
        this.status = 'resolved';
        this.resolution = resolution;
        this.resolvedAt = new Date();
        this.assignedTo = this.assignedTo || agentId;
        
        // Вычисляем время разрешения
        this.sla.resolutionTime = Math.floor(
          (this.resolvedAt - this.createdAt) / (1000 * 60)
        );
        
        return this.save();
      };

      ticketSchema.methods.close = function(resolution) {
        if (resolution) {
          this.resolution = resolution;
        }
        this.status = 'closed';
        if (!this.resolvedAt) {
          this.resolvedAt = new Date();
        }
        return this.save();
      };

      ticketSchema.methods.escalate = function(newPriority) {
        if (this.priorities.indexOf(newPriority) > this.priorities.indexOf(this.priority)) {
          this.priority = newPriority;
          return this.save();
        }
        return this;
      };

      // Статические методы
      ticketSchema.statics.findByStatus = function(status, options = {}) {
        const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
        return this.find({ status })
          .sort(sort)
          .limit(limit)
          .skip(skip);
      };

      ticketSchema.statics.findByAgent = function(agentId, options = {}) {
        const { status, limit = 50, skip = 0 } = options;
        let query = { assignedTo: agentId };
        if (status) {
          query.status = status;
        }
        return this.find(query)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .skip(skip);
      };

      ticketSchema.statics.findOverdue = function(hoursOverdue = 24) {
        const cutoffDate = new Date(Date.now() - hoursOverdue * 60 * 60 * 1000);
        return this.find({
          status: { $in: ['open', 'in_progress'] },
          createdAt: { $lt: cutoffDate },
          'sla.breached': { $ne: true }
        });
      };

      // Middleware
      ticketSchema.pre('save', function(next) {
        // Генерируем ticketId если его нет
        if (!this.ticketId && this.isNew) {
          this.ticketId = this.generateTicketId();
        }
        
        // Обновляем timestamp
        this.updatedAt = new Date();
        
        // Проверяем SLA
        if (this.isOpen && !this.sla.breached) {
          this.checkSLA();
        }
        
        next();
      });

      // Методы схемы
      ticketSchema.methods.generateTicketId = function() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `SHR${timestamp}${random}`.toUpperCase();
      };

      ticketSchema.methods.checkSLA = function() {
        const now = new Date();
        const ageHours = (now - this.createdAt) / (1000 * 60 * 60);
        
        // SLA нарушен если тикет открыт более 24 часов для высокого приоритета
        // или более 48 часов для других приоритетов
        const slaHours = this.priority === 'urgent' ? 4 : 
                        this.priority === 'high' ? 12 : 
                        this.priority === 'medium' ? 24 : 48;
        
        if (ageHours > slaHours) {
          this.sla.breached = true;
        }
      };

      // Проверяем, не существует ли уже модель
      if (mongoose.models.Ticket) {
        this.model = mongoose.models.Ticket;
      } else {
        this.model = mongoose.model('Ticket', ticketSchema);
      }

      this.initialized = true;
      logger.info('✅ TicketService initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize TicketService:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Создает новый тикет
   * @param {TicketData} data - Данные для создания тикета
   * @returns {Promise<TicketDoc>} Созданный тикет
   */
  async createTicket(data) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      // Валидация входных данных
      this.validateTicketData(data);

      // Генерируем уникальный ticketId
      const ticketId = this.generateTicketId();

      const ticketData = {
        ticketId,
        userId: data.userId,
        conversationId: data.conversationId,
        subject: data.subject || `Support request: ${data.message.substring(0, 50)}...`,
        initialMessage: data.message,
        context: data.context || '',
        language: data.language || 'en',
        category: data.category || 'other',
        priority: data.priority || this.determinePriority(data.message),
        email: data.email,
        metadata: {
          source: data.source || 'socket',
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          tags: data.tags || []
        }
      };

      const ticket = new this.model(ticketData);
      const savedTicket = await ticket.save();

      logger.info(`✅ Ticket created: ${savedTicket.ticketId} for user: ${data.userId}`);
      
      // Уведомляем о новом тикете (можно добавить)
      this.notifyNewTicket(savedTicket);
      
      return savedTicket;
    } catch (error) {
      logger.error('❌ Failed to create ticket:', error.message);
      throw error;
    }
  }

  /**
   * Валидирует данные тикета
   * @param {TicketData} data - Данные для валидации
   * @throws {Error} Ошибка валидации
   */
  validateTicketData(data) {
    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('User ID is required');
    }

    if (!data.conversationId) {
      throw new Error('Conversation ID is required');
    }

    if (!mongoose.Types.ObjectId.isValid(data.conversationId)) {
      throw new Error('Invalid conversation ID format');
    }

    if (!data.message || typeof data.message !== 'string') {
      throw new Error('Message is required');
    }

    if (data.message.length > 10000) {
      throw new Error('Message exceeds maximum length of 10000 characters');
    }

    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
      throw new Error('Invalid email format');
    }

    if (data.category && !this.categories.includes(data.category)) {
      throw new Error(`Invalid category. Must be one of: ${this.categories.join(', ')}`);
    }

    if (data.priority && !this.priorities.includes(data.priority)) {
      throw new Error(`Invalid priority. Must be one of: ${this.priorities.join(', ')}`);
    }
  }

  /**
   * Генерирует уникальный ID тикета
   * @returns {string} Уникальный ID тикета
   */
  generateTicketId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `SHR${timestamp}${random}`.toUpperCase();
  }

  /**
   * Определяет приоритет тикета на основе сообщения
   * @param {string} message - Сообщение пользователя
   * @returns {string} Приоритет тикета
   */
  determinePriority(message) {
    const urgentKeywords = [
      'urgent', 'emergency', 'critical', 'срочно', 'критически',
      'can\'t access', 'не могу зайти', 'lost funds', 'потерял средства'
    ];
    
    const highKeywords = [
      'error', 'bug', 'broken', 'ошибка', 'баг', 'не работает',
      'transaction failed', 'транзакция не прошла'
    ];
    
    const messageLower = message.toLowerCase();
    
    if (urgentKeywords.some(keyword => messageLower.includes(keyword))) {
      return 'urgent';
    }
    
    if (highKeywords.some(keyword => messageLower.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Находит тикет по ID
   * @param {string} ticketId - ID тикета
   * @returns {Promise<TicketDoc|null>} Найденный тикет или null
   */
  async findById(ticketId) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const ticket = await this.model.findOne({ ticketId });
      return ticket;
    } catch (error) {
      logger.error('❌ Failed to find ticket by ID:', error.message);
      throw error;
    }
  }

  /**
   * Получает тикеты с фильтрацией и пагинацией
   * @param {Object} filter - Фильтры
   * @param {Object} options - Опции пагинации
   * @returns {Promise<Object>} Результат с тикетами и метаданными
   */
  async getTickets(filter = {}, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const { 
        page = 1, 
        limit = 50, 
        sort = { createdAt: -1 },
        populate = false
      } = options;
      
      const skip = (page - 1) * limit;

      // Построение запроса
      let query = this.model.find(filter);
      
      if (populate) {
        query = query.populate('conversationId', 'startedAt messageCount');
      }

      const [tickets, totalCount] = await Promise.all([
        query
          .sort(sort)
          .skip(skip)
          .limit(limit),
        this.model.countDocuments(filter)
      ]);

      return {
        tickets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get tickets:', error.message);
      throw error;
    }
  }

  /**
   * Получает тикеты пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции поиска
   * @returns {Promise<TicketDoc[]>} Массив тикетов пользователя
   */
  async getByUserId(userId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const { status, limit = 50, skip = 0 } = options;
      let filter = { userId };

      if (status && this.statuses.includes(status)) {
        filter.status = status;
      }

      const tickets = await this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      return tickets;
    } catch (error) {
      logger.error('❌ Failed to get tickets by user ID:', error.message);
      throw error;
    }
  }

  /**
   * Обновляет тикет
   * @param {string} ticketId - ID тикета
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<TicketDoc>} Обновленный тикет
   */
  async updateTicket(ticketId, updateData) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const ticket = await this.model.findOneAndUpdate(
        { ticketId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      logger.info(`Ticket updated: ${ticketId}`);
      return ticket;
    } catch (error) {
      logger.error('❌ Failed to update ticket:', error.message);
      throw error;
    }
  }

  /**
   * Назначает тикет агенту
   * @param {string} ticketId - ID тикета
   * @param {string} agentId - ID агента
   * @returns {Promise<TicketDoc>} Обновленный тикет
   */
  async assignTicket(ticketId, agentId) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const ticket = await this.model.findOne({ ticketId });
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      await ticket.assign(agentId);
      logger.info(`Ticket ${ticketId} assigned to ${agentId}`);
      
      return ticket;
    } catch (error) {
      logger.error('❌ Failed to assign ticket:', error.message);
      throw error;
    }
  }

  /**
   * Закрывает тикет с решением
   * @param {string} ticketId - ID тикета
   * @param {string} resolution - Решение проблемы
   * @param {string} [agentId] - ID агента, закрывшего тикет
   * @returns {Promise<TicketDoc>} Закрытый тикет
   */
  async closeTicket(ticketId, resolution, agentId) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const ticket = await this.model.findOne({ ticketId });
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      await ticket.resolve(resolution, agentId);
      logger.info(`Ticket closed: ${ticketId}`);
      
      // Уведомляем о закрытии тикета
      this.notifyTicketClosed(ticket);
      
      return ticket;
    } catch (error) {
      logger.error('❌ Failed to close ticket:', error.message);
      throw error;
    }
  }

  /**
   * Поиск тикетов по тексту
   * @param {string} searchText - Текст для поиска
   * @param {Object} options - Опции поиска
   * @returns {Promise<TicketDoc[]>} Найденные тикеты
   */
  async searchTickets(searchText, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const { limit = 50, status, category, priority } = options;

      let query = {
        $text: { $search: searchText }
      };

      // Дополнительные фильтры
      if (status && this.statuses.includes(status)) {
        query.status = status;
      }

      if (category && this.categories.includes(category)) {
        query.category = category;
      }

      if (priority && this.priorities.includes(priority)) {
        query.priority = priority;
      }

      const tickets = await this.model
        .find(query, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);

      return tickets;
    } catch (error) {
      logger.error('❌ Failed to search tickets:', error.message);
      throw error;
    }
  }

  /**
   * Получает статистику тикетов
   * @param {Object} filter - Фильтр для статистики
   * @returns {Promise<Object>} Статистика тикетов
   */
  async getStats(filter = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const [
        total,
        byStatus,
        byCategory,
        byPriority,
        avgResolutionTime,
        overdueTickets
      ] = await Promise.all([
        // Общее количество тикетов
        this.model.countDocuments(filter),
        
        // По статусам
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        
        // По категориям
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        
        // По приоритетам
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        
        // Среднее время разрешения
        this.model.aggregate([
          { 
            $match: { 
              ...filter, 
              'sla.resolutionTime': { $exists: true, $ne: null }
            }
          },
          {
            $group: {
              _id: null,
              avgResolutionTime: { $avg: '$sla.resolutionTime' },
              maxResolutionTime: { $max: '$sla.resolutionTime' },
              minResolutionTime: { $min: '$sla.resolutionTime' }
            }
          }
        ]),
        
        // Просроченные тикеты
        this.model.countDocuments({
          ...filter,
          'sla.breached': true,
          status: { $in: ['open', 'in_progress'] }
        })
      ]);

      return {
        total,
        open: byStatus.find(s => s._id === 'open')?.count || 0,
        inProgress: byStatus.find(s => s._id === 'in_progress')?.count || 0,
        resolved: byStatus.find(s => s._id === 'resolved')?.count || 0,
        closed: byStatus.find(s => s._id === 'closed')?.count || 0,
        overdue: overdueTickets,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byCategory: byCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        avgResolutionTimeMinutes: Math.round(avgResolutionTime[0]?.avgResolutionTime || 0),
        avgResolutionTimeHours: Math.round((avgResolutionTime[0]?.avgResolutionTime || 0) / 60),
        maxResolutionTimeHours: Math.round((avgResolutionTime[0]?.maxResolutionTime || 0) / 60),
        minResolutionTimeHours: Math.round((avgResolutionTime[0]?.minResolutionTime || 0) / 60)
      };
    } catch (error) {
      logger.error('❌ Failed to get ticket stats:', error.message);
      throw error;
    }
  }

  /**
   * Уведомляет о новом тикете (заглушка)
   * @param {TicketDoc} ticket - Новый тикет
   */
  notifyNewTicket(ticket) {
    // Здесь можно добавить логику отправки уведомлений
    // например, email, Slack, Telegram и т.д.
    logger.info(`New ticket notification: ${ticket.ticketId}`);
  }

  /**
   * Уведомляет о закрытии тикета (заглушка)
   * @param {TicketDoc} ticket - Закрытый тикет
   */
  notifyTicketClosed(ticket) {
    // Здесь можно добавить логику отправки уведомлений пользователю
    logger.info(`Ticket closed notification: ${ticket.ticketId}`);
  }

  /**
   * Находит просроченные тикеты
   * @param {number} hoursOverdue - Количество часов для определения просрочки
   * @returns {Promise<TicketDoc[]>} Массив просроченных тикетов
   */
  async findOverdueTickets(hoursOverdue = 24) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const tickets = await this.model.findOverdue(hoursOverdue);
      
      // Помечаем просроченные тикеты
      for (const ticket of tickets) {
        ticket.sla.breached = true;
        await ticket.save();
      }

      logger.info(`Found ${tickets.length} overdue tickets`);
      return tickets;
    } catch (error) {
      logger.error('❌ Failed to find overdue tickets:', error.message);
      throw error;
    }
  }

  /**
   * Очищает старые закрытые тикеты
   * @param {number} daysOld - Количество дней для определения старых тикетов
   * @returns {Promise<number>} Количество удаленных тикетов
   */
  async cleanupOldTickets(daysOld = 90) {
    try {
      if (!this.initialized) {
        throw new Error('TicketService not initialized');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.model.deleteMany({
        status: 'closed',
        resolvedAt: { $lte: cutoffDate }
      });

      logger.info(`Cleaned up ${result.deletedCount} old tickets`);
      return result.deletedCount;
    } catch (error) {
      logger.error('❌ Failed to cleanup old tickets:', error.message);
      throw error;
    }
  }

  /**
   * Проверяет здоровье сервиса
   * @returns {Promise<Object>} Результат проверки здоровья
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'error',
          message: 'TicketService not initialized'
        };
      }

      // Попытка выполнить простой запрос
      await this.model.findOne().limit(1);

      return {
        status: 'ok',
        message: 'TicketService is healthy'
      };
    } catch (error) {
      logger.error('TicketService health check failed:', error.message);
      return {
        status: 'error',
        message: 'TicketService health check failed',
        error: error.message
      };
    }
  }
}

// Экспорт экземпляра сервиса
module.exports = new TicketService();