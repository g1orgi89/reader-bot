/**
 * Knowledge Base API Routes - Enhanced multilingual search
 * @file server/api/knowledge.js
 */

const express = require('express');
const router = express.Router();
const KnowledgeDocument = require('../models/knowledge');
const knowledgeService = require('../services/knowledge');
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

    // Use knowledge service for better handling
    const result = await knowledgeService.getDocuments({
      category,
      language,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'RETRIEVAL_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

    logger.info(`Knowledge documents retrieved: ${result.data.length}`);
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
 * @desc Search knowledge documents by text with enhanced multilingual support
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

    // Use enhanced search service
    const result = await knowledgeService.search(searchQuery, {
      language,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'SEARCH_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
      query: searchQuery,
      count: result.count,
      searchType: result.searchType
    });

    logger.info(`Knowledge search performed: "${searchQuery}" (${result.searchType}) - ${result.count} results`);
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

    const result = await knowledgeService.getDocumentById(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
        errorCode: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result.data
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

    const result = await knowledgeService.addDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      language,
      tags: Array.isArray(tags) ? tags : [],
      authorId
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        errorCode: 'CREATION_ERROR'
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Document created successfully'
    });

    logger.info(`Knowledge document created: ${result.data.id} - "${title}"`);
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

    const result = await knowledgeService.updateDocument(id, updateData);

    if (!result.success) {
      const statusCode = result.error === 'Document not found' ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCode: statusCode === 404 ? 'DOCUMENT_NOT_FOUND' : 'UPDATE_ERROR'
      });
    }

    res.json({
      success: true,
      data: result.data,
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

    const result = await knowledgeService.deleteDocument(id);

    if (!result.success) {
      const statusCode = result.error === 'Document not found' ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCode: statusCode === 404 ? 'DOCUMENT_NOT_FOUND' : 'DELETION_ERROR'
      });
    }

    res.json({
      success: true,
      message: result.message
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