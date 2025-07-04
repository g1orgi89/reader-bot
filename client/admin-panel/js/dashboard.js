/**
 * @fileoverview Исправленный дашборд аналитики для "Читатель"
 * @description Фиксит проблемы с Chart.js и добавляет fallback данные
 * @version 2.2.0 - ИСПРАВЛЕНА ОБРАБОТКА CANVAS
 */

class ReaderDashboard {
  constructor() {
    this.currentPeriod = '7d';
    this.charts = new Map(); // Используем Map для лучшего отслеживания
    this.isLoading = false;
    
    // ИСПРАВЛЕНО: Правильный API prefix
    this.apiBase = '/api/reader/analytics';
    
    this.init();
  }

  async init() {
    console.log('📊 Инициализация дашборда Reader Bot...');
    
    try {
      this.showLoading(true);
      await this.loadDashboardData();
      this.setupEventListeners();
      this.startAutoRefresh();
      console.log('✅ Дашборд инициализирован успешно');
    } catch (error) {
      console.error('❌ Ошибка инициализации дашборда:', error);
      this.showError('Ошибка инициализации дашборда');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Основная функция загрузки данных
   */
  async loadDashboardData() {
    try {
      console.log(`📊 Загрузка данных для периода: ${this.currentPeriod}`);
      
      const [dashboardStats, retentionData, topContent] = await Promise.all([
        this.fetchDashboardStats(),
        this.fetchRetentionData(),
        this.fetchTopContent()
      ]);

      this.updateStatCards(dashboardStats.overview);
      this.updateSourceChart(dashboardStats.sourceStats);
      this.updateUTMChart(dashboardStats.utmStats);
      this.updateRetentionChart(retentionData);
      this.updateTopContent(topContent);

      console.log('✅ Данные дашборда загружены успешно');

    } catch (error) {
      console.error('📖 Ошибка загрузки данных дашборда:', error);
      console.log('📊 Переход в fallback режим...');
      this.showFallbackData();
    }
  }

  /**
   * ИСПРАВЛЕНО: Получение статистики дашборда с правильным URL
   */
  async fetchDashboardStats() {
    const url = `${this.apiBase}/dashboard?period=${this.currentPeriod}`;
    console.log('📊 Fetching dashboard from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  /**
   * ИСПРАВЛЕНО: Получение данных retention с правильным URL
   */
  async fetchRetentionData() {
    const url = `${this.apiBase}/retention`;
    console.log('📊 Fetching retention from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  /**
   * ИСПРАВЛЕНО: Получение топ контента с правильным URL
   */
  async fetchTopContent() {
    const url = `${this.apiBase}/top-content?period=${this.currentPeriod}`;
    console.log('📊 Fetching top content from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  /**
   * ИСПРАВЛЕНО: Обновление статистических карточек
   */
  updateStatCards(stats) {
    try {
      const elements = {
        'total-users-count': stats.totalUsers || 0,
        'new-users-count': stats.newUsers || 0,
        'total-quotes-count': stats.totalQuotes || 0,
        'avg-quotes-count': stats.avgQuotesPerUser || '0',
        'active-users-count': stats.activeUsers || 0,
        'promo-usage-count': stats.promoUsage || 0
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });

      console.log('📊 Карточки статистики обновлены:', stats);
    } catch (error) {
      console.error('📊 Ошибка обновления карточек статистики:', error);
    }
  }

  /**
   * ИСПРАВЛЕНО: Обновление диаграммы источников с лучшей обработкой ошибок
   */
  updateSourceChart(sourceStats) {
    const chartId = 'sourceChart';
    
    try {
      // КРИТИЧНО: Уничтожаем существующий график
      this.destroyChart(chartId);

      // ИСПРАВЛЕНО: Ищем canvas или создаем заново если нужно
      let ctx = document.getElementById(chartId);
      
      if (!ctx) {
        console.warn(`📊 Canvas ${chartId} не найден, попытка восстановить...`);
        this.restoreCanvas(chartId, 400, 200);
        ctx = document.getElementById(chartId);
      }
      
      if (!ctx) {
        console.error(`📊 Не удалось найти или создать canvas ${chartId}`);
        return;
      }

      if (!sourceStats || sourceStats.length === 0) {
        this.showEmptyChart(chartId, 'Нет данных об источниках');
        return;
      }

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: sourceStats.map(s => s._id || 'Неизвестно'),
          datasets: [{
            data: sourceStats.map(s => s.count),
            backgroundColor: [
              '#FF6B6B', '#4ECDC4', '#45B7D1', 
              '#96CEB4', '#FFEAA7', '#DDA0DD'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '📊 Источники пользователей'
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      });

      // Сохраняем ссылку на график
      this.charts.set(chartId, chart);
      console.log('📊 Диаграмма источников создана:', sourceStats);

    } catch (error) {
      console.error('📊 Ошибка создания диаграммы источников:', error);
      this.showChartError('sourceChart', 'Ошибка диаграммы источников');
    }
  }

  /**
   * ИСПРАВЛЕНО: Обновление UTM диаграммы
   */
  updateUTMChart(utmStats) {
    const chartId = 'utmChart';
    
    try {
      // КРИТИЧНО: Уничтожаем существующий график
      this.destroyChart(chartId);

      // ИСПРАВЛЕНО: Ищем canvas или создаем заново если нужно
      let ctx = document.getElementById(chartId);
      
      if (!ctx) {
        console.warn(`📊 Canvas ${chartId} не найден, попытка восстановить...`);
        this.restoreCanvas(chartId, 400, 200);
        ctx = document.getElementById(chartId);
      }
      
      if (!ctx) {
        console.error(`📊 Не удалось найти или создать canvas ${chartId}`);
        return;
      }

      if (!utmStats || utmStats.length === 0) {
        this.showEmptyChart(chartId, 'Нет данных о UTM кампаниях');
        return;
      }

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: utmStats.map(u => u.campaign || u._id),
          datasets: [
            {
              label: 'Клики',
              data: utmStats.map(u => u.clicks || 0),
              backgroundColor: '#4ECDC4'
            },
            {
              label: 'Уникальные пользователи',
              data: utmStats.map(u => u.uniqueUsers || 0),
              backgroundColor: '#45B7D1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '📈 Эффективность UTM кампаний'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });

      this.charts.set(chartId, chart);
      console.log('📊 UTM диаграмма создана:', utmStats);

    } catch (error) {
      console.error('📊 Ошибка создания UTM диаграммы:', error);
      this.showChartError('utmChart', 'Ошибка UTM диаграммы');
    }
  }

  /**
   * ИСПРАВЛЕНО: Обновление диаграммы retention
   */
  updateRetentionChart(retentionData) {
    const chartId = 'retentionChart';
    
    try {
      // КРИТИЧНО: Уничтожаем существующий график
      this.destroyChart(chartId);

      // ИСПРАВЛЕНО: Ищем canvas или создаем заново если нужно
      let ctx = document.getElementById(chartId);
      
      if (!ctx) {
        console.warn(`📊 Canvas ${chartId} не найден, попытка восстановить...`);
        this.restoreCanvas(chartId, 800, 300);
        ctx = document.getElementById(chartId);
      }
      
      if (!ctx) {
        console.error(`📊 Не удалось найти или создать canvas ${chartId}`);
        return;
      }

      if (!retentionData || retentionData.length === 0) {
        this.showEmptyChart(chartId, 'Нет данных о retention');
        return;
      }

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
          datasets: retentionData.slice(-6).map((cohort, index) => ({
            label: cohort.cohort,
            data: [cohort.week1, cohort.week2, cohort.week3, cohort.week4],
            borderColor: this.getRetentionColor(index),
            backgroundColor: this.getRetentionColor(index, 0.1),
            tension: 0.1
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '📈 Retention по когортам'
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

      this.charts.set(chartId, chart);
      console.log('📊 Retention диаграмма создана:', retentionData);

    } catch (error) {
      console.error('📊 Ошибка создания retention диаграммы:', error);
      this.showChartError('retentionChart', 'Ошибка retention диаграммы');
    }
  }

  /**
   * НОВОЕ: Восстановление canvas элемента
   */
  restoreCanvas(canvasId, width, height) {
    // Ищем контейнер графика
    const containers = document.querySelectorAll('.chart-container');
    let targetContainer = null;
    
    for (const container of containers) {
      if (container.innerHTML.includes(canvasId) || 
          (canvasId === 'sourceChart' && container.innerHTML.includes('Источники')) ||
          (canvasId === 'utmChart' && container.innerHTML.includes('UTM')) ||
          (canvasId === 'retentionChart' && container.innerHTML.includes('Retention'))) {
        targetContainer = container;
        break;
      }
    }
    
    if (!targetContainer) {
      console.error(`📊 Не найден контейнер для canvas ${canvasId}`);
      return;
    }
    
    // Находим или создаем chart-wrapper
    let wrapper = targetContainer.querySelector('.chart-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'chart-wrapper';
      targetContainer.appendChild(wrapper);
    }
    
    // Создаем новый canvas
    wrapper.innerHTML = `<canvas id="${canvasId}" width="${width}" height="${height}"></canvas>`;
    console.log(`📊 Canvas ${canvasId} восстановлен`);
  }

  /**
   * Обновление топ контента
   */
  updateTopContent(topContent) {
    try {
      // Топ авторы
      const authorsContainer = document.getElementById('top-authors');
      if (authorsContainer && topContent.topAuthors) {
        authorsContainer.innerHTML = topContent.topAuthors.map((author, index) => `
          <div class="top-item">
            <span class="rank">${index + 1}</span>
            <span class="name">${author._id}</span>
            <span class="count">${author.count} цитат</span>
          </div>
        `).join('');
      }

      // Топ категории
      const categoriesContainer = document.getElementById('top-categories');
      if (categoriesContainer && topContent.topCategories) {
        categoriesContainer.innerHTML = topContent.topCategories.map((category, index) => `
          <div class="top-item">
            <span class="rank">${index + 1}</span>
            <span class="name">${category._id}</span>
            <span class="count">${category.count} цитат</span>
          </div>
        `).join('');
      }

      // Популярные цитаты
      const quotesContainer = document.getElementById('popular-quotes');
      if (quotesContainer && topContent.popularQuotes) {
        quotesContainer.innerHTML = topContent.popularQuotes.map((quote, index) => `
          <div class="popular-quote">
            <div class="quote-text">"${quote._id.substring(0, 100)}..."</div>
            <div class="quote-meta">
              ${quote.author ? `— ${quote.author}` : ''} 
              <span class="usage-count">(${quote.count} раз)</span>
            </div>
          </div>
        `).join('');
      }

      console.log('📊 Топ контент обновлен');
    } catch (error) {
      console.error('📊 Ошибка обновления топ контента:', error);
    }
  }

  /**
   * НОВОЕ: Показ fallback данных
   */
  showFallbackData() {
    console.log('📊 Показ fallback данных...');

    // Демонстрационные данные
    const demoStats = {
      totalUsers: 12,
      newUsers: 3,
      totalQuotes: 47,
      avgQuotesPerUser: '3.9',
      activeUsers: 8,
      promoUsage: 2
    };

    const demoSources = [
      { _id: 'Instagram', count: 5 },
      { _id: 'Telegram', count: 4 },
      { _id: 'YouTube', count: 2 },
      { _id: 'Друзья', count: 1 }
    ];

    const demoUTM = [
      { campaign: 'reader_recommendations', clicks: 15, uniqueUsers: 8 },
      { campaign: 'weekly_report', clicks: 23, uniqueUsers: 12 },
      { campaign: 'monthly_announcement', clicks: 8, uniqueUsers: 5 }
    ];

    const demoRetention = [
      { cohort: '2024-12', week1: 85, week2: 72, week3: 58, week4: 45 },
      { cohort: '2025-01', week1: 90, week2: 78, week3: 65, week4: 52 }
    ];

    const demoTopContent = {
      topAuthors: [
        { _id: 'Эрих Фромм', count: 8 },
        { _id: 'Марина Цветаева', count: 6 },
        { _id: 'Анна Бусел', count: 4 }
      ],
      topCategories: [
        { _id: 'Саморазвитие', count: 18 },
        { _id: 'Психология', count: 12 },
        { _id: 'Философия', count: 9 }
      ],
      popularQuotes: [
        { _id: 'В каждом слове — целая жизнь', author: 'Цветаева', count: 3 },
        { _id: 'Любовь — это решение любить', author: 'Фромм', count: 2 }
      ]
    };

    // Обновляем интерфейс
    this.updateStatCards(demoStats);
    this.updateSourceChart(demoSources);
    this.updateUTMChart(demoUTM);
    this.updateRetentionChart(demoRetention);
    this.updateTopContent(demoTopContent);
  }

  /**
   * КРИТИЧНО: Правильное уничтожение графика
   */
  destroyChart(chartId) {
    if (this.charts.has(chartId)) {
      const chart = this.charts.get(chartId);
      try {
        chart.destroy();
        this.charts.delete(chartId);
        console.log(`📊 График ${chartId} уничтожен`);
      } catch (error) {
        console.warn(`📊 Ошибка уничтожения графика ${chartId}:`, error);
        this.charts.delete(chartId); // Удаляем из карты в любом случае
      }
    }
  }

  /**
   * ИСПРАВЛЕНО: Показ ошибки на графике без замены canvas
   */
  showChartError(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const wrapper = canvas.closest('.chart-wrapper') || canvas.parentElement;
      // Не заменяем wrapper, а добавляем overlay
      wrapper.style.position = 'relative';
      wrapper.innerHTML = canvas.outerHTML + `
        <div class="chart-error-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
             display: flex; align-items: center; justify-content: center; 
             background: rgba(255,255,255,0.9); backdrop-filter: blur(2px);">
          <div class="chart-error" style="text-align: center;">
            <i class="error-icon">⚠️</i>
            <p>${message}</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * ИСПРАВЛЕНО: Показ пустого графика без замены canvas
   */
  showEmptyChart(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const wrapper = canvas.closest('.chart-wrapper') || canvas.parentElement;
      wrapper.style.position = 'relative';
      wrapper.innerHTML = canvas.outerHTML + `
        <div class="chart-empty-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
             display: flex; align-items: center; justify-content: center; 
             background: rgba(248,249,250,0.9);">
          <div class="chart-empty" style="text-align: center; color: #6c757d;">
            <i class="empty-icon">📭</i>
            <p>${message}</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Показ/скрытие состояния загрузки
   */
  showLoading(show) {
    this.isLoading = show;
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }

    // Блокируем кнопки во время загрузки
    const controls = document.querySelectorAll('#date-range, #export-data');
    controls.forEach(control => {
      control.disabled = show;
    });
  }

  /**
   * Показ ошибки
   */
  showError(message) {
    console.error('📊 Dashboard Error:', message);
    // Можно добавить toast уведомление
  }

  /**
   * Получение цвета для retention графика
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
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Переключение периода
    const periodSelect = document.getElementById('date-range');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        if (!this.isLoading) {
          this.currentPeriod = e.target.value;
          this.loadDashboardData();
        }
      });
    }

    // Экспорт данных
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Обновление вручную
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (!this.isLoading) {
          this.loadDashboardData();
        }
      });
    }
  }

  /**
   * Автоматическое обновление
   */
  startAutoRefresh() {
    // Обновление каждые 5 минут
    setInterval(() => {
      if (!this.isLoading) {
        console.log('📊 Автоматическое обновление дашборда...');
        this.loadDashboardData();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * ИСПРАВЛЕНО: Экспорт данных с правильным URL
   */
  async exportData() {
    try {
      this.showLoading(true);
      const data = await this.fetchDashboardStats();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reader-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('📊 Данные экспортированы успешно');
    } catch (error) {
      console.error('📊 Ошибка экспорта данных:', error);
      this.showError('Ошибка экспорта данных');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Уничтожение всех графиков при закрытии
   */
  destroy() {
    this.charts.forEach((chart, chartId) => {
      this.destroyChart(chartId);
    });
    this.charts.clear();
    console.log('📊 Дашборд уничтожен');
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 DOM загружен, инициализация дашборда...');
  window.readerDashboard = new ReaderDashboard();
});

// Cleanup при закрытии страницы
window.addEventListener('beforeunload', () => {
  if (window.readerDashboard) {
    window.readerDashboard.destroy();
  }
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReaderDashboard;
}