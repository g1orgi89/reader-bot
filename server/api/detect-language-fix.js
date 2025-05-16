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
