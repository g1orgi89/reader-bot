/**
 * Authentication middleware for Shrooms Support Bot
 * @file server/middleware/auth.js
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Authentication middleware for protecting admin routes using JWT
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object  
 * @param {import('express').NextFunction} next - Express next function
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required',
      errorCode: 'NO_TOKEN'
    });
  }

  jwt.verify(token, config.security.jwtSecret, (err, decoded) => {
    if (err) {
      logger.warn('Invalid token used', { 
        error: err.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        success: false,
        error: 'Invalid token',
        errorCode: 'INVALID_TOKEN'
      });
    }

    // Add decoded user information to request object
    req.user = decoded;
    next();
  });
}

/**
 * Basic admin authentication middleware using environment variables
 * This is a simplified authentication for MVP
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object  
 * @param {import('express').NextFunction} next - Express next function
 */
function basicAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      error: 'Basic authentication is required',
      errorCode: 'NO_AUTH'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // ИСПРАВЛЕНО: Правильный доступ к конфигурации
  const adminUsername = config.security.adminUsername;
  const adminPassword = config.security.adminPassword;

  if (!adminUsername || !adminPassword) {
    logger.error('Admin credentials not configured in environment variables');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not properly configured',
      errorCode: 'AUTH_NOT_CONFIGURED'
    });
  }

  if (username !== adminUsername || password !== adminPassword) {
    logger.warn('Failed admin login attempt', { 
      username,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid admin credentials',
      errorCode: 'INVALID_CREDENTIALS'
    });
  }

  // Add admin user information to request
  req.user = {
    id: 'admin',
    username: username,
    role: 'admin',
    isAdmin: true
  };

  logger.info('Admin authenticated successfully', { 
    username,
    ip: req.ip 
  });

  next();
}

/**
 * Check if user has admin role
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object  
 * @param {import('express').NextFunction} next - Express next function
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      errorCode: 'NO_AUTH'
    });
  }

  if (!req.user.isAdmin && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      errorCode: 'ACCESS_DENIED'
    });
  }

  next();
}

/**
 * API key authentication middleware for webhook endpoints
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
      errorCode: 'NO_API_KEY'
    });
  }

  // Check against configured API keys
  const validApiKeys = config.security.apiKeys || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key used', { 
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
      errorCode: 'INVALID_API_KEY'
    });
  }

  req.authenticatedViaApiKey = true;
  next();
}

/**
 * Rate limiting for specific routes
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {import('express').RequestHandler} Express middleware
 */
function createSpecificRateLimit(maxRequests, windowMs) {
  return require('express-rate-limit')({
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      errorCode: 'RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP + user ID if authenticated, otherwise just IP
      return req.user ? `${req.ip}-${req.user.id}` : req.ip;
    }
  });
}

module.exports = {
  authenticateToken,
  basicAdminAuth,
  requireAdmin,
  authenticateApiKey,
  createSpecificRateLimit
};
