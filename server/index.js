/**
 * 🍄 Shrooms AI Support Bot - Main Server Entry Point
 * Fixes CORS issues and provides complete server functionality
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Import utilities and config
const logger = require('./utils/logger');
const config = require('./config');

// Import routes
const chatRoutes = require('./api/chat');
const ticketRoutes = require('./api/tickets');
const knowledgeRoutes = require('./api/knowledge');

// Import services
const vectorStoreService = require('./services/vectorStore');

// Create Express app
const app = express();
const server = http.createServer(app);

// PORT configuration with fallback
const PORT = config.PORT || process.env.PORT || 3000;

/**
 * 🍄 FIXED CORS Middleware - Handles all CORS issues
 */
function corsMiddleware(req, res, next) {
  // Get origin from request
  const origin = req.get('Origin') || req.get('Referer');
  
  // Allow all origins in development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // In production, be more restrictive
    const allowedOrigins = [
      'https://shrooms.io',
      'https://www.shrooms.io',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
  }
  
  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

/**
 * Setup middleware with FIXED CORS configuration 🍄
 */
function setupMiddleware() {
  // 🍄 Apply CORS FIRST - before any other middleware
  app.use(corsMiddleware);

  // Security middleware with updated CSP settings
  const helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Allow inline scripts for onclick handlers
          "cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'" // Allow inline styles
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:*", // Allow WebSocket connections
          "wss://localhost:*"
        ],
        objectSrc: ["'none'"],
        imageSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        frameSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  };

  // Use different CSP settings based on environment
  if (process.env.NODE_ENV === 'development') {
    // Add some development-specific permissions
    helmetConfig.contentSecurityPolicy.directives.connectSrc.push(
      "ws://localhost:*",
      "wss://localhost:*",
      "http://localhost:*"
    );
  }

  app.use(helmet(helmetConfig));

  // Set default charset in Content-Type headers
  app.use((req, res, next) => {
    // Override the default express content-type to include charset
    const setContentType = res.type.bind(res);
    res.type = function(type) {
      if (type === 'html' || type === 'text/html') {
        return setContentType.call(this, 'text/html; charset=utf-8');
      }
      if (type === 'json' || type === 'application/json') {
        return setContentType.call(this, 'application/json; charset=utf-8');
      }
      return setContentType.call(this, type);
    };
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use('/api/', limiter);

  // Static files - Updated to support test pages from both client and server
  // Serve the entire client directory for development/testing
  app.use('/client', express.static(path.join(__dirname, '../client')));
  
  // Serve static files from server/static directory
  app.use('/static', express.static(path.join(__dirname, 'static')));
  
  // Specific routes for components
  app.use('/widget', express.static(path.join(__dirname, '../client/chat-widget')));
  app.use('/admin', express.static(path.join(__dirname, '../client/admin-panel')));
  
  // Serve test pages directly (priority order matters)
  app.get('/test-chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-chat.html'));
  });
  
  app.get('/test-russian', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-russian-search.html'));
  });

  app.get('/test-cors', (req, res) => {
    // Try server/static first, then fallback to client if needed
    const serverPath = path.join(__dirname, 'static/test-cors.html');
    const clientPath = path.join(__dirname, '../client/test-cors.html');
    
    require('fs').access(serverPath, require('fs').constants.F_OK, (err) => {
      if (err) {
        res.sendFile(clientPath);
      } else {
        res.sendFile(serverPath);
      }
    });
  });
}

/**
 * Setup API routes
 */
function setupRoutes() {
  // API routes
  app.use('/api/chat', chatRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/knowledge', knowledgeRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // Test endpoint for CORS debugging
  app.get('/api/test-cors', (req, res) => {
    res.json({ 
      message: 'CORS test successful! 🍄',
      origin: req.get('Origin'),
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // Root route
  app.get('/', (req, res) => {
    res.json({
      name: 'Shrooms AI Support Bot',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        chat: '/api/chat/message',
        tickets: '/api/tickets',
        knowledge: '/api/knowledge'
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      errorCode: 'NOT_FOUND',
      path: req.path
    });
  });
}

/**
 * Setup error handlers
 */
function setupErrorHandlers() {
  // Global error handler
  app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    
    // Don't leak error details in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message;
    
    res.status(err.status || 500).json({
      success: false,
      error: errorMessage,
      errorCode: err.code || 'SERVER_ERROR'
    });
  });
}

/**
 * Setup Socket.IO for real-time chat
 */
function setupSocket() {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join', (data) => {
      logger.info(`User joined: ${data.userId}`);
      socket.join(data.userId);
    });

    socket.on('sendMessage', async (data) => {
      try {
        logger.info(`Message received via socket: ${data.message}`);
        // Handle message processing here
        socket.emit('messageReceived', { success: true });
      } catch (error) {
        logger.error(`Socket error: ${error.message}`);
        socket.emit('error', { message: 'Error processing message' });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info('✅ Connected to MongoDB');
    
    // Initialize vector store
    await vectorStoreService.initialize();
    logger.info('✅ Vector store initialized');
    
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error.message}`);
    throw error;
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Setup middleware first
    setupMiddleware();
    
    // Setup routes
    setupRoutes();
    
    // Setup error handlers
    setupErrorHandlers();
    
    // Setup Socket.IO
    setupSocket();
    
    // Initialize database
    await initializeDatabase();
    
    // Start listening
    server.listen(PORT, () => {
      logger.info(`🍄 Shrooms Support Bot server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
      logger.info(`CORS test: http://localhost:${PORT}/api/test-cors`);
    });
    
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
function setupGracefulShutdown() {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  // Handle unhandled rejections and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  });
}

// Setup graceful shutdown handlers
setupGracefulShutdown();

// Start the server
startServer().catch((error) => {
  logger.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});

module.exports = app;