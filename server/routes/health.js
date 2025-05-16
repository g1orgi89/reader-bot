/**
 * Health Check API Route
 * @file server/routes/health.js
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const claudeService = require('../services/claude');
const vectorStoreService = require('../services/vectorStore');
const packageJson = require('../../package.json');

/**
 * @typedef {Object} ServiceHealth
 * @property {string} status - Status: ok, warning, error
 * @property {string} message - Status message
 * @property {Object} [details] - Additional details
 */

/**
 * @typedef {Object} HealthResponse
 * @property {string} status - Overall status
 * @property {string} timestamp - Current timestamp
 * @property {string} environment - Environment name
 * @property {string} version - Application version
 * @property {Object} services - Services health status
 * @property {Object} features - Feature flags
 */

/**
 * Get overall health status
 * @route GET /api/health
 * @returns {HealthResponse} Health status information
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: packageJson.version || '1.0.0',
      services: {},
      features: {
        enableRAG: process.env.ENABLE_RAG === 'true',
        enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
        enableCaching: process.env.ENABLE_CACHING === 'true',
        enableHealthChecks: true,
        enableMetrics: process.env.ENABLE_METRICS === 'true',
        enableTelegram: process.env.TELEGRAM_BOT_TOKEN ? true : false
      }
    };

    // Check database connection
    health.services.database = await checkDatabaseHealth();
    
    // Check vector store (only if RAG is enabled)
    if (health.features.enableRAG) {
      health.services.vectorStore = await checkVectorStoreHealth();
    } else {
      health.services.vectorStore = {
        status: 'disabled',
        message: 'Vector store disabled by configuration'
      };
    }
    
    // Check Claude API
    health.services.claude = await checkClaudeHealth();

    // Determine overall status
    const serviceStatuses = Object.values(health.services).map(s => s.status);
    
    if (serviceStatuses.includes('error')) {
      // If database or Claude is down, overall status is error
      const criticalErrors = ['database', 'claude'].some(service => 
        health.services[service] && health.services[service].status === 'error'
      );
      health.status = criticalErrors ? 'error' : 'warning';
    } else if (serviceStatuses.includes('warning')) {
      health.status = 'warning';
    }

    res.status(health.status === 'error' ? 503 : 200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: { status: 'unknown' },
        vectorStore: { status: 'unknown' },
        claude: { status: 'unknown' }
      }
    });
  }
});

/**
 * Get detailed health status
 * @route GET /api/health/detailed
 * @returns {Object} Detailed health information
 */
router.get('/detailed', async (req, res) => {
  try {
    const detailed = {
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      database: await getDatabaseDetails(),
      vectorStore: await getVectorStoreDetails(),
      performance: {
        averageResponseTime: await getAverageResponseTime(),
        totalRequests: await getTotalRequests(),
        errorRate: await getErrorRate()
      }
    };

    res.json(detailed);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Check database health
 * @returns {Promise<ServiceHealth>} Database health status
 */
async function checkDatabaseHealth() {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: { status: 'error', message: 'Database disconnected' },
      1: { status: 'ok', message: 'Database is healthy and responding' },
      2: { status: 'warning', message: 'Database connecting' },
      3: { status: 'warning', message: 'Database disconnecting' }
    };

    const result = states[state] || { status: 'error', message: 'Unknown database state' };
    
    if (state === 1) {
      // Additional health check - try to perform a simple operation
      await mongoose.connection.db.admin().ping();
      result.details = {
        state: mongoose.connection.states[state],
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        isConnected: state === 1,
        readyState: state
      };
    }

    return result;
  } catch (error) {
    return {
      status: 'error',
      message: `Database health check failed: ${error.message}`
    };
  }
}

/**
 * Check vector store health
 * @returns {Promise<ServiceHealth>} Vector store health status
 */
async function checkVectorStoreHealth() {
  try {
    // Check if vector store service exists and is initialized
    if (!vectorStoreService) {
      return {
        status: 'warning',
        message: 'Vector store service not available'
      };
    }

    // Try to get health status from vector store service
    if (typeof vectorStoreService.getHealthStatus === 'function') {
      return await vectorStoreService.getHealthStatus();
    }

    // Basic check if vector store is initialized
    if (vectorStoreService.isInitialized) {
      return {
        status: 'ok',
        message: 'Vector store is operational'
      };
    } else {
      return {
        status: 'warning',
        message: 'Vector store not initialized (will be available after RAG setup)'
      };
    }
  } catch (error) {
    return {
      status: 'warning',
      message: `Vector store check failed: ${error.message}`
    };
  }
}

/**
 * Check Claude API health
 * @returns {Promise<ServiceHealth>} Claude health status
 */
async function checkClaudeHealth() {
  try {
    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        status: 'error',
        message: 'Claude API key not configured'
      };
    }

    // Simple health check - this doesn't actually call the API
    // to avoid costs on every health check
    return {
      status: 'ok',
      message: 'Claude API configured and ready'
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Claude health check failed: ${error.message}`
    };
  }
}

/**
 * Get detailed database information
 * @returns {Promise<Object>} Database details
 */
async function getDatabaseDetails() {
  try {
    const connection = mongoose.connection;
    return {
      host: connection.host,
      port: connection.port,
      name: connection.name,
      readyState: connection.readyState,
      collections: connection.collections ? Object.keys(connection.collections) : []
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get detailed vector store information
 * @returns {Promise<Object>} Vector store details
 */
async function getVectorStoreDetails() {
  try {
    if (!vectorStoreService) {
      return { status: 'not_available' };
    }

    return {
      isInitialized: vectorStoreService.isInitialized || false,
      enableRAG: process.env.ENABLE_RAG === 'true',
      qdrantUrl: process.env.QDRANT_URL || 'not_configured'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get average response time (placeholder)
 * @returns {Promise<number>} Average response time in ms
 */
async function getAverageResponseTime() {
  // TODO: Implement actual metrics collection
  return Math.floor(Math.random() * 1000) + 500;
}

/**
 * Get total requests count (placeholder)
 * @returns {Promise<number>} Total requests
 */
async function getTotalRequests() {
  // TODO: Implement actual metrics collection
  return Math.floor(Math.random() * 10000) + 1000;
}

/**
 * Get error rate (placeholder)
 * @returns {Promise<number>} Error rate percentage
 */
async function getErrorRate() {
  // TODO: Implement actual metrics collection
  return Math.random() * 5; // 0-5% error rate
}

module.exports = router;