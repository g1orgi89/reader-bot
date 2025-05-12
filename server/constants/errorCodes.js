/**
 * Standard error codes for the Shrooms Support Bot API
 * @file server/constants/errorCodes.js
 */

/**
 * @typedef {Object} ErrorCodeInfo
 * @property {string} code - The error code
 * @property {string} message - Default error message
 * @property {number} httpStatus - Default HTTP status code
 */

/**
 * Authentication and authorization errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const AUTH_ERRORS = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    httpStatus: 401
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Access denied',
    httpStatus: 403
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials provided',
    httpStatus: 401
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Authentication token has expired',
    httpStatus: 401
  },
  INSUFFICIENT_PERMISSIONS: {
    code: 'INSUFFICIENT_PERMISSIONS',
    message: 'Insufficient permissions for this operation',
    httpStatus: 403
  }
};

/**
 * Validation errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const VALIDATION_ERRORS = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    httpStatus: 400
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required field is missing',
    httpStatus: 400
  },
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'Invalid data format',
    httpStatus: 400
  },
  INVALID_VALUE: {
    code: 'INVALID_VALUE',
    message: 'Invalid value provided',
    httpStatus: 400
  },
  VALUE_OUT_OF_RANGE: {
    code: 'VALUE_OUT_OF_RANGE',
    message: 'Value is out of allowed range',
    httpStatus: 400
  }
};

/**
 * Chat-related errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const CHAT_ERRORS = {
  CHAT_ERROR: {
    code: 'CHAT_ERROR',
    message: 'Error processing chat message',
    httpStatus: 500
  },
  CLAUDE_ERROR: {
    code: 'CLAUDE_ERROR',
    message: 'Error communicating with Claude API',
    httpStatus: 502
  },
  VECTOR_SERVICE_UNAVAILABLE: {
    code: 'VECTOR_SERVICE_UNAVAILABLE',
    message: 'Vector search service is unavailable',
    httpStatus: 503
  },
  CONVERSATION_FETCH_ERROR: {
    code: 'CONVERSATION_FETCH_ERROR',
    message: 'Failed to fetch conversation history',
    httpStatus: 500
  },
  MESSAGE_TOO_LONG: {
    code: 'MESSAGE_TOO_LONG',
    message: 'Message exceeds maximum length',
    httpStatus: 400
  }
};

/**
 * Ticket-related errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const TICKET_ERRORS = {
  TICKET_CREATE_ERROR: {
    code: 'TICKET_CREATE_ERROR',
    message: 'Failed to create ticket',
    httpStatus: 500
  },
  TICKET_NOT_FOUND: {
    code: 'TICKET_NOT_FOUND',
    message: 'Ticket not found',
    httpStatus: 404
  },
  TICKET_UPDATE_ERROR: {
    code: 'TICKET_UPDATE_ERROR',
    message: 'Failed to update ticket',
    httpStatus: 500
  },
  INVALID_TICKET_STATUS: {
    code: 'INVALID_TICKET_STATUS',
    message: 'Invalid ticket status',
    httpStatus: 400
  },
  INVALID_TICKET_PRIORITY: {
    code: 'INVALID_TICKET_PRIORITY',
    message: 'Invalid ticket priority',
    httpStatus: 400
  },
  INVALID_TICKET_CATEGORY: {
    code: 'INVALID_TICKET_CATEGORY',
    message: 'Invalid ticket category',
    httpStatus: 400
  }
};

/**
 * Knowledge base errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const KNOWLEDGE_ERRORS = {
  DOCUMENT_ADD_ERROR: {
    code: 'DOCUMENT_ADD_ERROR',
    message: 'Failed to add document to knowledge base',
    httpStatus: 500
  },
  DOCUMENT_NOT_FOUND: {
    code: 'DOCUMENT_NOT_FOUND',
    message: 'Document not found',
    httpStatus: 404
  },
  SEARCH_ERROR: {
    code: 'SEARCH_ERROR',
    message: 'Search operation failed',
    httpStatus: 500
  },
  UPLOAD_ERROR: {
    code: 'UPLOAD_ERROR',
    message: 'File upload failed',
    httpStatus: 500
  },
  DELETE_ERROR: {
    code: 'DELETE_ERROR',
    message: 'Failed to delete document',
    httpStatus: 500
  },
  UNSUPPORTED_FILE_TYPE: {
    code: 'UNSUPPORTED_FILE_TYPE',
    message: 'File type not supported',
    httpStatus: 400
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'File size exceeds limit',
    httpStatus: 413
  }
};

/**
 * Admin and system errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const ADMIN_ERRORS = {
  STATS_ERROR: {
    code: 'STATS_ERROR',
    message: 'Failed to fetch statistics',
    httpStatus: 500
  },
  SYSTEM_INFO_ERROR: {
    code: 'SYSTEM_INFO_ERROR',
    message: 'Failed to fetch system information',
    httpStatus: 500
  },
  CACHE_CLEAR_ERROR: {
    code: 'CACHE_CLEAR_ERROR',
    message: 'Failed to clear cache',
    httpStatus: 500
  },
  BROADCAST_ERROR: {
    code: 'BROADCAST_ERROR',
    message: 'Failed to send broadcast message',
    httpStatus: 500
  },
  FARMING_YIELD_ERROR: {
    code: 'FARMING_YIELD_ERROR',
    message: 'Error managing farming yield',
    httpStatus: 500
  }
};

/**
 * Generic/Other errors
 * @readonly
 * @enum {ErrorCodeInfo}
 */
const GENERIC_ERRORS = {
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    httpStatus: 500
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    httpStatus: 500
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable',
    httpStatus: 503
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    httpStatus: 429
  },
  REQUEST_TIMEOUT: {
    code: 'REQUEST_TIMEOUT',
    message: 'Request timed out',
    httpStatus: 408
  }
};

/**
 * All error codes combined for easy access
 * @readonly
 * @type {Object.<string, ErrorCodeInfo>}
 */
const ALL_ERROR_CODES = {
  ...AUTH_ERRORS,
  ...VALIDATION_ERRORS,
  ...CHAT_ERRORS,
  ...TICKET_ERRORS,
  ...KNOWLEDGE_ERRORS,
  ...ADMIN_ERRORS,
  ...GENERIC_ERRORS
};

/**
 * Helper function to get error code information
 * @param {string} code - Error code to look up
 * @returns {ErrorCodeInfo|null} Error code information or null if not found
 */
function getErrorInfo(code) {
  return ALL_ERROR_CODES[code] || null;
}

/**
 * Helper function to create standardized error response
 * @param {string} code - Error code
 * @param {string} [customMessage] - Custom error message (overrides default)
 * @param {Object} [details] - Additional error details
 * @returns {Object} Standardized error response
 */
function createErrorResponse(code, customMessage = null, details = null) {
  const errorInfo = getErrorInfo(code);
  
  if (!errorInfo) {
    // Fallback for unknown error codes
    return {
      error: customMessage || 'Unknown error occurred',
      errorCode: code,
      httpStatus: 500,
      timestamp: new Date().toISOString(),
      details
    };
  }
  
  return {
    error: customMessage || errorInfo.message,
    errorCode: errorInfo.code,
    httpStatus: errorInfo.httpStatus,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };
}

module.exports = {
  // Error categories
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  CHAT_ERRORS,
  TICKET_ERRORS,
  KNOWLEDGE_ERRORS,
  ADMIN_ERRORS,
  GENERIC_ERRORS,
  
  // Combined errors
  ALL_ERROR_CODES,
  
  // Helper functions
  getErrorInfo,
  createErrorResponse
};
