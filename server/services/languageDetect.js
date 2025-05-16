/**
 * Сервис для определения языка текста
 * @file server/services/languageDetect.js
 */

const logger = require('../utils/logger');

/**
 * @class LanguageDetectService
 * @description Сервис для определения языка сообщений пользователей с поддержкой контекста
 */
class LanguageDetectService {
  constructor() {
    // Словари ключевых слов для каждого поддерживаемого языка
    this.languageDictionaries = {
      en: {
        keywords: [
          'the', 'and', 'you', 'that', 'was', 'for', 'are', 'with', 'his', 'they',
          'hello', 'help', 'what', 'how', 'when', 'where', 'why', 'can', 'could',
          'wallet', 'connect', 'token', 'farming', 'staking', 'bitcoin', 'crypto',
          'this', 'have', 'from', 'been', 'will', 'more', 'time', 'very', 'just',
          'would', 'there', 'about', 'into', 'them', 'only', 'know', 'than', 'first'
        ],
        patterns: [
          /\bis\b/gi, /\bare\b/gi, /\bthe\b/gi, /\band\b/gi, /\bcan\b/gi,
          /\bhow\s+to\b/gi, /\bwhat\s+is\b/gi, /\bi\s+need\b/gi,
          /\bwould\s+like\b/gi, /\bhave\s+been\b/gi
        ],
        // Специальные проверки для английского
        specificChecks: [
          /\b(ing|tion|ness|ment|able|ible)\b/gi,
          /\b(a|an)\s+\w+/gi
        ]
      },
      es: {
        keywords: [
          'el', 'la', 'de', 'que', 'y', 'en', 'con', 'no', 'te', 'lo',
          'hola', 'ayuda', 'qué', 'cómo', 'cuándo', 'dónde', 'por', 'puedo', 'podría',
          'billetera', 'conectar', 'token', 'cultivo', 'apuesta', 'bitcoin', 'cripto',
          'para', 'del', 'las', 'los', 'una', 'uno', 'esta', 'este', 'pero', 'todo',
          'más', 'muy', 'bien', 'como', 'sobre', 'sido', 'está', 'son', 'desde'
        ],
        patterns: [
          /\bes\b/gi, /\bson\b/gi, /\bel\b/gi, /\bla\b/gi, /\bde\b/gi,
          /\bcómo\s+puedo\b/gi, /\bqué\s+es\b/gi, /\bnecesito\b/gi,
          /\bme\s+gustaría\b/gi, /\bhe\s+estado\b/gi
        ],
        // Специальные проверки для испанского
        specificChecks: [
          /[ñáéíóúü]/gi,
          /\b(ción|mente|ando|iendo)\b/gi,
          /\b(un|una)\s+\w+/gi
        ]
      },
      ru: {
        keywords: [
          'и', 'в', 'не', 'что', 'он', 'на', 'я', 'с', 'как', 'а',
          'привет', 'помощь', 'что', 'как', 'когда', 'где', 'почему', 'могу', 'можно',
          'кошелек', 'подключить', 'токен', 'фарминг', 'стейкинг', 'биткоин', 'крипто',
          'это', 'для', 'по', 'от', 'до', 'из', 'за', 'при', 'без', 'через',
          'мне', 'тебе', 'нас', 'вас', 'них', 'она', 'оно', 'мы', 'вы', 'они',
          'да', 'нет', 'или', 'если', 'то', 'бы', 'же', 'ли', 'только', 'уже',
          'там', 'тут', 'где', 'когда', 'почему', 'зачем', 'какой', 'какая', 'какое',
          'который', 'которая', 'которое', 'чтобы', 'потому', 'поэтому',
          'такое', 'такой', 'такая', 'будет', 'была', 'были', 'быть'
        ],
        patterns: [
          /\bэто\b/gi, /\bесть\b/gi, /\bтот\b/gi, /\bкак\b/gi, /\bчто\b/gi,
          /\bкак\s+можно\b/gi, /\bчто\s+такое\b/gi, /\bмне\s+нужно\b/gi,
          /\bможет\s+быть\b/gi, /\bя\s+хочу\b/gi, /\bу\s+меня\b/gi
        ],
        // Специальные проверки для русского
        specificChecks: [
          /[а-яё]/gi,
          /\b(ость|ение|ание|ство|ный|ная|ное)\b/gi,
          /\b(не|ни)\s+\w+/gi
        ]
      }
    };
    
    // Пороги уверенности для определения языка
    this.confidenceThreshold = 0.1;
    this.defaultLanguage = 'en';
    
    // Кеш языковых предпочтений пользователей
    this.userLanguageCache = new Map();
    
    // Счетчики для отладки
    this.detectionStats = {
      total: 0,
      byCyrillic: 0,
      byDiacritics: 0,
      byKeywords: 0,
      byContext: 0,
      fallback: 0
    };
    
    // Паттерны для определения технического контента
    this.technicalPatterns = [
      // JSON объекты
      /\{[\s\S]*?\}/g,
      // URLs
      /https?:\/\/[^\s]+/g,
      // Коды ошибок
      /\b[A-Z_]{3,}ERROR\b/g,
      /\berror[\s\:]\s*\d+/gi,
      /\b\d{3,}\s*error\b/gi,
      // Технические термины
      /\b(API|JSON|HTTP|SSL|TLS|404|500|403|401)\b/gi,
      // Хеши и адреса
      /\b0x[a-fA-F0-9]{40,}\b/g,
      /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
      // Коды ошибок в разных форматах
      /\bError:\s*[A-Za-z\s]+/gi,
      /\bException:\s*[A-Za-z\s]+/gi
    ];
  }

  /**
   * Определяет язык текста с учетом контекста разговора
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

      // Очищаем текст от лишних символов
      const cleanedText = text.trim();
      
      logger.debug(`Detecting language for: "${cleanedText.substring(0, 50)}..." (context available: ${!!options.history})`);

      // КРИТИЧЕСКИЙ ПРИОРИТЕТ: Проверка кириллицы
      const cyrillicResult = this.detectCyrillic(cleanedText);
      if (cyrillicResult) {
        this.detectionStats.byCyrillic++;
        this.updateUserLanguagePreference(options.userId, cyrillicResult);
        logger.info(`Russian detected by cyrillic in: "${cleanedText.substring(0, 30)}..."`);
        return cyrillicResult;
      }

      // ВТОРОЙ ПРИОРИТЕТ: Диакритики для испанского
      const diacriticsResult = this.detectSpanishDiacritics(cleanedText);
      if (diacriticsResult) {
        this.detectionStats.byDiacritics++;
        this.updateUserLanguagePreference(options.userId, diacriticsResult);
        logger.info(`Spanish detected by diacritics in: "${cleanedText.substring(0, 30)}..."`);
        return diacriticsResult;
      }

      // ТРЕТИЙ ПРИОРИТЕТ: Анализ контекста разговора
      if (options.previousLanguage && this.isStableLanguageInContext(cleanedText, options)) {
        this.detectionStats.byContext++;
        logger.info(`Using previous language ${options.previousLanguage} based on context stability`);
        return options.previousLanguage;
      }

      // ЧЕТВЕРТЫЙ ПРИОРИТЕТ: Основное определение по словарю
      const detectedLanguage = this.detectLanguage(cleanedText);
      
      // ПРОВЕРКА НА УВЕРЕННОСТЬ: Если основное определение не уверенное, используем контекст
      const confidence = this.getLanguageConfidence(cleanedText, detectedLanguage);
      if (confidence < 0.3 && options.previousLanguage) {
        logger.info(`Low confidence (${confidence}), using previous language: ${options.previousLanguage}`);
        return options.previousLanguage;
      }

      // Сохраняем определенный язык
      this.updateUserLanguagePreference(options.userId, detectedLanguage);
      
      logger.info(`Language detected: ${detectedLanguage} with confidence: ${confidence} for text: "${cleanedText.substring(0, 50)}..."`);
      
      return detectedLanguage;
    } catch (error) {
      logger.error('Language detection with context error:', error.message);
      this.detectionStats.fallback++;
      return this.getPreferredLanguage(options.userId) || this.defaultLanguage;
    }
  }

  /**
   * Улучшенная проверка кириллицы
   * @param {string} text - Текст для проверки
   * @returns {string|null} 'ru' если найдена кириллица, иначе null
   */
  detectCyrillic(text) {
    // Расширенная проверка кириллических символов
    const cyrillicPatterns = [
      /[а-яё]/gi,                    // Основные русские буквы
      /[А-ЯЁ]/g,                     // Заглавные русские буквы
      /[\u0400-\u04FF]/g,            // Полный блок кириллицы Unicode
    ];
    
    for (const pattern of cyrillicPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length >= 1) {
        return 'ru';
      }
    }
    
    // Дополнительная проверка на русские слова в латинице (транслитерация)
    const translitPatterns = [
      /\b(chto|kak|gde|kogda|pochemu|zhto|eto|ya|ty|on|ona|my|vy|oni)\b/gi,
    ];
    
    for (const pattern of translitPatterns) {
      if (pattern.test(text)) {
        logger.info('Russian detected through transliteration');
        return 'ru';
      }
    }
    
    return null;
  }

  /**
   * Проверка испанских диакритиков
   * @param {string} text - Текст для проверки
   * @returns {string|null} 'es' если найдены диакритики, иначе null
   */
  detectSpanishDiacritics(text) {
    if (/[ñáéíóúü]/gi.test(text)) {
      return 'es';
    }
    return null;
  }

  /**
   * Проверяет стабильность языка в контексте
   * @param {string} text - Текст сообщения
   * @param {Object} options - Опции с контекстом
   * @returns {boolean} Стабилен ли язык в контексте
   */
  isStableLanguageInContext(text, options) {
    // Если текст очень короткий и есть предыдущий язык, используем его
    if (text.length < 15 && options.previousLanguage) {
      return true;
    }
    
    // Если нет явных признаков смены языка и есть история, используем контекст
    if (options.history && options.history.length > 0) {
      const recentLanguages = this.analyzeRecentLanguages(options.history);
      if (recentLanguages[options.previousLanguage] >= 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Анализирует последние языки в истории
   * @param {Array} history - История сообщений
   * @returns {Object} Карта языков и их частоты
   */
  analyzeRecentLanguages(history) {
    const languageCount = { en: 0, es: 0, ru: 0 };
    
    // Берем последние 3 сообщения пользователя
    const userMessages = history
      .filter(msg => msg.role === 'user')
      .slice(-3);
    
    for (const message of userMessages) {
      const lang = this.detectLanguage(message.content);
      languageCount[lang]++;
    }
    
    return languageCount;
  }

  /**
   * Получает уверенность определения языка
   * @param {string} text - Текст
   * @param {string} language - Определенный язык
   * @returns {number} Уверенность от 0 до 1
   */
  getLanguageConfidence(text, language) {
    const normalizedText = this.normalizeText(text);
    const dictionary = this.languageDictionaries[language];
    
    if (!dictionary) return 0;
    
    return this.calculateLanguageScore(normalizedText, dictionary);
  }

  /**
   * Оригинальный метод определения языка
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguage(text) {
    try {
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid text for language detection');
        return this.defaultLanguage;
      }

      // Проверяем кириллицу еще раз
      const cyrillicResult = this.detectCyrillic(text);
      if (cyrillicResult) {
        this.detectionStats.byCyrillic++;
        return cyrillicResult;
      }

      // Проверяем испанские диакритики
      const diacriticsResult = this.detectSpanishDiacritics(text);
      if (diacriticsResult) {
        this.detectionStats.byDiacritics++;
        return diacriticsResult;
      }

      // Очистка и подготовка текста для анализа
      const cleanText = this.normalizeText(text);
      
      if (cleanText.length < 3) {
        return this.defaultLanguage;
      }

      // Подсчет совпадений для каждого языка
      const scores = {};
      
      for (const [lang, dictionary] of Object.entries(this.languageDictionaries)) {
        scores[lang] = this.calculateLanguageScore(cleanText, dictionary);
      }

      // Определение языка с наивысшим счетом
      const detectedLanguage = this.selectBestLanguage(scores, text);
      
      this.detectionStats.byKeywords++;
      logger.debug(`Language detected: ${detectedLanguage} for text: "${text.substring(0, 50)}..." (scores: ${JSON.stringify(scores)})`);
      
      return detectedLanguage;
    } catch (error) {
      logger.error('Language detection error:', error.message);
      this.detectionStats.fallback++;
      return this.defaultLanguage;
    }
  }

  /**
   * Получает предпочтительный язык пользователя
   * @param {string} userId - ID пользователя
   * @returns {string|null} Код языка или null
   */
  getPreferredLanguage(userId) {
    if (!userId) return null;
    return this.userLanguageCache.get(userId) || null;
  }

  /**
   * Обновляет языковое предпочтение пользователя с временной меткой
   * @param {string} userId - ID пользователя
   * @param {string} language - Код языка
   */
  updateUserLanguagePreference(userId, language) {
    if (!userId || !this.isSupportedLanguage(language)) return;
    
    // Сохраняем с временной меткой для потенциального анализа
    this.userLanguageCache.set(userId, {
      language,
      lastUsed: Date.now(),
      count: (this.userLanguageCache.get(userId)?.count || 0) + 1
    });
    
    // Ограничиваем размер кеша
    if (this.userLanguageCache.size > 10000) {
      // Удаляем 10% самых старых записей
      const entries = Array.from(this.userLanguageCache.entries());
      entries
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
        .slice(0, Math.floor(entries.length * 0.1))
        .forEach(([key]) => this.userLanguageCache.delete(key));
    }
  }

  /**
   * Получает предпочтительный язык пользователя (исправленная версия)
   * @param {string} userId - ID пользователя
   * @returns {string|null} Код языка или null
   */
  getPreferredLanguage(userId) {
    if (!userId) return null;
    const cached = this.userLanguageCache.get(userId);
    return cached ? (typeof cached === 'string' ? cached : cached.language) : null;
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
      logger.info('All language cache cleared');
    }
  }

  /**
   * Нормализует текст для анализа, сохраняя кириллицу и диакритики
   * @param {string} text - Исходный текст
   * @returns {string} Нормализованный текст
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      // Убираем знаки препинания, НО сохраняем диакритики и кириллицу
      .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Вычисляет счет для языка
   * @param {string} text - Нормализованный текст
   * @param {Object} dictionary - Словарь языка
   * @returns {number} Счет языка
   */
  calculateLanguageScore(text, dictionary) {
    let score = 0;
    const words = text.split(/\s+/);
    const totalWords = words.length;

    // Проверка ключевых слов
    let keywordMatches = 0;
    for (const keyword of dictionary.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (text.match(regex) || []).length;
      keywordMatches += matches;
    }

    // Проверка паттернов
    let patternMatches = 0;
    for (const pattern of dictionary.patterns) {
      const matches = (text.match(pattern) || []).length;
      patternMatches += matches;
    }

    // Проверка специфических признаков языка
    let specificMatches = 0;
    if (dictionary.specificChecks) {
      for (const check of dictionary.specificChecks) {
        const matches = (text.match(check) || []).length;
        specificMatches += matches;
      }
    }

    // Вычисление итогового счета с увеличенным весом для специфических признаков
    score = (keywordMatches * 2 + patternMatches * 1.5 + specificMatches * 3) / Math.max(totalWords, 1);
    
    return score;
  }

  /**
   * Выбирает язык с наивысшим счетом
   * @param {Object} scores - Счета для каждого языка
   * @param {string} originalText - Оригинальный текст для дополнительных проверок
   * @returns {string} Код определенного языка
   */
  selectBestLanguage(scores, originalText) {
    let bestLanguage = this.defaultLanguage;
    let maxScore = 0;

    // Находим язык с максимальным счетом
    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestLanguage = lang;
      }
    }

    // Дополнительные эвристики для повышения точности
    if (maxScore < this.confidenceThreshold) {
      // Если уверенность низкая, используем дополнительные проверки
      bestLanguage = this.performAdditionalChecks(scores, originalText);
    }

    return bestLanguage;
  }

  /**
   * Выполняет дополнительные проверки для определения языка
   * @param {Object} scores - Счета для каждого языка
   * @param {string} text - Оригинальный текст
   * @returns {string} Код языка
   */
  performAdditionalChecks(scores, text) {
    // Проверка на кириллицу - однозначно русский
    if (/[\u0400-\u04FF]/g.test(text)) {
      return 'ru';
    }

    // Проверка на испанские символы - однозначно испанский
    if (/[ñáéíóúü]/i.test(text)) {
      return 'es';
    }

    // Дополнительные проверки по характерным словам
    const lowerText = text.toLowerCase();
    
    // Русские вопросные слова
    if (/\b(что|как|где|когда|почему|зачем)\s+(такое|это|можно|нужно|делать)\b/i.test(lowerText)) {
      return 'ru';
    }

    // Испанские вопросные слова
    if (/\b(qué|cómo|dónde|cuándo|por\s+qué)\s+(es|está|puedo|necesito)\b/i.test(lowerText)) {
      return 'es';
    }

    // Если есть хотя бы минимальное совпадение с русским, предпочитаем его
    if (scores.ru && scores.ru > 0) {
      return 'ru';
    }

    // Между английским и испанским выбираем тот, у кого выше счет
    if (scores.es > scores.en) {
      return 'es';
    }

    return this.defaultLanguage;
  }

  /**
   * Проверяет, является ли язык поддерживаемым
   * @param {string} languageCode - Код языка
   * @returns {boolean} Поддерживается ли язык
   */
  isSupportedLanguage(languageCode) {
    return ['en', 'es', 'ru'].includes(languageCode);
  }

  /**
   * Возвращает список поддерживаемых языков
   * @returns {string[]} Массив кодов поддерживаемых языков
   */
  getSupportedLanguages() {
    return Object.keys(this.languageDictionaries);
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
      // Парсим заголовок Accept-Language
      const languages = acceptLanguageHeader
        .split(',')
        .map(lang => {
          const parts = lang.trim().split(';');
          const code = parts[0].split('-')[0].toLowerCase();
          const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
          return { code, quality };
        })
        .sort((a, b) => b.quality - a.quality);

      // Найти первый поддерживаемый язык
      for (const lang of languages) {
        if (this.isSupportedLanguage(lang.code)) {
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
      supportedLanguages: this.getSupportedLanguages(),
      defaultLanguage: this.defaultLanguage,
      confidenceThreshold: this.confidenceThreshold,
      totalKeywords: Object.values(this.languageDictionaries)
        .reduce((sum, dict) => sum + dict.keywords.length, 0),
      totalPatterns: Object.values(this.languageDictionaries)
        .reduce((sum, dict) => sum + dict.patterns.length, 0),
      cachedUsers: this.userLanguageCache.size,
      cacheSize: this.userLanguageCache.size,
      detectionStats: {
        ...this.detectionStats,
        // Добавляем процентные соотношения
        cyrillicPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byCyrillic / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        diacriticsPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byDiacritics / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        keywordsPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byKeywords / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        contextPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.byContext / this.detectionStats.total * 100).toFixed(1) + '%' : '0%',
        fallbackPercentage: this.detectionStats.total > 0 ? 
          (this.detectionStats.fallback / this.detectionStats.total * 100).toFixed(1) + '%' : '0%'
      }
    };
  }

  /**
   * Сбрасывает статистику определения языка
   */
  resetStats() {
    this.detectionStats = {
      total: 0,
      byCyrillic: 0,
      byDiacritics: 0,
      byKeywords: 0,
      byContext: 0,
      fallback: 0
    };
    logger.info('Language detection stats reset');
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();