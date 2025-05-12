/**
 * Conversation model for Shrooms Support Bot
 * @file server/models/conversation.js
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/index.js').ConversationType} ConversationType
 */

/**
 * Conversation schema definition
 */
const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  messageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active',
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en',
    index: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
conversationSchema.index({ userId: 1, status: 1, lastActivityAt: -1 });
conversationSchema.index({ status: 1, lastActivityAt: -1 });

// Virtual to populate messages
conversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId'
});

// Virtual for message count
conversationSchema.virtual('messageCount').get(function() {
  return this.messageIds.length;
});

/**
 * Instance method to add a message to the conversation
 * @param {string} messageId - Message ObjectId
 * @returns {Promise<ConversationType>} Updated conversation
 */
conversationSchema.methods.addMessage = function(messageId) {
  this.messageIds.push(messageId);
  this.lastActivityAt = new Date();
  return this.save();
};

/**
 * Instance method to close the conversation
 * @returns {Promise<ConversationType>} Updated conversation
 */
conversationSchema.methods.close = function() {
  this.status = 'closed';
  return this.save();
};

/**
 * Instance method to archive the conversation
 * @returns {Promise<ConversationType>} Updated conversation
 */
conversationSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

/**
 * Instance method to get conversation summary
 * @returns {Object} Conversation summary
 */
conversationSchema.methods.getSummary = function() {
  return {
    id: this._id,
    userId: this.userId,
    status: this.status,
    language: this.language,
    messageCount: this.messageCount,
    createdAt: this.createdAt,
    lastActivityAt: this.lastActivityAt
  };
};

/**
 * Static method to find active conversations for a user
 * @param {string} userId - User ID
 * @returns {Promise<ConversationType|null>} Active conversation or null
 */
conversationSchema.statics.findActiveForUser = function(userId) {
  return this.findOne({ 
    userId, 
    status: 'active' 
  }).sort({ lastActivityAt: -1 });
};

/**
 * Static method to get or create a conversation for a user
 * @param {string} userId - User ID
 * @param {string} [language='en'] - Conversation language
 * @returns {Promise<ConversationType>} Conversation document
 */
conversationSchema.statics.getOrCreateForUser = async function(userId, language = 'en') {
  let conversation = await this.findActiveForUser(userId);
  
  if (!conversation) {
    conversation = new this({
      userId,
      language,
      status: 'active',
      lastActivityAt: new Date()
    });
    await conversation.save();
  }
  
  return conversation;
};

/**
 * Static method to find conversations with pagination
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.sort='-lastActivityAt'] - Sort field
 * @returns {Promise<Object>} Paginated results
 */
conversationSchema.statics.findWithPagination = async function(filter = {}, options = {}) {
  const { page = 1, limit = 20, sort = '-lastActivityAt' } = options;
  const skip = (page - 1) * limit;
  
  const [conversations, total] = await Promise.all([
    this.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);
  
  return {
    conversations,
    total,
    page,
    pages: Math.ceil(total / limit),
    hasMore: skip + conversations.length < total
  };
};

/**
 * Pre-save middleware to update lastActivityAt
 */
conversationSchema.pre('save', function(next) {
  if (this.isModified('messageIds')) {
    this.lastActivityAt = new Date();
  }
  next();
});

/**
 * Post-save middleware to handle conversation lifecycle
 */
conversationSchema.post('save', async function(doc) {
  // Auto-archive conversations after 30 days of inactivity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  if (doc.status === 'closed' && doc.lastActivityAt < thirtyDaysAgo) {
    await this.constructor.findByIdAndUpdate(doc._id, { status: 'archived' });
  }
});

/**
 * Model for Conversation documents
 * @type {mongoose.Model<ConversationType>}
 */
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;