/**
 * Модель для тикетов поддержки
 * @file server/models/ticket.js
 */

const mongoose = require('mongoose');

/**
 * Схема для комментария к тикету
 */
const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  isInternal: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

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
  // Комментарии к тикету
  comments: [commentSchema],
  
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
    feedback: String,
    createdBy: String,
    lastUpdatedBy: String
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
    },
    breachedAt: Date
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
  resolution: 'text',
  'comments.content': 'text'
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

ticketSchema.virtual('ageInDays').get(function() {
  return Math.floor(this.age / (1000 * 60 * 60 * 24));
});

ticketSchema.virtual('publicComments').get(function() {
  return this.comments.filter(comment => !comment.isInternal);
});

ticketSchema.virtual('internalComments').get(function() {
  return this.comments.filter(comment => comment.isInternal);
});

// Методы экземпляра
ticketSchema.methods.assign = function(agentId, agentName) {
  this.assignedTo = agentId;
  if (this.status === 'open') {
    this.status = 'in_progress';
  }
  
  // Добавляем внутренний комментарий о назначении
  this.comments.push({
    content: `Ticket assigned to ${agentName || agentId}`,
    authorId: 'system',
    authorName: 'System',
    isInternal: true
  });
  
  return this.save();
};

ticketSchema.methods.resolve = function(resolution, agentId, agentName) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolvedAt = new Date();
  this.assignedTo = this.assignedTo || agentId;
  
  // Добавляем комментарий о разрешении
  this.comments.push({
    content: `Ticket resolved: ${resolution}`,
    authorId: agentId || 'system',
    authorName: agentName || 'System',
    isInternal: false
  });
  
  // Вычисляем время разрешения
  if (this.createdAt && this.resolvedAt) {
    this.metadata.actualTime = Math.floor(
      (this.resolvedAt - this.createdAt) / (1000 * 60)
    );
  }
  
  return this.save();
};

ticketSchema.methods.close = function(resolution, agentId, agentName) {
  if (resolution) {
    this.resolution = resolution;
  }
  this.status = 'closed';
  if (!this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  
  // Добавляем комментарий о закрытии
  this.comments.push({
    content: `Ticket closed${resolution ? ': ' + resolution : ''}`,
    authorId: agentId || 'system',
    authorName: agentName || 'System',
    isInternal: false
  });
  
  return this.save();
};

ticketSchema.methods.addComment = function(comment) {
  this.comments.push(comment);
  
  // Обновляем время последнего ответа агента
  if (!comment.isInternal && comment.authorId !== this.userId) {
    this.lastAgentResponseAt = new Date();
    
    // Устанавливаем время первого ответа
    if (!this.firstResponseAt) {
      this.firstResponseAt = new Date();
    }
  }
  
  return this.save();
};

ticketSchema.methods.updatePriority = function(newPriority, reason, agentId) {
  const oldPriority = this.priority;
  this.priority = newPriority;
  
  // Добавляем внутренний комментарий об изменении приоритета
  this.comments.push({
    content: `Priority changed from ${oldPriority} to ${newPriority}. Reason: ${reason}`,
    authorId: agentId || 'system',
    authorName: 'System',
    isInternal: true
  });
  
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

ticketSchema.statics.findOverdue = function(slaHours = 24) {
  const cutoffDate = new Date(Date.now() - slaHours * 60 * 60 * 1000);
  return this.find({
    status: { $in: ['open', 'in_progress'] },
    createdAt: { $lt: cutoffDate },
    'sla.breached': { $ne: true }
  });
};

ticketSchema.statics.findByTicketId = function(ticketId) {
  return this.findOne({ ticketId }).populate('conversationId');
};

// Генерирует уникальный ticketId
ticketSchema.methods.generateTicketId = function() {
  const prefix = 'SHRM';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Проверяет SLA
ticketSchema.methods.checkSLA = function() {
  const now = new Date();
  const ageMinutes = (now - this.createdAt) / (1000 * 60);
  
  // Время ответа SLA (в минутах)
  const responseTimeSLA = this.priority === 'urgent' ? 15 : 
                         this.priority === 'high' ? 60 : 
                         this.priority === 'medium' ? 240 : 1440;
  
  // Время разрешения SLA (в минутах)
  const resolutionTimeSLA = this.priority === 'urgent' ? 120 : 
                           this.priority === 'high' ? 480 : 
                           this.priority === 'medium' ? 1440 : 2880;
  
  // Проверяем нарушение SLA
  if (!this.sla.breached && ageMinutes > responseTimeSLA) {
    this.sla.breached = true;
    this.sla.breachedAt = now;
    this.sla.responseTime = responseTimeSLA;
    this.sla.resolutionTime = resolutionTimeSLA;
  }
  
  return this.sla.breached;
};

// Middleware
ticketSchema.pre('save', function(next) {
  if (!this.ticketId && this.isNew) {
    this.ticketId = this.generateTicketId();
  }
  
  // Проверяем SLA при каждом обновлении
  if (this.isOpen && !this.sla.breached) {
    this.checkSLA();
  }
  
  next();
});

// Middleware для сортировки комментариев по дате
ticketSchema.pre('save', function(next) {
  if (this.comments && this.comments.length > 0) {
    this.comments.sort((a, b) => a.createdAt - b.createdAt);
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);