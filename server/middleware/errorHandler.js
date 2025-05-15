/**
 * Error handling middleware
 * @file server/middleware/errorHandler.js
 */

const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Error caught by middleware:', err);

  // Set default error status and message
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let error = err.code || 'SERVER_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
    error = 'VALIDATION_ERROR';
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    status = 500;
    message = 'Database Error';
    error = 'DATABASE_ERROR';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
    error = 'INVALID_ID';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
    error = 'UNAUTHORIZED';
  }

  // Create error response
  const errorResponse = {
    success: false,
    error: error,
    message: message
  };

  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  // Send error response
  res.status(status).json(errorResponse);
}

/**
 * Handle 404 errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

/**
 * Async error handler wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
