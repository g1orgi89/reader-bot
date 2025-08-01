/**
 * @fileoverview Модель контента для бота "Читатель" (промпты, шаблоны, сообщения)
 * @author g1orgi89
 */

const mongoose = require('mongoose');

// Константы для типов контента и языков
const CONTENT_TYPES = {
  MESSAGE: 'message',
  PROMPT: 'prompt', 
  TEMPLATE: 'template',
  EMAIL_TEMPLATE: 'email_template'
};

const SUPPORTED_LANGUAGES = {
  RUSSIAN: 'ru',
  ENGLISH: 'en'
};

/**
 * @typedef {import('../types/reader').ContentItem} ContentItem
 */

/**
 * Схема метаданных контента
 */
const metadataSchema = new mongoose.Schema({
  title: {
    type: String,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 500
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  category: {
    type: String,
    maxlength: 100
  },
  version: {
    type: String,
    default: '1.0'
  },
  author: {
    type: String,
    maxlength: 100
  },
  lastTestResult: {
    success: Boolean,
    testedAt: Date,
    errorMessage: String
  }
}, { _id: false });

/**
 * Основная схема контента
 */
const contentSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    index: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  language: {
    type: String,
    enum: Object.values(SUPPORTED_LANGUAGES),
    default: SUPPORTED_LANGUAGES.RUSSIAN,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(CONTENT_TYPES),
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    type: metadataSchema,
    default: () => ({})
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  // История изменений
  changeHistory: [{
    oldContent: String,
    newContent: String,
    changedBy: String,
    changedAt: Date,
    changeReason: String
  }],
  // A/B тестирование
  abTestData: {
    isTestActive: {
      type: Boolean,
      default: false
    },
    testGroup: {
      type: String,
      enum: ['A', 'B']
    },
    alternativeContent: {
      type: String
    },
    testStartDate: Date,
    testEndDate: Date,
    testResults: {
      groupAEngagement: Number,
      groupBEngagement: Number,
      winningGroup: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Составные индексы для оптимизации
contentSchema.index({ key: 1, language: 1 }, { unique: true });
contentSchema.index({ type: 1, language: 1, isActive: 1 });
contentSchema.index({ 'metadata.category': 1, type: 1 });
contentSchema.index({ createdAt: -1 });

// Виртуальные поля
contentSchema.virtual('hasAlternative').get(function() {
  return this.abTestData.isTestActive && !!this.abTestData.alternativeContent;
});

contentSchema.virtual('wordCount').get(function() {
  return this.content.split(/\s+/).length;
});

contentSchema.virtual('isRecent').get(function() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return this.createdAt > weekAgo;
});

// Методы экземпляра
contentSchema.methods = {
  /**
   * Обновить контент с сохранением истории
   * @param {string} newContent - Новый контент
   * @param {string} changedBy - Кто изменил
   * @param {string} [changeReason] - Причина изменения
   * @returns {Promise<ContentItem>}
   */
  async updateContent(newContent, changedBy, changeReason = '') {
    // Сохраняем в историю
    this.changeHistory.push({
      oldContent: this.content,
      newContent: newContent,
      changedBy,
      changedAt: new Date(),
      changeReason
    });
    
    // Обновляем контент
    this.content = newContent;
    
    // Обновляем версию
    const currentVersion = parseFloat(this.metadata.version || '1.0');
    this.metadata.version = (currentVersion + 0.1).toFixed(1);
    
    return this.save();
  },

  /**
   * Активировать A/B тест
   * @param {string} alternativeContent - Альтернативная версия
   * @param {Date} [endDate] - Дата окончания теста
   * @returns {Promise<ContentItem>}
   */
  async startABTest(alternativeContent, endDate = null) {
    this.abTestData.isTestActive = true;
    this.abTestData.alternativeContent = alternativeContent;
    this.abTestData.testStartDate = new Date();
    
    if (endDate) {
      this.abTestData.testEndDate = endDate;
    } else {
      // По умолчанию тест на 2 недели
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 14);
      this.abTestData.testEndDate = defaultEndDate;
    }
    
    return this.save();
  },

  /**
   * Завершить A/B тест
   * @param {string} winningGroup - Выигрышная группа ('A' или 'B')
   * @returns {Promise<ContentItem>}
   */
  async endABTest(winningGroup) {
    this.abTestData.isTestActive = false;
    this.abTestData.testResults.winningGroup = winningGroup;
    
    // Если выиграла группа B, заменяем основной контент
    if (winningGroup === 'B' && this.abTestData.alternativeContent) {
      await this.updateContent(
        this.abTestData.alternativeContent,
        'system',
        `A/B тест завершен. Группа ${winningGroup} показала лучшие результаты.`
      );
    }
    
    // Очищаем данные теста
    this.abTestData.alternativeContent = undefined;
    
    return this.save();
  },

  /**
   * Получить активную версию контента (с учетом A/B теста)
   * @param {string} [userId] - ID пользователя для A/B теста
   * @returns {string}
   */
  getActiveContent(userId = null) {
    if (!this.abTestData.isTestActive || !this.abTestData.alternativeContent) {
      return this.content;
    }
    
    // Простое распределение по группам на основе ID пользователя
    if (userId) {
      const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const group = hash % 2 === 0 ? 'A' : 'B';
      
      return group === 'A' ? this.content : this.abTestData.alternativeContent;
    }
    
    // Если нет ID пользователя, возвращаем основную версию
    return this.content;
  },

  /**
   * Отметить результат тестирования
   * @param {boolean} success - Успешно ли прошло тестирование
   * @param {string} [errorMessage] - Сообщение об ошибке
   * @returns {Promise<ContentItem>}
   */
  async markTestResult(success, errorMessage = null) {
    this.metadata.lastTestResult = {
      success,
      testedAt: new Date(),
      errorMessage
    };
    
    return this.save();
  },

  /**
   * Клонировать контент для другого языка
   * @param {string} newLanguage - Новый язык
   * @param {string} newKey - Новый ключ
   * @param {string} translatedContent - Переведенный контент
   * @returns {Promise<ContentItem>}
   */
  async cloneForLanguage(newLanguage, newKey, translatedContent) {
    const Content = this.constructor;
    
    const clone = new Content({
      key: newKey,
      content: translatedContent,
      language: newLanguage,
      type: this.type,
      isActive: this.isActive,
      metadata: {
        ...this.metadata.toObject(),
        title: `${this.metadata.title} (${newLanguage})`,
        version: '1.0'
      },
      createdBy: 'translation_system'
    });
    
    return clone.save();
  }
};

// Статические методы
contentSchema.statics = {
  /**
   * Получить контент по ключу и языку
   * @param {string} key - Ключ контента
   * @param {string} [language='ru'] - Язык
   * @param {string} [userId] - ID пользователя для A/B теста
   * @returns {Promise<string|null>}
   */
  async getContent(key, language = SUPPORTED_LANGUAGES.RUSSIAN, userId = null) {
    const content = await this.findOne({
      key,
      language,
      isActive: true
    });
    
    if (!content) {
      // Пытаемся найти на русском языке как запасной вариант
      if (language !== SUPPORTED_LANGUAGES.RUSSIAN) {
        const fallbackContent = await this.findOne({
          key,
          language: SUPPORTED_LANGUAGES.RUSSIAN,
          isActive: true
        });
        
        if (fallbackContent) {
          return fallbackContent.getActiveContent(userId);
        }
      }
      
      return null;
    }
    
    return content.getActiveContent(userId);
  },

  /**
   * Получить все контенты определенного типа
   * @param {string} type - Тип контента
   * @param {string} [language='ru'] - Язык
   * @param {boolean} [activeOnly=true] - Только активные
   * @returns {Promise<ContentItem[]>}
   */
  async getByType(type, language = SUPPORTED_LANGUAGES.RUSSIAN, activeOnly = true) {
    const query = { type, language };
    if (activeOnly) query.isActive = true;
    
    return this.find(query).sort({ 'metadata.title': 1, createdAt: -1 });
  },

  /**
   * Поиск контента по тексту
   * @param {string} searchText - Текст для поиска
   * @param {string} [language='ru'] - Язык
   * @param {number} [limit=20] - Количество результатов
   * @returns {Promise<ContentItem[]>}
   */
  async search(searchText, language = SUPPORTED_LANGUAGES.RUSSIAN, limit = 20) {
    return this.find({
      language,
      isActive: true,
      $or: [
        { key: { $regex: searchText, $options: 'i' } },
        { content: { $regex: searchText, $options: 'i' } },
        { 'metadata.title': { $regex: searchText, $options: 'i' } },
        { 'metadata.description': { $regex: searchText, $options: 'i' } },
        { 'metadata.tags': { $in: [new RegExp(searchText, 'i')] } }
      ]
    })
    .sort({ 'metadata.title': 1 })
    .limit(limit);
  },

  /**
   * Создать базовый контент для "Читателя"
   * @returns {Promise<void>}
   */
  async createDefaultContent() {
    const defaultContents = [
      // Приветственные сообщения
      {
        key: 'welcome_message',
        type: CONTENT_TYPES.MESSAGE,
        content: `👋 Здравствуйте!\n\nВы попали в «Читатель» - ваш личный проводник в мире слов и цитат.\n\nМеня зовут Анна Бусел, я психолог и основатель «Книжного клуба». \n\nЗдесь мы превратим ваши случайные цитаты в персональный дневник роста.\n\n📝 Сначала пройдём короткий тест (2 минуты) - он поможет мне понять, какие книги будут откликаться именно вам.`,
        metadata: {
          title: 'Приветственное сообщение',
          description: 'Первое сообщение при запуске бота',
          category: 'onboarding'
        }
      },
      
      // Промпты для Claude
      {
        key: 'quote_analysis_prompt',
        type: CONTENT_TYPES.PROMPT,
        content: `Ты - помощник Анны Бусел, психолога и основателя "Книжного клуба". Анализируй цитату пользователя:\n\n1. Определи основную категорию (любовь, саморазвитие, философия, психология, духовность, отношения, мудрость, вдохновение, жизнь, счастье, успех, творчество, здоровье, работа, семья, дружба, время, деньги, образование, путешествия, искусство, природа, свобода, мир, надежда, вера, смелость, страх, изменения, цели)\n\n2. Дай краткий теплый отклик на цитату (1-2 предложения)\n\n3. Укажи количество цитат на этой неделе\n\n4. Если уместно, предложи разбор книги от Анны\n\nСтиль: сдержанный, минимум эмодзи, обращение на "Вы". Упоминай имя Анны в рекомендациях.\n\nЦитата: {quote}\nАвтор: {author}\nКоличество цитат на неделе: {weeklyCount}`,
        metadata: {
          title: 'Анализ цитат',
          description: 'Промпт для анализа цитат пользователей',
          category: 'ai_prompts'
        }
      }
    ];

    // Создаем контент, если его еще нет
    for (const contentData of defaultContents) {
      const existing = await this.findOne({ 
        key: contentData.key, 
        language: SUPPORTED_LANGUAGES.RUSSIAN 
      });
      
      if (!existing) {
        await this.create({
          ...contentData,
          language: SUPPORTED_LANGUAGES.RUSSIAN,
          createdBy: 'system_init'
        });
      }
    }
  },

  /**
   * Получить статистику контента
   * @returns {Promise<Object>}
   */
  async getContentStats() {
    const pipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          languages: { $addToSet: '$language' }
        }
      },
      { $sort: { count: -1 } }
    ];

    const typeStats = await this.aggregate(pipeline);

    const totalStats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          activeContent: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }
        }
      }
    ]);

    return {
      byType: typeStats,
      total: totalStats[0] || { totalContent: 0, activeContent: 0 }
    };
  }
};

// Middleware
contentSchema.pre('save', function(next) {
  // Автоматически генерируем title если не указан
  if (this.isNew && !this.metadata.title) {
    this.metadata.title = this.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  next();
});

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;