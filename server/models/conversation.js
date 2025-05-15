/**
 * Модель для разговоров в чате
 * @file server/models/conversation.js
 */

const mongoose = require('mongoose');

/**
 * Схема для разговора
 */
const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en',
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  messageCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Object,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  source: {
    type: String,
    enum: ['socket', 'api', 'telegram'],
    default: 'socket'
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

// Составные индексы
conversationSchema.index({ userId: 1, lastActivityAt: -1 });
conversationSchema.index({ lastActivityAt: -1, isActive: 1 });
conversationSchema.index({ startedAt: -1, language: 1 });

// Виртуальные поля
conversationSchema.virtual('duration').get(function() {
  return this.lastActivityAt - this.startedAt;
});

// Методы экземпляра
conversationSchema.methods.updateActivity = function() {
  this.lastActivityAt = new Date();
  return this.save();
};

conversationSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastActivityAt = new Date();
  return this.save();
};

conversationSchema.methods.setInactive = function() {
  this.isActive = false;
  return this.save();
};

// Статические методы
conversationSchema.statics.findByUserId = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ lastActivityAt: -1 })
    .limit(limit);
};

conversationSchema.statics.findActiveByUserId = function(userId) {
  return this.findOne({ 
    userId, 
    isActive: true 
  }).sort({ lastActivityAt: -1 });
};

module.exports = mongoose.model('Conversation', conversationSchema);