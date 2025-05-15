/**
 * Simple logger utility for Shrooms Support Bot
 * @file server/utils/logger.js
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level (info, error, warn, debug)
 * @property {string} message - Log message
 */

/**
 * Simple logger class
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';
    this.logFile = path.join(logDir, 'app.log');
    this.errorFile = path.join(logDir, 'error.log');
  }

  /**
   * Get log levels hierarchy
   * @returns {Object} Log levels with numeric values
   */
  getLogLevels() {
    return {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Check if message should be logged based on level
   * @param {string} level - Message level
   * @returns {boolean} Should log or not
   */
  shouldLog(level) {
    const levels = this.getLogLevels();
    return levels[level] <= levels[this.logLevel];
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @returns {string} Formatted message
   */
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Write to log file
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  writeToFile(level, message) {
    if (!this.enableFileLogging) return;

    const formattedMessage = this.formatMessage(level, message) + '\n';
    
    try {
      // Write to main log file
      fs.appendFileSync(this.logFile, formattedMessage);
      
      // Write errors to separate error file
      if (level === 'error') {
        fs.appendFileSync(this.errorFile, formattedMessage);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  info(message) {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ ${message}`);
      this.writeToFile('info', message);
    }
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  error(message) {
    if (this.shouldLog('error')) {
      console.error(`❌ ${message}`);
      this.writeToFile('error', message);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}`);
      this.writeToFile('warn', message);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  debug(message) {
    if (this.shouldLog('debug')) {
      console.log(`🐛 ${message}`);
      this.writeToFile('debug', message);
    }
  }
}

// Export singleton instance
module.exports = new Logger();