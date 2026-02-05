/**
 * Badges Service - manages gamification badges and progress
 * @file server/services/gamification/badgesService.js
 */

const mongoose = require('mongoose');
const PhotoPost = require('../../models/PhotoPost');
const Follow = require('../../models/Follow');
const Favorite = require('../../models/Favorite');
const Quote = require('../../models/quote');
const UserProfile = require('../../models/userProfile');
const entitlementService = require('../access/entitlementService');
const logger = require('../../utils/logger');

// Constants
const MAX_STREAK_CHECK_DAYS = 60; // Maximum days to check for streak calculation

/**
 * Resolve Telegram userId to MongoDB ObjectId
 * @param {string|number} rawUserId - Raw user ID (can be ObjectId string or Telegram numeric ID)
 * @returns {Promise<mongoose.Types.ObjectId|null>} MongoDB ObjectId or null if not found
 */
async function resolveUserObjectId(rawUserId) {
  if (!rawUserId) {
    return null;
  }

  const userIdStr = String(rawUserId);

  // If already a valid ObjectId, return it
  if (mongoose.Types.ObjectId.isValid(userIdStr)) {
    return new mongoose.Types.ObjectId(userIdStr);
  }

  // Otherwise, try to find user by Telegram userId in UserProfile
  try {
    const userProfile = await UserProfile.findOne({ userId: userIdStr });
    if (userProfile) {
      return userProfile._id;
    }
    
    logger.warn(`User not found for userId: ${userIdStr}`);
    return null;
  } catch (error) {
    logger.error(`Error resolving user ID:`, error);
    return null;
  }
}

/**
 * Count photos in "книжный кадр" rubric for a user
 * TODO: Confirm exact rubric field name and value in PhotoPost model
 * @param {string} userId - Telegram user ID
 * @returns {Promise<number>} Count of photos
 */
async function countBookFramePhotos(userId) {
  try {
    // TODO: PhotoPost model needs a rubric/tag field
    // For now, count all user's published photos as placeholder
    // Once rubric field is added, update query to: { userId, rubric: 'книжный кадр', status: 'published' }
    const count = await PhotoPost.countDocuments({
      userId,
      status: 'published'
      // TODO: Add filter: rubric: 'книжный кадр' once field exists
    });
    
    return count;
  } catch (error) {
    logger.error(`Error counting book frame photos for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Count follows (subscriptions) for a user
 * @param {string} userId - Telegram user ID
 * @returns {Promise<number>} Count of follows
 */
async function countFollows(userId) {
  try {
    const count = await Follow.countFollowing(userId);
    return count;
  } catch (error) {
    logger.error(`Error counting follows for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Count likes given to quotes authored by other users
 * @param {string} userId - Telegram user ID
 * @returns {Promise<number>} Count of likes to others' quotes
 */
async function countLikesGivenToOthers(userId) {
  try {
    // Get all favorites by this user
    const favorites = await Favorite.find({ userId }).lean();
    
    if (favorites.length === 0) {
      return 0;
    }

    // Split normalizedKey into normalizedText and normalizedAuthor
    // normalizedKey format: "normalizedText|||normalizedAuthor"
    const favoriteKeys = favorites.map(f => {
      const parts = f.normalizedKey.split('|||');
      return {
        normalizedText: parts[0] || '',
        normalizedAuthor: parts[1] || ''
      };
    });

    // Find quotes with matching normalized fields NOT authored by this user
    // We need to match on both normalizedText AND normalizedAuthor
    const matchedQuotes = await Quote.find({
      userId: { $ne: userId },
      $or: favoriteKeys.map(key => ({
        normalizedText: key.normalizedText,
        normalizedAuthor: key.normalizedAuthor
      }))
    }).select('normalizedText normalizedAuthor').lean();

    // Create a Set of unique quote keys from matched quotes
    const matchedKeys = new Set(
      matchedQuotes.map(q => `${q.normalizedText}|||${q.normalizedAuthor}`)
    );

    // Count how many of user's favorites match quotes from others
    const likesCount = favorites.filter(f => matchedKeys.has(f.normalizedKey)).length;
    
    return likesCount;
  } catch (error) {
    logger.error(`Error counting likes to others for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Calculate activity streak - consecutive days ending today with at least one activity
 * An activity day is one where the user: posted a photo, saved a quote, liked, or followed
 * Uses UTC for consistent timezone handling
 * @param {string} userId - Telegram user ID
 * @returns {Promise<number>} Number of consecutive days
 */
async function calculateStreak(userId) {
  try {
    // Use UTC to avoid timezone issues
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    
    // We'll check day by day going backwards from today
    let streak = 0;
    let currentDate = new Date(todayUTC);
    
    // Check up to MAX_STREAK_CHECK_DAYS (reasonable limit to avoid infinite loop)
    for (let i = 0; i < MAX_STREAK_CHECK_DAYS; i++) {
      const dayStart = new Date(currentDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setUTCHours(23, 59, 59, 999);
      
      // Check for any activity on this day
      const hasActivity = await checkActivityOnDay(userId, dayStart, dayEnd);
      
      if (hasActivity) {
        streak++;
        // Move to previous day
        currentDate.setUTCDate(currentDate.getUTCDate() - 1);
      } else {
        // Streak broken
        break;
      }
    }
    
    return streak;
  } catch (error) {
    logger.error(`Error calculating streak for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Check if user had any activity on a specific day
 * @param {string} userId - Telegram user ID
 * @param {Date} dayStart - Start of day
 * @param {Date} dayEnd - End of day
 * @returns {Promise<boolean>} True if user had activity
 */
async function checkActivityOnDay(userId, dayStart, dayEnd) {
  try {
    // Check for photo post
    const photoCount = await PhotoPost.countDocuments({
      userId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (photoCount > 0) return true;

    // Check for quote saved
    const quoteCount = await Quote.countDocuments({
      userId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (quoteCount > 0) return true;

    // Check for like given
    const likeCount = await Favorite.countDocuments({
      userId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (likeCount > 0) return true;

    // Check for follow
    const followCount = await Follow.countDocuments({
      followerId: userId,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (followCount > 0) return true;

    return false;
  } catch (error) {
    logger.error(`Error checking activity for day:`, error);
    return false;
  }
}

/**
 * Get Alice badge progress for a user
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object>} Progress object with counts and completion status
 */
async function getAliceProgress(userId) {
  try {
    logger.info(`📊 Computing Alice badge progress for user ${userId}...`);
    
    // Compute all progress metrics in parallel
    const [photos, following, likesGivenToOthers, streak] = await Promise.all([
      countBookFramePhotos(userId),
      countFollows(userId),
      countLikesGivenToOthers(userId),
      calculateStreak(userId)
    ]);

    // Define requirements
    const requirements = {
      photos: { current: photos, required: 10 },
      following: { current: following, required: 5 },
      likesGivenToOthers: { current: likesGivenToOthers, required: 10 },
      streak: { current: streak, required: 30 }
    };

    // Check if all requirements are met
    const completed = 
      photos >= 10 &&
      following >= 5 &&
      likesGivenToOthers >= 10 &&
      streak >= 30;

    // Calculate overall percentage (0-100)
    const photosPercent = Math.min((photos / 10) * 100, 100);
    const followingPercent = Math.min((following / 5) * 100, 100);
    const likesPercent = Math.min((likesGivenToOthers / 10) * 100, 100);
    const streakPercent = Math.min((streak / 30) * 100, 100);
    const percent = Math.round((photosPercent + followingPercent + likesPercent + streakPercent) / 4);

    const progress = {
      ...requirements,
      completed,
      percent
    };

    logger.info(`✅ Alice progress computed:`, progress);
    return progress;
  } catch (error) {
    logger.error(`❌ Error getting Alice progress for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Claim Alice badge - grant 30-day audio access to alice_wonderland
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object>} Result with success flag and details
 */
async function claimAlice(userId) {
  try {
    logger.info(`🎁 Processing Alice badge claim for user ${userId}...`);
    
    // First, check if user has completed all requirements
    const progress = await getAliceProgress(userId);
    
    if (!progress.completed) {
      logger.warn(`❌ User ${userId} has not completed Alice requirements`);
      return {
        success: false,
        error: 'Requirements not met',
        progress
      };
    }

    // Resolve to MongoDB ObjectId for entitlement service
    const userObjectId = await resolveUserObjectId(userId);
    if (!userObjectId) {
      logger.error(`❌ Could not resolve user ${userId} to ObjectId`);
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Check if user already has the entitlement
    const hasAccess = await entitlementService.hasAudioAccess(userObjectId, 'alice_wonderland');
    
    if (hasAccess) {
      logger.info(`✅ User ${userId} already has Alice entitlement (idempotent)`);
      return {
        success: true,
        message: 'Badge already claimed',
        alreadyClaimed: true
      };
    }

    // Grant 30-day access to alice_wonderland audio
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await entitlementService.grantAudio(userObjectId, 'alice_wonderland', {
      expiresAt,
      grantedBy: 'alice_badge',
      metadata: {
        badge: 'alice',
        claimedAt: new Date(),
        progress: {
          photos: progress.photos.current,
          following: progress.following.current,
          likesGivenToOthers: progress.likesGivenToOthers.current,
          streak: progress.streak.current
        }
      }
    });

    logger.info(`✅ Alice badge claimed successfully for user ${userId}`);

    // TODO: Optional - Send Telegram notification via notificationService
    // For now, just log it
    logger.info(`🔔 TODO: Send Telegram notification to user ${userId} about Alice badge`);

    return {
      success: true,
      message: 'Badge claimed successfully',
      expiresAt
    };
  } catch (error) {
    logger.error(`❌ Error claiming Alice badge for user ${userId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to claim badge'
    };
  }
}

module.exports = {
  getAliceProgress,
  claimAlice,
  // Export helpers for testing
  countBookFramePhotos,
  countFollows,
  countLikesGivenToOthers,
  calculateStreak
};
