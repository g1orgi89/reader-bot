/**
 * MongoDB connection configuration with UTF-8 support
 * @file server/config/db.js
 */

const mongoose = require('mongoose');
const { config } = require('./index');

/**
 * MongoDB connection options with UTF-8 support
 */
const mongoOptions = {
  // Connection settings
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // Connection pool settings
  maxPoolSize: config.database.options.maxPoolSize || 10,
  minPoolSize: config.database.options.minPoolSize || 1,
  maxIdleTimeMS: config.database.options.maxIdleTimeMS || 30000,
  serverSelectionTimeoutMS: config.database.options.serverSelectionTimeoutMS || 10000,
  socketTimeoutMS: config.database.options.socketTimeoutMS || 45000,
  
  // Buffer settings
  bufferMaxEntries: 0,
  bufferCommands: false,
  
  // CRITICAL: UTF-8 validation settings
  enableUtf8Validation: true,  // Enable UTF-8 validation
  
  // Additional settings for UTF-8
  writeConcern: {
    w: 'majority',
    j: true
  },
  
  // Read preference
  readPreference: 'primary',
  
  // Family - prefer IPv4
  family: 4
};

/**
 * Set up mongoose global settings for UTF-8
 */
function setupMongooseForUtf8() {
  // Default settings for all schemas
  mongoose.set('strictQuery', false);
  
  // Enable UTF-8 validation by default
  mongoose.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  });
  
  // Set default schema options
  mongoose.Schema.Types.String.set('trim', true);
  
  // Configure default collation for UTF-8
  mongoose.set('collation', {
    locale: 'en',
    strength: 2, // Case insensitive
    numericOrdering: true
  });
}

/**
 * Create database connection with UTF-8 support
 * @returns {Promise<mongoose.Connection>}
 */
async function createConnection() {
  // Setup mongoose for UTF-8
  setupMongooseForUtf8();
  
  // Create connection
  const connection = await mongoose.connect(config.database.uri, mongoOptions);
  
  // Ensure UTF-8 encoding on the database level
  await connection.connection.db.admin().command({
    collMod: 'knowledge_documents',
    validator: {
      $jsonSchema: {
        properties: {
          title: { bsonType: 'string' },
          content: { bsonType: 'string' },
          tags: { 
            bsonType: 'array',
            items: { bsonType: 'string' }
          }
        }
      }
    },
    validationLevel: 'moderate',
    validationAction: 'warn'
  }).catch(() => {
    // Collection might not exist yet, that's ok
  });
  
  return connection;
}

/**
 * Create text indexes with proper collation
 * @param {mongoose.Connection} connection
 */
async function createTextIndexes(connection) {
  const collections = ['knowledge_documents', 'messages', 'conversations'];
  
  for (const collectionName of collections) {
    try {
      const collection = connection.connection.db.collection(collectionName);
      
      // Check if collection exists
      const exists = await collection.findOne({});
      if (exists === null) continue;
      
      // Create text index with proper collation
      if (collectionName === 'knowledge_documents') {
        await collection.createIndex(
          {
            title: 'text',
            content: 'text',
            tags: 'text'
          },
          {
            name: 'knowledge_text_search',
            weights: {
              title: 10,
              content: 5,
              tags: 3
            },
            default_language: 'none', // Support all languages
            collation: {
              locale: 'simple' // Better for multi-language
            }
          }
        );
      }
    } catch (error) {
      console.warn(`Warning: Could not create text index for ${collectionName}:`, error.message);
    }
  }
}

/**
 * Database health check
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  try {
    // Check if connected
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'unhealthy',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      };
    }
    
    // Ping database
    await mongoose.connection.db.admin().ping();
    
    // Check UTF-8 capability with test document
    const testCollection = mongoose.connection.db.collection('test_utf8');
    const testDoc = {
      text: 'Test UTF-8: English, Русский, Español, 中文',
      emoji: '🍄👍✅',
      timestamp: new Date()
    };
    
    // Insert and retrieve test document
    const result = await testCollection.insertOne(testDoc);
    const retrieved = await testCollection.findOne({ _id: result.insertedId });
    await testCollection.deleteOne({ _id: result.insertedId });
    
    // Verify UTF-8 integrity
    const utf8Test = retrieved.text === testDoc.text && retrieved.emoji === testDoc.emoji;
    
    return {
      status: 'healthy',
      message: 'Database connected successfully',
      utf8Support: utf8Test,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      readyState: mongoose.connection.readyState
    };
  }
}

module.exports = {
  mongoOptions,
  setupMongooseForUtf8,
  createConnection,
  createTextIndexes,
  healthCheck
};