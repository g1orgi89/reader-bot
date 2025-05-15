/**
 * Admin authentication routes
 * @file server/api/admin.js
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth');
const { createErrorResponse } = require('../constants/errorCodes');

const router = express.Router();

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
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

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

module.exports = router;