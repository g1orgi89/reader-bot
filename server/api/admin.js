/**
 * Admin API routes for Shrooms Support Bot
 * @file server/api/admin.js
 */

const express = require('express');
const logger = require('../utils/logger');
const { 
  createErrorResponse,
  ADMIN_ERRORS,
  VALIDATION_ERRORS
} = require('../constants/errorCodes');

const router = express.Router();

// Import types for JSDoc
require('../types');

// Simple in-memory storage for farming yield (in production, use database)
let farmingYield = {
  value: 12.5,
  lastUpdated: new Date(),
  updatedBy: 'system'
};

// Simple storage for system stats
let systemStats = {
  lastUpdated: new Date(),
  ticketsCreated: 0,
  messagesProcessed: 0,
  usersActive: 0
};

/**
 * GET /api/admin/stats
 * Get general system statistics
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Fetching admin statistics');

    /** @type {SystemStats} */
    const stats = {
      tickets: {
        total: systemStats.ticketsCreated,
        open: Math.floor(systemStats.ticketsCreated * 0.3),
        closed: Math.floor(systemStats.ticketsCreated * 0.7)
      },
      conversations: {
        total: systemStats.messagesProcessed / 5, // Estimate
        active: systemStats.usersActive
      },
      knowledge: {
        documents: 42, // Placeholder
        categories: 5
      },
      messages: {
        total: systemStats.messagesProcessed,
        today: Math.floor(systemStats.messagesProcessed * 0.1)
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    const errorResponse = createErrorResponse('STATS_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/admin/farming-yield
 * Get current farming yield value
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/farming-yield', (req, res) => {
  try {
    logger.info('Fetching current farming yield');

    /** @type {AdminConfig} */
    const config = {
      dohodnost: farmingYield.value.toString(),
      lastUpdated: farmingYield.lastUpdated.toISOString(),
      updatedBy: farmingYield.updatedBy
    };

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching farming yield:', error);
    const errorResponse = createErrorResponse('FARMING_YIELD_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * PUT /api/admin/farming-yield
 * Update farming yield value
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.put('/farming-yield', (req, res) => {
  try {
    const { value, updatedBy = 'admin' } = req.body;

    // Validate input
    if (value === undefined || value === null) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Value is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
      const errorResponse = createErrorResponse(
        'VALUE_OUT_OF_RANGE',
        'Value must be a number between 0 and 100'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    // Update farming yield
    farmingYield = {
      value: numericValue,
      lastUpdated: new Date(),
      updatedBy
    };

    logger.info('Farming yield updated', {
      newValue: numericValue,
      updatedBy,
      timestamp: farmingYield.lastUpdated
    });

    /** @type {AdminConfig} */
    const config = {
      dohodnost: farmingYield.value.toString(),
      lastUpdated: farmingYield.lastUpdated.toISOString(),
      updatedBy: farmingYield.updatedBy
    };

    res.json({ success: true, data: config, message: 'Farming yield updated successfully' });
  } catch (error) {
    logger.error('Error updating farming yield:', error);
    const errorResponse = createErrorResponse('FARMING_YIELD_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/admin/users
 * Get list of users (placeholder implementation)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/users', (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    logger.info('Fetching users list', { page, limit });

    // Placeholder data
    const users = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: `user-${(parseInt(page) - 1) * parseInt(limit) + i + 1}`,
      address: `ST1${Math.random().toString(36).substring(2, 28).toUpperCase()}`,
      lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      messagesCount: Math.floor(Math.random() * 100),
      ticketsCount: Math.floor(Math.random() * 5)
    }));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 1000, // Placeholder
          totalPages: Math.ceil(1000 / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    const errorResponse = createErrorResponse('STATS_ERROR', 'Failed to fetch users');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/admin/broadcast
 * Send broadcast message (placeholder implementation)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { message, language = 'en', targetUsers = [] } = req.body;

    if (!message) {
      const errorResponse = createErrorResponse(
        'MISSING_REQUIRED_FIELD',
        'Message is required'
      );
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }

    logger.info('Broadcasting message', {
      messageLength: message.length,
      language,
      targetUsers: targetUsers.length || 'all'
    });

    // Placeholder implementation
    // In real implementation, this would send messages via Socket.IO or other channels
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = {
      messageId: `msg-${Date.now()}`,
      recipients: targetUsers.length || 1000,
      language,
      sentAt: new Date().toISOString()
    };

    res.json({ success: true, data: result, message: 'Broadcast sent successfully' });
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    const errorResponse = createErrorResponse('BROADCAST_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/admin/system-info
 * Get system information
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.get('/system-info', (req, res) => {
  try {
    const systemInfo = {
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: systemInfo });
  } catch (error) {
    logger.error('Error fetching system info:', error);
    const errorResponse = createErrorResponse('SYSTEM_INFO_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/admin/cache/clear
 * Clear system cache (placeholder)
 * @param {express.Request} req - Request object
 * @param {express.Response} res - Response object
 */
router.post('/cache/clear', (req, res) => {
  try {
    logger.info('Clearing system cache');

    // Placeholder implementation
    // In real app, this would clear actual caches
    
    res.json({ 
      success: true, 
      data: { clearedAt: new Date().toISOString() },
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    const errorResponse = createErrorResponse('CACHE_CLEAR_ERROR');
    res.status(errorResponse.httpStatus).json(errorResponse);
  }
});

module.exports = router;
