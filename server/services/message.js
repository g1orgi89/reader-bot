/**
 * Message Service for Shrooms Support Bot
 * Handles message CRUD operations
 * @file server/services/message.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Message schema for MongoDB
 */
const messageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'en'
  },
  tokensUsed: {
    type: Number,
    default: 0
  },
  needsTicket: {
    type: Boolean,
    default: false
  },
  ticketCreated: {
    type: Boolean,
    default: false
  },
  ticketId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

/**
 * Message Service class
 */
class MessageService {
  /**
   * Create a new message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Created message
   */
  async createMessage(messageData) {
    try {
      const message = new Message(messageData);
      const savedMessage = await message.save();
      
      logger.info('Message created', {
        messageId: savedMessage._id,
        conversationId: savedMessage.conversationId,
        role: savedMessage.role
      });
      
      return savedMessage;
    } catch (error) {
      logger.error('Failed to create message', { error: error.message });
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Messages array
   */
  async getMessages(conversationId, options = {}) {
    try {
      const { page = 1, limit = 50, includeMetadata = false } = options;
      const skip = (page - 1) * limit;
      
      const query = { conversationId };
      const select = includeMetadata ? {} : '-tokensUsed -needsTicket -ticketCreated -ticketId';
      
      const messages = await Message.find(query)
        .select(select)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      
      return messages.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Failed to get messages', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get recent messages for context
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} Recent messages
   */
  async getRecentMessages(conversationId, limit = 10) {
    try {
      const messages = await Message.find({ conversationId })
        .select('role text timestamp')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      return messages.reverse().map(msg => ({
        role: msg.role,
        content: msg.text,
        timestamp: msg.createdAt
      }));
    } catch (error) {
      logger.error('Failed to get recent messages', { error: error.message, conversationId });
      return [];
    }
  }

  /**
   * Get message count for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<number>} Message count
   */
  async getMessageCount(conversationId) {
    try {
      return await Message.countDocuments({ conversationId });
    } catch (error) {
      logger.error('Failed to get message count', { error: error.message, conversationId });
      return 0;
    }
  }

  /**
   * Update a message
   * @param {string} messageId - Message ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated message
   */
  async updateMessage(messageId, updateData) {
    try {
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true }
      );
      
      if (!updatedMessage) {
        throw new Error('Message not found');
      }
      
      return updatedMessage;
    } catch (error) {
      logger.error('Failed to update message', { error: error.message, messageId });
      throw error;
    }
  }

  /**
   * Delete conversation messages
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<number>} Number of deleted messages
   */
  async deleteConversation(conversationId, userId) {
    try {
      const result = await Message.deleteMany({ 
        conversationId,
        ...(userId && { userId })
      });
      
      logger.info('Conversation deleted', {
        conversationId,
        deletedCount: result.deletedCount
      });
      
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to delete conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get user chat statistics
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId, days = 30) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      const stats = await Message.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: dateFrom }
          }
        },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            userMessages: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
            assistantMessages: { $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] } },
            totalTokens: { $sum: '$tokensUsed' },
            ticketsCreated: { $sum: { $cond: ['$ticketCreated', 1, 0] } },
            conversationsCount: { $addToSet: '$conversationId' }
          }
        },
        {
          $addFields: {
            conversationsCount: { $size: '$conversationsCount' }
          }
        }
      ]);
      
      return stats[0] || {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        totalTokens: 0,
        ticketsCreated: 0,
        conversationsCount: 0
      };
    } catch (error) {
      logger.error('Failed to get user stats', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = new MessageService();