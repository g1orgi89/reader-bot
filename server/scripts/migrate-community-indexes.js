/**
 * Migration script to add production-optimized indexes for Community API endpoints
 * @file server/scripts/migrate-community-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Quote = require('../models/quote');
const UTMClick = require('../models/analytics').UTMClick;
const BookCatalog = require('../models/BookCatalog');
const UserProfile = require('../models/userProfile');

/**
 * Create optimized indexes for community endpoints
 */
async function createCommunityIndexes() {
  console.log('🏗️  Creating production indexes for Community API...');
  
  try {
    // Quote model indexes for community endpoints
    console.log('📖 Creating Quote indexes...');
    
    // For /community/quotes/latest - optimized sorting with tie-breaker
    await Quote.collection.createIndex({ createdAt: -1, _id: -1 }, {
      name: 'community_latest_quotes',
      background: true
    });
    
    // For /community/popular aggregation by text+author
    await Quote.collection.createIndex({ text: 1, author: 1, createdAt: -1 }, {
      name: 'community_popular_quotes',
      background: true
    });
    
    // UTMClick indexes for community analytics
    console.log('📊 Creating UTMClick indexes...');
    
    // For /community/popular-books campaign filtering with sorting
    await UTMClick.collection.createIndex({ campaign: 1, timestamp: -1, content: 1 }, {
      name: 'community_popular_books',
      background: true
    });
    
    // Enhanced index for catalog clicks aggregation
    await UTMClick.collection.createIndex({ campaign: 1, content: 1, timestamp: -1, _id: 1 }, {
      name: 'community_book_analytics',
      background: true
    });
    
    // BookCatalog indexes for efficient lookups
    console.log('📚 Creating BookCatalog indexes...');
    
    // For efficient slug lookups in multiple operations
    await BookCatalog.collection.createIndex({ bookSlug: 1, isActive: 1 }, {
      name: 'catalog_slug_active_lookup',
      background: true
    });
    
    // UserProfile indexes for community stats and leaderboard
    console.log('👥 Creating UserProfile indexes...');
    
    // For /community/leaderboard with deterministic sorting
    await UserProfile.collection.createIndex(
      { 'statistics.totalQuotes': -1, _id: 1, isOnboardingComplete: 1, isActive: 1 }, 
      {
        name: 'community_leaderboard',
        background: true
      }
    );
    
    // For active users counting in stats
    await UserProfile.collection.createIndex({ lastActiveAt: -1, isActive: 1, isOnboardingComplete: 1 }, {
      name: 'community_active_users',
      background: true
    });
    
    console.log('✅ All community indexes created successfully!');
    
    // Display index status
    await displayIndexStatus();
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

/**
 * Display current index status for community collections
 */
async function displayIndexStatus() {
  console.log('\n📋 Current index status:');
  
  const collections = [
    { name: 'Quote', model: Quote },
    { name: 'UTMClick', model: UTMClick },
    { name: 'BookCatalog', model: BookCatalog },
    { name: 'UserProfile', model: UserProfile }
  ];
  
  for (const { name, model } of collections) {
    try {
      const indexes = await model.collection.getIndexes();
      console.log(`\n${name} collection indexes:`);
      Object.entries(indexes).forEach(([indexName, indexDef]) => {
        const keys = Object.keys(indexDef.key).map(key => 
          `${key}:${indexDef.key[key]}`
        ).join(', ');
        console.log(`  - ${indexName}: { ${keys} }`);
      });
    } catch (error) {
      console.warn(`⚠️  Could not get indexes for ${name}:`, error.message);
    }
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reader-bot';
  
  try {
    console.log(`🔗 Connecting to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    await createCommunityIndexes();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Community API migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createCommunityIndexes, displayIndexStatus };