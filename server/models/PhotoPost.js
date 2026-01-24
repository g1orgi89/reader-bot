/**
 * @fileoverview Photo Post model for Covers feature
 * @description Posts containing 1 photo per user per day with caption and comments
 */

const mongoose = require('mongoose');

/**
 * Photo Post Schema
 * Each document represents one photo post in the Covers feed
 */
const photoPostSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
    // Telegram user ID who posted the photo
  },
  imageUrl: {
    type: String,
    required: true
    // URL to the uploaded photo (relative path: /uploads/covers/filename.jpg)
  },
  thumbUrl: {
    type: String
    // Optional thumbnail URL for performance
  },
  caption: {
    type: String,
    maxlength: 300,
    trim: true,
    default: ''
    // Photo caption (max 300 chars)
  },
  dayKey: {
    type: String,
    required: true,
    index: true
    // Date key in format YYYY-MM-DD (Europe/Moscow timezone)
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true
    // Whether this post is pinned (Anna's "start of day")
  },
  status: {
    type: String,
    enum: ['published', 'hidden'],
    default: 'published',
    index: true
    // Post status
  },
  likesCount: {
    type: Number,
    default: 0
    // Number of likes on this post
  },
  likedBy: {
    type: [String],
    default: []
    // Array of userIds who liked this post
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Composite unique index: one photo per user per day
photoPostSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

// Partial unique index: only one pinned post per day
photoPostSchema.index(
  { dayKey: 1, isPinned: 1 },
  { 
    unique: true,
    partialFilterExpression: { isPinned: true }
  }
);

// Index for feed queries (pinned first, then by creation time)
photoPostSchema.index({ status: 1, isPinned: -1, createdAt: -1 });

// Index for user's posts
photoPostSchema.index({ userId: 1, createdAt: -1 });

/**
 * Create a new photo post
 * @param {Object} postData - Post data
 * @returns {Promise<Object>} Created post
 */
photoPostSchema.statics.createPost = async function(postData) {
  const post = new this(postData);
  return post.save();
};

/**
 * Get pinned post for a specific day
 * @param {string} dayKey - Day key (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Pinned post or null
 */
photoPostSchema.statics.getPinnedForDay = async function(dayKey) {
  return this.findOne({ dayKey, isPinned: true, status: 'published' }).lean();
};

/**
 * Unpin all posts for a specific day
 * @param {string} dayKey - Day key (YYYY-MM-DD)
 * @returns {Promise<Object>} Update result
 */
photoPostSchema.statics.unpinAllForDay = async function(dayKey) {
  return this.updateMany(
    { dayKey, isPinned: true },
    { $set: { isPinned: false } }
  );
};

/**
 * Pin a specific post (unpins others for the same day)
 * @param {string} postId - Post ID to pin
 * @returns {Promise<Object>} Updated post
 */
photoPostSchema.statics.pinPost = async function(postId) {
  const post = await this.findById(postId);
  if (!post) {
    throw new Error('Post not found');
  }
  
  // Unpin all posts for the same day
  await this.unpinAllForDay(post.dayKey);
  
  // Pin this post
  post.isPinned = true;
  return post.save();
};

/**
 * Count comments for a post
 * @param {string} postId - Post ID
 * @returns {Promise<number>} Number of comments
 */
photoPostSchema.methods.getCommentsCount = async function() {
  const PhotoComment = mongoose.model('PhotoComment');
  return PhotoComment.countDocuments({ postId: this._id });
};

const PhotoPost = mongoose.model('PhotoPost', photoPostSchema);

module.exports = PhotoPost;
