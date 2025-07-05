/**
 * Smart Message Classifier for Reader bot
 * @file telegram/helpers/messageClassifier.js
 * 🧠 SMART UX: Intelligent message classification for better user experience
 * 📖 READER THEME: Specialized for quotes vs questions detection
 */

const logger = require('../../server/utils/logger');

/**
 * @typedef {Object} ClassificationResult
 * @property {string} type - Classification type ('quote', 'question', 'complex_question', 'command', 'ambiguous')
 * @property {number} confidence - Confidence score 0-1
 * @property {Array} indicators - List of indicators that influenced the classification
 * @property {Object} metadata - Additional classification metadata
 */

/**
 * @class MessageClassifier
 * @description Smart message classifier for Reader bot to distinguish quotes from questions
 */
class MessageClassifier {
  constructor() {
    // Quote indicators (patterns that suggest a quote)
    this.quoteIndicators = {
      // Strong quote patterns
      hasQuotes: {
        weight: 0.8,
        patterns: [/["«»""]/, /'/],
        description: 'Contains quotation marks'
      },
      hasAuthorPattern: {
        weight: 0.9,
        patterns: [
          /\([^)]+\)$/,           // (Author) at end
          /—\s*[A-ZА-Я][^.!?]*$/, // — Author at end
          /-\s*[A-ZА-Я][^.!?]*$/  // - Author at end
        ],
        description: 'Has author attribution pattern'
      },
      philosophicalWords: {
        weight: 0.6,
        words: [
          'жизнь', 'любовь', 'счастье', 'мудрость', 'истина', 'красота',
          'смысл', 'душа', 'сердце', 'время', 'вечность', 'свобода',
          'судьба', 'надежда', 'вера', 'добро', 'зло', 'справедливость'
        ],
        description: 'Contains philosophical vocabulary'
      },
      literaryStyle: {
        weight: 0.4,
        patterns: [
          /[.]{3}/, // Ellipsis
          /[,:;]/, // Literary punctuation
          /\b(ибо|дабы|коль|токмо|сей|оный)\b/i // Archaic words
        ],
        description: 'Literary or poetic style'
      },
      definitiveStatements: {
        weight: 0.5,
        patterns: [
          /^[A-ZА-Я].*[.!]$/,      // Starts with capital, ends with period/exclamation
          /\b(это|есть|значит|означает)\b/i,
          /\b(всегда|никогда|все|каждый)\b/i
        ],
        description: 'Makes definitive statements'
      }
    };

    // Question indicators
    this.questionIndicators = {
      hasQuestionMark: {
        weight: 0.9,
        patterns: [/\?/],
        description: 'Contains question mark'
      },
      questionWords: {
        weight: 0.8,
        words: [
          'что', 'как', 'почему', 'зачем', 'где', 'когда', 'кто',
          'какой', 'какая', 'какие', 'сколько', 'можно', 'нужно',
          'стоит', 'помогите', 'объясните', 'расскажите'
        ],
        description: 'Contains question words'
      },
      helpRequests: {
        weight: 0.7,
        patterns: [
          /\b(помоги|помогите|подскажи|подскажите|объясни|объясните)\b/i,
          /\b(можешь|можете|умеешь|умеете)\b/i,
          /\b(как\s+(мне|нам|лучше|правильно))\b/i
        ],
        description: 'Requests help or explanation'
      },
      uncertaintyWords: {
        weight: 0.6,
        words: [
          'может', 'возможно', 'наверное', 'кажется', 'думаю',
          'считаю', 'полагаю', 'не знаю', 'не понимаю', 'сомневаюсь'
        ],
        description: 'Expresses uncertainty'
      }
    };

    // Complex question indicators (requiring Anna's personal attention)
    this.complexQuestionIndicators = {
      personalProblems: {
        weight: 0.8,
        words: [
          'депрессия', 'тревога', 'паника', 'страх', 'боль', 'грусть',
          'одиночество', 'проблема', 'кризис', 'развод', 'расставание',
          'потеря', 'смерть', 'болезнь', 'зависимость'
        ],
        description: 'Mentions personal problems'
      },
      needsConsultation: {
        weight: 0.7,
        patterns: [
          /\b(консультация|совет|рекомендация|что\s+делать)\b/i,
          /\b(помогите\s+разобраться|не\s+знаю\s+что\s+делать)\b/i,
          /\b(как\s+быть|что\s+делать|как\s+поступить)\b/i
        ],
        description: 'Explicitly requests consultation'
      },
      longComplexText: {
        weight: 0.3,
        test: (text) => text.length > 500 && text.split('.').length > 3,
        description: 'Long complex message'
      }
    };

    // Command patterns
    this.commandPatterns = [
      /^\/\w+/, // Slash commands
      /^(меню|menu|помощь|help|статистика|stats|дневник|diary)$/i
    ];

    // Statistics
    this.stats = {
      totalClassifications: 0,
      typeDistribution: {
        quote: 0,
        question: 0,
        complex_question: 0,
        command: 0,
        ambiguous: 0
      },
      averageConfidence: 0,
      confidenceSum: 0
    };

    logger.info('🧠 MessageClassifier initialized with smart quote/question detection');
  }

  /**
   * Classify a message
   * @param {string} messageText - The message to classify
   * @param {Object} context - Additional context
   * @param {string} context.userId - User ID
   * @param {Object} context.userProfile - User profile
   * @returns {Promise<ClassificationResult>}
   */
  async classifyMessage(messageText, context = {}) {
    try {
      const text = messageText.trim();
      
      // Update stats
      this.stats.totalClassifications++;

      // Quick command check
      if (this._isCommand(text)) {
        return this._createResult('command', 1.0, ['command_pattern'], { isSlashCommand: text.startsWith('/') });
      }

      // Calculate scores for each type
      const quoteScore = this._calculateQuoteScore(text);
      const questionScore = this._calculateQuestionScore(text);
      const complexQuestionScore = this._calculateComplexQuestionScore(text);

      logger.debug(`🧠 Classification scores - Quote: ${quoteScore.score.toFixed(2)}, Question: ${questionScore.score.toFixed(2)}, Complex: ${complexQuestionScore.score.toFixed(2)}`);

      // Determine classification
      const result = this._determineClassification(text, quoteScore, questionScore, complexQuestionScore, context);
      
      // Update statistics
      this._updateStats(result);

      return result;

    } catch (error) {
      logger.error(`🧠 Error classifying message: ${error.message}`);
      
      // Fallback to ambiguous with low confidence
      return this._createResult('ambiguous', 0.1, ['classification_error'], { error: error.message });
    }
  }

  /**
   * Calculate quote score
   * @private
   * @param {string} text - Message text
   * @returns {Object} - Score and indicators
   */
  _calculateQuoteScore(text) {
    let score = 0;
    const indicators = [];

    for (const [key, indicator] of Object.entries(this.quoteIndicators)) {
      let matches = false;

      if (indicator.patterns) {
        matches = indicator.patterns.some(pattern => pattern.test(text));
      } else if (indicator.words) {
        const textLower = text.toLowerCase();
        matches = indicator.words.some(word => textLower.includes(word));
      } else if (indicator.test) {
        matches = indicator.test(text);
      }

      if (matches) {
        score += indicator.weight;
        indicators.push(key);
      }
    }

    // Normalize score (rough approximation)
    score = Math.min(score / 2.5, 1.0);

    return { score, indicators };
  }

  /**
   * Calculate question score
   * @private
   * @param {string} text - Message text
   * @returns {Object} - Score and indicators
   */
  _calculateQuestionScore(text) {
    let score = 0;
    const indicators = [];

    for (const [key, indicator] of Object.entries(this.questionIndicators)) {
      let matches = false;

      if (indicator.patterns) {
        matches = indicator.patterns.some(pattern => pattern.test(text));
      } else if (indicator.words) {
        const textLower = text.toLowerCase();
        matches = indicator.words.some(word => textLower.includes(word));
      } else if (indicator.test) {
        matches = indicator.test(text);
      }

      if (matches) {
        score += indicator.weight;
        indicators.push(key);
      }
    }

    // Normalize score
    score = Math.min(score / 2.5, 1.0);

    return { score, indicators };
  }

  /**
   * Calculate complex question score
   * @private
   * @param {string} text - Message text
   * @returns {Object} - Score and indicators
   */
  _calculateComplexQuestionScore(text) {
    let score = 0;
    const indicators = [];

    for (const [key, indicator] of Object.entries(this.complexQuestionIndicators)) {
      let matches = false;

      if (indicator.patterns) {
        matches = indicator.patterns.some(pattern => pattern.test(text));
      } else if (indicator.words) {
        const textLower = text.toLowerCase();
        matches = indicator.words.some(word => textLower.includes(word));
      } else if (indicator.test) {
        matches = indicator.test(text);
      }

      if (matches) {
        score += indicator.weight;
        indicators.push(key);
      }
    }

    // Normalize score
    score = Math.min(score / 2.0, 1.0);

    return { score, indicators };
  }

  /**
   * Determine final classification
   * @private
   * @param {string} text - Message text
   * @param {Object} quoteScore - Quote score and indicators
   * @param {Object} questionScore - Question score and indicators
   * @param {Object} complexQuestionScore - Complex question score and indicators
   * @param {Object} context - Classification context
   * @returns {ClassificationResult}
   */
  _determineClassification(text, quoteScore, questionScore, complexQuestionScore, context) {
    const { score: qScore, indicators: qIndicators } = quoteScore;
    const { score: questionS, indicators: questionI } = questionScore;
    const { score: complexS, indicators: complexI } = complexQuestionScore;

    // Strong complex question
    if (complexS > 0.5) {
      return this._createResult('complex_question', complexS, complexI, {
        requiresPersonalAttention: true,
        alternativeScores: { quote: qScore, question: questionS }
      });
    }

    // Strong quote indicators
    if (qScore > 0.7) {
      return this._createResult('quote', qScore, qIndicators, {
        alternativeScores: { question: questionS, complex: complexS }
      });
    }

    // Strong question indicators
    if (questionS > 0.7) {
      return this._createResult('question', questionS, questionI, {
        alternativeScores: { quote: qScore, complex: complexS }
      });
    }

    // Clear winner with decent confidence
    const maxScore = Math.max(qScore, questionS);
    if (maxScore > 0.5) {
      const winningType = qScore > questionS ? 'quote' : 'question';
      const winningIndicators = qScore > questionS ? qIndicators : questionI;
      
      return this._createResult(winningType, maxScore, winningIndicators, {
        alternativeScores: { 
          quote: qScore, 
          question: questionS, 
          complex: complexS 
        }
      });
    }

    // Ambiguous case - scores are too close or too low
    const ambiguityReasons = [];
    
    if (Math.abs(qScore - questionS) < 0.2) {
      ambiguityReasons.push('scores_too_close');
    }
    
    if (maxScore < 0.3) {
      ambiguityReasons.push('all_scores_low');
    }

    if (text.length < 20) {
      ambiguityReasons.push('message_too_short');
    }

    return this._createResult('ambiguous', maxScore * 0.8, [...qIndicators, ...questionI], {
      reasons: ambiguityReasons,
      scores: { quote: qScore, question: questionS, complex: complexS },
      needsUserClarification: true
    });
  }

  /**
   * Check if message is a command
   * @private
   * @param {string} text - Message text
   * @returns {boolean}
   */
  _isCommand(text) {
    return this.commandPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Create classification result
   * @private
   * @param {string} type - Classification type
   * @param {number} confidence - Confidence score
   * @param {Array} indicators - Matching indicators
   * @param {Object} metadata - Additional metadata
   * @returns {ClassificationResult}
   */
  _createResult(type, confidence, indicators, metadata = {}) {
    return {
      type,
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
      indicators,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Update classification statistics
   * @private
   * @param {ClassificationResult} result - Classification result
   */
  _updateStats(result) {
    this.stats.typeDistribution[result.type]++;
    this.stats.confidenceSum += result.confidence;
    this.stats.averageConfidence = this.stats.confidenceSum / this.stats.totalClassifications;
  }

  /**
   * Create ambiguity resolution keyboard for unclear messages
   * @param {string} messageText - Original message text
   * @returns {Object} - Telegram keyboard markup with clarification text
   */
  createAmbiguityResolutionKeyboard(messageText) {
    const truncatedText = messageText.length > 100 
      ? messageText.substring(0, 100) + '...' 
      : messageText;

    return {
      text: `🤔 Не совсем понял ваше сообщение:\n\n"${truncatedText}"\n\nПомогите мне понять — это цитата или вопрос?`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📖 Это цитата", callback_data: "classify_quote_confirm" },
            { text: "❓ Это вопрос", callback_data: "classify_question_confirm" }
          ],
          [
            { text: "❌ Отменить", callback_data: "classify_cancel" }
          ]
        ]
      }
    };
  }

  /**
   * Get classification statistics
   * @returns {Object} - Classification statistics
   */
  getStats() {
    return {
      totalClassifications: this.stats.totalClassifications,
      typeDistribution: { ...this.stats.typeDistribution },
      averageConfidence: Math.round(this.stats.averageConfidence * 100) / 100,
      distributionPercentages: this._calculatePercentages(),
      indicators: {
        quoteIndicators: Object.keys(this.quoteIndicators).length,
        questionIndicators: Object.keys(this.questionIndicators).length,
        complexQuestionIndicators: Object.keys(this.complexQuestionIndicators).length
      }
    };
  }

  /**
   * Calculate percentage distribution
   * @private
   * @returns {Object} - Percentage distribution
   */
  _calculatePercentages() {
    const total = this.stats.totalClassifications;
    if (total === 0) return {};

    const percentages = {};
    for (const [type, count] of Object.entries(this.stats.typeDistribution)) {
      percentages[type] = Math.round((count / total) * 100);
    }
    return percentages;
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats() {
    this.stats = {
      totalClassifications: 0,
      typeDistribution: {
        quote: 0,
        question: 0,
        complex_question: 0,
        command: 0,
        ambiguous: 0
      },
      averageConfidence: 0,
      confidenceSum: 0
    };
    
    logger.info('🧠 MessageClassifier statistics reset');
  }

  /**
   * Add custom indicator for specific use cases
   * @param {string} category - Category ('quote', 'question', 'complex_question')
   * @param {string} name - Indicator name
   * @param {Object} indicator - Indicator configuration
   */
  addCustomIndicator(category, name, indicator) {
    try {
      const targetCategory = {
        quote: this.quoteIndicators,
        question: this.questionIndicators,
        complex_question: this.complexQuestionIndicators
      }[category];

      if (!targetCategory) {
        throw new Error(`Unknown category: ${category}`);
      }

      if (!indicator.weight || !indicator.description) {
        throw new Error('Indicator must have weight and description');
      }

      targetCategory[name] = indicator;
      logger.info(`🧠 Added custom indicator "${name}" to category "${category}"`);
      
    } catch (error) {
      logger.error(`🧠 Error adding custom indicator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test classifier with example messages
   * @returns {Array} - Test results
   */
  runTests() {
    const testMessages = [
      // Clear quotes
      { text: '"Жизнь прекрасна" (Толстой)', expected: 'quote' },
      { text: 'В каждом слове — целая жизнь', expected: 'quote' },
      { text: 'Счастье — это выбор каждого человека.', expected: 'quote' },
      
      // Clear questions
      { text: 'Как дела?', expected: 'question' },
      { text: 'Что такое счастье?', expected: 'question' },
      { text: 'Можете помочь с выбором книги?', expected: 'question' },
      
      // Complex questions
      { text: 'У меня депрессия, не знаю что делать. Помогите разобраться.', expected: 'complex_question' },
      { text: 'Как справиться с потерей близкого человека?', expected: 'complex_question' },
      
      // Commands
      { text: '/start', expected: 'command' },
      { text: 'меню', expected: 'command' },
      
      // Ambiguous
      { text: 'Хорошо', expected: 'ambiguous' },
      { text: 'Жизнь сложная штука', expected: 'ambiguous' }
    ];

    const results = [];
    
    for (const test of testMessages) {
      const result = this.classifyMessage(test.text, {});
      results.push({
        text: test.text,
        expected: test.expected,
        actual: result.type,
        confidence: result.confidence,
        correct: result.type === test.expected
      });
    }

    const accuracy = results.filter(r => r.correct).length / results.length;
    
    logger.info(`🧠 Classifier test completed. Accuracy: ${Math.round(accuracy * 100)}%`);
    
    return {
      results,
      accuracy: Math.round(accuracy * 100),
      totalTests: results.length,
      correctPredictions: results.filter(r => r.correct).length
    };
  }
}

module.exports = { MessageClassifier };