/**
 * Knowledge Document model for Shrooms Support Bot
 * @file server/models/knowledge.js
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/index.js').KnowledgeDocumentType} KnowledgeDocumentType
 */

/**
 * Knowledge Document schema definition
 */
const knowledgeDocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000 // Allow for large documents
  },
  category: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
    enum: ['general', 'user-guide', 'tokenomics', 'technical', 'troubleshooting', 'api']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],
  language: {
    type: String,
    enum: ['en', 'es', 'ru'],
    required: true,
    index: true,
    default: 'en'
  },
  vectorId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  authorId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  lastReviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
knowledgeDocumentSchema.index({ category: 1, language: 1, status: 1 });
knowledgeDocumentSchema.index({ tags: 1, language: 1, status: 1 });
knowledgeDocumentSchema.index({ status: 1, createdAt: -1 });

// Text search index
knowledgeDocumentSchema.index({ 
  title: 'text', 
  content: 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    content: 5,
    tags: 8
  },
  name: 'knowledgeTextSearch'
});

// Virtual for word count
knowledgeDocumentSchema.virtual('wordCount').get(function() {
  return this.content.split(/\s+/).length;
});

// Virtual for excerpt
knowledgeDocumentSchema.virtual('excerpt').get(function() {
  const maxLength = 200;
  if (this.content.length <= maxLength) {
    return this.content;
  }
  return this.content.substring(0, maxLength).trim() + '...';
});

/**
 * Instance method to update content and increment version
 * @param {string} newContent - New document content
 * @param {string} [authorId] - Author making the update
 * @returns {Promise<KnowledgeDocumentType>} Updated document
 */
knowledgeDocumentSchema.methods.updateContent = function(newContent, authorId = null) {
  this.content = newContent;
  this.version += 1;
  if (authorId) {
    this.authorId = authorId;
  }
  return this.save();
};

/**
 * Instance method to mark as reviewed
 * @param {string} reviewerId - ID of the reviewer
 * @returns {Promise<KnowledgeDocumentType>} Updated document
 */
knowledgeDocumentSchema.methods.markReviewed = function(reviewerId) {
  this.lastReviewedAt = new Date();
  this.reviewedBy = reviewerId;
  return this.save();
};

/**
 * Instance method to publish document
 * @returns {Promise<KnowledgeDocumentType>} Updated document
 */
knowledgeDocumentSchema.methods.publish = function() {
  this.status = 'published';
  return this.save();
};

/**
 * Instance method to archive document
 * @returns {Promise<KnowledgeDocumentType>} Updated document
 */
knowledgeDocumentSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

/**
 * Instance method to format document for API response
 * @returns {Object} Formatted document object
 */
knowledgeDocumentSchema.methods.toApiResponse = function() {
  return {
    id: this._id,
    title: this.title,
    content: this.content,
    excerpt: this.excerpt,
    category: this.category,
    tags: this.tags,
    language: this.language,
    status: this.status,
    version: this.version,
    wordCount: this.wordCount,
    authorId: this.authorId,
    lastReviewedAt: this.lastReviewedAt,
    reviewedBy: this.reviewedBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Static method to search documents by text
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string[]} [options.categories] - Filter by categories
 * @param {string[]} [options.languages] - Filter by languages
 * @param {string} [options.status='published'] - Filter by status
 * @param {number} [options.limit=20] - Maximum results
 * @returns {Promise<Array<KnowledgeDocumentType>>} Search results
 */
knowledgeDocumentSchema.statics.searchByText = function(query, options = {}) {
  const { 
    categories = [], 
    languages = [], 
    status = 'published',
    limit = 20 
  } = options;
  
  const searchQuery = { $text: { $search: query } };
  
  if (status) {
    searchQuery.status = status;
  }
  
  if (categories.length > 0) {
    searchQuery.category = { $in: categories };
  }
  
  if (languages.length > 0) {
    searchQuery.language = { $in: languages };
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

/**
 * Static method to find documents by category and language
 * @param {string} category - Document category
 * @param {string} [language='en'] - Document language
 * @param {Object} options - Query options
 * @returns {Promise<Array<KnowledgeDocumentType>>} Array of documents
 */
knowledgeDocumentSchema.statics.findByCategory = function(category, language = 'en', options = {}) {
  const { limit = 50, status = 'published' } = options;
  
  return this.find({ 
    category, 
    language, 
    status 
  })
    .sort({ title: 1 })
    .limit(limit)
    .lean();
};

/**
 * Static method to get documents by tags
 * @param {string[]} tags - Tags to search for
 * @param {Object} options - Query options
 * @returns {Promise<Array<KnowledgeDocumentType>>} Array of documents
 */
knowledgeDocumentSchema.statics.findByTags = function(tags, options = {}) {
  const { language = 'en', status = 'published', limit = 50 } = options;
  
  return this.find({
    tags: { $in: tags },
    language,
    status
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Static method to get knowledge base statistics
 * @returns {Promise<Object>} Statistics object
 */
knowledgeDocumentSchema.statics.getStatistics = async function() {
  const [categoryStats, languageStats, statusStats, tagStats] = await Promise.all([
    this.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $group: { _id: '$language', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ])
  ]);
  
  return {
    byCategory: categoryStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byLanguage: languageStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byStatus: statusStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    topTags: tagStats.map(item => ({
      tag: item._id,
      count: item.count
    }))
  };
};

/**
 * Pre-save middleware to process tags
 */
knowledgeDocumentSchema.pre('save', function(next) {
  // Ensure tags are unique and cleaned
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map(tag => 
      tag.toLowerCase().trim()
    ))].filter(tag => tag.length > 0);
  }
  next();
});

/**
 * Model for KnowledgeDocument documents
 * @type {mongoose.Model<KnowledgeDocumentType>}
 */
const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);

module.exports = KnowledgeDocument;