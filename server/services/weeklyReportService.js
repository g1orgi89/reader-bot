/**
 * Сервис для генерации еженедельных отчетов для проекта "Читатель"
 * @file server/services/weeklyReportService.js
 * 🔧 FIX: Добавлен правильный импорт claudeService без инициализации RAG
 */

const logger = require('../utils/logger');
const claudeService = require('./claude'); // ✅ Импорт ClaudeService (экземпляр класса)

/**
 * @typedef {Object} Quote
 * @property {string} userId - ID пользователя
 * @property {string} text - Текст цитаты
 * @property {string} [author] - Автор цитаты
 * @property {string} [source] - Источник цитаты
 * @property {string} category - Категория цитаты
 * @property {Date} createdAt - Дата создания
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId - ID пользователя
 * @property {string} name - Имя пользователя
 * @property {string} email - Email пользователя
 * @property {Object} testResults - Результаты онбординг теста
 */

/**
 * @typedef {Object} WeeklyAnalysis
 * @property {string} summary - Краткий анализ недели
 * @property {string[]} dominantThemes - Доминирующие темы
 * @property {string} emotionalTone - Эмоциональный тон
 * @property {string} insights - Психологические инсайты
 * @property {string} personalGrowth - Наблюдения о росте
 */

/**
 * @class WeeklyReportService
 * @description Сервис для генерации еженедельных отчетов с AI-анализом
 */
class WeeklyReportService {
  constructor() {
    this.logger = logger;
  }

  /**
   * ✅ AI-анализ цитат за неделю через существующий claudeService
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<WeeklyAnalysis>} Анализ недели
   */
  async analyzeWeeklyQuotes(quotes, userProfile) {
    const quotesText = quotes.map(q => `"${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n\n');
    
    const prompt = `Ты психолог Анна Бусел. Проанализируй цитаты пользователя за неделю и дай психологический анализ.

Имя пользователя: ${userProfile.name}
Результаты теста: ${JSON.stringify(userProfile.testResults)}

Цитаты за неделю:
${quotesText}

Напиши анализ в стиле Анны Бусел:
- Тон: теплый, профессиональный, обращение на "Вы"
- Глубокий психологический анализ
- Связь с результатами первоначального теста
- Выводы о текущем состоянии и интересах
- 2-3 абзаца

Верни JSON:
{
  "summary": "Краткий анализ недели одним предложением",
  "dominantThemes": ["тема1", "тема2"],
  "emotionalTone": "позитивный/нейтральный/задумчивый/etc",
  "insights": "Подробный психологический анализ от Анны",
  "personalGrowth": "Наблюдения о личностном росте пользователя"
}`;

    try {
      // ✅ ИСПРАВЛЕНИЕ: Отключаем RAG для анализа цитат - нам не нужна база знаний
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: userProfile.userId,
        context: 'weekly_report_analysis',
        useRag: false // 🔧 FIX: Отключаем RAG - анализируем только цитаты пользователя
      });
      
      const analysis = JSON.parse(response.message);
      
      // Валидация результата
      if (!analysis.summary || !analysis.insights) {
        throw new Error('Invalid analysis structure');
      }

      return {
        summary: analysis.summary,
        dominantThemes: analysis.dominantThemes || [],
        emotionalTone: analysis.emotionalTone || 'размышляющий',
        insights: analysis.insights,
        personalGrowth: analysis.personalGrowth || 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
      };
      
    } catch (error) {
      logger.error(`📖 Error in AI weekly analysis: ${error.message}`);
      
      // ✅ Fallback анализ в случае ошибки AI
      return this.getFallbackAnalysis(quotes, userProfile);
    }
  }

  /**
   * Fallback анализ для случаев ошибки AI
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {WeeklyAnalysis} Базовый анализ
   */
  getFallbackAnalysis(quotes, userProfile) {
    const themes = this.extractBasicThemes(quotes);
    
    return {
      summary: `За эту неделю вы собрали ${quotes.length} цитат, что говорит о вашем стремлении к знаниям и самопознанию.`,
      dominantThemes: themes,
      emotionalTone: 'вдохновленный',
      insights: `Дорогой ${userProfile.name}, ваши цитаты показывают глубокий интерес к мудрости и саморазвитию. Продолжайте этот прекрасный путь познания себя через слова великих людей.`,
      personalGrowth: 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
    };
  }

  /**
   * Извлекает базовые темы из цитат (без AI)
   * @param {Array<Quote>} quotes - Цитаты
   * @returns {string[]} Список тем
   */
  extractBasicThemes(quotes) {
    const themes = new Set();
    
    quotes.forEach(quote => {
      const text = quote.text.toLowerCase();
      
      if (text.includes('любов') || text.includes('сердц') || text.includes('чувств')) {
        themes.add('Любовь');
      }
      if (text.includes('жизн') || text.includes('судьб') || text.includes('путь')) {
        themes.add('Жизненная философия');
      }
      if (text.includes('мудр') || text.includes('знан') || text.includes('ум')) {
        themes.add('Мудрость');
      }
      if (text.includes('счасть') || text.includes('радост') || text.includes('улыб')) {
        themes.add('Счастье');
      }
      if (text.includes('цел') || text.includes('мечт') || text.includes('стремлен')) {
        themes.add('Цели и мечты');
      }
    });

    return Array.from(themes).slice(0, 3);
  }

  /**
   * Генерирует полный еженедельный отчет
   * @param {string} userId - ID пользователя
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Object>} Полный отчет
   */
  async generateWeeklyReport(userId, quotes, userProfile) {
    try {
      logger.info(`📖 Generating weekly report for user ${userId} with ${quotes.length} quotes`);
      
      // Получаем AI-анализ цитат
      const analysis = await this.analyzeWeeklyQuotes(quotes, userProfile);
      
      // Генерируем рекомендации книг (можно добавить AI позже)
      const recommendations = this.getBookRecommendations(analysis);
      
      // Создаем промокод
      const promoCode = this.generatePromoCode();
      
      const report = {
        userId,
        weekNumber: this.getCurrentWeekNumber(),
        year: new Date().getFullYear(),
        quotes: quotes.map(q => q._id || q.id),
        analysis,
        recommendations,
        promoCode,
        generatedAt: new Date()
      };

      logger.info(`📖 Weekly report generated successfully for user ${userId}`);
      return report;
      
    } catch (error) {
      logger.error(`📖 Error generating weekly report for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает рекомендации книг на основе анализа
   * @param {WeeklyAnalysis} analysis - Анализ недели
   * @returns {Array<Object>} Рекомендации книг
   */
  getBookRecommendations(analysis) {
    const recommendations = [];
    
    // Базовая логика рекомендаций на основе тем
    if (analysis.dominantThemes.includes('Любовь')) {
      recommendations.push({
        title: 'Разбор "Искусство любить" Эриха Фромма',
        price: '$8',
        description: 'О построении здоровых отношений с собой и миром',
        link: this.generateUTMLink('art_of_loving')
      });
    }
    
    if (analysis.dominantThemes.includes('Мудрость')) {
      recommendations.push({
        title: '"Письма к молодому поэту" Рильке',
        price: '$8',
        description: 'О творчестве, самопознании и поиске своего пути',
        link: this.generateUTMLink('letters_to_young_poet')
      });
    }
    
    if (analysis.dominantThemes.includes('Жизненная философия')) {
      recommendations.push({
        title: 'Курс "Быть собой"',
        price: '$12',
        description: 'О самопринятии и аутентичности',
        link: this.generateUTMLink('be_yourself_course')
      });
    }

    // Если нет специфических тем, добавляем универсальную рекомендацию
    if (recommendations.length === 0) {
      recommendations.push({
        title: '"Маленький принц" с комментариями',
        price: '$6',
        description: 'О простых истинах жизни и важности человеческих связей',
        link: this.generateUTMLink('little_prince')
      });
    }

    return recommendations.slice(0, 2); // Максимум 2 рекомендации
  }

  /**
   * Генерирует промокод для скидки
   * @returns {Object} Информация о промокоде
   */
  generatePromoCode() {
    const codes = ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20'];
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    
    return {
      code: randomCode,
      discount: 20,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 дня
      description: 'Скидка 20% на любой разбор'
    };
  }

  /**
   * Генерирует UTM ссылку для отслеживания
   * @param {string} bookSlug - Идентификатор книги
   * @returns {string} UTM ссылка
   */
  generateUTMLink(bookSlug) {
    const baseUrl = "https://anna-busel.com/books";
    const utmParams = new URLSearchParams({
      utm_source: 'telegram_bot',
      utm_medium: 'weekly_report',
      utm_campaign: 'reader_recommendations',
      utm_content: bookSlug
    });
    
    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Получает номер текущей недели в году
   * @returns {number} Номер недели
   */
  getCurrentWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  /**
   * Форматирует отчет для отправки в Telegram
   * @param {Object} report - Отчет
   * @param {Array<Quote>} quotes - Цитаты
   * @returns {string} Форматированное сообщение
   */
  formatTelegramReport(report, quotes) {
    const quotesText = quotes.slice(0, 5).map((quote, index) => {
      const author = quote.author ? ` (${quote.author})` : '';
      return `✅ "${quote.text.substring(0, 80)}..."${author}`;
    }).join('\n');

    const recommendationsText = report.recommendations.map((rec, index) => {
      return `${index + 1}. [${rec.title}](${rec.link}) - ${rec.price}\n   ${rec.description}`;
    }).join('\n\n');

    return `📊 *Ваш отчет за неделю*

За эту неделю вы сохранили ${quotes.length} ${this.declensionQuotes(quotes.length)}:

${quotesText}

🎯 *Анализ недели:*
${report.analysis.insights}

💎 *Рекомендации от Анны:*
${recommendationsText}

🎁 *Промокод ${report.promoCode.code}* - скидка ${report.promoCode.discount}% до ${report.promoCode.validUntil.toLocaleDateString()}!

---
💬 Как вам этот отчет?`;
  }

  /**
   * Склонение слова "цитата"
   * @param {number} count - Количество
   * @returns {string} Правильное склонение
   */
  declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }
}

// Экспортируем класс для создания экземпляров
module.exports = WeeklyReportService;