/**
 * Entitlement Service - manages user access rights
 * @file server/services/access/entitlementService.js
 */

const UserEntitlement = require('../../models/UserEntitlement');
const logger = require('../../utils/logger');

/**
 * Normalize track IDs by removing track number suffix
 * @param {string} audioId - Audio identifier (e.g., "container-01")
 * @returns {string} Base container ID (e.g., "container")
 */
function normalizeAudioId(audioId) {
  const m = String(audioId).match(/^(.+)-(\d+)$/);
  return m ? m[1] : String(audioId);
}

// Aliases: allow badges to grant access to containers
// Key = base container ID; Values = entitlement resource IDs considered valid
const ENTITLEMENT_ALIASES = {
  // Alice gated content: badge grants access to the container
  alice_wonderland: ['alice_wonderland', 'alice_badge']
};

/**
 * Check if user has access to a specific audio or its aliases
 * Accepts container IDs and track IDs; track IDs are normalized to container
 * @param {mongoose.Types.ObjectId|string} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<boolean>} True if user has access
 */
async function hasAudioAccess(userId, audioId) {
  try {
    const baseId = normalizeAudioId(audioId);
    const candidates = ENTITLEMENT_ALIASES[baseId] || [baseId];

    for (const id of candidates) {
      const ok = await UserEntitlement.hasAccess(userId, 'audio', id);
      if (ok) {
        logger.info(`✅ User ${userId} has access via entitlement '${id}' (requested='${audioId}', base='${baseId}')`);
        return true;
      }
    }

    logger.info(`❌ User ${userId} does not have access (requested='${audioId}', base='${baseId}', checked=${candidates.join(',')})`);
    return false;
  } catch (error) {
    logger.error(`❌ Error checking audio access for user ${userId}:`, error);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Grant audio access to a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @param {Object} options - Optional parameters
 * @param {Date} options.expiresAt - Expiration date
 * @param {string} options.grantedBy - Who granted this access
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created entitlement
 */
async function grantAudio(userId, audioId, options = {}) {
  try {
    const entitlement = await UserEntitlement.grant(userId, 'audio', audioId, options);
    logger.info(`✅ Granted audio ${audioId} to user ${userId}`, {
      expiresAt: options.expiresAt,
      grantedBy: options.grantedBy
    });
    return entitlement;
  } catch (error) {
    logger.error(`❌ Error granting audio ${audioId} to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Revoke audio access from a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<Object>} Delete result
 */
async function revokeAudio(userId, audioId) {
  try {
    const result = await UserEntitlement.revoke(userId, 'audio', audioId);
    logger.info(`✅ Revoked audio ${audioId} from user ${userId}`);
    return result;
  } catch (error) {
    logger.error(`❌ Error revoking audio ${audioId} from user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get all audio entitlements for a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of audio entitlements
 */
async function getUserAudioEntitlements(userId) {
  try {
    const entitlements = await UserEntitlement.getUserEntitlements(userId, 'audio');
    logger.info(`📚 Found ${entitlements.length} audio entitlement(s) for user ${userId}`);
    return entitlements;
  } catch (error) {
    logger.error(`❌ Error getting audio entitlements for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get remaining days for an audio entitlement
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<number|null>} Remaining days (rounded up), null if no entitlement or expired
 */
async function getRemainingDays(userId, audioId) {
  try {
    const entitlement = await UserEntitlement.findOne({ 
      userId, 
      kind: 'audio', 
      resourceId: audioId 
    });
    
    if (!entitlement) {
      return null;
    }
    
    // Check if entitlement is still valid
    if (!entitlement.isValid()) {
      return null;
    }
    
    // If no expiration date, it never expires (return a large number or special value)
    if (!entitlement.expiresAt) {
      return -1; // -1 indicates "never expires"
    }
    
    // Calculate remaining days (ceil to round up)
    const now = new Date();
    const msRemaining = entitlement.expiresAt - now;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysRemaining);
  } catch (error) {
    logger.error(`❌ Error getting remaining days for audio ${audioId}:`, error);
    return null;
  }
}

/**
 * Grant package access to a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} packageId - Package identifier
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} Created entitlement
 */
async function grantPackage(userId, packageId, options = {}) {
  try {
    const entitlement = await UserEntitlement.grant(userId, 'package', packageId, options);
    logger.info(`✅ Granted package ${packageId} to user ${userId}`);
    return entitlement;
  } catch (error) {
    logger.error(`❌ Error granting package ${packageId} to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Grant subscription access to a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} subscriptionId - Subscription identifier
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} Created entitlement
 */
async function grantSubscription(userId, subscriptionId, options = {}) {
  try {
    const entitlement = await UserEntitlement.grant(userId, 'subscription', subscriptionId, options);
    logger.info(`✅ Granted subscription ${subscriptionId} to user ${userId}`);
    return entitlement;
  } catch (error) {
    logger.error(`❌ Error granting subscription ${subscriptionId} to user ${userId}:`, error);
    throw error;
  }
}

module.exports = {
  hasAudioAccess,
  grantAudio,
  revokeAudio,
  getUserAudioEntitlements,
  getRemainingDays,
  grantPackage,
  grantSubscription
};
