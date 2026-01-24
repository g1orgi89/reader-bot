/**
 * @fileoverview Photo Comment model for Covers feature
 * @description Comments on photo posts
 */

const mongoose = require('mongoose');

/**
 * Photo Comment Schema
 * Each document represents one comment on a photo post
 */
const photoCommentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PhotoPost',
    required: true,
    index: true
    // Reference to the photo post
  },
  userId: {
    type: String,
    required: true,
    index: true
    // Telegram user ID who wrote the comment
  },
  text: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
    // Comment text (max 500 chars)
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PhotoComment',
    default: null,
    index: true
    // Reference to parent comment for replies (null for top-level comments)
  },
  likesCount: {
    type: Number,
    default: 0,
    min: 0
    // Number of likes on this comment
  },
  likedBy: {
    type: [String],
    default: []
    // Array of userId strings who liked this comment
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Composite index for efficient comment queries by post
photoCommentSchema.index({ postId: 1, createdAt: -1 });

// Index for user's comments
photoCommentSchema.index({ userId: 1, createdAt: -1 });

/**
 * Create a new comment
 * @param {Object} commentData - Comment data
 * @returns {Promise<Object>} Created comment
 */
photoCommentSchema.statics.createComment = async function(commentData) {
  const comment = new this(commentData);
  return comment.save();
};

/**
 * Get comments for a post with pagination
 * @param {string} postId - Post ID
 * @param {number} limit - Number of comments to return
 * @param {number} skip - Number of comments to skip
 * @returns {Promise<Array>} Array of comments
 */
photoCommentSchema.statics.getCommentsForPost = async function(postId, limit = 20, skip = 0) {
  return this.find({ postId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Count comments for a post
 * @param {string} postId - Post ID
 * @returns {Promise<number>} Number of comments
 */
photoCommentSchema.statics.countForPost = async function(postId) {
  return this.countDocuments({ postId });
};

const PhotoComment = mongoose.model('PhotoComment', photoCommentSchema);

module.exports = PhotoComment;
