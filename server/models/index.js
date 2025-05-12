/**
 * Models index file - exports all models
 * @file server/models/index.js
 */

// Import all models
const Message = require('./message');
const Conversation = require('./conversation');
const Ticket = require('./ticket');
const KnowledgeDocument = require('./knowledge');

// Import type guards from types
const { isMessage, isTicket } = require('../types/index');

/**
 * Initialize all models and their relationships
 * @returns {Promise<void>}
 */
async function initializeModels() {
  try {
    // Ensure indexes are created
    await Promise.all([
      Message.ensureIndexes(),
      Conversation.ensureIndexes(),
      Ticket.ensureIndexes(),
      KnowledgeDocument.ensureIndexes()
    ]);
    
    console.log('All database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
    throw error;
  }
}

// Export all models and utilities
module.exports = {
  // Models
  Message,
  Conversation,
  Ticket,
  KnowledgeDocument,
  
  // Type guards
  isMessage,
  isTicket,
  
  // Initialization function
  initializeModels
};