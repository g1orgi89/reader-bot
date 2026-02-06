/**
 * User ID Resolver - converts raw user identifiers to MongoDB ObjectId
 * @file server/services/access/resolveUserId.js
 */

const mongoose = require('mongoose');
const UserProfile = require('../../models/userProfile');
const logger = require('../../utils/logger');

/**
 * Resolve raw user identifier to MongoDB ObjectId
 * Handles:
 * - ObjectId strings
 * - Telegram numeric IDs (as strings or numbers)
 * - Special values like 'me' (lookup via UserProfile)
 * 
 * @param {string|number} rawUserId - Raw user ID (can be ObjectId string, Telegram numeric ID, or 'me')
 * @returns {Promise<mongoose.Types.ObjectId|null>} MongoDB ObjectId or null if not found
 */
async function resolveUserObjectId(rawUserId) {
  if (!rawUserId) {
    return null;
  }

  const userIdStr = String(rawUserId);

  // If already a valid ObjectId, return it
  if (mongoose.Types.ObjectId.isValid(userIdStr) && userIdStr.length === 24) {
    return new mongoose.Types.ObjectId(userIdStr);
  }

  // Otherwise, try to find user by Telegram userId in UserProfile
  try {
    const userProfile = await UserProfile.findOne({ userId: userIdStr }).lean();
    if (userProfile) {
      logger.debug(`Resolved user ID ${userIdStr} to ObjectId: ${userProfile._id}`);
      return userProfile._id;
    }
    
    logger.warn(`User not found for userId: ${userIdStr}`);
    return null;
  } catch (error) {
    logger.error(`Error resolving user ID:`, error);
    return null;
  }
}

module.exports = {
  resolveUserObjectId
};
