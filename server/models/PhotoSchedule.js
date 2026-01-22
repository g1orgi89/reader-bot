/**
 * @fileoverview Photo Schedule model for Covers feature
 * @description Schedules Anna's daily "start of day" photo posts
 */

const mongoose = require('mongoose');

/**
 * Photo Schedule Schema
 * Each document represents a scheduled photo for Anna's daily auto-post
 */
const photoScheduleSchema = new mongoose.Schema({
  dayKey: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Date key in format YYYY-MM-DD (Europe/Moscow timezone)
  },
  imageUrl: {
    type: String,
    required: true
    // URL to the scheduled photo
  },
  caption: {
    type: String,
    maxlength: 300,
    trim: true,
    default: ''
    // Photo caption for the scheduled post
  },
  status: {
    type: String,
    enum: ['pending', 'published'],
    default: 'pending',
    index: true
    // Schedule status
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

/**
 * Create or update a scheduled post
 * @param {Object} scheduleData - Schedule data
 * @returns {Promise<Object>} Created or updated schedule
 */
photoScheduleSchema.statics.createOrUpdate = async function(scheduleData) {
  return this.findOneAndUpdate(
    { dayKey: scheduleData.dayKey },
    scheduleData,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Get pending schedule for a specific day
 * @param {string} dayKey - Day key (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Schedule or null
 */
photoScheduleSchema.statics.getPendingForDay = async function(dayKey) {
  return this.findOne({ dayKey, status: 'pending' }).lean();
};

/**
 * Mark schedule as published
 * @param {string} dayKey - Day key (YYYY-MM-DD)
 * @returns {Promise<Object>} Updated schedule
 */
photoScheduleSchema.statics.markAsPublished = async function(dayKey) {
  return this.findOneAndUpdate(
    { dayKey },
    { $set: { status: 'published' } },
    { new: true }
  );
};

const PhotoSchedule = mongoose.model('PhotoSchedule', photoScheduleSchema);

module.exports = PhotoSchedule;
