/**
 * Validators for Shrooms Support Bot
 * @file server/utils/validators.js
 */

const logger = require('./logger');

/**
 * Validate chat request
 * @param {Object} chatRequest - Chat request object
 * @throws {Error} If validation fails
 */
function validateChatRequest(chatRequest) {
  if (!chatRequest) {
    throw new Error('Chat request is required');
  }

  if (!chatRequest.message || typeof chatRequest.message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  if (chatRequest.message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (chatRequest.message.length > 5000) {
    throw new Error('Message is too long (maximum 5000 characters)');
  }

  if (chatRequest.userId && typeof chatRequest.userId !== 'string') {
    throw new Error('UserId must be a string');
  }

  if (chatRequest.language && !['en', 'es', 'ru'].includes(chatRequest.language)) {
    throw new Error('Language must be one of: en, es, ru');
  }

  if (chatRequest.context && !Array.isArray(chatRequest.context)) {
    throw new Error('Context must be an array');
  }

  if (chatRequest.history && !Array.isArray(chatRequest.history)) {
    throw new Error('History must be an array');
  }

  logger.debug('Chat request validated successfully', {
    messageLength: chatRequest.message.length,
    userId: chatRequest.userId,
    language: chatRequest.language
  });
}

/**
 * Validate knowledge document
 * @param {Object} doc - Knowledge document
 * @throws {Error} If validation fails
 */
function validateKnowledgeDocument(doc) {
  if (!doc) {
    throw new Error('Document is required');
  }

  if (!doc.title || typeof doc.title !== 'string') {
    throw new Error('Title is required and must be a string');
  }

  if (doc.title.length > 200) {
    throw new Error('Title is too long (maximum 200 characters)');
  }

  if (!doc.content || typeof doc.content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  if (doc.content.length > 50000) {
    throw new Error('Content is too long (maximum 50000 characters)');
  }

  if (!doc.category || typeof doc.category !== 'string') {
    throw new Error('Category is required and must be a string');
  }

  if (doc.tags && !Array.isArray(doc.tags)) {
    throw new Error('Tags must be an array');
  }

  if (doc.language && !['en', 'es', 'ru'].includes(doc.language)) {
    throw new Error('Language must be one of: en, es, ru');
  }
}

/**
 * Validate ticket data
 * @param {Object} ticketData - Ticket data
 * @throws {Error} If validation fails
 */
function validateTicketData(ticketData) {
  if (!ticketData) {
    throw new Error('Ticket data is required');
  }

  if (!ticketData.userId || typeof ticketData.userId !== 'string') {
    throw new Error('UserId is required and must be a string');
  }

  if (!ticketData.subject || typeof ticketData.subject !== 'string') {
    throw new Error('Subject is required and must be a string');
  }

  if (ticketData.subject.length > 200) {
    throw new Error('Subject is too long (maximum 200 characters)');
  }

  if (!ticketData.initialMessage || typeof ticketData.initialMessage !== 'string') {
    throw new Error('Initial message is required and must be a string');
  }

  if (ticketData.initialMessage.length > 2000) {
    throw new Error('Initial message is too long (maximum 2000 characters)');
  }

  if (ticketData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticketData.email)) {
    throw new Error('Email format is invalid');
  }

  if (ticketData.priority && !['low', 'medium', 'high', 'urgent'].includes(ticketData.priority)) {
    throw new Error('Priority must be one of: low, medium, high, urgent');
  }

  if (ticketData.category && !['technical', 'account', 'billing', 'feature', 'other'].includes(ticketData.category)) {
    throw new Error('Category must be one of: technical, account, billing, feature, other');
  }

  if (ticketData.language && !['en', 'es', 'ru'].includes(ticketData.language)) {
    throw new Error('Language must be one of: en, es, ru');
  }
}

module.exports = {
  validateChatRequest,
  validateKnowledgeDocument,
  validateTicketData
};