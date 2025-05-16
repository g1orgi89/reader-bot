const express = require('express');
const router = express.Router();
const languageDetectService = require('../services/languageDetect');
const logger = require('../utils/logger');

/**
 * @route POST /api/admin/detect-language
 * @desc Тестирование определения языка (для отладки)
 * @access Private
 */
router.post('/detect-language', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Базовое определение
    const basicDetection = languageDetectService.detectLanguage(text);
    
    // Определение с контекстом (если есть дополнительные данные)
    const contextDetection = languageDetectService.detectLanguageWithContext(text, req.body.context || {});
    
    // Получаем статистику
    const stats = languageDetectService.getStats();
    
    res.json({
      success: true,
      data: {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        basicDetection,
        contextDetection,
        stats: stats.detectionStats
      }
    });
  } catch (error) {
    logger.error('Language detection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect language'
    });
  }
});

/**
 * @route POST /api/admin/clear-language-cache
 * @desc Очистка кеша языков
 * @access Private
 */
router.post('/clear-language-cache', (req, res) => {
  try {
    const { userId } = req.body;
    
    languageDetectService.clearLanguageCache(userId);
    
    res.json({
      success: true,
      message: userId ? 
        `Language cache cleared for user: ${userId}` : 
        'All language cache cleared'
    });
  } catch (error) {
    logger.error('Clear language cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear language cache'
    });
  }
});

/**
 * @route GET /api/admin/language-stats
 * @desc Получение статистики определения языков
 * @access Private
 */
router.get('/language-stats', (req, res) => {
  try {
    const stats = languageDetectService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Language stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language statistics'
    });
  }
});

/**
 * @route POST /api/admin/reset-language-stats
 * @desc Сброс статистики определения языков
 * @access Private
 */
router.post('/reset-language-stats', (req, res) => {
  try {
    languageDetectService.resetStats();
    
    res.json({
      success: true,
      message: 'Language detection statistics reset'
    });
  } catch (error) {
    logger.error('Reset language stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset language statistics'
    });
  }
});

module.exports = router;