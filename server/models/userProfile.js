/**
 * @fileoverview Модель профиля пользователя для бота "Читатель" - исправленная версия
 * @author g1orgi89
 */

const mongoose = require('mongoose');

/**
 * @typedef {import('../types/reader').UserProfile} UserProfile
 * @typedef {import('../types/reader').TestResults} TestResults
 * @typedef {import('../types/reader').UserStatistics} UserStatistics
 * @typedef {import('../types/reader').UserSettings} UserSettings
 */

/**
 * Схема результатов теста из 7 вопросов
 */
const testResultsSchema = new mongoose.Schema({
  question1_name: {
    type: String
    // Как вас зовут?
  },
  question2_lifestyle: {
    type: String
    // О себе (мама/замужем/свободна)
  },
  question3_time: {
    type: String
    // Как находите время для себя?
  },
  question4_priorities: {
    type: String
    // Что сейчас важнее всего?
  },
  question5_reading_feeling: {
    type: String
    // Что чувствуете, читая книги?
  },
  question6_phrase: {
    type: String
    // Какая фраза ближе?
  },
  question7_reading_time: {
    type: String
    // Сколько времени читаете в неделю?
  },
  completedAt: {
    type: Date
    // Дата завершения теста
  }
}, { _id: false });

/**
 * Схема для статистики по месяцам
 */
const monthlyStatsSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  count: {
    type: Number,
    default: 0
  }
}, { _id: false });

/**
 * Схема статистики пользователя
 */
const statisticsSchema = new mongoose.Schema({
  totalQuotes: {
    type: Number,
    default: 0
    // Общее количество цитат
  },
  currentStreak: {
    type: Number,
    default: 0
    // Текущая серия дней подряд
  },
  longestStreak: {
    type: Number,
    default: 0
    // Самая длинная серия
  },
  favoriteAuthors: [{
    type: String
    // Список любимых авторов
  }],
  monthlyQuotes: [monthlyStatsSchema]
}, { _id: false });

/**
 * Схема достижений пользователя
 */
const achievementSchema = new mongoose.Schema({
  achievementId: {
    type: String,
    required: true
    // ID достижения
  },
  unlockedAt: {
    type: Date,
    required: true
    // Дата получения достижения
  }
}, { _id: false });

/**
 * Схема настроек пользователя
 */
const settingsSchema = new mongoose.Schema({
  reminderEnabled: {
    type: Boolean,
    default: true
    // Включены ли напоминания
  },
  reminderTimes: [{
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    // Время напоминаний в формате HH:MM
  }],
  language: {
    type: String,
    default: 'ru',
    enum: ['ru', 'en']
    // Язык интерфейса
  }
}, { _id: false });

/**
 * Схема AI-анализа предпочтений
 */
const preferencesSchema = new mongoose.Schema({
  mainThemes: [{
    type: String
    // AI-анализ интересов
  }],
  personalityType: {
    type: String
    // Тип личности по тесту
  },
  recommendationStyle: {
    type: String
    // Стиль рекомендаций
  }
}, { _id: false });

/**
 * Основная схема профиля пользователя для бота "Читатель"
 */
const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // ID пользователя Telegram
  },
  telegramUsername: {
    type: String
    // @username (авто-определение)
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
    // Имя из вопроса 1 теста
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Email ОБЯЗАТЕЛЬНО после теста
  },
  avatarUrl: {
    type: String,
    default: null
    // URL загруженного аватара пользователя
  },
  testResults: {
    type: testResultsSchema,
    required: true
    // Ответы на 7 вопросов
  },
  source: {
    type: String,
    required: true,
    enum: ['Instagram', 'Telegram', 'YouTube', 'Threads', 'Друзья', 'Другое']
    // Откуда узнал о боте
  },
  preferences: {
    type: preferencesSchema,
    default: () => ({})
    // AI-анализ теста
  },
  statistics: {
    type: statisticsSchema,
    default: () => ({})
    // Статистика пользователя
  },
  achievements: [achievementSchema],
  settings: {
    type: settingsSchema,
    default: () => ({})
    // Настройки пользователя
  },
  registeredAt: {
    type: Date,
    default: Date.now
    // Дата регистрации
  },
  isOnboardingComplete: {
    type: Boolean,
    default: false
    // Завершен ли онбординг
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
    // Последняя активность
  },

  // Техническая информация
  telegramData: {
    firstName: String,
    lastName: String,
    languageCode: String,
    chatId: String
    // Данные из Telegram
  },

  // Состояние бота для онбординга
  botState: {
    currentState: {
      type: String,
      default: 'start'
      // Текущее состояние бота
    },
    stateData: {
      type: mongoose.Schema.Types.Mixed
      // Данные состояния (временные ответы на тест)
    },
    stateUpdatedAt: {
      type: Date,
      default: Date.now
    }
  },

  // Флаги
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для оптимизации
userProfileSchema.index({ userId: 1 }, { unique: true });
userProfileSchema.index({ email: 1 });
userProfileSchema.index({ source: 1, registeredAt: -1 });
userProfileSchema.index({ lastActiveAt: -1 });
userProfileSchema.index({ isOnboardingComplete: 1 });
userProfileSchema.index({ registeredAt: -1 });
userProfileSchema.index({ 'settings.reminderEnabled': 1 });

// Виртуальные поля
userProfileSchema.virtual('daysSinceRegistration').get(function() {
  return Math.floor((new Date() - this.registeredAt) / (1000 * 60 * 60 * 24));
});

userProfileSchema.virtual('weeksSinceRegistration').get(function() {
  return Math.floor(this.daysSinceRegistration / 7);
});

userProfileSchema.virtual('isNewUser').get(function() {
  return this.daysSinceRegistration <= 7;
});

userProfileSchema.virtual('hasCompletedTest').get(function() {
  return this.testResults && this.testResults.completedAt;
});

// Методы экземпляра
userProfileSchema.methods = {
  /**
   * Обновить последнюю активность
   * @returns {Promise<UserProfile>}
   */
  async updateLastActive() {
    this.lastActiveAt = new Date();
    return this.save();
  },

  /**
   * Добавить ответ на вопрос теста
   * @param {number} questionNumber - Номер вопроса (1-7)
   * @param {string} answer - Ответ пользователя
   * @returns {Promise<UserProfile>}
   */
  async addTestAnswer(questionNumber, answer) {
    const questionFields = [
      '', // индекс 0 не используется
      'question1_name',
      'question2_lifestyle', 
      'question3_time',
      'question4_priorities',
      'question5_reading_feeling',
      'question6_phrase',
      'question7_reading_time'
    ];

    if (questionNumber >= 1 && questionNumber <= 7) {
      this.testResults[questionFields[questionNumber]] = answer;
      
      // Если это последний вопрос, завершаем тест
      if (questionNumber === 7) {
        this.testResults.completedAt = new Date();
      }
    }

    return this.save();
  },

  /**
   * Завершить онбординг
   * @returns {Promise<UserProfile>}
   */
  async completeOnboarding() {
    this.isOnboardingComplete = true;
    this.botState.currentState = 'active';
    this.botState.stateData = null;
    
    // Инициализируем дефолтные настройки
    if (!this.settings.reminderTimes.length) {
      this.settings.reminderTimes = ['09:00', '19:00'];
    }
    
    return this.save();
  },

  /**
   * Обновить состояние бота
   * @param {string} newState - Новое состояние
   * @param {Object} [stateData] - Данные состояния
   * @returns {Promise<UserProfile>}
   */
  async updateBotState(newState, stateData = null) {
    this.botState.currentState = newState;
    this.botState.stateData = stateData;
    this.botState.stateUpdatedAt = new Date();
    return this.save();
  },

  /**
   * Обновить статистику цитат
   * @param {string} [author] - Автор цитаты
   * @returns {Promise<UserProfile>}
   */
  async updateQuoteStats(author = null) {
    // --- PATCH: Ensure statistics is always initialized ---
    if (!this.statistics || typeof this.statistics !== 'object') {
      this.statistics = {
        totalQuotes: 0,
        currentStreak: 0,
        longestStreak: 0,
        favoriteAuthors: [],
        monthlyQuotes: []
      };
    }
    if (!Array.isArray(this.statistics.favoriteAuthors)) {
      this.statistics.favoriteAuthors = [];
    }
    if (!Array.isArray(this.statistics.monthlyQuotes)) {
      this.statistics.monthlyQuotes = [];
    }
    if (typeof this.statistics.totalQuotes !== 'number') {
      this.statistics.totalQuotes = 0;
    }
    
    // Обновляем любимых авторов
    if (author && !this.statistics.favoriteAuthors.includes(author)) {
      this.statistics.favoriteAuthors.push(author);
      // Ограничиваем до 10 авторов
      if (this.statistics.favoriteAuthors.length > 10) {
        this.statistics.favoriteAuthors = this.statistics.favoriteAuthors.slice(-10);
      }
    }
    
    // Обновляем статистику по месяцам
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let monthStat = this.statistics.monthlyQuotes.find(
      m => m.month === currentMonth && m.year === currentYear
    );
    
    if (!monthStat) {
      monthStat = { month: currentMonth, year: currentYear, count: 0 };
      this.statistics.monthlyQuotes.push(monthStat);
    }
    
    monthStat.count += 1;
    
    // Обновляем серию дней
    this._updateStreak();
    
    return this.save();
  },

  /**
   * Обновить серию дней (приватный метод)
   * @private
   */
  _updateStreak() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActive = new Date(this.lastActiveAt);
    lastActive.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastActive.getTime() === today.getTime()) {
      // Уже была активность сегодня - не меняем серию
      return;
    } else if (lastActive.getTime() === yesterday.getTime()) {
      // Была активность вчера - продолжаем серию
      this.statistics.currentStreak += 1;
    } else {
      // Пропуск дней - начинаем новую серию
      this.statistics.currentStreak = 1;
    }
    
    // Обновляем максимальную серию
    if (this.statistics.currentStreak > this.statistics.longestStreak) {
      this.statistics.longestStreak = this.statistics.currentStreak;
    }
  },

  /**
   * Добавить достижение
   * @param {string} achievementId - ID достижения
   * @returns {Promise<UserProfile>}
   */
  async addAchievement(achievementId) {
    // Проверяем, нет ли уже такого достижения
    const hasAchievement = this.achievements.some(a => a.achievementId === achievementId);
    
    if (!hasAchievement) {
      this.achievements.push({
        achievementId,
        unlockedAt: new Date()
      });
      await this.save();
    }
    
    return this;
  },

  /**
   * Сбросить результаты теста (для перезапуска)
   * Обнуляет только testResults, сохраняет пользователя и статистику
   * @returns {Promise<UserProfile>}
   */
  async resetTestResults() {
    // Очищаем все поля testResults
    this.testResults = {
      question1_name: null,
      question2_lifestyle: null,
      question3_time: null,
      question4_priorities: null,
      question5_reading_feeling: null,
      question6_phrase: null,
      question7_reading_time: null,
      completedAt: null
    };
    
    // Сбрасываем статус завершения онбординга
    this.isOnboardingComplete = false;
    
    // Обновляем состояние бота на начальное
    this.botState.currentState = 'start';
    this.botState.stateData = null;
    this.botState.stateUpdatedAt = new Date();
    
    return this.save();
  },

  /**
   * Получить краткую информацию о пользователе
   * @returns {Object}
   */
  toSummary() {
    return {
      userId: this.userId,
      name: this.name,
      email: this.email,
      hasCompletedTest: this.hasCompletedTest,
      isOnboardingComplete: this.isOnboardingComplete,
      daysSinceRegistration: this.daysSinceRegistration,
      totalQuotes: this.statistics.totalQuotes,
      currentStreak: this.statistics.currentStreak,
      source: this.source,
      isActive: this.isActive
    };
  }
};

// Статические методы
userProfileSchema.statics = {
  /**
   * Найти или создать профиль пользователя - ИСПРАВЛЕНО
   * 🚨 ИСПРАВЛЕНА ПРОБЛЕМА: Race condition при одновременных запросах
   * Используем атомарную операцию findOneAndUpdate с upsert для безопасности
   * @param {string} userId - ID пользователя
   * @param {Object} userData - Данные пользователя
   * @returns {Promise<UserProfile>}
   */
  async findOrCreate(userId, userData = {}) {
    try {
      // ИСПРАВЛЕНО: Используем атомарную операцию findOneAndUpdate с upsert
      // Это предотвращает race conditions при одновременном создании пользователей
      const user = await this.findOneAndUpdate(
        { userId }, // фильтр для поиска
        { 
          $setOnInsert: {
            userId,
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          $set: {
            updatedAt: new Date()
          }
        },
        { 
          upsert: true, // создать если не существует
          new: true,    // вернуть обновленный документ
          runValidators: true // проверить валидацию схемы
        }
      );
      
      return user;
    } catch (error) {
      // ИСПРАВЛЕНО: Обрабатываем ошибки дубликатов (E11000)
      if (error.code === 11000) {
        console.warn(`⚠️ Попытка создания дубликата пользователя ${userId}, возвращаем существующего`);
        // Если возникла ошибка дубликата, просто найдем существующего пользователя
        return await this.findOne({ userId });
      }
      // Перебрасываем другие ошибки
      throw error;
    }
  },

  /**
   * Получить пользователей для напоминаний
   * @returns {Promise<UserProfile[]>}
   */
  async getUsersForReminders() {
    return this.find({
      'settings.reminderEnabled': true,
      isActive: true,
      isBlocked: false,
      isOnboardingComplete: true
    });
  },

  /**
   * Получить пользователей для еженедельных отчетов
   * @returns {Promise<UserProfile[]>}
   */
  async getUsersForWeeklyReports() {
    return this.find({
      isOnboardingComplete: true,
      email: { $exists: true, $ne: null },
      isActive: true,
      isBlocked: false
    });
  },

  /**
   * Получить статистику по источникам
   * @param {Date} [startDate] - Начальная дата
   * @returns {Promise<Array>}
   */
  async getSourceStats(startDate = null) {
    const match = startDate ? { registeredAt: { $gte: startDate } } : {};
    
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  },

  /**
   * Получить статистику активности
   * @param {string} period - Период ('7d', '30d', '90d')
   * @returns {Promise<Object>}
   */
  async getActivityStats(period = '7d') {
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      this.countDocuments({ isOnboardingComplete: true }),
      this.countDocuments({ 
        registeredAt: { $gte: startDate },
        isOnboardingComplete: true 
      }),
      this.countDocuments({ 
        lastActiveAt: { $gte: startDate },
        isActive: true 
      })
    ]);
    
    return {
      totalUsers,
      newUsers,
      activeUsers,
      period
    };
  }
};

// Middleware перед сохранением
userProfileSchema.pre('save', function(next) {
  // Обновляем lastActiveAt при любом изменении
  if (this.isModified() && !this.isModified('lastActiveAt')) {
    this.lastActiveAt = new Date();
  }
  
  next();
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = UserProfile;
