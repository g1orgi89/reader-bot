/**
 * ServiceManager middleware for injecting services into request object
 * @file server/middleware/serviceManager.js
 */

const logger = require('../utils/logger');

/**
 * Creates middleware that injects ServiceManager services into req.services
 * @param {import('../core/ServiceManager')} serviceManager - ServiceManager instance
 * @returns {Function} Express middleware function
 */
function createServiceManagerMiddleware(serviceManager) {
  return (req, res, next) => {
    try {
      // Get all available services
      const availableServices = serviceManager.getAvailableServices();
      
      // Create services object for request
      req.services = {};
      
      // Add each service to the request object
      for (const serviceName of availableServices) {
        try {
          const service = serviceManager.getService(serviceName);
          if (service) {
            req.services[serviceName] = service;
          }
        } catch (error) {
          logger.warn(`Service ${serviceName} not available: ${error.message}`);
        }
      }
      
      // Add helper methods to req.services
      req.services._getHealth = () => serviceManager.getHealthStatus();
      req.services._getStats = () => serviceManager.getServiceStats();
      req.services._isAvailable = (serviceName) => {
        return req.services[serviceName] && serviceManager.isServiceInitialized(serviceName);
      };
      
      // Log available services in development
      if (process.env.NODE_ENV === 'development') {
        const serviceNames = Object.keys(req.services).filter(key => !key.startsWith('_'));
        logger.debug(`Services injected: ${serviceNames.join(', ')}`);
      }
      
      next();
    } catch (error) {
      logger.error(`ServiceManager middleware error: ${error.message}`);
      next(error);
    }
  };
}

/**
 * Middleware to check required services are available
 * @param {string[]} requiredServices - List of required service names
 * @returns {Function} Express middleware function
 */
function requireServices(requiredServices) {
  return (req, res, next) => {
    const missingServices = [];
    
    for (const serviceName of requiredServices) {
      if (!req.services?.[serviceName]) {
        missingServices.push(serviceName);
      }
    }
    
    if (missingServices.length > 0) {
      logger.error(`Required services not available: ${missingServices.join(', ')}`);
      return res.status(503).json({
        success: false,
        error: 'Required services not available',
        errorCode: 'SERVICE_UNAVAILABLE',
        missingServices,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

module.exports = {
  createServiceManagerMiddleware,
  requireServices
};
