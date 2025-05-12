/**
 * Logging utility for Shrooms Support Bot
 * @file server/utils/logger.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Simple logger implementation for the support bot
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logDirectory = process.env.LOG_DIR || path.join(__dirname, '../../logs');
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';
    
    // Ensure log directory exists
    if (this.enableFileLogging && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
    
    // Log levels hierarchy
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.levelColors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[37m'  // White
    };
    
    this.reset = '\x1b[0m';
  }

  /**
   * Format log message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   * @returns {string} Formatted log string
   */
  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? 
      ` ${JSON.stringify(meta)}` : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  }

  /**
   * Write log to file
   * @private
   * @param {string} level - Log level
   * @param {string} formattedMessage - Formatted log message
   */
  _writeToFile(level, formattedMessage) {
    if (!this.enableFileLogging) return;
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${level}.log`;
    const filepath = path.join(this.logDirectory, filename);
    
    fs.appendFileSync(filepath, formattedMessage + '\n');
  }

  /**
   * Log message with color
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   */
  _log(level, message, meta = {}) {
    if (this.levels[level] > this.levels[this.logLevel]) return;
    
    const formattedMessage = this._formatMessage(level, message, meta);
    const coloredMessage = `${this.levelColors[level]}${formattedMessage}${this.reset}`;
    
    // Output to console
    console.log(coloredMessage);
    
    // Write to file
    this._writeToFile(level, formattedMessage);
    
    // Log all levels to combined log
    if (this.enableFileLogging) {
      const date = new Date().toISOString().split('T')[0];
      const combinedPath = path.join(this.logDirectory, `${date}-combined.log`);
      fs.appendFileSync(combinedPath, formattedMessage + '\n');
    }
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object|Error} [meta={}] - Error object or metadata
   */
  error(message, meta = {}) {
    // Handle Error objects
    if (meta instanceof Error) {
      meta = {
        message: meta.message,
        stack: meta.stack,
        name: meta.name
      };
    }
    
    this._log('error', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} [meta={}] - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} [meta={}] - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} [meta={}] - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Log Claude API request/response
   * @param {Object} request - Request details
   * @param {Object} response - Response details
   * @param {Object} [meta={}] - Additional metadata
   */
  logClaudeInteraction(request, response, meta = {}) {
    this.info('Claude API interaction', {
      request: {
        model: request.model,
        messageLength: request.messages ? request.messages.length : 0,
        systemPromptLength: request.system ? request.system.length : 0,
        maxTokens: request.max_tokens,
        temperature: request.temperature
      },
      response: {
        messageLength: response.content ? response.content[0]?.text?.length : 0,
        tokensUsed: response.usage ? response.usage.input_tokens + response.usage.output_tokens : 0,
        stopReason: response.stop_reason,
        model: response.model
      },
      duration: meta.duration,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log ticket creation
   * @param {Object} ticket - Ticket details
   * @param {Object} [meta={}] - Additional metadata
   */
  logTicketCreation(ticket, meta = {}) {
    this.info('Ticket created', {
      ticketId: ticket.ticketId,
      userId: ticket.userId,
      category: ticket.category,
      priority: ticket.priority,
      language: ticket.language,
      ...meta
    });
  }

  /**
   * Log user interaction
   * @param {Object} interaction - Interaction details
   */
  logUserInteraction(interaction) {
    this.info('User interaction', {
      userId: interaction.userId,
      language: interaction.language,
      messageType: interaction.messageType,
      responseTime: interaction.responseTime,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance metrics
   * @param {Object} metrics - Performance metrics
   */
  logPerformance(metrics) {
    this.info('Performance metrics', {
      method: metrics.method,
      duration: metrics.duration,
      memory: metrics.memory,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Additional context to include in all logs
   * @returns {Logger} Child logger instance
   */
  child(context) {
    const childLogger = Object.create(this);
    childLogger.context = context;
    
    // Override _log method to include context
    childLogger._log = function(level, message, meta = {}) {
      const combinedMeta = { ...this.context, ...meta };
      return Logger.prototype._log.call(this, level, message, combinedMeta);
    };
    
    return childLogger;
  }

  /**
   * Set log level dynamically
   * @param {string} level - New log level (error, warn, info, debug)
   */
  setLogLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.logLevel = level;
      this.info('Log level changed', { newLevel: level });
    } else {
      this.warn('Invalid log level', { attempted: level });
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Current logger configuration
   */
  getConfig() {
    return {
      logLevel: this.logLevel,
      logDirectory: this.logDirectory,
      enableFileLogging: this.enableFileLogging
    };
  }

  /**
   * Clean up old log files
   * @param {number} [maxAge=7] - Maximum age in days
   */
  cleanupOldLogs(maxAge = 7) {
    if (!this.enableFileLogging) return;
    
    try {
      const files = fs.readdirSync(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.logDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        this.info('Cleaned up old log files', { deletedCount, maxAge });
      }
    } catch (error) {
      this.error('Error cleaning up old logs', error);
    }
  }
}

// Export singleton instance
module.exports = new Logger();
