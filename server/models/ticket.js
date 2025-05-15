/**
 * Модель для тикетов поддержки
 * @file server/models/ticket.js
 */

const mongoose = require('mongoose');

/**
 * Схема для тикета
 */
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
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
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: ['technical', 'account', 'billing', 'feature', 'bug', 'wallet', 'staking', 'farming', 'other'],
    default: 'other',
    index: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  initialMessage: {
    type: String,
    required: true,
    maxlength: 10000
  },
  context: {
    type: String,
    maxlength: 50000
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  assignedTo: {
    type: String,
    index: true
  },
  resolution: {
    type: String,
    maxlength: 10000
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en',
    index: true
  },
  metadata: {
    source: {
      type: String,
      enum: ['socket', 'api', 'telegram', 'email'],
      default: 'socket'
    },
    userAgent: String,
    ipAddress: String,
    tags: [String],
    internalNotes: String,
    estimatedTime: Number,
    actualTime: Number,
    satisfactionScore: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String
  },
  resolvedAt: {
    type: Date,
    index: true
  },
  firstResponseAt: Date,
  lastAgentResponseAt: Date,
  sla: {
    responseTime: Number,
    resolutionTime: Number,
    breached: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  collection: 'tickets'
});

// Составные индексы
ticketSchema.index({ status: 1, priority: -1, createdAt: 1 });
ticketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1, createdAt: -1 });
ticketSchema.index({ createdAt: -1, status: 1 });

// Текстовый индекс для поиска
ticketSchema.index({ 
  subject: 'text', 
  initialMessage: 'text',
  resolution: 'text'
});

// Виртуальные поля
ticketSchema.virtual('isOpen').get(function() {
  return ['open', 'in_progress', 'waiting_response'].includes(this.status);
});

ticketSchema.virtual('isClosed').get(function() {
  return ['resolved', 'closed'].includes(this.status);
});

ticketSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

ticketSchema.virtual('ageInHours').get(function() {
  return Math.floor(this.age / (1000 * 60 * 60));
});

// Методы экземпляра
ticketSchema.methods.assign = function(agentId) {
  this.assignedTo = agentId;
  if (this.status === 'open') {
    this.status = 'in_progress';
  }
  return this.save();
};

ticketSchema.methods.resolve = function(resolution, agentId) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolvedAt = new Date();
  this.assignedTo = this.assignedTo || agentId;
  
  // Вычисляем время разрешения
  this.sla.resolutionTime = Math.floor(
    (this.resolvedAt - this.createdAt) / (1000 * 60)
  );
  
  return this.save();
};

ticketSchema.methods.close = function(resolution) {
  if (resolution) {
    this.resolution = resolution;
  }
  this.status = 'closed';
  if (!this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  return this.save();
};

// Статические методы
ticketSchema.statics.findByStatus = function(status, options = {}) {
  const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
  return this.find({ status })
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

ticketSchema.statics.findByAgent = function(agentId, options = {}) {
  const { status, limit = 50, skip = 0 } = options;
  let query = { assignedTo: agentId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip);
};

ticketSchema.statics.findOverdue = function(hoursOverdue = 24) {
  const cutoffDate = new Date(Date.now() - hoursOverdue * 60 * 60 * 1000);
  return this.find({
    status: { $in: ['open', 'in_progress'] },
    createdAt: { $lt: cutoffDate },
    'sla.breached': { $ne: true }
  });
};

// Генерирует уникальный ticketId
ticketSchema.methods.generateTicketId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `SHR${timestamp}${random}`.toUpperCase();
};

// Проверяет SLA
ticketSchema.methods.checkSLA = function() {
  const now = new Date();
  const ageHours = (now - this.createdAt) / (1000 * 60 * 60);
  
  const slaHours = this.priority === 'urgent' ? 4 : 
                  this.priority === 'high' ? 12 : 
                  this.priority === 'medium' ? 24 : 48;
  
  if (ageHours > slaHours) {
    this.sla.breached = true;
  }
};

// Middleware
ticketSchema.pre('save', function(next) {
  if (!this.ticketId && this.isNew) {
    this.ticketId = this.generateTicketId();
  }
  
  this.updatedAt = new Date();
  
  if (this.isOpen && !this.sla.breached) {
    this.checkSLA();
  }
  
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);