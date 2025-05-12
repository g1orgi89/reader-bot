/**
 * Shared types for Shrooms Support Bot
 * @file server/types/index.js
 */

// Re-export API types
const apiTypes = require('./api');

/**
 * @typedef {Object} BaseModel
 * @property {string} _id - MongoDB ObjectId
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} MessageType
 * @property {string} text - Message content
 * @property {'user'|'assistant'|'system'} role - Message role
 * @property {string} userId - User identifier
 * @property {string} conversationId - Conversation identifier (ObjectId as string)
 * @property {MessageMetadata} [metadata] - Additional message data
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} MessageMetadata
 * @property {string} [language] - Message language (en, es, ru)
 * @property {number} [tokensUsed] - Tokens consumed by Claude API
 * @property {string} [sentiment] - Message sentiment analysis
 * @property {boolean} [createdTicket] - Whether ticket was created
 * @property {string} [ticketId] - Associated ticket ID
 */

/**
 * @typedef {Object} ConversationType
 * @property {string} userId - User identifier
 * @property {Array<string>} messageIds - Array of message ObjectIds
 * @property {'active'|'closed'|'archived'} status - Conversation status
 * @property {string} [language] - Conversation language (en, es, ru)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [lastActivityAt] - Last activity timestamp
 */

/**
 * @typedef {Object} TicketType
 * @property {string} ticketId - Unique ticket identifier
 * @property {string} userId - User identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {'open'|'in_progress'|'resolved'|'closed'} status - Ticket status
 * @property {'low'|'medium'|'high'|'urgent'} priority - Ticket priority
 * @property {'technical'|'account'|'billing'|'feature'|'other'} category - Ticket category
 * @property {string} subject - Ticket subject
 * @property {string} initialMessage - Initial user message
 * @property {string} [context] - Additional context
 * @property {string} [email] - User email
 * @property {string} [assignedTo] - Assigned support agent
 * @property {string} [resolution] - Ticket resolution
 * @property {'en'|'es'|'ru'} language - Ticket language
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [resolvedAt] - Resolution timestamp
 */

/**
 * @typedef {Object} KnowledgeDocumentType
 * @property {string} title - Document title
 * @property {string} content - Document content
 * @property {string} category - Document category
 * @property {Array<string>} tags - Document tags
 * @property {'en'|'es'|'ru'} language - Document language
 * @property {string} vectorId - Vector store ID
 * @property {string} [authorId] - Document author
 * @property {'draft'|'published'|'archived'} status - Document status
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

// Type Guards for runtime validation
/**
 * Checks if an object is a valid Message
 * @param {any} obj - Object to check
 * @returns {obj is MessageType} Type guard
 */
function isMessage(obj) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.text === 'string' &&
    ['user', 'assistant', 'system'].includes(obj.role) &&
    typeof obj.userId === 'string' &&
    typeof obj.conversationId === 'string'
  );
}

/**
 * Checks if an object is a valid Ticket
 * @param {any} obj - Object to check
 * @returns {obj is TicketType} Type guard
 */
function isTicket(obj) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.ticketId === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.conversationId === 'string' &&
    ['open', 'in_progress', 'resolved', 'closed'].includes(obj.status) &&
    ['low', 'medium', 'high', 'urgent'].includes(obj.priority) &&
    ['technical', 'account', 'billing', 'feature', 'other'].includes(obj.category)
  );
}

/**
 * Checks if an object is a valid Conversation
 * @param {any} obj - Object to check
 * @returns {obj is ConversationType} Type guard
 */
function isConversation(obj) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.userId === 'string' &&
    Array.isArray(obj.messageIds) &&
    ['active', 'closed', 'archived'].includes(obj.status)
  );
}

/**
 * Checks if an object is a valid KnowledgeDocument
 * @param {any} obj - Object to check
 * @returns {obj is KnowledgeDocumentType} Type guard
 */
function isKnowledgeDocument(obj) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.category === 'string' &&
    Array.isArray(obj.tags) &&
    ['en', 'es', 'ru'].includes(obj.language)
  );
}

module.exports = {
  // Type guards
  isMessage,
  isTicket,
  isConversation,
  isKnowledgeDocument,
  
  // API utilities
  ...apiTypes
};