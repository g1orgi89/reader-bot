/**
 * Ticket model for Shrooms Support Bot
 * @file server/models/ticket.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * @typedef {import('../types/index.js').TicketType} TicketType
 */

/**
 * Ticket schema definition
 */
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    index: true
    // Removed required: true - будет генерироваться автоматически в pre-save
  },
  userId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
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
    enum: ['technical', 'account', 'billing', 'feature', 'other'],
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
    maxlength: 2000
  },
  context: {
    type: String,
    maxlength: 5000
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  assignedTo: {
    type: String,
    trim: true,
    index: true
  },
  resolution: {
    type: String,
    maxlength: 2000
  },
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    default: 'en',
    index: true
  },
  resolvedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
ticketSchema.index({ status: 1, priority: -1, createdAt: 1 });
ticketSchema.index({ assignedTo: 1, status: 1, priority: -1 });
ticketSchema.index({ category: 1, status: 1, createdAt: -1 });

// Virtual for getting associated conversation
ticketSchema.virtual('conversation', {
  ref: 'Conversation',
  localField: 'conversationId',
  foreignField: '_id',
  justOne: true
});

// Virtual for days since creation
ticketSchema.virtual('daysOpen').get(function() {
  if (this.status === 'resolved' || this.status === 'closed') {
    const endDate = this.resolvedAt || this.updatedAt;
    return Math.ceil((endDate - this.createdAt) / (1000 * 60 * 60 * 24));
  }
  return Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

/**
 * Generate a unique ticket ID
 * @returns {string} Unique ticket ID
 */
function generateTicketId() {
  const prefix = 'SHR';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Pre-save middleware to generate ticket ID
 */
ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketId) {
    let ticketId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    // Пытаемся сгенерировать уникальный ID, если текущий уже существует
    while (!isUnique && attempts < maxAttempts) {
      ticketId = generateTicketId();
      
      try {
        const existingTicket = await this.constructor.findOne({ ticketId }, { _id: 1 }).lean();
        isUnique = !existingTicket;
        attempts++;
        
        if (!isUnique && attempts >= maxAttempts) {
          return next(new Error('Failed to generate unique ticket ID after multiple attempts'));
        }
      } catch (error) {
        return next(error);
      }
    }
    
    this.ticketId = ticketId;
  }
  next();
});

/**
 * Pre-save middleware to set resolvedAt timestamp
 */
ticketSchema.pre('save', function(next) {
  if (this.isModified('status') && 
      (this.status === 'resolved' || this.status === 'closed') && 
      !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

/**
 * Instance method to update status
 * @param {string} newStatus - New ticket status
 * @param {string} [assignedTo] - Optional assignee
 * @returns {Promise<TicketType>} Updated ticket
 */
ticketSchema.methods.updateStatus = function(newStatus, assignedTo = null) {
  this.status = newStatus;
  if (assignedTo) {
    this.assignedTo = assignedTo;
  }
  return this.save();
};

/**
 * Instance method to resolve ticket
 * @param {string} resolution - Resolution text
 * @param {string} [resolvedBy] - Who resolved the ticket
 * @returns {Promise<TicketType>} Updated ticket
 */
ticketSchema.methods.resolve = function(resolution, resolvedBy = null) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolvedAt = new Date();
  if (resolvedBy) {
    this.assignedTo = resolvedBy;
  }
  return this.save();
};

/**
 * Instance method to close ticket
 * @returns {Promise<TicketType>} Updated ticket
 */
ticketSchema.methods.close = function() {
  this.status = 'closed';
  if (!this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  return this.save();
};

/**
 * Instance method to format ticket for API response
 * @returns {Object} Formatted ticket object
 */
ticketSchema.methods.toApiResponse = function() {
  return {
    id: this._id,
    ticketId: this.ticketId,
    userId: this.userId,
    conversationId: this.conversationId,
    status: this.status,
    priority: this.priority,
    category: this.category,
    subject: this.subject,
    initialMessage: this.initialMessage,
    context: this.context,
    email: this.email,
    assignedTo: this.assignedTo,
    resolution: this.resolution,
    language: this.language,
    daysOpen: this.daysOpen,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    resolvedAt: this.resolvedAt
  };
};

/**
 * Static method to find tickets with pagination
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.sort='-createdAt'] - Sort field
 * @returns {Promise<Object>} Paginated results
 */
ticketSchema.statics.findWithPagination = async function(filter = {}, options = {}) {
  const { page = 1, limit = 20, sort = '-createdAt' } = options;
  const skip = (page - 1) * limit;
  
  const [tickets, total] = await Promise.all([
    this.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);
  
  return {
    tickets,
    total,
    page,
    pages: Math.ceil(total / limit),
    hasMore: skip + tickets.length < total
  };
};

/**
 * Static method to get tickets by status
 * @param {string} status - Ticket status
 * @param {Object} options - Query options
 * @returns {Promise<Array<TicketType>>} Array of tickets
 */
ticketSchema.statics.findByStatus = function(status, options = {}) {
  const { limit = 50, assignedTo } = options;
  const query = { status };
  
  if (assignedTo) {
    query.assignedTo = assignedTo;
  }
  
  return this.find(query)
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .lean();
};

/**
 * Static method to get ticket statistics
 * @returns {Promise<Object>} Ticket statistics
 */
ticketSchema.statics.getStatistics = async function() {
  const [statusStats, categoryStats, priorityStats] = await Promise.all([
    this.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ])
  ]);
  
  return {
    byStatus: statusStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byCategory: categoryStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byPriority: priorityStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
};

/**
 * Model for Ticket documents
 * @type {mongoose.Model<TicketType>}
 */
const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;