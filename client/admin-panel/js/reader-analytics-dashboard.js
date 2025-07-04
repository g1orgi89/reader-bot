/**
 * @fileoverview Reader Analytics Dashboard JavaScript - Полная реализация
 * @description Интеграция с полным Analytics API для проекта "Читатель"
 * @version 4.0.0
 */

/**
 * @typedef {Object} DashboardOverview
 * @property {number} totalUsers - Общее количество пользователей
 * @property {number} newUsers - Новые пользователи
 * @property {number} totalQuotes - Общее количество цитат
 * @property {number} avgQuotesPerUser - Среднее количество цитат на пользователя
 * @property {number} activeUsers - Активные пользователи
 * @property {number} promoUsage - Использование промокодов
 */

/**
 * @typedef {Object} RetentionData
 * @property {string} cohort - Когорта (YYYY-MM)
 * @property {number} size - Размер когорты
 * @property {number} week1 - Retention неделя 1 (%)
 * @property {number} week2 - Retention неделя 2 (%)
 * @property {number} week3 - Retention неделя 3 (%)
 * @property {number} week4 - Retention неделя 4 (%)
 */

/**
 * Основной класс дашборда аналитики для проекта "Читатель"
 */
class ReaderAnalyticsDashboard {
  constructor() {
    this.currentPeriod = '7d';
    this.charts = {};
    this.refreshInterval = null;
    this.API_BASE = window.location.origin + '/api';
    this.isLoading = false;
    this.fallbackMode = false;
    
    console.log('📊 Reader Analytics Dashboard v4.0.0 инициализирован');
    this.init();
  }

  /**
   * Инициализация дашборда
   */
  async init() {
    try {
      this.setupEventListeners();
      this.showLoading(true);
      
      // Проверяем доступность API
      await this.checkAPIHealth();
      
      // Загружаем данные
      await this.loadAllData();
      
      // Автообновление каждые 5 минут
      this.startAutoRefresh();
      
      this.showLoading(false);
      this.showNotification('success', 'Дашборд аналитики загружен успешно!');
      
    } catch (error) {
      console.error('📊 Ошибка инициализации дашборда:', error);
      this.showLoading(false);
      this.showNotification('error', 'Ошибка загрузки дашборда: ' + error.message);
    }
  }

  /**
   * Проверка здоровья API
   */
  async checkAPIHealth() {
    try {
      console.log('📊 Проверка API...');
      
      const response = await fetch(`${this.API_BASE}/analytics/test`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API недоступен: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 API работает:', data.message, data.version);

      // Обновляем индикатор статуса
      this.updateAPIStatus(true, data.version);
      
    } catch (error) {
      console.warn('📊 API недоступен, работаем в fallback режиме:', error);
      this.fallbackMode = true;
      this.updateAPIStatus(false, null);
      throw error;
    }
  }

  /**
   * Загрузка всех данных дашборда
   */
  async loadAllData() {
    try {
      console.log(`📊 Загрузка данных для периода: ${this.currentPeriod}`);
      
      // Параллельная загрузка всех данных
      const [dashboardStats, retentionData, topContent] = await Promise.all([
        this.fetchDashboardStats(),
        this.fetchRetentionData(),
        this.fetchTopContent()
      ]);

      // Обновляем UI
      this.updateStatCards(dashboardStats.overview);
      this.updateSourceChart(dashboardStats.sourceStats);
      this.updateUTMChart(dashboardStats.utmStats);
      this.updateRetentionChart(retentionData);
      this.updateTopContent(topContent);
      
      // Обновляем метаданные
      this.updateMetadata(dashboardStats);

      console.log('📊 Все данные загружены успешно');

    } catch (error) {
      console.error('📊 Ошибка загрузки данных:', error);
      throw error;
    }
  }

  /**
   * Получение статистики дашборда
   */
  async fetchDashboardStats() {
    try {
      const response = await fetch(
        `${this.API_BASE}/analytics/dashboard?period=${this.currentPeriod}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error(`Ошибка получения статистики: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Неизвестная ошибка API');
      }

      this.fallbackMode = result.fallbackMode || false;
      return result.data;

    } catch (error) {
      console.error('📊 Ошибка получения dashboard статистики:', error);
      return this.getFallbackDashboardData();
    }
  }

  /**
   * Получение данных retention
   */
  async fetchRetentionData() {
    try {
      const response = await fetch(`${this.API_BASE}/analytics/retention`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения retention: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка retention API');
      }

      return result.data;

    } catch (error) {
      console.error('📊 Ошибка получения retention данных:', error);
      return this.getFallbackRetentionData();
    }
  }

  /**
   * Получение топ контента
   */
  async fetchTopContent() {
    try {
      const response = await fetch(
        `${this.API_BASE}/analytics/top-content?period=${this.currentPeriod}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error(`Ошибка получения топ контента: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка top content API');
      }

      return result.data;

    } catch (error) {
      console.error('📊 Ошибка получения топ контента:', error);
      return this.getFallbackTopContent();
    }
  }

  /**
   * Обновление карточек статистики
   * @param {DashboardOverview} overview - Обзорная статистика
   */
  updateStatCards(overview) {
    const elements = {
      'total-users-count': overview.totalUsers,
      'new-users-count': overview.newUsers,
      'total-quotes-count': overview.totalQuotes,
      'avg-quotes-count': overview.avgQuotesPerUser,
      'active-users-count': overview.activeUsers,
      'promo-usage-count': overview.promoUsage
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        // Анимированное обновление числа
        this.animateNumber(element, value);
      }
    });

    console.log('📊 Карточки статистики обновлены');
  }

  /**
   * Анимированное обновление числа
   * @param {HTMLElement} element - Элемент для обновления
   * @param {number} targetValue - Целевое значение
   */
  animateNumber(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    const increment = (targetValue - currentValue) / 20;
    let current = currentValue;
    
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
        element.textContent = targetValue;
        clearInterval(timer);
      } else {
        element.textContent = Math.round(current);
      }
    }, 50);
  }

  /**
   * Обновление графика источников
   * @param {Array} sourceStats - Статистика источников
   */
  updateSourceChart(sourceStats) {
    const ctx = document.getElementById('sourceChart');
    if (!ctx) {
      console.warn('📊 График источников не найден');
      return;
    }

    // Уничтожаем предыдущий график
    if (this.charts.source) {
      this.charts.source.destroy();
    }

    // Подготовка данных
    const labels = sourceStats.map(s => s._id || 'Неизвестно');
    const data = sourceStats.map(s => s.count);
    
    // Цвета в стиле "Читателя"
    const colors = [
      '#8B4513', '#CD853F', '#DEB887', '#F4A460', 
      '#D2691E', '#A0522D', '#8FBC8F', '#9ACD32'
    ];

    this.charts.source = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: '📚 Источники пользователей "Читателя"',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    console.log('📊 График источников обновлен');
  }

  /**
   * Обновление графика UTM кампаний
   * @param {Array} utmStats - Статистика UTM
   */
  updateUTMChart(utmStats) {
    const ctx = document.getElementById('utmChart');
    if (!ctx || !utmStats.length) {
      console.warn('📊 График UTM не найден или нет данных');
      return;
    }

    if (this.charts.utm) {
      this.charts.utm.destroy();
    }

    const labels = utmStats.map(u => u.campaign || u._id);
    const clicks = utmStats.map(u => u.clicks);
    const uniqueUsers = utmStats.map(u => u.uniqueUsers);

    this.charts.utm = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Клики',
            data: clicks,
            backgroundColor: '#CD853F',
            borderColor: '#8B4513',
            borderWidth: 1
          },
          {
            label: 'Уникальные пользователи',
            data: uniqueUsers,
            backgroundColor: '#DEB887',
            borderColor: '#D2691E',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: '📈 Эффективность UTM кампаний',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#f0f0f0'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false
        }
      }
    });

    console.log('📊 График UTM обновлен');
  }

  /**
   * Обновление графика retention
   * @param {RetentionData[]} retentionData - Данные retention
   */
  updateRetentionChart(retentionData) {
    const ctx = document.getElementById('retentionChart');
    if (!ctx || !retentionData.length) {
      console.warn('📊 График retention не найден или нет данных');
      return;
    }

    if (this.charts.retention) {
      this.charts.retention.destroy();
    }

    const labels = ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'];
    const datasets = retentionData.slice(-6).map((cohort, index) => ({
      label: `Когорта ${cohort.cohort} (${cohort.size} польз.)`,
      data: [cohort.week1, cohort.week2, cohort.week3, cohort.week4],
      borderColor: this.getRetentionColor(index),
      backgroundColor: this.getRetentionColor(index, 0.1),
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    this.charts.retention = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: '📈 Retention пользователей по когортам',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                return `${context[0].label}`;
              },
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y}%`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: '#f0f0f0'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false
        }
      }
    });

    console.log('📊 График retention обновлен');
  }

  /**
   * Обновление топ контента
   * @param {Object} topContent - Топ контент
   */
  updateTopContent(topContent) {
    // Топ авторы
    this.updateTopList('top-authors', topContent.topAuthors, (author, index) => `
      <div class="top-item">
        <span class="rank">${index + 1}</span>
        <span class="name">📚 ${author._id}</span>
        <span class="count">${author.count} цитат</span>
      </div>
    `);

    // Топ категории
    this.updateTopList('top-categories', topContent.topCategories, (category, index) => `
      <div class="top-item">
        <span class="rank">${index + 1}</span>
        <span class="name">🏷️ ${category._id}</span>
        <span class="count">${category.count} цитат</span>
      </div>
    `);

    // Популярные цитаты
    this.updateTopList('popular-quotes', topContent.popularQuotes, (quote, index) => `
      <div class="popular-quote">
        <div class="quote-rank">${index + 1}</div>
        <div class="quote-content">
          <div class="quote-text">"${this.truncateText(quote._id, 80)}..."</div>
          <div class="quote-meta">
            ${quote.author ? `— ${quote.author}` : '— Автор неизвестен'} 
            <span class="usage-count">(${quote.count} раз)</span>
          </div>
        </div>
      </div>
    `);

    console.log('📊 Топ контент обновлен');
  }

  /**
   * Обновление списка топ элементов
   * @param {string} containerId - ID контейнера
   * @param {Array} items - Элементы для отображения
   * @param {Function} templateFn - Функция создания HTML
   */
  updateTopList(containerId, items, templateFn) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`📊 Контейнер ${containerId} не найден`);
      return;
    }

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="no-data">📝 Нет данных для отображения</div>';
      return;
    }

    container.innerHTML = items.map(templateFn).join('');
  }

  /**
   * Обновление метаданных
   * @param {Object} dashboardStats - Статистика дашборда
   */
  updateMetadata(dashboardStats) {
    // Обновляем время последнего обновления
    const timestampElement = document.getElementById('last-update');
    if (timestampElement) {
      timestampElement.textContent = new Date().toLocaleString('ru-RU');
    }

    // Обновляем индикатор fallback режима
    const fallbackIndicator = document.getElementById('fallback-indicator');
    if (fallbackIndicator) {
      if (this.fallbackMode || dashboardStats.fallbackMode) {
        fallbackIndicator.style.display = 'inline-block';
        fallbackIndicator.textContent = '⚠️ Тестовые данные';
        fallbackIndicator.title = 'Отображаются тестовые данные из-за отсутствия реальных данных в БД';
      } else {
        fallbackIndicator.style.display = 'none';
      }
    }

    // Обновляем период
    const periodElement = document.getElementById('current-period');
    if (periodElement) {
      const periodNames = {
        '1d': 'за день',
        '7d': 'за неделю', 
        '30d': 'за месяц',
        '90d': 'за 3 месяца'
      };
      periodElement.textContent = periodNames[this.currentPeriod] || this.currentPeriod;
    }
  }

  /**
   * Обновление статуса API
   * @param {boolean} isOnline - Статус API
   * @param {string} version - Версия API
   */
  updateAPIStatus(isOnline, version) {
    const statusElement = document.getElementById('api-status');
    if (statusElement) {
      if (isOnline) {
        statusElement.innerHTML = `✅ API работает ${version ? `(v${version})` : ''}`;
        statusElement.className = 'api-status online';
      } else {
        statusElement.innerHTML = '❌ API недоступен (fallback режим)';
        statusElement.className = 'api-status offline';
      }
    }
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Переключение периода
    const periodSelect = document.getElementById('date-range');
    if (periodSelect) {
      periodSelect.addEventListener('change', async (e) => {
        const newPeriod = e.target.value;
        if (newPeriod !== this.currentPeriod) {
          this.currentPeriod = newPeriod;
          console.log(`📊 Период изменен на: ${newPeriod}`);
          
          this.showLoading(true);
          try {
            await this.loadAllData();
            this.showNotification('success', `Данные обновлены для периода: ${newPeriod}`);
          } catch (error) {
            this.showNotification('error', 'Ошибка обновления данных: ' + error.message);
          } finally {
            this.showLoading(false);
          }
        }
      });
    }

    // Кнопка обновления
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        if (this.isLoading) return;
        
        console.log('📊 Ручное обновление данных');
        this.showLoading(true);
        
        try {
          await this.loadAllData();
          this.showNotification('success', 'Данные успешно обновлены!');
        } catch (error) {
          this.showNotification('error', 'Ошибка обновления: ' + error.message);
        } finally {
          this.showLoading(false);
        }
      });
    }

    // Экспорт данных
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Кнопка тестирования API
    const testApiBtn = document.getElementById('test-api');
    if (testApiBtn) {
      testApiBtn.addEventListener('click', () => this.testAPI());
    }
  }

  /**
   * Автообновление данных
   */
  startAutoRefresh() {
    // Обновляем каждые 5 минут
    this.refreshInterval = setInterval(async () => {
      if (!this.isLoading) {
        console.log('📊 Автоматическое обновление данных');
        try {
          await this.loadAllData();
        } catch (error) {
          console.warn('📊 Ошибка автообновления:', error);
        }
      }
    }, 5 * 60 * 1000);

    console.log('📊 Автообновление запущено (каждые 5 минут)');
  }

  /**
   * Остановка автообновления
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('📊 Автообновление остановлено');
    }
  }

  /**
   * Экспорт данных
   */
  async exportData() {
    try {
      console.log('📊 Экспорт данных аналитики');
      
      const response = await fetch(
        `${this.API_BASE}/analytics/export?format=json&period=${this.currentPeriod}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка экспорта данных');
      }

      // Скачиваем файл
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reader-analytics-${this.currentPeriod}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('success', 'Данные экспортированы успешно!');

    } catch (error) {
      console.error('📊 Ошибка экспорта:', error);
      this.showNotification('error', 'Ошибка экспорта: ' + error.message);
    }
  }

  /**
   * Тестирование API
   */
  async testAPI() {
    try {
      console.log('📊 Тестирование API');
      
      this.showLoading(true);
      await this.checkAPIHealth();
      
      this.showNotification('success', 'API тест прошел успешно!');
      
    } catch (error) {
      this.showNotification('error', 'API тест не прошел: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Показ/скрытие индикатора загрузки
   * @param {boolean} show - Показывать ли загрузку
   */
  showLoading(show) {
    this.isLoading = show;
    
    const loadingElements = document.querySelectorAll('.loading-indicator');
    loadingElements.forEach(el => {
      el.style.display = show ? 'block' : 'none';
    });

    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.disabled = show;
      refreshBtn.textContent = show ? '🔄 Обновление...' : '🔄 Обновить';
    }
  }

  /**
   * Показ уведомления
   * @param {string} type - Тип уведомления (success, error, warning)
   * @param {string} message - Сообщение
   */
  showNotification(type, message) {
    console.log(`📊 Уведомление [${type}]: ${message}`);
    
    // Простая реализация уведомлений
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
      <span class="notification-message">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // ========================================
  // UTILITY МЕТОДЫ
  // ========================================

  /**
   * Получение цвета для retention графика
   * @param {number} index - Индекс
   * @param {number} alpha - Прозрачность
   * @returns {string} CSS цвет
   */
  getRetentionColor(index, alpha = 1) {
    const colors = [
      `rgba(139, 69, 19, ${alpha})`,    // SaddleBrown
      `rgba(205, 133, 63, ${alpha})`,   // Peru
      `rgba(222, 184, 135, ${alpha})`,  // BurlyWood  
      `rgba(244, 164, 96, ${alpha})`,   // SandyBrown
      `rgba(210, 105, 30, ${alpha})`,   // Chocolate
      `rgba(160, 82, 45, ${alpha})`     // Sienna
    ];
    return colors[index % colors.length];
  }

  /**
   * Обрезка текста
   * @param {string} text - Текст
   * @param {number} maxLength - Максимальная длина
   * @returns {string} Обрезанный текст
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim();
  }

  // ========================================
  // FALLBACK ДАННЫЕ
  // ========================================

  getFallbackDashboardData() {
    return {
      overview: {
        totalUsers: 15,
        newUsers: 4,
        totalQuotes: 58,
        avgQuotesPerUser: 3.9,
        activeUsers: 11,
        promoUsage: 3
      },
      sourceStats: [
        { _id: 'Instagram', count: 6 },
        { _id: 'Telegram', count: 5 },
        { _id: 'YouTube', count: 3 },
        { _id: 'Друзья', count: 1 }
      ],
      utmStats: [
        { campaign: 'reader_recommendations', clicks: 18, uniqueUsers: 10 },
        { campaign: 'weekly_report', clicks: 25, uniqueUsers: 14 }
      ],
      fallbackMode: true
    };
  }

  getFallbackRetentionData() {
    return [
      { cohort: '2024-12', size: 10, week1: 90, week2: 75, week3: 60, week4: 50 },
      { cohort: '2025-01', size: 15, week1: 85, week2: 70, week3: 58, week4: 45 }
    ];
  }

  getFallbackTopContent() {
    return {
      topAuthors: [
        { _id: 'Эрих Фромм', count: 12 },
        { _id: 'Марина Цветаева', count: 8 },
        { _id: 'Анна Бусел', count: 6 }
      ],
      topCategories: [
        { _id: 'Саморазвитие', count: 22 },
        { _id: 'Психология', count: 15 },
        { _id: 'Философия', count: 11 }
      ],
      popularQuotes: [
        { _id: 'В каждом слове — целая жизнь', author: 'Марина Цветаева', count: 4 },
        { _id: 'Любовь — это решение любить', author: 'Эрих Фромм', count: 3 }
      ],
      fallbackMode: true
    };
  }

  /**
   * Деструктор - очистка ресурсов
   */
  destroy() {
    this.stopAutoRefresh();
    
    // Уничтожаем все графики
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    
    this.charts = {};
    console.log('📊 Reader Analytics Dashboard уничтожен');
  }
}

// ========================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 DOM загружен, инициализация Reader Analytics Dashboard...');
  
  // Глобальная переменная для дашборда
  window.readerDashboard = new ReaderAnalyticsDashboard();
});

// Очистка ресурсов при уходе со страницы
window.addEventListener('beforeunload', () => {
  if (window.readerDashboard) {
    window.readerDashboard.destroy();
  }
});

console.log('📊 Reader Analytics Dashboard v4.0.0 JavaScript загружен');