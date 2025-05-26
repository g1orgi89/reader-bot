/**
 * tickets.js - управление тикетами поддержки Shrooms AI Support Bot
 * Следует паттернам аутентификации из knowledge.js и auth.js
 * 
 * @fileoverview Управление грибными обращениями и спорами поддержки
 * @author Shrooms Development Team
 */

// КОНФИГУРАЦИЯ
const TICKETS_CONFIG = {
  API_BASE: '/api/tickets',
  DEFAULT_PAGE_SIZE: 10,
  
  STATUS_LABELS: {
    'open': 'Открыт',
    'in_progress': 'В работе', 
    'resolved': 'Решен',
    'closed': 'Закрыт'
  },
  
  PRIORITY_LABELS: {
    'low': 'Низкий',
    'medium': 'Средний',
    'high': 'Высокий', 
    'urgent': 'Срочный'
  },
  
  CATEGORY_LABELS: {
    'technical': 'Техническая',
    'account': 'Аккаунт',
    'billing': 'Оплата',
    'feature': 'Функция',
    'other': 'Другое'
  }
};

// СОСТОЯНИЕ ТИКЕТОВ
const ticketsState = {
  tickets: [],
  currentFilters: {
    status: 'open',
    priority: 'all',
    search: '',
    page: 1,
    limit: TICKETS_CONFIG.DEFAULT_PAGE_SIZE
  },
  totalTickets: 0,
  isLoading: false,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  }
};

/**
 * @typedef {Object} TicketData
 * @property {string} _id - MongoDB ObjectId
 * @property {string} ticketId - Человеко-читаемый ID тикета
 * @property {string} subject - Тема тикета
 * @property {string} status - Статус тикета
 * @property {string} priority - Приоритет тикета
 * @property {string} category - Категория тикета
 * @property {string} userId - ID пользователя
 * @property {string} initialMessage - Первоначальное сообщение
 * @property {string} context - JSON строка с контекстом диалога
 * @property {string} createdAt - Дата создания
 * @property {string} updatedAt - Дата обновления
 * @property {string} [email] - Email пользователя
 * @property {string} [assignedTo] - Назначен кому
 * @property {string} [resolution] - Резолюция
 * @property {string} language - Язык тикета
 */

/**
 * @typedef {Object} TicketsResponse
 * @property {boolean} success - Успешность запроса
 * @property {Object} data - Данные ответа
 * @property {TicketData[]} data.tickets - Массив тикетов
 * @property {Object} data.pagination - Информация о пагинации
 * @property {number} data.pagination.totalCount - Общее количество тикетов
 * @property {number} data.pagination.currentPage - Текущая страница
 * @property {number} data.pagination.totalPages - Всего страниц
 * @property {boolean} data.pagination.hasNextPage - Есть ли следующая страница
 * @property {boolean} data.pagination.hasPrevPage - Есть ли предыдущая страница
 */

/**
 * Загружает реальные тикеты из API (заменяет loadBasicTickets)
 * Использует makeAuthenticatedRequest() из auth.js
 * @returns {Promise<void>}
 */
async function loadRealTickets() {
  if (ticketsState.isLoading) return;
  
  console.log('🍄 Загрузка реальных тикетов из API...');
  
  try {
    ticketsState.isLoading = true;
    updateLoadingState(true);
    
    // Формируем параметры запроса
    const params = new URLSearchParams();
    
    if (ticketsState.currentFilters.status !== 'all') {
      params.append('status', ticketsState.currentFilters.status);
    }
    
    if (ticketsState.currentFilters.priority !== 'all') {
      params.append('priority', ticketsState.currentFilters.priority);
    }
    
    if (ticketsState.currentFilters.search) {
      params.append('search', ticketsState.currentFilters.search);
    }
    
    params.append('page', ticketsState.currentFilters.page.toString());
    params.append('limit', ticketsState.currentFilters.limit.toString());
    
    // API запрос через аутентификацию (используем функцию из auth.js)
    const response = await makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}?${params}`);
    
    if (response.success) {
      // Используем точную структуру из curl результата
      ticketsState.tickets = response.data.tickets || [];
      ticketsState.totalTickets = response.data.pagination?.totalCount || 0;
      
      // Обновляем информацию о пагинации
      ticketsState.pagination = {
        currentPage: response.data.pagination?.currentPage || 1,
        totalPages: response.data.pagination?.totalPages || 1,
        hasNextPage: response.data.pagination?.hasNextPage || false,
        hasPrevPage: response.data.pagination?.hasPrevPage || false
      };
      
      renderRealTicketsTable();
      updatePaginationInfo();
      
      console.log(`🍄 Загружено ${ticketsState.tickets.length} тикетов из ${ticketsState.totalTickets}`);
    } else {
      throw new Error(response.error?.message || 'Не удалось загрузить тикеты');
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки тикетов:', error);
    showNotification('error', `🍄 Не удалось загрузить тикеты: ${error.message}`);
    renderEmptyTicketsTable();
  } finally {
    ticketsState.isLoading = false;
    updateLoadingState(false);
  }
}

/**
 * Отображает состояние загрузки
 * @param {boolean} isLoading - Состояние загрузки
 */
function updateLoadingState(isLoading) {
  const tbody = document.querySelector('#tickets-table tbody');
  if (!tbody) return;
  
  if (isLoading) {
    tbody.innerHTML = `
      <tr class="table-loading">
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--neon-green);">
          🍄 Прорастание обращений...
        </td>
      </tr>
    `;
  }
}

/**
 * Отображает таблицу с реальными тикетами
 */
function renderRealTicketsTable() {
  const tbody = document.querySelector('#tickets-table tbody');
  if (!tbody) return;
  
  if (ticketsState.tickets.length === 0) {
    renderEmptyTicketsTable();
    return;
  }
  
  tbody.innerHTML = ticketsState.tickets.map(ticket => `
    <tr onclick="showRealTicketDetail('${ticket.ticketId}')" style="cursor: pointer;">
      <td class="col-id" title="${ticket.ticketId}">${ticket.ticketId.substring(0, 12)}...</td>
      <td class="col-subject" title="${escapeHtml(ticket.subject)}">${escapeHtml(ticket.subject.substring(0, 50))}${ticket.subject.length > 50 ? '...' : ''}</td>
      <td class="col-status">
        <span class="status-badge status-${ticket.status}">
          ${TICKETS_CONFIG.STATUS_LABELS[ticket.status] || ticket.status}
        </span>
      </td>
      <td class="col-priority">
        <span class="priority-badge priority-${ticket.priority}">
          ${TICKETS_CONFIG.PRIORITY_LABELS[ticket.priority] || ticket.priority}
        </span>
      </td>
      <td class="col-user" title="${ticket.userId}">${ticket.userId.substring(0, 12)}...</td>
      <td class="col-created">${formatRelativeTime(ticket.createdAt)}</td>
      <td class="col-updated">${formatRelativeTime(ticket.updatedAt)}</td>
      <td class="col-actions">
        <button class="btn btn-sm" onclick="showRealTicketDetail('${ticket.ticketId}'); event.stopPropagation();" title="Просмотр тикета">
          👁️ Просмотр
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Отображает пустую таблицу
 */
function renderEmptyTicketsTable() {
  const tbody = document.querySelector('#tickets-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr class="table-empty">
      <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-light);">
        🍄 В грибнице пока тихо - тикетов не найдено
      </td>
    </tr>
  `;
}

/**
 * Обновляет информацию о пагинации в HTML (соответствие существующим элементам)
 */
function updatePaginationInfo() {
  // Обновляем диапазон показанных записей
  const rangeElement = document.getElementById('pagination-range');
  if (rangeElement) {
    const start = ticketsState.tickets.length > 0 ? 
                  (ticketsState.pagination.currentPage - 1) * ticketsState.currentFilters.limit + 1 : 0;
    const end = Math.min(start + ticketsState.tickets.length - 1, ticketsState.totalTickets);
    rangeElement.textContent = `${start}-${end}`;
  }
  
  // Обновляем общее количество
  const totalElement = document.getElementById('pagination-total');
  if (totalElement) {
    totalElement.textContent = ticketsState.totalTickets.toString();
  }
  
  // Обновляем текущую страницу
  const currentElement = document.getElementById('pagination-current');
  if (currentElement) {
    currentElement.textContent = `Страница ${ticketsState.pagination.currentPage}`;
  }
  
  // Обновляем кнопки пагинации (используем существующие ID из HTML)
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  if (prevBtn) {
    prevBtn.disabled = !ticketsState.pagination.hasPrevPage;
  }
  
  if (nextBtn) {
    nextBtn.disabled = !ticketsState.pagination.hasNextPage;
  }
}

/**
 * Показывает детальную информацию о тикете
 * Заменяет заглушку showTicketDetail()
 * @param {string} ticketId - ID тикета для отображения
 */
async function showRealTicketDetail(ticketId) {
  console.log('🍄 Открытие тикета:', ticketId);
  
  try {
    // Находим тикет в загруженных данных
    const ticket = ticketsState.tickets.find(t => t.ticketId === ticketId);
    if (!ticket) {
      showNotification('error', '🍄 Тикет не найден в текущем списке');
      return;
    }
    
    // Заполняем модальное окно (используем существующие ID элементы из HTML)
    const detailElements = {
      'detail-ticket-id': ticket.ticketId,
      'detail-ticket-subject': ticket.subject,
      'detail-ticket-user': ticket.userId,
      'detail-ticket-created': formatDateTime(ticket.createdAt),
      'detail-ticket-updated': formatDateTime(ticket.updatedAt),
      'detail-ticket-message': ticket.initialMessage || 'Сообщение не указано'
    };
    
    // Заполняем текстовые поля
    Object.entries(detailElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
    
    // Устанавливаем значения селектов
    const statusSelect = document.getElementById('detail-ticket-status');
    const prioritySelect = document.getElementById('detail-ticket-priority');
    
    if (statusSelect) statusSelect.value = ticket.status;
    if (prioritySelect) prioritySelect.value = ticket.priority;
    
    // Парсим и отображаем контекст диалога
    if (ticket.context) {
      try {
        const context = JSON.parse(ticket.context);
        displayConversationContext(context);
      } catch (e) {
        console.warn('🍄 Ошибка парсинга контекста:', e);
        const contextContainer = document.getElementById('detail-ticket-conversation');
        if (contextContainer) {
          contextContainer.textContent = 'Контекст диалога недоступен (ошибка формата)';
        }
      }
    } else {
      const contextContainer = document.getElementById('detail-ticket-conversation');
      if (contextContainer) {
        contextContainer.textContent = 'Контекст диалога отсутствует';
      }
    }
    
    // Показываем модальное окно (используем существующий HTML)
    const overlay = document.getElementById('ticket-detail-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      // Сохраняем ID тикета для операций (используем MongoDB _id)
      overlay.dataset.currentTicketId = ticket._id;
      overlay.dataset.currentTicketDisplayId = ticket.ticketId;
    }
  } catch (error) {
    console.error('🍄 Ошибка отображения тикета:', error);
    showNotification('error', `🍄 Ошибка отображения тикета: ${error.message}`);
  }
}

/**
 * Отображает контекст диалога с ботом
 * @param {Object} context - Контекст диалога
 */
function displayConversationContext(context) {
  const container = document.getElementById('detail-ticket-conversation');
  if (!container) return;
  
  let conversationHtml = '';
  
  if (context.userMessage) {
    conversationHtml += `
      <div class="conversation-message user-message" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--card-bg); border-left: 3px solid var(--neon-pink);">
        <strong style="color: var(--neon-pink);">👤 Пользователь:</strong><br>
        <span style="color: var(--text-light);">${escapeHtml(context.userMessage)}</span>
      </div>
    `;
  }
  
  if (context.aiResponse) {
    conversationHtml += `
      <div class="conversation-message bot-message" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--card-bg); border-left: 3px solid var(--neon-green);">
        <strong style="color: var(--neon-green);">🍄 Бот:</strong><br>
        <span style="color: var(--text-light);">${escapeHtml(context.aiResponse)}</span>
      </div>
    `;
  }
  
  if (context.aiProvider || context.ragUsed !== undefined) {
    conversationHtml += `
      <div class="conversation-meta" style="font-size: 0.8rem; color: var(--text-light); padding: 0.5rem; background: rgba(255,255,255,0.05);">
        ${context.aiProvider ? `Модель: ${context.aiProvider}` : ''}
        ${context.ragUsed !== undefined ? ` | RAG: ${context.ragUsed ? 'Да' : 'Нет'}` : ''}
        ${context.tokensUsed ? ` | Токенов: ${context.tokensUsed}` : ''}
      </div>
    `;
  }
  
  container.innerHTML = conversationHtml || '<div style="color: var(--text-light); font-style: italic;">Контекст диалога пуст</div>';
}

/**
 * Удаляет тикет (заменяет заглушку)
 * @param {string} ticketId - ID тикета для удаления
 */
async function deleteRealTicket(ticketId) {
  const ticket = ticketsState.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) {
    showNotification('error', '🍄 Тикет не найден');
    return;
  }
  
  const confirmed = confirm(`🍄 Удалить тикет ${ticketId}?\n\nТема: ${ticket.subject}\n\nЭто действие нельзя отменить!`);
  if (!confirmed) return;
  
  try {
    console.log('🍄 Удаление тикета:', ticket._id);
    
    const response = await makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${ticket._id}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showNotification('success', '🍄 Тикет успешно удален из грибницы');
      
      // Закрываем модальное окно если открыто
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay) overlay.style.display = 'none';
      
      // Перезагружаем список
      await loadRealTickets();
    } else {
      throw new Error(response.error?.message || 'Не удалось удалить тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка удаления тикета:', error);
    showNotification('error', `🍄 Не удалось удалить тикет: ${error.message}`);
  }
}

/**
 * Обновляет тикет
 * @param {string} ticketId - MongoDB ObjectId тикета
 * @param {Object} updateData - Данные для обновления
 */
async function updateRealTicket(ticketId, updateData) {
  try {
    console.log('🍄 Обновление тикета:', ticketId, updateData);
    
    const response = await makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.success) {
      showNotification('success', '🍄 Тикет обновлен');
      await loadRealTickets();
    } else {
      throw new Error(response.error?.message || 'Не удалось обновить тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка обновления тикета:', error);
    showNotification('error', `🍄 Ошибка обновления: ${error.message}`);
  }
}

/**
 * Сохраняет изменения тикета из модального окна
 */
async function saveTicketChanges() {
  const overlay = document.getElementById('ticket-detail-overlay');
  if (!overlay || !overlay.dataset.currentTicketId) return;
  
  const ticketId = overlay.dataset.currentTicketId;
  const statusSelect = document.getElementById('detail-ticket-status');
  const prioritySelect = document.getElementById('detail-ticket-priority');
  
  if (!statusSelect || !prioritySelect) {
    showNotification('error', '🍄 Не найдены элементы формы');
    return;
  }
  
  const updateData = {
    status: statusSelect.value,
    priority: prioritySelect.value
  };
  
  await updateRealTicket(ticketId, updateData);
}

/**
 * Инициализация страницы тикетов
 * Заменяет существующие заглушки на реальные функции
 */
function initRealTicketsPage() {
  console.log('🍄 Инициализация реальной системы тикетов');
  
  // ВАЖНО: Заменяем заглушки на реальные функции
  window.loadBasicTickets = loadRealTickets;
  window.showTicketDetail = showRealTicketDetail;
  window.deleteTicket = deleteRealTicket;
  window.saveTicketChanges = saveTicketChanges;
  
  // Используем существующие обработчики фильтров из HTML
  setupRealTicketFilters();
  setupPaginationControls();
  setupModalEventHandlers();
  
  // Загружаем данные
  loadRealTickets();
}

/**
 * Настройка фильтров (интеграция с существующими элементами)
 */
function setupRealTicketFilters() {
  const statusFilter = document.getElementById('status-filter');
  const priorityFilter = document.getElementById('priority-filter');
  const searchInput = document.getElementById('search-tickets');
  const refreshBtn = document.getElementById('refresh-tickets');
  
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      ticketsState.currentFilters.status = statusFilter.value;
      ticketsState.currentFilters.page = 1;
      loadRealTickets();
    });
  }
  
  if (priorityFilter) {
    priorityFilter.addEventListener('change', () => {
      ticketsState.currentFilters.priority = priorityFilter.value;
      ticketsState.currentFilters.page = 1;
      loadRealTickets();
    });
  }
  
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        ticketsState.currentFilters.search = searchInput.value.trim();
        ticketsState.currentFilters.page = 1;
        loadRealTickets();
      }, 500); // Debounce 500ms
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('🍄 Принудительное обновление списка тикетов');
      loadRealTickets();
    });
  }
}

/**
 * Настройка управления пагинацией
 */
function setupPaginationControls() {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (ticketsState.pagination.hasPrevPage) {
        ticketsState.currentFilters.page--;
        loadRealTickets();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (ticketsState.pagination.hasNextPage) {
        ticketsState.currentFilters.page++;
        loadRealTickets();
      }
    });
  }
}

/**
 * Настройка обработчиков событий модального окна
 */
function setupModalEventHandlers() {
  // Кнопка закрытия модального окна
  const closeDetailBtn = document.getElementById('close-ticket-detail');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', closeTicketDetail);
  }
  
  // Кнопка сохранения изменений
  const saveBtn = document.getElementById('save-ticket');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTicketChanges);
  }
  
  // Кнопка удаления тикета
  const deleteBtn = document.getElementById('delete-ticket');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay && overlay.dataset.currentTicketDisplayId) {
        deleteRealTicket(overlay.dataset.currentTicketDisplayId);
      }
    });
  }
  
  // Кнопка решения тикета
  const resolveBtn = document.getElementById('resolve-ticket');
  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay && overlay.dataset.currentTicketId) {
        updateRealTicket(overlay.dataset.currentTicketId, { status: 'resolved' });
      }
    });
  }
}

/**
 * Закрывает модальное окно детального просмотра
 */
function closeTicketDetail() {
  const overlay = document.getElementById('ticket-detail-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    // Очищаем сохраненные ID
    delete overlay.dataset.currentTicketId;
    delete overlay.dataset.currentTicketDisplayId;
  }
}

/**
 * Экранирует HTML в строке
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Форматирует дату в относительном формате
 * @param {string} dateString - Дата в ISO формате
 * @returns {string} Отформатированная дата
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU');
  } catch (error) {
    return 'неверная дата';
  }
}

/**
 * Форматирует дату в полном формате
 * @param {string} dateString - Дата в ISO формате
 * @returns {string} Отформатированная дата и время
 */
function formatDateTime(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'неверная дата';
  }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем, что мы на странице тикетов
  if (document.getElementById('tickets-table')) {
    initRealTicketsPage();
  }
});

// Экспорт функций для глобального использования
window.loadRealTickets = loadRealTickets;
window.showRealTicketDetail = showRealTicketDetail;
window.deleteRealTicket = deleteRealTicket;
window.updateRealTicket = updateRealTicket;
window.saveTicketChanges = saveTicketChanges;
window.closeTicketDetail = closeTicketDetail;
window.initRealTicketsPage = initRealTicketsPage;