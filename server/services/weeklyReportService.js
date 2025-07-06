/**
 * Сервис для генерации еженедельных отчетов для проекта "Читатель"
 * @file server/services/weeklyReportService.js
 * 🔧 FIX: Исправлена ошибка конфликта системных промптов
 * 🔧 FIX: Используем прямой API вызов без системного промпта для JSON анализа
 * 🔧 FIX: Добавлена валидация и очистка JSON ответов
 * 🔧 FIX: Добавлено поле reasoning в рекомендации
 */

const logger = require('../utils/logger');

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
    // Получаем прямой доступ к Claude API для JSON анализа
    this.anthropic = null;
    this.initializeAnthropicClient();
  }

  /**
   * 🔧 FIX: Инициализация прямого клиента Anthropic для JSON анализа
   * @private
   */
  initializeAnthropicClient() {
    try {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const { getAIProviderConfig } = require('../config/aiProvider');
      
      const config = getAIProviderConfig();
      this.anthropic = new Anthropic({
        apiKey: config.claude.apiKey,
      });
      
      this.claudeConfig = config.claude;
      logger.info('📖 WeeklyReportService: Direct Anthropic client initialized');
    } catch (error) {
      logger.error('📖 WeeklyReportService: Failed to initialize Anthropic client:', error.message);
      this.anthropic = null;
    }
  }

  /**
   * 🔧 FIX: Прямой AI-анализ без конфликтующих системных промптов
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<WeeklyAnalysis>} Анализ недели
   */
  async analyzeWeeklyQuotes(quotes, userProfile) {
    const quotesText = quotes.map(q => `"${q.text}" ${q.author ? `(${q.author})` : ''}`).join('\n\n');
    
    // 🔧 FIX: Минимальный промпт только для JSON анализа
    const analysisPrompt = `Проанализируй цитаты пользователя за неделю в стиле психолога Анны Бусел.\n\nПользователь: ${userProfile.name}\nРезультаты теста: ${JSON.stringify(userProfile.testResults)}\n\nЦитаты за неделю:\n${quotesText}\n\nВерни СТРОГО JSON объект без markdown, комментариев или дополнительного текста:\n\n{\n  "summary": "Краткий анализ недели одним предложением",\n  "dominantThemes": ["тема1", "тема2"],\n  "emotionalTone": "позитивный/нейтральный/задумчивый/etc",\n  "insights": "Подробный психологический анализ от Анны (2-3 предложения)",\n  "personalGrowth": "Наблюдения о личностном росте пользователя"\n}`;

    try {
      logger.info(`📖 Analyzing ${quotes.length} quotes for user ${userProfile.userId} (direct API)`);
      
      // 🔧 FIX: Прямой вызов Claude API без системного промпта
      if (this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: this.claudeConfig.model,
          max_tokens: 1000,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: analysisPrompt
          }]
        });
        
        const analysis = this._parseAIResponse(response.content[0].text);
        
        // Валидация результата
        if (!analysis.summary || !analysis.insights) {
          logger.warn(`📖 Invalid analysis structure, using fallback for user ${userProfile.userId}`);
          return this.getFallbackAnalysis(quotes, userProfile);
        }

        logger.info(`📖 Direct AI analysis completed successfully for user ${userProfile.userId}`);
        return {
          summary: analysis.summary,
          dominantThemes: analysis.dominantThemes || [],
          emotionalTone: analysis.emotionalTone || 'размышляющий',
          insights: analysis.insights,
          personalGrowth: analysis.personalGrowth || 'Ваш выбор цитат говорит о стремлении к пониманию себя и мира вокруг.'
        };
      } else {
        // Fallback если Anthropic клиент не инициализирован
        logger.warn('📖 Anthropic client not available, using fallback analysis');
        return this.getFallbackAnalysis(quotes, userProfile);
      }
      
    } catch (error) {
      logger.error(`📖 Error in direct AI weekly analysis: ${error.message}`);
      
      // ✅ Fallback анализ в случае ошибки AI
      return this.getFallbackAnalysis(quotes, userProfile);
    }
  }

  /**
   * 🔧 FIX: Парсит ответ AI с очисткой и валидацией
   * @private
   * @param {string} aiResponse - Ответ от AI
   * @returns {Object} Распарсенный JSON объект
   * @throws {Error} Если парсинг невозможен
   */
  _parseAIResponse(aiResponse) {
    try {
      // Очищаем ответ от markdown кодблоков и лишнего текста
      let cleanResponse = aiResponse.trim();
      
      // Удаляем markdown кодблоки если есть
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      
      // Ищем JSON объект в ответе
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      // Удаляем возможные объяснения до JSON
      const lines = cleanResponse.split('\n');
      let jsonStartIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('{')) {
          jsonStartIndex = i;
          break;
        }
      }
      
      if (jsonStartIndex > 0) {
        cleanResponse = lines.slice(jsonStartIndex).join('\n');
      }
      
      // Попытка парсинга JSON
      const parsed = JSON.parse(cleanResponse);
      
      logger.info(`📖 Successfully parsed direct AI response JSON`);
      return parsed;
      
    } catch (parseError) {
      logger.error(`📖 JSON parsing failed: ${parseError.message}`);
      logger.error(`📖 Original AI response: ${aiResponse.substring(0, 200)}...`);
      
      // Пытаемся извлечь данные регулярными выражениями как последнее средство
      return this._extractDataWithRegex(aiResponse);
    }
  }

  /**
   * 🔧 FIX: Извлекает данные из ответа AI с помощью регулярных выражений
   * @private
   * @param {string} aiResponse - Ответ от AI
   * @returns {Object} Извлеченные данные
   */
  _extractDataWithRegex(aiResponse) {
    logger.info(`📖 Attempting regex extraction from AI response`);
    
    try {
      // Пытаемся найти ключевые поля в тексте
      const summaryMatch = aiResponse.match(/(?:summary|анализ|итог)[\s"':]*([^"\n]+)/i);
      const insightsMatch = aiResponse.match(/(?:insights|инсайт|вывод)[\s"':]*([^"\n,}]+)/i);
      const toneMatch = aiResponse.match(/(?:tone|тон|настрое)[\s"':]*([^"\n,}]+)/i);
      
      return {
        summary: summaryMatch ? summaryMatch[1].trim() : `За эту неделю пользователь собрал цитаты, отражающие внутренние размышления.`,
        dominantThemes: ['Саморазвитие', 'Мудрость'],
        emotionalTone: toneMatch ? toneMatch[1].trim() : 'размышляющий',
        insights: insightsMatch ? insightsMatch[1].trim() : `Ваши цитаты показывают стремление к пониманию жизни и себя.`,
        personalGrowth: 'Продолжайте собирать моменты вдохновения для личностного роста.'
      };
    } catch (regexError) {
      logger.error(`📖 Regex extraction failed: ${regexError.message}`);
      throw new Error(`Failed to parse AI response: ${regexError.message}`);
    }
  }

  /**
   * Fallback анализ для случаев ошибки AI
   * @param {Array<Quote>} quotes - Цитаты за неделю
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {WeeklyAnalysis} Базовый анализ
   */
  getFallbackAnalysis(quotes, userProfile) {
    logger.info(`📖 Using fallback analysis for user ${userProfile.userId}`);
    
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
      if (text.includes('работ') || text.includes('дел') || text.includes('карьер')) {
        themes.add('Карьера');
      }
      if (text.includes('семь') || text.includes('дом') || text.includes('родител')) {
        themes.add('Семья');
      }
    });

    const themesArray = Array.from(themes);
    return themesArray.length > 0 ? themesArray.slice(0, 3) : ['Саморазвитие'];
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
   * 🔧 FIX: Получает рекомендации книг на основе анализа с полем reasoning
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
        reasoning: 'Ваши цитаты показывают интерес к теме любви и отношений',
        link: this.generateUTMLink('art_of_loving')
      });
    }
    
    if (analysis.dominantThemes.includes('Мудрость') || analysis.dominantThemes.includes('Жизненная философия')) {
      recommendations.push({
        title: '"Письма к молодому поэту" Рильке',
        price: '$8',
        description: 'О творчестве, самопознании и поиске своего пути',
        reasoning: 'Судя по вашим цитатам, вас привлекает философский взгляд на жизнь',
        link: this.generateUTMLink('letters_to_young_poet')
      });
    }
    
    if (analysis.dominantThemes.includes('Саморазвитие')) {
      recommendations.push({
        title: 'Курс "Быть собой"',
        price: '$12',
        description: 'О самопринятии и аутентичности',
        reasoning: 'Ваш выбор цитат говорит о стремлении к личностному росту',
        link: this.generateUTMLink('be_yourself_course')
      });
    }

    if (analysis.dominantThemes.includes('Семья')) {
      recommendations.push({
        title: 'Курс "Мудрая мама"',
        price: '$20',
        description: 'Как сохранить себя в материнстве и воспитать счастливых детей',
        reasoning: 'Ваши цитаты отражают интерес к семейным ценностям',
        link: this.generateUTMLink('wise_mother_course')
      });
    }

    if (analysis.dominantThemes.includes('Счастье')) {
      recommendations.push({
        title: '"Маленький принц" с комментариями',
        price: '$6',
        description: 'О простых истинах жизни и важности человеческих связей',
        reasoning: 'Ваши цитаты показывают поиск простого счастья в жизни',
        link: this.generateUTMLink('little_prince')
      });
    }

    // Если нет специфических тем, добавляем универсальную рекомендацию
    if (recommendations.length === 0) {
      recommendations.push({
        title: '"Маленький принц" с комментариями',
        price: '$6',
        description: 'О простых истинах жизни и важности человеческих связей',
        reasoning: 'Универсальная книга для размышлений о жизни и ценностях',
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

    return `📊 *Ваш отчет за неделю*\n\nЗа эту неделю вы сохранили ${quotes.length} ${this.declensionQuotes(quotes.length)}:\n\n${quotesText}\n\n🎯 *Анализ недели:*\n${report.analysis.insights}\n\n💎 *Рекомендации от Анны:*\n${recommendationsText}\n\n🎁 *Промокод ${report.promoCode.code}* - скидка ${report.promoCode.discount}% до ${report.promoCode.validUntil.toLocaleDateString()}!\n\n---\n💬 Как вам этот отчет?`;
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