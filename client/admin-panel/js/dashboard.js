/**
 * @fileoverview Скрипт для управления дашбордом админ-панели Shrooms AI Support Bot
 * @description Обработка статистики, графиков и управления доходностью фарминга
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} activeConversations - Количество активных бесед
 * @property {number} openTickets - Количество открытых тикетов
 * @property {number} resolvedIssues - Количество решенных проблем
 * @property {string} avgResponseTime - Среднее время ответа
 */

/**
 * @typedef {Object} ChartData
 * @property {string[]} labels - Подписи для графика
 * @property {number[]} values - Значения для графика
 */

/**
 * @typedef {Object} FarmingRateData
 * @property {number} rate - Текущая доходность в процентах
 * @property {string} lastUpdated - Время последнего обновления
 */

/**
 * Главный класс управления дашбордом
 */
class ShroomsDashboard {
  /**
   * @constructor
   */
  constructor() {
    this.isInitialized = false;
    this.statsRefreshInterval = null;
    this.dateRange = 'week';
    
    // Кеш для данных
    this.cachedStats = null;
    this.cachedChartData = null;
    
    console.log('🍄 Инициализация ShroomsDashboard');
  }
  
  /**
   * Инициализация дашборда
   * @returns {Promise<void>}
   */
  async init() {
    try {
      console.log('🍄 Запуск инициализации дашборда');
      
      // Настройка обработчиков событий
      this.setupEventListeners();
      
      // Загрузка начальных данных
      await this.loadInitialData();
      
      // Запуск периодического обновления
      this.startPeriodicRefresh();
      
      // Инициализация грибной матрицы
      this.initMushroomMatrix();
      
      this.isInitialized = true;
      console.log('🍄 Дашборд успешно инициализирован');
      
    } catch (error) {
      console.error('🍄 Ошибка инициализации дашборда:', error);
      this.showNotification('error', '🍄 Не удалось инициализировать дашборд');
    }
  }
  
  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Обработчик изменения периода
    const dateRangeSelect = document.getElementById('date-range');
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', (e) => {
        this.dateRange = e.target.value;
        this.loadStats();
        this.loadChartData();
      });
    }
    
    // Обработчик формы доходности фарминга
    const farmingForm = document.getElementById('farming-rate-form');
    if (farmingForm) {
      farmingForm.addEventListener('submit', (e) => this.handleFarmingRateUpdate(e));
    }
    
    // Обработчик кнопки обновления статистики
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="refresh-stats"]')) {
        this.refreshAllData();
      }
    });
    
    console.log('🍄 Обработчики событий настроены');
  }
  
  /**
   * Загрузка начальных данных
   * @returns {Promise<void>}
   */
  async loadInitialData() {
    console.log('🍄 Загрузка начальных данных дашборда');
    
    // Параллельная загрузка данных
    await Promise.allSettled([
      this.loadStats(),
      this.loadRecentTickets(),
      this.loadFarmingRate(),
      this.loadChartData()
    ]);
  }
  
  /**
   * Загрузка статистики
   * @returns {Promise<void>}
   */
  async loadStats() {
    try {
      console.log('🍄 Загрузка статистики для периода:', this.dateRange);
      
      if (!window.makeAuthenticatedRequest) {
        console.warn('🍄 makeAuthenticatedRequest не найдена, используем заглушку');
        this.loadStatsStub();
        return;
      }
      
      const response = await window.makeAuthenticatedRequest(`/api/admin/stats?period=${this.dateRange}`);
      
      if (response.success && response.data) {
        this.updateStatsDisplay(response.data);
        this.cachedStats = response.data;
      } else {
        console.warn('🍄 Не удалось загрузить статистику, используем заглушку');
        this.loadStatsStub();
      }
      
    } catch (error) {
      console.error('🍄 Ошибка загрузки статистики:', error);
      this.loadStatsStub();
    }
  }
  
  /**
   * Заглушка для статистики
   */
  loadStatsStub() {
    const stubData = {
      activeConversations: 42,
      openTickets: 7,
      resolvedIssues: 156,
      avgResponseTime: '2.3s',
      conversationsTrend: 5,
      ticketsTrend: 12,
      resolvedTrend: 8,
      responseTrend: -5
    };
    
    this.updateStatsDisplay(stubData);
  }
  
  /**
   * Обновление отображения статистики
   * @param {DashboardStats} data - Данные статистики
   */
  updateStatsDisplay(data) {
    const updates = {
      'active-conversations-count': data.activeConversations,
      'open-tickets-count': data.openTickets,
      'resolved-issues-count': data.resolvedIssues,
      'avg-response-time': data.avgResponseTime
    };
    
    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        // Анимация изменения числа
        this.animateCounterChange(element, value);
      }
    });
    
    console.log('🍄 Статистика обновлена');
  }
  
  /**
   * Анимация изменения счетчика
   * @param {HTMLElement} element - Элемент счетчика
   * @param {string|number} newValue - Новое значение
   */
  animateCounterChange(element, newValue) {
    const currentValue = element.textContent;
    
    if (currentValue === '--' || currentValue === newValue.toString()) {
      element.textContent = newValue;
      return;
    }
    
    // Простая анимация появления
    element.style.opacity = '0.5';
    element.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      element.textContent = newValue;
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
    }, 200);
  }
  
  /**
   * Загрузка последних тикетов
   * @returns {Promise<void>}
   */
  async loadRecentTickets() {
    try {
      console.log('🍄 Загрузка последних тикетов');
      
      if (!window.makeAuthenticatedRequest) {
        this.loadRecentTicketsStub();
        return;
      }
      
      const response = await window.makeAuthenticatedRequest('/api/admin/tickets?limit=5&sort=created_desc');
      
      if (response.success && response.data) {
        this.updateRecentTicketsDisplay(response.data.tickets || []);
      } else {
        this.loadRecentTicketsStub();
      }
      
    } catch (error) {
      console.error('🍄 Ошибка загрузки тикетов:', error);
      this.loadRecentTicketsStub();
    }
  }
  
  /**
   * Заглушка для последних тикетов
   */
  loadRecentTicketsStub() {
    const stubTickets = [
      {
        ticketId: '#001',
        subject: 'Проблема подключения кошелька Xverse',
        status: 'open',
        priority: 'medium',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 часа назад
      },
      {
        ticketId: '#002',
        subject: 'Вопрос о токеномике SHROOMS',
        status: 'resolved',
        priority: 'low',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 день назад
      }
    ];
    
    this.updateRecentTicketsDisplay(stubTickets);
  }
  
  /**
   * Обновление отображения последних тикетов
   * @param {Array} tickets - Массив тикетов
   */
  updateRecentTicketsDisplay(tickets) {
    const tbody = document.querySelector('#recent-tickets-table tbody');
    if (!tbody) return;
    
    if (tickets.length === 0) {
      tbody.innerHTML = '<tr class="table-loading"><td colspan="6">🍄 Нет новых тикетов в мицелии</td></tr>';
      return;
    }
    
    tbody.innerHTML = tickets.map(ticket => `
      <tr>
        <td>${ticket.ticketId}</td>
        <td>${this.truncateText(ticket.subject, 50)}</td>
        <td><span class="status-badge status-${ticket.status}">${this.getStatusText(ticket.status)}</span></td>
        <td><span class="priority-badge priority-${ticket.priority}">${this.getPriorityText(ticket.priority)}</span></td>
        <td>${this.formatRelativeTime(ticket.createdAt)}</td>
        <td>
          <button class="btn btn-sm" onclick="window.location.href='tickets.html?id=${ticket.ticketId.replace('#', '')}'">
            Просмотр
          </button>
        </td>
      </tr>
    `).join('');
    
    console.log('🍄 Последние тикеты обновлены');
  }
  
  /**
   * Загрузка текущей доходности фарминга
   * @returns {Promise<void>}
   */
  async loadFarmingRate() {
    try {
      console.log('🍄 Загрузка доходности фарминга');
      
      if (!window.makeAuthenticatedRequest) {
        this.loadFarmingRateStub();
        return;
      }
      
      const response = await window.makeAuthenticatedRequest('/api/admin/farming-rate');
      
      if (response.success && response.data) {
        this.updateFarmingRateDisplay(response.data);
      } else {
        this.loadFarmingRateStub();
      }
      
    } catch (error) {
      console.error('🍄 Ошибка загрузки доходности фарминга:', error);
      this.loadFarmingRateStub();
    }
  }
  
  /**
   * Заглушка для доходности фарминга
   */
  loadFarmingRateStub() {
    const stubData = {
      rate: 12.5,
      lastUpdated: new Date().toISOString()
    };
    
    this.updateFarmingRateDisplay(stubData);
  }
  
  /**
   * Обновление отображения доходности фарминга
   * @param {FarmingRateData} data - Данные доходности
   */
  updateFarmingRateDisplay(data) {
    const rateInput = document.getElementById('farming-rate');
    const lastUpdatedElement = document.getElementById('farming-last-updated');
    
    if (rateInput) {
      rateInput.value = data.rate;
    }
    
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = this.formatRelativeTime(data.lastUpdated);
    }
    
    console.log('🍄 Доходность фарминга обновлена:', data.rate + '%');
  }
  
  /**
   * Обработчик обновления доходности фарминга
   * @param {Event} event - Событие формы
   */
  async handleFarmingRateUpdate(event) {
    event.preventDefault();
    
    const rateInput = document.getElementById('farming-rate');
    const rate = parseFloat(rateInput.value);
    
    if (isNaN(rate) || rate < 0 || rate > 100) {
      this.showNotification('error', '🍄 Пожалуйста, введите корректную доходность от 0 до 100%');
      return;
    }
    
    try {
      console.log('🍄 Обновление доходности фарминга до', rate + '%');
      
      // Блокируем кнопку на время обновления
      const submitBtn = event.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '🍄 Обновляем...';
      submitBtn.disabled = true;
      
      if (window.makeAuthenticatedRequest) {
        const response = await window.makeAuthenticatedRequest('/api/admin/farming-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate })
        });
        
        if (response.success) {
          // Обновляем время последнего изменения
          const lastUpdated = document.getElementById('farming-last-updated');
          if (lastUpdated) {
            lastUpdated.textContent = 'только что';
          }
          
          this.showNotification('success', `🍄 Доходность фарминга обновлена до ${rate}%`);
        } else {
          throw new Error(response.error?.message || 'Не удалось обновить доходность');
        }
      } else {
        // Заглушка для демонстрации
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const lastUpdated = document.getElementById('farming-last-updated');
        if (lastUpdated) {
          lastUpdated.textContent = 'только что';
        }
        
        this.showNotification('success', `🍄 Доходность фарминга обновлена до ${rate}%`);
      }
      
    } catch (error) {
      console.error('🍄 Ошибка обновления доходности:', error);
      this.showNotification('error', `🍄 Не удалось обновить доходность: ${error.message}`);
    } finally {
      // Восстанавливаем кнопку
      const submitBtn = event.target.querySelector('button[type="submit"]');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }
  
  /**
   * Загрузка данных для графиков
   * @returns {Promise<void>}
   */
  async loadChartData() {
    try {
      console.log('🍄 Загрузка данных для графиков');
      
      if (!window.makeAuthenticatedRequest) {
        this.loadChartDataStub();
        return;
      }
      
      const response = await window.makeAuthenticatedRequest(`/api/admin/analytics/charts?period=${this.dateRange}`);
      
      if (response.success && response.data) {
        this.updateChartsDisplay(response.data);
        this.cachedChartData = response.data;
      } else {
        this.loadChartDataStub();
      }
      
    } catch (error) {
      console.error('🍄 Ошибка загрузки данных для графиков:', error);
      this.loadChartDataStub();
    }
  }
  
  /**
   * Заглушка для данных графиков
   */
  loadChartDataStub() {
    const stubData = {
      conversationsChart: {
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        values: [12, 19, 23, 17, 25, 31, 42]
      },
      topicsChart: {
        labels: ['Кошельки', 'Токены', 'Фарминг', 'Техническая поддержка', 'Общие вопросы'],
        values: [35, 28, 20, 12, 5]
      }
    };
    
    this.updateChartsDisplay(stubData);
  }
  
  /**
   * Обновление отображения графиков
   * @param {Object} data - Данные для графиков
   */
  updateChartsDisplay(data) {
    // Простое текстовое представление вместо реальных графиков
    // В будущем можно интегрировать Chart.js или другую библиотеку
    
    const conversationsChart = document.getElementById('conversations-chart');
    const topicsChart = document.getElementById('topics-chart');
    
    if (conversationsChart && data.conversationsChart) {
      conversationsChart.innerHTML = this.createSimpleBarChart(data.conversationsChart);
    }
    
    if (topicsChart && data.topicsChart) {
      topicsChart.innerHTML = this.createSimplePieChart(data.topicsChart);
    }
    
    console.log('🍄 Графики обновлены');
  }
  
  /**
   * Создание простого гистограммы (текстовое представление)
   * @param {ChartData} data - Данные для графика
   * @returns {string} HTML для графика
   */
  createSimpleBarChart(data) {
    const maxValue = Math.max(...data.values);
    
    return `
      <div class="simple-chart">
        ${data.labels.map((label, index) => {
          const height = (data.values[index] / maxValue) * 100;
          return `
            <div class="chart-bar">
              <div class="bar" style="height: ${height}%; background: linear-gradient(45deg, var(--neon-green), var(--cyber-blue))"></div>
              <div class="bar-label">${label}</div>
              <div class="bar-value">${data.values[index]}</div>
            </div>
          `;
        }).join('')}
      </div>
      <style>
        .simple-chart { display: flex; gap: 1rem; align-items: end; height: 200px; padding: 1rem; }
        .chart-bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .bar { width: 100%; border-radius: 4px; min-height: 20px; transition: height 0.5s ease; }
        .bar-label { font-size: 0.8rem; color: var(--text-light); }
        .bar-value { font-weight: bold; color: var(--neon-green); }
      </style>
    `;
  }
  
  /**
   * Создание простой круговой диаграммы (текстовое представление)
   * @param {ChartData} data - Данные для графика
   * @returns {string} HTML для графика
   */
  createSimplePieChart(data) {
    const total = data.values.reduce((sum, value) => sum + value, 0);
    
    return `
      <div class="simple-pie-chart">
        ${data.labels.map((label, index) => {
          const percentage = ((data.values[index] / total) * 100).toFixed(1);
          return `
            <div class="pie-item">
              <div class="pie-indicator" style="background: hsl(${index * 70}, 70%, 60%)"></div>
              <span class="pie-label">${label}</span>
              <span class="pie-value">${percentage}%</span>
            </div>
          `;
        }).join('')}
      </div>
      <style>
        .simple-pie-chart { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
        .pie-item { display: flex; align-items: center; gap: 1rem; }
        .pie-indicator { width: 16px; height: 16px; border-radius: 50%; }
        .pie-label { flex: 1; color: var(--text-light); }
        .pie-value { font-weight: bold; color: var(--neon-green); }
      </style>
    `;
  }
  
  /**
   * Запуск периодического обновления данных
   */
  startPeriodicRefresh() {
    // Обновляем статистику каждые 5 минут
    this.statsRefreshInterval = setInterval(() => {
      console.log('🍄 Периодическое обновление статистики');
      this.loadStats();
      this.loadRecentTickets();
    }, 5 * 60 * 1000);
    
    console.log('🍄 Периодическое обновление запущено');
  }
  
  /**
   * Остановка периодического обновления
   */
  stopPeriodicRefresh() {
    if (this.statsRefreshInterval) {
      clearInterval(this.statsRefreshInterval);
      this.statsRefreshInterval = null;
      console.log('🍄 Периодическое обновление остановлено');
    }
  }
  
  /**
   * Полное обновление всех данных
   * @returns {Promise<void>}
   */
  async refreshAllData() {
    console.log('🍄 Полное обновление всех данных дашборда');
    
    try {
      // Показываем индикатор загрузки
      this.showLoadingState(true);
      
      await this.loadInitialData();
      
      this.showNotification('success', '🍄 Все данные успешно обновлены');
      
    } catch (error) {
      console.error('🍄 Ошибка при полном обновлении:', error);
      this.showNotification('error', '🍄 Не удалось обновить все данные');
    } finally {
      this.showLoadingState(false);
    }
  }
  
  /**
   * Показ/скрытие состояния загрузки
   * @param {boolean} loading - Показать ли загрузку
   */
  showLoadingState(loading) {
    const statsCards = document.querySelectorAll('.stat-card');
    const charts = document.querySelectorAll('.chart-container');
    
    [...statsCards, ...charts].forEach(element => {
      if (loading) {
        element.classList.add('loading');
      } else {
        element.classList.remove('loading');
      }
    });
  }
  
  /**
   * Инициализация грибной матрицы (фоновая анимация)
   */
  initMushroomMatrix() {
    if (typeof window.initMushroomMatrix === 'function') {
      // Тонкая версия для дашборда
      window.initMushroomMatrix(true);
      console.log('🍄 Грибная матрица инициализирована в тонком режиме');
    } else {
      console.log('🍄 Функция initMushroomMatrix не найдена');
    }
  }
  
  /**
   * Показ уведомления
   * @param {string} type - Тип уведомления (success, error, warning, info)
   * @param {string} message - Текст сообщения
   */
  showNotification(type, message) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(type, message);
    } else {
      // Fallback
      console.log(`🍄 ${type.toUpperCase()}: ${message}`);
      alert(message);
    }
  }
  
  /**
   * Утилита: обрезка текста
   * @param {string} text - Исходный текст
   * @param {number} maxLength - Максимальная длина
   * @returns {string} Обрезанный текст
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  /**
   * Утилита: получение текста статуса
   * @param {string} status - Код статуса
   * @returns {string} Текст статуса
   */
  getStatusText(status) {
    const statusMap = {
      'open': 'Открыт',
      'in_progress': 'В работе',
      'resolved': 'Решен',
      'closed': 'Закрыт'
    };
    return statusMap[status] || status;
  }
  
  /**
   * Утилита: получение текста приоритета
   * @param {string} priority - Код приоритета
   * @returns {string} Текст приоритета
   */
  getPriorityText(priority) {
    const priorityMap = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий',
      'urgent': 'Срочный'
    };
    return priorityMap[priority] || priority;
  }
  
  /**
   * Утилита: форматирование относительного времени
   * @param {string} dateString - Строка даты ISO
   * @returns {string} Относительное время
   */
  formatRelativeTime(dateString) {
    if (!dateString) return '--';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return diffMins <= 1 ? 'только что' : `${diffMins} мин назад`;
    } else if (diffHours < 24) {
      return `${diffHours} ч назад`;
    } else if (diffDays < 30) {
      return `${diffDays} дн назад`;
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  }
  
  /**
   * Очистка ресурсов при уничтожении
   */
  destroy() {
    this.stopPeriodicRefresh();
    this.isInitialized = false;
    console.log('🍄 Дашборд уничтожен');
  }
}

// Глобальная переменная для доступа к дашборду
let shroomsDashboard = null;

/**
 * Инициализация дашборда (вызывается из HTML)
 * @returns {Promise<void>}
 */
async function initDashboard() {
  try {
    console.log('🍄 Запуск инициализации дашборда из глобальной функции');
    
    if (shroomsDashboard) {
      console.log('🍄 Дашборд уже инициализирован');
      return;
    }
    
    shroomsDashboard = new ShroomsDashboard();
    await shroomsDashboard.init();
    
    // Делаем дашборд доступным глобально для отладки
    window.shroomsDashboard = shroomsDashboard;
    
  } catch (error) {
    console.error('🍄 Критическая ошибка инициализации дашборда:', error);
  }
}

// Автоматическая инициализация при загрузке страницы (если еще не инициализирован)
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем, что мы на странице дашборда
  if (document.getElementById('recent-tickets-table') && !shroomsDashboard) {
    console.log('🍄 Автоматическая инициализация дашборда');
    
    // Небольшая задержка для загрузки auth.js
    setTimeout(initDashboard, 100);
  }
});

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
  if (shroomsDashboard) {
    shroomsDashboard.destroy();
  }
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShroomsDashboard, initDashboard };
}