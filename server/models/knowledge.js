/**
 * Knowledge Document MongoDB Model - Fixed search and UTF-8 encoding
 * @file server/models/knowledge.js
 */

const mongoose = require('mongoose');

/**
 * Knowledge Document Schema
 * @typedef {import('../types/index.js').KnowledgeDocument} KnowledgeDocument
 */
const knowledgeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'user-guide', 'tokenomics', 'technical', 'troubleshooting'],
    index: true
  },
  language: {
    type: String,
    required: true,
    enum: ['en', 'es', 'ru'],
    default: 'en',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Fix UTF-8 encoding issues
  collection: 'knowledge_documents',
  strict: true,
  versionKey: false
});

// Indexes for better search performance
knowledgeSchema.index({ category: 1, language: 1 });
knowledgeSchema.index({ tags: 1, language: 1 });
knowledgeSchema.index({ status: 1, language: 1 });

// Text search index with proper collation for all languages
knowledgeSchema.index({ 
  title: 'text', 
  content: 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    content: 5,
    tags: 3
  },
  name: 'knowledge_text_search',
  // Better collation for multilingual support
  default_language: 'none', // Allow text search in all languages
  language_override: 'language'
});

// Update the updatedAt field on save
knowledgeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
knowledgeSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    title: obj.title,
    content: obj.content,
    category: obj.category,
    language: obj.language,
    tags: obj.tags || [],
    authorId: obj.authorId,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

// Static methods for searching
knowledgeSchema.statics.findByCategory = function(category, language = null) {
  const query = { category, status: 'published' };
  if (language) query.language = language;
  return this.find(query).sort({ updatedAt: -1 });
};

// Fixed searchText method with better language handling
knowledgeSchema.statics.searchText = function(searchQuery, options = {}) {
  const {
    language = null,
    category = null,
    tags = [],
    limit = 10,
    page = 1
  } = options;

  // Build base query with text search
  const query = {
    $text: { $search: searchQuery },
    status: 'published'
  };

  // Apply filters after text search
  if (language) query.language = language;
  if (category) query.category = category;
  if (tags.length > 0) query.tags = { $in: tags };

  const skip = (page - 1) * limit;

  // Execute search query
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);
};

// Alternative regex-based search for better Unicode support
knowledgeSchema.statics.searchRegex = function(searchQuery, options = {}) {
  const {
    language = null,
    category = null,
    tags = [],
    limit = 10,
    page = 1
  } = options;

  // Create case-insensitive regex
  const regexQuery = new RegExp(searchQuery, 'i');
  
  // Build search query
  const query = {
    $or: [
      { title: regexQuery },
      { content: regexQuery },
      { tags: { $regex: regexQuery } }
    ],
    status: 'published'
  };

  // Apply filters
  if (language) query.language = language;
  if (category) query.category = category;
  if (tags.length > 0) query.tags = { $in: tags };

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Combined search method that tries text search first, then regex
knowledgeSchema.statics.combinedSearch = async function(searchQuery, options = {}) {
  try {
    // First try text search
    const textResults = await this.searchText(searchQuery, options);
    
    // If text search returns results, use them
    if (textResults.length > 0) {
      return textResults;
    }
    
    // Otherwise, fall back to regex search for better Unicode support
    return await this.searchRegex(searchQuery, options);
  } catch (error) {
    // If text search fails, use regex search
    return await this.searchRegex(searchQuery, options);
  }
};

// Export the model
const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeSchema);

module.exports = KnowledgeDocument;