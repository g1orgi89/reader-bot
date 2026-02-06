/**
 * Shared userId resolution utility
 * Converts 'me', Telegram ID, or ObjectId string to MongoDB ObjectId
 * @file server/services/access/resolveUserId.js
 */

const mongoose = require('mongoose');
const UserProfile = require('../../models/userProfile');
const logger = require('../../utils/logger');

/**
 * Resolve various userId formats to MongoDB ObjectId
 * Handles:
 * - "me" -> looks up from context (NOT IMPLEMENTED - requires auth context)
 * - Valid ObjectId string -> converts to ObjectId
 * - Telegram numeric ID string -> looks up UserProfile by userId field
 * 
 * @param {string|number} rawUserId - Raw user ID in any format
 * @returns {Promise<mongoose.Types.ObjectId|null>} MongoDB ObjectId or null if not found
 */
async function resolveUserObjectId(rawUserId) {
  if (!rawUserId) {
    logger.warn('resolveUserObjectId called with empty userId');
    return null;
  }

  const userIdStr = String(rawUserId);

  // Handle "me" special case
  // Note: "me" requires auth context from request which we don't have here
  // Callers should resolve "me" to actual userId before calling this function
  if (userIdStr === 'me') {
    logger.warn('resolveUserObjectId called with "me" - caller should resolve to actual userId first');
    return null;
  }

  // If already a valid ObjectId, return it
  if (mongoose.Types.ObjectId.isValid(userIdStr)) {
    try {
      return new mongoose.Types.ObjectId(userIdStr);
    } catch (error) {
      logger.error(`Error creating ObjectId from ${userIdStr}:`, error);
      return null;
    }
  }

  // Otherwise, try to find user by Telegram userId in UserProfile
  try {
    const userProfile = await UserProfile.findOne({ userId: userIdStr }).select('_id');
    if (userProfile) {
      logger.debug(`Resolved Telegram ID ${userIdStr} to ObjectId ${userProfile._id}`);
      return userProfile._id;
    }
    
    logger.warn(`User not found for userId: ${userIdStr}`);
    return null;
  } catch (error) {
    logger.error(`Error resolving user ID ${userIdStr}:`, error);
    return null;
  }
}

module.exports = {
  resolveUserObjectId
};
