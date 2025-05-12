/**
 * Shared types for Shrooms Support Bot
 * @fileoverview Defines all shared TypeScript-like types for the entire project
 */

/**
 * Common database document with MongoDB ObjectId
 * @typedef {Object} BaseDocument
 * @property {string} _id - MongoDB ObjectId as string
 * @property {Date} createdAt - Document creation date
 * @property {Date} updatedAt - Document update date
 */

/**
 * User representation in the system
 * @typedef {Object} User
 * @property {string} id - User ID (wallet address or Telegram ID)
 * @property {string} userId - Normalized user ID
 * @property {'wallet'|'telegram'} platform - Platform where user connected from
 * @property {Date} firstSeen - When user first connected
 * @property {Date} lastSeen - Last interaction timestamp
 * @property {string} [walletAddress] - Stacks wallet address if connected via wallet
 * @property {number} [telegramId] - Telegram user ID if connected via Telegram
 * @property {string} [username] - Telegram username if available
 * @property {string} [displayName] - BNS name or Telegram display name
 * @property {string} [preferredLanguage] - User's preferred language (en/es/ru)
 */

/**
 * Message in conversation
 * @typedef {Object} Message
 * @property {string} id - Unique message ID
 * @property {string} conversationId - ID of conversation this message belongs to
 * @property {string} userId - ID of user who sent the message
 * @property {'user'|'assistant'|'system'} role - Role of message sender
 * @property {string} text - Message content
 * @property {MessageMetadata} [metadata] - Additional message metadata
 * @property {Date} createdAt - When message was created
 */

/**
 * Metadata for messages
 * @typedef {Object} MessageMetadata
 * @property {string} [language] - Language of the message
 * @property {number} [tokensUsed] - Tokens consumed by AI for this message
 * @property {string} [sentiment] - Detected sentiment (positive/negative/neutral)
 * @property {boolean} [createdTicket] - Whether this message created a support ticket
 * @property {string} [ticketId] - ID of created ticket if applicable
 */

/**
 * Conversation between user and AI assistant
 * @typedef {Object} Conversation
 * @property {string} id - Unique conversation ID
 * @property {string} userId - ID of user in conversation
 * @property {'active'|'closed'|'archived'} status - Current conversation status
 * @property {string} [subject] - Conversation subject/topic
 * @property {number} messageCount - Number of messages in conversation
 * @property {Date} lastActivity - Last message timestamp
 * @property {ConversationMetadata} [metadata] - Additional conversation metadata
 * @property {Date} createdAt - When conversation started
 * @property {Date} [closedAt] - When conversation was closed
 */

/**
 * Metadata for conversations
 * @typedef {Object} ConversationMetadata
 * @property {string} [initialQuery] - First user question that started conversation
 * @property {string[]} [categories] - Detected categories/topics discussed
 * @property {boolean} [escalatedToHuman] - Whether conversation needed human intervention
 * @property {number} [satisfactionScore] - User satisfaction rating (1-5)
 */

/**
 * Support ticket for issues requiring human intervention
 * @typedef {Object} Ticket
 * @property {string} ticketId - Unique ticket ID (human-readable)
 * @property {string} userId - ID of user who created ticket
 * @property {string} conversationId - ID of conversation that spawned ticket
 * @property {'open'|'in_progress'|'resolved'|'closed'} status - Current ticket status
 * @property {'low'|'medium'|'high'|'urgent'} priority - Ticket priority level
 * @property {'technical'|'account'|'billing'|'feature'|'other'} category - Issue category
 * @property {string} subject - Brief description of the issue
 * @property {string} initialMessage - Original message that triggered ticket
 * @property {string} [context] - Additional context from conversation
 * @property {string} [email] - Contact email if provided
 * @property {string} [assignedTo] - Staff member assigned to ticket
 * @property {string} [resolution] - How the ticket was resolved
 * @property {string} language - Language of the ticket content
 * @property {Date} createdAt - When ticket was created
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [resolvedAt] - When ticket was resolved
 */

/**
 * Knowledge base document
 * @typedef {Object} KnowledgeDocument
 * @property {string} id - Unique document ID
 * @property {string} title - Document title
 * @property {string} content - Document content/body
 * @property {string} category - Document category
 * @property {string[]} tags - Associated tags
 * @property {string} language - Document language (en/es/ru)
 * @property {string} vectorId - ID in vector database
 * @property {string} [authorId] - ID of document author
 * @property {'draft'|'published'|'archived'} status - Document status
 * @property {Date} createdAt - When document was created
 * @property {Date} updatedAt - Last modification date
 */

/**
 * Claude API request options
 * @typedef {Object} ClaudeRequestOptions
 * @property {string[]} [context] - Relevant knowledge base context
 * @property {Message[]} [history] - Conversation history for context
 * @property {string} [language] - Language for response (en/es/ru)
 * @property {number} [maxTokens] - Maximum tokens for response
 * @property {number} [temperature] - Temperature for response generation
 */

/**
 * Claude API response
 * @typedef {Object} ClaudeResponse
 * @property {string} message - AI generated response
 * @property {boolean} needsTicket - Whether a support ticket should be created
 * @property {number} tokensUsed - Tokens consumed by this request
 * @property {string} [detectedIntent] - Detected user intent/category
 * @property {string[]} [suggestedActions] - Suggested follow-up actions
 */

/**
 * Vector store search options
 * @typedef {Object} SearchOptions
 * @property {number} [limit] - Maximum number of results to return
 * @property {string} [language] - Language filter for search
 * @property {number} [threshold] - Similarity threshold for results
 * @property {string[]} [categories] - Categories to filter by
 */

/**
 * Vector store search result
 * @typedef {Object} SearchResult
 * @property {KnowledgeDocument} document - The matched document
 * @property {number} score - Similarity score (0-1)
 * @property {string} snippet - Relevant text snippet from document
 */

/**
 * Telegram webhook update
 * @typedef {Object} TelegramUpdate
 * @property {number} update_id - Unique update ID
 * @property {TelegramMessage} [message] - New incoming message
 * @property {TelegramMessage} [edited_message] - Edited message
 * @property {TelegramInlineQuery} [inline_query] - Inline query
 * @property {TelegramCallbackQuery} [callback_query] - Callback query from button
 */

/**
 * Telegram message
 * @typedef {Object} TelegramMessage
 * @property {number} message_id - Unique message ID
 * @property {TelegramUser} from - Sender information
 * @property {number} date - Message timestamp
 * @property {TelegramChat} chat - Chat information
 * @property {string} [text] - Message text
 * @property {TelegramEntity[]} [entities] - Special entities in message
 */

/**
 * Telegram user
 * @typedef {Object} TelegramUser
 * @property {number} id - Unique user ID
 * @property {boolean} is_bot - Whether user is a bot
 * @property {string} first_name - User's first name
 * @property {string} [last_name] - User's last name
 * @property {string} [username] - User's username
 * @property {string} [language_code] - User's language code
 */

/**
 * Telegram chat
 * @typedef {Object} TelegramChat
 * @property {number} id - Unique chat ID
 * @property {'private'|'group'|'supergroup'|'channel'} type - Chat type
 * @property {string} [title] - Chat title for groups
 * @property {string} [username] - Chat username
 */

/**
 * API response wrapper
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether request was successful
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 * @property {string} [errorCode] - Error code for programmatic handling
 * @property {any} [details] - Additional error details
 */

/**
 * Pagination metadata
 * @typedef {Object} PaginationMeta
 * @property {number} page - Current page number
 * @property {number} limit - Items per page
 * @property {number} totalCount - Total number of items
 * @property {number} totalPages - Total number of pages
 * @property {boolean} hasNextPage - Whether there are more pages
 * @property {boolean} hasPrevPage - Whether there are previous pages
 */

/**
 * Paginated response
 * @typedef {Object} PaginatedResponse
 * @property {any[]} items - Array of items for current page
 * @property {PaginationMeta} pagination - Pagination metadata
 */

module.exports = {
  // This file exports types via JSDoc comments
  // Types are used throughout the project for documentation and IDE support
};
