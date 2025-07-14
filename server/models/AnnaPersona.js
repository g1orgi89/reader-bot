/**
 * @fileoverview Модель персоны Анны для консистентности AI-ответов
 * @description Переносим хардкодированные данные персоны из сервисов в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

const annaPersonaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    default: 'Anna Busel Default'
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  personality: {
    communicationStyle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    toneOfVoice: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    keyPhrases: [{
      type: String,
      trim: true
    }],
    addressingStyle: {
      type: String,
      enum: ['ты', 'вы'],
      default: 'вы'
    }
  },
  
  expertise: {
    mainAreas: [{
      type: String,
      trim: true
    }],
    specializations: [{
      type: String,
      trim: true
    }],
    credentials: [{
      type: String,
      trim: true
    }]
  },
  
  responsePatterns: {
    greeting: [{
      type: String,
      trim: true
    }],
    encouragement: [{
      type: String,
      trim: true
    }],
    bookRecommendation: [{
      type: String,
      trim: true
    }],
    quoteAnalysis: [{
      type: String,
      trim: true
    }]
  },
  
  boundaries: {
    whatSheDoes: [{
      type: String,
      trim: true
    }],
    whatSheDoesNot: [{
      type: String,
      trim: true
    }]
  },
  
  context: {
    type: String,
    enum: [
      'quote_analysis',
      'weekly_report',
      'monthly_report',
      'general_chat',
      'book_recommendation',
      'onboarding'
    ],
    required: true
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
  collection: 'anna_persona'
});

// Индексы
annaPersonaSchema.index({ context: 1, isActive: 1 });
annaPersonaSchema.index({ name: 1 }, { unique: true });

/**
 * Получить персону для контекста
 * @param {string} context - Контекст использования
 * @returns {Promise<AnnaPersonaDocument|null>}
 */
annaPersonaSchema.statics.getForContext = async function(context) {
  return this.findOne({ 
    context, 
    isActive: true 
  }).sort({ priority: -1 });
};

/**
 * Получить универсальную персону (fallback)
 * @returns {Promise<AnnaPersonaDocument|null>}
 */
annaPersonaSchema.statics.getDefault = async function() {
  return this.findOne({ 
    context: 'general_chat',
    isActive: true 
  }).sort({ priority: -1 }) || 
  this.findOne({ isActive: true }).sort({ priority: -1 });
};

/**
 * Генерировать системный промпт для AI
 * @returns {string}
 */
annaPersonaSchema.methods.generateSystemPrompt = function() {
  let prompt = `Ты ${this.description}\n\n`;
  
  prompt += `СТИЛЬ ОБЩЕНИЯ:\n`;
  prompt += `- ${this.personality.communicationStyle}\n`;
  prompt += `- ${this.personality.toneOfVoice}\n`;
  prompt += `- Обращайся на "${this.personality.addressingStyle}"\n\n`;
  
  if (this.personality.keyPhrases.length > 0) {
    prompt += `ФИРМЕННЫЕ ФРАЗЫ:\n`;
    prompt += this.personality.keyPhrases.map(phrase => `- "${phrase}"`).join('\n');
    prompt += '\n\n';
  }
  
  if (this.expertise.mainAreas.length > 0) {
    prompt += `ЭКСПЕРТИЗА:\n`;
    prompt += this.expertise.mainAreas.map(area => `- ${area}`).join('\n');
    prompt += '\n\n';
  }
  
  if (this.boundaries.whatSheDoes.length > 0) {
    prompt += `ЧТО ТЫ ДЕЛАЕШЬ:\n`;
    prompt += this.boundaries.whatSheDoes.map(item => `- ${item}`).join('\n');
    prompt += '\n\n';
  }
  
  if (this.boundaries.whatSheDoesNot.length > 0) {
    prompt += `ЧЕГО ТЫ НЕ ДЕЛАЕШЬ:\n`;
    prompt += this.boundaries.whatSheDoesNot.map(item => `- ${item}`).join('\n');
    prompt += '\n\n';
  }
  
  return prompt.trim();
};

/**
 * Получить случайную фразу для контекста
 * @param {string} patternType - Тип паттерна
 * @returns {string|null}
 */
annaPersonaSchema.methods.getRandomPhrase = function(patternType) {
  const patterns = this.responsePatterns[patternType];
  if (!patterns || patterns.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * patterns.length);
  return patterns[randomIndex];
};

/**
 * Метод экземпляра для проверки применимости к контексту
 * @param {string} context - Контекст для проверки
 * @returns {boolean}
 */
annaPersonaSchema.methods.isApplicableForContext = function(context) {
  return this.isActive && this.context === context;
};

/**
 * Получить статистику персон
 */
annaPersonaSchema.statics.getStats = async function() {
  const [total, active, contextStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$context', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  return {
    total,
    active,
    inactive: total - active,
    contextBreakdown: contextStats.reduce((acc, ctx) => {
      acc[ctx._id] = ctx.count;
      return acc;
    }, {})
  };
};

/**
 * Виртуальное поле для общего количества фраз
 */
annaPersonaSchema.virtual('totalPhrases').get(function() {
  const patterns = this.responsePatterns;
  return Object.values(patterns).reduce((sum, phrases) => {
    return sum + (Array.isArray(phrases) ? phrases.length : 0);
  }, 0);
});

// Включаем виртуальные поля в JSON
annaPersonaSchema.set('toJSON', { virtuals: true });
annaPersonaSchema.set('toObject', { virtuals: true });

const AnnaPersona = mongoose.model('AnnaPersona', annaPersonaSchema);

module.exports = AnnaPersona;
