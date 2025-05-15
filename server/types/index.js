/**
 * Shared types for Shrooms Support Bot
 * @file server/types/index.js
 */

/**
 * Knowledge Document type definition
 * @typedef {Object} KnowledgeDocument
 * @property {string} _id - Unique document ID
 * @property {string} title - Document title
 * @property {string} content - Document content
 * @property {string} category - Document category
 * @property {string} language - Document language (en/es/ru)
 * @property {string[]} [tags] - Optional tags array
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {string} [authorId] - Author ID
 * @property {string} status - Document status (draft/published/archived)
 */

/**
 * Chat Message type definition
 * @typedef {Object} ChatMessage
 * @property {string} _id - Unique message ID
 * @property {string} text - Message text
 * @property {string} role - Message role (user/assistant/system)
 * @property {string} userId - User ID
 * @property {string} conversationId - Conversation ID
 * @property {MessageMetadata} [metadata] - Additional metadata
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * Message Metadata type definition
 * @typedef {Object} MessageMetadata
 * @property {string} [language] - Message language
 * @property {number} [tokensUsed] - Tokens used for this message
 * @property {string} [sentiment] - Message sentiment
 * @property {boolean} [createdTicket] - Whether ticket was created
 * @property {string} [ticketId] - Created ticket ID
 */

/**
 * API Response type definition
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Operation success status
 * @property {*} [data] - Response data
 * @property {string} [error] - Error message
 * @property {string} [errorCode] - Error code
 */

/**
 * Knowledge Search Query type definition
 * @typedef {Object} KnowledgeSearchQuery
 * @property {string} [q] - Search query text
 * @property {string} [category] - Filter by category
 * @property {string} [language] - Filter by language
 * @property {string[]} [tags] - Filter by tags
 * @property {number} [limit] - Limit results
 * @property {number} [page] - Page number
 */

module.exports = {
  // Re-export all types for other modules
};