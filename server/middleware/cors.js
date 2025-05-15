/**
 * Custom CORS middleware for Shrooms Support Bot
 * Handles preflight OPTIONS requests properly
 * @file server/middleware/cors.js
 */

const logger = require('../utils/logger');

/**
 * Custom CORS middleware with proper preflight handling
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
function customCors(req, res, next) {
  const origin = req.get('Origin');
  const method = req.method;
  
  // 🍄 SUPER SIMPLE TEST - log EVERY request
  console.log(`🟢 CORS MIDDLEWARE HIT: ${method} ${req.path}`);
  
  // Log all CORS requests for debugging
  logger.info(`🌐 CORS Request: ${method} ${req.path} from origin: ${origin}`);
  
  // Allow requests from specific origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://shrooms-support-bot.vercel.app',
    'https://shrooms.io'
  ];
  
  // Set CORS headers for all requests
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || 'http://localhost:3000');
  }
  
  // Always set these headers
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, ' +
    'Cache-Control, Pragma, X-Custom-Header, X-Api-Key'
  );
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    console.log(`🚨🚨🚨 OPTIONS REQUEST FOR ${req.path} - RETURNING 200!!! 🚨🚨🚨`);
    logger.info(`🚨 OPTIONS REQUEST DETECTED for ${req.path}`);
    logger.info(`🔍 Request headers:`, {
      'access-control-request-method': req.get('Access-Control-Request-Method'),
      'access-control-request-headers': req.get('Access-Control-Request-Headers'),
      'origin': origin
    });
    
    // Send successful preflight response
    return res.status(200).end();
  }
  
  // Continue to next middleware for non-OPTIONS requests
  next();
}

module.exports = customCors;