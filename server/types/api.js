/**
 * API Types for Shrooms Support Bot
 * @file server/types/api.js
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Success status
 * @property {any} [data] - Response data
 * @property {string} [error] - Error message
 * @property {string} [errorCode] - Error code
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1] - Page number
 * @property {number} [limit=20] - Items per page
 * @property {string} [sort] - Sort field
 * @property {string} [order='desc'] - Sort order (asc/desc)
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {Array} items - Array of items
 * @property {number} total - Total count
 * @property {number} page - Current page
 * @property {number} pages - Total pages
 * @property {boolean} hasMore - Whether there are more items
 */

/**
 * @typedef {Object} ChatMessageRequest
 * @property {string} message - Message content
 * @property {string} userId - User ID
 * @property {string} [conversationId] - Conversation ID
 * @property {string} [language] - Language code
 */

/**
 * @typedef {Object} ChatMessageResponse
 * @property {string} response - AI response
 * @property {string} conversationId - Conversation ID
 * @property {boolean} ticketCreated - Whether ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 */

/**
 * @typedef {Object} TicketRequest
 * @property {string} subject - Ticket subject
 * @property {string} message - Initial message
 * @property {string} userId - User ID
 * @property {string} conversationId - Conversation ID
 * @property {string} [email] - User email
 * @property {string} [category] - Ticket category
 * @property {string} [priority] - Ticket priority
 * @property {string} [language] - Language code
 */

/**
 * @typedef {Object} KnowledgeDocumentRequest
 * @property {string} title - Document title
 * @property {string} content - Document content
 * @property {string} category - Document category
 * @property {string[]} tags - Document tags
 * @property {string} language - Document language
 */

/**
 * @typedef {Object} SearchRequest
 * @property {string} query - Search query
 * @property {string[]} [categories] - Categories to search in
 * @property {string[]} [languages] - Languages to search in
 * @property {number} [limit] - Maximum results
 */

/**
 * @typedef {Object} TicketStatusUpdate
 * @property {string} status - New status
 * @property {string} [assignedTo] - Assigned user
 * @property {string} [resolution] - Resolution text
 */

/**
 * @typedef {Object} AdminConfig
 * @property {string} dohodnost - Current farming yield
 * @property {string} lastUpdated - Last update timestamp
 * @property {string} updatedBy - Who updated
 */

/**
 * @typedef {Object} SystemStats
 * @property {Object} tickets - Ticket statistics
 * @property {Object} conversations - Conversation statistics
 * @property {Object} knowledge - Knowledge base statistics
 * @property {Object} messages - Message statistics
 */

/**
 * Creates a standard API success response
 * @param {any} data - Response data
 * @param {string} [message] - Success message
 * @returns {ApiResponse} Formatted success response
 */
function createSuccessResponse(data, message = 'Success') {
  return {
    success: true,
    data,
    message
  };
}

/**
 * Creates a standard API error response
 * @param {string} error - Error message
 * @param {string} [errorCode] - Error code
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {ApiResponse} Formatted error response
 */
function createErrorResponse(error, errorCode = 'INTERNAL_ERROR', statusCode = 500) {
  return {
    success: false,
    error,
    errorCode,
    statusCode
  };
}

/**
 * Creates a paginated response
 * @param {Array} items - Array of items
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {PaginatedResponse} Paginated response
 */
function createPaginatedResponse(items, total, page, limit) {
  const pages = Math.ceil(total / limit);
  const hasMore = page < pages;
  
  return {
    items,
    total,
    page,
    pages,
    hasMore,
    limit
  };
}

/**
 * Validates required fields in request body
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object|null} Validation error or null if valid
 */
function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    return createErrorResponse(
      `Missing required fields: ${missing.join(', ')}`,
      'MISSING_FIELDS',
      400
    );
  }
  
  return null;
}

/**
 * Validates pagination parameters
 * @param {Object} query - Query parameters
 * @returns {PaginationOptions} Validated pagination options
 */
function validatePaginationOptions(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const sort = query.sort || 'createdAt';
  const order = query.order === 'asc' ? 'asc' : 'desc';
  
  return { page, limit, sort, order };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  validateRequiredFields,
  validatePaginationOptions
};