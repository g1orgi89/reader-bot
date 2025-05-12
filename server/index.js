/**
 * Main server file for Shrooms Support Bot
 * @file server/index.js
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');

// Import configuration and services
const config = require('./config');
const logger = require('./utils/logger');
const ClaudeService = require('./services/claude');
const VectorStoreService = require('./services/vectorStore');

// Import middleware
const { basicAdminAuth, requireAdmin } = require('./middleware/auth');

// Import API routes
const chatRoutes = require('./api/chat');
const ticketRoutes = require('./api/tickets');
const knowledgeRoutes = require('./api/knowledge');
const adminRoutes = require('./api/admin');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Database connection
mongoose.connect(config.getDatabaseConfig().uri, config.getDatabaseConfig().options)
  .then(async () => {
    logger.info('Connected to MongoDB successfully');
    
    // Initialize VectorStore Service after MongoDB connection
    try {
      const vectorStoreService = new VectorStoreService({
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
      
      const initResult = await vectorStoreService.initialize();
      if (initResult.success) {
        logger.info('VectorStore Service initialized successfully');
        
        // Make VectorStore service available to routes
        app.set('vectorStoreService', vectorStoreService);
      } else {
        logger.error('Failed to initialize VectorStore Service', { error: initResult.error });
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to initialize VectorStore Service', { error: error.message });
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize Claude Service
let claudeService;
try {
  claudeService = new ClaudeService(config.getClaudeConfig());
  logger.info('Claude Service initialized successfully');
  
  // Make Claude service available to routes
  app.set('claudeService', claudeService);
} catch (error) {
  logger.error('Failed to initialize Claude Service', { error: error.message });
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit(config.getRateLimitConfig());
app.use('/api', limiter);

// Static files
app.use('/widget', express.static(path.join(__dirname, '../client/chat-widget')));
app.use('/admin', express.static(path.join(__dirname, '../client/admin-panel')));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Admin routes with authentication
app.use('/api/admin', basicAdminAuth, requireAdmin, adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      claude: claudeService.getStatus(),
      vectorStore: {
        service: 'vectorStore',
        status: app.get('vectorStoreService') ? 'active' : 'inactive',
        timestamp: new Date().toISOString()
      },
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  });
});

// Basic chat endpoint for testing (backward compatibility)
app.post('/api/chat-simple', async (req, res) => {
  try {
    const { message, language = 'en', context = [], history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
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

// Socket.IO for real-time chat
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
      
      // Generate response from Claude
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

// Start server
const PORT = config.PORT;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: config.NODE_ENV,
    pid: process.pid
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  mongoose.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  mongoose.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promises
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

module.exports = { app, server, io, claudeService };
