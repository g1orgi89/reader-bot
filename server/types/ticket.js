/**
 * Ticket-specific type definitions and exports
 * @file server/types/ticket.js
 */

/**
 * Enum for ticket statuses
 * @readonly
 * @enum {string}
 */
const TicketStatus = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
});

/**
 * Enum for ticket priorities
 * @readonly
 * @enum {string}
 */
const TicketPriority = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
});

/**
 * Enum for ticket categories
 * @readonly
 * @enum {string}
 */
const TicketCategory = Object.freeze({
  TECHNICAL: 'technical',
  ACCOUNT: 'account',
  BILLING: 'billing',
  FEATURE: 'feature',
  OTHER: 'other'
});

/**
 * @typedef {Object} TicketCreateData
 * @property {string} userId - User ID who created the ticket
 * @property {string} conversationId - Associated conversation ID
 * @property {string} subject - Ticket subject
 * @property {string} initialMessage - Initial message or description
 * @property {string} [context] - Context from the conversation
 * @property {string} [language='en'] - Ticket language
 * @property {TicketPriority} [priority='medium'] - Ticket priority
 * @property {TicketCategory} [category='other'] - Ticket category
 * @property {string} [email] - User email
 */

/**
 * @typedef {Object} TicketUpdateData
 * @property {TicketStatus} [status] - New ticket status
 * @property {TicketPriority} [priority] - New ticket priority
 * @property {TicketCategory} [category] - New ticket category
 * @property {string} [assignedTo] - Assign to agent
 * @property {string} [resolution] - Resolution text
 * @property {string} [subject] - Update subject
 */

/**
 * @typedef {Object} TicketFilter
 * @property {TicketStatus} [status] - Filter by ticket status
 * @property {TicketPriority} [priority] - Filter by ticket priority
 * @property {TicketCategory} [category] - Filter by ticket category
 * @property {string} [assignedTo] - Filter by assigned agent
 * @property {string} [userId] - Filter by user ID
 */

/**
 * @typedef {Object} TicketQueryOptions
 * @property {number} [page=1] - Page number
 * @property {number} [limit=20] - Items per page
 * @property {string} [sort='-createdAt'] - Sort order
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [limit=20] - Maximum results
 * @property {TicketStatus} [status] - Filter by status
 */

/**
 * @typedef {Object} AssignedTicketsOptions
 * @property {TicketStatus} [status='in_progress'] - Filter by status
 * @property {number} [limit=50] - Maximum results
 */

/**
 * Type guard functions for ticket enums
 */

/**
 * Type guard to check if a value is a valid ticket status
 * @param {any} value - Value to check
 * @returns {value is TicketStatus} True if value is a valid ticket status
 */
function isValidStatus(value) {
  return Object.values(TicketStatus).includes(value);
}

/**
 * Type guard to check if a value is a valid ticket priority
 * @param {any} value - Value to check
 * @returns {value is TicketPriority} True if value is a valid ticket priority
 */
function isValidPriority(value) {
  return Object.values(TicketPriority).includes(value);
}

/**
 * Type guard to check if a value is a valid ticket category
 * @param {any} value - Value to check
 * @returns {value is TicketCategory} True if value is a valid ticket category
 */
function isValidCategory(value) {
  return Object.values(TicketCategory).includes(value);
}

// Export all ticket-related types and functions
module.exports = {
  // Enums
  TicketStatus,
  TicketPriority,
  TicketCategory,
  
  // Type guards
  isValidStatus,
  isValidPriority,
  isValidCategory,
  
  // Utility functions
  /**
   * Get all valid ticket statuses
   * @returns {string[]} Array of valid statuses
   */
  getAllStatuses: () => Object.values(TicketStatus),
  
  /**
   * Get all valid ticket priorities
   * @returns {string[]} Array of valid priorities
   */
  getAllPriorities: () => Object.values(TicketPriority),
  
  /**
   * Get all valid ticket categories
   * @returns {string[]} Array of valid categories
   */
  getAllCategories: () => Object.values(TicketCategory),
  
  /**
   * Validate ticket data against schema
   * @param {TicketCreateData} data - Ticket data to validate
   * @returns {{isValid: boolean, errors: string[]}} Validation result
   */
  validateTicketData: (data) => {
    const errors = [];
    
    if (!data.userId || typeof data.userId !== 'string') {
      errors.push('userId is required and must be a string');
    }
    
    if (!data.conversationId) {
      errors.push('conversationId is required');
    }
    
    if (!data.subject || typeof data.subject !== 'string') {
      errors.push('subject is required and must be a string');
    }
    
    if (!data.initialMessage || typeof data.initialMessage !== 'string') {
      errors.push('initialMessage is required and must be a string');
    }
    
    if (data.status && !isValidStatus(data.status)) {
      errors.push(`Invalid status. Must be one of: ${Object.values(TicketStatus).join(', ')}`);
    }
    
    if (data.priority && !isValidPriority(data.priority)) {
      errors.push(`Invalid priority. Must be one of: ${Object.values(TicketPriority).join(', ')}`);
    }
    
    if (data.category && !isValidCategory(data.category)) {
      errors.push(`Invalid category. Must be one of: ${Object.values(TicketCategory).join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};