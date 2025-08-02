/**
 * 📱 МОДЕЛЬ ЛОГИРОВАНИЯ VIEWPORT для диагностики Mini App
 * 
 * Собирает данные о проблемах с viewport высотой в Telegram Mini App
 * Помогает диагностировать проблему с пустым местом снизу
 * 
 * @filesize ~2KB
 * @version 1.0.0
 */

const mongoose = require('mongoose');

/**
 * @typedef {Object} ViewportData
 * @property {number} innerHeight - window.innerHeight
 * @property {number} innerWidth - window.innerWidth  
 * @property {number} telegramHeight - Telegram.WebApp.viewportHeight
 * @property {number} telegramStableHeight - Telegram.WebApp.viewportStableHeight
 * @property {number} calculatedContentHeight - CSS calc() результат
 * @property {number} actualContentHeight - Реальная высота контента
 * @property {number} bottomNavHeight - Высота нижней навигации
 * @property {number} headerHeight - Высота header
 * @property {number} totalSubtracted - Общий вычет (bottomNav + header + padding)
 * @property {number} difference - Разница между ожидаемым и фактическим
 * @property {number} availableHeight - Доступная высота для контента
 * @property {Object} safeBounds - Safe area insets
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {string} userAgent - User Agent строка
 * @property {string} platform - Платформа (iOS/Android/Desktop)
 * @property {string} browser - Браузер/Telegram версия
 * @property {number} devicePixelRatio - Соотношение пикселей
 * @property {string} orientation - portrait/landscape
 * @property {Object} screen - Размеры экрана
 */

/**
 * Схема для логирования viewport проблем
 */
const viewportLogSchema = new mongoose.Schema({
  // 📱 Основная информация
  userId: {
    type: String,
    required: false, // В debug режиме может не быть
    index: true
  },
  
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // 🌐 Информация о странице
  page: {
    type: String,
    required: true,
    enum: ['home', 'diary', 'reports', 'catalog', 'community', 'onboarding', 'other']
  },
  
  url: {
    type: String,
    required: true
  },
  
  // 📐 Viewport данные
  viewport: {
    // Размеры окна
    innerHeight: { type: Number, required: true },
    innerWidth: { type: Number, required: true },
    
    // Telegram специфичные размеры
    telegramHeight: { type: Number, default: null },
    telegramStableHeight: { type: Number, default: null },
    telegramExpanded: { type: Boolean, default: null },
    
    // CSS расчеты
    calculatedContentHeight: { type: Number, required: true },
    actualContentHeight: { type: Number, required: true },
    
    // Компоненты интерфейса
    bottomNavHeight: { type: Number, required: true },
    headerHeight: { type: Number, required: true },
    totalSubtracted: { type: Number, required: true },
    
    // Анализ проблемы
    difference: { type: Number, required: true }, // Разница между ожидаемым и фактическим
    availableHeight: { type: Number, required: true },
    
    // Safe area (iOS)
    safeBounds: {
      top: { type: Number, default: 0 },
      bottom: { type: Number, default: 0 },
      left: { type: Number, default: 0 },
      right: { type: Number, default: 0 }
    }
  },
  
  // 📱 Информация об устройстве
  device: {
    userAgent: { type: String, required: true },
    platform: { 
      type: String, 
      enum: ['iOS', 'Android', 'Desktop', 'Unknown'],
      required: true 
    },
    browser: { type: String, required: true },
    devicePixelRatio: { type: Number, default: 1 },
    orientation: { 
      type: String, 
      enum: ['portrait', 'landscape'],
      required: true 
    },
    screen: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      availWidth: { type: Number, required: true },
      availHeight: { type: Number, required: true }
    }
  },
  
  // 🎯 Telegram контекст
  telegram: {
    isAvailable: { type: Boolean, required: true },
    version: { type: String, default: null },
    platform: { type: String, default: null },
    colorScheme: { type: String, enum: ['light', 'dark'], default: null },
    isVerticalSwipesEnabled: { type: Boolean, default: null },
    headerColor: { type: String, default: null },
    backgroundColor: { type: String, default: null }
  },
  
  // 🐛 Проблема
  problem: {
    type: { 
      type: String,
      enum: ['empty_space_bottom', 'content_overflow', 'scroll_issue', 'height_mismatch'],
      required: true
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'severe'],
      required: true
    },
    description: { type: String, required: true },
    
    // Дополнительная диагностика
    scrollTop: { type: Number, default: 0 },
    scrollHeight: { type: Number, default: 0 },
    clientHeight: { type: Number, default: 0 }
  },
  
  // 📊 Метаданные
  debugMode: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // 🔍 Дополнительная информация
  cssVariables: {
    bottomNavHeight: { type: String, default: null },
    headerHeight: { type: String, default: null },
    tgViewportHeight: { type: String, default: null }
  },
  
  // 📝 Дополнительные заметки
  notes: { type: String, default: null }
  
}, {
  timestamps: true,
  collection: 'viewport_logs'
});

// 📊 Индексы для быстрого поиска
viewportLogSchema.index({ timestamp: -1 });
viewportLogSchema.index({ 'device.platform': 1, timestamp: -1 });
viewportLogSchema.index({ 'problem.type': 1, timestamp: -1 });
viewportLogSchema.index({ page: 1, timestamp: -1 });
viewportLogSchema.index({ 
  'device.platform': 1, 
  'problem.type': 1, 
  timestamp: -1 
});

// 📈 Статические методы для анализа
viewportLogSchema.statics = {
  /**
   * Получить статистику проблем viewport
   */
  async getProblemsStats() {
    return await this.aggregate([
      {
        $group: {
          _id: {
            platform: '$device.platform',
            problemType: '$problem.type',
            page: '$page'
          },
          count: { $sum: 1 },
          avgDifference: { $avg: '$viewport.difference' },
          avgInnerHeight: { $avg: '$viewport.innerHeight' },
          avgTelegramHeight: { $avg: '$viewport.telegramHeight' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  },
  
  /**
   * Получить данные по конкретной платформе
   */
  async getPlatformData(platform) {
    return await this.find({ 'device.platform': platform })
      .sort({ timestamp: -1 })
      .limit(100);
  },
  
  /**
   * Получить последние проблемы
   */
  async getRecentProblems(limit = 50) {
    return await this.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('page device.platform problem.type viewport.difference timestamp');
  }
};

// 📱 Методы экземпляра
viewportLogSchema.methods = {
  /**
   * Определить серьезность проблемы
   */
  calculateSeverity() {
    const diff = Math.abs(this.viewport.difference);
    
    if (diff < 10) return 'minor';
    if (diff < 50) return 'moderate';
    return 'severe';
  },
  
  /**
   * Получить краткое описание проблемы
   */
  getShortDescription() {
    const platform = this.device.platform;
    const page = this.page;
    const diff = this.viewport.difference;
    
    return `${platform} ${page}: ${diff > 0 ? '+' : ''}${diff}px`;
  }
};

// 🔧 Pre-save middleware для автоматических расчетов
viewportLogSchema.pre('save', function(next) {
  // Автоматически определяем серьезность проблемы
  if (!this.problem.severity) {
    this.problem.severity = this.calculateSeverity();
  }
  
  // Рассчитываем общий вычет
  this.viewport.totalSubtracted = this.viewport.bottomNavHeight + 
                                  this.viewport.headerHeight + 
                                  40; // padding
  
  // Рассчитываем доступную высоту
  this.viewport.availableHeight = this.viewport.innerHeight - 
                                  this.viewport.totalSubtracted;
  
  next();
});

// Создаем модель
const ViewportLog = mongoose.model('ViewportLog', viewportLogSchema);

module.exports = ViewportLog;