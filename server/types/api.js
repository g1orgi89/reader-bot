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
 * @property {string} [message] - Success message
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
 * @property {number} limit - Items per page
 */

/**
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id - Message ID
 * @property {string} text - Message content (ВАЖНО: text, не content!)
 * @property {MessageRole} role - Message role
 * @property {string} userId - User ID
 * @property {string} conversationId - Conversation ID
 * @property {string} language - Language code
 * @property {Date} createdAt - Creation timestamp
 * @property {number} [tokensUsed] - Tokens used
 * @property {boolean} [ticketCreated] - Whether ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message - Message content
 * @property {string} userId - User ID
 * @property {string} [conversationId] - Conversation ID
 * @property {string} [language] - Language code (en/es/ru)
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - AI response
 * @property {string} conversationId - Conversation ID
 * @property {string} messageId - Message ID
 * @property {boolean} needsTicket - Whether ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 * @property {number} tokensUsed - Tokens used
 * @property {string} language - Response language
 * @property {Date} timestamp - Response timestamp
 */

/**
 * @typedef {Object} ChatError
 * @property {boolean} success - Always false
 * @property {string} error - Error message
 * @property {string} errorCode - Error code
 * @property {Object} [details] - Error details
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
 * @typedef {Object} TicketQueryParams
 * @property {number} [page=1] - Page number
 * @property {number} [limit=20] - Items per page
 * @property {import('./ticket').TicketStatus} [status] - Filter by status
 * @property {import('./ticket').TicketPriority} [priority] - Filter by priority
 * @property {import('./ticket').TicketCategory} [category] - Filter by category
 * @property {string} [assignedTo] - Filter by assigned agent
 * @property {string} [userId] - Filter by user ID
 * @property {string} [search] - Search query
 * @property {string} [sort] - Sort field
 * @property {string} [order] - Sort order (asc/desc)
 */

/**
 * @typedef {Object} TicketSearchParams
 * @property {string} q - Search query
 * @property {number} [limit=20] - Maximum results
 * @property {import('./ticket').TicketStatus} [status] - Filter by status
 */

/**
 * @typedef {Object} AssignedTicketsParams
 * @property {string} agentId - Agent ID
 * @property {import('./ticket').TicketStatus} [status='in_progress'] - Filter by status
 * @property {number} [limit=50] - Maximum results
 */

/**
 * @typedef {Object} TicketStatsResponse
 * @property {number} total - Total tickets
 * @property {Object<string, number>} byStatus - Count by status
 * @property {Object<string, number>} byPriority - Count by priority
 * @property {Object<string, number>} byCategory - Count by category
 * @property {number} averageResolutionTime - Average resolution time in minutes
 * @property {number} openTickets - Number of open tickets
 * @property {number} resolvedToday - Number of tickets resolved today
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

/**
 * Validates ticket query parameters
 * @param {Object} query - Query parameters
 * @returns {{pagination: PaginationOptions, filter: import('./ticket').TicketFilter, search?: Object}} Validated parameters
 */
function validateTicketQueryParams(query) {
  const pagination = validatePaginationOptions(query);
  
  // Build filter object
  const filter = {};
  
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.userId) filter.userId = query.userId;
  
  // Build search object if search query exists
  let search;
  if (query.search) {
    search = {
      $or: [
        { subject: { $regex: query.search, $options: 'i' } },
        { initialMessage: { $regex: query.search, $options: 'i' } },
        { ticketId: { $regex: query.search, $options: 'i' } }
      ]
    };
  }
  
  return { pagination, filter, search };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  validateRequiredFields,
  validatePaginationOptions,
  validateTicketQueryParams
};