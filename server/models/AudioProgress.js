/**
 * Audio Progress Model - tracks user's listening progress for audio content
 * @file server/models/AudioProgress.js
 */

const mongoose = require('mongoose');

/**
 * Schema for tracking audio listening progress
 */
const audioProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    required: true,
    index: true
  },
  audioId: {
    type: String,
    required: true,
    index: true
    // Audio identifier (e.g., 'free-1', 'premium-123')
  },
  positionSec: {
    type: Number,
    required: true,
    default: 0,
    min: 0
    // Current playback position in seconds
  },
  updatedAt: {
    type: Date,
    default: Date.now
    // Last update timestamp
  }
}, {
  timestamps: true
});

// Compound unique index for userId + audioId
audioProgressSchema.index({ userId: 1, audioId: 1 }, { unique: true });

/**
 * Update or create progress for a user's audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @param {number} positionSec - Position in seconds
 * @returns {Promise<Object>} Updated progress document
 */
audioProgressSchema.statics.updateProgress = async function(userId, audioId, positionSec) {
  return await this.findOneAndUpdate(
    { userId, audioId },
    { 
      positionSec,
      updatedAt: new Date()
    },
    { 
      upsert: true,
      new: true,
      runValidators: true
    }
  );
};

/**
 * Get progress for a specific audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<Object|null>} Progress document or null
 */
audioProgressSchema.statics.getProgress = async function(userId, audioId) {
  return await this.findOne({ userId, audioId });
};

/**
 * Get all progress entries for a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of progress documents
 */
audioProgressSchema.statics.getUserProgress = async function(userId) {
  return await this.find({ userId }).sort({ updatedAt: -1 });
};

/**
 * Delete progress for a specific audio
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} audioId - Audio identifier
 * @returns {Promise<Object>} Delete result
 */
audioProgressSchema.statics.deleteProgress = async function(userId, audioId) {
  return await this.deleteOne({ userId, audioId });
};

const AudioProgress = mongoose.model('AudioProgress', audioProgressSchema);

module.exports = AudioProgress;
