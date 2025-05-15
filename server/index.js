/**
 * Main server file for Shrooms Support Bot - Minimal CORS debugging
 * @file server/index.js
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const mongoose = require('mongoose');

// Import configuration and ServiceManager
const config = require('./config');
const logger = require('./utils/logger');
const ServiceManager = require('./core/ServiceManager');

// Import rate limiting middleware
const { 
  generalLimiter, 
  chatLimiter, 
  authLimiter, 
  adminLimiter,
  healthLimiter 
} = require('./middleware/rateLimiting');

// Import API routes
const chatRoutes = require('./api/chat');
const ticketRoutes = require('./api/tickets');
const knowledgeRoutes = require('./api/knowledge');
const adminRoutes = require('./api/admin');
const testRoutes = require('./api/test');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Track if services are already registered to prevent duplicates
let servicesRegistered = false;

/**
 * Register all services with ServiceManager
 */
function registerServices() {
  if (servicesRegistered) {
    logger.debug('Services already registered, skipping...');
    return;
  }

  logger.info('Registering services with ServiceManager...');

  // Register MongoDB client as a service first (no dependencies)
  ServiceManager.register('mongoClient',
    () => {
      return mongoose.connection;
    },
    {
      dependencies: [],
      singleton: true,
      lazy: false
    }
  );

  // Register Knowledge Service
  ServiceManager.register('knowledgeService',
    (mongoClient) => {
      const KnowledgeService = require('./services/knowledge');
      return KnowledgeService;
    },
    {
      dependencies: ['mongoClient'],
      singleton: true,
      lazy: false
    }
  );

  // Register Claude Service
  ServiceManager.register('claudeService', 
    (mongoClient) => {
      const ClaudeService = require('./services/claude');
      return new ClaudeService(config.getClaudeConfig());
    },
    {
      dependencies: ['mongoClient'],
      singleton: true,
      lazy: false
    }
  );

  // Register Vector Store Service
  ServiceManager.register('vectorStoreService',
    (mongoClient) => {
      const VectorStoreService = require('./services/vectorStore');
      return new VectorStoreService({
        url: config.getVectorStoreConfig().url,
        collectionName: 'shrooms_knowledge',
        dimensions: 1536,
        metric: 'cosine',
        embeddingProvider: {
          provider: 'openai',
          apiKey: config.getVectorStoreConfig().embeddingApiKey,
          model: 'text-embedding-ada-002'
        }
      });
    },
    {
      dependencies: ['mongoClient'],
      singleton: true,
      lazy: false
    }
  );

  // Register Ticket Service
  ServiceManager.register('ticketService',
    (mongoClient) => {
      const TicketService = require('./services/ticketing');
      return new TicketService();
    },
    {
      dependencies: ['mongoClient'],
      singleton: true,
      lazy: true
    }
  );

  servicesRegistered = true;
  logger.info('All services registered successfully');
}

/**
 * Initialize all services in correct order
 */
async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // Connect to MongoDB first
    await mongoose.connect(config.getDatabaseConfig().uri, config.getDatabaseConfig().options);
    logger.info('Connected to MongoDB successfully');

    // Initialize Knowledge Service
    const knowledgeService = ServiceManager.get('knowledgeService');
    await knowledgeService.initialize();
    logger.info('Knowledge Service initialized successfully');

    // Initialize all registered services
    await ServiceManager.initializeAll();

    // Try to initialize VectorStore but don't fail if it's not available
    try {
      const vectorStoreService = ServiceManager.get('vectorStoreService');
      const initResult = await vectorStoreService.initialize();
      
      if (!initResult.success) {
        logger.warn(`VectorStore initialization failed: ${initResult.error} - continuing with MongoDB only`);
      } else {
        logger.info('VectorStore Service initialized successfully');
      }
    } catch (error) {
      logger.warn('VectorStore not available - continuing with MongoDB only:', error.message);
    }

    // Make services available to routes through ServiceManager
    app.use((req, res, next) => {
      req.services = {
        knowledge: ServiceManager.get('knowledgeService'),
        claude: ServiceManager.get('claudeService'),
        vectorStore: ServiceManager.get('vectorStoreService'),
        ticket: ServiceManager.get('ticketService')
      };
      next();
    });

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Service initialization failed:', error);
    throw error;
  }
}

/**
 * Setup middleware with MINIMAL configuration for CORS debugging
 */
function setupMiddleware() {
  // ULTIMATE OPTIONS HANDLER - BEFORE EVERYTHING ELSE!!!
  app.use((req, res, next) => {
    logger.info(`=== INCOMING REQUEST ===`, {
      method: req.method,
      url: req.url,
      origin: req.get('origin'),
      userAgent: req.get('user-agent')
    });

    if (req.method === 'OPTIONS') {
      logger.info('🍄 OPTIONS REQUEST INTERCEPTED!', { url: req.url });
      
      // Set ALL possible CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,HEAD,PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Access-Control-Request-Method,Access-Control-Request-Headers');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
      
      logger.info('OPTIONS headers set, sending 200', {
        headers: res.getHeaders()
      });
      
      res.status(200).end();
      return;
    }
    
    next();
  });

  // Log what happens after our OPTIONS handler
  app.use((req, res, next) => {
    logger.info('After OPTIONS handler:', { method: req.method, url: req.url });
    next();
  });

  // Body parsing - ESSENTIAL
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // TEMPORARILY DISABLE OTHER MIDDLEWARE TO DEBUG
  // app.use(helmet(helmetConfig)); // DISABLED
  // app.use(cors(...)); // DISABLED

  // Services middleware
  app.use((req, res, next) => {
    req.services = {
      knowledge: ServiceManager.get('knowledgeService'),
      claude: ServiceManager.get('claudeService'),
      vectorStore: ServiceManager.get('vectorStoreService'),
      ticket: ServiceManager.get('ticketService')
    };
    next();
  });

  // Static files
  app.use('/client', express.static(path.join(__dirname, '../client')));
  app.use('/static', express.static(path.join(__dirname, 'static')));
  
  // Test pages
  app.get('/test-cors', (req, res) => {
    const clientPath = path.join(__dirname, '../client/test-cors.html');
    res.sendFile(clientPath);
  });
}

/**
 * Setup API routes with logging
 */
function setupRoutes() {
  // Log before routes
  app.use('/api', (req, res, next) => {
    logger.info('API route middleware:', { method: req.method, url: req.url });
    next();
  });

  // Root route
  app.get('/', (req, res) => {
    res.json({
      name: 'Shrooms Support Bot API',
      version: '1.0.0',
      status: 'running',
      corsDebugging: true
    });
  });

  // TEMPORARILY REMOVE RATE LIMITERS
  // app.use('/api/admin', adminLimiter); // DISABLED

  // API Routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/test', testRoutes);

  // Simple health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

/**
 * Setup Socket.IO for real-time chat
 */
function setupSocketIO() {
  io.on('connection', (socket) => {
    logger.info('User connected', { socketId: socket.id });
    
    socket.on('disconnect', () => {
      logger.info('User disconnected', { socketId: socket.id });
    });
  });
}

/**
 * Setup error handlers
 */
function setupErrorHandlers() {
  // Global error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  });

  // Handle 404
  app.use((req, res) => {
    logger.info('404 Not Found:', { url: req.url, method: req.method });
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
  });
}

/**
 * Start the server
 */
async function startServer() {
  try {
    logger.info('🍄 STARTING SERVER IN CORS DEBUG MODE 🍄');
    
    // 1. Register all services
    registerServices();
    
    // 2. Initialize services
    await initializeServices();
    
    // 3. Setup middleware (minimal)
    setupMiddleware();
    
    // 4. Setup routes
    setupRoutes();
    
    // 5. Setup Socket.IO
    setupSocketIO();
    
    // 6. Setup error handlers
    setupErrorHandlers();
    
    // 7. Start listening
    const PORT = config.PORT;
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in CORS DEBUG MODE`, {
        environment: config.NODE_ENV,
        pid: process.pid,
        testUrls: {
          corsTest: `http://localhost:${PORT}/test-cors`,
          health: `http://localhost:${PORT}/api/health`
        }
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await ServiceManager.shutdown();
        await mongoose.disconnect();
        logger.info('Database disconnected');
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Error during shutdown initiation:', error);
    process.exit(1);
  }
}

// Setup shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    promise: promise
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Start the application
startServer().catch((error) => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});

module.exports = { app, server, io, ServiceManager };