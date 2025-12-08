/**
 * @fileoverview Модель обратной связи для бота "Читатель"
 * Stores user feedback with ratings and comments for monthly reports and general feedback
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * Схема обратной связи
 */
const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    required: false,
    index: true
    // MongoDB ObjectId reference to UserProfile (optional for flexibility)
  },
  telegramId: {
    type: String,
    required: true,
    index: true
    // Telegram user ID (required as primary identifier)
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
    // User rating from 1 to 5 stars
  },
  text: {
    type: String,
    maxlength: 300,
    trim: true,
    default: ''
    // Optional feedback comment (max 300 characters)
  },
  context: {
    type: String,
    enum: ['monthly_report', 'general', 'bot'],
    default: 'monthly_report'
    // Context of the feedback
  },
  source: {
    type: String,
    enum: ['telegram', 'mini_app'],
    default: 'telegram'
    // Source of the feedback (telegram bot or mini app)
  },
  tags: {
    type: [String],
    default: []
    // Optional tags for categorization
  }
}, {
  timestamps: true
  // Automatically adds createdAt and updatedAt fields
});

/**
 * Compound indexes for efficient queries
 */
feedbackSchema.index({ telegramId: 1, createdAt: -1 });
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ context: 1, createdAt: -1 });
feedbackSchema.index({ rating: 1, createdAt: -1 });

/**
 * Static method to get feedback statistics
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Statistics object
 */
feedbackSchema.statics.getStatistics = async function(filters = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalCount: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalCount: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const result = stats[0];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  result.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    totalCount: result.totalCount,
    averageRating: Math.round(result.averageRating * 10) / 10,
    ratingDistribution: distribution
  };
};

/**
 * Static method to get user's latest feedback
 * @param {String} telegramId - Telegram user ID
 * @param {String} context - Feedback context
 * @returns {Promise<Object|null>} Latest feedback or null
 */
feedbackSchema.statics.getLatestByUser = async function(telegramId, context = null) {
  const query = { telegramId };
  if (context) {
    query.context = context;
  }
  
  return await this.findOne(query).sort({ createdAt: -1 });
};

/**
 * Instance method to check if feedback is recent (within last 30 days)
 * @returns {Boolean} True if feedback is recent
 */
feedbackSchema.methods.isRecent = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.createdAt > thirtyDaysAgo;
};

/**
 * Virtual field for formatted rating display
 */
feedbackSchema.virtual('ratingStars').get(function() {
  return '⭐'.repeat(this.rating);
});

/**
 * Pre-save hook to sanitize text input
 */
feedbackSchema.pre('save', function(next) {
  // Trim and limit text to 300 characters
  if (this.text) {
    this.text = this.text.trim().substring(0, 300);
  }
  
  // Ensure tags are trimmed and lowercase
  if (this.tags && this.tags.length > 0) {
    this.tags = this.tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
  }
  
  next();
});

/**
 * Export the Feedback model
 */
const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
