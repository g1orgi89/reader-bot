/**
 * Farming Rate model for storing and managing yield rates
 * @file server/models/farmingRate.js
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} FarmingRateDocument
 * @property {number} rate - Current farming yield rate (percentage)
 * @property {string} updatedBy - Who updated the rate
 * @property {Date} updatedAt - When the rate was last updated
 * @property {Date} createdAt - When the record was created
 * @property {boolean} isActive - Whether this is the current active rate
 * @property {Object} metadata - Additional metadata
 */

const farmingRateSchema = new mongoose.Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 100;
      },
      message: 'Rate must be between 0 and 100'
    }
  },
  updatedBy: {
    type: String,
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    source: {
      type: String,
      default: 'admin-panel'
    },
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  collection: 'farming_rates'
});

// Ensure only one active rate at a time
farmingRateSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// Static method to get current rate
farmingRateSchema.statics.getCurrentRate = async function() {
  const rate = await this.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!rate) {
    // Create default rate if none exists
    return await this.create({
      rate: 12.5,
      updatedBy: 'system',
      isActive: true,
      metadata: {
        source: 'system-default',
        version: '1.0.0'
      }
    });
  }
  return rate;
};

// Static method to update rate
farmingRateSchema.statics.updateRate = async function(newRate, updatedBy = 'admin') {
  // Deactivate all existing rates
  await this.updateMany({}, { isActive: false });
  
  // Create new active rate
  return await this.create({
    rate: newRate,
    updatedBy,
    isActive: true,
    metadata: {
      source: 'admin-panel',
      