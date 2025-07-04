/**
 * DEBUG VERSION - Analytics route registration debugging
 */

const express = require('express');
const router = express.Router();

console.log('🔧 Analytics routes file loaded!');

router.get('/test', (req, res) => {
  console.log('📊 TEST Analytics endpoint hit!');
  res.json({
    success: true,
    message: 'Analytics API is working!',
    timestamp: new Date().toISOString(),
    debug: 'This proves the route is registered correctly'
  });
});

router.get('/dashboard', (req, res) => {
  console.log('📊 DASHBOARD Analytics endpoint hit!');
  res.json({
    success: true,
    data: {
      overview: {
        totalUsers: 5,
        newUsers: 2,
        totalQuotes: 15,
        avgQuotesPerUser: 3.0,
        activeUsers: 3,
        promoUsage: 1
      },
      sourceStats: [
        { _id: 'Instagram', count: 3 },
        { _id: 'Telegram', count: 2 }
      ],
      utmStats: [
        { campaign: 'test', clicks: 10, uniqueUsers: 5 }
      ],
      period: '7d'
    }
  });
});

router.get('/retention', (req, res) => {
  console.log('📊 RETENTION Analytics endpoint hit!');
  res.json({
    success: true,
    data: [
      { cohort: '2024-12', size: 10, week1: 80, week2: 60, week3: 40, week4: 30 }
    ]
  });
});

router.get('/top-content', (req, res) => {
  console.log('📊 TOP-CONTENT Analytics endpoint hit!');
  res.json({
    success: true,
    data: {
      topAuthors: [{ _id: 'Test Author', count: 5 }],
      topCategories: [{ _id: 'Test Category', count: 8 }],
      popularQuotes: [{ _id: 'Test quote', author: 'Test', count: 2 }]
    }
  });
});

// Catch-all для отладки
router.use('*', (req, res) => {
  console.log('📊 Analytics catch-all hit for:', req.originalUrl);
  res.status(404).json({
    error: 'Analytics endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/analytics/test',
      '/api/analytics/dashboard',
      '/api/analytics/retention', 
      '/api/analytics/top-content'
    ]
  });
});

console.log('🔧 Analytics routes configured with debug endpoints');

module.exports = router;