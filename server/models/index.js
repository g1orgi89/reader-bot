/**
 * Models index file - exports all models for Reader bot
 * @file server/models/index.js
 */

// Import Reader bot models
const Quote = require('./quote');
const UserProfile = require('./userProfile');
const Content = require('./content');
const WeeklyReport = require('./weeklyReport');
const MonthlyReport = require('./monthlyReport');
const Prompt = require('./prompt');
const Favorite = require('./Favorite');
const Follow = require('./Follow');

// Import analytics models
const { UTMClick, PromoCodeUsage, UserAction } = require('./analytics');

// Import legacy models (keeping for compatibility during migration)
const Message = require('./message');
const Conversation = require('./conversation');
const Ticket = require('./ticket');
const KnowledgeDocument = require('./knowledge');
const FarmingRate = require('./farmingRate');

/**
 * Initialize all models and their relationships
 * @returns {Promise<void>}
 */
async function initializeModels() {
  try {
    // Ensure indexes are created for Reader bot models
    await Promise.all([
      // Core Reader bot models
      Quote.ensureIndexes(),
      UserProfile.ensureIndexes(),
      Content.ensureIndexes(),
      WeeklyReport.ensureIndexes(),
      MonthlyReport.ensureIndexes(),
      Prompt.ensureIndexes(),
      Favorite.ensureIndexes(),
      Follow.ensureIndexes(),
      
      // Analytics models
      UTMClick.ensureIndexes(),
      PromoCodeUsage.ensureIndexes(),
      UserAction.ensureIndexes(),
      
      // Legacy models
      Message.ensureIndexes(),
      Conversation.ensureIndexes(), 
      Ticket.ensureIndexes(),
      KnowledgeDocument.ensureIndexes(),
      FarmingRate.ensureIndexes()
    ]);
    
    console.log('✅ All database indexes created successfully');
    
    // Initialize default content for Reader bot
    await Content.createDefaultContent();
    console.log('✅ Default content initialized');
    
  } catch (error) {
    console.error('❌ Error initializing models:', error);
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
    
    // Initialize default prompts for Reader bot
    await Prompt.createDefaultPrompts();
    
    console.log('✅ Reader bot data initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Reader bot data:', error);
    throw error;
  }
}

/**
 * Get database statistics for Reader bot
 * @returns {Promise<Object>}
 */
async function getDatabaseStats() {
  try {
    const stats = await Promise.all([
      // Reader bot models
      Quote.countDocuments(),
      UserProfile.countDocuments(),
      Content.countDocuments(),
      WeeklyReport.countDocuments(),
      MonthlyReport.countDocuments(),
      Prompt.countDocuments(),
      Follow.countDocuments(),
      
      // Analytics models
      UTMClick.countDocuments(),
      PromoCodeUsage.countDocuments(),
      UserAction.countDocuments(),
      
      // Legacy models
      Message.countDocuments(),
      Conversation.countDocuments(),
      Ticket.countDocuments(),
      KnowledgeDocument.countDocuments(),
      FarmingRate.countDocuments()
    ]);

    return {
      // Reader bot models
      quotes: stats[0],
      userProfiles: stats[1], 
      content: stats[2],
      weeklyReports: stats[3],
      monthlyReports: stats[4],
      prompts: stats[5],
      follows: stats[6],
      
      // Analytics
      utmClicks: stats[7],
      promoCodeUsage: stats[8],
      userActions: stats[9],
      
      // Legacy models
      messages: stats[10],
      conversations: stats[11],
      tickets: stats[12],
      knowledgeDocuments: stats[13],
      farmingRates: stats[14],
      
      total: stats.reduce((a, b) => a + b, 0)
    };
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return {
      quotes: 0,
      userProfiles: 0,
      content: 0,
      weeklyReports: 0,
      monthlyReports: 0,
      prompts: 0,
      follows: 0,
      utmClicks: 0,
      promoCodeUsage: 0,
      userActions: 0,
      messages: 0,
      conversations: 0,
      tickets: 0,
      knowledgeDocuments: 0,
      farmingRates: 0,
      total: 0,
      error: error.message
    };
  }
}

/**
 * Get Reader bot specific statistics
 * @returns {Promise<Object>}
 */
async function getReaderStats() {
  try {
    const [totalUsers, activeUsers, totalQuotes, weeklyReports, monthlyReports, totalFollows] = await Promise.all([
      UserProfile.countDocuments({ isOnboardingComplete: true }),
      UserProfile.countDocuments({ 
        isOnboardingComplete: true,
        'statistics.currentStreak': { $gt: 0 }
      }),
      Quote.countDocuments(),
      WeeklyReport.countDocuments(),
      MonthlyReport.countDocuments(),
      Follow.countDocuments()
    ]);

    return {
      totalUsers,
      activeUsers,
      totalQuotes,
      weeklyReports,
      monthlyReports,
      totalFollows,
      averageQuotesPerUser: totalUsers > 0 ? Math.round(totalQuotes / totalUsers * 10) / 10 : 0
    };
  } catch (error) {
    console.error('❌ Error getting Reader stats:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalQuotes: 0,
      weeklyReports: 0,
      monthlyReports: 0,
      totalFollows: 0,
      averageQuotesPerUser: 0,
      error: error.message
    };
  }
}

// Export all models and utilities
module.exports = {
  // Core Reader bot models
  Quote,
  UserProfile,
  Content,
  WeeklyReport,
  MonthlyReport,
  Prompt,
  Favorite,
  Follow,
  
  // Analytics models
  UTMClick,
  PromoCodeUsage,
  UserAction,
  
  // Legacy models (for compatibility during migration)
  Message,
  Conversation,
  Ticket,
  KnowledgeDocument,
  FarmingRate,
  
  // Utility functions
  initializeModels,
  initializeReaderData,
  getDatabaseStats,
  getReaderStats
};
