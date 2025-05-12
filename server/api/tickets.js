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
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  validateRequiredFields,
  validatePaginationOptions,
  validateTicketQueryParams
} = require('../types/api');

const router = express.Router();

/**
 * @typedef {import('../models/Ticket')} Ticket
 * @typedef {import('../services/ticketing')} TicketService
 * @typedef {import('../types/ticket').TicketCreateData} TicketCreateData
 * @typedef {import('../types/ticket').TicketUpdateData} TicketUpdateData
 * @typedef {import('../types/ticket').TicketFilter} TicketFilter
 * @typedef {import('../types/ticket').TicketQueryOptions} TicketQueryOptions
 * @typedef {import('../types/api').ApiResponse} ApiResponse
 * @typedef {import('../types/api').PaginatedResponse} PaginatedResponse
 * @typedef {import('../types/api').TicketQueryParams} TicketQueryParams
 */

// Lazy load services to avoid circular dependencies
let ticketService;
function getTicketService() {
  if (!ticketService) {
    ticketService = require('../services/ticketing');
  }
  return ticketService;
}

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - conversationId
 *               - subject
 *               - initialMessage
 *             properties:
 *               userId:
 *                 type: string
 *               conversationId:
 *                 type: string
 *               subject:
 *                 type: string
 *               initialMessage:
 *                 type: string
 *               context:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: ['en', 'es', 'ru']
 *               priority:
 *                 type: string
 *                 enum: ['low', 'medium', 'high', 'urgent']
 *               category:
 *                 type: string
 *                 enum: ['technical', 'account', 'billing', 'feature', 'other']
 *               email:
 *                 type: string
 */
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['userId', 'conversationId', 'subject', 'initialMessage']);
    if (validationError) {
      return res.status(validationError.statusCode).json(validationError);
    }

    // Validate ticket data using schema validator
    const validation = validateTicketData(req.body);
    if (!validation.isValid) {
      const errorResponse = createErrorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        400
      );
      errorResponse.error = validation.errors.join(', ');
      return res.status(400).json(errorResponse);
    }

    logger.info('Creating new ticket', { 
      userId: req.body.userId,
      subject: req.body.subject 
    });

    /** @type {TicketCreateData} */
    const ticketData = {
      userId: req.body.userId,
      conversationId: req.body.conversationId,
      subject: req.body.subject,
      initialMessage: req.body.initialMessage,
      context: req.body.context,
      language: req.body.language || 'en',
      priority: req.body.priority || TicketPriority.MEDIUM,
      category: req.body.category || TicketCategory.OTHER,
      email: req.body.email
    };

    const ticket = await getTicketService().createTicket(ticketData);
    
    res.status(201).json(createSuccessResponse(ticket, 'Ticket created successfully'));
  } catch (error) {
    logger.error('Error creating ticket', { error: error.message });
    res.status(500).json(createErrorResponse('Failed to create ticket'));
  }
});

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Get tickets with filtering and pagination
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['open', 'in_progress', 'resolved', 'closed']
 *         description: Filter by ticket status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: ['low', 'medium', 'high', 'urgent']
 *         description: Filter by ticket priority
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: ['technical', 'account', 'billing', 'feature', 'other']
 *         description: Filter by ticket category
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assigned agent
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in subject and initial message
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: ['asc', 'desc']
 *         description: Sort order
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

    const result = await getTicketService().getTickets({ ...filter, ...search }, queryOptions);
    
    /** @type {PaginatedResponse} */
    const response = createPaginatedResponse(
      result.items,
      result.totalCount,
      pagination.page,
      pagination.limit
    );
    
    res.json(createSuccessResponse(response));
  } catch (error) {
    logger.error('Error fetching tickets', { error: error.message });
    res.status(500).json(createErrorResponse('Failed to fetch tickets'));
  }
});

/**
 * @swagger
 * /api/tickets/{ticketId}:
 *   get:
 *     summary: Get specific ticket by ID
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      return res.status(400).json(createErrorResponse('Ticket ID is required', 'TICKET_ID_REQUIRED', 400));
    }

    logger.info('Fetching ticket', { ticketId, admin: req.admin?.id });

    const ticket = await getTicketService().getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(404).json(createErrorResponse('Ticket not found', 'TICKET_NOT_FOUND', 404));
    }
    
    res.json(createSuccessResponse(ticket));
  } catch (error) {
    logger.error('Error fetching ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      return res.status(400).json(createErrorResponse('Invalid ticket ID format', 'INVALID_TICKET_ID', 400));
    }
    
    res.status(500).json(createErrorResponse('Failed to fetch ticket'));
  }
});

/**
 * @swagger
 * /api/tickets/{ticketId}:
 *   put:
 *     summary: Update ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ['open', 'in_progress', 'resolved', 'closed']
 *               priority:
 *                 type: string
 *                 enum: ['low', 'medium', 'high', 'urgent']
 *               category:
 *                 type: string
 *                 enum: ['technical', 'account', 'billing', 'feature', 'other']
 *               assignedTo:
 *                 type: string
 *               resolution:
 *                 type: string
 *               subject:
 *                 type: string
 */
router.put('/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      return res.status(400).json(createErrorResponse('Ticket ID is required', 'TICKET_ID_REQUIRED', 400));
    }

    logger.info('Updating ticket', { ticketId, updates: req.body, admin: req.admin?.id });

    // Validate enum values if provided
    /** @type {TicketUpdateData} */
    const updateData = {};
    
    if (req.body.status !== undefined) {
      if (!isValidStatus(req.body.status)) {
        return res.status(400).json(createErrorResponse(
          `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`,
          'INVALID_STATUS',
          400
        ));
      }
      updateData.status = req.body.status;
    }
    
    if (req.body.priority !== undefined) {
      if (!isValidPriority(req.body.priority)) {
        return res.status(400).json(createErrorResponse(
          `Invalid priority. Must be one of: ${Object.values(TicketPriority).join(', ')}`,
          'INVALID_PRIORITY',
          400
        ));
      }
      updateData.priority = req.body.priority;
    }
    
    if (req.body.category !== undefined) {
      if (!isValidCategory(req.body.category)) {
        return res.status(400).json(createErrorResponse(
          `Invalid category. Must be one of: ${Object.values(TicketCategory).join(', ')}`,
          'INVALID_CATEGORY',
          400
        ));
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

    const ticket = await getTicketService().updateTicket(ticketId, updateData);
    
    if (!ticket) {
      return res.status(404).json(createErrorResponse('Ticket not found', 'TICKET_NOT_FOUND', 404));
    }
    
    res.json(createSuccessResponse(ticket, 'Ticket updated successfully'));
  } catch (error) {
    logger.error('Error updating ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      return res.status(400).json(createErrorResponse('Invalid ticket ID format', 'INVALID_TICKET_ID', 400));
    }
    
    res.status(500).json(createErrorResponse('Failed to update ticket'));
  }
});

/**
 * @swagger
 * /api/tickets/{ticketId}/close:
 *   post:
 *     summary: Close a ticket with resolution
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *               closedBy:
 *                 type: string
 */
router.post('/:ticketId/close', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution, closedBy } = req.body;
    
    if (!ticketId) {
      return res.status(400).json(createErrorResponse('Ticket ID is required', 'TICKET_ID_REQUIRED', 400));
    }
    
    if (!resolution) {
      return res.status(400).json(createErrorResponse('Resolution is required', 'RESOLUTION_REQUIRED', 400));
    }

    logger.info('Closing ticket', { ticketId, resolution, admin: req.admin?.id });

    // Use admin ID as closedBy if not provided
    const finalClosedBy = closedBy || req.admin?.id;
    const ticket = await getTicketService().closeTicket(ticketId, resolution, finalClosedBy);
    
    if (!ticket) {
      return res.status(404).json(createErrorResponse('Ticket not found', 'TICKET_NOT_FOUND', 404));
    }
    
    res.json(createSuccessResponse(ticket, 'Ticket closed successfully'));
  } catch (error) {
    logger.error('Error closing ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      return res.status(400).json(createErrorResponse('Invalid ticket ID format', 'INVALID_TICKET_ID', 400));
    }
    
    res.status(500).json(createErrorResponse('Failed to close ticket'));
  }
});

/**
 * @swagger
 * /api/tickets/{ticketId}/assign:
 *   post:
 *     summary: Assign ticket to agent
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 */
router.post('/:ticketId/assign', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignedTo } = req.body;
    
    if (!ticketId) {
      return res.status(400).json(createErrorResponse('Ticket ID is required', 'TICKET_ID_REQUIRED', 400));
    }
    
    if (!assignedTo) {
      return res.status(400).json(createErrorResponse('assignedTo is required', 'ASSIGNED_TO_REQUIRED', 400));
    }

    logger.info('Assigning ticket', { ticketId, assignedTo, admin: req.admin?.id });

    const ticket = await getTicketService().assignTicket(ticketId, assignedTo);
    
    if (!ticket) {
      return res.status(404).json(createErrorResponse('Ticket not found', 'TICKET_NOT_FOUND', 404));
    }
    
    res.json(createSuccessResponse(ticket, 'Ticket assigned successfully'));
  } catch (error) {
    logger.error('Error assigning ticket', { ticketId: req.params.ticketId, error: error.message });
    
    if (error.name === 'CastError') {
      return res.status(400).json(createErrorResponse('Invalid ticket ID format', 'INVALID_TICKET_ID', 400));
    }
    
    res.status(500).json(createErrorResponse('Failed to assign ticket'));
  }
});

/**
 * @swagger
 * /api/tickets/assigned/{agentId}:
 *   get:
 *     summary: Get tickets assigned to specific agent
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['open', 'in_progress', 'resolved', 'closed']
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 */
router.get('/assigned/:agentId', requireAdminAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const status = req.query.status || TicketStatus.IN_PROGRESS;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    
    if (!agentId) {
      return res.status(400).json(createErrorResponse('Agent ID is required', 'AGENT_ID_REQUIRED', 400));
    }
    
    if (!isValidStatus(status)) {
      return res.status(400).json(createErrorResponse(
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`,
        'INVALID_STATUS',
        400
      ));
    }

    logger.info('Fetching assigned tickets', { agentId, status, limit, admin: req.admin?.id });

    const tickets = await getTicketService().getAssignedTickets(agentId, { status, limit });
    
    res.json(createSuccessResponse(tickets));
  } catch (error) {
    logger.error('Error fetching assigned tickets', { agentId: req.params.agentId, error: error.message });
    res.status(500).json(createErrorResponse('Failed to fetch assigned tickets'));
  }
});

/**
 * @swagger
 * /api/tickets/user/{userId}:
 *   get:
 *     summary: Get tickets for a specific user
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['open', 'in_progress', 'resolved', 'closed']
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 */
router.get('/user/:userId', optionalAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const status = req.query.status;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    
    if (!userId) {
      return res.status(400).json(createErrorResponse('User ID is required', 'USER_ID_REQUIRED', 400));
    }
    
    // Allow users to see their own tickets, but require admin auth to see other users' tickets
    if (!req.admin && req.query.userId !== userId) {
      return res.status(403).json(createErrorResponse('Access denied', 'FORBIDDEN', 403));
    }
    
    if (status && !isValidStatus(status)) {
      return res.status(400).json(createErrorResponse(
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`,
        'INVALID_STATUS',
        400
      ));
    }

    logger.info('Fetching user tickets', { userId, status, limit, admin: req.admin?.id });

    const tickets = await getTicketService().getUserTickets(userId, { status, limit });
    
    res.json(createSuccessResponse(tickets));
  } catch (error) {
    logger.error('Error fetching user tickets', { userId: req.params.userId, error: error.message });
    res.status(500).json(createErrorResponse('Failed to fetch user tickets'));
  }
});

/**
 * @swagger
 * /api/tickets/search:
 *   get:
 *     summary: Search tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['open', 'in_progress', 'resolved', 'closed']
 */
router.get('/search', requireAdminAuth, async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json(createErrorResponse('Search query is required', 'QUERY_REQUIRED', 400));
    }
    
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status;
    
    if (status && !isValidStatus(status)) {
      return res.status(400).json(createErrorResponse(
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`,
        'INVALID_STATUS',
        400
      ));
    }

    logger.info('Searching tickets', { query, limit, status, admin: req.admin?.id });

    const tickets = await getTicketService().searchTickets(query, { limit, status });
    
    res.json(createSuccessResponse(tickets));
  } catch (error) {
    logger.error('Error searching tickets', { query: req.query.q, error: error.message });
    res.status(500).json(createErrorResponse('Failed to search tickets'));
  }
});

/**
 * @swagger
 * /api/tickets/status/{status}:
 *   get:
 *     summary: Get tickets by status
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: ['open', 'in_progress', 'resolved', 'closed']
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assigned agent
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 */
router.get('/status/:status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.params;
    const assignedTo = req.query.assignedTo;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    
    if (!isValidStatus(status)) {
      return res.status(400).json(createErrorResponse(
        `Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`,
        'INVALID_STATUS',
        400
      ));
    }

    logger.info('Fetching tickets by status', { status, assignedTo, limit, admin: req.admin?.id });

    const tickets = await getTicketService().getTicketsByStatus(status, { assignedTo, limit });
    
    res.json(createSuccessResponse(tickets));
  } catch (error) {
    logger.error('Error fetching tickets by status', { status: req.params.status, error: error.message });
    res.status(500).json(createErrorResponse('Failed to fetch tickets by status'));
  }
});

/**
 * @swagger
 * /api/tickets/stats:
 *   get:
 *     summary: Get ticket statistics
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Fetching ticket statistics', { admin: req.admin?.id });

    const stats = await getTicketService().getTicketStatistics();
    
    res.json(createSuccessResponse(stats));
  } catch (error) {
    logger.error('Error fetching ticket statistics', { error: error.message });
    res.status(500).json(createErrorResponse('Failed to fetch ticket statistics'));
  }
});

module.exports = router;