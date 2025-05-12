/**
 * Shared types for Shrooms Support Bot
 * @file server/types/index.js
 */

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
 * @property {'active'|'closed'