const express = require('express');
const router = express.Router();
const languageDetectService = require('../services/languageDetect');
const logger = require('../utils/logger');

// Middleware для обработки UTF-8 энкодинга
router.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Сохраняем raw body для отладки проблем с кодировкой
    req.rawBody = buf;
  }
}));

/**
 * @route POST /api/admin/language/detect-language  
 * @desc Тестирование определения языка (для отладки)
 * @access Private
 */
router.post('/detect-language', (req, res) => {
  try {
    logger.info('Language detection request received', {
      headers: req.headers,
      contentType: req.headers['content-type'],
      body: req.body,
      rawBodyLength: req.rawBody ? req.rawBody.length : 0
    });

    let text = req.body.text;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    // Проверяем на проблемы с кодировкой
    if (typeof text !== 'string') {
      logger.warn('Text is not a string, attempting conversion', { 
        type: typeof text,
        value: text 
      });
      text = String(text);
    }

    // Обрабатываем случаи неправильной кодировки
    if (text.includes('?') && req.rawBody) {
      try {
        // Пытаемся прочитать данные как UTF-8
        const rawString = req.rawBody.toString('utf8');
        const parsed = JSON.parse(rawString);
        if (parsed.text && parsed.text !== text) {
          logger.info('Using text from raw body due to encoding issues');
          text = parsed.text;
        }
      } catch (parseError) {
        logger.warn('Failed to parse raw body for encoding fix', parseError.message);
      }
    }

    logger.info(`Processing language detection for: "${text.substring(0, 50)}..."`);

    // Базовое определение через утилиту  
    const { detect, detectWithConfidence } = require('../utils/languageDetect');
    const basicDetection = detect(text);
    const confidenceResult = detectWithConfidence(text);
    
    // Определение с контекстом
    const contextDetection = languageDetectService.detectLanguageWithContext(text, {
      userId: req.body.userId,
      conversationId: req.body.conversationId,
      history: req.body.history || [],
      previousLanguage: req.body.previousLanguage
    });
    
    // Получаем статистику
    const stats = languageDetectService.getStats();
    
    const response = {
      success: true,
      data: {
        originalText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        textLength: text.length,
        basicDetection,
        confidence: confidenceResult.confidence,
        contextDetection,
        hasContext: !!(req.body.history && req.body.history.length > 0),
        stats: stats.detectionStats,
        encoding: {
          detectedEncoding: 'utf-8',
          hasEncodingIssues: text.includes('�') || /^\?+/.test(text),
          rawBodyAvailable: !!req.rawBody
        }
      }
    };

    res.json(response);
    
    logger.info('Language detection successful', {
      basicDetection,
      contextDetection,
      confidence: confidenceResult.confidence,
      textPreview: text.substring(0, 30)
    });
    
  } catch (error) {
    logger.error('Language detection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect language',
      code: 'DETECTION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/admin/language/clear-language-cache
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
        'All language cache cleared',
      timestamp: new Date().toISOString()
    });
    
    logger.info('Language cache cleared', { 
      userId: userId || 'all',
      clearedBy: req.admin?.username || 'unknown'
    });
    
  } catch (error) {
    logger.error('Clear language cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear language cache',
      code: 'CACHE_CLEAR_ERROR'
    });
  }
});

/**
 * @route GET /api/admin/language/language-stats
 * @desc Получение статистики определения языков
 * @access Private
 */
router.get('/language-stats', (req, res) => {
  try {
    const stats = languageDetectService.getStats();
    
    // Добавляем дополнительную информацию
    const enhancedStats = {
      ...stats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      data: enhancedStats
    });
    
  } catch (error) {
    logger.error('Language stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language statistics',
      code: 'STATS_ERROR'
    });
  }
});

/**
 * @route POST /api/admin/language/reset-language-stats
 * @desc Сброс статистики определения языков
 * @access Private
 */
router.post('/reset-language-stats', (req, res) => {
  try {
    languageDetectService.resetStats();
    
    res.json({
      success: true,
      message: 'Language detection statistics reset',
      timestamp: new Date().toISOString(),
      resetBy: req.admin?.username || 'unknown'
    });
    
    logger.info('Language detection statistics reset', {
      resetBy: req.admin?.username || 'unknown'
    });
    
  } catch (error) {
    logger.error('Reset language stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset language statistics',
      code: 'STATS_RESET_ERROR'
    });
  }
});

/**
 * @route POST /api/admin/language/test-encoding
 * @desc Тестирование различных кодировок
 * @access Private  
 */
router.post('/test-encoding', (req, res) => {
  try {
    const testTexts = [
      'Hello world!',
      'Привет мир!', 
      '¡Hola mundo!',
      'como estas?',
      'приветэ'
    ];
    
    const results = testTexts.map(text => {
      const detection = languageDetectService.detectLanguageWithContext(text);
      const { detectWithConfidence } = require('../utils/languageDetect');
      const confidence = detectWithConfidence(text);
      
      return {
        text,
        detectedLanguage: detection,
        confidence: confidence.confidence,
        encodingInfo: {
          hasUnicode: /[\u0080-\uFFFF]/.test(text),
          length: text.length,
          bytes: Buffer.from(text, 'utf8').length
        }
      };
    });
    
    res.json({
      success: true,
      data: {
        testResults: results,
        serverEncoding: 'utf8',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Encoding test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test encoding',
      code: 'ENCODING_TEST_ERROR'
    });
  }
});

module.exports = router;
