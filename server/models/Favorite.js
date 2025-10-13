/**
 * @fileoverview Favorite model for tracking likes in the community
 * @author g1orgi89
 * 
 * This model replaces the isFavorite field on Quote for tracking community likes.
 * Instead of creating duplicate Quote documents when a user likes a quote,
 * we create a single Favorite document per (userId, normalizedKey) pair.
 */

const mongoose = require('mongoose');
const { computeNormalizedKey } = require('../utils/quoteNormalizer');

/**
 * Favorite schema
 * Each document represents one user liking one unique quote (by normalized text+author)
 */
const favoriteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
    // ID of the user who liked this quote
  },
  normalizedKey: {
    type: String,
    required: true,
    index: true
    // Normalized key: normalizeQuoteField(text) + '|||' + normalizeQuoteField(author)
  },
  text: {
    type: String,
    required: true,
    trim: true
    // Original text of the quote (for display)
  },
  author: {
    type: String,
    trim: true,
    default: ''
    // Original author of the quote (for display)
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Composite unique index to prevent duplicate likes by same user
favoriteSchema.index({ userId: 1, normalizedKey: 1 }, { unique: true });

// Index for aggregations by normalizedKey
favoriteSchema.index({ normalizedKey: 1, createdAt: -1 });

/**
 * Static method to compute normalized key from text and author
 * Uses shared utility function for consistency
 * @param {string} text - Quote text
 * @param {string} author - Quote author (optional)
 * @returns {string} Normalized key in format "normalizedText|||normalizedAuthor"
 */
favoriteSchema.statics.computeNormalizedKey = function(text, author = '') {
  return computeNormalizedKey(text, author);
};

/**
 * Create or update a favorite (upsert)
 * @param {string} userId - User ID
 * @param {string} text - Quote text
 * @param {string} author - Quote author
 * @returns {Promise<Object>} Result with favorite document and isNew flag
 */
favoriteSchema.statics.addFavorite = async function(userId, text, author = '') {
  const normalizedKey = this.computeNormalizedKey(text, author);
  
  const result = await this.findOneAndUpdate(
    { userId, normalizedKey },
    { 
      text: text.trim(),
      author: (author || '').trim(),
      normalizedKey
    },
    { 
      upsert: true, 
      new: true, 
      setDefaultsOnInsert: true 
    }
  );
  
  return result;
};

/**
 * Remove a favorite
 * @param {string} userId - User ID
 * @param {string} text - Quote text
 * @param {string} author - Quote author
 * @returns {Promise<Object|null>} Deleted favorite or null if not found
 */
favoriteSchema.statics.removeFavorite = async function(userId, text, author = '') {
  const normalizedKey = this.computeNormalizedKey(text, author);
  
  return this.findOneAndDelete({ userId, normalizedKey });
};

/**
 * Get favorites count for a list of normalized keys
 * @param {Array<string>} normalizedKeys - Array of normalized keys
 * @returns {Promise<Map<string, number>>} Map of normalizedKey -> count of unique users
 */
favoriteSchema.statics.getCountsForKeys = async function(normalizedKeys) {
  const results = await this.aggregate([
    {
      $match: { normalizedKey: { $in: normalizedKeys } }
    },
    {
      $group: {
        _id: '$normalizedKey',
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        _id: 1,
        count: { $size: '$uniqueUsers' }
      }
    }
  ]);
  
  const countsMap = new Map();
  results.forEach(r => {
    countsMap.set(r._id, r.count);
  });
  
  return countsMap;
};

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;
