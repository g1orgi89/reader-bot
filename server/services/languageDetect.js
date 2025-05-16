/**
 * Сервис для определения языка текста с улучшенной логикой переключения
 * @file server/services/languageDetect.js
 */

const logger = require('../utils/logger');
const { detect, detectWithConfidence, getSupportedLanguages } = require('../utils/languageDetect');

/**
 * @class LanguageDetectService
 * @description Сервис для определения языка сообщений пользователей с поддержкой контекста
 */
class LanguageDetectService {
  constructor() {
    // Пороги для контекстного определения языка
    this.contextThresholds = {
      shortMessageLength: 20, // Сообщения короче этого считаются короткими
      minConfidenceForSwitch: 0.7, // Минимальная уверенность для смены языка
      contextStabilityLength: 3, // Количество сообщений для проверки стабильности
      maxLanguageStickiness: 2, // Максимальное количество сообщений, где язык может "прилипать"
    };
    
    // Кеш языковых предпочтений пользователей
    this.userLanguageCache = new Map();
    this.conversationLanguageCache = new Map();
    
    // Счетчики для отладки
    this.detectionStats = {
      total: 0,
      byUtilityDetection: 0,
      byConfidenceThreshold: 0,
      byContextStability: 0,
      byUserPreference: 0,
      languageSwitches: 0,
      shortMessageFallbacks: 0
    };
    
    this.defaultLanguage = 'en';
  }

  /**
   * Определяет язык текста с учетом контекста разговора (улучшенная версия)
   * @param {string} text - Текст для анализа
   * @param {Object} options - Опции определения языка
   * @param {string} options.userId - ID пользователя
   * @param {string} options.conversationId - ID разговора
   * @param {Array} options.history - История сообщений
   * @param {string} options.previousLanguage - Язык предыдущего сообщения
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguageWithContext(text, options = {}) {
    try {
      this.detectionStats.total++;
      
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid text for language detection');
        return this.getPreferredLanguage(options.userId) || this.defaultLanguage;
      }

      const cleanedText = text.trim();
      
      // ШАГ 1: Базовое определение языка с использованием улучшенной утилиты
      const detectionResult = detectWithConfidence(cleanedText);
      const detectedLanguage = detectionResult.language;
      const confidence = detectionResult.confidence;
      
      logger.debug(`Base detection: ${detectedLanguage} (confidence: ${confidence}) for: "${cleanedText.substring(0, 50)}..."`);
      
      // ШАГ 2: Анализ контекста для принятия решения о переключении
      const contextDecision = this.analyzeContextForLanguageSwitch(
        detectedLanguage,
        confidence,
        options,
        cleanedText
      );
      
      const finalLanguage = contextDecision.finalLanguage;
      
      // ШАГ 3: Обновление кеша и логирование
      if (finalLanguage !== options.previousLanguage) {
        this.detectionStats.languageSwitches++;
        logger.info(`Language switch: ${options.previousLanguage || 'none'} → ${finalLanguage} (${contextDecision.reason})`);
      }
      
      this.updateLanguageCaches(options.userId, options.conversationId, finalLanguage);
      
      return finalLanguage;
      
    } catch (error) {
      logger.error('Language detection with context error:', error.message);
      return this.getPreferredLanguage(options.userId) || this.defaultLanguage;
    }
  }

  /**
   * Анализирует контекст для принятия решения о переключении языка
   * @param {string} detectedLanguage - Определенный базовой функцией язык
   * @param {number} confidence - Уверенность определения
   * @param {Object} options - Опции с контекстом
   * @param {string} text - Текст сообщения
   * @returns {Object} Решение о языке и причина
   */
  analyzeContextForLanguageSwitch(detectedLanguage, confidence, options, text) {
    const { previousLanguage, history = [], conversationId } = options;
    
    // Проверка 1: Если нет предыдущего языка, используем определенный
    if (!previousLanguage) {
      this.detectionStats.byUtilityDetection++;
      return {
        finalLanguage: detectedLanguage,
        reason: `initial_detection_${confidence}`
      };
    }
    
    // Проверка 2: Высокая уверенность - всегда переключаем
    if (confidence >= this.contextThresholds.minConfidenceForSwitch) {
      this.detectionStats.byConfidenceThreshold++;
      return {
        finalLanguage: detectedLanguage,
        reason: `high_confidence_${confidence}`
      };
    }
    
    // Проверка 3: Для коротких сообщений применяем особую логику
    if (text.length < this.contextThresholds.shortMessageLength) {
      const shortMessageDecision = this.handleShortMessage(
        detectedLanguage,
        confidence,
        previousLanguage,
        text
      );
      
      if (shortMessageDecision.useDetected) {
        this.detectionStats.byUtilityDetection++;
        return {
          finalLanguage: detectedLanguage,
          reason: `short_message_clear_language_${confidence}`
        };
      } else {
        this.detectionStats.shortMessageFallbacks++;
        return {
          finalLanguage: previousLanguage,
          reason: `short_message_context_fallback`
        };
      }
    }
    
    // Проверка 4: Анализ стабильности языка в истории
    const languageStability = this.analyzeLanguageStability(history, previousLanguage);
    
    // Если язык был стабилен и уверенность не очень высокая, оставляем предыдущий
    if (languageStability.isStable && confidence < 0.6) {
      this.detectionStats.byContextStability++;
      return {
        finalLanguage: previousLanguage,
        reason: `context_stability_${languageStability.stabilityScore}`
      };
    }
    
    // Проверка 5: Проверяем на "липкость" языка
    const conversationStats = this.conversationLanguageCache.get(conversationId);
    if (conversationStats && conversationStats.sameLanguageStreak < this.contextThresholds.maxLanguageStickiness) {
      // Если язык "прилип" недавно, требуем более высокую уверенность для переключения
      if (confidence < 0.8) {
        this.detectionStats.byContextStability++;
        return {
          finalLanguage: previousLanguage,
          reason: `language_stickiness_prevention`
        };
      }
    }
    
    // По умолчанию используем определенный язык
    this.detectionStats.byUtilityDetection++;
    return {
      finalLanguage: detectedLanguage,
      reason: `default_detection_${confidence}`
    };
  }

  /**
   * Обрабатывает логику для коротких сообщений
   * @param {string} detectedLanguage - Определенный язык
   * @param {number} confidence - Уверенность
   * @param {string} previousLanguage - Предыдущий язык
   * @param {string} text - Текст сообщения
   * @returns {Object} Решение для короткого сообщения
   */
  handleShortMessage(detectedLanguage, confidence, previousLanguage, text) {
    // Для очень коротких сообщений проверяем на явные языковые маркеры
    const hasStrongLanguageMarkers = this.checkStrongLanguageMarkers(text);
    
    if (hasStrongLanguageMarkers) {
      return { useDetected: true, reason: 'strong_markers' };
    }
    
    // Если есть явные признаки смены языка (кириллица, диакритики), переключаем
    if (this.hasExplicitLanguageSwitch(text, previousLanguage, detectedLanguage)) {
      return { useDetected: true, reason: 'explicit_switch' };
    }
    
    // Для остальных коротких сообщений используем контекст
    return { useDetected: false, reason: 'context_fallback' };
  }

  /**
   * Проверяет на сильные языковые маркеры в коротком тексте
   * @param {string} text - Текст для проверки
   * @returns {boolean} Есть ли сильные маркеры
   */
  checkStrongLanguageMarkers(text) {
    const strongMarkers = {
      ru: /[а-яё]/i,
      es: /[ñáéíóúü]/i,
      en: /\b(hello|help|what|how|please|thank|tell|me|about)\b/i
    };
    
    // Для русского и испанского - явное наличие символов
    if (strongMarkers.ru.test(text) || strongMarkers.es.test(text)) {
      return true;
    }
    
    // Для английского - наличие характерных слов
    if (strongMarkers.en.test(text)) {
      return true;
    }
    
    return false;
  }

  /**
   * Проверяет на явную смену языка
   * @param {string} text - Текст
   * @param {string} previousLanguage - Предыдущий язык
   * @param {string} detectedLanguage - Определенный язык
   * @returns {boolean} Есть ли явная смена языка
   */
  hasExplicitLanguageSwitch(text, previousLanguage, detectedLanguage) {
    // Если переключились с любого языка на русский и есть кириллица
    if (detectedLanguage === 'ru' && /[а-яё]/i.test(text)) {
      return true;
    }
    
    // Если переключились на испанский и есть диакритики
    if (detectedLanguage === 'es' && /[ñáéíóúü]/i.test(text)) {
      return true;
    }
    
    // Если есть явные фразы смены языка
    const languageSwitchPhrases = {
      en: /\b(in english|english please)\b/i,
      es: /\b(en español|en castellano)\b/i,
      ru: /\b(на русском|по-русски)\b/i
    };
    
    for (const [lang, pattern] of Object.entries(languageSwitchPhrases)) {
      if (pattern.test(text) && detectedLanguage === lang) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Анализирует стабильность языка в истории сообщений
   * @param {Array} history - История сообщений
   * @param {string} currentLanguage - Текущий язык
   * @returns {Object} Анализ стабильности
   */
  analyzeLanguageStability(history, currentLanguage) {
    if (!history || history.length === 0) {
      return { isStable: false, stabilityScore: 0 };
    }
    
    // Берем последние N сообщений пользователя для анализа
    const recentUserMessages = history
      .filter(msg => msg.role === 'user')
      .slice(-this.contextThresholds.contextStabilityLength);
    
    if (recentUserMessages.length === 0) {
      return { isStable: false, stabilityScore: 0 };
    }
    
    // Подсчитываем, сколько сообщений были на том же языке
    let sameLanguageCount = 0;
    for (const message of recentUserMessages) {
      const msgLanguage = detect(message.content);
      if (msgLanguage === currentLanguage) {
        sameLanguageCount++;
      }
    }
    
    const stabilityScore = sameLanguageCount / recentUserMessages.length;
    const isStable = stabilityScore >= 0.7; // 70% сообщений на том же языке
    
    return { isStable, stabilityScore };
  }

  /**
   * Обновляет кеши языков пользователя и разговора
   * @param {string} userId - ID пользователя
   * @param {string} conversationId - ID разговора
   * @param {string} language - Язык
   */
  updateLanguageCaches(userId, conversationId, language) {
    // Обновляем пользовательский кеш
    if (userId) {
      const userCache = this.userLanguageCache.get(userId) || {};
      this.userLanguageCache.set(userId, {
        ...userCache,
        currentLanguage: language,
        lastUsed: Date.now(),
        totalDetections: (userCache.totalDetections || 0) + 1,
        languages: {
          ...userCache.languages,
          [language]: (userCache.languages?.[language] || 0) + 1
        }
      });
    }
    
    // Обновляем кеш разговора
    if (conversationId) {
      const conversationCache = this.conversationLanguageCache.get(conversationId) || {
        currentLanguage: language,
        sameLanguageStreak: 0,
        switches: 0
      };
      
      if (conversationCache.currentLanguage === language) {
        conversationCache.sameLanguageStreak++;
      } else {
        conversationCache.sameLanguageStreak = 1;
        conversationCache.switches++;
        conversationCache.currentLanguage = language;
      }
      
      this.conversationLanguageCache.set(conversationId, conversationCache);
    }
  }

  /**
   * Простое определение языка (обертка над утилитой)
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка
   */
  detectLanguage(text) {
    this.detectionStats.byUtilityDetection++;
    return detect(text);
  }

  /**
   * Получает предпочтительный язык пользователя
   * @param {string} userId - ID пользователя
   * @returns {string|null} Код языка или null
   */
  getPreferredLanguage(userId) {
    if (!userId) return null;
    const userCache = this.userLanguageCache.get(userId);
    return userCache?.currentLanguage || null;
  }

  /**
   * Очищает кеш языковых предпочтений
   * @param {string} userId - ID пользователя (опционально)
   */
  clearLanguageCache(userId = null) {
    if (userId) {
      this.userLanguageCache.delete(userId);
      logger.info(`Language cache cleared for user: ${userId}`);
    } else {
      this.userLanguageCache.clear();
      this.conversationLanguageCache.clear();
      logger.info('All language cache cleared');
    }
  }

  /**
   * Определяет язык на основе заголовков HTTP (Accept-Language)
   * @param {string} acceptLanguageHeader - Заголовок Accept-Language
   * @returns {string} Код языка
   */
  detectFromHeader(acceptLanguageHeader) {
    if (!acceptLanguageHeader) {
      return this.defaultLanguage;
    }

    try {
      const supportedLangs = getSupportedLanguages();
      const languages = acceptLanguageHeader
        .split(',')
        .map(lang => {
          const parts = lang.trim().split(';');
          const code = parts[0].split('-')[0].toLowerCase();
          const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
          return { code, quality };
        })
        .sort((a, b) => b.quality - a.quality);

      for (const lang of languages) {
        if (supportedLangs.includes(lang.code)) {
          return lang.code;
        }
      }
    } catch (error) {
      logger.warn('Error parsing Accept-Language header:', error.message);
    }

    return this.defaultLanguage;
  }

  /**
   * Получает расширенную статистику работы сервиса
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      supportedLanguages: getSupportedLanguages(),
      defaultLanguage: this.defaultLanguage,
      cachedUsers: this.userLanguageCache.size,
      cachedConversations: this.conversationLanguageCache.size,
      detectionStats: {
        ...this.detectionStats,
        // Добавляем процентные соотношения
        utilityDetectionPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byUtilityDetection / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        contextStabilityPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byContextStability / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        languageSwitchRate: this.detectionStats.total > 0 ? 
          (this.detectionStats.languageSwitches / this.detectionStats.total * 100).toFixed(1) + '%' : '0%'
      },
      contextThresholds: this.contextThresholds
    };
  }

  /**
   * Получает список поддерживаемых языков
   * @returns {string[]} Массив кодов языков
   */
  getSupportedLanguages() {
    return getSupportedLanguages();
  }

  /**
   * Сбрасывает статистику определения языка
   */
  resetStats() {
    this.detectionStats = {
      total: 0,
      byUtilityDetection: 0,
      byConfidenceThreshold: 0,
      byContextStability: 0,
      byUserPreference: 0,
      languageSwitches: 0,
      shortMessageFallbacks: 0
    };
    logger.info('Language detection stats reset');
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();
