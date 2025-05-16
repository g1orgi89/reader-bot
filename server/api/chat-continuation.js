    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Conversation closed successfully',
        conversationId: conversation._id
      }
    });
  } catch (error) {
    logger.error('❌ Error closing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close conversation',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/languages
 * @desc Получение списка поддерживаемых языков
 * @access Public
 */
router.get('/languages', async (req, res) => {
  try {
    const supportedLanguages = languageDetectService.getSupportedLanguages();
    const stats = languageDetectService.getStats();

    res.json({
      success: true,
      data: {
        supportedLanguages,
        defaultLanguage: stats.defaultLanguage,
        stats
      }
    });
  } catch (error) {
    logger.error('❌ Error getting language info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language information',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/detect-language
 * @desc Определение языка текста
 * @access Public
 */
router.post('/detect-language', async (req, res) => {
  try {
    // Проверяем raw body и основной body
    const { text, userId, conversationId } = req.body;
    
    // Логируем входящий текст для отладки
    logger.info('Language detection request:', {
      originalText: text,
      rawBody: req.rawBody,
      headers: req.headers,
      contentType: req.headers['content-type']
    });

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
        code: 'VALIDATION_ERROR'
      });
    }

    // Проверяем, что текст не содержит знаки вопроса (признак неправильной кодировки)
    const hasQuestionMarks = /^\?+,?\s*\?+/.test(text.trim());
    if (hasQuestionMarks && req.rawBody) {
      // Пытаемся распарсить текст из rawBody
      try {
        const rawBodyParsed = JSON.parse(req.rawBody);
        if (rawBodyParsed.text && rawBodyParsed.text !== text) {
          logger.info('Using text from rawBody due to encoding issues');
          const correctedText = rawBodyParsed.text;
          req.body.text = correctedText;
        }
      } catch (parseError) {
        logger.warn('Failed to parse rawBody:', parseError.message);
      }
    }

    // Используем исправленный текст
    const processedText = req.body.text;
    let detectedLanguage;
    let method = 'basic';
    let history = [];

    // Если есть userId и conversationId, получаем историю для контекстного определения
    if (userId && conversationId) {
      try {
        const conversation = await conversationService.findById(conversationId);
        if (conversation) {
          const recentMessages = await messageService.getRecentMessages(conversationId, 5);
          history = recentMessages.map(msg => ({
            role: msg.role,
            content: msg.text
          }));
          
          // Используем контекстное определение языка
          detectedLanguage = languageDetectService.detectLanguageWithContext(processedText, {
            userId,
            conversationId,
            history,
            previousLanguage: conversation.language
          });
          method = 'context-aware';
        } else {
          // Если разговор не найден, используем базовое определение
          detectedLanguage = languageDetectService.detectLanguage(processedText);
        }
      } catch (error) {
        logger.warn('Failed to get conversation history for language detection:', error);
        // Fallback к базовому определению
        detectedLanguage = languageDetectService.detectLanguage(processedText);
      }
    } else {
      // Используем базовое определение языка
      detectedLanguage = languageDetectService.detectLanguage(processedText);
    }

    // Подготавливаем безопасный вывод текста (ограничиваем длину)
    const safeText = processedText.substring(0, 50) + (processedText.length > 50 ? '...' : '');

    res.json({
      success: true,
      data: {
        detectedLanguage,
        text: safeText,
        method,
        metadata: {
          hasHistory: history.length > 0,
          historyCount: history.length,
          textLength: processedText.length,
          encoding: 'utf-8'
        }
      }
    });
  } catch (error) {
    logger.error('❌ Error detecting language:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect language',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/stats
 * @desc Получение статистики чата
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    // Объединяем статистику из разных сервисов
    const [messagesStats, conversationsStats, languageStats] = await Promise.all([
      messageService.getStats(),
      conversationService.getStats(),
      Promise.resolve(languageDetectService.getStats())
    ]);

    res.json({
      success: true,
      data: {
        messages: messagesStats,
        conversations: conversationsStats,
        language: languageStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/messages/:messageId/edit
 * @desc Редактирование сообщения
 * @access Public
 */
router.post('/messages/:messageId/edit', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newText, editedBy } = req.body;

    if (!newText) {
      return res.status(400).json({
        success: false,
        error: 'New text is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const editedMessage = await messageService.editMessage(messageId, newText, editedBy);

    if (!editedMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: editedMessage,
        editHistory: editedMessage.editHistory
      }
    });
  } catch (error) {
    logger.error('❌ Error editing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit message',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/search
 * @desc Поиск сообщений
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, userId, conversationId, language, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      userId,
      conversationId,
      language
    };

    const messages = await messageService.searchMessages(q, searchOptions);

    res.json({
      success: true,
      data: {
        messages,
        query: q,
        count: messages.length,
        options: searchOptions
      }
    });
  } catch (error) {
    logger.error('❌ Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/health
 * @desc Проверка здоровья API чата
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const [
      claudeHealth,
      messageHealth,
      conversationHealth,
      vectorHealth
    ] = await Promise.all([
      Promise.resolve(claudeService.isHealthy()),
      messageService.healthCheck(),
      conversationService.healthCheck(),
      vectorStoreService.healthCheck()
    ]);

    const overall = claudeHealth && 
                   messageHealth.status === 'ok' && 
                   conversationHealth.status === 'ok' && 
                   vectorHealth.status === 'ok';

    res.status(overall ? 200 : 503).json({
      success: overall,
      status: overall ? 'healthy' : 'unhealthy',
      services: {
        claude: claudeHealth ? 'ok' : 'error',
        messages: messageHealth.status,
        conversations: conversationHealth.status,
        vectorStore: vectorHealth.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/chat/users/:userId/clear-language-cache
 * @desc Очищает кеш языковых предпочтений пользователя
 * @access Public
 */
router.post('/users/:userId/clear-language-cache', async (req, res) => {
  try {
    const { userId } = req.params;
    
    languageDetectService.clearLanguageCache(userId);
    
    res.json({
      success: true,
      data: {
        message: `Language cache cleared for user: ${userId}`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error clearing language cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear language cache',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
