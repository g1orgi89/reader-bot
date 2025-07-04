const express = require('express');
const router = express.Router();

// Простой тест endpoint
router.get('/test', (req, res) => {
  console.log('📊 Analytics test endpoint hit!');
  res.json({
    success: true,
    message: 'Analytics API is working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/dashboard', (req, res) => {
  console.log('📊 Dashboard endpoint hit!');
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
  console.log('📊 Retention endpoint hit!');
  res.json({
    success: true,
    data: [
      { cohort: '2024-12', size: 10, week1: 80, week2: 60, week3: 40, week4: 30 }
    ]
  });
});

router.get('/top-content', (req, res) => {
  console.log('📊 Top content endpoint hit!');
  res.json({
    success: true,
    data: {
      topAuthors: [{ _id: 'Test Author', count: 5 }],
      topCategories: [{ _id: 'Test Category', count: 8 }],
      popularQuotes: [{ _id: 'Test quote', author: 'Test', count: 2 }]
    }
  });
});

module.exports = router;