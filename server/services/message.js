/**
 * Сервис для управления сообщениями в чате
 * @file server/services/message.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} MessageData
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль отправителя (user, assistant, system)
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @typedef {Object} MessageDoc
 * @property {string} _id - ID сообщения
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль отправителя
 * @property {string} userId - ID пользователя
 * @property {string} conversationId - ID разговора
 * @property {Object} metadata - Дополнительные метаданные
 * @property {Date} createdAt - Время создания
 * @property {Date} updatedAt - Время обновления
 */

/**
 * @class MessageService
 * @description Сервис для управления сообщениями в чате
 */
class MessageService {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.initializeModel();
  }

  /**
   * Инициализирует модель сообщения
   */
  initializeModel() {
    try {
      // Проверяем, не существует ли уже модель
      if (mongoose.models.Message) {
        this.model = mongoose.models.Message;
      } else {
        // Схема для сообщения
        const messageSchema = new mongoose.Schema({
          text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 10000 // Максимальная длина сообщения
          },
          role: {
            type: String,
            enum: ['user', 'assistant', 'system'],
            required: true,
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
          // Дополнительные метаданные
          metadata: {
            language: {
              type: String,
              enum: ['en', 'es', 'ru'],
              default: 'en'
            },
            tokensUsed: {
              type: Number,
              default: 0
            },
            sentiment: {
              type: String,
              enum: ['positive', 'negative', 'neutral'],
              default: 'neutral'
            },
            createdTicket: {
              type: Boolean,
              default: false
            },
            ticketId: {
              type: String
            },
            source: {
              type: String,
              enum: ['socket', 'api', 'telegram'],
              default: 'socket'
            },
            // Дополнительные данные могут быть добавлены
            additional: {
              type: Object,
              default: {}
            }
          },
          // Флаг для пометки сообщений как отредактированных
          isEdited: {
            type: Boolean,
            default: false
          },
          // История редактирования (если нужно)
          editHistory: [{
            text: String,
            editedAt: Date,
            editedBy: String
          }]
        }, {
          timestamps: true,
          collection: 'messages'
        });

        // Составные индексы для оптимизации
        messageSchema.index({ conversationId: 1, createdAt: 1 });
        messageSchema.index({ userId: 1, createdAt: -1 });
        messageSchema.index({ role: 1, createdAt: -1 });
        messageSchema.index({ 'metadata.language': 1, createdAt: -1 });
        
        // Текстовый индекс для поиска по содержимому
        messageSchema.index({ text: 'text' });

        // Виртуальные поля
        messageSchema.virtual('wordCount').get(function() {
          return this.text.split(/\s+/).length;
        });

        messageSchema.virtual('characterCount').get(function() {
          return this.text.length;
        });

        // Методы экземпляра
        messageSchema.methods.edit = function(newText, editedBy) {
          if (this.isEdited) {
            this.editHistory.push({
              text: this.text,
              editedAt: new Date(),
              editedBy: editedBy
            });
          } else {
            this.editHistory.push({
              text: this.text,
              editedAt: this.createdAt,
              editedBy: this.userId
            });
          }
          
          this.text = newText;
          this.isEdited = true;
          return this.save();
        };

        // Статические методы
        messageSchema.statics.findByConversation = function(conversationId, options = {}) {
          const { limit = 50, skip = 0, sort = { createdAt: 1 } } = options;
          return this.find({ conversationId })
            .sort(sort)
            .limit(limit)
            .skip(skip);
        };

        messageSchema.statics.findRecentByUser = function(userId, limit = 10) {
          return this.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        };

        messageSchema.statics.findByRole = function(role, options = {}) {
          const { limit = 100, skip = 0 } = options;
          return this.find({ role })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);
        };

        // Middleware
        messageSchema.pre('save', function(next) {
          // Автоматическое определение языка, если не указан
          if (!this.metadata.language && this.text) {
            // Можно добавить автоматическое определение языка
            this.metadata.language = 'en'; // По умолчанию
          }
          next();
        });

        this.model = mongoose.model('Message', messageSchema);
      }

      this.initialized = true;
      logger.info('✅ MessageService initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize MessageService:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Создает новое сообщение
   * @param {MessageData} data - Данные для создания сообщения
   * @returns {Promise<MessageDoc>} Созданное сообщение
   */
  async create(data) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      // Валидация входных данных
      this.validateMessageData(data);

      const messageData = {
        text: data.text,
        role: data.role,
        userId: data.userId,
        conversationId: data.conversationId,
        metadata: {
          language: data.metadata?.language || 'en',
          tokensUsed: data.metadata?.tokensUsed || 0,
          sentiment: data.metadata?.sentiment || 'neutral',
          createdTicket: data.metadata?.createdTicket || false,
          ticketId: data.metadata?.ticketId,
          source: data.metadata?.source || 'socket',
          additional: data.metadata?.additional || {}
        }
      };

      const message = new this.model(messageData);
      const savedMessage = await message.save();

      // Увеличиваем счетчик сообщений в разговоре
      if (data.role === 'user' || data.role === 'assistant') {
        try {
          const conversationService = require('./conversation');
          await conversationService.incrementMessageCount(data.conversationId);
        } catch (error) {
          logger.warn('Failed to increment conversation message count:', error.message);
        }
      }

      logger.info(`✅ Message created: ${savedMessage._id} in conversation: ${data.conversationId}`);
      return savedMessage;
    } catch (error) {
      logger.error('❌ Failed to create message:', error.message);
      throw error;
    }
  }

  /**
   * Валидирует данные сообщения
   * @param {MessageData} data - Данные для валидации
   * @throws {Error} Ошибка валидации
   */
  validateMessageData(data) {
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Message text is required and must be a string');
    }

    if (data.text.length > 10000) {
      throw new Error('Message text exceeds maximum length of 10000 characters');
    }

    if (!data.role || !['user', 'assistant', 'system'].includes(data.role)) {
      throw new Error('Valid message role is required (user, assistant, system)');
    }

    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    if (!data.conversationId) {
      throw new Error('Conversation ID is required');
    }

    // Проверяем, что conversationId является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(data.conversationId)) {
      throw new Error('Invalid conversation ID format');
    }
  }

  /**
   * Находит сообщение по ID
   * @param {string} messageId - ID сообщения
   * @returns {Promise<MessageDoc|null>} Найденное сообщение или null
   */
  async findById(messageId) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        logger.warn(`Invalid message ID: ${messageId}`);
        return null;
      }

      const message = await this.model.findById(messageId);
      return message;
    } catch (error) {
      logger.error('❌ Failed to find message by ID:', error.message);
      throw error;
    }
  }

  /**
   * Получает сообщения по разговору
   * @param {string} conversationId - ID разговора
   * @param {Object} options - Опции поиска
   * @param {number} [options.limit=50] - Лимит результатов
   * @param {number} [options.skip=0] - Количество пропускаемых записей
   * @param {Object} [options.sort] - Параметры сортировки
   * @returns {Promise<MessageDoc[]>} Массив сообщений
   */
  async getByConversation(conversationId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const messages = await this.model.findByConversation(conversationId, options);
      return messages;
    } catch (error) {
      logger.error('❌ Failed to get messages by conversation:', error.message);
      throw error;
    }
  }

  /**
   * Получает последние сообщения из разговора
   * @param {string} conversationId - ID разговора
   * @param {number} limit - Количество сообщений
   * @returns {Promise<MessageDoc[]>} Массив последних сообщений
   */
  async getRecentMessages(conversationId, limit = 10) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const messages = await this.model
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(); // Используем lean() для лучшей производительности

      // Возвращаем в хронологическом порядке
      return messages.reverse();
    } catch (error) {
      logger.error('❌ Failed to get recent messages:', error.message);
      throw error;
    }
  }

  /**
   * Получает сообщения пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции поиска
   * @param {number} [options.limit=100] - Лимит результатов
   * @param {number} [options.skip=0] - Количество пропускаемых записей
   * @param {string} [options.role] - Фильтр по роли
   * @returns {Promise<MessageDoc[]>} Массив сообщений пользователя
   */
  async getByUser(userId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      const { limit = 100, skip = 0, role } = options;
      const query = { userId };

      if (role && ['user', 'assistant', 'system'].includes(role)) {
        query.role = role;
      }

      const messages = await this.model
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      return messages;
    } catch (error) {
      logger.error('❌ Failed to get messages by user:', error.message);
      throw error;
    }
  }

  /**
   * Поиск сообщений по тексту
   * @param {string} searchText - Текст для поиска
   * @param {Object} options - Опции поиска
   * @param {number} [options.limit=50] - Лимит результатов
   * @param {string} [options.conversationId] - Фильтр по разговору
   * @param {string} [options.userId] - Фильтр по пользователю
   * @param {string} [options.language] - Фильтр по языку
   * @returns {Promise<MessageDoc[]>} Массив найденных сообщений
   */
  async searchMessages(searchText, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      const { limit = 50, conversationId, userId, language } = options;
      
      const query = {
        $text: { $search: searchText }
      };

      // Дополнительные фильтры
      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        query.conversationId = conversationId;
      }

      if (userId) {
        query.userId = userId;
      }

      if (language && ['en', 'es', 'ru'].includes(language)) {
        query['metadata.language'] = language;
      }

      const messages = await this.model
        .find(query, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);

      return messages;
    } catch (error) {
      logger.error('❌ Failed to search messages:', error.message);
      throw error;
    }
  }

  /**
   * Редактирует существующее сообщение
   * @param {string} messageId - ID сообщения
   * @param {string} newText - Новый текст сообщения
   * @param {string} editedBy - ID того, кто редактирует
   * @returns {Promise<MessageDoc>} Отредактированное сообщение
   */
  async editMessage(messageId, newText, editedBy) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new Error(`Invalid message ID: ${messageId}`);
      }

      const message = await this.model.findById(messageId);
      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }

      await message.edit(newText, editedBy);
      logger.info(`Message edited: ${messageId} by ${editedBy}`);
      
      return message;
    } catch (error) {
      logger.error('❌ Failed to edit message:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет сообщение
   * @param {string} messageId - ID сообщения
   * @returns {Promise<boolean>} Успешность удаления
   */
  async deleteMessage(messageId) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new Error(`Invalid message ID: ${messageId}`);
      }

      const result = await this.model.findByIdAndDelete(messageId);
      
      if (result) {
        logger.info(`Message deleted: ${messageId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('❌ Failed to delete message:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет все сообщения разговора
   * @param {string} conversationId - ID разговора
   * @returns {Promise<number>} Количество удаленных сообщений
   */
  async deleteByConversation(conversationId) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error(`Invalid conversation ID: ${conversationId}`);
      }

      const result = await this.model.deleteMany({ conversationId });
      
      logger.info(`Deleted ${result.deletedCount} messages from conversation: ${conversationId}`);
      return result.deletedCount;
    } catch (error) {
      logger.error('❌ Failed to delete messages by conversation:', error.message);
      throw error;
    }
  }

  /**
   * Получает статистику сообщений
   * @param {Object} filter - Фильтр для статистики
   * @returns {Promise<Object>} Статистика сообщений
   */
  async getStats(filter = {}) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      const [total, byRole, byLanguage, avgLength, tokensUsed] = await Promise.all([
        // Общее количество сообщений
        this.model.countDocuments(filter),
        
        // Распределение по ролям
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        
        // Распределение по языкам
        this.model.aggregate([
          { $match: filter },
          { $group: { _id: '$metadata.language', count: { $sum: 1 } } }
        ]),
        
        // Средняя длина сообщения
        this.model.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              avgLength: { $avg: { $strLenCP: '$text' } },
              maxLength: { $max: { $strLenCP: '$text' } },
              minLength: { $min: { $strLenCP: '$text' } }
            }
          }
        ]),
        
        // Общее количество использованных токенов
        this.model.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalTokens: { $sum: '$metadata.tokensUsed' },
              avgTokens: { $avg: '$metadata.tokensUsed' }
            }
          }
        ])
      ]);

      return {
        total,
        byRole: byRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byLanguage: byLanguage.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        avgMessageLength: Math.round(avgLength[0]?.avgLength || 0),
        maxMessageLength: avgLength[0]?.maxLength || 0,
        minMessageLength: avgLength[0]?.minLength || 0,
        totalTokensUsed: tokensUsed[0]?.totalTokens || 0,
        avgTokensPerMessage: Math.round(tokensUsed[0]?.avgTokens || 0)
      };
    } catch (error) {
      logger.error('❌ Failed to get message stats:', error.message);
      throw error;
    }
  }

  /**
   * Очищает старые сообщения
   * @param {number} daysOld - Количество дней для определения старых сообщений
   * @param {boolean} [onlySystemMessages=true] - Удалять только системные сообщения
   * @returns {Promise<number>} Количество удаленных сообщений
   */
  async cleanupOldMessages(daysOld = 90, onlySystemMessages = true) {
    try {
      if (!this.initialized) {
        throw new Error('MessageService not initialized');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const query = {
        createdAt: { $lte: cutoffDate }
      };

      if (onlySystemMessages) {
        query.role = 'system';
      }

      const result = await this.model.deleteMany(query);
      
      logger.info(`Cleaned up ${result.deletedCount} old messages`);
      return result.deletedCount;
    } catch (error) {
      logger.error('❌ Failed to cleanup old messages:', error.message);
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
          message: 'MessageService not initialized'
        };
      }

      // Попытка выполнить простой запрос
      await this.model.findOne().limit(1);

      return {
        status: 'ok',
        message: 'MessageService is healthy'
      };
    } catch (error) {
      logger.error('MessageService health check failed:', error.message);
      return {
        status: 'error',
        message: 'MessageService health check failed',
        error: error.message
      };
    }
  }

  /**
   * Форматирует сообщения для Claude (история диалога)
   * @param {MessageDoc[]} messages - Массив сообщений
   * @returns {Array} Форматированные сообщения для Claude
   */
  formatForClaude(messages) {
    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role,
        content: msg.text
      }));
  }
}

// Экспорт экземпляра сервиса
module.exports = new MessageService();
