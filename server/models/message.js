/**
 * Модель для сообщений в чате
 * @file server/models/message.js
 */

const mongoose = require('mongoose');

/**
 * Схема для сообщения
 */
const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
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
    language: {
      type: String,
      default: 'auto'
    },
    tokensUsed: {
      type: Number,
      default: 0
    },
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    },
    createdTicket: {
      type: Boolean,
      default: false
    },
    ticketId: {
      type: String
    },
    source: {
      type: String,
      enum: ['socket', 'api', 'telegram'],
      default: 'socket'
    },
    additional: {
      type: Object,
      default: {}
    }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    text: String,
    editedAt: Date,
    editedBy: String
  }]
}, {
  timestamps: true,
  collection: 'messages'
});

// Индексы
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ role: 1, createdAt: -1 });
messageSchema.index({ 'metadata.language': 1, createdAt: -1 });
messageSchema.index({ text: 'text' });

// Виртуальные поля
messageSchema.virtual('wordCount').get(function() {
  return this.text.split(/\s+/).length;
});

messageSchema.virtual('characterCount').get(function() {
  return this.text.length;
});

// Методы
messageSchema.methods.edit = function(newText, editedBy) {
  if (this.isEdited) {
    this.editHistory.push({
      text: this.text,
      editedAt: new Date(),
      editedBy: editedBy
    });
  } else {
    this.editHistory.push({
      text: this.text,
      editedAt: this.createdAt,
      editedBy: this.userId
    });
  }
  
  this.text = newText;
  this.isEdited = true;
  return this.save();
};

// Статические методы
messageSchema.statics.findByConversation = function(conversationId, options = {}) {
  const { limit = 50, skip = 0, sort = { createdAt: 1 } } = options;
  return this.find({ conversationId })
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.findRecentByUser = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Middleware
messageSchema.pre('save', function(next) {
  if (!this.metadata.language && this.text) {
    this.metadata.language = 'auto'; // По умолчанию
  }
  next();
});

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
