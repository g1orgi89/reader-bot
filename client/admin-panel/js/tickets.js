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