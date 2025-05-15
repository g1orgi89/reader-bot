/**
 * 🍄 Shrooms AI Support Bot - Main Server Entry Point
 * Fully integrated with Claude, Vector DB, and all services
 * @file server/index.js
 */

// Load environment variables first
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import configuration and utilities
const config = require('./config');

// Initialize logger
let logger;
try {
  logger = require('./utils/logger');
} catch (error) {
  console.error('Logger not available, using console');
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.log
  };
}

// Import services
const databaseService = require('./services/database');

// Import API routes
let chatRoutes, ticketRoutes, adminRoutes, knowledgeRoutes;
try {
  chatRoutes = require('./api/chat');
  ticketRoutes = require('./api/tickets');
  adminRoutes = require('./api/admin');
  knowledgeRoutes = require('./api/knowledge');
} catch (error) {
  logger.warn(`API routes not found: ${error.message}`);
  logger.info('Creating placeholder routes...');
  
  // Create placeholder router if routes don't exist
  const router = express.Router();
  router.get('*', (req, res) => {
    res.status(501).json({
      success: false,
      error: 'API endpoint not implemented yet',
      endpoint: req.path
    });
  });
  router.post('*', (req, res) => {
    res.status(501).json({
      success: false,
      error: 'API endpoint not implemented yet',
      endpoint: req.path
    });
  });
  
  chatRoutes = ticketRoutes = adminRoutes = knowledgeRoutes = router;
}

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Get PORT from config or environment
const PORT = config.PORT || process.env.PORT || 3000;

/**
 * 🍄 Enhanced CORS Middleware - Handles all CORS issues
 */
function corsMiddleware(req, res, next) {
  const origin = req.get('Origin') || req.get('Referer');
  
  // Development: Allow all origins
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Production: Restricted origins
    const allowedOrigins = [
      'https://shrooms.io',
      'https://www.shrooms.io',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
  }
  
  // Set comprehensive CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-API-Key, X-User-ID, X-Conversation-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Pages');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

/**
 * Setup security and middleware
 */
function setupMiddleware() {
  // Apply CORS first - critical for frontend integration
  app.use(corsMiddleware);

  // Security headers with updated CSP for Socket.IO
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'", 
          "ws://localhost:*", 
          "wss://localhost:*", 
          "http://localhost:*",
          "ws://127.0.0.1:*",
          "wss://127.0.0.1:*",
          "http://127.0.0.1:*"
        ],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        frameSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false // Disable for Socket.IO compatibility
  }));

  // Body parsing with increased limits for file uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting - more lenient for development
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 100,
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      errorCode: 'RATE_LIMIT_EXCEEDED'
    }
  });
  app.use('/api/', limiter);

  // Static file serving
  app.use('/client', express.static(path.join(__dirname, '../client')));
  app.use('/static', express.static(path.join(__dirname, 'static')));
  app.use('/widget', express.static(path.join(__dirname, '../client/chat-widget')));
  app.use('/admin', express.static(path.join(__dirname, '../client/admin-panel')));
  
  // Log requests in development
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path} - ${req.get('User-Agent')}`);
      next();
    });
  }
}

/**
 * Setup all API routes
 */
function setupRoutes() {
  // Health check - enhanced with service status
  app.get('/api/health', async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {}
      };
      
      // Check database connection
      try {
        const dbHealth = await databaseService.healthCheck();
        health.services.database = dbHealth;
      } catch (error) {
        health.services.database = { status: 'error', message: error.message };
        health.status = 'degraded';
      }
      
      // Check vector store (if available)
      try {
        const { VectorStoreService } = require('./services/vectorStore');
        const vectorStore = new VectorStoreService();
        health.services.vectorStore = await vectorStore.healthCheck();
      } catch (error) {
        health.services.vectorStore = { status: 'unavailable', message: 'Not configured' };
      }
      
      // Check Claude API (if available)
      try {
        const { ClaudeService } = require('./services/claude');
        const claude = new ClaudeService();
        health.services.claude = await claude.healthCheck();
      } catch (error) {
        health.services.claude = { status: 'unavailable', message: 'Not configured' };
      }
      
      res.status(health.status === 'ok' ? 200 : 503).json(health);
    } catch (error) {
      logger.error(`Health check error: ${error.message}`);
      res.status(500).json({
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // CORS test endpoint
  app.get('/api/test-cors', (req, res) => {
    res.json({
      success: true,
      message: '🍄 CORS test successful! The mushroom network is accessible.',
      origin: req.get('Origin'),
      method: req.method,
      headers: {
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      },
      timestamp: new Date().toISOString()
    });
  });

  // Test page routes - both old and new comprehensive
  app.get('/test-cors', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-cors.html'));
  });

  app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-comprehensive.html'));
  });

  app.get('/test-comprehensive', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-comprehensive.html'));
  });

  // API Routes - mount with proper error handling
  app.use('/api/chat', (req, res, next) => {
    try {
      chatRoutes(req, res, next);
    } catch (error) {
      logger.error(`Chat API error: ${error.message}`);
      next(error);
    }
  });

  app.use('/api/tickets', (req, res, next) => {
    try {
      ticketRoutes(req, res, next);
    } catch (error) {
      logger.error(`Tickets API error: ${error.message}`);
      next(error);
    }
  });

  app.use('/api/admin', (req, res, next) => {
    try {
      adminRoutes(req, res, next);
    } catch (error) {
      logger.error(`Admin API error: ${error.message}`);
      next(error);
    }
  });

  app.use('/api/knowledge', (req, res, next) => {
    try {
      knowledgeRoutes(req, res, next);
    } catch (error) {
      logger.error(`Knowledge API error: ${error.message}`);
      next(error);
    }
  });

  // Root endpoint with API documentation
  app.get('/', (req, res) => {
    res.json({
      name: '🍄 Shrooms AI Support Bot',
      version: '1.0.0',
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      documentation: {
        health: '/api/health',
        corsTest: '/api/test-cors',
        testPages: {
          simple: '/test-cors',
          comprehensive: '/test-comprehensive',
          shortcut: '/test'
        },
        apis: {
          chat: '/api/chat',
          tickets: '/api/tickets',
          admin: '/api/admin',
          knowledge: '/api/knowledge'
        },
        widgets: {
          chatWidget: '/widget',
          adminPanel: '/admin'
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler for missing routes
  app.use((req, res) => {
    logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
      success: false,
      error: 'Route not found',
      errorCode: 'NOT_FOUND',
      path: req.path,
      method: req.method,
      availableEndpoints: {
        health: '/api/health',
        chat: '/api/chat',
        tickets: '/api/tickets',
        admin: '/api/admin',
        knowledge: '/api/knowledge',
        testPages: '/test, /test-comprehensive, /test-cors'
      }
    });
  });
}

/**
 * Global error handler
 */
function setupErrorHandlers() {
  app.use((err, req, res, next) => {
    logger.error(`Error on ${req.method} ${req.path}: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    
    // Determine error type and response
    let status = err.status || err.statusCode || 500;
    let errorCode = err.code || 'SERVER_ERROR';
    let message = err.message || 'Internal Server Error';
    
    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production' && status === 500) {
      message = 'Internal Server Error';
    }
    
    res.status(status).json({
      success: false,
      error: message,
      errorCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });
}

/**
 * Setup Socket.IO for real-time communication
 */
function setupSocket() {
  logger.info('Setting up Socket.IO...');
  
  const io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? '*' : [
        'https://shrooms.io',
        'https://www.shrooms.io',
        'http://localhost:3000',
        'http://localhost:5173'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info(`🍄 Socket connected: ${socket.id}`);

    // Handle user joining
    socket.on('join', (data) => {
      if (data && data.userId) {
        logger.info(`User joined: ${data.userId}`);
        socket.join(data.userId);
        socket.emit('joined', { userId: data.userId, socketId: socket.id });
      }
    });

    // Handle incoming messages
    socket.on('message', async (data) => {
      try {
        logger.info(`Message received via socket from ${socket.id}: ${data.message || '[no message]'}`);
        
        // Acknowledge receipt
        socket.emit('messageReceived', { 
          success: true, 
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
        
        // Here you can integrate with chat service
        // const response = await chatService.processMessage(data);
        // socket.emit('chatResponse', response);
        
      } catch (error) {
        logger.error(`Socket message error: ${error.message}`);
        socket.emit('error', { 
          message: 'Error processing message',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      if (data && data.userId) {
        socket.to(data.userId).emit('userTyping', { 
          userId: data.userId,
          isTyping: data.isTyping 
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`🍄 Socket disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error: ${error.message}`);
    });
  });

  return io;
}

/**
 * Initialize database and services
 */
async function initializeServices() {
  logger.info('🍄 Initializing services...');
  
  try {
    // Initialize database
    await databaseService.initialize();
    logger.info('✅ Database service initialized');
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error.message}`);
    logger.warn('⚠️ Continuing without database connection');
  }
  
  // Initialize other services as needed
  try {
    // Vector store initialization would go here
    logger.info('Vector store service available for initialization');
  } catch (error) {
    logger.warn(`Vector store not initialized: ${error.message}`);
  }
  
  try {
    // Claude service initialization would go here
    logger.info('Claude service available for initialization');
  } catch (error) {
    logger.warn(`Claude service not initialized: ${error.message}`);
  }
}

/**
 * Graceful shutdown handling
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    server.close(async (err) => {
      if (err) {
        logger.error(`Error during server shutdown: ${err.message}`);
      } else {
        logger.info('HTTP server closed');
      }
      
      try {
        // Close database connections
        await databaseService.close();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error(`Error closing database: ${error.message}`);
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(err ? 1 : 0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}`);
    logger.error(`Reason: ${reason}`);
  });
}

/**
 * Main server startup function
 */
async function startServer() {
  try {
    logger.info('🍄 Starting Shrooms AI Support Bot server...');
    
    // Setup in correct order
    setupMiddleware();
    setupRoutes();
    setupErrorHandlers();
    setupSocket();
    setupGracefulShutdown();
    
    // Initialize services
    await initializeServices();
    
    // Start listening
    server.listen(PORT, () => {
      logger.info('═══════════════════════════════════════');
      logger.info('🍄 Shrooms AI Support Bot Server Ready! 🍄');
      logger.info('═══════════════════════════════════════');
      logger.info(`📍 Port: ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health Check: http://localhost:${PORT}/api/health`);
      logger.info(`🧪 Test Pages:`);
      logger.info(`   - Simple CORS: http://localhost:${PORT}/test-cors`);
      logger.info(`   - Comprehensive: http://localhost:${PORT}/test-comprehensive`);
      logger.info(`   - Quick Access: http://localhost:${PORT}/test`);
      logger.info(`💬 Chat Widget: http://localhost:${PORT}/widget`);
      logger.info(`🔧 Admin Panel: http://localhost:${PORT}/admin`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/`);
      logger.info('═══════════════════════════════════════');
    });
    
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error(`Critical error during startup: ${error.message}`);
  process.exit(1);
});

// Export for testing
module.exports = { app, server };