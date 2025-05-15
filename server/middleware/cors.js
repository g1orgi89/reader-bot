/**
 * CORS middleware configuration for Shrooms AI Support Bot
 * 🍄 Fixing the preflight OPTIONS request issue
 * @file server/middleware/cors.js
 */

const cors = require('cors');
const logger = require('../utils/logger');

/**
 * Dynamic origin checker for CORS
 * @param {string} origin - Origin to check
 * @param {function} callback - CORS callback
 */
function dynamicOriginChecker(origin, callback) {
  // In development, allow all origins (including no origin for tools like Postman)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('🍄 CORS: Development mode - allowing all origins');
    return callback(null, true);
  }
  
  // Allow requests with no origin (like mobile apps, Postman, curl)
  if (!origin) {
    logger.debug('🍄 CORS: No origin header present - allowing');
    return callback(null, true);
  }
  
  // Get allowed origins from environment
  const allowedOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'];
  
  // Check if origin is in allowed list
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    logger.debug(`🍄 CORS: Allowed origin: ${origin}`);
    return callback(null, true);
  }
  
  // Log blocked origin
  logger.warn(`🍄 CORS: Blocked origin: ${origin}`);
  return callback(null, false);
}

/**
 * Fixed CORS configuration for Shrooms Support Bot
 * @type {Object}
 */
const corsOptions = {
  origin: dynamicOriginChecker,
  credentials: true,
  
  // List ALL HTTP methods that should be allowed
  methods: [
    'GET',
    'POST', 
    'PUT',
    'PATCH', 
    'DELETE',
    'OPTIONS',
    'HEAD'
  ],
  
  // Critical fix: Include ALL headers that browsers might send during preflight
  allowedHeaders: [
    'Accept',
    'Accept-Language',
    'Authorization',
    'Cache-Control',
    'Content-Language',
    'Content-Type',
    'DNT',
    'If-Modified-Since',
    'Keep-Alive',
    'Origin',
    'Pragma',
    'Referer',
    'User-Agent',
    'X-Requested-With',
    'X-HTTP-Method-Override',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Forwarded-Proto',
    'X-Forwarded-Host'
  ],
  
  // Headers that the client can read from response
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Date',
    'ETag',
    'Last-Modified',
    'X-Total-Count',
    'X-Page-Count',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset'
  ],
  
  // Return 200 for OPTIONS instead of 204 (better browser compatibility)
  optionsSuccessStatus: 200,
  
  // Cache preflight response for 24 hours
  maxAge: 86400,
  
  // Important: Handle preflight requests properly
  preflightContinue: false
};

/**
 * Custom CORS handler middleware that provides verbose logging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
function corsWithLogging(req, res, next) {
  // Log all CORS-related requests in development
  if (process.env.NODE_ENV === 'development' && req.method === 'OPTIONS') {
    logger.info('🍄 CORS Preflight Request:', {
      method: req.method,
      url: req.url,
      origin: req.get('Origin'),
      requestMethod: req.get('Access-Control-Request-Method'),
      requestHeaders: req.get('Access-Control-Request-Headers'),
      userAgent: req.get('User-Agent')
    });
  }
  
  // Apply CORS middleware
  cors(corsOptions)(req, res, (err) => {
    if (err) {
      logger.error('🍄 CORS Error:', err);
      return res.status(400).json({
        success: false,
        error: 'CORS policy violation',
        errorCode: 'CORS_ERROR'
      });
    }
    
    // Log successful preflight responses in development
    if (process.env.NODE_ENV === 'development' && req.method === 'OPTIONS') {
      logger.info('🍄 CORS Preflight Response:', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers'),
          'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials')
        }
      });
    }
    
    next();
  });
}

module.exports = corsWithLogging;