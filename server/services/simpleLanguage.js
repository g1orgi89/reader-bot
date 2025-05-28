/**
 * Простой сервис языков без сложной детекции
 * Заменяет languageDetect.js на минимальную функциональность
 * @file server/services/simpleLanguage.js
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} LanguageInfo
 * @property {string} code - Код языка (en, es, ru)
 * @property {string} name - Название языка
 * @property {string} nativeName - Нативное название
 */

/**
 * @typedef {Object} SimpleLanguageStats
 * @property {string} defaultLanguage - Язык по умолчанию
 * @property {LanguageInfo[]} supportedLanguages - Поддерживаемые языки
 * @property {Object<string, number>} usage - Статистика использования
 */

class SimpleLanguageService {
  constructor() {
    /** @type {LanguageInfo[]} */
    this.supportedLanguages = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' }
    ];
    
    this.defaultLanguage = 'en';
    
    /** @type {Object<string, number>} */
    this.usageStats = {
      en: 0,
      es: 0,
      ru: 0
    };
    
    logger.info('🍄 SimpleLanguageService initialized');
  }

  /**
   * Определяет язык простым способом без сложной логики
   * @param {string} text - Текст сообщения
   * @param {Object} options - Дополнительные опции
   * @param {string} [options.userLanguage] - Предпочтительный язык пользователя
   * @param {string} [options.previousLanguage] - Предыдущий язык в разговоре
   * @param {string} [options.browserLanguage] - Язык браузера
   * @returns {string} Код языка
   */
  detectLanguage(text, options = {}) {
    // 1. Если явно указан язык пользователем - используем его
    if (options.userLanguage && this.isSupported(options.userLanguage)) {
      this.usageStats[options.userLanguage]++;
      return options.userLanguage;
    }
    
    // 2. Если есть предыдущий язык в разговоре - используем его
    if (options.previousLanguage && this.isSupported(options.previousLanguage)) {
      this.usageStats[options.previousLanguage]++;
      return options.previousLanguage;
    }
    
    // 3. Если есть язык браузера - пробуем его
    if (options.browserLanguage) {
      const browserLang = this.normalizeBrowserLanguage(options.browserLanguage);
      if (browserLang && this.isSupported(browserLang)) {
        this.usageStats[browserLang]++;
        return browserLang;
      }
    }
    
    // 4. Простая эвристика по тексту (только основные маркеры)
    const detectedLang = this.simpleTextDetection(text);
    if (detectedLang !== this.defaultLanguage) {
      this.usageStats[detectedLang]++;
      return detectedLang;
    }
    
    // 5. По умолчанию - английский
    this.usageStats[this.defaultLanguage]++;
    return this.defaultLanguage;
  }

  /**
   * Упрощенное определение языка с контекстом (совместимость со старым API)
   * @param {string} text - Текст сообщения
   * @param {Object} context - Контекст разговора
   * @param {string} [context.userId] - ID пользователя
   * @param {string} [context.conversationId] - ID разговора
   * @param {Array} [context.history] - История сообщений
   * @param {string} [context.previousLanguage] - Предыдущий язык
   * @returns {string} Код языка
   */
  detectLanguageWithContext(text, context = {}) {
    return this.detectLanguage(text, {
      previousLanguage: context.previousLanguage,
      userLanguage: context.userLanguage
    });
  }

  /**
   * Простая детекция по ключевым словам
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка
   */
  simpleTextDetection(text) {
    if (!text || typeof text !== 'string') {
      return this.defaultLanguage;
    }
    
    const normalizedText = text.toLowerCase();
    
    // Русские маркеры
    const russianMarkers = [
      'привет', 'что', 'как', 'токен', 'кошелек', 'подключить', 
      'ошибка', 'проблема', 'помощь', 'спасибо', 'пожалуйста'
    ];
    
    // Испанские маркеры  
    const spanishMarkers = [
      'hola', 'qué', 'cómo', 'token', 'billetera', 'conectar',
      'error', 'problema', 'ayuda', 'gracias', 'por favor'
    ];
    
    // Проверяем русские маркеры
    for (const marker of russianMarkers) {
      if (normalizedText.includes(marker)) {
        return 'ru';
      }
    }
    
    // Проверяем испанские маркеры
    for (const marker of spanishMarkers) {
      if (normalizedText.includes(marker)) {
        return 'es';
      }
    }
    
    // По умолчанию английский
    return 'en';
  }

  /**
   * Нормализует язык браузера к поддерживаемому коду
   * @param {string} browserLang - Язык браузера (например, 'en-US', 'ru-RU')
   * @returns {string|null} Нормализованный код языка
   */
  normalizeBrowserLanguage(browserLang) {
    if (!browserLang || typeof browserLang !== 'string') {
      return null;
    }
    
    const langCode = browserLang.split('-')[0].toLowerCase();
    return this.isSupported(langCode) ? langCode : null;
  }

  /**
   * Проверяет поддержку языка
   * @param {string} langCode - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isSupported(langCode) {
    return this.supportedLanguages.some(lang => lang.code === langCode);
  }

  /**
   * Получает список поддерживаемых языков
   * @returns {LanguageInfo[]} Массив поддерживаемых языков
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Получает статистику использования языков
   * @returns {SimpleLanguageStats} Статистика языков
   */
  getStats() {
    return {
      defaultLanguage: this.defaultLanguage,
      supportedLanguages: this.supportedLanguages,
      usage: { ...this.usageStats }
    };
  }

  /**
   * Очищает кеш языковых предпочтений пользователя
   * (Заглушка для совместимости со старым API)
   * @param {string} userId - ID пользователя
   */
  clearLanguageCache(userId) {
    logger.info(`🍄 Language cache cleared for user: ${userId} (no-op in simple service)`);
  }

  /**
   * Проверка работоспособности сервиса
   * @returns {Object} Статус сервиса
   */
  healthCheck() {
    return {
      status: 'ok',
      service: 'SimpleLanguageService',
      supportedLanguages: this.supportedLanguages.length,
      defaultLanguage: this.defaultLanguage
    };
  }
}

// Создаем единственный экземпляр
const simpleLanguageService = new SimpleLanguageService();

module.exports = simpleLanguageService;