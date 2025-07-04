/**
 * @fileoverview JavaScript для дашборда админ-панели "Читатель"
 * @description Управление графиками, статистикой и обновлениями данных
 */

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Общая статистика
 * @property {Array} sourceStats - Статистика источников
 * @property {Array} utmStats - UTM статистика
 * @property {string} period - Период данных
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Когорта
 * @property {number} size - Размер когорты
 * @property {number} week1 - Retention неделя 1
 * @property {number} week2 - Retention неделя 2
 * @property {number} week3 - Retention неделя 3
 * @property {number} week4 - Retention неделя 4
 */

/**
 * Класс для управления дашбордом "Читатель"
 */
class ReaderDashboard {
  constructor() {
    this.currentPeriod = '7d';
    this.charts = {};
    this.refreshInterval = null;
    this.isLoading = false;
    this.cache = new Map();
    this.baseURL = '/api/analytics';
    this.retryCount = 0;
    this.maxRetries = 3;
    
    this.init();
  }

  /**
   * Инициализация дашборда
   */
  async init() {
    console.log('📖 Инициализация дашборда "Читатель"');
    
    this.setupEventListeners();
    await this.loadDashboardData();
    this.startAutoRefresh();
  }

  /**
   * Загрузка всех данных дашборда
   */
  async loadDashboardData() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoadingState();

    try {
      console.log('📊 Загрузка данных дашборда...');
      
      const [dashboardStats, retentionData, topContent] = await Promise.all([
        this.fetchDashboardStats(),
        this.fetchRetentionData(),
        this.fetchTopContent()
      ]);

      console.log('📊 Данные получены:', { dashboardStats, retentionData, topContent });

      this.updateStatCards(dashboardStats.overview);
      this.updateSourceChart(dashboardStats.sourceStats);
      this.updateUTMChart(dashboardStats.utmStats);
      this.updateRetentionChart(retentionData);
      this.updateTopContent(topContent);

      this.hideLoadingState();
      this.showNotification('success', 'Данные дашборда обновлены');
      this.retryCount = 0; // Сбрасываем счетчик ошибок

    } catch (error) {
      console.error('📖 Ошибка загрузки данных дашборда:', error);
      this.hideLoadingState();
      
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        this.showNotification('warning', `Попытка загрузки ${this.retryCount}/${this.maxRetries}...`);
        setTimeout(() => this.loadDashboardData(), 2000 * this.retryCount);
      } else {
        this.showNotification('error', 'Ошибка загрузки данных. Показаны демонстрационные данные.');
        this.showFallbackData();
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Получение статистики дашборда с сервера
   * @returns {Promise<DashboardStats>}
   */
  async fetchDashboardStats() {
    const cacheKey = `dashboard_${this.currentPeriod}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseURL}/dashboard?period=${this.currentPeriod}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка получения статистики');
    }

    this.setCache(cacheKey, result.data);
    return result.data;
  }

  /**
   * Получение данных retention
   * @returns {Promise<RetentionData[]>}
   */
  async fetchRetentionData() {
    const cacheKey = 'retention_data';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseURL}/retention`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка получения retention данных');
    }

    this.setCache(cacheKey, result.data);
    return result.data;
  }

  /**
   * Получение топ контента
   * @returns {Promise<Object>}
   */
  async fetchTopContent() {
    const cacheKey = `top_content_${this.currentPeriod}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseURL}/top-content?period=${this.currentPeriod}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка получения топ контента');
    }

    this.setCache(cacheKey, result.data);
    return result.data;
  }

  /**
   * Обновление карточек статистики
   * @param {Object} stats - Статистика
   */
  updateStatCards(stats) {
    if (!stats) {
      console.warn('📊 No stats data provided');
      return;
    }

    const cards = {
      'total-users-count': this.formatNumber(stats.totalUsers || 0),
      'new-users-count': this.formatNumber(stats.newUsers || 0),
      'total-quotes-count': this.formatNumber(stats.totalQuotes || 0),
      'avg-quotes-count': this.formatDecimal(stats.avgQuotesPerUser || 0),
      'active-users-count': this.formatNumber(stats.activeUsers || 0),
      'promo-usage-count': this.formatNumber(stats.promoUsage || 0)
    };

    Object.entries(cards).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        element.classList.add('updated');
        setTimeout(() => element.classList.remove('updated'), 1000);
      } else {
        console.warn(`📊 Element not found: ${id}`);
      }
    });
  }

  /**
   * Обновление графика источников
   * @param {Array} sourceStats - Статистика источников
   */
  updateSourceChart(sourceStats) {
    const ctx = document.getElementById('sourceChart');
    if (!ctx) return;

    if (this.charts.source) {
      this.charts.source.destroy();
    }

    if (!sourceStats || sourceStats.length === 0) {
      this.showEmptyChart(ctx, 'Нет данных об источниках');
      return;
    }

    // Проверяем доступность Chart.js
    if (typeof Chart === 'undefined') {
      console.error('📊 Chart.js не загружен');
      this.showEmptyChart(ctx, 'График недоступен');
      return;
    }

    this.charts.source = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sourceStats.map(s => s._id || 'Неизвестно'),
        datasets: [{
          data: sourceStats.map(s => s.count || 0),
          backgroundColor: [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#F7931E', '#FF7675'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '📊 Источники пользователей',
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                return `${context.label}: ${context.raw} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Обновление графика UTM кампаний
   * @param {Array} utmStats - UTM статистика
   */
  updateUTMChart(utmStats) {
    const ctx = document.getElementById('utmChart');
    if (!ctx) return;

    if (this.charts.utm) {
      this.charts.utm.destroy();
    }

    if (!utmStats || utmStats.length === 0) {
      this.showEmptyChart(ctx, 'Нет данных UTM кампаний');
      return;
    }

    // Проверяем доступность Chart.js
    if (typeof Chart === 'undefined') {
      console.error('📊 Chart.js не загружен');
      this.showEmptyChart(ctx, 'График недоступен');
      return;
    }

    this.charts.utm = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: utmStats.map(u => u.campaign || u._id),
        datasets: [
          {
            label: 'Клики',
            data: utmStats.map(u => u.clicks || 0),
            backgroundColor: '#4ECDC4',
            borderRadius: 4
          },
          {
            label: 'Уникальные пользователи',
            data: utmStats.map(u => u.uniqueUsers || 0),
            backgroundColor: '#45B7D1',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '📈 Эффективность UTM кампаний',
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Обновление графика retention
   * @param {RetentionData[]} retentionData - Данные retention
   */
  updateRetentionChart(retentionData) {
    const ctx = document.getElementById('retentionChart');
    if (!ctx) return;

    if (this.charts.retention) {
      this.charts.retention.destroy();
    }

    if (!retentionData || retentionData.length === 0) {
      this.showEmptyChart(ctx, 'Недостаточно данных для анализа retention');
      return;
    }

    // Проверяем доступность Chart.js
    if (typeof Chart === 'undefined') {
      console.error('📊 Chart.js не загружен');
      this.showEmptyChart(ctx, 'График недоступен');
      return;
    }

    // Берем последние 6 когорт для читаемости
    const recentCohorts = retentionData.slice(-6);

    this.charts.retention = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
        datasets: recentCohorts.map((cohort, index) => ({
          label: `${cohort.cohort} (${cohort.size} польз.)`,
          data: [cohort.week1 || 0, cohort.week2 || 0, cohort.week3 || 0, cohort.week4 || 0],
          borderColor: this.getRetentionColor(index),
          backgroundColor: this.getRetentionColor(index, 0.1),
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '📈 Retention по когортам',
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  /**
   * Обновление топ контента
   * @param {Object} topContent - Топ контент
   */
  updateTopContent(topContent) {
    if (!topContent) {
      console.warn('📊 No top content data provided');
      return;
    }

    this.updateTopAuthors(topContent.topAuthors);
    this.updateTopCategories(topContent.topCategories);
    this.updatePopularQuotes(topContent.popularQuotes);
  }

  /**
   * Обновление топ авторов
   * @param {Array} topAuthors - Топ авторы
   */
  updateTopAuthors(topAuthors) {
    const container = document.getElementById('top-authors');
    if (!container) return;

    if (!topAuthors || topAuthors.length === 0) {
      container.innerHTML = '<div class="no-data">📚 Нет данных об авторах</div>';
      return;
    }

    container.innerHTML = topAuthors.map((author, index) => `
      <div class="top-item" data-rank="${index + 1}">
        <span class="rank">${index + 1}</span>
        <span class="name">${this.escapeHtml(author._id)}</span>
        <span class="count">${author.count} ${this.declensionQuotes(author.count)}</span>
      </div>
    `).join('');
  }

  /**
   * Обновление топ категорий
   * @param {Array} topCategories - Топ категории
   */
  updateTopCategories(topCategories) {
    const container = document.getElementById('top-categories');
    if (!container) return;

    if (!topCategories || topCategories.length === 0) {
      container.innerHTML = '<div class="no-data">🎯 Нет данных о категориях</div>';
      return;
    }

    container.innerHTML = topCategories.map((category, index) => `
      <div class="top-item" data-rank="${index + 1}">
        <span class="rank">${index + 1}</span>
        <span class="name">${this.escapeHtml(category._id)}</span>
        <span class="count">${category.count} ${this.declensionQuotes(category.count)}</span>
      </div>
    `).join('');
  }

  /**
   * Обновление популярных цитат
   * @param {Array} popularQuotes - Популярные цитаты
   */
  updatePopularQuotes(popularQuotes) {
    const container = document.getElementById('popular-quotes');
    if (!container) return;

    if (!popularQuotes || popularQuotes.length === 0) {
      container.innerHTML = '<div class="no-data">💫 Нет повторяющихся цитат</div>';
      return;
    }

    container.innerHTML = popularQuotes.map(quote => `
      <div class="popular-quote">
        <div class="quote-text">"${this.escapeHtml(this.truncateText(quote._id, 100))}"</div>
        <div class="quote-meta">
          ${quote.author ? `— ${this.escapeHtml(quote.author)}` : ''} 
          <span class="usage-count">(${quote.count} раз)</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Переключение периода
    const periodSelect = document.getElementById('date-range');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.clearCache();
        this.loadDashboardData();
      });
    }

    // Кнопка экспорта
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Кнопки обновления
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.clearCache();
        this.retryCount = 0;
        this.loadDashboardData();
      });
    }
  }

  /**
   * Автоматическое обновление
   */
  startAutoRefresh() {
    // Обновление каждые 5 минут
    this.refreshInterval = setInterval(() => {
      if (!this.isLoading) {
        this.loadDashboardData();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Остановка автообновления
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Экспорт данных
   */
  async exportData() {
    try {
      const response = await fetch(`${this.baseURL}/stats/overview?period=${this.currentPeriod}`);
      if (!response.ok) throw new Error('Ошибка экспорта данных');

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      const blob = new Blob([JSON.stringify(result.data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reader-analytics-${this.currentPeriod}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('success', 'Данные экспортированы');
    } catch (error) {
      console.error('📖 Ошибка экспорта:', error);
      this.showNotification('error', 'Ошибка экспорта данных');
    }
  }

  // === УТИЛИТЫ ===

  /**
   * Показ состояния загрузки
   */
  showLoadingState() {
    document.querySelectorAll('.stat-value').forEach(el => {
      el.textContent = '--';
      el.classList.add('loading');
    });

    document.querySelectorAll('.top-content-list, .popular-quotes-list').forEach(el => {
      el.innerHTML = '<div class="loading">📖 Загрузка...</div>';
    });

    // Показываем spinner на графиках
    document.querySelectorAll('canvas').forEach(canvas => {
      const container = canvas.parentElement;
      if (container) {
        container.classList.add('loading');
      }
    });
  }

  /**
   * Скрытие состояния загрузки
   */
  hideLoadingState() {
    document.querySelectorAll('.loading').forEach(el => {
      el.classList.remove('loading');
    });
  }

  /**
   * Показ fallback данных при ошибке
   */
  showFallbackData() {
    // Показываем демонстрационные данные
    const fallbackStats = {
      totalUsers: 3,
      newUsers: 1,
      totalQuotes: 4,
      avgQuotesPerUser: 1.3,
      activeUsers: 2,
      promoUsage: 0
    };

    const fallbackSources = [
      { _id: 'Instagram', count: 1 },
      { _id: 'Telegram', count: 1 },
      { _id: 'YouTube', count: 1 }
    ];

    const fallbackTopContent = {
      topAuthors: [
        { _id: 'Марина Цветаева', count: 1 },
        { _id: 'Эрих Фромм', count: 1 },
        { _id: 'Будда', count: 1 }
      ],
      topCategories: [
        { _id: 'Поэзия', count: 1 },
        { _id: 'Психология', count: 1 },
        { _id: 'Философия', count: 1 }
      ],
      popularQuotes: []
    };

    this.updateStatCards(fallbackStats);
    this.updateSourceChart(fallbackSources);
    this.updateUTMChart([]);
    this.updateTopContent(fallbackTopContent);
  }

  /**
   * Показ пустого графика
   * @param {HTMLCanvasElement} ctx - Canvas элемент
   * @param {string} message - Сообщение
   */
  showEmptyChart(ctx, message) {
    const chartContainer = ctx.parentElement;
    chartContainer.innerHTML = `
      <div class="empty-chart">
        <div class="empty-chart-icon">📊</div>
        <div class="empty-chart-message">${message}</div>
      </div>
    `;
  }

  /**
   * Получение цвета для retention графика
   * @param {number} index - Индекс
   * @param {number} alpha - Прозрачность
   * @returns {string}
   */
  getRetentionColor(index, alpha = 1) {
    const colors = [
      `rgba(255, 107, 107, ${alpha})`, // Красный
      `rgba(78, 205, 196, ${alpha})`,  // Бирюзовый
      `rgba(69, 183, 209, ${alpha})`,  // Синий
      `rgba(150, 206, 180, ${alpha})`, // Зеленый
      `rgba(255, 234, 167, ${alpha})`, // Желтый
      `rgba(221, 160, 221, ${alpha})`  // Фиолетовый
    ];
    return colors[index % colors.length];
  }

  /**
   * Форматирование чисел
   * @param {number} num - Число
   * @returns {string}
   */
  formatNumber(num) {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Форматирование десятичных чисел
   * @param {number} num - Число
   * @returns {string}
   */
  formatDecimal(num) {
    if (typeof num !== 'number') return '0.0';
    return parseFloat(num).toFixed(1);
  }

  /**
   * Склонение слова "цитата"
   * @param {number} count - Количество
   * @returns {string}
   */
  declensionQuotes(count) {
    if (count % 10 === 1 && count % 100 !== 11) return 'цитата';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
    return 'цитат';
  }

  /**
   * Обрезка текста
   * @param {string} text - Текст
   * @param {number} maxLength - Максимальная длина
   * @returns {string}
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * Экранирование HTML
   * @param {string} text - Текст
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Кэширование
   * @param {string} key - Ключ
   * @returns {any|null}
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) { // 2 минуты
      return cached.data;
    }
    return null;
  }

  /**
   * Установка кэша
   * @param {string} key - Ключ
   * @param {any} data - Данные
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Показ уведомления
   * @param {string} type - Тип (success, error, info, warning)
   * @param {string} message - Сообщение
   */
  showNotification(type, message) {
    if (typeof showNotification === 'function') {
      showNotification(type, message);
    } else {
      // Fallback для случая, когда функция не определена
      console.log(`[${type.toUpperCase()}] ${message}`);
      
      // Простое уведомление через alert для критических ошибок
      if (type === 'error') {
        const shouldShow = confirm(`Ошибка: ${message}\n\nПоказать в консоли?`);
        if (shouldShow) {
          console.error('Dashboard Error:', message);
        }
      }
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.stopAutoRefresh();
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
    this.clearCache();
  }
}

// Глобальная переменная для доступа к экземпляру
window.ReaderDashboard = ReaderDashboard;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    console.log('📖 Initializing Reader Dashboard...');
    const dashboard = new ReaderDashboard();
    window.readerDashboard = dashboard;
  }
});