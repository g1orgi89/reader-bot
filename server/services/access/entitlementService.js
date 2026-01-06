/**
 * Entitlement Service - manages user access rights
 * @file server/services/access/entitlementService.js
 */

const UserEntitlement = require('../../models/UserEntitlement');
const logger = require('../../utils/logger');

/**
 * Check if user has access to a specific audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<boolean>} True if user has access
 */
async function hasAudioAccess(userId, audioId) {
  try {
    // Check for direct audio entitlement
    const hasDirectAccess = await UserEntitlement.hasAccess(userId, 'audio', audioId);
    
    if (hasDirectAccess) {
      logger.info(`✅ User ${userId} has direct access to audio ${audioId}`);
      return true;
    }

    // In the future, check for package or subscription access
    // For now, we only check direct audio entitlements
    
    logger.info(`❌ User ${userId} does not have access to audio ${audioId}`);
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
  grantPackage,
  grantSubscription
};
