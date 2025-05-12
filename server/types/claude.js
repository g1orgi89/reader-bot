/**
 * Claude Service Type Definitions
 * @file server/types/claude.js
 */

/**
 * Message type alias - using ChatMessage from api.js
 * @typedef {import('./api').ChatMessage} Message
 */

/**
 * Token usage statistics
 * @typedef {Object} TokenUsage
 * @property {number} inputTokens - Input tokens used
 * @property {number} outputTokens - Output tokens used
 * @property {number} totalTokens - Total tokens used
 */

/**
 * Options for generating Claude response
 * @typedef {Object} ClaudeGenerateOptions
 * @property {string[]} [context] - RAG context from knowledge base
 * @property {Message[]} [history] - Conversation history
 * @property {string} [language='en'] - Language code (en, es, ru)
 * @property {number} [maxTokens] - Maximum tokens for response
 * @property {number} [temperature] - Temperature for response generation
 */

/**
 * Claude service response object
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Generated message text
 * @property {boolean} needsTicket - Whether a support ticket should be created
 * @property {number} tokensUsed - Number of tokens used in generation
 * @property {string} [ticketReason] - Reason for ticket creation (if needsTicket is true)
 * @property {string} language - Detected or specified language
 * @property {TokenUsage} [usage] - Detailed token usage statistics
 */

/**
 * Language type
 * @typedef {'en'|'es'|'ru'} Language
 */

// Export types (for JSDoc the export doesn't actually export the types, just documents them)
module.exports = {
  // These objects are empty because JSDoc types are defined above
  ClaudeGenerateOptions: {},
  ClaudeResponse: {},
  TokenUsage: {},
  Language: {},
  Message: {} // Re-export for convenience
};