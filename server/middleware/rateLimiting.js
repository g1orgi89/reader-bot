/**
 * Rate limiting middleware configuration
 * @file server/middleware/rateLimiting.js
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { createErrorResponse } = require('../constants/errorCodes');

/**
 * Create custom rate limit error message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
function createRateLimitError(req, res, next) {
  const errorResponse = createErrorResponse(
    'RATE_LIMIT_EXCEEDED',
    'Too many requests, please try again later',
    {
      retryAfter: Math.round(req.rateLimit?.resetTime / 1000) || 60,
      limit: req.rateLimit?.limit,
      current: req.rateLimit?.current,
      remaining: req.rateLimit?.remaining
    }
  );

  // Log rate limit violations
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    limit: req.rateLimit?.limit,
    current: req.rateLimit?.current
  });

  res.status(errorResponse.httpStatus).json(errorResponse);
}

/**
 * General rate limiter for all API endpoints
 * Adjusted for testing: 5 requests per minute
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (reduced for testing)
  max: 5, // Limit each IP to 5 requests per minute (reduced for testing)
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: createRateLimitError,
  keyGenerator: (req) => {
    // Use IP address as the key, but also consider user ID if authenticated
    return req.ip + (req.user?.id || '');
  }
});

/**
 * Strict rate limiter for chat endpoints
 * 10 requests per 2 minutes
 */
const chatLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 10, // Limit each IP to 10 chat requests per windowMs
  message: 'Too many chat messages, please wait before sending more',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitError,
  keyGenerator: (req) => {
    // For chat, prefer user ID if available, otherwise IP
    return req.body?.userId || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for admin users (if auth middleware has run)
    return req.admin !== undefined;
  }
});

/**
 * Auth rate limiter for login endpoints
 * 5 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitError,
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Admin rate limiter - more lenient for authenticated admin users
 * 100 requests per 15 minutes
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Higher limit for admin operations
  message: 'Too many admin requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitError,
  keyGenerator: (req) => {
    // Use admin ID as key if available
    return req.admin?.id || req.ip;
  }
});

/**
 * Health check rate limiter - very strict for testing
 * 3 requests per 30 seconds
 */
const healthLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 3, // Very low limit for testing
  message: 'Too many health check requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitError,
  keyGenerator: (req) => req.ip
});

/**
 * Create custom rate limiter with specific options
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @returns {Function} Express middleware function
 */
function createCustomLimiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimitError,
    ...options
  });
}

/**
 * Apply rate limiting based on request type
 * @param {string} type - Type of rate limiting to apply
 * @returns {Function} Express middleware function
 */
function applyRateLimit(type) {
  switch (type) {
    case 'general':
      return generalLimiter;
    case 'chat':
      return chatLimiter;
    case 'auth':
      return authLimiter;
    case 'admin':
      return adminLimiter;
    case 'health':
      return healthLimiter;
    default:
      return generalLimiter;
  }
}

module.exports = {
  generalLimiter,
  chatLimiter,
  authLimiter,
  adminLimiter,
  healthLimiter,
  createCustomLimiter,
  applyRateLimit,
  createRateLimitError
};