/**
 * User Entitlement Model - manages user access rights to content
 * @file server/models/UserEntitlement.js
 */

const mongoose = require('mongoose');

/**
 * Schema for user entitlements (access rights)
 */
const userEntitlementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    required: true,
    index: true
  },
  kind: {
    type: String,
    enum: ['audio', 'package', 'subscription'],
    required: true
    // Type of entitlement: individual audio, package of content, or subscription
  },
  resourceId: {
    type: String,
    required: true
    // Identifier of the resource (audioId, packageId, subscriptionId)
  },
  expiresAt: {
    type: Date,
    default: null
    // Expiration date (null = never expires)
  },
  grantedAt: {
    type: Date,
    default: Date.now
    // When this entitlement was granted
  },
  grantedBy: {
    type: String,
    default: 'system'
    // Who/what granted this entitlement (system, admin, purchase, etc.)
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Additional metadata (purchase info, promo code, etc.)
  }
}, {
  timestamps: true
});

// Compound index for fast lookups
userEntitlementSchema.index({ userId: 1, kind: 1, resourceId: 1 });
userEntitlementSchema.index({ expiresAt: 1 }); // For cleanup of expired entitlements

/**
 * Check if entitlement is currently valid (not expired)
 * @returns {boolean} True if valid
 */
userEntitlementSchema.methods.isValid = function() {
  if (!this.expiresAt) {
    return true; // Never expires
  }
  return new Date() < this.expiresAt;
};

/**
 * Grant an entitlement to a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} kind - Entitlement kind
 * @param {string} resourceId - Resource identifier
 * @param {Object} options - Optional parameters
 * @param {Date} options.expiresAt - Expiration date
 * @param {string} options.grantedBy - Who granted this
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created entitlement
 */
userEntitlementSchema.statics.grant = async function(userId, kind, resourceId, options = {}) {
  const entitlement = new this({
    userId,
    kind,
    resourceId,
    expiresAt: options.expiresAt || null,
    grantedBy: options.grantedBy || 'system',
    metadata: options.metadata || {}
  });
  
  return await entitlement.save();
};

/**
 * Revoke an entitlement
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} kind - Entitlement kind
 * @param {string} resourceId - Resource identifier
 * @returns {Promise<Object>} Delete result
 */
userEntitlementSchema.statics.revoke = async function(userId, kind, resourceId) {
  return await this.deleteOne({ userId, kind, resourceId });
};

/**
 * Check if user has valid entitlement
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} kind - Entitlement kind
 * @param {string} resourceId - Resource identifier
 * @returns {Promise<boolean>} True if user has valid entitlement
 */
userEntitlementSchema.statics.hasAccess = async function(userId, kind, resourceId) {
  const entitlement = await this.findOne({ userId, kind, resourceId });
  
  if (!entitlement) {
    return false;
  }
  
  return entitlement.isValid();
};

/**
 * Get all valid entitlements for a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} kind - Optional: filter by kind
 * @returns {Promise<Array>} Array of valid entitlements
 */
userEntitlementSchema.statics.getUserEntitlements = async function(userId, kind = null) {
  const query = { userId };
  if (kind) {
    query.kind = kind;
  }
  
  const entitlements = await this.find(query);
  
  // Filter only valid (non-expired) entitlements
  return entitlements.filter(e => e.isValid());
};

/**
 * Clean up expired entitlements
 * @returns {Promise<Object>} Delete result
 */
userEntitlementSchema.statics.cleanupExpired = async function() {
  return await this.deleteMany({
    expiresAt: { $ne: null, $lt: new Date() }
  });
};

const UserEntitlement = mongoose.model('UserEntitlement', userEntitlementSchema);

module.exports = UserEntitlement;
