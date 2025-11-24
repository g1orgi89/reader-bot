/**
 * @fileoverview Follow model for user subscriptions in community
 * @author Reader Bot Team
 * 
 * This model manages user-to-user subscriptions (follows).
 * Similar pattern to Favorite.js for consistency.
 */

const mongoose = require('mongoose');

/**
 * Follow schema
 * Each document represents one user following another user
 */
const followSchema = new mongoose.Schema({
  followerId: {
    type: String,
    required: true,
    index: true
    // ID of the user who is following (subscriber)
  },
  followingId: {
    type: String,
    required: true,
    index: true
    // ID of the user being followed (target)
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Composite unique index to prevent duplicate follows
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Index for efficient "who follows this user" queries
followSchema.index({ followingId: 1, createdAt: -1 });

// Index for efficient "who does this user follow" queries
followSchema.index({ followerId: 1, createdAt: -1 });

/**
 * Follow a user (upsert - idempotent)
 * @param {string} followerId - ID of the user who wants to follow
 * @param {string} followingId - ID of the user to follow
 * @returns {Promise<Object>} The follow document
 * @throws {Error} If trying to follow self
 */
followSchema.statics.follow = async function(followerId, followingId) {
  // Validate: cannot follow yourself
  if (followerId === followingId) {
    const error = new Error('Cannot follow yourself');
    error.code = 'CANNOT_FOLLOW_SELF';
    throw error;
  }
  
  const result = await this.findOneAndUpdate(
    { followerId, followingId },
    { followerId, followingId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  
  return result;
};

/**
 * Unfollow a user
 * @param {string} followerId - ID of the user who wants to unfollow
 * @param {string} followingId - ID of the user to unfollow
 * @returns {Promise<Object|null>} Deleted follow document or null if not found
 */
followSchema.statics.unfollow = async function(followerId, followingId) {
  return this.findOneAndDelete({ followerId, followingId });
};

/**
 * Check if user A follows user B
 * @param {string} followerId - ID of the potential follower
 * @param {string} followingId - ID of the potential followed user
 * @returns {Promise<boolean>} True if following, false otherwise
 */
followSchema.statics.isFollowing = async function(followerId, followingId) {
  const exists = await this.exists({ followerId, followingId });
  return !!exists;
};

/**
 * Get follow statuses for multiple users at once (batch check)
 * @param {string} followerId - ID of the user checking follow status
 * @param {Array<string>} userIds - Array of user IDs to check
 * @returns {Promise<Map<string, boolean>>} Map of userId -> isFollowing
 */
followSchema.statics.getFollowStatuses = async function(followerId, userIds) {
  if (!userIds || userIds.length === 0) {
    return new Map();
  }
  
  const follows = await this.find({
    followerId,
    followingId: { $in: userIds }
  }, { followingId: 1 }).lean();
  
  const followingSet = new Set(follows.map(f => f.followingId));
  const statusMap = new Map();
  
  userIds.forEach(userId => {
    statusMap.set(userId, followingSet.has(userId));
  });
  
  return statusMap;
};

/**
 * Get list of users that a user follows (subscriptions)
 * @param {string} userId - ID of the user
 * @param {number} limit - Maximum number of results (default: 50)
 * @param {number} skip - Number of results to skip for pagination (default: 0)
 * @returns {Promise<Array>} Array of follow documents with followingId
 */
followSchema.statics.getFollowing = async function(userId, limit = 50, skip = 0) {
  return this.find({ followerId: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get list of users following a user (subscribers)
 * @param {string} userId - ID of the user
 * @param {number} limit - Maximum number of results (default: 50)
 * @param {number} skip - Number of results to skip for pagination (default: 0)
 * @returns {Promise<Array>} Array of follow documents with followerId
 */
followSchema.statics.getFollowers = async function(userId, limit = 50, skip = 0) {
  return this.find({ followingId: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get array of user IDs that a user follows
 * @param {string} userId - ID of the user
 * @returns {Promise<Array<string>>} Array of followingId strings
 */
followSchema.statics.getFollowingIds = async function(userId) {
  const follows = await this.find(
    { followerId: userId },
    { followingId: 1, _id: 0 }
  ).lean();
  
  return follows.map(f => f.followingId);
};

/**
 * Get array of user IDs that follow a user
 * @param {string} userId - ID of the user
 * @returns {Promise<Array<string>>} Array of followerId strings
 */
followSchema.statics.getFollowerIds = async function(userId) {
  const followers = await this.find(
    { followingId: userId },
    { followerId: 1, _id: 0 }
  ).lean();
  
  return followers.map(f => f.followerId);
};

/**
 * Count how many users a user follows
 * @param {string} userId - ID of the user
 * @returns {Promise<number>} Count of following
 */
followSchema.statics.countFollowing = async function(userId) {
  return this.countDocuments({ followerId: userId });
};

/**
 * Count how many users follow a user
 * @param {string} userId - ID of the user
 * @returns {Promise<number>} Count of followers
 */
followSchema.statics.countFollowers = async function(userId) {
  return this.countDocuments({ followingId: userId });
};

/**
 * Get follow counts for a user (both directions)
 * @param {string} userId - ID of the user
 * @returns {Promise<{following: number, followers: number}>} Counts object
 */
followSchema.statics.getCounts = async function(userId) {
  const [following, followers] = await Promise.all([
    this.countDocuments({ followerId: userId }),
    this.countDocuments({ followingId: userId })
  ]);
  
  return { following, followers };
};

const Follow = mongoose.model('Follow', followSchema);

module.exports = Follow;
