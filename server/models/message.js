/**
 * Message model for Shrooms Support Bot
 * @file server/models/message.js
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/index.js').MessageType} MessageType
 * @typedef {import('../types/index.js').MessageMetadata} MessageMetadata
 */

/**
 * Message metadata schema
 */
const messageMetadataSchema = new mongoose.Schema({
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    index: true
  },
  tokensUsed: {
    type: Number,
    min: 0
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral']
  },
  createdTicket: {
    type: Boolean,
    default: false
  },
  ticketId: {
    type: String,
    index: true
  }
}, { _id: false });

/**
 * Message schema definition
 */
const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000 // Reasonable limit for support messages
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  metadata: {
    type: messageMetadataSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
messageSchema.index({ createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ 'metadata.language': 1, createdAt: -1 });

// Virtual for ticket reference
messageSchema.virtual('ticket', {
  ref: 'Ticket',
  localField: 'metadata.ticketId',
  foreignField: 'ticketId',
  justOne: true
});

/**
 * Instance method to check if message created a ticket
 * @returns {boolean} Whether this message created a ticket
 */
messageSchema.methods.hasCreatedTicket = function() {
  return this.metadata && this.metadata.createdTicket === true && this.metadata.ticketId;
};

/**
 * Instance method to format message for API response
 * @returns {Object} Formatted message object
 */
messageSchema.methods.toApiResponse = function() {
  return {
    id: this._id,
    text: this.text,
    role: this.role,
    userId: this.userId,
    conversationId: this.conversationId,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Static method to find messages by conversation
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of messages to return
 * @param {number} [options.skip=0] - Number of messages to skip
 * @returns {Promise<Array<MessageType>>} Array of messages
 */
messageSchema.statics.findByConversation = function(conversationId, options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({ conversationId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Static method to get recent messages for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=20] - Maximum number of messages to return
 * @param {string} [options.language] - Filter by language
 * @returns {Promise<Array<MessageType>>} Array of recent messages
 */
messageSchema.statics.findRecentByUser = function(userId, options = {}) {
  const { limit = 20, language } = options;
  const query = { userId };
  
  if (language) {
    query['metadata.language'] = language;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('conversationId')
    .lean();
};

/**
 * Pre-save middleware to set default language if not provided
 */
messageSchema.pre('save', function(next) {
  if (!this.metadata.language) {
    // Default to English if not specified
    this.metadata.language = 'en';
  }
  next();
});

/**
 * Model for Message documents
 * @type {mongoose.Model<MessageType>}
 */
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
