/**
 * Type validation utilities
 * @file server/utils/validators.js
 */

/**
 * Check if a value is one of the allowed enum values
 * @param {any} value - Value to check
 * @param {string[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value is not in allowed values
 */
function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}. Must be one of: ${allowedValues.join(', ')}`);
  }
}

/**
 * Validate language enum
 * @param {any} language - Language to validate
 * @throws {Error} If language is invalid
 */
function validateLanguage(language) {
  const allowedLanguages = ['en', 'es', 'ru'];
  validateEnum(language, allowedLanguages, 'language');
}

/**
 * Validate message role enum
 * @param {any} role - Role to validate
 * @throws {Error} If role is invalid
 */
function validateMessageRole(role) {
  const allowedRoles = ['user', 'assistant', 'system'];
  validateEnum(role, allowedRoles, 'role');
}

/**
 * Validate ticket status enum
 * @param {any} status - Status to validate
 * @throws {Error} If status is invalid
 */
function validateTicketStatus(status) {
  const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  validateEnum(status, allowedStatuses, 'status');
}

/**
 * Validate ticket priority enum
 * @param {any} priority - Priority to validate
 * @throws {Error} If priority is invalid
 */
function validateTicketPriority(priority) {
  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  validateEnum(priority, allowedPriorities, 'priority');
}

/**
 * Validate ticket category enum
 * @param {any} category - Category to validate
 * @throws {Error} If category is invalid
 */
function validateTicketCategory(category) {
  const allowedCategories = ['technical', 'account', 'billing', 'feature', 'other'];
  validateEnum(category, allowedCategories, 'category');
}

/**
 * Validate chat request object
 * @param {Object} request - Request object to validate
 * @returns {boolean} True if valid
 * @throws {Error} If request is invalid
 */
function validateChatRequest(request) {
  if (!request) {
    throw new Error('Request object is required');
  }

  if (!request.message || typeof request.message !== 'string' || request.message.trim().length === 0) {
    throw new Error('message is required and must be a non-empty string');
  }

  if (!request.userId || typeof request.userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  if (request.conversationId && typeof request.conversationId !== 'string') {
    throw new Error('conversationId must be a string');
  }

  if (request.language) {
    validateLanguage(request.language);
  }

  return true;
}

/**
 * Validate ticket data object
 * @param {Object} ticketData - Ticket data to validate
 * @returns {boolean} True if valid
 * @throws {Error} If ticket data is invalid
 */
function validateTicketData(ticketData) {
  if (!ticketData) {
    throw new Error('Ticket data object is required');
  }

  if (!ticketData.userId || typeof ticketData.userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  if (!ticketData.subject || typeof ticketData.subject !== 'string' || ticketData.subject.trim().length === 0) {
    throw new Error('subject is required and must be a non-empty string');
  }

  if (!ticketData.initialMessage || typeof ticketData.initialMessage !== 'string' || ticketData.initialMessage.trim().length === 0) {
    throw new Error('initialMessage is required and must be a non-empty string');
  }

  if (ticketData.priority) {
    validateTicketPriority(ticketData.priority);
  }

  if (ticketData.category) {
    validateTicketCategory(ticketData.category);
  }

  if (ticketData.language) {
    validateLanguage(ticketData.language);
  }

  return true;
}

module.exports = {
  validateEnum,
  validateLanguage,
  validateMessageRole,
  validateTicketStatus,
  validateTicketPriority,
  validateTicketCategory,
  validateChatRequest,
  validateTicketData
};
