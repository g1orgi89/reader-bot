/**
 * Prompt MongoDB Model - Система управления промптами для Reader Bot (Читатель)
 * @file server/models/prompt.js
 */

const mongoose = require('mongoose');

/**
 * Prompt Schema для хранения системных и пользовательских промптов Reader Bot
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
    enum: [
      'basic', 
      'rag', 
      'ticket_detection', 
      'categorization', 
      'subject',
      'reader_analysis',      // 📖 Анализ цитат для Reader Bot
      'reader_reports',       // 📊 Генерация отчетов
      'reader_recommendations', // 📚 Рекомендации книг
      'reader_onboarding'     // 🎯 Онбординг пользователей
    ],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // 📖 Reader Bot специфичные категории
      'onboarding',           // 🎯 Онбординг
      'quote_analysis',       // 📝 Анализ цитат
      'weekly_reports',       // 📊 Еженедельные отчеты
      'monthly_reports',      // 📈 Месячные отчеты
      'book_recommendations', // 📚 Рекомендации книг
      'user_interaction',     // 💬 Взаимодействие с пользователем
      'system',              // ⚙️ Системные
      'other',               // 📖 Другое
      // Backward compatibility для старых промптов
      'safety',              // Безопасность
      'language',            // Языковые
      'custom'              // Пользовательские
    ],
    default: 'other',
    index: true
  },
  language: {
    type: String,
    default: 'ru', // Reader Bot преимущественно русскоязычный
    enum: ['ru', 'en', 'none'],
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000 // Увеличенный лимит для сложных промптов
  },
  variables: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'active',
    index: true
  },
  priority: {
    type: String,
    enum: ['high', 'normal', 'low'],
    default: 'normal',
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
    trim: true,
    default: 'system'
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
    },
    readerSpecific: {
      usedInReports: { type: Number, default: 0 },
      avgResponseTime: Number,
      lastOptimizedAt: Date
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
promptSchema.index({ type: 1, language: 1, status: 1 });
promptSchema.index({ category: 1, status: 1 });
promptSchema.index({ isDefault: 1, type: 1 });
promptSchema.index({ status: 1, priority: 1 });

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
    variables: obj.variables || [],
    status: obj.status,
    priority: obj.priority,
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

/**
 * Инкремент использования в отчетах Reader Bot
 */
promptSchema.methods.incrementReaderUsage = function() {
  if (!this.metadata.readerSpecific) {
    this.metadata.readerSpecific = {};
  }
  this.metadata.readerSpecific.usedInReports = (this.metadata.readerSpecific.usedInReports || 0) + 1;
  return this.incrementUsage();
};

// Статические методы для поиска
promptSchema.statics.findByType = function(type, language = null, activeOnly = true) {
  const query = { type };
  if (language && language !== 'none') query.language = { $in: [language, 'none'] };
  if (activeOnly) query.status = 'active';
  
  return this.find(query).sort({ isDefault: -1, updatedAt: -1 });
};

/**
 * Получить активный промпт по типу и языку
 * @param {string} type - Тип промпта
 * @param {string} language - Язык
 * @returns {Promise<PromptDocument|null>} Промпт
 */
promptSchema.statics.getActivePrompt = function(type, language = 'ru') {
  const languageOptions = language === 'none' ? ['none'] : [language, 'none'];
  
  return this.findOne({
    type,
    language: { $in: languageOptions },
    status: 'active'
  }).sort({ 
    isDefault: -1, // Системные промпты приоритетнее
    priority: 1,   // Высокий приоритет (high = 1, normal = 2, low = 3)
    updatedAt: -1  // Затем по дате обновления
  });
};

/**
 * Получить промпт для Reader Bot анализа
 * @param {string} analysisType - Тип анализа (quote, weekly, monthly)
 * @param {string} language - Язык
 * @returns {Promise<PromptDocument|null>} Промпт
 */
promptSchema.statics.getReaderPrompt = function(analysisType, language = 'ru') {
  const categoryMap = {
    quote: 'quote_analysis',
    weekly: 'weekly_reports', 
    monthly: 'monthly_reports',
    onboarding: 'onboarding',
    recommendations: 'book_recommendations'
  };
  
  const category = categoryMap[analysisType];
  if (!category) return null;
  
  return this.findOne({
    category,
    status: 'active',
    language: { $in: [language, 'none'] }
  }).sort({
    priority: 1,
    isDefault: -1,
    updatedAt: -1
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
    status = 'active',
    limit = 10,
    page = 1
  } = options;

  const query = {
    $text: { $search: searchQuery }
  };

  if (category) query.category = category;
  if (type) query.type = type;
  if (language && language !== 'none') query.language = { $in: [language, 'none'] };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);
};

/**
 * Получить статистику промптов для Reader Bot
 * @returns {Promise<Object>} Статистика
 */
promptSchema.statics.getReaderStats = async function() {
  const [
    totalCount,
    activeCount,
    draftCount,
    archivedCount,
    categoryStats,
    languageStats,
    mostUsedInReports
  ] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ status: 'active' }),
    this.countDocuments({ status: 'draft' }),
    this.countDocuments({ status: 'archived' }),
    this.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.aggregate([
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.find({ 'metadata.readerSpecific.usedInReports': { $gt: 0 } })
      .sort({ 'metadata.readerSpecific.usedInReports': -1 })
      .limit(5)
      .select('name category metadata.readerSpecific.usedInReports')
  ]);

  return {
    total: totalCount,
    active: activeCount,
    draft: draftCount,
    archived: archivedCount,
    byCategory: categoryStats,
    byLanguage: languageStats,
    mostUsedInReports
  };
};

/**
 * Получить промпты по категории Reader Bot
 * @param {string} category - Категория
 * @param {Object} options - Опции
 * @returns {Promise<PromptDocument[]>} Промпты
 */
promptSchema.statics.findByReaderCategory = function(category, options = {}) {
  const { language = null, status = 'active' } = options;
  
  const query = { category };
  if (language && language !== 'none') query.language = { $in: [language, 'none'] };
  if (status) query.status = status;
  
  return this.find(query).sort({ 
    priority: 1,      // Высокий приоритет первым
    isDefault: -1,    // Системные промпты первыми
    name: 1          // Затем по алфавиту
  });
};

// Экспорт модели
const Prompt = mongoose.model('Prompt', promptSchema);

module.exports = Prompt;