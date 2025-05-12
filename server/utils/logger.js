/**
 * Logger utility for Shrooms Support Bot
 * Provides structured logging with different levels and contexts
 * @file server/utils/logger.js
 */

const winston = require('winston');
const path = require('path');

/**
 * @typedef {Object} LogContext
 * @property {string} [userId] - User ID for context
 * @property {string} [ticketId] - Ticket ID for context
 * @property {string} [conversationId] - Conversation ID for context
 * @property {string} [operation] - Operation name
 * @property {number} [duration] - Operation duration in ms
 * @property {Object} [extra] - Any additional context
 */

/**
 * Create Winston logger instance
 */
const createLogger = () => {
  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // Define console format for development
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let logMessage = `${timestamp} ${level}: ${message}`;
      
      // Add context information if available
      if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
      
      return logMessage;
    })
  );

  // Create logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
      service: 'shrooms-support-bot',
      environment: process.env.NODE_ENV || 'development'
    },
    transports: [
      // File transport for all logs
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'app.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true
      }),
      
      // Separate file for errors
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 3,
        tailable: true
      })
    ]
  });

  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: consoleFormat
    }));
  }

  return logger;
};

// Create logger instance
const logger = createLogger();

/**
 * Enhanced logger with context support
 */
class ContextLogger {
  /**
   * Constructor
   * @param {winston.Logger} baseLogger - Base Winston logger
   */
  constructor(baseLogger) {
    this.logger = baseLogger;
  }

  /**
   * Create logger with preset context
   * @param {LogContext} context - Context to add to all logs
   * @returns {ContextLogger} New logger with context
   */
  child(context) {
    return new ContextLogger(this.logger.child(context));
  }

  /**
   * Log with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {LogContext} [context={}] - Additional context
   */
  logWithContext(level, message, context = {}) {
    this.logger.log(level, message, context);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {LogContext} [context={}] - Additional context
   */
  info(message, context = {}) {
    this.logWithContext('info', message, context);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {LogContext|Error} [context={}] - Additional context or error object
   */
  error(message, context = {}) {
    // If context is an Error object, extract relevant information
    if (context instanceof Error) {
      context = {
        error: context.message,
        stack: context.stack,
        name: context.name
      };
    }
    this.logWithContext('error', message, context);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {LogContext} [context={}] - Additional context
   */
  warn(message, context = {}) {
    this.logWithContext('warn', message, context);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {LogContext} [context={}] - Additional context
   */
  debug(message, context = {}) {
    this.logWithContext('debug', message, context);
  }

  /**
   * Log performance information
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {LogContext} [context={}] - Additional context
   */
  performance(operation, duration, context = {}) {
    this.info(`Performance: ${operation} completed`, {
      ...context,
      operation,
      duration
    });
  }

  /**
   * Log API request
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in ms
   * @param {LogContext} [context={}] - Additional context
   */
  request(method, path, statusCode, duration, context = {}) {
    this.info(`${method} ${path} ${statusCode}`, {
      ...context,
      method,
      path,
      statusCode,
      duration,
      type: 'request'
    });
  }

  /**
   * Log authentication events
   * @param {string} event - Auth event type
   * @param {string} userId - User ID
   * @param {boolean} success - Whether authentication was successful
   * @param {LogContext} [context={}] - Additional context
   */
  auth(event, userId, success, context = {}) {
    this.info(`Auth: ${event}`, {
      ...context,
      authEvent: event,
      userId,
      success,
      type: 'authentication'
    });
  }

  /**
   * Log Claude API usage
   * @param {string} operation - Operation type
   * @param {number} tokensUsed - Number of tokens used
   * @param {number} duration - Operation duration
   * @param {LogContext} [context={}] - Additional context
   */
  claude(operation, tokensUsed, duration, context = {}) {
    this.info(`Claude: ${operation}`, {
      ...context,
      operation,
      tokensUsed,
      duration,
      type: 'claude'
    });
  }

  /**
   * Log ticket operations
   * @param {string} operation - Ticket operation
   * @param {string} ticketId - Ticket ID
   * @param {string} [userId] - User ID
   * @param {LogContext} [context={}] - Additional context
   */
  ticket(operation, ticketId, userId, context = {}) {
    this.info(`Ticket: ${operation}`, {
      ...context,
      operation,
      ticketId,
      userId,
      type: 'ticket'
    });
  }

  /**
   * Create timer for performance logging
   * @param {string} label - Timer label
   * @returns {Object} Timer object with end method
   */
  timer(label) {
    const start = Date.now();
    return {
      end: (message = `Timer: ${label} completed`, context = {}) => {
        const duration = Date.now() - start;
        this.performance(label, duration, {
          ...context,
          timer: label
        });
      }
    };
  }
}

// Create enhanced logger instance
const contextLogger = new ContextLogger(logger);

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = contextLogger;