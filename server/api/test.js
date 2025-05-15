/**
 * Test endpoint for Russian search debugging
 * @file server/api/test.js
 */

const express = require('express');
const router = express.Router();
const knowledgeService = require('../services/knowledge');
const logger = require('../utils/logger');

// Middleware to ensure UTF-8 encoding
router.use((req, res, next) => {
  res.charset = 'utf-8';
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * @route GET /api/test/search-russian
 * @desc Test Russian text search with predefined queries
 * @access Public
 */
router.get('/search-russian', async (req, res) => {
  try {
    const testQueries = [
      { query: 'кошелек', language: 'ru' },
      { query: 'подключение', language: 'ru' },
      { query: 'проблемы', language: 'ru' },
      { query: 'споры', language: 'ru' }
    ];

    const results = {};

    for (const { query, language } of testQueries) {
      try {
        const result = await knowledgeService.search(query, { language, limit: 5 });
        results[query] = {
          success: result.success,
          count: result.count,
          searchType: result.searchType,
          titles: result.data ? result.data.map(doc => doc.title) : []
        };
      } catch (error) {
        results[query] = {
          success: false,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      message: 'Russian search test completed',
      results
    });

    logger.info('Russian search test completed');
  } catch (error) {
    logger.error('Russian search test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/search-custom
 * @desc Test custom search query
 * @access Public
 * @body {string} query - Search query
 * @body {string} [language] - Language filter
 */
router.post('/search-custom', async (req, res) => {
  try {
    const { query, language } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // Test both text and regex search
    const textResult = await knowledgeService.search(query, { 
      language, 
      limit: 5,
      forceRegex: false 
    });

    const regexResult = await knowledgeService.search(query, { 
      language, 
      limit: 5,
      forceRegex: true 
    });

    res.json({
      success: true,
      query,
      language,
      results: {
        textSearch: {
          success: textResult.success,
          count: textResult.count,
          searchType: textResult.searchType,
          data: textResult.data || []
        },
        regexSearch: {
          success: regexResult.success,
          count: regexResult.count,
          searchType: regexResult.searchType,
          data: regexResult.data || []
        }
      }
    });

    logger.info(`Custom search test: "${query}" (${language || 'any'})`);
  } catch (error) {
    logger.error('Custom search test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/test/encoding
 * @desc Test UTF-8 encoding
 * @access Public
 */
router.get('/encoding', (req, res) => {
  const testStrings = {
    russian: 'кошелек подключение споры',
    spanish: 'billetera conexión esporas',
    english: 'wallet connection spores',
    mixed: 'wallet кошелек billetera'
  };

  res.json({
    success: true,
    message: 'UTF-8 encoding test',
    testStrings,
    headers: {
      'content-type': res.get('Content-Type'),
      'charset': res.charset
    }
  });
});

module.exports = router;