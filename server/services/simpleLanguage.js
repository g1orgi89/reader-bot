/**
 * Простой сервис языков без сложной детекции
 * 🍄 УПРОЩЕНО: Минимальная функциональность, всегда возвращает 'auto'
 * @file server/services/simpleLanguage.js
 */

const logger = require('../utils/logger');

/**
 * @typedef {Object} LanguageInfo
 * @property {string} code - Код языка (auto)
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
      { code: 'auto', name: 'Auto-detect', nativeName: 'Автоопределение' }
    ];
    
    this.defaultLanguage = 'auto';
    
    /** @type {Object<string, number>} */
    this.usageStats = {
      auto: 0
    };
    
    logger.info('🍄 SimpleLanguageService initialized - universal language support');
  }

  /**
   * 🍄 УПРОЩЕНО: Всегда возвращает 'auto' - AI сам определит язык
   * @param {string} text - Текст сообщения (игнорируется)
   * @param {Object} options - Дополнительные опции (игнорируются)
   * @returns {string} Всегда 'auto'
   */
  detectLanguage(text, options = {}) {
    this.usageStats.auto++;
    return 'auto';
  }

  /**
   * Упрощенное определение языка с контекстом (совместимость со старым API)
   * 🍄 УПРОЩЕНО: Всегда возвращает 'auto'
   * @param {string} text - Текст сообщения (игнорируется)
   * @param {Object} context - Контекст разговора (игнорируется)
   * @returns {string} Всегда 'auto'
   */
  detectLanguageWithContext(text, context = {}) {
    this.usageStats.auto++;
    return 'auto';
  }

  /**
   * 🍄 УПРОЩЕНО: Заглушка - больше не используется
   * @param {string} text - Текст для анализа (игнорируется)
   * @returns {string} Всегда 'auto'
   */
  simpleTextDetection(text) {
    return 'auto';
  }

  /**
   * 🍄 УПРОЩЕНО: Всегда возвращает 'auto'
   * @param {string} browserLang - Язык браузера (игнорируется)
   * @returns {string} Всегда 'auto'
   */
  normalizeBrowserLanguage(browserLang) {
    return 'auto';
  }

  /**
   * Проверяет поддержку языка
   * 🍄 УПРОЩЕНО: Поддерживается только 'auto'
   * @param {string} langCode - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isSupported(langCode) {
    return langCode === 'auto';
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
      usage: { ...this.usageStats },
      note: 'Universal language support - AI auto-detects language from user messages'
    };
  }

  /**
   * Очищает кеш языковых предпочтений пользователя
   * (Заглушка для совместимости со старым API)
   * @param {string} userId - ID пользователя
   */
  clearLanguageCache(userId) {
    logger.info(`🍄 Language cache cleared for user: ${userId} (no-op in universal service)`);
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
      defaultLanguage: this.defaultLanguage,
      mode: 'universal',
      note: 'AI handles language detection automatically'
    };
  }
}

// Создаем единственный экземпляр
const simpleLanguageService = new SimpleLanguageService();

module.exports = simpleLanguageService;