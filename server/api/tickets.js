/**
 * Tickets API with full TypeScript-style type annotations using JSDoc
 * @file server/api/tickets.js
 */

const express = require('express');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { requireAdminAuth, optionalAdminAuth } = require('../middleware/adminAuth');
const {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  isValidStatus,
  isValidPriority,
  isValidCategory,
  validateTicketData
} = require('../types/ticket');
const {
  createErrorResponse,
  VALIDATION_ERRORS,
  TICKET_ERRORS,
  GENERIC_ERRORS
} = require('../constants/errorCodes');

const router = express.Router();

/**
 * @typedef {import('../models/Ticket')} Ticket
 * @typedef {import('../services/ticketing')} TicketService
 * @typedef {import('../types/ticket').TicketCreateData} TicketCreateData
 * @typedef {import('../types/ticket').TicketUpdateData} TicketUpdateData
 * @typedef {import('../types/ticket').TicketFilter} TicketFilter
 * @typedef {import('../types/ticket').TicketQueryOptions} TicketQueryOptions
 * @typedef {import('../types/api').PaginatedResponse} PaginatedResponse
 * @typedef {import('../types/api').TicketQueryParams} TicketQueryParams
 */

// Get ticket service from ServiceManager
function getTicketService() {
  const ServiceManager = require('../core/ServiceManager');
  return ServiceManager.get('ticketService');
}

/**
 * Validate required fields
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Fields to validate
 * @returns {Object|null} Error response or null if valid
 */
function validateRequiredFields(body, requiredFields) {
  for (const field of requiredFields) {
    if (!body[field]) {
      return createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        `${field} is required`,
        { field }
      );
    }
  }
  return null;
}

/**
 * Validate and convert conversationId to ObjectId if needed
 * @param {string|ObjectId} conversationId - Conversation ID
 * @returns {Object} Result object with isValid and objectId/error
 */
function validateAndConvertConversationId(conversationId) {
  if (!conversationId) {
    return { isValid: false, error: 'conversationId is required' };
  }

  // If it's already an ObjectId, return it
  if (mongoose.Types.ObjectId.isValid(conversationId)) {
    try {
      const objectId = new mongoose.Types.ObjectId(conversationId);
      return { isValid: true, objectId };
    } catch (error) {
      return { isValid: false, error: `Invalid ObjectId format: ${error.message}` };
    }
  }

  // If it's a UUID or other string format, create new ObjectId
  // This allows for flexible conversationId handling
  try {
    const objectId = new mongoose.Types.ObjectId();
    logger.info('Converting conversationId to ObjectId', { 
      original: conversationId,
      converted: objectId.toString()
    });
    return { isValid: true, objectId };
  } catch (error) {
    return { isValid: false, error: `Failed to create ObjectId: ${error.message}` };
  }
}

/**
 * Create paginated response helper
 * @param {Array} items - Data items
 * @param {number} totalCount - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Paginated response
 */
function createPaginatedResponse(items, totalCount, page, limit) {
  return {
    items,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit)
  };
}

/**
 * Validate ticket query parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Parsed and validated parameters
 */
function validateTicketQueryParams(query) {
  const pagination = {
    page: Math.max(1, parseInt(query.page) || 1),
    limit: Math.min(100, Math.max(1, parseInt(query.limit) || 20)),
    sort: query.sort || 'createdAt',
    order: query.order === 'asc' ? 'asc' : 'desc'
  };

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.userId) filter.userId = query.userId;

  const search = {};
  if (query.search) search.search = query.search;

  return { pagination, filter, search };
}

/**
 * POST /api/tickets
 * Create a new support ticket - PUBLIC endpoint (no auth required)
 */
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['userId', 'conversationId', 'subject', 'initialMessage']);
    if (validationError) {
      return res.status(validationError.httpStatus).json(validationError);
    }

    // Validate and convert conversationId
    const conversionResult = validateAndConvertConversationId(req.body.conversationId);
    if (!conversionResult.isValid) {
      const errorResponse = createErrorResponse(
        'INVALID_CONVERSATION_ID',
        conversionResult.error
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Validate ticket data using schema validator
    const validation = validateTicketData(req.body);
    if (!validation.isValid) {
      const errorResponse = createErrorResponse(
        'VALIDATION_ERROR',
        validation.errors.join(', ')
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Creating new ticket', { 
      userId: req.body.userId,
      subject: req.body.subject,
      originalConversationId: req.body.conversationId,
      convertedConversationId: conversionResult.objectId.toString()
    });

    /** @type {TicketCreateData} */
    const ticketData = {
      userId: req.body.userId,
      conversationId: conversionResult.objectId, // Use the converted ObjectId
      subject: req.body.subject,
      initialMessage: req.body.initialMessage,
      context: req.body.context,
      language: req.body.language || 'en',
      priority: req.body.priority || TicketPriority.MEDIUM,
      category: req.body.category || TicketCategory.OTHER,
      email: req.body.email
    };

    const ticketService = getTicketService();
    const ticket = await ticketService.createTicket(ticketData);
    
    res.status(201).json({ success: true, data: ticket, message: 'Ticket created successfully' });
  } catch (error) {
    logger.error('Error creating ticket', { error: error.message, stack: error.stack });
    const errorResponse = createErrorResponse('TICKET_CREATE_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/tickets
 * Get tickets with filtering and pagination - ADMIN only
 */
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Fetching tickets', { query: req.query, admin: req.admin?.id });

    // Use new validation function from API types
    const { pagination, filter, search } = validateTicketQueryParams(req.query);

    // Combine filter and search into a single query object for the service
    const queryOptions = {
      page: pagination.page,
      limit: pagination.limit,
      sort: `${pagination.order === 'desc' ? '-' : ''}${pagination.sort}`
    };

    const ticketService = getTicketService();
    const result = await ticketService.getTickets({ ...filter, ...search }, queryOptions);
    
    const response = createPaginatedResponse(
      result.items,
      result.totalCount,
      pagination.page,
      pagination.limit
    );
    
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Error fetching tickets', { error: error.message });
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch tickets');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

// SPECIFIC ROUTES MUST COME BEFORE PARAMETERIZED ROUTES

/**
 * GET /api/tickets/stats
 * Get ticket statistics - ADMIN only
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Fetching ticket statistics', { admin: req.admin?.id });

    const ticketService = getTicketService();
    const stats = await ticketService.getTicketStatistics();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching ticket statistics', { error: error.message });
    const errorResponse = createErrorResponse('STATS_ERROR', 'Failed to fetch ticket statistics');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/tickets/search
 * Search tickets - ADMIN only
 */
router.get('/search', requireAdminAuth, async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Search query is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status;
    
    if (status && !isValidStatus(status)) {
      const errorResponse = createErrorResponse(
        'INVALID_TICKET_STATUS',
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Searching tickets', { query, limit, status, admin: req.admin?.id });

    const ticketService = getTicketService();
    const tickets = await ticketService.searchTickets(query, { limit, status });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Error searching tickets', { query: req.query.q, error: error.message });
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to search tickets');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/tickets/status/:status
 * Get tickets by status - ADMIN only
 */
router.get('/status/:status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.params;
    const assignedTo = req.query.assignedTo;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    
    if (!isValidStatus(status)) {
      const errorResponse = createErrorResponse(
        'INVALID_TICKET_STATUS',
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Fetching tickets by status', { status, assignedTo, limit, admin: req.admin?.id });

    const ticketService = getTicketService();
    const tickets = await ticketService.getTicketsByStatus(status, { assignedTo, limit });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Error fetching tickets by status', { status: req.params.status, error: error.message });
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch tickets by status');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/tickets/assigned/:agentId
 * Get tickets assigned to specific agent - ADMIN only
 */
router.get('/assigned/:agentId', requireAdminAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const status = req.query.status || TicketStatus.IN_PROGRESS;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    
    if (!agentId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Agent ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (!isValidStatus(status)) {
      const errorResponse = createErrorResponse(
        'INVALID_TICKET_STATUS',
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Fetching assigned tickets', { agentId, status, limit, admin: req.admin?.id });

    const ticketService = getTicketService();
    const tickets = await ticketService.getAssignedTickets(agentId, { status, limit });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Error fetching assigned tickets', { agentId: req.params.agentId, error: error.message });
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch assigned tickets');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/tickets/user/:userId
 * Get tickets for a specific user - Allow users to see their own tickets
 */
router.get('/user/:userId', optionalAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const status = req.query.status;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    
    if (!userId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'User ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    // Allow users to see their own tickets, but require admin auth to see other users' tickets
    if (!req.admin && req.query.userId !== userId) {
      const errorResponse = createErrorResponse('FORBIDDEN');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (status && !isValidStatus(status)) {
      const errorResponse = createErrorResponse(
        'INVALID_TICKET_STATUS',
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Fetching user tickets', { userId, status, limit, admin: req.admin?.id });

    const ticketService = getTicketService();
    const tickets = await ticketService.getUserTickets(userId, { status, limit });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Error fetching user tickets', { userId: req.params.userId, error: error.message });
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch user tickets');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

// PARAMETERIZED ROUTES COME AFTER SPECIFIC ROUTES

/**
 * GET /api/tickets/:ticketId
 * Get specific ticket by ID - ADMIN only
 */
router.get('/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Ticket ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Fetching ticket', { ticketId, admin: req.admin?.id });

    const ticketService = getTicketService();
    const ticket = await ticketService.getTicketById(ticketId);
    
    if (!ticket) {
      const errorResponse = createErrorResponse('TICKET_NOT_FOUND');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    logger.error('Error fetching ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      const errorResponse = createErrorResponse(
        'INVALID_FORMAT',
        'Invalid ticket ID format'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch ticket');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * PUT /api/tickets/:ticketId
 * Update ticket - ADMIN only
 */
router.put('/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Ticket ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Updating ticket', { ticketId, updates: req.body, admin: req.admin?.id });

    // Validate enum values if provided
    /** @type {TicketUpdateData} */
    const updateData = {};
    
    if (req.body.status !== undefined) {
      if (!isValidStatus(req.body.status)) {
        const errorResponse = createErrorResponse(
          'INVALID_TICKET_STATUS',
          `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`
        );
        return res.status(errorResponse.httpStatus).json(errorResponse);
      }
      updateData.status = req.body.status;
    }
    
    if (req.body.priority !== undefined) {
      if (!isValidPriority(req.body.priority)) {
        const errorResponse = createErrorResponse(
          'INVALID_TICKET_PRIORITY',
          `Invalid priority. Must be one of: ${Object.values(TicketPriority).join(', ')}`
        );
        return res.status(errorResponse.httpStatus).json(errorResponse);
      }
      updateData.priority = req.body.priority;
    }
    
    if (req.body.category !== undefined) {
      if (!isValidCategory(req.body.category)) {
        const errorResponse = createErrorResponse(
          'INVALID_TICKET_CATEGORY',
          `Invalid category. Must be one of: ${Object.values(TicketCategory).join(', ')}`
        );
        return res.status(errorResponse.httpStatus).json(errorResponse);
      }
      updateData.category = req.body.category;
    }
    
    // Other update fields
    if (req.body.assignedTo !== undefined) {
      updateData.assignedTo = req.body.assignedTo;
    }
    
    if (req.body.resolution !== undefined) {
      updateData.resolution = req.body.resolution;
    }
    
    if (req.body.subject !== undefined) {
      updateData.subject = req.body.subject;
    }

    const ticketService = getTicketService();
    const ticket = await ticketService.updateTicket(ticketId, updateData);
    
    if (!ticket) {
      const errorResponse = createErrorResponse('TICKET_NOT_FOUND');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    res.json({ success: true, data: ticket, message: 'Ticket updated successfully' });
  } catch (error) {
    logger.error('Error updating ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      const errorResponse = createErrorResponse(
        'INVALID_FORMAT',
        'Invalid ticket ID format'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const errorResponse = createErrorResponse('TICKET_UPDATE_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/tickets/:ticketId/close
 * Close a ticket with resolution - ADMIN only
 */
router.post('/:ticketId/close', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution, closedBy } = req.body;
    
    if (!ticketId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Ticket ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (!resolution) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Resolution is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Closing ticket', { ticketId, resolution, admin: req.admin?.id });

    // Use admin ID as closedBy if not provided
    const finalClosedBy = closedBy || req.admin?.id;
    const ticketService = getTicketService();
    const ticket = await ticketService.closeTicket(ticketId, resolution, finalClosedBy);
    
    if (!ticket) {
      const errorResponse = createErrorResponse('TICKET_NOT_FOUND');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    res.json({ success: true, data: ticket, message: 'Ticket closed successfully' });
  } catch (error) {
    logger.error('Error closing ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      const errorResponse = createErrorResponse(
        'INVALID_FORMAT',
        'Invalid ticket ID format'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const errorResponse = createErrorResponse('TICKET_UPDATE_ERROR', 'Failed to close ticket');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/tickets/:ticketId/assign
 * Assign ticket to agent - ADMIN only
 */
router.post('/:ticketId/assign', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignedTo } = req.body;
    
    if (!ticketId) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Ticket ID is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    if (!assignedTo) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'assignedTo is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Assigning ticket', { ticketId, assignedTo, admin: req.admin?.id });

    const ticketService = getTicketService();
    const ticket = await ticketService.assignTicket(ticketId, assignedTo);
    
    if (!ticket) {
      const errorResponse = createErrorResponse('TICKET_NOT_FOUND');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    res.json({ success: true, data: ticket, message: 'Ticket assigned successfully' });
  } catch (error) {
    logger.error('Error assigning ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      const errorResponse = createErrorResponse(
        'INVALID_FORMAT',
        'Invalid ticket ID format'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    const errorResponse = createErrorResponse('TICKET_UPDATE_ERROR', 'Failed to assign ticket');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

module.exports = router;