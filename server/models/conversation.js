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
    default: 'auto',
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
    enum: ['socket', 'api', 'telegram', 'ticket', 'chat', 'web'],
    default: 'socket'
  },
  // Дополнительные поля для интеграции с тикетами
  ticketId: {
    type: String,
    sparse: true,
    index: true
  },
  endedAt: {
    type: Date
  },
  endReason: {
    type: String,
    enum: ['user_ended', 'ticket_created', 'timeout', 'admin_ended'],
    default: 'user_ended'
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

// Составные индексы
conversationSchema.index({ userId: 1, lastActivityAt: -1 });
conversationSchema.index({ lastActivityAt: -1, isActive: 1 });
conversationSchema.index({ startedAt: -1, language: 1 });
conversationSchema.index({ source: 1, isActive: 1 });

// Виртуальные поля
conversationSchema.virtual('duration').get(function() {
  const endTime = this.endedAt || this.lastActivityAt || new Date();
  return endTime - this.startedAt;
});

conversationSchema.virtual('isEnded').get(function() {
  return !!this.endedAt || !this.isActive;
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

conversationSchema.methods.setInactive = function(reason = 'user_ended') {
  this.isActive = false;
  this.endedAt = new Date();
  this.endReason = reason;
  return this.save();
};

conversationSchema.methods.linkToTicket = function(ticketId) {
  this.ticketId = ticketId;
  this.metadata.ticketLinked = true;
  this.metadata.ticketId = ticketId;
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

conversationSchema.statics.findByTicketId = function(ticketId) {
  return this.findOne({ ticketId });
};

// Middleware для обновления lastActivityAt при любом изменении
conversationSchema.pre('save', function(next) {
  if (this.isModified() && !this.isModified('lastActivityAt')) {
    this.lastActivityAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);