/**
 * Purchase Model - tracks payment and purchase events
 * @file server/models/Purchase.js
 */

const mongoose = require('mongoose');

/**
 * Schema for purchased items
 */
const purchaseItemSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['audio', 'package', 'subscription'],
    required: true
    // Type of item purchased
  },
  resourceId: {
    type: String,
    required: true
    // Identifier of the purchased resource
  },
  price: {
    type: Number,
    default: 0
    // Price paid for this item
  },
  currency: {
    type: String,
    default: 'USD'
    // Currency used
  }
}, { _id: false });

/**
 * Schema for purchase records
 */
const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    required: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    enum: ['stripe', 'telegram-stars', 'promo-code', 'admin', 'other'],
    default: 'other'
    // Source of the purchase/grant
  },
  externalPaymentId: {
    type: String,
    default: null,
    index: true
    // External payment ID from payment provider (e.g., Stripe charge ID)
  },
  eventId: {
    type: String,
    default: null,
    unique: true,
    sparse: true
    // Event ID for idempotency (prevents duplicate processing)
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    default: 0
    // Total amount paid
  },
  currency: {
    type: String,
    default: 'USD'
    // Currency used for payment
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
    // Purchase status
  },
  rawPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Raw webhook/payment data for debugging
  },
  processedAt: {
    type: Date,
    default: Date.now
    // When this purchase was processed
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Additional metadata
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
purchaseSchema.index({ userId: 1, createdAt: -1 });
purchaseSchema.index({ source: 1, status: 1 });

/**
 * Record a new purchase
 * @param {Object} data - Purchase data
 * @param {mongoose.Types.ObjectId} data.userId - User ID
 * @param {string} data.source - Purchase source
 * @param {Array} data.items - Purchased items
 * @param {number} data.totalAmount - Total amount
 * @param {string} data.currency - Currency
 * @param {Object} options - Optional parameters
 * @param {string} options.externalPaymentId - External payment ID
 * @param {string} options.eventId - Event ID for idempotency
 * @param {Object} options.rawPayload - Raw payment data
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created purchase record
 */
purchaseSchema.statics.recordPurchase = async function(data, options = {}) {
  // Check for duplicate event ID (idempotency)
  if (options.eventId) {
    const existing = await this.findOne({ eventId: options.eventId });
    if (existing) {
      return existing; // Already processed
    }
  }

  const purchase = new this({
    userId: data.userId,
    source: data.source,
    items: data.items,
    totalAmount: data.totalAmount || 0,
    currency: data.currency || 'USD',
    status: data.status || 'completed',
    externalPaymentId: options.externalPaymentId || null,
    eventId: options.eventId || null,
    rawPayload: options.rawPayload || {},
    metadata: options.metadata || {}
  });
  
  return await purchase.save();
};

/**
 * Get user's purchase history
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Limit results
 * @param {number} options.skip - Skip results
 * @returns {Promise<Array>} Array of purchases
 */
purchaseSchema.statics.getUserPurchases = async function(userId, options = {}) {
  const query = this.find({ userId, status: 'completed' })
    .sort({ createdAt: -1 });
  
  if (options.limit) {
    query.limit(options.limit);
  }
  if (options.skip) {
    query.skip(options.skip);
  }
  
  return await query.exec();
};

/**
 * Get purchase by external payment ID
 * @param {string} externalPaymentId - External payment ID
 * @returns {Promise<Object|null>} Purchase record or null
 */
purchaseSchema.statics.findByExternalId = async function(externalPaymentId) {
  return await this.findOne({ externalPaymentId });
};

/**
 * Mark purchase as refunded
 * @param {string} purchaseId - Purchase ID
 * @returns {Promise<Object>} Updated purchase
 */
purchaseSchema.statics.markAsRefunded = async function(purchaseId) {
  return await this.findByIdAndUpdate(
    purchaseId,
    { status: 'refunded' },
    { new: true }
  );
};

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;
