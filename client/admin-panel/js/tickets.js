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
    
    // Проверяем наличие функции аутентификации
    if (typeof window.makeAuthenticatedRequest !== 'function') {
      console.error('🍄 makeAuthenticatedRequest не найдена');
      renderMockTicketsTable();
      return;
    }
    
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
    const response = await window.makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}?${params}`);
    
    // Проверяем структуру ответа
    if (response && response.success) {
      // Используем точную структуру из curl результата
      ticketsState.tickets = response.data?.tickets || [];
      ticketsState.totalTickets = response.data?.pagination?.totalCount || 0;
      
      // Обновляем информацию о пагинации
      ticketsState.pagination = {
        currentPage: response.data?.pagination?.currentPage || 1,
        totalPages: response.data?.pagination?.totalPages || 1,
        hasNextPage: response.data?.pagination?.hasNextPage || false,
        hasPrevPage: response.data?.pagination?.hasPrevPage || false
      };
      
      renderRealTicketsTable();
      updatePaginationInfo();
      
      console.log(`🍄 Загружено ${ticketsState.tickets.length} тикетов из ${ticketsState.totalTickets}`);
    } else {
      // Проверяем тип ошибки - если это объект response
      const isAuthError = response && (
        (response.error && response.error.status === 401) ||
        (response.status === 401) ||
        (typeof response.error === 'string' && response.error.includes('401'))
      );
      
      if (isAuthError) {
        console.log('🍄 Ошибка авторизации (401), показываем заглушку тикетов');
        renderMockTicketsTable();
      } else {
        console.log('🍄 API ответил неуспешно, показываем заглушку тикетов');
        renderMockTicketsTable();
      }
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки тикетов:', error);
    
    // ИСПРАВЛЕНО: Безопасная обработка всех типов ошибок
    let isAuthError = false;
    
    // Проверяем разные варианты ошибок аутентификации
    if (error && error.message) {
      const errorMessage = error.message.toString();
      isAuthError = errorMessage.includes('401') || 
                   errorMessage.includes('Unauthorized') || 
                   errorMessage.includes('Authentication required') ||
                   errorMessage.includes('token') ||
                   errorMessage.includes('авторизац');
    } else if (error && typeof error === 'string') {
      isAuthError = error.includes('401') || 
                   error.includes('Unauthorized') || 
                   error.includes('Authentication required');
    }
    
    if (isAuthError) {
      console.log('🍄 Ошибка авторизации, показываем заглушку тикетов');
    } else {
      console.log('🍄 Другая ошибка, показываем заглушку тикетов');
    }
    
    // В любом случае показываем заглушку
    renderMockTicketsTable();
  } finally {
    ticketsState.isLoading = false;
    updateLoadingState(false);
  }
}

/**
 * Отображает заглушку тикетов при ошибке авторизации
 */
function renderMockTicketsTable() {
  console.log('🍄 Отображаем заглушку тикетов');
  
  const mockTickets = [
    {
      ticketId: 'SHRM001',
      subject: 'Проблема подключения кошелька Xverse',
      status: 'open',
      priority: 'medium',
      userId: 'user_123...abc',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      ticketId: 'SHRM002',
      subject: 'Вопрос о токеномике SHROOMS',
      status: 'resolved',
      priority: 'low',
      userId: 'user_456...def',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    },
    {
      ticketId: 'SHRM003',
      subject: 'Ошибка при фарминге токенов',
      status: 'in_progress',
      priority: 'high',
      userId: 'user_789...ghi',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ];

  const tbody = document.querySelector('#tickets-table tbody');
  if (!tbody) return;

  tbody.innerHTML = mockTickets.map(ticket => `
    <tr onclick="showMockTicketDetail('${ticket.ticketId}')" style="cursor: pointer;">
      <td class="col-id">${formatTicketIdForTable(ticket.ticketId)}</td>
      <td class="col-subject">${escapeHtml(ticket.subject)}</td>
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
      <td class="col-user">${ticket.userId}</td>
      <td class="col-created">${formatRelativeTime(ticket.createdAt)}</td>
      <td class="col-updated">${formatRelativeTime(ticket.updatedAt)}</td>
      <td class="col-actions">
        <div class="table-action-buttons">
          <button class="btn-table-action btn-table-view" onclick="showMockTicketDetail('${ticket.ticketId}'); event.stopPropagation();">
            👁️ Просмотр
          </button>
          <button class="btn-table-action btn-table-delete" onclick="quickDeleteTicket('${ticket.ticketId}'); event.stopPropagation();" title="Удалить тикет">
            🗑️ Удалить
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Обновляем информацию о пагинации для заглушки
  const rangeElement = document.getElementById('pagination-range');
  const totalElement = document.getElementById('pagination-total');
  const currentElement = document.getElementById('pagination-current');

  if (rangeElement) rangeElement.textContent = '1-3';
  if (totalElement) totalElement.textContent = '3';
  if (currentElement) currentElement.textContent = 'Страница 1';
}

/**
 * Форматирует ID тикета для отображения в таблице
 * Приоритет 2: показать 16-20 символов + кнопка копирования
 * @param {string} ticketId - Полный ID тикета
 * @returns {string} HTML код для отображения ID
 */
function formatTicketIdForTable(ticketId) {
  if (!ticketId) return '';
  
  // Показываем до 18 символов (компромисс между 16-20)
  const displayId = ticketId.length > 18 ? ticketId.substring(0, 18) + '...' : ticketId;
  
  return `
    <div class="ticket-id-cell" title="${escapeHtml(ticketId)}">
      <span class="ticket-id-short">${escapeHtml(displayId)}</span>
      <button class="btn-copy-mini" onclick="copyTicketId('${escapeHtml(ticketId)}'); event.stopPropagation();" title="Копировать полный ID">
        📋
      </button>
    </div>
  `;
}

/**
 * Копирует ID тикета в буфер обмена
 * @param {string} ticketId - ID тикета для копирования
 */
async function copyTicketId(ticketId) {
  try {
    await navigator.clipboard.writeText(ticketId);
    console.log('🍄 ID тикета скопирован:', ticketId);
    
    // Показываем уведомление
    showNotification('📋 ID тикета скопирован в буфер обмена', 'success');
  } catch (error) {
    console.error('🍄 Ошибка копирования:', error);
    
    // Fallback для старых браузеров
    const textArea = document.createElement('textarea');
    textArea.value = ticketId;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification('📋 ID тикета скопирован в буфер обмена', 'success');
    } catch (fallbackError) {
      showNotification('❌ Не удалось скопировать ID', 'error');
    }
    document.body.removeChild(textArea);
  }
}

/**
 * Показывает уведомление пользователю
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
  // Ищем существующий контейнер уведомлений
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Удаляем уведомление через 3 секунды
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

/**
 * Быстрое удаление тикета из таблицы с подтверждением
 * @param {string} ticketId - ID тикета для удаления
 */
function quickDeleteTicket(ticketId) {
  if (confirm(`🗑️ Удалить тикет ${ticketId} навсегда?\n\nЭто действие нельзя будет отменить!`)) {
    console.log('🍄 Быстрое удаление тикета:', ticketId);
    showNotification('🗑️ Тикет удален из списка', 'info');
    
    // Для mock данных просто перезагружаем таблицу
    // В реальном API здесь будет вызов deleteRealTicketForever()
    setTimeout(() => {
      loadRealTickets();
    }, 500);
  }
}

/**
 * Показывает детали заглушки тикета
 * @param {string} ticketId - ID тикета
 */
function showMockTicketDetail(ticketId) {
  console.log('🍄 Показ заглушки тикета:', ticketId);
  
  // Заполняем модальное окно заглушкой
  const detailElements = {
    'detail-ticket-id': ticketId,
    'detail-ticket-subject': 'Проблема подключения кошелька Xverse',
    'detail-ticket-user': 'user_123...abc',
    'detail-ticket-created': new Date().toLocaleString('ru-RU'),
    'detail-ticket-updated': new Date().toLocaleString('ru-RU'),
    'detail-ticket-message': 'Привет! У меня не получается подключить кошелек Xverse к платформе. Выдает ошибку при попытке подключения. Помогите пожалуйста!'
  };
  
  Object.entries(detailElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
  
  // Устанавливаем значения селектов
  const statusSelect = document.getElementById('detail-ticket-status');
  const prioritySelect = document.getElementById('detail-ticket-priority');
  
  if (statusSelect) statusSelect.value = 'open';
  if (prioritySelect) prioritySelect.value = 'medium';
  
  // Показываем контекст диалога
  const contextContainer = document.getElementById('detail-ticket-conversation');
  if (contextContainer) {
    contextContainer.innerHTML = `
      <div class="conversation-message user-message" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--card-bg); border-left: 3px solid var(--neon-pink);">
        <strong style="color: var(--neon-pink);">👤 Пользователь:</strong><br>
        <span style="color: var(--text-light);">Привет! У меня не получается подключить кошелек Xverse</span>
      </div>
      <div class="conversation-message bot-message" style="margin-bottom: 1rem; padding: 0.5rem; background: var(--card-bg); border-left: 3px solid var(--neon-green);">
        <strong style="color: var(--neon-green);">🍄 Бот:</strong><br>
        <span style="color: var(--text-light);">Привет, исследователь цифровых лесов! Помогу подключить корзинку к нашему мицелию...</span>
      </div>
    `;
  }
  
  // Показываем модальное окно
  const overlay = document.getElementById('ticket-detail-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.dataset.currentTicketId = 'mock';
    overlay.dataset.currentTicketDisplayId = ticketId;
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
      <td class="col-id">${formatTicketIdForTable(ticket.ticketId)}</td>
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
        <div class="table-action-buttons">
          <button class="btn-table-action btn-table-view" onclick="showRealTicketDetail('${ticket.ticketId}'); event.stopPropagation();" title="Просмотр тикета">
            👁️ Просмотр
          </button>
          <button class="btn-table-action btn-table-delete" onclick="quickDeleteRealTicket('${ticket._id}', '${ticket.ticketId}'); event.stopPropagation();" title="Удалить тикет">
            🗑️ Удалить
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Быстрое удаление реального тикета из таблицы
 * @param {string} mongoId - MongoDB ObjectId тикета
 * @param {string} displayId - Человеко-читаемый ID для отображения
 */
async function quickDeleteRealTicket(mongoId, displayId) {
  if (!confirm(`🗑️ Удалить тикет ${displayId} навсегда?\n\nЭто действие нельзя будет отменить!`)) {
    return;
  }
  
  try {
    console.log('🍄 Быстрое удаление реального тикета:', mongoId);
    
    const response = await window.makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${mongoId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showNotification('🗑️ Тикет удален навсегда', 'success');
      await loadRealTickets(); // Перезагружаем список
    } else {
      throw new Error(response.error?.message || 'Не удалось удалить тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка быстрого удаления тикета:', error);
    showNotification('❌ Ошибка удаления тикета', 'error');
  }
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
      console.error('🍄 Тикет не найден в текущем списке');
      return;
    }
    
    // Заполняем модальное окно (используем существующие ID элементы из HTML)
    const detailElements = {
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
    
    // Приоритет 2: Полный ID тикета + удобное копирование
    const ticketIdElement = document.getElementById('detail-ticket-id');
    if (ticketIdElement) {
      ticketIdElement.textContent = ticket.ticketId;
    }
    
    // Кнопка копирования ID
    const copyIdBtn = document.getElementById('copy-ticket-id');
    if (copyIdBtn) {
      copyIdBtn.onclick = () => copyTicketId(ticket.ticketId);
    }
    
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
 * Приоритет 1: Закрывает тикет с резолюцией (заменяет удаление)
 * @param {string} ticketId - MongoDB ObjectId тикета
 * @param {string} resolution - Причина закрытия (опционально)
 */
async function closeRealTicket(ticketId, resolution = '') {
  if (!ticketId) {
    console.error('🍄 ID тикета не указан');
    return;
  }
  
  try {
    console.log('🍄 Закрытие тикета:', ticketId);
    
    const updateData = {
      status: 'closed'
    };
    
    if (resolution && resolution.trim()) {
      updateData.resolution = resolution.trim();
    }
    
    const response = await window.makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.success) {
      console.log('🍄 Тикет успешно закрыт');
      showNotification('🔒 Обращение закрыто', 'success');
      
      // Закрываем модальное окно
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay) overlay.style.display = 'none';
      
      // Скрываем предупреждение
      hideCloseWarning();
      
      // Перезагружаем список
      await loadRealTickets();
    } else {
      throw new Error(response.error?.message || 'Не удалось закрыть тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка закрытия тикета:', error);
    showNotification('❌ Ошибка закрытия тикета', 'error');
  }
}

/**
 * Приоритет 1: Удаляет тикет НАВСЕГДА (опасная операция)
 * @param {string} ticketId - ID тикета для удаления
 */
async function deleteRealTicketForever(ticketId) {
  const ticket = ticketsState.tickets.find(t => t.ticketId === ticketId);
  if (!ticket) {
    console.error('🍄 Тикет не найден');
    return;
  }
  
  try {
    console.log('🍄 ФИЗИЧЕСКОЕ УДАЛЕНИЕ тикета:', ticket._id);
    
    const response = await window.makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${ticket._id}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      console.log('🍄 Тикет НАВСЕГДА удален из грибницы');
      showNotification('🗑️ Обращение удалено навсегда', 'info');
      
      // Закрываем модальное окно
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay) overlay.style.display = 'none';
      
      // Скрываем предупреждение
      hideDeletionWarning();
      
      // Перезагружаем список
      await loadRealTickets();
    } else {
      throw new Error(response.error?.message || 'Не удалось удалить тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка удаления тикета:', error);
    showNotification('❌ Ошибка удаления тикета', 'error');
  }
}

/**
 * Показывает предупреждение о закрытии тикета
 */
function showCloseWarning() {
  const warning = document.getElementById('close-warning');
  if (warning) {
    warning.style.display = 'block';
  }
}

/**
 * Скрывает предупреждение о закрытии тикета
 */
function hideCloseWarning() {
  const warning = document.getElementById('close-warning');
  if (warning) {
    warning.style.display = 'none';
  }
  
  // Очищаем поле резолюции
  const resolutionField = document.getElementById('close-resolution');
  if (resolutionField) {
    resolutionField.value = '';
  }
}

/**
 * Показывает предупреждение об удалении тикета
 */
function showDeletionWarning() {
  const warning = document.getElementById('deletion-warning');
  if (warning) {
    warning.style.display = 'block';
  }
}

/**
 * Скрывает предупреждение об удалении тикета
 */
function hideDeletionWarning() {
  const warning = document.getElementById('deletion-warning');
  if (warning) {
    warning.style.display = 'none';
  }
}

/**
 * Удаляет тикет (заменяет заглушку)
 * УСТАРЕЛО: Заменено на closeRealTicket()
 * @param {string} ticketId - ID тикета для удаления
 */
async function deleteRealTicket(ticketId) {
  console.warn('🍄 УСТАРЕЛО: deleteRealTicket заменено на closeRealTicket');
  
  // Для совместимости с существующим кодом
  const overlay = document.getElementById('ticket-detail-overlay');
  if (overlay && overlay.dataset.currentTicketId) {
    showCloseWarning();
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
    
    const response = await window.makeAuthenticatedRequest(`${TICKETS_CONFIG.API_BASE}/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.success) {
      console.log('🍄 Тикет обновлен');
      showNotification('💾 Изменения сохранены', 'success');
      await loadRealTickets();
    } else {
      throw new Error(response.error?.message || 'Не удалось обновить тикет');
    }
  } catch (error) {
    console.error('🍄 Ошибка обновления тикета:', error);
    showNotification('❌ Ошибка сохранения изменений', 'error');
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
    console.error('🍄 Не найдены элементы формы');
    return;
  }
  
  const updateData = {
    status: statusSelect.value,
    priority: prioritySelect.value
  };
  
  await updateRealTicket(ticketId, updateData);
}

/**
 * НОВАЯ ФУНКЦИЯ: Быстрое изменение статуса тикета
 */
async function changeTicketStatus() {
  const overlay = document.getElementById('ticket-detail-overlay');
  if (!overlay || !overlay.dataset.currentTicketId) return;
  
  const statusSelect = document.getElementById('detail-ticket-status');
  if (!statusSelect) return;
  
  const newStatus = statusSelect.value;
  const ticketId = overlay.dataset.currentTicketId;
  
  // Обновляем только статус
  await updateRealTicket(ticketId, { status: newStatus });
  
  console.log('🍄 Статус тикета изменен на:', newStatus);
}

/**
 * Инициализация страницы тикетов
 * ВАЖНО: Имя функции должно совпадать с вызовом в HTML
 */
function initTicketsPage() {
  console.log('🍄 Инициализация реальной системы тикетов');
  
  // Заменяем заглушки на реальные функции
  window.loadBasicTickets = loadRealTickets;
  window.showTicketDetail = showRealTicketDetail;
  window.deleteTicket = deleteRealTicket;
  window.saveTicketChanges = saveTicketChanges;
  window.showMockTicketDetail = showMockTicketDetail;
  
  // Новые функции для закрытия и удаления
  window.closeRealTicket = closeRealTicket;
  window.deleteRealTicketForever = deleteRealTicketForever;
  window.copyTicketId = copyTicketId;
  window.quickDeleteTicket = quickDeleteTicket;
  window.quickDeleteRealTicket = quickDeleteRealTicket;
  window.changeTicketStatus = changeTicketStatus;
  
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
 * ОБНОВЛЕНО: Добавлены новые кнопки закрытия и удаления
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
  
  // НОВАЯ: Кнопка изменения статуса (заменяет "Отправить ответ")
  const changeStatusBtn = document.getElementById('change-status');
  if (changeStatusBtn) {
    changeStatusBtn.addEventListener('click', changeTicketStatus);
  }
  
  // НОВАЯ: Кнопка закрытия тикета
  const closeTicketBtn = document.getElementById('close-ticket');
  if (closeTicketBtn) {
    closeTicketBtn.addEventListener('click', () => {
      showCloseWarning();
    });
  }
  
  // НОВАЯ: Подтверждение закрытия тикета
  const confirmCloseBtn = document.getElementById('confirm-close');
  if (confirmCloseBtn) {
    confirmCloseBtn.addEventListener('click', () => {
      const overlay = document.getElementById('ticket-detail-overlay');
      const resolutionField = document.getElementById('close-resolution');
      
      if (overlay && overlay.dataset.currentTicketId) {
        const resolution = resolutionField ? resolutionField.value : '';
        closeRealTicket(overlay.dataset.currentTicketId, resolution);
      }
    });
  }
  
  // НОВАЯ: Отмена закрытия тикета
  const cancelCloseBtn = document.getElementById('cancel-close');
  if (cancelCloseBtn) {
    cancelCloseBtn.addEventListener('click', hideCloseWarning);
  }
  
  // НОВАЯ: Кнопка удаления навсегда
  const deleteForeverBtn = document.getElementById('delete-ticket-forever');
  if (deleteForeverBtn) {
    deleteForeverBtn.addEventListener('click', () => {
      showDeletionWarning();
    });
  }
  
  // НОВАЯ: Подтверждение удаления навсегда
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      const overlay = document.getElementById('ticket-detail-overlay');
      if (overlay && overlay.dataset.currentTicketDisplayId) {
        deleteRealTicketForever(overlay.dataset.currentTicketDisplayId);
      }
    });
  }
  
  // НОВАЯ: Отмена удаления
  const cancelDeleteBtn = document.getElementById('cancel-delete');
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', hideDeletionWarning);
  }
  
  // Закрытие модального окна по клику на оверлей
  const overlay = document.getElementById('ticket-detail-overlay');
  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeTicketDetail();
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
  
  // Скрываем все предупреждения
  hideCloseWarning();
  hideDeletionWarning();
  
  // Очищаем поля ввода
  const resolutionField = document.getElementById('ticket-resolution-text');
  if (resolutionField) {
    resolutionField.value = '';
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

// Экспорт функций для глобального использования
window.loadRealTickets = loadRealTickets;
window.showRealTicketDetail = showRealTicketDetail;
window.showMockTicketDetail = showMockTicketDetail;
window.deleteRealTicket = deleteRealTicket;
window.closeRealTicket = closeRealTicket;
window.deleteRealTicketForever = deleteRealTicketForever;
window.updateRealTicket = updateRealTicket;
window.saveTicketChanges = saveTicketChanges;
window.closeTicketDetail = closeTicketDetail;
window.copyTicketId = copyTicketId;
window.showNotification = showNotification;
window.initTicketsPage = initTicketsPage;
window.quickDeleteTicket = quickDeleteTicket;
window.quickDeleteRealTicket = quickDeleteRealTicket;
window.changeTicketStatus = changeTicketStatus;