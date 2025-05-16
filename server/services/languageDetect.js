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
    this.confidenceThreshold = 0.1; // Понижен порог для лучшего обнаружения
    this.defaultLanguage = 'en';
    
    // Кеш языковых предпочтений пользователей
    this.userLanguageCache = new Map();
    
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
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid text for language detection');
        return this.getPreferredLanguage(options.userId) || this.defaultLanguage;
      }

      // ПРИОРИТЕТНАЯ ПРОВЕРКА: Быстрая проверка очевидных признаков языка
      const quickResult = this.quickLanguageCheck(text);
      if (quickResult) {
        // Если быстрая проверка дала результат, используем его
        this.updateUserLanguagePreference(options.userId, quickResult);
        return quickResult;
      }

      // Если есть предпочтительный язык пользователя и текст короткий, используем его
      const userPreferredLang = this.getPreferredLanguage(options.userId);
      if (userPreferredLang && text.trim().length < 10) {
        return userPreferredLang;
      }

      // Анализ истории для определения контекста
      let contextLanguage = null;
      if (options.history && options.history.length > 0) {
        contextLanguage = this.analyzeConversationContext(options.history);
      }

      // Обработка смешанного контента (основной текст + технические вставки)
      const { mainText, technicalParts } = this.separateTechnicalContent(text);
      
      // Определяем язык основного содержимого
      const detectedLanguage = this.detectLanguage(mainText);
      
      // Если основной текст слишком короткий, используем контекст
      if (mainText.trim().length < 20 && contextLanguage) {
        // Проверяем, есть ли явные признаки другого языка
        const quickCheck = this.quickLanguageCheck(mainText);
        if (quickCheck && quickCheck !== contextLanguage) {
          // Если есть явные признаки смены языка, используем их
          this.updateUserLanguagePreference(options.userId, quickCheck);
          return quickCheck;
        }
        // Иначе используем язык из контекста
        return contextLanguage;
      }

      // Сохраняем язык пользователя для будущих запросов
      this.updateUserLanguagePreference(options.userId, detectedLanguage);
      
      logger.info(`Language detected with context: ${detectedLanguage} for text: "${text.substring(0, 50)}..." (context: ${contextLanguage}, technical parts: ${technicalParts.length})`);
      
      return detectedLanguage;
    } catch (error) {
      logger.error('Language detection with context error:', error.message);
      return this.getPreferredLanguage(options.userId) || this.defaultLanguage;
    }
  }

  /**
   * Быстрая проверка языка для очевидных случаев
   * @param {string} text - Текст для проверки
   * @returns {string|null} Код языка или null если не уверен
   */
  quickLanguageCheck(text) {
    // ПЕРВЫЙ ПРИОРИТЕТ: Кириллица - однозначно русский
    // Используем более надежную проверку на кириллицу
    const cyrillicPattern = /[\u0400-\u04FF]/g;
    const cyrillicMatches = text.match(cyrillicPattern);
    
    if (cyrillicMatches && cyrillicMatches.length >= 2) {
      // Если найдено 2 или больше кириллических символов - точно русский
      logger.info(`Russian detected by cyrillic characters: ${cyrillicMatches.length} chars`);
      return 'ru';
    }
    
    // ВТОРОЙ ПРИОРИТЕТ: Испанские диакритики - однозначно испанский
    if (/[ñáéíóúü]/gi.test(text)) {
      return 'es';
    }
    
    // ТРЕТИЙ ПРИОРИТЕТ: Характерные русские слова
    if (/\b(что|как|где|когда|почему|привет|спасибо|пожалуйста|кошелек|токен|у\s+меня|мне|нужно)\b/gi.test(text)) {
      return 'ru';
    }
    
    // Характерные испанские слова
    if (/\b(qué|cómo|dónde|cuándo|hola|gracias|por\s+favor|billetera)\b/gi.test(text)) {
      return 'es';
    }
    
    return null;
  }

  /**
   * Разделяет текст на основное содержимое и технические части
   * @param {string} text - Исходный текст
   * @returns {Object} Объект с mainText и technicalParts
   */
  separateTechnicalContent(text) {
    let mainText = text;
    const technicalParts = [];

    // Извлекаем технические части
    for (const pattern of this.technicalPatterns) {
      const matches = mainText.match(pattern);
      if (matches) {
        technicalParts.push(...matches);
        // Заменяем технические части на пробелы
        mainText = mainText.replace(pattern, ' ');
      }
    }

    // Очищаем лишние пробелы
    mainText = mainText.replace(/\s+/g, ' ').trim();

    return { mainText, technicalParts };
  }

  /**
   * Анализирует контекст разговора для определения языка
   * @param {Array} history - История сообщений
   * @returns {string|null} Наиболее вероятный язык или null
   */
  analyzeConversationContext(history) {
    if (!history || history.length === 0) {
      return null;
    }

    const languageCounts = { en: 0, es: 0, ru: 0 };
    let totalMessages = 0;

    // Анализируем последние 5 сообщений
    const recentHistory = history.slice(-5);
    
    for (const message of recentHistory) {
      if (message.role === 'user' && message.content) {
        const lang = this.detectLanguage(message.content);
        languageCounts[lang]++;
        totalMessages++;
      }
    }

    if (totalMessages === 0) {
      return null;
    }

    // Находим преобладающий язык
    let maxCount = 0;
    let dominantLanguage = null;
    
    for (const [lang, count] of Object.entries(languageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantLanguage = lang;
      }
    }

    // Возвращаем язык только если он действительно преобладает
    return maxCount > totalMessages * 0.5 ? dominantLanguage : null;
  }

  /**
   * Оригинальный метод определения языка (сохранен для обратной совместимости)
   * @param {string} text - Текст для анализа
   * @returns {string} Код языка (en, es, ru)
   */
  detectLanguage(text) {
    try {
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid text for language detection');
        return this.defaultLanguage;
      }

      // ПЕРВАЯ ПРИОРИТЕТНАЯ ПРОВЕРКА: наличие кириллических символов
      // Ищем русские буквы в оригинальном тексте
      const cyrillicPattern = /[\u0400-\u04FF]/g;
      const cyrillicMatches = text.match(cyrillicPattern);
      
      if (cyrillicMatches && cyrillicMatches.length >= 1) {
        // Если найден хотя бы один кириллический символ - высокая вероятность русского
        logger.info(`Russian detected by cyrillic characters: ${cyrillicMatches.length} chars`);
        return 'ru';
      }

      // ВТОРАЯ ПРИОРИТЕТНАЯ ПРОВЕРКА: испанские специальные символы
      if (/[ñáéíóúü]/i.test(text)) {
        logger.info(`Spanish detected by special characters`);
        return 'es';
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
      
      logger.info(`Language detected: ${detectedLanguage} for text: "${text.substring(0, 50)}..." (scores: ${JSON.stringify(scores)})`);
      
      return detectedLanguage;
    } catch (error) {
      logger.error('Language detection error:', error.message);
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
   * Обновляет языковое предпочтение пользователя
   * @param {string} userId - ID пользователя
   * @param {string} language - Код языка
   */
  updateUserLanguagePreference(userId, language) {
    if (!userId || !this.isSupportedLanguage(language)) return;
    
    this.userLanguageCache.set(userId, language);
    
    // Ограничиваем размер кеша
    if (this.userLanguageCache.size > 10000) {
      // Удаляем 10% самых старых записей
      const entries = Array.from(this.userLanguageCache.entries());
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.1));
      toDelete.forEach(([key]) => this.userLanguageCache.delete(key));
    }
  }

  /**
   * Очищает кеш языковых предпочтений
   * @param {string} userId - ID пользователя (опционально)
   */
  clearLanguageCache(userId = null) {
    if (userId) {
      this.userLanguageCache.delete(userId);
    } else {
      this.userLanguageCache.clear();
    }
  }

  /**
   * Нормализует текст для анализа, сохраняя кириллицу
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
   * Получает статистику работы сервиса
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
      cacheSize: this.userLanguageCache.size
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new LanguageDetectService();