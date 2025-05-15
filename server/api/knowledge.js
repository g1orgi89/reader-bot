/**
 * Knowledge Base API Routes - Fixed UTF-8 support
 * @file server/api/knowledge.js
 */

const express = require('express');
const router = express.Router();
const KnowledgeDocument = require('../models/knowledge');
const logger = require('../utils/logger');

// Middleware to ensure UTF-8 encoding
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/knowledge
 * @desc Get knowledge documents with optional filtering
 * @access Public
 * @param {string} [category] - Filter by category
 * @param {string} [language] - Filter by language
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      language,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { status: 'published' };
    if (category) query.category = category;
    if (language) query.language = language;
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [documents, totalCount] = await Promise.all([
      KnowledgeDocument.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      KnowledgeDocument.countDocuments(query)
    ]);

    // Transform documents for response
    const responseData = documents.map(doc => ({
      id: doc._id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      language: doc.language,
      tags: doc.tags || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    res.json({
      success: true,
      data: responseData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

    logger.info(`Knowledge documents retrieved: ${documents.length} of ${totalCount}`);
  } catch (error) {
    logger.error(`Error retrieving knowledge documents: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/search
 * @desc Search knowledge documents by text
 * @access Public
 * @param {string} q - Search query
 * @param {string} [language] - Filter by language
 * @param {string} [category] - Filter by category
 * @param {string} [tags] - Filter by tags (comma-separated)
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Results per page
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q: searchQuery,
      language,
      category,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        errorCode: 'MISSING_SEARCH_QUERY'
      });
    }

    // Prepare search options
    const searchOptions = {
      language,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: Math.max(1, parseInt(page)),
      limit: Math.min(50, Math.max(1, parseInt(limit)))
    };

    // Perform text search
    const documents = await KnowledgeDocument.searchText(searchQuery, searchOptions);

    // Transform documents for response
    const responseData = documents.map(doc => ({
      id: doc._id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      language: doc.language,
      tags: doc.tags || [],
      score: doc.score || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    res.json({
      success: true,
      data: responseData,
      query: searchQuery,
      count: documents.length
    });

    logger.info(`Knowledge search performed: "${searchQuery}" - ${documents.length} results`);
  } catch (error) {
    logger.error(`Error searching knowledge: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      errorCode: 'SEARCH_ERROR'
    });
  }
});

/**
 * @route GET /api/knowledge/:id
 * @desc Get a specific knowledge document
 * @access Public
 * @param {string} id - Document ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const document = await KnowledgeDocument.findById(id).lean();
    
    if (!document || document.status !== 'published') {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    const responseData = {
      id: document._id,
      title: document.title,
      content: document.content,
      category: document.category,
      language: document.language,
      tags: document.tags || [],
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };

    res.json({
      success: true,
      data: responseData
    });

    logger.info(`Knowledge document retrieved: ${id}`);
  } catch (error) {
    logger.error(`Error retrieving knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve document',
      errorCode: 'RETRIEVAL_ERROR'
    });
  }
});

/**
 * @route POST /api/knowledge
 * @desc Create a new knowledge document
 * @access Public (should be protected in production)
 * @body {string} title - Document title
 * @body {string} content - Document content
 * @body {string} category - Document category
 * @body {string} [language=en] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [authorId] - Author ID
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      language = 'en',
      tags = [],
      authorId
    } = req.body;

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, content, and category are required',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Create document
    const document = new KnowledgeDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      language,
      tags: Array.isArray(tags) ? tags : [],
      authorId
    });

    await document.save();

    const responseData = document.toPublicJSON();

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Document created successfully'
    });

    logger.info(`Knowledge document created: ${document._id} - "${title}"`);
  } catch (error) {
    logger.error(`Error creating knowledge document: ${error.message}`);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create document',
      errorCode: 'CREATION_ERROR'
    });
  }
});

/**
 * @route PUT /api/knowledge/:id
 * @desc Update a knowledge document
 * @access Public (should be protected in production)
 * @param {string} id - Document ID
 * @body {string} [title] - Document title
 * @body {string} [content] - Document content
 * @body {string} [category] - Document category
 * @body {string} [language] - Document language
 * @body {string[]} [tags] - Document tags
 * @body {string} [status] - Document status
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.authorId;

    // Update document
    const document = await KnowledgeDocument.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    const responseData = document.toPublicJSON();

    res.json({
      success: true,
      data: responseData,
      message: 'Document updated successfully'
    });

    logger.info(`Knowledge document updated: ${id}`);
  } catch (error) {
    logger.error(`Error updating knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message),
        errorCode: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update document',
      errorCode: 'UPDATE_ERROR'
    });
  }
});

/**
 * @route DELETE /api/knowledge/:id
 * @desc Delete a knowledge document
 * @access Public (should be protected in production)
 * @param {string} id - Document ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const document = await KnowledgeDocument.findByIdAndDelete(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

    logger.info(`Knowledge document deleted: ${id}`);
  } catch (error) {
    logger.error(`Error deleting knowledge document: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
        errorCode: 'INVALID_ID'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      errorCode: 'DELETION_ERROR'
    });
  }
});

module.exports = router;