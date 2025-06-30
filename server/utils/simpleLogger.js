/**
 * Simple logger utility for Reader Bot
 * @file server/utils/simpleLogger.js
 */

const winston = require('winston');

// Simple console format
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${message}`;
  })
);

// Create simple logger for Reader Bot
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: consoleFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
      )
    })
  ],
  // Disable exitOnError to prevent process exit
  exitOnError: false
});

module.exports = logger;