/**
 * Prompt MongoDB Model - Система управления промптами для Shrooms AI Support Bot
 * @file server/models/prompt.js
 */

const mongoose = require('mongoose');

/**
 * Prompt Schema для хранения системных и пользовательских промптов
 * @typedef {import('../types/index.js').PromptDocument} PromptDocument
 */
const promptSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['basic', 'rag', 'ticket_detection', 'categorization', 'subject'],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['system', 'safety', 'language', 'custom'],
    default: 'custom',
    index: true
  },
  language: {
    type: String,
    required: true,
    enum: ['en', 'es', 'ru', 'all'],
    default: 'en',
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000 // Увеличенный лимит для сложных промптов
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  maxTokens: {
    type: Number,
    default: 1000,
    min: 100,
    max: 4000
  },
  version: {
    type: String,
    default: '1.0.0',
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  authorId: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  metadata: {
    lastTestedAt: Date,
    testResults: [{
      input: String,
      output: String,
      tokensUsed: Number,
      testedAt: Date,
      successful: Boolean
    }],
    usage: {
      totalUsed: { type: Number, default: 0 },
      lastUsedAt: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'prompts',
  strict: true,
  versionKey: false
});

// Композитные индексы для эффективного поиска
promptSchema.index({ type: 1, language: 1, active: 1 });
promptSchema.index({ category: 1, active: 1 });
promptSchema.index({ isDefault: 1, type: 1 });

// Текстовый индекс для поиска по содержимому
promptSchema.index({
  name: 'text',
  description: 'text',
  content: 'text'
}, {
  weights: {
    name: 10,
    description: 5,
    content: 3
  },
  name: 'prompt_text_search'
});

// Обновление updatedAt при сохранении
promptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Защита от удаления системных промптов
promptSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  if (this.isDefault) {
    const error = new Error('Системные промпты не могут быть удалены');
    error.code = 'SYSTEM_PROMPT_PROTECTED';
    return next(error);
  }
  next();
});

// Instance методы
promptSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    name: obj.name,
    type: obj.type,
    category: obj.category,
    language: obj.language,
    content: obj.content,
    active: obj.active,
    description: obj.description,
    maxTokens: obj.maxTokens,
    version: obj.version,
    isDefault: obj.isDefault,
    authorId: obj.authorId,
    tags: obj.tags || [],
    metadata: obj.metadata,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

/**
 * Инкремент счетчика использования промпта
 */
promptSchema.methods.incrementUsage = function() {
  this.metadata.usage.totalUsed = (this.metadata.usage.totalUsed || 0) + 1;
  this.metadata.usage.lastUsedAt = new Date();
  return this.save();
};

/**
 * Добавление результата тестирования
 * @param {Object} testResult - Результат тестирования
 */
promptSchema.methods.addTestResult = function(testResult) {
  if (!this.metadata.testResults) {
    this.metadata.testResults = [];
  }
  
  this.metadata.testResults.push({
    ...testResult,
    testedAt: new Date()
  });
  
  // Оставляем только последние 10 результатов
  if (this.metadata.testResults.length > 10) {
    this.metadata.testResults = this.metadata.testResults.slice(-10);
  }
  
  this.metadata.lastTestedAt = new Date();
  return this.save();
};

// Статические методы для поиска
promptSchema.statics.findByType = function(type, language = null, activeOnly = true) {
  const query = { type };
  if (language && language !== 'all') query.language = { $in: [language, 'all'] };
  if (activeOnly) query.active = true;
  
  return this.find(query).sort({ isDefault: -1, updatedAt: -1 });
};

/**
 * Получить активный промпт по типу и языку
 * @param {string} type - Тип промпта
 * @param {string} language - Язык
 * @returns {Promise<PromptDocument|null>} Промпт
 */
promptSchema.statics.getActivePrompt = function(type, language = 'en') {
  const languageOptions = language === 'all' ? ['all'] : [language, 'all'];
  
  return this.findOne({
    type,
    language: { $in: languageOptions },
    active: true
  }).sort({ 
    isDefault: -1, // Системные промпты приоритетнее
    updatedAt: -1  // Затем по дате обновления
  });
};

/**
 * Поиск промптов по тексту
 * @param {string} searchQuery - Поисковый запрос
 * @param {Object} options - Опции поиска
 * @returns {Promise<PromptDocument[]>} Найденные промпты
 */
promptSchema.statics.searchText = function(searchQuery, options = {}) {
  const {
    category = null,
    type = null,
    language = null,
    activeOnly = true,
    limit = 10,
    page = 1
  } = options;

  const query = {
    $text: { $search: searchQuery }
  };

  if (category) query.category = category;
  if (type) query.type = type;
  if (language && language !== 'all') query.language = { $in: [language, 'all'] };
  if (activeOnly) query.active = true;

  const skip = (page - 1) * limit;

  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);
};

/**
 * Получить статистику промптов
 * @returns {Promise<Object>} Статистика
 */
promptSchema.statics.getStats = async function() {
  const [
    totalCount,
    activeCount,
    defaultCount,
    typeStats,
    languageStats,
    mostUsed
  ] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ active: true }),
    this.countDocuments({ isDefault: true }),
    this.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.aggregate([
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.find({ 'metadata.usage.totalUsed': { $gt: 0 } })
      .sort({ 'metadata.usage.totalUsed': -1 })
      .limit(5)
      .select('name type metadata.usage.totalUsed')
  ]);

  return {
    total: totalCount,
    active: activeCount,
    default: defaultCount,
    byType: typeStats,
    byLanguage: languageStats,
    mostUsed: mostUsed
  };
};

/**
 * Получить промпты по категории
 * @param {string} category - Категория
 * @param {Object} options - Опции
 * @returns {Promise<PromptDocument[]>} Промпты
 */
promptSchema.statics.findByCategory = function(category, options = {}) {
  const { language = null, activeOnly = true } = options;
  
  const query = { category };
  if (language && language !== 'all') query.language = { $in: [language, 'all'] };
  if (activeOnly) query.active = true;
  
  return this.find(query).sort({ isDefault: -1, name: 1 });
};

// Экспорт модели
const Prompt = mongoose.model('Prompt', promptSchema);

module.exports = Prompt;