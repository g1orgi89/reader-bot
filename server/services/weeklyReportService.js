/**
 * @fileoverview Сервис генерации еженедельных отчетов для проекта "Читатель"
 * @author g1orgi89
 */

const logger = require('../utils/simpleLogger');
const { UserProfile, Quote, WeeklyReport } = require('../models');

/**
 * @typedef {import('../types/reader').WeeklyReport} WeeklyReport
 * @typedef {import('../types/reader').UserProfile} UserProfile  
 * @typedef {import('../types/reader').Quote} Quote
 */

/**
 * Сервис генерации еженедельных отчетов
 */
class WeeklyReportService {
  constructor() {
    /**
     * @type {Array<Object>} - Доступные книги Анны для рекомендаций
     */
    this.annaBooks = [
      {
        title: 'Искусство любить',
        author: 'Эрих Фромм',
        price: '$8',
        description: 'О построении здоровых отношений с собой и миром',
        categories: ['Любовь', 'Отношения', 'Саморазвитие'],
        utmCampaign: 'art_of_loving'
      },
      {
        title: 'Письма к молодому поэту',
        author: 'Райнер Мария Рильке',
        price: '$8',
        description: 'О творчестве, одиночестве и поиске себя',
        categories: ['Творчество', 'Философия', 'Саморазвитие'],
        utmCampaign: 'letters_young_poet'
      },
      {
        title: 'Быть собой',
        author: 'Курс Анны Бусел',
        price: '$12',
        description: 'О самопринятии и аутентичности',
        categories: ['Саморазвитие', 'Мудрость', 'Материнство'],
        utmCampaign: 'be_yourself_course'
      },
      {
        title: 'Женщина, которая читает, опасна',
        author: 'Стефан Боллманн',
        price: '$10',
        description: 'О женственности и силе через литературу',
        categories: ['Саморазвитие', 'Творчество', 'Мудрость'],
        utmCampaign: 'dangerous_woman_reader'
      },
      {
        title: 'Алхимик',
        author: 'Пауло Коэльо',
        price: '$8',
        description: 'О поиске смысла жизни и следовании мечте',
        categories: ['Философия', 'Мотивация', 'Мудрость'],
        utmCampaign: 'alchemist_analysis'
      },
      {
        title: 'Маленький принц',
        author: 'Антуан де Сент-Экзюпери',
        price: '$6',
        description: 'О простых истинах жизни глазами ребенка',
        categories: ['Философия', 'Мудрость', 'Материнство'],
        utmCampaign: 'little_prince_analysis'
      }
    ];

    logger.info('📖 WeeklyReportService initialized');
  }

  /**
   * Генерация еженедельного отчета для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<WeeklyReport|null>} Созданный отчет или null
   */
  async generateWeeklyReport(userId) {
    try {
      const user = await UserProfile.findOne({ userId });
      if (!user) {
        logger.warn(`📖 User not found for weekly report: ${userId}`);
        return null;
      }

      const weekNumber = this.getCurrentWeekNumber();
      const year = new Date().getFullYear();

      // Проверяем, не создан ли уже отчет за эту неделю
      const existingReport = await WeeklyReport.findOne({
        userId,
        weekNumber,
        year
      });

      if (existingReport) {
        logger.info(`📖 Weekly report already exists for user ${userId}, week ${weekNumber}`);
        return existingReport;
      }

      // Получаем цитаты за неделю
      const weekQuotes = await this.getWeekQuotes(userId, weekNumber, year);

      if (weekQuotes.length === 0) {
        return await this.generateEmptyWeekReport(userId, user, weekNumber, year);
      }

      // AI-анализ недели (БЕЗ ClaudeService!)
      const analysis = await this.analyzeWeeklyQuotes(weekQuotes, user);
      
      // Подбор рекомендаций книг
      const recommendations = await this.getBookRecommendations(analysis, user, weekQuotes);
      
      // Генерация промокода
      const promoCode = this.generatePromoCode();

      // Создание отчета
      const report = new WeeklyReport({
        userId,
        weekNumber,
        year,
        quotes: weekQuotes.map(q => q._id),
        analysis,
        recommendations,
        promoCode,
        sentAt: new Date()
      });

      await report.save();

      logger.info(`📖 Weekly report generated for user ${userId}, week ${weekNumber}`);
      return report;

    } catch (error) {
      logger.error(`📖 Error generating weekly report for user ${userId}: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Получение цитат за указанную неделю
   * @param {string} userId - ID пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<Array<Quote>>} Цитаты за неделю
   */
  async getWeekQuotes(userId, weekNumber, year) {
    return await Quote.find({
      userId,
      weekNumber,
      yearNumber: year
    }).sort({ createdAt: 1 });
  }

  /**
   * AI-анализ цитат за неделю (простая версия без Claude)
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Object>} Анализ недели
   */
  async analyzeWeeklyQuotes(quotes, userProfile) {
    // Простой анализ без AI для начала
    const categoriesCount = {};
    quotes.forEach(q => {
      categoriesCount[q.category] = (categoriesCount[q.category] || 0) + 1;
    });

    const dominantCategories = Object.entries(categoriesCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // Простой анализ на основе категорий
    const analysis = {
      summary: "Ваши цитаты отражают глубокий внутренний поиск",
      dominantThemes: dominantCategories,
      emotionalTone: "размышляющий",
      insights: `Эта неделя показывает ваш интерес к темам: ${dominantCategories.join(', ')}. Вы ищете ответы и вдохновение в словах мудрых людей.`,
      personalGrowth: "Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг."
    };

    return analysis;
  }

  /**
   * Подбор рекомендаций книг на основе анализа
   * @param {Object} analysis - Анализ недели
   * @param {UserProfile} userProfile - Профиль пользователя
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @returns {Promise<Array<Object>>} Рекомендации книг
   */
  async getBookRecommendations(analysis, userProfile, quotes) {
    // Простой подбор книг на основе доминирующих тем
    const fallbackBooks = this.selectFallbackBooks(analysis.dominantThemes);
    
    return fallbackBooks.map(book => ({
      title: book.title,
      price: book.price,
      description: book.description,
      reasoning: `Подходит для изучения темы ${analysis.dominantThemes[0] || 'саморазвитие'}`,
      link: this.generateUTMLink(book.utmCampaign, userProfile.userId),
      utmCampaign: book.utmCampaign
    }));
  }

  /**
   * Выбор резервных книг на основе тем
   * @param {Array<string>} themes - Доминирующие темы
   * @returns {Array<Object>} Подходящие книги
   */
  selectFallbackBooks(themes) {
    const selectedBooks = [];
    
    for (const theme of themes) {
      const suitableBooks = this.annaBooks.filter(book => 
        book.categories.includes(theme)
      );
      
      if (suitableBooks.length > 0 && selectedBooks.length < 3) {
        const randomBook = suitableBooks[Math.floor(Math.random() * suitableBooks.length)];
        if (!selectedBooks.find(b => b.title === randomBook.title)) {
          selectedBooks.push(randomBook);
        }
      }
    }

    // Если не нашли по темам, добавляем популярные
    if (selectedBooks.length === 0) {
      selectedBooks.push(this.annaBooks[0]); // Искусство любить
    }
    if (selectedBooks.length === 1) {
      selectedBooks.push(this.annaBooks[2]); // Быть собой
    }

    return selectedBooks.slice(0, 3);
  }

  /**
   * Генерация промокода для недели
   * @returns {Object} Промокод
   */
  generatePromoCode() {
    const codes = ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20', 'WEEK20'];
    const selectedCode = codes[Math.floor(Math.random() * codes.length)];
    
    return {
      code: selectedCode,
      discount: 20,
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 дня
    };
  }

  /**
   * Генерация UTM ссылки
   * @param {string} campaign - Название кампании
   * @param {string} userId - ID пользователя
   * @returns {string} UTM ссылка
   */
  generateUTMLink(campaign, userId) {
    const baseUrl = "https://anna-busel.com/books";
    const utmParams = new URLSearchParams({
      utm_source: 'telegram_bot',
      utm_medium: 'weekly_report',
      utm_campaign: campaign,
      utm_content: 'reader_recommendations',
      user_id: userId
    });
    
    return `${baseUrl}?${utmParams.toString()}`;
  }

  /**
   * Генерация отчета для недели без цитат
   * @param {string} userId - ID пользователя
   * @param {UserProfile} user - Профиль пользователя
   * @param {number} weekNumber - Номер недели
   * @param {number} year - Год
   * @returns {Promise<WeeklyReport>} Отчет
   */
  async generateEmptyWeekReport(userId, user, weekNumber, year) {
    const report = new WeeklyReport({
      userId,
      weekNumber,
      year,
      quotes: [],
      analysis: {
        summary: "Неделя без новых цитат",
        dominantThemes: [],
        emotionalTone: "паузы",
        insights: `${user.name}, на этой неделе вы не сохранили ни одной цитаты. Иногда паузы тоже важны - они дают время осмыслить уже накопленную мудрость.`,
        personalGrowth: "Время для внутреннего созерцания"
      },
      recommendations: [],
      promoCode: null,
      sentAt: new Date()
    });

    await report.save();
    
    logger.info(`📖 Empty weekly report generated for user ${userId}, week ${weekNumber}`);
    return report;
  }

  /**
   * Получить номер текущей недели
   * @returns {number} Номер недели
   */
  getCurrentWeekNumber() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Склонение слова "цитата"
   * @param {number} count - Количество
   * @returns {string} Склоненное слово
   */
  declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Получение статистики сервиса
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      availableBooks: this.annaBooks.length,
      bookCategories: [...new Set(this.annaBooks.flatMap(book => book.categories))],
      promoCodeOptions: ['READER20', 'WISDOM20', 'QUOTES20', 'BOOKS20', 'WEEK20'],
      features: {
        aiAnalysis: false, // Временно отключили AI анализ
        bookRecommendations: true,
        promoCodeGeneration: true,
        utmTracking: true,
        emptyWeekHandling: true
      }
    };
  }
}

module.exports = { WeeklyReportService };