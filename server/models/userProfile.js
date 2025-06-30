/**
 * @fileoverview Модель профиля пользователя для бота "Читатель"
 * @author g1orgi89
 */

const mongoose = require('mongoose');
const { USER_SOURCES, REMINDER_FREQUENCIES, SUPPORTED_LANGUAGES } = require('../types');

/**
 * @typedef {import('../types/reader').UserProfile} UserProfile
 * @typedef {import('../types/reader').TestAnswer} TestAnswer
 */

/**
 * Схема ответа на вопрос теста
 */
const testAnswerSchema = new mongoose.Schema({
  questionNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  selectedOption: {
    type: String,
    description: 'Выбранная опция для вопросов с вариантами'
  }
}, { _id: false });

/**
 * Схема результатов теста
 */
const testResultsSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  answers: [testAnswerSchema],
  personality: {
    type: String,
    description: 'Определенный тип личности на основе ответов'
  },
  completedAt: {
    type: Date,
    description: 'Дата завершения теста'
  },
  currentQuestion: {
    type: Number,
    min: 1,
    max: 7,
    description: 'Текущий вопрос (для состояния in_progress)'
  }
}, { _id: false });

/**
 * Схема настроек пользователя
 */
const preferencesSchema = new mongoose.Schema({
  remindersEnabled: {
    type: Boolean,
    default: true,
    description: 'Включены ли напоминания'
  },
  reminderTimes: [{
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    description: 'Время напоминаний в формате HH:MM'
  }],
  reminderFrequency: {
    type: String,
    enum: Object.values(REMINDER_FREQUENCIES),
    default: REMINDER_FREQUENCIES.DAILY,
    description: 'Частота напоминаний'
  },
  language: {
    type: String,
    enum: Object.values(SUPPORTED_LANGUAGES),
    default: SUPPORTED_LANGUAGES.RUSSIAN,
    description: 'Язык интерфейса'
  },
  timezone: {
    type: String,
    default: 'Europe/Moscow',
    description: 'Часовой пояс пользователя'
  },
  emailReportsEnabled: {
    type: Boolean,
    default: true,
    description: 'Включены ли email отчеты'
  },
  weeklyReportDay: {
    type: Number,
    min: 0,
    max: 6,
    default: 0,
    description: 'День недели для еженедельного отчета (0 = воскресенье)'
  },
  weeklyReportTime: {
    type: String,
    default: '11:00',
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    description: 'Время еженедельного отчета'
  }
}, { _id: false });

/**
 * Схема статистики пользователя
 */
const statisticsSchema = new mongoose.Schema({
  totalQuotes: {
    type: Number,
    default: 0,
    description: 'Общее количество цитат'
  },
  currentStreak: {
    type: Number,
    default: 0,
    description: 'Текущая серия дней подряд'
  },
  longestStreak: {
    type: Number,
    default: 0,
    description: 'Самая длинная серия'
  },
  lastActiveDate: {
    type: Date,
    description: 'Последняя дата активности'
  },
  favoriteAuthors: [{
    author: String,
    count: Number
  }],
  categoriesCount: {
    type: Map,
    of: Number,
    default: new Map(),
    description: 'Количество цитат по категориям'
  },
  weeklyQuotesAverage: {
    type: Number,
    default: 0,
    description: 'Среднее количество цитат в неделю'
  },
  totalWeeksActive: {
    type: Number,
    default: 0,
    description: 'Общее количество активных недель'
  }
}, { _id: false });

/**
 * Основная схема профиля пользователя
 */
const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'ID пользователя Telegram'
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
    description: 'Имя пользователя'
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    description: 'Email адрес для отчетов'
  },
  telegramUsername: {
    type: String,
    lowercase: true,
    trim: true,
    description: 'Username в Telegram'
  },
  testResults: {
    type: testResultsSchema,
    default: () => ({ status: 'not_started' }),
    description: 'Результаты вступительного теста'
  },
  preferences: {
    type: preferencesSchema,
    default: () => ({}),
    description: 'Настройки пользователя'
  },
  source: {
    type: String,
    enum: Object.values(USER_SOURCES),
    required: true,
    description: 'Откуда узнал о боте'
  },
  registeredAt: {
    type: Date,
    default: Date.now,
    description: 'Дата регистрации'
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    description: 'Последняя активность'
  },
  statistics: {
    type: statisticsSchema,
    default: () => ({}),
    description: 'Статистика пользователя'
  },
  // Техническая информация
  telegramData: {
    firstName: String,
    lastName: String,
    languageCode: String,
    chatId: String,
    description: 'Данные из Telegram'
  },
  // Состояние бота для этого пользователя
  botState: {
    currentState: {
      type: String,
      default: 'start',
      description: 'Текущее состояние бота'
    },
    stateData: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Данные состояния'
    },
    stateUpdatedAt: {
      type: Date,
      default: Date.now,
      description: 'Время обновления состояния'
    }
  },
  // Флаги
  isActive: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Активен ли пользователь'
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Заблокирован ли пользователь'
  },
  emailVerified: {
    type: Boolean,
    default: false,
    description: 'Подтвержден ли email'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы для оптимизации запросов
userProfileSchema.index({ userId: 1 }, { unique: true });
userProfileSchema.index({ email: 1 }, { sparse: true });
userProfileSchema.index({ source: 1, registeredAt: -1 });
userProfileSchema.index({ lastActiveAt: -1 });
userProfileSchema.index({ isActive: 1, isBlocked: 1 });
userProfileSchema.index({ 'testResults.status': 1 });
userProfileSchema.index({ registeredAt: -1 });

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

userProfileSchema.virtual('isTestCompleted').get(function() {
  return this.testResults.status === 'completed';
});

userProfileSchema.virtual('hasEmail').get(function() {
  return !!this.email;
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
   * Начать тест
   * @returns {Promise<UserProfile>}
   */
  async startTest() {
    this.testResults.status = 'in_progress';
    this.testResults.currentQuestion = 1;
    this.testResults.answers = [];
    return this.save();
  },

  /**
   * Добавить ответ на вопрос теста
   * @param {number} questionNumber - Номер вопроса
   * @param {string} question - Текст вопроса
   * @param {string} answer - Ответ пользователя
   * @param {string} [selectedOption] - Выбранная опция
   * @returns {Promise<UserProfile>}
   */
  async addTestAnswer(questionNumber, question, answer, selectedOption = null) {
    // Удаляем предыдущий ответ на этот вопрос, если есть
    this.testResults.answers = this.testResults.answers.filter(
      a => a.questionNumber !== questionNumber
    );
    
    // Добавляем новый ответ
    this.testResults.answers.push({
      questionNumber,
      question,
      answer,
      selectedOption
    });
    
    // Обновляем текущий вопрос
    this.testResults.currentQuestion = questionNumber + 1;
    
    // Если это последний вопрос, завершаем тест
    if (questionNumber >= 7) {
      await this.completeTest();
    }
    
    return this.save();
  },

  /**
   * Завершить тест
   * @returns {Promise<UserProfile>}
   */
  async completeTest() {
    this.testResults.status = 'completed';
    this.testResults.completedAt = new Date();
    this.testResults.personality = this._analyzePersonality();
    delete this.testResults.currentQuestion;
    return this.save();
  },

  /**
   * Анализ личности на основе ответов
   * @private
   * @returns {string}
   */
  _analyzePersonality() {
    const answers = this.testResults.answers;
    
    // Простой алгоритм определения типа личности
    // На основе ответа на 6-й вопрос и других факторов
    const sixthAnswer = answers.find(a => a.questionNumber === 6);
    
    if (!sixthAnswer) return 'unknown';
    
    const option = sixthAnswer.selectedOption;
    
    if (option?.includes('понять себя')) return 'self_explorer';
    if (option?.includes('гармонии')) return 'harmony_seeker';
    if (option?.includes('практические решения')) return 'problem_solver';
    if (option?.includes('вдохновения')) return 'inspiration_seeker';
    
    return 'balanced';
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
   * @param {number} quotesCount - Количество цитат
   * @param {string} category - Категория цитаты
   * @returns {Promise<UserProfile>}
   */
  async updateQuoteStats(quotesCount = 1, category = null) {
    this.statistics.totalQuotes += quotesCount;
    
    if (category) {
      const currentCount = this.statistics.categoriesCount.get(category) || 0;
      this.statistics.categoriesCount.set(category, currentCount + quotesCount);
    }
    
    // Обновляем серию дней
    const today = new Date().toDateString();
    const lastActiveDay = this.statistics.lastActiveDate?.toDateString();
    
    if (lastActiveDay !== today) {
      if (lastActiveDay === new Date(Date.now() - 86400000).toDateString()) {
        // Вчера была активность - продолжаем серию
        this.statistics.currentStreak += 1;
      } else {
        // Пропуск - начинаем новую серию
        this.statistics.currentStreak = 1;
      }
      
      this.statistics.lastActiveDate = new Date();
      
      // Обновляем максимальную серию
      if (this.statistics.currentStreak > this.statistics.longestStreak) {
        this.statistics.longestStreak = this.statistics.currentStreak;
      }
    }
    
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
      hasEmail: this.hasEmail,
      isTestCompleted: this.isTestCompleted,
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
   * Найти или создать профиль пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} userData - Данные пользователя
   * @returns {Promise<UserProfile>}
   */
  async findOrCreate(userId, userData = {}) {
    let user = await this.findOne({ userId });
    
    if (!user) {
      user = new this({
        userId,
        ...userData
      });
      await user.save();
    }
    
    return user;
  },

  /**
   * Получить активных пользователей
   * @param {number} [daysBack=7] - Количество дней назад
   * @returns {Promise<UserProfile[]>}
   */
  async getActiveUsers(daysBack = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return this.find({
      lastActiveAt: { $gte: cutoffDate },
      isActive: true,
      isBlocked: false
    }).sort({ lastActiveAt: -1 });
  },

  /**
   * Получить пользователей для отправки напоминаний
   * @returns {Promise<UserProfile[]>}
   */
  async getUsersForReminders() {
    return this.find({
      'preferences.remindersEnabled': true,
      isActive: true,
      isBlocked: false,
      'testResults.status': 'completed'
    });
  },

  /**
   * Получить пользователей для еженедельных отчетов
   * @param {number} dayOfWeek - День недели (0 = воскресенье)
   * @returns {Promise<UserProfile[]>}
   */
  async getUsersForWeeklyReports(dayOfWeek) {
    return this.find({
      'preferences.emailReportsEnabled': true,
      'preferences.weeklyReportDay': dayOfWeek,
      email: { $exists: true, $ne: null },
      emailVerified: true,
      isActive: true,
      isBlocked: false,
      'testResults.status': 'completed'
    });
  },

  /**
   * Получить статистику по источникам
   * @returns {Promise<Object>}
   */
  async getSourcesStats() {
    const pipeline = [
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ];
    
    return this.aggregate(pipeline);
  },

  /**
   * Получить статистику регистраций по дням
   * @param {number} [daysBack=30] - Количество дней назад
   * @returns {Promise<Object>}
   */
  async getRegistrationStats(daysBack = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const pipeline = [
      {
        $match: {
          registeredAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$registeredAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    
    return this.aggregate(pipeline);
  }
};

// Middleware перед сохранением
userProfileSchema.pre('save', function(next) {
  // Устанавливаем дефолтные времена напоминаний
  if (this.isNew && !this.preferences.reminderTimes.length) {
    this.preferences.reminderTimes = ['09:00', '19:00'];
  }
  
  next();
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = UserProfile;