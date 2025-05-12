/**
 * Type definitions for client-side widgets and components
 * @file client/types/index.js
 */

/**
 * @typedef {Object} WidgetConfig
 * @property {string} apiUrl - URL to the API server
 * @property {string} [containerId='shrooms-chat-widget'] - Container ID for the widget
 * @property {Object} [styles] - Custom styles for the widget
 * @property {string} [theme='dark'] - Widget theme (dark/light)
 * @property {string} [language] - Default language for the widget
 * @property {boolean} [autoOpen=false] - Whether to open the widget automatically
 * @property {number} [maxHeight=500] - Maximum height of the chat container
 */

/**
 * @typedef {Object} ChatWidgetAPI
 * @property {Function} sendMessage - Send a message to the chat
 * @property {Function} openWidget - Open the chat widget
 * @property {Function} closeWidget - Close the chat widget
 * @property {Function} minimize - Minimize the chat widget
 * @property {Function} setLanguage - Change the widget language
 * @property {Function} clearHistory - Clear the chat history
 * @property {Function} on - Register event listener
 * @property {Function} off - Remove event listener
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id - Message ID
 * @property {('user'|'assistant')} role - Message role
 * @property {string} content - Message content
 * @property {Date} timestamp - Message timestamp
 * @property {boolean} [isNew] - Whether the message is new/unread
 */

/**
 * @typedef {Object} TicketNotification
 * @property {string} ticketId - Ticket ID
 * @property {string} title - Notification title
 * @property {string} message - Notification message
 * @property {('info'|'success'|'warning'|'error')} type - Notification type
 */

/**
 * @typedef {Object} WidgetState
 * @property {boolean} isOpen - Whether the widget is open
 * @property {boolean} isMinimized - Whether the widget is minimized
 * @property {boolean} isLoading - Whether a message is being processed
 * @property {boolean} isConnected - Whether connected to the server
 * @property {string} conversationId - Current conversation ID
 * @property {string} [currentTicketId] - Current ticket ID if any
 */

/**
 * @typedef {Object} ErrorState
 * @property {boolean} hasError - Whether there's an error
 * @property {string} [message] - Error message
 * @property {string} [code] - Error code
 * @property {boolean} [isRetryable] - Whether the error is retryable
 */

/**
 * @typedef {Object} UIEvents
 * @property {('message.sent'|'message.received'|'ticket.created'|'widget.opened'|'widget.closed'|'error')} type - Event type
 * @property {Object} data - Event data
 */

module.exports = {};
