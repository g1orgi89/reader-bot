/**
 * Dashboard JavaScript для админ-панели "Читатель"
 * @file client/admin-panel/js/dashboard.js
 * @description Обновленный дашборд с исправлениями Chart.js и fallback данными
 */

/**
 * @typedef {Object} DashboardStats
 * @property {Object} overview - Общая статистика
 * @property {Array} sourceStats - Статистика источников
 * @property {Array} utmStats - UTM статистика
 */

class ReaderDashboard {
  constructor() {
    this.currentPeriod = '7d';
    this.charts = {};
    this.fallbackMode = false;
    this.init();
  }

  /**
   * Инициализация дашборда
   */
  async init() {
    console.log('📊 Инициализация дашборда "Читатель"...');
    
    try {
      await this.loadDashboardData();
    } catch (error) {
      console.warn('📊 Ошибка загрузки данных, переход в fallback режим:', error.message);
      this.fallbackMode = true;
      this.showFallbackData();
    }
    
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  /**
   * Загрузка данных дашборда
   */
  async loadDashboardData() {
    console.log('📊 Загрузка данных дашборда...');
    
    try {
      const [dashboardStats, retentionData, topContent] = await Promise.all([
        this.fetchDashboardStats(),
        this.fetchRetentionData(),
        this.fetchTopContent()
      ]);

      this.updateStatCards(dashboardStats.data.overview);
      this.updateSourceChart(dashboardStats.data.sourceStats);
      this.updateUTMChart(dashboardStats.data.utmStats);
      this.updateRetentionChart(retentionData.data);
      this.updateTopContent(topContent.data);
      
      console.log('✅ Данные дашборда загружены успешно');

    } catch (error) {
      console.error('📖 Ошибка загрузки данных дашборда:', error);
      throw error; // Передаем ошибку для обработки в init()
    }
  }

  /**
   * Получение статистики дашборда
   * @returns {Promise<Object>} Данные статистики
   */
  async fetchDashboardStats() {
    const response = await fetch(`/api/analytics/dashboard?period=${this.currentPeriod}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Получение данных retention
   * @returns {Promise<Object>} Данные retention
   */
  async fetchRetentionData() {
    const response = await fetch('/api/analytics/retention');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Получение топ контента
   * @returns {Promise<Object>} Данные топ контента
   */
  async fetchTopContent() {
    const response = await fetch(`/api/analytics/top-content?period=${this.currentPeriod}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Обновление карточек статистики
   * @param {Object} stats - Статистика overview
   */
  updateStatCards(stats) {
    const elements = {
      'total-users-count': stats.totalUsers || 0,
      'new-users-count': stats.newUsers || 0,
      'total-quotes-count': stats.totalQuotes || 0,
      'avg-quotes-count': stats.avgQuotesPerUser || '0.0',
      'active-users-count': stats.activeUsers || 0,
      'promo-usage-count': stats.promoUsage || 0
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        element.classList.add('updated');
        
        // Убираем класс через небольшую задержку для анимации
        setTimeout(() => {
          element.classList.remove('updated');
        }, 1000);
      }
    });

    console.log('📊 Карточки статистики обновлены:', stats);
  }

  /**
   * Обновление диаграммы источников
   * @param {Array} sourceStats - Статистика источников
   */
  updateSourceChart(sourceStats) {
    const ctx = document.getElementById('sourceChart');
    if (!ctx) {
      console.warn('📊 Element sourceChart не найден');
      return;
    }

    // ИСПРАВЛЕНИЕ: Уничтожаем предыдущий график перед созданием нового
    if (this.charts.source) {
      this.charts.source.destroy();
      this.charts.source = null;
    }

    const data = sourceStats && sourceStats.length > 0 ? sourceStats : this.getFallbackSourceData();

    try {
      this.charts.source = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(s => s._id || 'Неизвестно'),
          datasets: [{
            data: data.map(s => s.count),
            backgroundColor: [
              '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
              '#FFEAA7', '#DDA0DD', '#F8BBD9', '#E17055'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            title: {
              display: true,
              text: '📊 Источники пользователей "Читатель"',
              font: { size: 16 }
            },
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                usePointStyle: true
              }
            }
          }
        }
      });

      console.log('📊 Диаграмма источников создана:', data);
    } catch (error) {
      console.error('📊 Ошибка создания диаграммы источников:', error);
      this.showChartError('sourceChart', 'Ошибка загрузки диаграммы источников');
    }
  }

  /**
   * Обновление диаграммы UTM
   * @param {Array} utmStats - UTM статистика
   */
  updateUTMChart(utmStats) {
    const ctx = document.getElementById('utmChart');
    if (!ctx) {
      console.warn('📊 Element utmChart не найден');
      return;
    }

    // ИСПРАВЛЕНИЕ: Уничтожаем предыдущий график
    if (this.charts.utm) {
      this.charts.utm.destroy();
      this.charts.utm = null;
    }

    const data = utmStats && utmStats.length > 0 ? utmStats : this.getFallbackUTMData();

    try {
      this.charts.utm = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(u => u.campaign || u._id),
          datasets: [
            {
              label: 'Клики',
              data: data.map(u => u.clicks),
              backgroundColor: '#4ECDC4',
              borderColor: '#45B7D1',
              borderWidth: 1
            },
            {
              label: 'Уникальные пользователи',
              data: data.map(u => u.uniqueUsers),
              backgroundColor: '#45B7D1',
              borderColor: '#4ECDC4',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            title: {
              display: true,
              text: '📈 Эффективность UTM кампаний',
              font: { size: 16 }
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });

      console.log('📊 UTM диаграмма создана:', data);
    } catch (error) {
      console.error('📊 Ошибка создания UTM диаграммы:', error);
      this.showChartError('utmChart', 'Ошибка загрузки UTM диаграммы');
    }
  }

  /**
   * Обновление диаграммы retention
   * @param {Array} retentionData - Данные retention
   */
  updateRetentionChart(retentionData) {
    const ctx = document.getElementById('retentionChart');
    if (!ctx) {
      console.warn('📊 Element retentionChart не найден');
      return;
    }

    // ИСПРАВЛЕНИЕ: Уничтожаем предыдущий график
    if (this.charts.retention) {
      this.charts.retention.destroy();
      this.charts.retention = null;
    }

    const data = retentionData && retentionData.length > 0 ? retentionData : this.getFallbackRetentionData();

    try {
      this.charts.retention = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
          datasets: data.slice(-6).map((cohort, index) => ({
            label: cohort.cohort,
            data: [cohort.week1, cohort.week2, cohort.week3, cohort.week4],
            borderColor: this.getRetentionColor(index),
            backgroundColor: this.getRetentionColor(index, 0.1),
            tension: 0.1,
            pointBackgroundColor: this.getRetentionColor(index),
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            title: {
              display: true,
              text: '📈 Retention по когортам (Читатель)',
              font: { size: 16 }
            },
            legend: {
              position: 'top'
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
              }
            }
          }
        }
      });

      console.log('📊 Retention диаграмма создана:', data);
    } catch (error) {
      console.error('📊 Ошибка создания retention диаграммы:', error);
      this.showChartError('retentionChart', 'Ошибка загрузки retention диаграммы');
    }
  }

  /**
   * Обновление топ контента
   * @param {Object} topContent - Данные топ контента
   */
  updateTopContent(topContent) {
    // Топ авторы
    const authorsContainer = document.getElementById('top-authors');
    if (authorsContainer) {
      const authors = topContent.topAuthors && topContent.topAuthors.length > 0 
        ? topContent.topAuthors 
        : this.getFallbackAuthors();

      authorsContainer.innerHTML = authors.map((author, index) => `
        <div class="top-item">
          <span class="rank">${index + 1}</span>
          <span class="name">${author._id}</span>
          <span class="count">${author.count} цитат</span>
        </div>
      `).join('');
    }

    // Топ категории
    const categoriesContainer = document.getElementById('top-categories');
    if (categoriesContainer) {
      const categories = topContent.topCategories && topContent.topCategories.length > 0 
        ? topContent.topCategories 
        : this.getFallbackCategories();

      categoriesContainer.innerHTML = categories.map((category, index) => `
        <div class="top-item">
          <span class="rank">${index + 1}</span>
          <span class="name">${category._id}</span>
          <span class="count">${category.count} цитат</span>
        </div>
      `).join('');
    }

    // Популярные цитаты
    const quotesContainer = document.getElementById('popular-quotes');
    if (quotesContainer) {
      const quotes = topContent.popularQuotes && topContent.popularQuotes.length > 0 
        ? topContent.popularQuotes 
        : this.getFallbackQuotes();

      quotesContainer.innerHTML = quotes.map((quote, index) => `
        <div class="popular-quote">
          <div class="quote-text">"${quote._id.substring(0, 100)}${quote._id.length > 100 ? '...' : ''}"</div>
          <div class="quote-meta">
            ${quote.author ? `— ${quote.author}` : ''} 
            <span class="usage-count">(${quote.count} раз)</span>
          </div>
        </div>
      `).join('');
    }

    console.log('📊 Топ контент обновлен');
  }

  /**
   * Показать fallback данные при ошибках API
   */
  showFallbackData() {
    console.log('📊 Показ fallback данных...');

    // Fallback статистика
    this.updateStatCards({
      totalUsers: 12,
      newUsers: 3,
      totalQuotes: 47,
      avgQuotesPerUser: '3.9',
      activeUsers: 8,
      promoUsage: 2
    });

    // Fallback диаграммы
    this.updateSourceChart([]);
    this.updateUTMChart([]);
    this.updateRetentionChart([]);

    // Fallback топ контент
    this.updateTopContent({
      topAuthors: [],
      topCategories: [],
      popularQuotes: []
    });

    // Показываем уведомление
    this.showNotification('warning', 'Используются демо-данные. Проверьте подключение к API.');
  }

  // === FALLBACK DATA METHODS ===

  /**
   * Fallback данные для источников
   * @returns {Array} Демо данные источников
   */
  getFallbackSourceData() {
    return [
      { _id: 'Instagram', count: 5 },
      { _id: 'Telegram', count: 3 },
      { _id: 'YouTube', count: 2 },
      { _id: 'Друзья', count: 2 }
    ];
  }

  /**
   * Fallback данные для UTM
   * @returns {Array} Демо UTM данные
   */
  getFallbackUTMData() {
    return [
      { campaign: 'weekly_reports', clicks: 8, uniqueUsers: 6 },
      { campaign: 'book_recommendations', clicks: 5, uniqueUsers: 4 },
      { campaign: 'monthly_analysis', clicks: 3, uniqueUsers: 3 }
    ];
  }

  /**
   * Fallback данные для retention
   * @returns {Array} Демо retention данные
   */
  getFallbackRetentionData() {
    return [
      { cohort: '2024-12', week1: 100, week2: 75, week3: 60, week4: 50 },
      { cohort: '2025-01', week1: 100, week2: 80, week3: 65, week4: 55 }
    ];
  }

  /**
   * Fallback данные для авторов
   * @returns {Array} Демо данные авторов
   */
  getFallbackAuthors() {
    return [
      { _id: 'Эрих Фромм', count: 8 },
      { _id: 'Райнер Мария Рильке', count: 6 },
      { _id: 'Марина Цветаева', count: 4 },
      { _id: 'Пауло Коэльо', count: 3 }
    ];
  }

  /**
   * Fallback данные для категорий
   * @returns {Array} Демо данные категорий
   */
  getFallbackCategories() {
    return [
      { _id: 'Саморазвитие', count: 15 },
      { _id: 'Любовь', count: 12 },
      { _id: 'Мудрость', count: 10 },
      { _id: 'Философия', count: 8 }
    ];
  }

  /**
   * Fallback данные для цитат
   * @returns {Array} Демо данные цитат
   */
  getFallbackQuotes() {
    return [
      { _id: 'Любовь — это решение любить', author: 'Эрих Фромм', count: 3 },
      { _id: 'В каждом слове — целая жизнь', author: 'Марина Цветаева', count: 2 },
      { _id: 'Хорошая жизнь строится, а не дается по умолчанию', author: 'Анна Бусел', count: 2 }
    ];
  }

  // === UTILITY METHODS ===

  /**
   * Получение цвета для retention диаграмм
   * @param {number} index - Индекс
   * @param {number} alpha - Прозрачность
   * @returns {string} CSS цвет
   */
  getRetentionColor(index, alpha = 1) {
    const colors = [
      `rgba(255, 107, 107, ${alpha})`,
      `rgba(78, 205, 196, ${alpha})`,
      `rgba(69, 183, 209, ${alpha})`,
      `rgba(150, 206, 180, ${alpha})`,
      `rgba(255, 234, 167, ${alpha})`,
      `rgba(221, 160, 221, ${alpha})`
    ];
    return colors[index % colors.length];
  }

  /**
   * Показать ошибку вместо диаграммы
   * @param {string} chartId - ID контейнера диаграммы
   * @param {string} message - Сообщение об ошибке
   */
  showChartError(chartId, message) {
    const container = document.getElementById(chartId)?.parentElement;
    if (container) {
      container.innerHTML = `
        <div class="chart-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${message}</p>
          <button onclick="location.reload()" class="btn btn-sm btn-primary">
            Обновить страницу
          </button>
        </div>
      `;
    }
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
        this.loadDashboardData().catch(() => {
          this.showNotification('error', 'Ошибка обновления данных');
        });
      });
    }

    // Экспорт данных
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Обновление данных
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadDashboardData().catch(() => {
          this.showNotification('error', 'Ошибка обновления данных');
        });
      });
    }
  }

  /**
   * Автоматическое обновление данных
   */
  startAutoRefresh() {
    // Обновление каждые 5 минут (только если не fallback режим)
    if (!this.fallbackMode) {
      setInterval(() => {
        this.loadDashboardData().catch((error) => {
          console.warn('📊 Ошибка автообновления:', error.message);
        });
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Экспорт данных
   */
  async exportData() {
    try {
      const data = await this.fetchDashboardStats();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reader-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showNotification('success', 'Данные экспортированы');
    } catch (error) {
      this.showNotification('error', 'Ошибка экспорта данных');
    }
  }

  /**
   * Показать уведомление
   * @param {string} type - Тип уведомления (success, error, warning, info)
   * @param {string} message - Сообщение
   */
  showNotification(type, message) {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    
    notification.innerHTML = `
      <i class="fas fa-${this.getNotificationIcon(type)}"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  /**
   * Получить иконку для уведомления
   * @param {string} type - Тип уведомления
   * @returns {string} CSS класс иконки
   */
  getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('📖 Инициализация дашборда "Читатель"...');
  
  // Проверяем наличие Chart.js
  if (typeof Chart === 'undefined') {
    console.error('📊 Chart.js не загружен!');
    return;
  }

  // Создаем экземпляр дашборда
  window.readerDashboard = new ReaderDashboard();
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReaderDashboard;
}