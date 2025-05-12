/**
 * Shared type definitions for Shrooms Support Bot
 * @file server/types/index.js
 */

/**
 * @typedef {Object} Message
 * @property {string} role - Role of the message sender ('user' | 'assistant' | 'system')
 * @property {string} text - Content of the message
 * @property {number} [timestamp] - Message timestamp
 * @property {string} [messageId] - Unique message identifier
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {string} text - Message text
 * @property {string} role - Message role ('user' | 'assistant' | 'system')
 * @property {string} userId - User identifier
 * @property {string} conversationId - Conversation identifier
 * @property {MessageMetadata} [metadata] - Message metadata
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} MessageMetadata
 * @property {string} [language] - Message language (en, es, ru)
 * @property {number} [tokensUsed] - Number of tokens used
 * @property {string} [sentiment] - Message sentiment
 * @property {boolean} [createdTicket] - Whether a ticket was created
 * @property {string} [ticketId] - Ticket ID if created
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id - Conversation identifier
 * @property {string} userId - User identifier
 * @property {Message[]} messages - Array of messages
 * @property {string} language - Conversation language
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Ticket
 * @property {string} ticketId - Unique ticket identifier
 * @property {string} userId - User identifier
 * @property {string} conversationId - Associated conversation ID
 * @property {string} status - Ticket status ('open' | 'in_progress' | 'resolved' | 'closed')
 * @property {string} priority - Ticket priority ('low' | 'medium' | 'high' | 'urgent')
 * @property {string} category - Ticket category ('technical' | 'account' | 'billing' | 'feature' | 'other')
 * @property {string} subject - Ticket subject
 * @property {string} initialMessage - Initial message that triggered ticket creation
 * @property {string} [context] - Context from conversation
 * @property {string} [email] - User email
 * @property {string} [assignedTo] - Assigned support agent
 * @property {string} [resolution] - Ticket resolution
 * @property {string} language - Ticket language
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [resolvedAt] - Resolution timestamp
 */

/**
 * @typedef {Object} ClaudeGenerateOptions
 * @property {string[]} [context] - Context from knowledge base
 * @property {Message[]} [history] - Conversation history
 * @property {string} [language] - Language for response (en, es, ru)
 * @property {number} [maxTokens] - Maximum tokens for response
 * @property {number} [temperature] - Temperature for response generation
 */

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Generated response message
 * @property {boolean} needsTicket - Whether a ticket should be created
 * @property {number} tokensUsed - Number of tokens used
 * @property {string} [ticketReason] - Reason for ticket creation
 * @property {string} [language] - Response language
 * @property {TokenUsage} [usage] - Token usage details
 */

/**
 * @typedef {Object} VectorDocument
 * @property {string} id - Document identifier
 * @property {string} content - Document content
 * @property {VectorDocumentMetadata} metadata - Document metadata
 */

/**
 * @typedef {Object} VectorDocumentMetadata
 * @property {string} source - Document source
 * @property {string} language - Document language
 * @property {string} category - Document category
 * @property {string[]} tags - Document tags
 * @property {string} [title] - Document title
 * @property {Date} [createdAt] - Creation timestamp
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit] - Maximum number of results
 * @property {string} [language] - Filter by language
 * @property {string} [category] - Filter by category
 * @property {string[]} [tags] - Filter by tags
 * @property {number} [threshold] - Minimum similarity threshold
 */

/**
 * @typedef {Object} SearchResult
 * @property {VectorDocument} document - Found document
 * @property {number} score - Similarity score
 * @property {string} snippet - Text snippet
 */

/**
 * @typedef {Object} VectorStoreOptions
 * @property {string} url - Vector database URL
 * @property {string} collectionName - Collection name
 * @property {number} [dimensions] - Vector dimensions
 * @property {string} [metric] - Distance metric
 * @property {EmbeddingProvider} embeddingProvider - Embedding provider config
 */

/**
 * @typedef {Object} EmbeddingProvider
 * @property {string} provider - Provider name (voyage, openai)
 * @property {string} apiKey - API key
 * @property {string} [model] - Model name
 */

/**
 * @typedef {Object} VectorStoreInit
 * @property {boolean} success - Whether initialization succeeded
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} BulkOperationResult
 * @property {number} processed - Number of documents processed
 * @property {number} succeeded - Number of successful operations
 * @property {number} failed - Number of failed operations
 * @property {Array<{documentId: string, error: string}>} errors - List of errors
 */

/**
 * @typedef {Object} VectorStoreStats
 * @property {number} totalDocuments - Total number of documents
 * @property {number} totalVectors - Total number of vectors
 * @property {Object} languageDistribution - Distribution by language
 * @property {Object} categoryDistribution - Distribution by category
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {string} content - Document content
 * @property {number} score - Relevance score
 * @property {VectorSearchMetadata} metadata - Document metadata
 */

/**
 * @typedef {Object} VectorSearchMetadata
 * @property {string} source - Document source
 * @property {string} language - Document language
 * @property {string} category - Document category
 * @property {string[]} tags - Document tags
 */

/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} title - Document title
 * @property {string} content - Document content
 * @property {string} category - Document category
 * @property {string[]} tags - Document tags
 * @property {string} language - Document language
 * @property {string} vectorId - Vector database ID
 * @property {string} [authorId] - Author identifier
 * @property {string} status - Document status ('draft' | 'published' | 'archived')
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} WebhookEvent
 * @property {string} eventType - Type of webhook event
 * @property {Object} data - Event data
 * @property {Date} timestamp - Event timestamp
 * @property {string} source - Event source
 */

/**
 * @typedef {Object} UserSession
 * @property {string} userId - User identifier
 * @property {string} conversationId - Current conversation ID
 * @property {string} language - User language preference
 * @property {Date} lastActivity - Last activity timestamp
 * @property {Object} preferences - User preferences
 */

/**
 * @typedef {Object} AdminConfig
 * @property {number} farmingYield - Current farming yield percentage
 * @property {string} lastUpdatedBy - Last updated by admin ID
 * @property {Date} lastUpdated - Last update timestamp
 */

/**
 * @typedef {Object} SystemPrompts
 * @property {string} basic - Basic system prompt
 * @property {string} rag - RAG (Retrieval Augmented Generation) prompt
 * @property {string} ticketCreation - Ticket creation detection prompt
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {string} messageId - Telegram message ID
 * @property {TelegramUser} from - Sender information
 * @property {string} text - Message text
 * @property {Date} date - Message date
 * @property {TelegramChat} chat - Chat information
 */

/**
 * @typedef {Object} TelegramUser
 * @property {string} id - Telegram user ID
 * @property {string} firstName - User first name
 * @property {string} [lastName] - User last name
 * @property {string} [username] - User username
 * @property {string} languageCode - User language code
 */

/**
 * @typedef {Object} TelegramChat
 * @property {string} id - Chat ID
 * @property {string} type - Chat type
 * @property {string} [title] - Chat title
 */

/**
 * @typedef {Object} Widget
 * @property {string} containerId - Widget container ID
 * @property {Object} styles - Widget styles
 * @property {string} apiUrl - API server URL
 * @property {string} language - Widget language
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} inputTokens - Input tokens used
 * @property {number} outputTokens - Output tokens used
 * @property {number} totalTokens - Total tokens used
 */

/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} eventName - Event name
 * @property {Object} properties - Event properties
 * @property {string} userId - User identifier
 * @property {Date} timestamp - Event timestamp
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false for errors
 * @property {string} error - Error message
 * @property {string} errorCode - Error code
 * @property {number} timestamp - Error timestamp
 */

/**
 * @typedef {Object} SuccessResponse
 * @property {boolean} success - Always true for success
 * @property {*} data - Response data
 * @property {number} timestamp - Response timestamp
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {*[]} items - Array of items
 * @property {number} totalCount - Total number of items
 * @property {number} page - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} limit - Items per page
 */

// For backward compatibility - alias types
/**
 * @typedef {Message} MessageType
 */

/**
 * @typedef {Ticket} TicketType
 */

/**
 * @typedef {Conversation} ConversationType
 */

/**
 * @typedef {KnowledgeDocument} KnowledgeDocumentType
 */

// Export all types for use in other modules
module.exports = {
  // These are just JSDoc typedefs, no actual exports needed
  // All types are available through @typedef declarations
};
