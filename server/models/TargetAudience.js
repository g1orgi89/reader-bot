/**
 * @fileoverview Модель целевых аудиторий для персонализации
 * @description Переносим хардкодированные аудитории из announcementService в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

const targetAudienceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[a-z0-9_-]+$/
  },
  
  criteria: {
    testResults: [{
      field: String,
      values: [String]
    }],
    preferences: [String],
    demographics: {
      ageRange: {
        min: Number,
        max: Number
      },
      lifestyle: [String]
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  }
}, {
  timestamps: true,
  collection: 'target_audiences'
});

// Индексы
targetAudienceSchema.index({ slug: 1 }, { unique: true });
targetAudienceSchema.index({ isActive: 1, priority: -1 });

/**
 * Получить аудитории для пользователя
 * @param {Object} userProfile - Профиль пользователя
 * @returns {Promise<string[]>} Массив slug аудиторий
 */
targetAudienceSchema.statics.getForUser = async function(userProfile) {
  const audiences = await this.find({ isActive: true });
  const matchedAudiences = [];
  
  for (const audience of audiences) {
    if (this.userMatchesCriteria(userProfile, audience.criteria)) {
      matchedAudiences.push(audience.slug);
    }
  }
  
  return matchedAudiences.length > 0 ? matchedAudiences : ['all'];
};

/**
 * Проверить соответствие пользователя критериям
 * @param {Object} userProfile - Профиль пользователя
 * @param {Object} criteria - Критерии аудитории
 * @returns {boolean}
 */
targetAudienceSchema.statics.userMatchesCriteria = function(userProfile, criteria) {
  // Проверяем результаты теста
  if (criteria.testResults) {
    for (const testCriteria of criteria.testResults) {
      const userValue = userProfile.testResults?.[testCriteria.field];
      if (userValue && testCriteria.values.some(val => 
        userValue.includes ? userValue.includes(val) : userValue === val
      )) {
        return true;
      }
    }
  }
  
  // Проверяем предпочтения
  if (criteria.preferences && userProfile.preferences?.mainThemes) {
    if (criteria.preferences.some(pref => 
      userProfile.preferences.mainThemes.includes(pref)
    )) {
      return true;
    }
  }
  
  // Проверяем демографию
  if (criteria.demographics?.lifestyle && userProfile.testResults?.lifestyle) {
    if (criteria.demographics.lifestyle.some(lifestyle => 
      userProfile.testResults.lifestyle.includes(lifestyle)
    )) {
      return true;
    }
  }
  
  return false;
};

/**
 * Получить статистику аудиторий
 */
targetAudienceSchema.statics.getStats = async function() {
  const [total, active] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true })
  ]);

  return { total, active, inactive: total - active };
};

const TargetAudience = mongoose.model('TargetAudience', targetAudienceSchema);

module.exports = TargetAudience;
