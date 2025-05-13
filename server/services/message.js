/**
 * Message service for handling chat messages
 * @file server/services/message.js
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Message = require('../models/message');

// Import types for JSDoc
require('../types');

/**
 * @class MessageService
 * @description Service for managing chat messages with full type safety
 */
class MessageService {
  /**
   * Create a new chat message
   * @param {Object} messageData - Message data
   * @param {string} messageData.conversationId - Conversation ID
   * @param {string} messageData.userId - User ID
   * @param {MessageRole} messageData.role - Message role
   * @param {string} messageData.text - Message text (not content!)
   * @param {Language} messageData.language - Message language
   * @param {number} [messageData.tokensUsed] - Tokens used
   * @returns {Promise<ChatMessage>} Created message
   */
  async createMessage(messageData) {
    try {
      logger.debug('Creating message', {
        conversationId: messageData.conversationId,
        userId: messageData.userId,
        role: messageData.role,
        textLength: messageData.text.length
      });

      const message = new Message({
        conversationId: new mongoose.Types.ObjectId(messageData.conversationId),
        userId: messageData.userId,
        role: messageData.role,
        text: messageData.text,
        language: messageData.language,
        tokensUsed: messageData.tokensUsed
      });

      const savedMessage = await message.save();
      
      /** @type {ChatMessage} */
      const response = {
        id: savedMessage._id.toString(),
        conversationId: messageData.conversationId,
        userId: savedMessage.userId,
        role: savedMessage.role,
        text: savedMessage.text,
        language: savedMessage.language,
        createdAt: savedMessage.createdAt,
        tokensUsed: savedMessage.tokensUsed
      };

      logger.info('Message created successfully', {
        messageId: response.id,
        conversationId: response.conversationId
      });

      return response;
    } catch (error) {
      logger.error('Error creating message', {
        error: error.message,
        conversationId: messageData.conversationId,
        userId: messageData.userId
      });
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Get recent messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {number} [limit=10] - Number of messages to retrieve
   * @returns {Promise<ChatMessage[]>} Recent messages
   */
  async getRecentMessages(conversationId, limit = 10) {
    try {
      logger.debug('Fetching recent messages', {
        conversationId,
        limit
      });

      const messages = await Message
        .find({ conversationId: new mongoose.Types.ObjectId(conversationId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      /** @type {ChatMessage[]} */
      const response = messages.reverse().map(message => ({
        id: message._id.toString(),
        conversationId,
        userId: message.userId,
        role: message.role,
        text: message.text,
        language: message.language,
        createdAt: message.createdAt,
        tokensUsed: message.tokensUsed,
        ticketCreated: message.ticketCreated,
        ticketId: message.ticketId
      }));

      return response;
    } catch (error) {
      logger.error('Error fetching recent messages', {
        error: error.message,
        conversationId
      });
      throw new Error(`Failed to fetch recent messages: ${error.message}`);
    }
  }

  /**
   * Get messages with pagination
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of messages per page
   * @returns {Promise<ChatMessage[]>} Messages for the page
   */
  async getMessages(conversationId, { page, limit }) {
    try {
      logger.debug('Fetching messages with pagination', {
        conversationId,
        page,
        limit
      });

      const skip = (page - 1) * limit;

      const messages = await Message
        .find({ conversationId: new mongoose.Types.ObjectId(conversationId) })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      /** @type {ChatMessage[]} */
      const response = messages.map(message => ({
        id: message._id.toString(),
        conversationId,
        userId: message.userId,
        role: message.role,
        text: message.text,
        language: message.language,
        createdAt: message.createdAt,
        tokensUsed: message.tokensUsed,
        ticketCreated: message.ticketCreated,
        ticketId: message.ticketId
      }));

      return response;
    } catch (error) {
      logger.error('Error fetching messages', {
        error: error.message,
        conversationId,
        page,
        limit
      });
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  /**
   * Get total message count for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<number>} Total message count
   */
  async getMessageCount(conversationId) {
    try {
      const count = await Message.countDocuments({
        conversationId: new mongoose.Types.ObjectId(conversationId)
      });

      return count;
    } catch (error) {
      logger.error('Error getting message count', {
        error: error.message,
        conversationId
      });
      throw new Error(`Failed to get message count: ${error.message}`);
    }
  }

  /**
   * Update a message
   * @param {string} messageId - Message ID
   * @param {Object} updateData - Data to update
   * @param {boolean} [updateData.ticketCreated] - Whether a ticket was created
   * @param {string} [updateData.ticketId] - Associated ticket ID
   * @returns {Promise<ChatMessage>} Updated message
   */
  async updateMessage(messageId, updateData) {
    try {
      logger.debug('Updating message', {
        messageId,
        updateData
      });

      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { new: true }
      ).lean();

      if (!updatedMessage) {
        throw new Error('Message not found');
      }

      /** @type {ChatMessage} */
      const response = {
        id: updatedMessage._id.toString(),
        conversationId: updatedMessage.conversationId.toString(),
        userId: updatedMessage.userId,
        role: updatedMessage.role,
        text: updatedMessage.text,
        language: updatedMessage.language,
        createdAt: updatedMessage.createdAt,
        tokensUsed: updatedMessage.tokensUsed,
        ticketCreated: updatedMessage.ticketCreated,
        ticketId: updatedMessage.ticketId
      };

      logger.info('Message updated successfully', {
        messageId: response.id
      });

      return response;
    } catch (error) {
      logger.error('Error updating message', {
        error: error.message,
        messageId
      });
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }

  /**
   * Get conversation statistics
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation statistics
   */
  async getConversationStats(conversationId) {
    try {
      const stats = await Message.aggregate([
        { $match: { conversationId: new mongoose.Types.ObjectId(conversationId) } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            totalTokens: { $sum: { $ifNull: ['$tokensUsed', 0] } },
            firstMessage: { $min: '$createdAt' },
            lastMessage: { $max: '$createdAt' },
            ticketsCreated: {
              $sum: {
                $cond: [{ $eq: ['$ticketCreated', true] }, 1, 0]
              }
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          totalMessages: 0,
          totalTokens: 0,
          firstMessage: null,
          lastMessage: null,
          ticketsCreated: 0
        };
      }

      return stats[0];
    } catch (error) {
      logger.error('Error getting conversation stats', {
        error: error.message,
        conversationId
      });
      throw new Error(`Failed to get conversation stats: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new MessageService();
