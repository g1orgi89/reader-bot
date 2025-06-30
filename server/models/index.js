/**
 * Models index file - exports all models for Reader bot
 * @file server/models/index.js
 */

// Import Reader bot models
const Quote = require('./quote');
const UserProfile = require('./userProfile');
const Content = require('./content');

// Import legacy models (keeping for compatibility during migration)
const Message = require('./message');
const Conversation = require('./conversation');
const Ticket = require('./ticket');
const KnowledgeDocument = require('./knowledge');

/**
 * Initialize all models and their relationships
 * @returns {Promise<void>}
 */
async function initializeModels() {
  try {
    // Ensure indexes are created for Reader bot models
    await Promise.all([
      Quote.ensureIndexes(),
      UserProfile.ensureIndexes(),
      Content.ensureIndexes(),
      // Legacy models
      Message.ensureIndexes(),
      Conversation.ensureIndexes(), 
      Ticket.ensureIndexes(),
      KnowledgeDocument.ensureIndexes()
    ]);
    
    console.log('All database indexes created successfully');
    
    // Initialize default content for Reader bot
    await Content.createDefaultContent();
    console.log('Default content initialized');
    
  } catch (error) {
    console.error('Error initializing models:', error);
    throw error;
  }
}

/**
 * Initialize Reader bot specific data
 * @returns {Promise<void>}
 */
async function initializeReaderData() {
  try {
    // Create default content
    await Content.createDefaultContent();
    
    // Add any other Reader-specific initialization here
    console.log('Reader bot data initialized successfully');
  } catch (error) {
    console.error('Error initializing Reader bot data:', error);
    throw error;
  }
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
async function getDatabaseStats() {
  try {
    const stats = await Promise.all([
      Quote.countDocuments(),
      UserProfile.countDocuments(),
      Content.countDocuments(),
      Message.countDocuments(),
      Conversation.countDocuments(),
      Ticket.countDocuments(),
      KnowledgeDocument.countDocuments()
    ]);

    return {
      quotes: stats[0],
      userProfiles: stats[1], 
      content: stats[2],
      messages: stats[3],
      conversations: stats[4],
      tickets: stats[5],
      knowledgeDocuments: stats[6],
      total: stats.reduce((a, b) => a + b, 0)
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      quotes: 0,
      userProfiles: 0,
      content: 0,
      messages: 0,
      conversations: 0,
      tickets: 0,
      knowledgeDocuments: 0,
      total: 0,
      error: error.message
    };
  }
}

// Export all models and utilities
module.exports = {
  // Reader bot models
  Quote,
  UserProfile,
  Content,
  
  // Legacy models (for compatibility)
  Message,
  Conversation,
  Ticket,
  KnowledgeDocument,
  
  // Utility functions
  initializeModels,
  initializeReaderData,
  getDatabaseStats
};