/**
 * TicketService for Shrooms Support Bot
 * Handles ticket CRUD operations with full type safety
 * @file server/services/ticketing.js
 */

const mongoose = require('mongoose');
const Ticket = require('../models/ticket');
const logger = require('../utils/logger');
const {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  isValidStatus,
  isValidPriority,
  isValidCategory,
  validateTicketData
} = require('../types/ticket');

/**
 * @typedef {import('../types/index.js').Ticket} TicketType
 * @typedef {import('../types/index.js').PaginatedResponse} PaginatedResponse
 * @typedef {import('../types/index.js').SuccessResponse} SuccessResponse
 * @typedef {import('../types/index.js').ErrorResponse} ErrorResponse
 * @typedef {import('../types/ticket.js').TicketCreateData} TicketCreateData
 * @typedef {import('../types/ticket.js').TicketUpdateData} TicketUpdateData
 * @typedef {import('../types/ticket.js').TicketFilter} TicketFilter
 * @typedef {import('../types/ticket.js').TicketQueryOptions} TicketQueryOptions
 */

/**
 * TicketService class for managing tickets
 */
class TicketService {
  /**
   * Create a new ticket
   * @param {TicketCreateData} ticketData - Ticket creation data
   * @returns {Promise<TicketType>} Created ticket
   * @throws {Error} If ticket creation fails
   */
  async createTicket(ticketData) {
    try {
      // Validate input data using the utility function
      const validation = validateTicketData(ticketData);
      if (!validation.isValid) {
        throw new Error(`Validation errors: ${validation.errors.join(', ')}`);
      }

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
   * @param {TicketFilter} [filter={}] - MongoDB filter object
   * @param {TicketQueryOptions} [options={}] - Query options
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

      // Removed .populate('conversation') since Conversation model doesn't exist
      const ticket = await Ticket.findOne(query);

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
   * @param {TicketUpdateData} updateData - Data to update
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
   * @param {import('../types/ticket.js').SearchOptions} [options={}] - Search options
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
   * @param {import('../types/ticket.js').AssignedTicketsOptions} [options={}] - Query options
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

// Export the class itself
module.exports = TicketService;

// Also export as named export for consistency
module.exports.TicketService = TicketService;

// Export enums and validators as static properties
TicketService.TicketStatus = TicketStatus;
TicketService.TicketPriority = TicketPriority;
TicketService.TicketCategory = TicketCategory;
TicketService.isValidStatus = isValidStatus;
TicketService.isValidPriority = isValidPriority;
TicketService.isValidCategory = isValidCategory;