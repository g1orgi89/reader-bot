/**
 * Error codes and standardized error responses
 * @file server/constants/errorCodes.js
 */

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Error code constants
const ERROR_CODES = {
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  GENERIC_ERROR: 'GENERIC_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Ticket errors
  TICKET_CREATE_ERROR: 'TICKET_CREATE_ERROR',
  TICKET_UPDATE_ERROR: 'TICKET_UPDATE_ERROR',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  INVALID_TICKET_STATUS: 'INVALID_TICKET_STATUS',
  INVALID_TICKET_PRIORITY: 'INVALID_TICKET_PRIORITY',
  INVALID_TICKET_CATEGORY: 'INVALID_TICKET_CATEGORY',

  // Chat/Claude errors
  CLAUDE_SERVICE_UNAVAILABLE: 'CLAUDE_SERVICE_UNAVAILABLE',
  VECTOR_SERVICE_UNAVAILABLE: 'VECTOR_SERVICE_UNAVAILABLE',
  CLAUDE_ERROR: 'CLAUDE_ERROR',
  CONVERSATION_FETCH_ERROR: 'CONVERSATION_FETCH_ERROR',
  CONVERSATION_DELETE_ERROR: 'CONVERSATION_DELETE_ERROR',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  STATS_FETCH_ERROR: 'STATS_FETCH_ERROR',
  STATS_ERROR: 'STATS_ERROR',

  // Service errors
  SERVICE_INIT_ERROR: 'SERVICE_INIT_ERROR',
  SERVICE_NOT_AVAILABLE: 'SERVICE_NOT_AVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

// Error definitions with messages and HTTP status codes
const ERROR_DEFINITIONS = {
  [ERROR_CODES.INTERNAL_ERROR]: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.GENERIC_ERROR]: {
    code: 'GENERIC_ERROR',
    message: 'An unexpected error occurred',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    httpStatus: HTTP_STATUS.NOT_FOUND
  },
  [ERROR_CODES.FORBIDDEN]: {
    code: 'FORBIDDEN',
    message: 'Access forbidden',
    httpStatus: HTTP_STATUS.FORBIDDEN
  },
  [ERROR_CODES.RATE_LIMITED]: {
    code: 'RATE_LIMITED',
    message: 'Rate limit exceeded',
    httpStatus: HTTP_STATUS.RATE_LIMITED
  },

  // Validation errors
  [ERROR_CODES.VALIDATION_ERROR]: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Missing required field',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },
  [ERROR_CODES.INVALID_FORMAT]: {
    code: 'INVALID_FORMAT',
    message: 'Invalid format',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },

  // Ticket errors
  [ERROR_CODES.TICKET_CREATE_ERROR]: {
    code: 'TICKET_CREATE_ERROR',
    message: 'Failed to create ticket',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.TICKET_UPDATE_ERROR]: {
    code: 'TICKET_UPDATE_ERROR',
    message: 'Failed to update ticket',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.TICKET_NOT_FOUND]: {
    code: 'TICKET_NOT_FOUND',
    message: 'Ticket not found',
    httpStatus: HTTP_STATUS.NOT_FOUND
  },
  [ERROR_CODES.INVALID_TICKET_STATUS]: {
    code: 'INVALID_TICKET_STATUS',
    message: 'Invalid ticket status',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },
  [ERROR_CODES.INVALID_TICKET_PRIORITY]: {
    code: 'INVALID_TICKET_PRIORITY',
    message: 'Invalid ticket priority',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },
  [ERROR_CODES.INVALID_TICKET_CATEGORY]: {
    code: 'INVALID_TICKET_CATEGORY',
    message: 'Invalid ticket category',
    httpStatus: HTTP_STATUS.BAD_REQUEST
  },

  // Chat/Claude errors
  [ERROR_CODES.CLAUDE_SERVICE_UNAVAILABLE]: {
    code: 'CLAUDE_SERVICE_UNAVAILABLE',
    message: 'Claude service is unavailable',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE
  },
  [ERROR_CODES.VECTOR_SERVICE_UNAVAILABLE]: {
    code: 'VECTOR_SERVICE_UNAVAILABLE',
    message: 'Vector search service is unavailable',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE
  },
  [ERROR_CODES.CLAUDE_ERROR]: {
    code: 'CLAUDE_ERROR',
    message: 'Error communicating with Claude API',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.CONVERSATION_FETCH_ERROR]: {
    code: 'CONVERSATION_FETCH_ERROR',
    message: 'Failed to fetch conversation',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.CONVERSATION_DELETE_ERROR]: {
    code: 'CONVERSATION_DELETE_ERROR',
    message: 'Failed to delete conversation',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.CONVERSATION_NOT_FOUND]: {
    code: 'CONVERSATION_NOT_FOUND',
    message: 'Conversation not found',
    httpStatus: HTTP_STATUS.NOT_FOUND
  },
  [ERROR_CODES.STATS_FETCH_ERROR]: {
    code: 'STATS_FETCH_ERROR',
    message: 'Failed to fetch statistics',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.STATS_ERROR]: {
    code: 'STATS_ERROR',
    message: 'Error retrieving statistics',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },

  // Service errors
  [ERROR_CODES.SERVICE_INIT_ERROR]: {
    code: 'SERVICE_INIT_ERROR',
    message: 'Service initialization failed',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  [ERROR_CODES.SERVICE_NOT_AVAILABLE]: {
    code: 'SERVICE_NOT_AVAILABLE',
    message: 'Required service is not available',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR
  }
};

// Helper functions
/**
 * Create standardized error response
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} [customMessage] - Optional custom message to override default
 * @param {Object} [details] - Optional additional details
 * @returns {Object} Standardized error response
 */
function createErrorResponse(errorCode, customMessage = null, details = {}) {
  const errorDef = ERROR_DEFINITIONS[errorCode] || ERROR_DEFINITIONS[ERROR_CODES.GENERIC_ERROR];
  
  const response = {
    error: customMessage || errorDef.message,
    errorCode: errorDef.code,
    httpStatus: errorDef.httpStatus,
    timestamp: new Date().toISOString()
  };

  if (Object.keys(details).length > 0) {
    response.details = details;
  }

  return response;
}

/**
 * Check if an error code is valid
 * @param {string} errorCode - Error code to validate
 * @returns {boolean} True if valid error code
 */
function isValidErrorCode(errorCode) {
  return Object.values(ERROR_CODES).includes(errorCode);
}

/**
 * Get error definition by code
 * @param {string} errorCode - Error code
 * @returns {Object|null} Error definition or null if not found
 */
function getErrorDefinition(errorCode) {
  return ERROR_DEFINITIONS[errorCode] || null;
}

// Export all constants and helpers
module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_DEFINITIONS,
  createErrorResponse,
  isValidErrorCode,
  getErrorDefinition,
  
  // Backward compatibility exports
  VALIDATION_ERRORS: {
    MISSING_REQUIRED_FIELD: ERROR_CODES.MISSING_REQUIRED_FIELD,
    INVALID_FORMAT: ERROR_CODES.INVALID_FORMAT
  },
  TICKET_ERRORS: {
    CREATE_ERROR: ERROR_CODES.TICKET_CREATE_ERROR,
    UPDATE_ERROR: ERROR_CODES.TICKET_UPDATE_ERROR,
    NOT_FOUND: ERROR_CODES.TICKET_NOT_FOUND
  },
  CHAT_ERRORS: {
    CLAUDE_UNAVAILABLE: ERROR_CODES.CLAUDE_SERVICE_UNAVAILABLE,
    VECTOR_UNAVAILABLE: ERROR_CODES.VECTOR_SERVICE_UNAVAILABLE
  },
  GENERIC_ERRORS: {
    INTERNAL_ERROR: ERROR_CODES.INTERNAL_ERROR,
    NOT_FOUND: ERROR_CODES.NOT_FOUND
  }
};
