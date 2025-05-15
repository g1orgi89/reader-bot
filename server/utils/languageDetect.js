/**
 * Утилита для определения языка сообщения
 * @file server/utils/languageDetect.js
 */

/**
 * @typedef {string} LanguageCode
 * @description Код языка: 'en', 'ru', 'es'
 */

/**
 * Класс для определения языка сообщения
 */
class LanguageDetector {
  constructor() {
    // Ключевые слова для каждого языка
    this.languagePatterns = {
      en: {
        keywords: [
          'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'his', 'how', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
          'what', 'when', 'where', 'why', 'how', 'which', 'this', 'that', 'these', 'those',
          'hello', 'help', 'please', 'thank', 'sorry', 'yes', 'no',
          'wallet', 'token', 'staking', 'farming', 'transaction', 'blockchain', 'crypto'
        ],
        patterns: [
          /\b(what|how|when|where|why|which)\s+is\b/i,
          /\b(can|could|should|would)\s+\w+/i,
          /\b(i|you|we|they)\s+(am|are|is|was|were|have|had|will|would|could|should)\b/i
        ]
      },
      
      ru: {
        keywords: [
          'что', 'как', 'где', 'когда', 'почему', 'зачем', 'кто', 'куда', 'откуда',
          'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'у', 'к', 'о', 'об', 'за', 'под', 'над', 'при', 'без', 'через',
          'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они',
          'это', 'этот', 'эта', 'эти', 'тот', 'та', 'те',
          'да', 'нет', 'не', 'или', 'если', 'то', 'бы', 'же', 'ли',
          'привет', 'помощь', 'спасибо', 'пожалуйста', 'извините',
          'кошелек', 'токен', 'стейкинг', 'фарминг', 'транзакция', 'блокчейн', 'крипта'
        ],
        patterns: [
          /[а-яё]/i,
          /\b(что|как|где|когда|почему|зачем)\b/i,
          /\b(может|можно|нужно|надо|должен|должна)\b/i
        ]
      },
      
      es: {
        keywords: [
          'qué', 'cómo', 'dónde', 'cuándo', 'por qué', 'para qué', 'quién', 'cuál',
          'y', 'en', 'con', 'para', 'por', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
          'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
          'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
          'sí', 'no', 'o', 'si', 'que', 'se', 'lo', 'le', 'les',
          'hola', 'ayuda', 'gracias', 'por favor', 'perdón',
          'billetera', 'cartera', 'token', 'staking', 'farming', 'transacción', 'blockchain', 'crypto'
        ],
        patterns: [
          /[ñáéíóúü]/i,
          /\b(qué|cómo|dónde|cuándo|por\s+qué|para\s+qué)\b/i,
          /\b(puede|pueden|necesito|necesita|debo|debe)\b/i
        ]
      }
    };
  }

  /**
   * Определяет язык сообщения
   * @param {string} message - Текст сообщения
   * @returns {LanguageCode} Код языка
   */
  detect(message) {
    if (!message || typeof message !== 'string') {
      return 'en'; // По умолчанию английский
    }

    const text = message.toLowerCase().trim();
    
    // Для очень коротких сообщений используем простые правила
    if (text.length <= 10) {
      if (/[а-яё]/.test(text)) return 'ru';
      if (/[ñáéíóúü]/.test(text)) return 'es';
      return 'en';
    }

    const scores = {
      en: 0,
      ru: 0,
      es: 0
    };

    // Проверяем паттерны для каждого языка
    Object.entries(this.languagePatterns).forEach(([lang, data]) => {
      // Проверяем ключевые слова
      data.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          scores[lang] += matches.length;
        }
      });

      // Проверяем паттерны
      data.patterns.forEach(pattern => {
        if (pattern.test(text)) {
          scores[lang] += 2; // Паттерны весят больше
        }
      });
    });

    // Дополнительные проверки
    
    // Русские символы
    const cyrillicChars = text.match(/[а-яё]/gi);
    if (cyrillicChars) {
      scores.ru += cyrillicChars.length * 0.5;
    }

    // Испанские символы
    const spanishChars = text.match(/[ñáéíóúü]/gi);
    if (spanishChars) {
      scores.es += spanishChars.length * 0.5;
    }

    // Определяем язык с наибольшим счетом
    const maxScore = Math.max(...Object.values(scores));
    
    // Если все счета равны 0, анализируем дальше
    if (maxScore === 0) {
      // Проверяем характерные конструкции
      
      // Английские конструкции
      if (/\b(what|how|when|where|why)\s+(is|are|do|does|can|could|should|would)/i.test(text)) {
        return 'en';
      }
      
      // Русские вопросы
      if (/\b(что\s+такое|как\s+работает|где\s+можно|когда\s+будет)/i.test(text)) {
        return 'ru';
      }
      
      // Испанские вопросы
      if (/\b(qué\s+es|cómo\s+funciona|dónde\s+puedo|cuándo\s+será)/i.test(text)) {
        return 'es';
      }
      
      return 'en'; // По умолчанию
    }

    // Возвращаем язык с наибольшим счетом
    return Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
  }

  /**
   * Проверяет, является ли текст на определенном языке
   * @param {string} message - Текст для проверки
   * @param {LanguageCode} targetLanguage - Целевой язык
   * @returns {boolean} True если текст на целевом языке
   */
  isLanguage(message, targetLanguage) {
    return this.detect(message) === targetLanguage;
  }

  /**
   * Определяет язык с процентом уверенности
   * @param {string} message - Текст сообщения
   * @returns {Object} Объект с языком и процентом уверенности
   */
  detectWithConfidence(message) {
    const detectedLanguage = this.detect(message);
    
    // Простая эвристика для определения уверенности
    let confidence = 0.5; // Базовая уверенность
    
    const text = message.toLowerCase();
    
    // Увеличиваем уверенность при наличии характерных символов
    if (detectedLanguage === 'ru' && /[а-яё]/.test(text)) {
      confidence = Math.min(0.95, confidence + (/[а-яё]/g.test(text) ? 0.4 : 0));
    } else if (detectedLanguage === 'es' && /[ñáéíóúü]/.test(text)) {
      confidence = Math.min(0.95, confidence + 0.4);
    } else if (detectedLanguage === 'en') {
      // Для английского уверенность зависит от отсутствия других языков
      if (!/[а-яёñáéíóúü]/.test(text)) {
        confidence = Math.min(0.9, confidence + 0.3);
      }
    }
    
    return {
      language: detectedLanguage,
      confidence: Math.round(confidence * 100) / 100
    };
  }
}

// Создаем единственный экземпляр
const languageDetector = new LanguageDetector();

module.exports = {
  detect: (message) => languageDetector.detect(message),
  isLanguage: (message, targetLanguage) => languageDetector.isLanguage(message, targetLanguage),
  detectWithConfidence: (message) => languageDetector.detectWithConfidence(message)
};
