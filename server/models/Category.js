/**
 * @fileoverview Модель категорий для классификации цитат
 * @description Переносим хардкодированные категории из quoteHandler в БД
 * @author Reader Bot Team
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} CategoryDocument
 * @property {string} name - Название категории
 * @property {string} description - Описание категории
 * @property {string} icon - Эмодзи иконка для категории
 * @property {string} color - Цвет для UI (hex)
 * @property {string[]} keywords - Ключевые слова для AI классификации
 * @property {boolean} isActive - Активна ли категория
 * @property {number} priority - Приоритет в списке (1-10)
 * @property {string} aiPromptHint - Подсказка для AI анализа
 * @property {Date} createdAt - Дата создания
 * @property {Date} updatedAt - Дата обновления
 */

const categorySchema = new mongoose.Schema({
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
  
  icon: {
    type: String,
    required: true,
    trim: true,
    default: '📝'
  },
  
  color: {
    type: String,
    required: true,
    match: /^#[0-9A-F]{6}$/i,
    default: '#6B7280'
  },
  
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  aiPromptHint: {
    type: String,
    trim: true,
    maxlength: 300
  }
}, {
  timestamps: true,
  collection: 'categories'
});

// Индексы для оптимизации запросов
categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ isActive: 1, priority: -1 });
categorySchema.index({ keywords: 1 });

/**
 * Получить активные категории для AI анализа
 * @returns {Promise<CategoryDocument[]>}
 */
categorySchema.statics.getActiveForAI = async function() {
  return this.find({ isActive: true })
    .sort({ priority: -1, name: 1 })
    .select('name description keywords aiPromptHint');
};

/**
 * Получить категории для UI
 * @returns {Promise<CategoryDocument[]>}
 */
categorySchema.statics.getForUI = async function() {
  return this.find({ isActive: true })
    .sort({ priority: -1, name: 1 })
    .select('name description icon color');
};

/**
 * Найти категорию по тексту цитаты (для fallback анализа)
 * @param {string} text - Текст цитаты
 * @returns {Promise<CategoryDocument|null>}
 */
categorySchema.statics.findByText = async function(text) {
  const textLower = text.toLowerCase();
  
  const categories = await this.find({ 
    isActive: true,
    keywords: { $exists: true, $ne: [] }
  }).sort({ priority: -1 });
  
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (textLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  // Возвращаем категорию по умолчанию
  return this.findOne({ name: 'ДРУГОЕ' }) || 
         this.findOne({ isActive: true }).sort({ priority: -1 });
};

/**
 * Валидировать название категории для AI
 * @param {string} categoryName - Название категории от AI
 * @returns {Promise<CategoryDocument|null>}
 */
categorySchema.statics.validateAICategory = async function(categoryName) {
  // Точное совпадение
  let category = await this.findOne({ 
    name: categoryName, 
    isActive: true 
  });
  
  if (category) return category;
  
  // Поиск по частичному совпадению (без учета регистра)
  category = await this.findOne({ 
    name: { $regex: new RegExp(categoryName, 'i') }, 
    isActive: true 
  });
  
  if (category) return category;
  
  // Поиск по ключевым словам
  category = await this.findOne({
    keywords: { $in: [categoryName.toLowerCase()] },
    isActive: true
  });
  
  return category;
};

/**
 * Получить статистику категорий
 * @returns {Promise<Object>}
 */
categorySchema.statics.getStats = async function() {
  const { Quote } = require('./quote');
  
  const [total, active, usageStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    Quote ? Quote.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]) : []
  ]);

  return {
    total,
    active,
    inactive: total - active,
    mostUsed: usageStats
  };
};

/**
 * Виртуальное поле для количества ключевых слов
 */
categorySchema.virtual('keywordsCount').get(function() {
  return this.keywords ? this.keywords.length : 0;
});

/**
 * Метод экземпляра для проверки соответствия тексту
 * @param {string} text - Текст для проверки
 * @returns {boolean}
 */
categorySchema.methods.matchesText = function(text) {
  if (!this.keywords || this.keywords.length === 0) {
    return false;
  }
  
  const textLower = text.toLowerCase();
  return this.keywords.some(keyword => textLower.includes(keyword));
};

/**
 * Метод экземпляра для генерации промпта для AI
 * @returns {string}
 */
categorySchema.methods.getAIPrompt = function() {
  let prompt = `"${this.name}": ${this.description}`;
  
  if (this.keywords && this.keywords.length > 0) {
    prompt += ` (ключевые слова: ${this.keywords.join(', ')})`;
  }
  
  if (this.aiPromptHint) {
    prompt += ` - ${this.aiPromptHint}`;
  }
  
  return prompt;
};

// Включаем виртуальные поля в JSON
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
