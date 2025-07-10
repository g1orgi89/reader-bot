/**
 * МИНИМАЛЬНАЯ ВЕРСИЯ Knowledge API для диагностики
 * @file server/api/knowledge-minimal.js
 */

const express = require('express');
const router = express.Router();

console.log('🔍 [KNOWLEDGE-MINIMAL] Starting minimal knowledge API...');

// Минимальный endpoint для проверки работоспособности
router.get('/', (req, res) => {
  console.log('🔍 [KNOWLEDGE-MINIMAL] GET / called');
  res.json({
    success: true,
    message: 'Minimal Knowledge API is working',
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      totalDocs: 0,
      totalPages: 0
    }
  });
});

// Минимальный endpoint статистики
router.get('/stats', (req, res) => {
  console.log('🔍 [KNOWLEDGE-MINIMAL] GET /stats called');
  res.json({
    success: true,
    data: {
      total: 0,
      published: 0,
      draft: 0,
      byLanguage: [],
      byCategory: [],
      recentlyUpdated: [],
      lastUpdated: new Date().toISOString(),
      chunkingEnabled: false,
      vectorStore: {
        status: 'disabled',
        totalVectors: 0,
        documentsCount: 0,
        chunksCount: 0
      },
      chunking: {
        enabled: false,
        totalChunks: 0
      },
      universalSearch: true,
      minimalMode: true
    }
  });
});

// Минимальный endpoint загрузки (заглушка)
router.post('/upload', (req, res) => {
  console.log('🔍 [KNOWLEDGE-MINIMAL] POST /upload called');
  res.status(501).json({
    success: false,
    error: 'Upload functionality temporarily disabled',
    message: 'This is a minimal API version for diagnostics'
  });
});

// Все остальные endpoints
router.get('/:id', (req, res) => {
  console.log('🔍 [KNOWLEDGE-MINIMAL] GET /:id called with id:', req.params.id);
  res.status(404).json({
    success: false,
    error: 'Document not found',
    message: 'This is a minimal API version'
  });
});

router.put('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Update functionality temporarily disabled'
  });
});

router.delete('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Delete functionality temporarily disabled'
  });
});

router.post('/search', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Search temporarily disabled'
  });
});

console.log('✅ [KNOWLEDGE-MINIMAL] Minimal knowledge API routes configured');

module.exports = router;
