/**
 * Message Classifier for Reader Bot - Smart detection of quotes vs questions
 * @file telegram/helpers/messageClassifier.js
 * 📖 READER BOT: Intelligent message classification to separate quotes from questions
 * 
 * Features:
 * - AI-powered content analysis through Claude
 * - Pattern-based detection (quote formats)
 * - Context-aware classification
 * - Fallback logic for unclear messages
 */

const logger = require('../../server/utils/logger');
const claudeService = require('../../server/services/claude');

/**
 * @typedef {Object} ClassificationResult
 * @property {string} type - 'quote', 'question', 'command', 'ambiguous'
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} reason - Reason for classification
 * @property {Object} metadata - Additional metadata
 */

/**
 * @class MessageClassifier
 * @description Smart classifier to distinguish quotes from questions and commands
 */
class MessageClassifier {
  constructor() {
    // Quote format patterns
    this.quotePatterns = [
      /^"([^"]+)"\s*\(([^)]+)\)$/,         // "Text" (Author)
      /^"([^"]+)"\s*-\s*(.+)$/,            // "Text" - Author
      /^([^-()]+)\s*\(([^)]+)\)$/,         // Text (Author)
      /^([^-()]+)\s*-\s*(.+)$/,            // Text - Author
      /^«([^»]+)»\s*\(([^)]+)\)$/,         // «Text» (Author)
      /^«([^»]+)»\s*-\s*(.+)$/,            // «Text» - Author
    ];

    // Question indicators
    this.questionIndicators = [
      /^(как|что|где|когда|почему|зачем|кто|какой|какая|какие|чем|чего|кому)\s/i,
      /\?$/,
      /можете?\s+(помочь|объяснить|рассказать|посоветовать)/i,
      /помогите/i,
      /не понимаю/i,
      /объясни(те)?/i,
      /расскаж(и|ите)/i,
      /посовету(й|йте)/i
    ];

    // Command indicators 
    this.commandIndicators = [
      /^\/\w+/,
      /^(покажи|открой|найди|удали|экспорт)/i,
      /^(настройки|статистика|дневник|помощь|меню)/i
    ];

    // Complex question patterns (for Anna's attention)
    this.complexQuestionPatterns = [
      /не знаю что делать/i,
      /проблема/i,
      /депрессия/i,
      /консультация/i,
      /помогите разобраться/i,
      /личн(ая|ые) проблем/i,
      /отношения/i,
      /семья/i,
      /психолог/i
    ];

    logger.info('📖 MessageClassifier initialized with smart quote detection');
  }

  /**
   * Classify message content
   * @param {string} messageText - Message to classify
   * @param {Object} [context] - Additional context
   * @param {string} [context.userId] - User ID for context
   * @param {Object} [context.userProfile] - User profile
   * @returns {Promise<ClassificationResult>}
   */
  async classifyMessage(messageText, context = {}) {
    try {
      // 1. Quick format-based detection
      const formatResult = this.detectByFormat(messageText);
      if (formatResult.confidence > 0.8) {
        return formatResult;
      }

      // 2. Pattern-based detection
      const patternResult = this.detectByPatterns(messageText);
      if (patternResult.confidence > 0.7) {
        return patternResult;
      }

      // 3. AI-powered analysis for ambiguous cases
      const aiResult = await this.classifyWithAI(messageText, context);
      if (aiResult.confidence > 0.6) {
        return aiResult;
      }

      // 4. Fallback to ambiguous
      return {
        type: 'ambiguous',
        confidence: 0.5,
        reason: 'Unable to determine with high confidence',
        metadata: {
          formatDetection: formatResult,
          patternDetection: patternResult,
          aiDetection: aiResult
        }
      };

    } catch (error) {
      logger.error(`📖 Error classifying message: ${error.message}`);
      
      // Safe fallback - treat as question if contains question words
      return this.detectByPatterns(messageText);
    }
  }

  /**
   * Detect message type by format patterns
   * @param {string} messageText - Message text
   * @returns {ClassificationResult}
   */
  detectByFormat(messageText) {
    const text = messageText.trim();

    // Check for quote patterns
    for (const pattern of this.quotePatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        return {
          type: 'quote',
          confidence: 0.9,
          reason: 'Matches standard quote format',
          metadata: {
            pattern: pattern.toString(),
            extractedText: match[1],
            extractedAuthor: match[2] || null
          }
        };
      }
    }

    // Check for command patterns
    for (const pattern of this.commandIndicators) {
      if (pattern.test(text)) {
        return {
          type: 'command',
          confidence: 0.95,
          reason: 'Matches command pattern',
          metadata: {
            pattern: pattern.toString()
          }
        };
      }
    }

    // Check for obvious questions
    for (const pattern of this.questionIndicators) {
      if (pattern.test(text)) {
        return {
          type: 'question',
          confidence: 0.8,
          reason: 'Contains question indicators',
          metadata: {
            pattern: pattern.toString()
          }
        };
      }
    }

    return {
      type: 'ambiguous',
      confidence: 0.3,
      reason: 'No clear format pattern detected',
      metadata: {}
    };
  }

  /**
   * Detect message type by content patterns
   * @param {string} messageText - Message text
   * @returns {ClassificationResult}
   */
  detectByPatterns(messageText) {
    const text = messageText.trim().toLowerCase();

    // Check for complex questions (high priority)
    for (const pattern of this.complexQuestionPatterns) {
      if (pattern.test(text)) {
        return {
          type: 'complex_question',
          confidence: 0.9,
          reason: 'Contains complex question patterns requiring personal attention',
          metadata: {
            requiresAnnaAttention: true,
            pattern: pattern.toString()
          }
        };
      }
    }

    // Check message length and characteristics
    if (text.length > 500) {
      return {
        type: 'complex_question',
        confidence: 0.7,
        reason: 'Long message likely contains detailed question',
        metadata: {
          length: text.length,
          requiresAnnaAttention: true
        }
      };
    }

    // Check for wisdom/philosophical content (potential quotes)
    const wisdomKeywords = [
      'мудрость', 'жизнь', 'любовь', 'счастье', 'истина', 'красота', 
      'смысл', 'судьба', 'время', 'душа', 'сердце', 'мечта'
    ];

    const hasWisdomKeywords = wisdomKeywords.some(keyword => 
      text.includes(keyword)
    );

    if (hasWisdomKeywords && text.length < 200 && !text.includes('?')) {
      return {
        type: 'quote',
        confidence: 0.6,
        reason: 'Contains wisdom keywords without question marks',
        metadata: {
          wisdomKeywords: true,
          length: text.length
        }
      };
    }

    // Default to question if contains question words
    if (text.includes('?') || 
        /^(как|что|где|когда|почему)/i.test(text)) {
      return {
        type: 'question',
        confidence: 0.6,
        reason: 'Contains question indicators',
        metadata: {}
      };
    }

    return {
      type: 'ambiguous',
      confidence: 0.4,
      reason: 'No clear pattern detected',
      metadata: {}
    };
  }

  /**
   * Classify message using AI analysis
   * @param {string} messageText - Message text
   * @param {Object} context - Additional context
   * @returns {Promise<ClassificationResult>}
   */
  async classifyWithAI(messageText, context = {}) {
    try {
      const prompt = `Определи тип сообщения для бота "Читатель" (личный дневник цитат от психолога Анны Бусел).

Сообщение: "${messageText}"

Контекст: Пользователь может:
1. Присылать ЦИТАТЫ из книг или свои мысли для сохранения в дневник
2. Задавать ВОПРОСЫ боту или просить помощи
3. Отправлять КОМАНДЫ для управления ботом

Определи тип сообщения:

QUOTE - если это:
- Мудрое высказывание, афоризм, цитата из книги
- Вдохновляющая мысль или фраза
- Философское размышление
- Короткое изречение с глубоким смыслом

QUESTION - если это:
- Вопрос боту или просьба о помощи
- Обращение за советом или информацией
- Общение с ассистентом
- Просьба объяснить что-то

COMPLEX_QUESTION - если это:
- Личные проблемы (депрессия, отношения, семья)
- Просьба о психологической консультации
- Сложные жизненные вопросы
- Вопросы, требующие внимания психолога Анны

COMMAND - если это команда боту (настройки, статистика и т.д.)

AMBIGUOUS - если неясно

Ответь ТОЛЬКО одним словом: QUOTE, QUESTION, COMPLEX_QUESTION, COMMAND или AMBIGUOUS`;

      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: context.userId || 'classifier'
      });

      const aiType = response.message.trim().toLowerCase();
      
      // Map AI response to our types
      const typeMapping = {
        'quote': 'quote',
        'question': 'question', 
        'complex_question': 'complex_question',
        'command': 'command',
        'ambiguous': 'ambiguous'
      };

      const detectedType = typeMapping[aiType] || 'ambiguous';
      
      return {
        type: detectedType,
        confidence: detectedType === 'ambiguous' ? 0.5 : 0.8,
        reason: `AI classification: ${aiType}`,
        metadata: {
          aiResponse: response.message,
          requiresAnnaAttention: detectedType === 'complex_question'
        }
      };

    } catch (error) {
      logger.error(`📖 AI classification failed: ${error.message}`);
      
      // Fallback to pattern detection
      return {
        type: 'ambiguous',
        confidence: 0.3,
        reason: 'AI classification failed, using fallback',
        metadata: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check if message is likely a quote based on content
   * @param {string} messageText - Message text
   * @returns {boolean}
   */
  isLikelyQuote(messageText) {
    const result = this.detectByFormat(messageText);
    return result.type === 'quote' && result.confidence > 0.7;
  }

  /**
   * Check if message is likely a question
   * @param {string} messageText - Message text  
   * @returns {boolean}
   */
  isLikelyQuestion(messageText) {
    const result = this.detectByPatterns(messageText);
    return ['question', 'complex_question'].includes(result.type) && result.confidence > 0.6;
  }

  /**
   * Extract quote parts from message
   * @param {string} messageText - Message text
   * @returns {Object|null} - {text, author} or null
   */
  extractQuoteParts(messageText) {
    const text = messageText.trim();

    for (const pattern of this.quotePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          text: match[1]?.trim(),
          author: match[2]?.trim() || null
        };
      }
    }

    // If no pattern matches but likely a quote, return as is
    if (this.isLikelyQuote(messageText)) {
      return {
        text: text,
        author: null
      };
    }

    return null;
  }

  /**
   * Create user confirmation for ambiguous messages
   * @param {string} messageText - Original message
   * @returns {Object} - Telegram inline keyboard
   */
  createAmbiguityResolutionKeyboard(messageText) {
    // Truncate message for display
    const displayText = messageText.length > 50 
      ? messageText.substring(0, 50) + '...'
      : messageText;

    return {
      text: `Не совсем понял, что вы хотели:\n\n"${displayText}"\n\nЭто:`,
      keyboard: {
        inline_keyboard: [
          [
            { 
              text: "📖 Цитата для дневника", 
              callback_data: `classify_quote_${Buffer.from(messageText).toString('base64').substring(0, 30)}` 
            },
            { 
              text: "💬 Вопрос боту", 
              callback_data: `classify_question_${Buffer.from(messageText).toString('base64').substring(0, 30)}` 
            }
          ],
          [
            { 
              text: "❌ Отменить", 
              callback_data: "classify_cancel" 
            }
          ]
        ]
      }
    };
  }

  /**
   * Get classifier statistics
   * @returns {Object}
   */
  getStats() {
    return {
      patterns: {
        quotePatterns: this.quotePatterns.length,
        questionIndicators: this.questionIndicators.length,
        commandIndicators: this.commandIndicators.length,
        complexQuestionPatterns: this.complexQuestionPatterns.length
      },
      features: {
        formatDetection: true,
        patternDetection: true,
        aiClassification: true,
        ambiguityResolution: true
      }
    };
  }
}

module.exports = { MessageClassifier };
