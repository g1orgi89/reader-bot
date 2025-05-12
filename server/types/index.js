/**
 * Shared types for Shrooms Support Bot
 * @fileoverview Defines all shared TypeScript-like types for the entire project
 * Inspired by anthropic-cookbook patterns and best practices
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
 * Message in conversation with enhanced metadata
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
 * Enhanced metadata for messages following anthropic-cookbook patterns
 * @typedef {Object} MessageMetadata
 * @property {string} [language] - Language of the message
 * @property {number} [tokensUsed] - Tokens consumed by AI for this message
 * @property {string} [sentiment] - Detected sentiment (positive/negative/neutral)
 * @property {boolean} [createdTicket] - Whether this message created a support ticket
 * @property {string} [ticketId] - ID of created ticket if applicable
 * @property {number} [retrievalScore] - RAG retrieval confidence score
 * @property {string[]} [retrievedDocs] - IDs of documents used for context
 * @property {string} [intent] - Detected user intent/category
 * @property {boolean} [requiresReranking] - Whether documents needed reranking
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
 * Enhanced metadata for conversations following anthropic-cookbook patterns
 * @typedef {Object} ConversationMetadata
 * @property {string} [initialQuery] - First user question that started conversation
 * @property {string[]} [categories] - Detected categories/topics discussed
 * @property {boolean} [escalatedToHuman] - Whether conversation needed human intervention
 * @property {number} [satisfactionScore] - User satisfaction rating (1-5)
 * @property {string[]} [topRetrievedDocs] - Most relevant documents used
 * @property {number} [avgRetrievalScore] - Average retrieval confidence
 * @property {boolean} [usedReranking] - Whether reranking was used
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
 * Knowledge base document with enhanced structure
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
 * @property {DocumentMetadata} [metadata] - Additional document metadata
 * @property {Date} createdAt - When document was created
 * @property {Date} updatedAt - Last modification date
 */

/**
 * Enhanced document metadata following anthropic-cookbook patterns
 * @typedef {Object} DocumentMetadata
 * @property {string} [summary] - Document summary for retrieval
 * @property {string} [heading] - Document section heading
 * @property {number} [chunkIndex] - Index of document chunk
 * @property {number} [totalChunks] - Total number of chunks for this document
 * @property {string[]} [keywords] - Extracted keywords for better retrieval
 * @property {number} [relevanceScore] - Current relevance score in retrieval
 * @property {Date} [lastRetrieved] - Last time this document was retrieved
 */

/**
 * Claude API request options with enhanced features
 * @typedef {Object} ClaudeRequestOptions
 * @property {string[]} [context] - Relevant knowledge base context
 * @property {Message[]} [history] - Conversation history for context
 * @property {string} [language] - Language for response (en/es/ru)
 * @property {number} [maxTokens] - Maximum tokens for response
 * @property {number} [temperature] - Temperature for response generation
 * @property {string} [model] - Claude model to use
 * @property {boolean} [useReranking] - Whether to use document reranking
 * @property {number} [retrievalK] - Number of documents to retrieve
 * @property {boolean} [includeSummaries] - Include document summaries in context
 */

/**
 * Enhanced Claude API response
 * @typedef {Object} ClaudeResponse
 * @property {string} message - AI generated response
 * @property {boolean} needsTicket - Whether a support ticket should be created
 * @property {number} tokensUsed - Tokens consumed by this request
 * @property {string} [detectedIntent] - Detected user intent/category
 * @property {string[]} [suggestedActions] - Suggested follow-up actions
 * @property {RetrievalDetails} [retrievalDetails] - Details about document retrieval
 * @property {RerankingDetails} [rerankingDetails] - Details about document reranking
 * @property {number} [confidence] - AI confidence in response
 */

/**
 * Retrieval details for transparency
 * @typedef {Object} RetrievalDetails
 * @property {number} documentsRetrieved - Number of documents retrieved
 * @property {number} averageScore - Average retrieval score
 * @property {string[]} documentIds - IDs of retrieved documents
 * @property {number} retrievalTime - Time taken for retrieval (ms)
 */

/**
 * Reranking details following anthropic-cookbook patterns
 * @typedef {Object} RerankingDetails
 * @property {boolean} wasCalled - Whether reranking was performed
 * @property {number} originalCount - Original number of documents
 * @property {number} finalCount - Final number after reranking
 * @property {Array<{id: string, originalRank: number, newRank: number}>} rankings - Ranking changes
 * @property {number} rerankingTime - Time taken for reranking (ms)
 */

/**
 * Vector store search options with reranking support
 * @typedef {Object} SearchOptions
 * @property {number} [limit] - Maximum number of results to return
 * @property {string} [language] - Language filter for search
 * @property {number} [threshold] - Similarity threshold for results
 * @property {string[]} [categories] - Categories to filter by
 * @property {boolean} [useReranking] - Whether to use document reranking
 * @property {number} [initialK] - Initial number of documents to retrieve for reranking
 * @property {boolean} [includeSummaries] - Include document summaries
 * @property {string[]} [excludeIds] - Document IDs to exclude
 */

/**
 * Enhanced vector store search result
 * @typedef {Object} SearchResult
 * @property {KnowledgeDocument} document - The matched document
 * @property {number} score - Similarity score (0-1)
 * @property {string} snippet - Relevant text snippet from document
 * @property {number} [relevanceScore] - Reranking relevance score
 * @property {boolean} [wasReranked] - Whether this result was reranked
 * @property {SearchResultMetadata} [metadata] - Additional result metadata
 */

/**
 * Search result metadata
 * @typedef {Object} SearchResultMetadata
 * @property {string} [highlightedText] - Text with highlighted matches
 * @property {string} [expandedContext] - Expanded context around match
 * @property {number} [originalRank] - Original rank before reranking
 * @property {number} [finalRank] - Final rank after reranking
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
 * API response wrapper with enhanced error handling
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether request was successful
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 * @property {string} [errorCode] - Error code for programmatic handling
 * @property {any} [details] - Additional error details
 * @property {number} [timestamp] - Response timestamp
 * @property {string} [requestId] - Unique request ID for tracking
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

/**
 * Shrooms-specific prompt context
 * @typedef {Object} ShroomsPromptContext
 * @property {string} query - User query
 * @property {string} language - Preferred language
 * @property {string} platform - Source platform (web/telegram)
 * @property {boolean} isNewUser - Whether user is new to the platform
 * @property {string[]} previousTopics - Previous conversation topics
 * @property {boolean} hasWalletConnected - Whether user has connected wallet
 */

/**
 * Shrooms-specific response metadata
 * @typedef {Object} ShroomsResponseMeta
 * @property {boolean} usedGrapeTheme - Whether grape/mushroom theme was applied
 * @property {string} detectedCategory - Detected question category
 * @property {boolean} suggestedWalletConnection - Whether wallet connection was suggested
 * @property {string[]} relatedTopics - Related topics for follow-up
 * @property {boolean} escalationRecommended - Whether escalation is recommended
 */

export {
  // Type exports for IDE support and documentation
  // All types are available via JSDoc comments
};
