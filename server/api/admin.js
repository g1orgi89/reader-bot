/**
 * Admin authentication routes with manual OPTIONS handler
 * @file server/api/admin.js
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { createErrorResponse } = require('../constants/errorCodes');

const router = express.Router();

// Manual OPTIONS handler FIRST - before any rate limiting
router.options('/tickets', (req, res) => {
  logger.info('Admin tickets OPTIONS request');
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  });
  res.status(200).end();
});

/**
 * Admin login endpoint
 * POST /api/admin/login
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Username and password are required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Get admin credentials from environment
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

    // Simple credential check (in production, use hashed passwords)
    if (username !== adminUsername || password !== adminPassword) {
      logger.warn('Failed admin login attempt', {
        username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      const errorResponse = createErrorResponse(
        'INVALID_CREDENTIALS',
        'Invalid username or password'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Generate admin token (simple approach - in production use JWT)
    const adminToken = process.env.ADMIN_TOKEN || 'default-admin-token';
    
    // In production, you might generate a unique token per session
    // const adminToken = crypto.randomBytes(32).toString('hex');

    logger.info('Successful admin login', {
      username,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        token: adminToken,
        username: adminUsername,
        role: 'admin',
        expiresAt: null, // For now, tokens don't expire
        loginAt: new Date().toISOString()
      },
      message: 'Login successful'
    });

  } catch (error) {
    logger.error('Error in admin login', {
      error: error.message,
      stack: error.stack
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Admin profile endpoint
 * GET /api/admin/profile
 * @param {express.Request} req - Request object  
 * @param {express.Response} res - Response object
 */
router.get('/profile', requireAdminAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        username: process.env.ADMIN_USERNAME || 'admin',
        role: 'admin',
        permissions: ['tickets:read', 'tickets:write', 'tickets:delete', 'admin:manage'],
        loginAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting admin profile', {
      error: error.message,
      admin: req.admin
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Verify admin token endpoint
 * GET /api/admin/verify
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/verify', requireAdminAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        valid: true,
        admin: req.admin,
        verifiedAt: new Date().toISOString()
      },
      message: 'Token is valid'
    });
  } catch (error) {
    logger.error('Error verifying admin token', {
      error: error.message,
      admin: req.admin
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Admin logout endpoint (optional - since tokens don't expire)
 * POST /api/admin/logout
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/logout', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Admin logout', {
      admin: req.admin,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Error in admin logout', {
      error: error.message,
      admin: req.admin
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * Change admin password endpoint
 * PUT /api/admin/password
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.put('/password', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Current password and new password are required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Verify current password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (currentPassword !== adminPassword) {
      const errorResponse = createErrorResponse(
        'INVALID_CREDENTIALS',
        'Current password is incorrect'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Note: In a real implementation, you would update the password in environment/database
    // For now, just log the change attempt
    logger.warn('Password change attempt - manual update required', {
      admin: req.admin,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Password change logged. Please update ADMIN_PASSWORD in environment variables.',
      note: 'For security, password updates require manual environment variable changes.'
    });

  } catch (error) {
    logger.error('Error changing admin password', {
      error: error.message,
      admin: req.admin
    });

    const errorResponse = createErrorResponse('INTERNAL_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/admin/tickets
 * Get all tickets (admin endpoint)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/tickets', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Admin fetching all tickets', { admin: req.admin?.id });

    // Get ticket service
    const ServiceManager = require('../core/ServiceManager');
    const ticketService = ServiceManager.get('ticketService');

    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const sort = req.query.sort || 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.userId) filter.userId = req.query.userId;

    const queryOptions = {
      page,
      limit,
      sort: `${order === 'desc' ? '-' : ''}${sort}`
    };

    const result = await ticketService.getTickets(filter, queryOptions);
    
    const response = {
      items: result.items,
      totalCount: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit)
    };
    
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Error fetching tickets via admin endpoint', { 
      error: error.message,
      admin: req.admin?.id 
    });
    
    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to fetch tickets');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/admin/tickets
 * Create a new ticket (admin endpoint)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/tickets', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Admin creating new ticket', { 
      admin: req.admin?.id,
      body: req.body
    });

    const { title, description, priority, category, userId, email } = req.body;

    // Validation
    if (!title || !description) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Title and description are required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Get ticket service
    const ServiceManager = require('../core/ServiceManager');
    const ticketService = ServiceManager.get('ticketService');

    // Create a dummy conversation ID for admin-created tickets
    const dummyConversationId = new mongoose.Types.ObjectId();

    // Create ticket data - mapping title/description to subject/initialMessage
    // Use valid ticket categories from ticket types
    const ticketData = {
      userId: userId || `admin-created-${Date.now()}`,
      conversationId: dummyConversationId, // Add required conversationId
      subject: title, // Map title to subject
      initialMessage: description, // Map description to initialMessage
      priority: priority || 'medium',
      category: category || 'other', // Use 'other' instead of 'general'
      email: email || '',
      language: 'en', // Add required language field
      context: 'Created by admin via admin panel' // Add context
    };

    logger.info('Creating ticket with data:', ticketData);

    // Create the ticket
    const ticket = await ticketService.createTicket(ticketData);

    logger.info('Admin created ticket successfully', {
      ticketId: ticket.ticketId,
      admin: req.admin?.id
    });

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    });

  } catch (error) {
    logger.error('Error creating ticket via admin endpoint', {
      error: error.message,
      admin: req.admin?.id,
      stack: error.stack,
      body: req.body
    });

    const errorResponse = createErrorResponse('GENERIC_ERROR', `Failed to create ticket: ${error.message}`);
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * PUT /api/admin/tickets/:ticketId
 * Update a ticket (admin endpoint)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.put('/tickets/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updateData = req.body;

    logger.info('Admin updating ticket', {
      ticketId,
      admin: req.admin?.id
    });

    // Get ticket service
    const ServiceManager = require('../core/ServiceManager');
    const ticketService = ServiceManager.get('ticketService');

    // Update the ticket
    const updatedTicket = await ticketService.updateTicket(ticketId, updateData);

    if (!updatedTicket) {
      const errorResponse = createErrorResponse('NOT_FOUND', 'Ticket not found');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Admin updated ticket successfully', {
      ticketId,
      admin: req.admin?.id
    });

    res.json({
      success: true,
      data: updatedTicket,
      message: 'Ticket updated successfully'
    });

  } catch (error) {
    logger.error('Error updating ticket via admin endpoint', {
      error: error.message,
      ticketId: req.params.ticketId,
      admin: req.admin?.id
    });

    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to update ticket');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * DELETE /api/admin/tickets/:ticketId
 * Delete a ticket (admin endpoint)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.delete('/tickets/:ticketId', requireAdminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

    logger.info('Admin deleting ticket', {
      ticketId,
      admin: req.admin?.id
    });

    // Get ticket service
    const ServiceManager = require('../core/ServiceManager');
    const ticketService = ServiceManager.get('ticketService');

    // Delete the ticket
    const deletedTicket = await ticketService.deleteTicket(ticketId);

    if (!deletedTicket) {
      const errorResponse = createErrorResponse('NOT_FOUND', 'Ticket not found');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Admin deleted ticket successfully', {
      ticketId,
      admin: req.admin?.id
    });

    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting ticket via admin endpoint', {
      error: error.message,
      ticketId: req.params.ticketId,
      admin: req.admin?.id
    });

    const errorResponse = createErrorResponse('GENERIC_ERROR', 'Failed to delete ticket');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/admin/tickets/stats
 * Get ticket statistics (admin endpoint)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/tickets/stats', requireAdminAuth, async (req, res) => {
  try {
    logger.info('Admin fetching ticket statistics', { admin: req.admin?.id });

    const ServiceManager = require('../core/ServiceManager');
    const ticketService = ServiceManager.get('ticketService');
    
    const stats = await ticketService.getTicketStatistics();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching ticket statistics via admin endpoint', { 
      error: error.message,
      admin: req.admin?.id 
    });
    
    const errorResponse = createErrorResponse('STATS_ERROR', 'Failed to fetch ticket statistics');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

module.exports = router;
