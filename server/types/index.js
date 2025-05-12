/**
 * Shared types for the Shrooms Support Bot
 * @file server/types/index.js
 */

/**
 * @typedef {('en'|'es'|'ru')} Language
 */

/**
 * @typedef {('user'|'assistant'|'system')} MessageRole
 */

/**
 * @typedef {('open'|'in_progress'|'resolved'|'closed')} TicketStatus
 */

/**
 * @typedef {('low'|'medium'|'high'|'urgent')} TicketPriority
 */

/**
 * @typedef {('technical'|'account'|'billing'|'feature'|'other')} TicketCategory
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id - Unique message identifier
 * @property {string} conversationId - Conversation identifier
 * @property {string} userId - User identifier
 * @property {MessageRole} role - Message role
 * @property {string} content - Message content
 * @property {Language} language - Message language
 * @property {Date} createdAt - Creation timestamp
 * @property {number} [tokensUsed] - Tokens used for this message
 * @property {boolean} [ticketCreated] - Whether a ticket was created
 * @property {string} [ticketId] - Associated ticket ID if created
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message - User message content
 * @property {string} userId - User identifier
 * @property {string} [conversationId] - Conversation identifier (optional for new conversations)
 * @property {Language} [language] - Message language (auto-detected if not provided)
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} message - AI response content
 * @property {string} conversationId - Conversation identifier
 * @property {string} messageId - Response message ID
 * @property {boolean} needsTicket - Whether a ticket should be created
 * @property {string} [ticketId] - Created ticket ID if applicable
 * @property {number} tokensUsed - Tokens used for response generation
 * @property {Language} language - Response language
 * @property {Date} timestamp - Response timestamp
 */

/**
 * @typedef {Object} ChatError
 * @property {boolean} success - Always false for errors
 * @property {string} error - Error message
 * @property {string} errorCode - Error code for frontend handling
 * @property {Object} [details] - Additional error details
 */

/**
 * @typedef {Object} TicketData
 * @property {string} ticketId - Unique ticket identifier
 * @property {string} userId - User identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {TicketStatus} status - Ticket status
 * @property {TicketPriority} priority - Ticket priority
 * @property {TicketCategory} category - Ticket category
 * @property {string} subject - Ticket subject/title
 * @property {string} initialMessage - Initial message content
 * @property {string} [context] - Additional context
 * @property {string} [email] - User email if provided
 * @property {string} [assignedTo] - Assigned team member
 * @property {string} [resolution] - Resolution details
 * @property {Language} language - Ticket language
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [resolvedAt] - Resolution timestamp
 */

/**
 * @typedef {Object} ClaudeIntegration
 * @property {Object[]} context - Knowledge base context
 * @property {string} systemPrompt - System prompt for Claude
 * @property {number} maxTokens - Maximum tokens for response
 * @property {number} temperature - Claude temperature setting
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} content - Relevant content from knowledge base
 * @property {number} score - Relevance score
 * @property {Object} metadata - Document metadata
 */

module.exports = {};
