/**
 * Admin authentication middleware
 * @file server/middleware/adminAuth.js
 */

const logger = require('../utils/logger');
const { createErrorResponse } = require('../types/api');

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

/**
 * Middleware to verify admin authentication
 * This is a simple implementation - in production, use proper JWT or session-based auth
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Access attempt without authorization header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      
      return res.status(401).json(createErrorResponse(
        'Access denied. Authorization required.',
        'MISSING_AUTH',
        401
      ));
    }
    
    const token = authHeader.split(' ')[1]; // Bearer <token>
    
    if (!token) {
      logger.warn('Access attempt with malformed authorization header', {
        ip: req.ip,
        endpoint: req.originalUrl
      });
      
      return res.status(401).json(createErrorResponse(
        'Access denied. Invalid authorization format.',
        'INVALID_AUTH_FORMAT',
        401
      ));
    }
    
    // Simple token validation (in production, use proper JWT verification)
    const validToken = process.env.ADMIN_TOKEN || 'default-admin-token';
    
    if (token !== validToken) {
      logger.warn('Access attempt with invalid token', {
        ip: req.ip,
        endpoint: req.originalUrl,
        providedToken: token.substring(0, 10) + '...'
      });
      
      return res.status(403).json(createErrorResponse(
        'Access denied. Invalid credentials.',
        'INVALID_TOKEN',
        403
      ));
    }
    
    // Add admin info to request
    req.admin = {
      id: 'admin-user',
      role: 'admin'
    };
    
    logger.info('Admin access granted', {
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Error in admin authentication middleware', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl
    });
    
    res.status(500).json(createErrorResponse(
      'Authentication service error',
      'AUTH_SERVICE_ERROR',
      500
    ));
  }
}

/**
 * Optional admin auth middleware - allows access but sets admin info if authenticated
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
async function optionalAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    const validToken = process.env.ADMIN_TOKEN || 'default-admin-token';
    
    if (token === validToken) {
      req.admin = {
        id: 'admin-user',
        role: 'admin'
      };
      
      logger.info('Admin authenticated for optional endpoint', {
        endpoint: req.originalUrl,
        method: req.method
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in optional admin authentication', {
      error: error.message,
      endpoint: req.originalUrl
    });
    
    // Don't fail the request for optional auth
    next();
  }
}

module.exports = {
  requireAdminAuth,
  optionalAdminAuth
};