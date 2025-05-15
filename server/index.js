/**
 * Main server file for Shrooms Support Bot - Fix CORS configuration
 * @file server/index.js
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const path = require('path');
const mongoose = require('mongoose');

// Import configuration and ServiceManager
const config = require('./config');
const logger = require('./utils/logger');
const ServiceManager = require('./core/ServiceManager');

// Import custom CORS middleware 🍄
const corsMiddleware = require('./middleware/cors');

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

// Configure Socket.IO with our CORS settings
const io = socketIo(server, {
  cors: {
    origin: function(origin, callback) {
      // Use same origin checking logic as our main CORS middleware
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      const allowedOrigins = config.CORS_ORIGIN ? 
        config.CORS_ORIGIN.split(',').map(o => o.trim()) :
        ['http://localhost:3000'];
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
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
 * Setup middleware with FIXED CORS configuration 🍄
 */
function setupMiddleware() {
  // Security middleware with updated CSP settings
  const helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'"
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
    
    // Allow inline styles only in development for test pages
    helmetConfig.contentSecurityPolicy.directives.styleSrc.push("'unsafe-inline'");
  }

  app.use(helmet(helmetConfig));

  // 🍄 Apply our custom CORS middleware - THIS IS THE FIX!
  app.use(corsMiddleware);

  // Set default charset in Content-Type headers
  app.use((req, res, next) => {
    // Override the default express/socket.io content-type to include charset
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
 * Setup API routes with specific rate limiters
 */
function setupRoutes() {
  // Root route - API information
  app.get('/', (req, res) => {
    res.json({
      name: 'Shrooms Support Bot API',
      version: '1.0.0',
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        chat: '/api/chat/*',
        tickets: '/api/tickets/*',
        knowledge: '/api/knowledge/*',
        admin: '/api/admin/*',
        test: '/api/test/*',
        health: '/api/health',
        chatSimple: '/api/chat-simple'
      },
      testTools: {
        chatTest: '/test-chat',
        socketTest: '/client/test-chat.html',
        corsTest: '/test-cors',
        russianSearchTest: '/api/test/search-russian',
        russianSearchPage: '/test-russian',
        encodingTest: '/api/test/encoding'
      },
      documentation: 'https://github.com/g1orgi89/shrooms-support-bot'
    });
  });

  // Apply specific rate limiters to specific routes only
  app.use('/api/chat', chatLimiter);
  app.use('/api/admin/login', authLimiter);
  app.use('/api/admin', adminLimiter);

  // API Routes
  app.use('/api/chat', chatRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api/admin', adminRoutes);

  // Health check endpoint with testing-friendly rate limiter
  app.get('/api/health', healthLimiter, async (req, res) => {
    try {
      const health = await ServiceManager.healthCheck();
      const stats = ServiceManager.getStats();

      res.json({
        status: health.status,
        timestamp: health.timestamp,
        version: process.env.npm_package_version || '1.0.0',
        services: health.services,
        serviceStats: {
          totalServices: stats.totalServices,
          initializedServices: stats.initializedServices,
          singletonServices: stats.singletonServices
        },
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        error: 'Health check failed'
      });
    }
  });

  // Backward compatibility endpoint with chat rate limiting
  app.post('/api/chat-simple', chatLimiter, async (req, res) => {
    try {
      const { message, language = 'en', context = [], history = [] } = req.body;
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }
      
      const claudeService = ServiceManager.get('claudeService');
      const response = await claudeService.generateResponse(message, {
        language,
        context,
        history
      });
      
      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      logger.error('Chat endpoint error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

/**
 * Setup Socket.IO for real-time chat
 */
function setupSocketIO() {
  io.on('connection', (socket) => {
    logger.info('User connected', { socketId: socket.id });
    
    // Handle new messages
    socket.on('sendMessage', async (data) => {
      try {
        const { message, language, context, history, userId } = data;
        
        if (!message) {
          socket.emit('error', { message: 'Message is required' });
          return;
        }
        
        // Add user message to history
        const userMessage = {
          role: 'user',
          text: message,
          timestamp: Date.now()
        };
        
        // Generate response from Claude via ServiceManager
        const claudeService = ServiceManager.get('claudeService');
        const response = await claudeService.generateResponse(message, {
          language,
          context,
          history: [...(history || []), userMessage]
        });
        
        // Send response back to user
        socket.emit('messageResponse', {
          message: response.message,
          needsTicket: response.needsTicket,
          language: response.language,
          timestamp: Date.now()
        });
        
        logger.debug('Message processed', {
          socketId: socket.id,
          userId,
          tokensUsed: response.tokensUsed
        });
      } catch (error) {
        logger.error('Socket message error', {
          error: error.message,
          socketId: socket.id
        });
        socket.emit('error', { message: 'Error processing message' });
      }
    });
    
    // Handle disconnect
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
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // Handle 404
  app.use((req, res) => {
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
    // 1. Register all services
    registerServices();
    
    // 2. Initialize services
    await initializeServices();
    
    // 3. Setup middleware
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
      logger.info(`🍄 Shrooms Support Bot Server running on port ${PORT}`, {
        environment: config.NODE_ENV,
        pid: process.pid,
        testUrls: {
          api: `http://localhost:${PORT}/`,
          testChat: `http://localhost:${PORT}/test-chat`,
          testRussian: `http://localhost:${PORT}/test-russian`,
          testCors: `http://localhost:${PORT}/test-cors`,
          health: `http://localhost:${PORT}/api/health`,
          russianTest: `http://localhost:${PORT}/api/test/search-russian`
        }
      });
    });

    // Service health monitoring
    setInterval(async () => {
      try {
        const health = await ServiceManager.healthCheck();
        if (health.status !== 'healthy') {
          logger.warn('Service health check warning', { health });
        }
      } catch (error) {
        logger.error('Health check error:', error);
      }
    }, 60000); // Check every minute

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
    // 1. Stop accepting new requests
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // 2. Shutdown all services
        await ServiceManager.shutdown();
        
        // 3. Close database connection
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