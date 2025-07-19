/**
 * Admin authentication middleware  
 * @file server/middleware/adminAuth.js
 */

const logger = require('../utils/logger');
const { createErrorResponse } = require('../constants/errorCodes');

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
    // Try multiple auth methods: Bearer token, Basic auth, and direct credentials
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Access attempt without authorization header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      
      const errorResponse = createErrorResponse('UNAUTHORIZED', 'Access denied. Authorization required.');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    let isValidAuth = false;
    
    // Method 1: Bearer token authentication
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove "Bearer " prefix
      const validToken = process.env.ADMIN_TOKEN || 'default-admin-token';
      
      if (token === validToken) {
        isValidAuth = true;
        logger.info('Admin authenticated via Bearer token', {
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
      }
    }
    
    // Method 2: Basic authentication (username:password)
    if (!isValidAuth && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
      
      if (username === adminUsername && password === adminPassword) {
        isValidAuth = true;
        logger.info('Admin authenticated via Basic auth', {
          username,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
      }
    }
    
    if (!isValidAuth) {
      logger.warn('Access attempt with invalid credentials', {
        ip: req.ip,
        endpoint: req.originalUrl,
        authMethod: authHeader.split(' ')[0]
      });
      
      const errorResponse = createErrorResponse('INVALID_CREDENTIALS', 'Access denied. Invalid credentials.');
      return res.status(errorResponse.httpStatus).json(errorResponse);
    }
    
    // Add admin info to request
    req.admin = {
      id: 'admin-user',
      role: 'admin',
      username: process.env.ADMIN_USERNAME || 'admin'
    };
    
    next();
  } catch (error) {
    logger.error('Error in admin authentication middleware', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl
    });
    
    const errorResponse = createErrorResponse('INTERNAL_ERROR', 'Authentication service error');
    res.status(errorResponse.httpStatus).json(errorResponse);
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
    
    // Try Bearer token authentication
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const validToken = process.env.ADMIN_TOKEN || 'default-admin-token';
      
      if (token === validToken) {
        req.admin = {
          id: 'admin-user',
          role: 'admin',
          username: process.env.ADMIN_USERNAME || 'admin'
        };
        
        logger.info('Admin authenticated for optional endpoint via Bearer', {
          endpoint: req.originalUrl,
          method: req.method
        });
      }
    }
    
    // Try Basic authentication
    if (!req.admin && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
      
      if (username === adminUsername && password === adminPassword) {
        req.admin = {
          id: 'admin-user',
          role: 'admin',
          username: adminUsername
        };
        
        logger.info('Admin authenticated for optional endpoint via Basic', {
          username,
          endpoint: req.originalUrl,
          method: req.method
        });
      }
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

/**
 * Basic authentication parsing helper
 * @param {string} authHeader - Authorization header value
 * @returns {{username: string, password: string}|null} Parsed credentials or null
 */
function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }
  
  try {
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    return { username, password };
  } catch (error) {
    logger.error('Failed to parse Basic auth header', { error: error.message });
    return null;
  }
}

module.exports = {
  requireAdminAuth,
  optionalAdminAuth,
  parseBasicAuth,
  // Add alias for backward compatibility
  adminAuth: requireAdminAuth
};