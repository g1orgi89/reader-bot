/**
 * @fileoverview Обработчик цитат для бота "Читатель"
 * @author g1orgi89
 */

const logger = require('../../server/utils/logger');
const { UserProfile, Quote } = require('../../server/models');
const claudeService = require('../../server/services/claude');

/**
 * @typedef {import('../../server/types/reader').Quote} Quote
 * @typedef {import('../../server/types/reader').UserProfile} UserProfile
 * @typedef {import('../../server/types/reader').Achievement} Achievement
 */

/**
 * Класс для обработки цитат пользователей
 */
class QuoteHandler {
  constructor() {
    /**
     * @type {Array<Achievement>} - Доступные достижения
     */
    this.achievements = [
      {
        id: 'first_quote',
        name: 'Первые шаги',
        description: 'Сохранили первую цитату',
        icon: '🌱',
        targetValue: 1,
        type: 'quotes_count'
      },
      {
        id: 'wisdom_collector',
        name: 'Коллекционер мудрости',
        description: 'Собрали 25 цитат',
        icon: '📚',
        targetValue: 25,
        type: 'quotes_count'
      },
      {
        id: 'week_philosopher',
        name: 'Философ недели',
        description: '7 дней подряд с цитатами',
        icon: '🔥',
        targetValue: 7,
        type: 'streak_days'
      },
      {
        id: 'classics_lover',
        name: 'Любитель классики',
        description: '10 цитат классиков',
        icon: '📖',
        targetValue: 10,
        type: 'classics_count'
      },
      {
        id: 'deep_thinker',
        name: 'Глубокий мыслитель',
        description: '50 цитат собрано',
        icon: '💭',
        targetValue: 50,
        type: 'quotes_count'
      },
      {
        id: 'philosophy_master',
        name: 'Мастер философии',
        description: '20 философских цитат',
        icon: '🧠',
        targetValue: 20,
        type: 'category_count',
        category: 'Философия'
      }
    ];

    /**
     * @type {Array<string>} - Классические авторы
     */
    this.classicAuthors = [
      'Толстой', 'Достоевский', 'Пушкин', 'Чехов', 'Тургенев',
      'Гоголь', 'Лермонтов', 'Булгаков', 'Бунин', 'Горький',
      'Шекспир', 'Гёте', 'Данте', 'Сервантес', 'Диккенс'
    ];

    logger.info('📖 QuoteHandler initialized');
  }

  /**
   * Проверка, является ли сообщение цитатой (а не командой или обычным текстом)
   * @param {string} text - Текст сообщения
   * @returns {boolean} true если это цитата
   */
  isValidQuote(text) {
    // Слишком короткие сообщения (меньше 10 символов) не являются цитатами
    if (text.length < 10) {
      return false;
    }

    // Исключаем команды
    if (text.startsWith('/')) {
      return false;
    }

    // Исключаем простые фразы без смысла
    const trivialPhrases = [
      'привет', 'hello', 'спасибо', 'thanks', 'хорошо', 'плохо',
      'да', 'нет', 'может быть', 'не знаю', 'понятно', 'ясно'
    ];
    
    if (trivialPhrases.includes(text.toLowerCase().trim())) {
      return false;
    }

    return true;
  }

  /**
   * Обработка цитаты пользователя
   * @param {Object} ctx - Telegram context
   * @param {string} messageText - Текст цитаты
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<void>}
   */
  async handleQuote(ctx, messageText, userProfile) {
    const userId = ctx.from.id.toString();
    
    try {
      // Проверяем, является ли текст валидной цитатой
      if (!this.isValidQuote(messageText)) {
        logger.info(`📖 Message too short or invalid, not treating as quote: "${messageText}"`);
        return;
      }

      // Проверка лимита (10 цитат в день)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayQuotesCount = await Quote.countDocuments({
        userId,
        createdAt: { $gte: today }
      });

      if (todayQuotesCount >= 10) {
        await ctx.reply(
          "📖 Вы уже отправили 10 цитат сегодня. Возвращайтесь завтра за новыми открытиями!\n\n" +
          "💡 Хватит сидеть в телефоне - читайте книги!\n\n" +
          "Используйте время для чтения вместо сбора цитат - это принесет больше пользы."
        );
        return;
      }

      // Парсинг цитаты (извлечение автора)
      const { text, author, source } = this.parseQuote(messageText);
      
      // AI-анализ цитаты через Claude
      const analysis = await this.analyzeQuote(text, author, userProfile);
      
      // Сохранение цитаты
      const quote = new Quote({
        userId,
        text,
        author,
        source,
        category: analysis.category,
        themes: analysis.themes,
        sentiment: analysis.sentiment,
        weekNumber: this.getWeekNumber(),
        monthNumber: new Date().getMonth() + 1,
        yearNumber: new Date().getFullYear()
      });

      await quote.save();
      logger.info(`📖 Quote saved for user ${userId}: "${text.substring(0, 30)}..."`);

      // Обновление статистики пользователя
      await this.updateUserStatistics(userId, author);
      logger.info(`📖 Updated statistics for user ${userId}`);

      // Проверка достижений
      const newAchievements = await this.checkAchievements(userId);

      // Ответ в стиле Анны
      const response = await this.generateAnnaResponse(text, author, analysis, todayQuotesCount + 1);
      
      await ctx.reply(response);

      // Уведомления о достижениях
      if (newAchievements.length > 0) {
        await this.notifyAchievements(ctx, newAchievements);
      }

      logger.info(`📖 Quote processed successfully for user ${userId}`);
      
    } catch (error) {
      logger.error(`📖 Error processing quote: ${error.message}`, error);
      await ctx.reply('📖 Произошла ошибка при сохранении цитаты. Попробуйте еще раз.');
    }
  }

  /**
   * Парсинг цитаты для извлечения автора и источника
   * @param {string} messageText - Исходный текст сообщения
   * @returns {Object} Данные цитаты
   */
  parseQuote(messageText) {
    // Паттерны для парсинга различных форматов
    const patterns = [
      /^\"([^\"]+)\"\s*\(([^)]+)\)$/,     // "Цитата" (Автор)
      /^([^(]+)\s*\(([^)]+)\)$/,       // Цитата (Автор)
      /^([^—]+)\s*—\s*(.+)$/,          // Цитата — Автор
      /^«([^»]+)»\s*\(([^)]+)\)$/,     // «Цитата» (Автор)
      /^([^—]+)\s*—\s*([^,]+),\s*\"([^\"]+)\"$/, // Цитата — Автор, "Источник"
      /^(.+)$/                         // Просто текст
    ];

    for (const pattern of patterns) {
      const match = messageText.trim().match(pattern);
      if (match) {
        if (match[2]) {
          return {
            text: match[1].trim().replace(/^[\"«]|[\"»]$/g, ''), // Убираем кавычки
            author: match[2].trim(),
            source: match[3] ? match[3].trim() : null
          };
        } else {
          return {
            text: match[1].trim().replace(/^[\"«]|[\"»]$/g, ''),
            author: null,
            source: null
          };
        }
      }
    }

    return { 
      text: messageText.trim().replace(/^[\"«]|[\"»]$/g, ''), 
      author: null, 
      source: null 
    };
  }

  /**
   * AI-анализ цитаты через Claude
   * @param {string} text - Текст цитаты
   * @param {string|null} author - Автор цитаты
   * @param {UserProfile} userProfile - Профиль пользователя
   * @returns {Promise<Object>} Анализ цитаты
   */
  async analyzeQuote(text, author, userProfile) {
    const prompt = `Ты психолог Анна Бусел. Проанализируй эту цитату как специалист по психологии и литературе:

Цитата: "${text}"
Автор: ${author || 'Неизвестен'}
Пользователь: ${userProfile.name}
Предыдущие интересы: ${userProfile.preferences?.mainThemes?.join(', ') || 'не определены'}

Проанализируй цитату и верни JSON с полями:
{
  "category": "одна из: Саморазвитие, Любовь, Философия, Мотивация, Мудрость, Творчество, Отношения, Материнство, Карьера, Другое",
  "themes": ["тема1", "тема2", "тема3"],
  "sentiment": "positive/neutral/negative",
  "insights": "краткий психологический инсайт в 1-2 предложения",
  "personalRelevance": "почему эта цитата может быть важна для данного пользователя"
}

Будь точной в категоризации и учитывай контекст автора.`;

    try {
      const response = await claudeService.generateResponse(prompt, {
        platform: 'telegram',
        userId: userProfile.userId,
        context: 'quote_analysis'
      });
      
      const analysis = JSON.parse(response.message);
      
      // Валидация результата
      const validCategories = ['Саморазвитие', 'Любовь', 'Философия', 'Мотивация', 'Мудрость', 'Творчество', 'Отношения', 'Материнство', 'Карьера', 'Другое'];
      if (!validCategories.includes(analysis.category)) {
        analysis.category = 'Другое';
      }

      const validSentiments = ['positive', 'neutral', 'negative'];
      if (!validSentiments.includes(analysis.sentiment)) {
        analysis.sentiment = 'neutral';
      }

      return analysis;
      
    } catch (error) {
      logger.error(`📖 Error in AI quote analysis: ${error.message}`);
      
      // Fallback анализ
      return {
        category: this.fallbackCategorization(text, author),
        themes: this.extractBasicThemes(text),
        sentiment: this.detectBasicSentiment(text),
        insights: 'Глубокая мысль для размышления',
        personalRelevance: 'Может способствовать личностному росту'
      };
    }
  }

  /**
   * Fallback категоризация без AI
   * @private
   * @param {string} text - Текст цитаты
   * @param {string|null} author - Автор
   * @returns {string} Категория
   */
  fallbackCategorization(text, author) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('любовь') || lowerText.includes('сердце') || lowerText.includes('чувств')) {
      return 'Любовь';
    }
    if (lowerText.includes('мудрость') || lowerText.includes('знание') || lowerText.includes('опыт')) {
      return 'Мудрость';
    }
    if (lowerText.includes('жизнь') || lowerText.includes('судьба') || lowerText.includes('смысл')) {
      return 'Философия';
    }
    if (lowerText.includes('цель') || lowerText.includes('успех') || lowerText.includes('достижение')) {
      return 'Мотивация';
    }
    if (lowerText.includes('искусство') || lowerText.includes('творчество') || lowerText.includes('вдохновение')) {
      return 'Творчество';
    }
    if (lowerText.includes('семья') || lowerText.includes('дети') || lowerText.includes('мать')) {
      return 'Материнство';
    }
    if (lowerText.includes('работа') || lowerText.includes('карьера') || lowerText.includes('дело')) {
      return 'Карьера';
    }
    
    return 'Саморазвитие';
  }

  /**
   * Извлечение базовых тем
   * @private
   * @param {string} text - Текст цитаты
   * @returns {Array<string>} Темы
   */
  extractBasicThemes(text) {
    const themes = [];
    const lowerText = text.toLowerCase();
    
    const themeKeywords = {
      'счастье': ['счастье', 'радость', 'блаженство'],
      'мудрость': ['мудрость', 'знание', 'понимание'],
      'любовь': ['любовь', 'сердце', 'чувства'],
      'жизнь': ['жизнь', 'существование', 'бытие'],
      'время': ['время', 'момент', 'вечность'],
      'красота': ['красота', 'прекрасное', 'эстетика']
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        themes.push(theme);
      }
    }

    return themes.length > 0 ? themes : ['жизненный опыт'];
  }

  /**
   * Определение базового настроения
   * @private
   * @param {string} text - Текст цитаты
   * @returns {string} Настроение
   */
  detectBasicSentiment(text) {
    const lowerText = text.toLowerCase();
    
    const positiveWords = ['счастье', 'радость', 'любовь', 'прекрасн', 'велик', 'чудесн', 'светл'];
    const negativeWords = ['боль', 'страдание', 'печаль', 'горе', 'тьма', 'ужас', 'страх'];
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Генерация персонализированного ответа Анны
   * @param {string} text - Текст цитаты
   * @param {string|null} author - Автор цитаты
   * @param {Object} analysis - AI-анализ цитаты
   * @param {number} todayCount - Количество цитат сегодня
   * @returns {Promise<string>} Ответ Анны
   */
  async generateAnnaResponse(text, author, analysis, todayCount) {
    const authorPart = author ? `${author} умеет находить глубину в простых словах.` : 'Мудрые слова для размышления.';
    
    const templates = [
      `✨ Прекрасная цитата! ${authorPart}`,
      `📖 Замечательный выбор! ${analysis.insights}`,
      `💭 Очень глубоко! Эта мысль о ${analysis.themes[0]} особенно актуальна.`,
      `🌟 ${authorPart} Именно такие мысли формируют мудрость.`
    ];

    const baseResponse = templates[Math.floor(Math.random() * templates.length)];
    
    let fullResponse = `${baseResponse}\n\nСохранил в ваш личный дневник 📖\nЦитат сегодня: ${todayCount}/10`;

    // Добавление персонализированного инсайта
    if (analysis.personalRelevance) {
      fullResponse += `\n\n💡 ${analysis.personalRelevance}`;
    }

    // Добавление рекомендации книги (30% вероятность)
    if (Math.random() < 0.3) {
      const recommendation = await this.getBookRecommendation(analysis.category, author);
      if (recommendation) {
        fullResponse += `\n\n📚 ${recommendation}`;
      }
    }

    // Специальные сообщения для важных моментов
    if (todayCount === 1) {
      fullResponse += `\n\n🌱 Отличное начало дня! Первая цитата задает тон размышлениям.`;
    } else if (todayCount >= 5) {
      fullResponse += `\n\n🔥 Вы сегодня особенно вдумчивы! Продолжайте собирать моменты мудрости.`;
    }

    return fullResponse;
  }

  /**
   * Получение рекомендации книги на основе анализа
   * @param {string} category - Категория цитаты
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<string|null>} Рекомендация
   */
  async getBookRecommendation(category, author) {
    const recommendations = {
      'Любовь': [
        'Кстати, если вас привлекает тема любви, у Анны есть разбор "Искусство любить" Эриха Фромма.',
        'По теме отношений рекомендую разбор "Искусство любить" - там о том, как строить осознанные отношения.'
      ],
      'Философия': [
        'Для любителей философии у Анны есть разбор "Письма к молодому поэту" Рильке.',
        'Если философские размышления близки, посмотрите разбор экзистенциальных тем у Анны.'
      ],
      'Саморазвитие': [
        'По саморазвитию рекомендую курс "Быть собой" от Анны - о самопринятии и аутентичности.',
        'Для личностного роста у Анны есть замечательные разборы психологической литературы.'
      ],
      'Материнство': [
        'Для мам у Анны есть специальные разборы о балансе между собой и семьей.',
        'По теме материнства рекомендую курс "Мудрая мама" - о сохранении себя в заботе о детях.'
      ],
      'Творчество': [
        'Для творческих натур подойдет разбор "Письма к молодому поэту" - о творчестве и самопознании.',
        'По творческому развитию у Анны есть интересные материалы.'
      ]
    };

    // Специальные рекомендации для классических авторов
    if (author && this.classicAuthors.some(classic => author.includes(classic))) {
      return 'У Анны есть замечательные разборы классической литературы, которые помогают глубже понять великих авторов.';
    }

    const categoryRecommendations = recommendations[category];
    if (categoryRecommendations) {
      return categoryRecommendations[Math.floor(Math.random() * categoryRecommendations.length)];
    }

    return null;
  }

  /**
   * Обновление статистики пользователя
   * @param {string} userId - ID пользователя
   * @param {string|null} author - Автор цитаты
   * @returns {Promise<void>}
   */
  async updateUserStatistics(userId, author) {
    try {
      const profile = await UserProfile.findOne({ userId });
      if (!profile) return;

      // Обновление общей статистики
      profile.statistics.totalQuotes += 1;

      // Обновление любимых авторов
      if (author && !profile.statistics.favoriteAuthors.includes(author)) {
        profile.statistics.favoriteAuthors.push(author);
        // Оставляем только последних 10 авторов
        if (profile.statistics.favoriteAuthors.length > 10) {
          profile.statistics.favoriteAuthors = profile.statistics.favoriteAuthors.slice(-10);
        }
      }

      // Обновление серии дней подряд
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Проверяем, была ли цитата вчера
      const yesterdayQuote = await Quote.findOne({
        userId,
        createdAt: { $gte: yesterday, $lt: today }
      });
      
      if (yesterdayQuote) {
        // Продолжение серии
        profile.statistics.currentStreak += 1;
        if (profile.statistics.currentStreak > profile.statistics.longestStreak) {
          profile.statistics.longestStreak = profile.statistics.currentStreak;
        }
      } else {
        // Начало новой серии или первая цитата
        profile.statistics.currentStreak = 1;
        if (profile.statistics.longestStreak === 0) {
          profile.statistics.longestStreak = 1;
        }
      }

      // Обновление месячной статистики
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      const monthlyIndex = profile.statistics.monthlyQuotes.findIndex(
        m => m.month === currentMonth && m.year === currentYear
      );
      
      if (monthlyIndex >= 0) {
        profile.statistics.monthlyQuotes[monthlyIndex].count += 1;
      } else {
        profile.statistics.monthlyQuotes.push({
          month: currentMonth,
          year: currentYear,
          count: 1
        });
      }

      await profile.save();
      
    } catch (error) {
      logger.error(`📖 Error updating user statistics: ${error.message}`);
    }
  }

  /**
   * Проверка достижений пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array<Achievement>>} Новые достижения
   */
  async checkAchievements(userId) {
    try {
      const profile = await UserProfile.findOne({ userId });
      if (!profile) return [];

      const newAchievements = [];

      for (const achievement of this.achievements) {
        // Проверяем, есть ли уже это достижение
        if (profile.achievements.some(a => a.achievementId === achievement.id)) {
          continue;
        }

        let unlocked = false;

        switch (achievement.type) {
          case 'quotes_count':
            unlocked = profile.statistics.totalQuotes >= achievement.targetValue;
            break;
            
          case 'streak_days':
            unlocked = profile.statistics.currentStreak >= achievement.targetValue;
            break;
            
          case 'classics_count':
            const classicsCount = await Quote.countDocuments({
              userId,
              author: { $in: this.classicAuthors }
            });
            unlocked = classicsCount >= achievement.targetValue;
            break;
            
          case 'category_count':
            if (achievement.category) {
              const categoryCount = await Quote.countDocuments({
                userId,
                category: achievement.category
              });
              unlocked = categoryCount >= achievement.targetValue;
            }
            break;
        }

        if (unlocked) {
          profile.achievements.push({
            achievementId: achievement.id,
            unlockedAt: new Date()
          });
          newAchievements.push(achievement);
        }
      }

      if (newAchievements.length > 0) {
        await profile.save();
      }

      return newAchievements;
      
    } catch (error) {
      logger.error(`📖 Error checking achievements: ${error.message}`);
      return [];
    }
  }

  /**
   * Уведомление о новых достижениях
   * @param {Object} ctx - Telegram context
   * @param {Array<Achievement>} achievements - Новые достижения
   * @returns {Promise<void>}
   */
  async notifyAchievements(ctx, achievements) {
    for (const achievement of achievements) {
      const message = `🎉 *Поздравляю!*\n\nВы получили достижение:\n${achievement.icon} *${achievement.name}*\n${achievement.description}\n\nПродолжайте собирать моменты вдохновения! 📖`;

      try {
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
        // Небольшая задержка между уведомлениями
        if (achievements.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        logger.error(`📖 Error sending achievement notification: ${error.message}`);
      }
    }
  }

  /**
   * Получить номер недели ISO 8601
   * @returns {number} Номер недели
   */
  getWeekNumber() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Получить статистику обработчика цитат
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      totalAchievements: this.achievements.length,
      classicAuthorsCount: this.classicAuthors.length,
      supportedCategories: [
        'Саморазвитие', 'Любовь', 'Философия', 'Мотивация', 
        'Мудрость', 'Творчество', 'Отношения', 'Материнство', 
        'Карьера', 'Другое'
      ],
      features: {
        aiAnalysis: true,
        achievementSystem: true,
        bookRecommendations: true,
        statisticsTracking: true,
        quoteParsing: true
      }
    };
  }
}

module.exports = { QuoteHandler };