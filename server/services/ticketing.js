/**
 * TicketService for Shrooms Support Bot
 * Handles ticket CRUD operations with full type safety
 * @file server/services/ticketing.js
 */

const mongoose = require('mongoose');
const Ticket = require('../models/ticket');
const logger = require('../utils/logger');

/**
 * @typedef {import('../types/index.js').Ticket} TicketType
 * @typedef {import('../types/index.js').PaginatedResponse} PaginatedResponse
 * @typedef {import('../types/index.js').SuccessResponse} SuccessResponse
 * @typedef {import('../types/index.js').ErrorResponse} ErrorResponse
 */

/**
 * Enum for ticket statuses
 * @readonly
 * @enum {string}
 */
const TicketStatus = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
});

/**
 * Enum for ticket priorities
 * @readonly
 * @enum {string}
 */
const TicketPriority = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
});

/**
 * Enum for ticket categories
 * @readonly
 * @enum {string}
 */
const TicketCategory = Object.freeze({
  TECHNICAL: 'technical',
  ACCOUNT: 'account',
  BILLING: 'billing',
  FEATURE: 'feature',
  OTHER: 'other'
});

/**
 * Type guard to check if a value is a valid ticket status
 * @param {any} value - Value to check
 * @returns {value is TicketStatus} True if value is a valid ticket status
 */
function isValidStatus(value) {
  return Object.values(TicketStatus).includes(value);
}

/**
 * Type guard to check if a value is a valid ticket priority
 * @param {any} value - Value to check
 * @returns {value is TicketPriority} True if value is a valid ticket priority
 */
function isValidPriority(value) {
  return Object.values(TicketPriority).includes(value);
}

/**
 * Type guard to check if a value is a valid ticket category
 * @param {any} value - Value to check
 * @returns {value is TicketCategory} True if value is a valid ticket category
 */
function isValidCategory(value) {
  return Object.values(TicketCategory).includes(value);
}

/**
 * Helper to validate ticket data
 * @param {Object} ticketData - Ticket data to validate
 * @throws {Error} If ticket data is invalid
 */
function validateTicketData(ticketData) {
  const errors = [];

  if (!ticketData.userId || typeof ticketData.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!ticketData.conversationId) {
    errors.push('conversationId is required');
  }

  if (!ticketData.subject || typeof ticketData.subject !== 'string') {
    errors.push('subject is required and must be a string');
  }

  if (!ticketData.initialMessage || typeof ticketData.initialMessage !== 'string') {
    errors.push('initialMessage is required and must be a string');
  }

  if (ticketData.status && !isValidStatus(ticketData.status)) {
    errors.push(`Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`);
  }

  if (ticketData.priority && !isValidPriority(ticketData.priority)) {
    errors.push(`Invalid priority. Must be one of: ${Object.values(TicketPriority).join(', ')}`);
  }

  if (ticketData.category && !isValidCategory(ticketData.category)) {
    errors.push(`Invalid category. Must be one of: ${Object.values(TicketCategory).join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors: ${errors.join(', ')}`);
  }
}

/**
 * TicketService class for managing tickets
 */
class TicketService {
  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket creation data
   * @param {string} ticketData.userId - User ID who created the ticket
   * @param {string} ticketData.conversationId - Associated conversation ID
   * @param {string} ticketData.subject - Ticket subject
   * @param {string} ticketData.initialMessage - Initial message or description
   * @param {string} [ticketData.context] - Context from the conversation
   * @param {string} [ticketData.language='en'] - Ticket language
   * @param {string} [ticketData.priority='medium'] - Ticket priority
   * @param {string} [ticketData.category='other'] - Ticket category
   * @param {string} [ticketData.email] - User email
   * @returns {Promise<TicketType>} Created ticket
   * @throws {Error} If ticket creation fails
   */
  async createTicket(ticketData) {
    try {
      // Validate input data
      validateTicketData(ticketData);

      // Set defaults
      const ticket = new Ticket({
        userId: ticketData.userId,
        conversationId: ticketData.conversationId,
        subject: ticketData.subject,
        initialMessage: ticketData.initialMessage,
        context: ticketData.context || '',
        language: ticketData.language || 'en',
        priority: ticketData.priority || TicketPriority.MEDIUM,
        category: ticketData.category || TicketCategory.OTHER,
        email: ticketData.email,
        status: TicketStatus.OPEN
      });

      const savedTicket = await ticket.save();
      
      logger.info(`Ticket created successfully: ${savedTicket.ticketId}`, {
        ticketId: savedTicket.ticketId,
        userId: savedTicket.userId
      });

      return savedTicket;
    } catch (error) {
      logger.error(`Failed to create ticket: ${error.message}`, {
        userId: ticketData?.userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get tickets with pagination and filtering
   * @param {Object} [filter={}] - MongoDB filter object
   * @param {string} [filter.status] - Filter by ticket status
   * @param {string} [filter.priority] - Filter by ticket priority
   * @param {string} [filter.category] - Filter by ticket category
   * @param {string} [filter.assignedTo] - Filter by assigned agent
   * @param {string} [filter.userId] - Filter by user ID
   * @param {Object} [options={}] - Query options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @param {string} [options.sort='-createdAt'] - Sort order
   * @returns {Promise<PaginatedResponse>} Paginated tickets
   */
  async getTickets(filter = {}, options = {}) {
    try {
      // Validate filter values
      if (filter.status && !isValidStatus(filter.status)) {
        throw new Error(`Invalid status filter: ${filter.status}`);
      }
      if (filter.priority && !isValidPriority(filter.priority)) {
        throw new Error(`Invalid priority filter: ${filter.priority}`);
      }
      if (filter.category && !isValidCategory(filter.category)) {
        throw new Error(`Invalid category filter: ${filter.category}`);
      }

      const result = await Ticket.findWithPagination(filter, options);

      logger.info(`Retrieved ${result.tickets.length} tickets`, {
        filter,
        total: result.total,
        page: result.page
      });

      return {
        items: result.tickets,
        totalCount: result.total,
        page: result.page,
        totalPages: result.pages,
        limit: options.limit || 20
      };
    } catch (error) {
      logger.error(`Failed to get tickets: ${error.message}`, { filter, options });
      throw error;
    }
  }

  /**
   * Get a single ticket by ID
   * @param {string} ticketId - Ticket ID or MongoDB ObjectId
   * @returns {Promise<TicketType|null>} Found ticket or null
   */
  async getTicketById(ticketId) {
    try {
      // Support both ticketId and MongoDB _id
      const query = mongoose.Types.ObjectId.isValid(ticketId) 
        ? { _id: ticketId }
        : { ticketId };

      const ticket = await Ticket.findOne(query).populate('conversation');

      if (!ticket) {
        logger.warn(`Ticket not found: ${ticketId}`);
        return null;
      }

      logger.info(`Retrieved ticket: ${ticket.ticketId}`);
      return ticket;
    } catch (error) {
      logger.error(`Failed to get ticket: ${error.message}`, { ticketId });
      throw error;
    }
  }

  /**
   * Update a ticket
   * @param {string} ticketId - Ticket ID or MongoDB ObjectId
   * @param {Object} updateData - Data to update
   * @param {string} [updateData.status] - New ticket status
   * @param {string} [updateData.priority] - New ticket priority
   * @param {string} [updateData.category] - New ticket category
   * @param {string} [updateData.assignedTo] - Assign to agent
   * @param {string} [updateData.resolution] - Resolution text
   * @param {string} [updateData.subject] - Update subject
   * @returns {Promise<TicketType|null>} Updated ticket or null if not found
   * @throws {Error} If update fails or data is invalid
   */
  async updateTicket(ticketId, updateData) {
    try {
      // Validate update data
      if (updateData.status && !isValidStatus(updateData.status)) {
        throw new Error(`Invalid status: ${updateData.status}`);
      }
      if (updateData.priority && !isValidPriority(updateData.priority)) {
        throw new Error(`Invalid priority: ${updateData.priority}`);
      }
      if (updateData.category && !isValidCategory(updateData.category)) {
        throw new Error(`Invalid category: ${updateData.category}`);
      }

      // Support both ticketId and MongoDB _id
      const query = mongoose.Types.ObjectId.isValid(ticketId) 
        ? { _id: ticketId }
        : { ticketId };

      // Remove undefined values
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      const ticket = await Ticket.findOneAndUpdate(
        query,
        cleanUpdateData,
        { new: true, runValidators: true }
      );

      if (!ticket) {
        logger.warn(`Ticket not found for update: ${ticketId}`);
        return null;
      }

      logger.info(`Ticket updated successfully: ${ticket.ticketId}`, {
        ticketId: ticket.ticketId,
        updates: Object.keys(cleanUpdateData)
      });

      return ticket;
    } catch (error) {
      logger.error(`Failed to update ticket: ${error.message}`, { 
        ticketId, 
        updateData: Object.keys(updateData || {})
      });
      throw error;
    }
  }

  /**
   * Close a ticket with optional resolution
   * @param {string} ticketId - Ticket ID or MongoDB ObjectId
   * @param {string} [resolution] - Resolution text
   * @param {string} [closedBy] - Who closed the ticket
   * @returns {Promise<TicketType|null>} Closed ticket or null if not found
   */
  async closeTicket(ticketId, resolution = null, closedBy = null) {
    try {
      const updateData = {
        status: TicketStatus.CLOSED,
        resolvedAt: new Date()
      };

      if (resolution) {
        updateData.resolution = resolution;
      }

      if (closedBy) {
        updateData.assignedTo = closedBy;
      }

      const ticket = await this.updateTicket(ticketId, updateData);

      if (ticket) {
        logger.info(`Ticket closed: ${ticket.ticketId}`, {
          ticketId: ticket.ticketId,
          closedBy,
          hasResolution: !!resolution
        });
      }

      return ticket;
    } catch (error) {
      logger.error(`Failed to close ticket: ${error.message}`, { ticketId });
      throw error;
    }
  }

  /**
   * Get tickets by status
   * @param {TicketStatus} status - Ticket status
   * @param {Object} [options={}] - Query options
   * @param {string} [options.assignedTo] - Filter by assigned agent
   * @param {number} [options.limit=50] - Maximum number of results
   * @returns {Promise<Array<TicketType>>} Array of tickets
   */
  async getTicketsByStatus(status, options = {}) {
    try {
      if (!isValidStatus(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const tickets = await Ticket.findByStatus(status, options);

      logger.info(`Retrieved ${tickets.length} tickets with status: ${status}`, {
        status,
        assignedTo: options.assignedTo || 'all'
      });

      return tickets;
    } catch (error) {
      logger.error(`Failed to get tickets by status: ${error.message}`, { status });
      throw error;
    }
  }

  /**
   * Get ticket statistics
   * @returns {Promise<Object>} Ticket statistics by status, category, and priority
   */
  async getTicketStatistics() {
    try {
      const stats = await Ticket.getStatistics();

      logger.info('Retrieved ticket statistics', {
        totalTickets: Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
      });

      return stats;
    } catch (error) {
      logger.error(`Failed to get ticket statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search tickets by text in subject or initial message
   * @param {string} searchTerm - Search term
   * @param {Object} [options={}] - Search options
   * @param {number} [options.limit=20] - Maximum results
   * @param {TicketStatus} [options.status] - Filter by status
   * @returns {Promise<Array<TicketType>>} Array of matching tickets
   */
  async searchTickets(searchTerm, options = {}) {
    try {
      if (!searchTerm || typeof searchTerm !== 'string') {
        throw new Error('Search term is required and must be a string');
      }

      const { limit = 20, status } = options;
      
      // Build search query
      const query = {
        $or: [
          { subject: { $regex: searchTerm, $options: 'i' } },
          { initialMessage: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      // Add status filter if provided
      if (status) {
        if (!isValidStatus(status)) {
          throw new Error(`Invalid status: ${status}`);
        }
        query.status = status;
      }

      const tickets = await Ticket.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      logger.info(`Found ${tickets.length} tickets matching search: "${searchTerm}"`, {
        searchTerm: searchTerm.substring(0, 50),
        resultCount: tickets.length,
        status
      });

      return tickets;
    } catch (error) {
      logger.error(`Failed to search tickets: ${error.message}`, { searchTerm });
      throw error;
    }
  }

  /**
   * Get tickets for a specific user
   * @param {string} userId - User ID
   * @param {Object} [options={}] - Query options
   * @param {number} [options.limit=20] - Maximum results
   * @param {TicketStatus} [options.status] - Filter by status
   * @returns {Promise<Array<TicketType>>} Array of user's tickets
   */
  async getUserTickets(userId, options = {}) {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('userId is required and must be a string');
      }

      const { limit = 20, status } = options;
      
      const query = { userId };
      
      if (status) {
        if (!isValidStatus(status)) {
          throw new Error(`Invalid status: ${status}`);
        }
        query.status = status;
      }

      const tickets = await Ticket.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      logger.info(`Retrieved ${tickets.length} tickets for user: ${userId}`, {
        userId,
        resultCount: tickets.length,
        status
      });

      return tickets;
    } catch (error) {
      logger.error(`Failed to get user tickets: ${error.message}`, { userId });
      throw error;
    }
  }

  /**
   * Assign a ticket to an agent
   * @param {string} ticketId - Ticket ID or MongoDB ObjectId
   * @param {string} agentId - Agent ID to assign to
   * @returns {Promise<TicketType|null>} Updated ticket or null if not found
   */
  async assignTicket(ticketId, agentId) {
    try {
      if (!agentId || typeof agentId !== 'string') {
        throw new Error('agentId is required and must be a string');
      }

      const ticket = await this.updateTicket(ticketId, {
        assignedTo: agentId,
        status: TicketStatus.IN_PROGRESS
      });

      if (ticket) {
        logger.info(`Ticket assigned: ${ticket.ticketId} to ${agentId}`, {
          ticketId: ticket.ticketId,
          agentId
        });
      }

      return ticket;
    } catch (error) {
      logger.error(`Failed to assign ticket: ${error.message}`, { ticketId, agentId });
      throw error;
    }
  }

  /**
   * Get tickets assigned to a specific agent
   * @param {string} agentId - Agent ID
   * @param {Object} [options={}] - Query options
   * @param {TicketStatus} [options.status=IN_PROGRESS] - Filter by status
   * @param {number} [options.limit=50] - Maximum results
   * @returns {Promise<Array<TicketType>>} Array of assigned tickets
   */
  async getAssignedTickets(agentId, options = {}) {
    try {
      if (!agentId || typeof agentId !== 'string') {
        throw new Error('agentId is required and must be a string');
      }

      const { status = TicketStatus.IN_PROGRESS, limit = 50 } = options;

      if (!isValidStatus(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const tickets = await Ticket.findByStatus(status, { 
        assignedTo: agentId, 
        limit 
      });

      logger.info(`Retrieved ${tickets.length} assigned tickets for agent: ${agentId}`, {
        agentId,
        status,
        resultCount: tickets.length
      });

      return tickets;
    } catch (error) {
      logger.error(`Failed to get assigned tickets: ${error.message}`, { agentId });
      throw error;
    }
  }
}

// Create and export singleton instance
const ticketService = new TicketService();

// Export enums for use in other modules
ticketService.TicketStatus = TicketStatus;
ticketService.TicketPriority = TicketPriority;
ticketService.TicketCategory = TicketCategory;

// Export type guards for validation
ticketService.isValidStatus = isValidStatus;
ticketService.isValidPriority = isValidPriority;
ticketService.isValidCategory = isValidCategory;

module.exports = ticketService;