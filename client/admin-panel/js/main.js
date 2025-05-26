/**
 * main.js - общие функции для админ-панели Shrooms AI Support Bot
 * Грибные утилиты и помощники для всех страниц мицелия поддержки
 * 
 * @fileoverview Общие функции и утилиты для всех страниц админ-панели
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} NotificationOptions
 * @property {string} type - Тип уведомления ('success', 'error', 'warning', 'info')
 * @property {string} message - Текст уведомления
 * @property {number} [duration] - Длительность показа в миллисекундах (по умолчанию 5000)
 * @property {boolean} [persistent] - Не убирать уведомление автоматически
 */

/**
 * Глобальное состояние уведомлений
 */
const notificationState = {
  container: null,
  notifications: [],
  maxNotifications: 5
};

/**
 * Показывает уведомление пользователю
 * Основная функция для всех типов уведомлений в админ-панели
 * 
 * @param {string} type - Тип уведомления ('success', 'error', 'warning', 'info')
 * @param {string} message - Текст уведомления с поддержкой грибной терминологии
 * @param {number} [duration=5000] - Длительность показа в миллисекундах
 * @param {boolean} [persistent=false] - Не убирать уведомление автоматически
 */
function showNotification(type, message, duration = 5000, persistent = false) {
  try {
    // Создаем контейнер для уведомлений если его нет
    if (!notificationState.container) {
      createNotificationContainer();
    }
    
    // Проверяем лимит уведомлений
    if (notificationState.notifications.length >= notificationState.maxNotifications) {
      removeOldestNotification();
    }
    
    console.log(`🍄 Показ уведомления [${type}]: ${message}`);
    
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Иконки для разных типов уведомлений
    const icons = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    // Добавляем содержимое
    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || '🍄'}</div>
      <div class="notification-message">${escapeHtml(message)}</div>
      <button class="notification-close" onclick="removeNotification(this.parentElement)">×</button>
    `;
    
    // Добавляем анимацию появления
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    // Добавляем в DOM
    notificationState.container.appendChild(notification);
    notificationState.notifications.push(notification);
    
    // Запускаем анимацию
    requestAnimationFrame(() => {
      notification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
    
    // Автоматическое удаление (если не persistent)
    if (!persistent && duration > 0) {
      setTimeout(() => {
        removeNotification(notification);
      }, duration);
    }
    
  } catch (error) {
    console.error('🍄 Ошибка показа уведомления:', error);
    // Fallback на простой alert
    alert(`${type.toUpperCase()}: ${message}`);
  }
}

/**
 * Создает контейнер для уведомлений
 */
function createNotificationContainer() {
  // Ищем существующий контейнер
  let container = document.getElementById('notification-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  notificationState.container = container;
}

/**
 * Удаляет уведомление с анимацией
 * @param {HTMLElement} notification - Элемент уведомления для удаления
 */
function removeNotification(notification) {
  if (!notification || !notification.parentElement) return;
  
  try {
    // Анимация исчезновения
    notification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    // Удаляем из DOM через 300ms
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
        
        // Удаляем из массива
        const index = notificationState.notifications.indexOf(notification);
        if (index > -1) {
          notificationState.notifications.splice(index, 1);
        }
      }
    }, 300);
    
  } catch (error) {
    console.error('🍄 Ошибка удаления уведомления:', error);
  }
}

/**
 * Удаляет самое старое уведомление
 */
function removeOldestNotification() {
  if (notificationState.notifications.length > 0) {
    removeNotification(notificationState.notifications[0]);
  }
}

/**
 * Очищает все уведомления
 */
function clearAllNotifications() {
  notificationState.notifications.forEach(notification => {
    removeNotification(notification);
  });
}

/**
 * Экранирует HTML в строке для безопасности
 * @param {string} text - Текст для экранирования
 * @returns {string} Экранированный текст
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text.toString();
  return div.innerHTML;
}

/**
 * Форматирует дату в человеко-читаемом формате
 * @param {string|Date} dateInput - Дата для форматирования
 * @param {Object} [options] - Опции форматирования
 * @param {boolean} [options.relative=true] - Показывать относительное время
 * @param {boolean} [options.includeTime=true] - Включать время
 * @returns {string} Отформатированная дата
 */
function formatDate(dateInput, options = {}) {
  const { relative = true, includeTime = true } = options;
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Неверная дата';
    }
    
    if (relative) {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 1) return 'только что';
      if (diffMinutes < 60) return `${diffMinutes} мин назад`;
      if (diffHours < 24) return `${diffHours} ч назад`;
      if (diffDays < 7) return `${diffDays} дн назад`;
    }
    
    // Абсолютная дата
    const formatOptions = {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    };
    
    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
    }
    
    return date.toLocaleString('ru-RU', formatOptions);
    
  } catch (error) {
    console.error('🍄 Ошибка форматирования даты:', error);
    return 'Ошибка даты';
  }
}

/**
 * Генерирует безопасный случайный ID
 * @param {string} [prefix='id'] - Префикс для ID
 * @returns {string} Уникальный ID
 */
function generateId(prefix = 'id') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Копирует текст в буфер обмена
 * @param {string} text - Текст для копирования
 * @returns {Promise<boolean>} Успешность копирования
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showNotification('success', '🍄 Скопировано в грибную корзинку!');
      return true;
    } else {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (result) {
        showNotification('success', '🍄 Скопировано в грибную корзинку!');
        return true;
      } else {
        throw new Error('Команда копирования не поддерживается');
      }
    }
  } catch (error) {
    console.error('🍄 Ошибка копирования:', error);
    showNotification('error', '🍄 Не удалось скопировать в корзинку');
    return false;
  }
}

/**
 * Деббаунс функция для ограничения частоты вызовов
 * @param {Function} func - Функция для деббаунса
 * @param {number} wait - Время ожидания в миллисекундах
 * @param {boolean} [immediate=false] - Вызвать функцию немедленно
 * @returns {Function} Деббаунс функция
 */
function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

/**
 * Загружает данные с индикатором загрузки
 * @param {Function} loadFunction - Функция загрузки данных
 * @param {string} [loadingText='🍄 Загрузка...'] - Текст загрузки
 * @returns {Promise<*>} Результат загрузки
 */
async function loadWithIndicator(loadFunction, loadingText = '🍄 Загрузка...') {
  const loadingNotification = document.createElement('div');
  loadingNotification.className = 'loading-indicator';
  loadingNotification.innerHTML = `
    <div class="loading-spinner"></div>
    <span>${loadingText}</span>
  `;
  
  try {
    // Показываем индикатор загрузки
    if (notificationState.container) {
      notificationState.container.appendChild(loadingNotification);
    }
    
    console.log('🍄 Начало загрузки:', loadingText);
    const result = await loadFunction();
    console.log('🍄 Загрузка завершена успешно');
    
    return result;
    
  } catch (error) {
    console.error('🍄 Ошибка загрузки:', error);
    showNotification('error', `🍄 Ошибка загрузки: ${error.message}`);
    throw error;
    
  } finally {
    // Убираем индикатор загрузки
    if (loadingNotification.parentElement) {
      loadingNotification.parentElement.removeChild(loadingNotification);
    }
  }
}

/**
 * Проверяет, является ли строка валидным JSON
 * @param {string} str - Строка для проверки
 * @returns {boolean} Является ли строка валидным JSON
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Безопасно парсит JSON строку
 * @param {string} str - JSON строка
 * @param {*} [defaultValue=null] - Значение по умолчанию при ошибке
 * @returns {*} Распарсенный объект или значение по умолчанию
 */
function safeJSONParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('🍄 Ошибка парсинга JSON:', error);
    return defaultValue;
  }
}

/**
 * Форматирует размер файла в человеко-читаемом виде
 * @param {number} bytes - Размер в байтах
 * @param {number} [decimals=2] - Количество знаков после запятой
 * @returns {string} Отформатированный размер
 */
function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Инициализирует общие обработчики событий для админ-панели
 */
function initCommonEventHandlers() {
  // Обработчик для кнопок копирования
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('copy-btn') || 
        event.target.closest('.copy-btn')) {
      const button = event.target.classList.contains('copy-btn') ? 
                    event.target : event.target.closest('.copy-btn');
      const textToCopy = button.dataset.copy || button.textContent;
      copyToClipboard(textToCopy);
    }
  });
  
  // Обработчик для закрытия модальных окон по клику вне них
  document.addEventListener('click', (event) => {
    const modals = document.querySelectorAll('.modal-overlay, .ticket-detail-overlay');
    modals.forEach(modal => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // Обработчик Escape для закрытия модальных окон
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const visibleModals = document.querySelectorAll('.modal-overlay[style*="flex"], .ticket-detail-overlay[style*="flex"]');
      visibleModals.forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
}

/**
 * Глобальная функция для совместимости с существующим кодом
 * Алиас для initRealTicketsPage() из tickets.js
 */
function initTicketsPage() {
  console.log('🍄 Инициализация страницы тикетов через main.js');
  
  // Проверяем, доступна ли функция из tickets.js
  if (typeof window.initTicketsPage === 'function' && window.initTicketsPage !== initTicketsPage) {
    console.log('🍄 Найдена внешняя initTicketsPage, используем её');
    window.initTicketsPage();
  } else {
    console.warn('🍄 Функции инициализации тикетов не найдены');
  }
}

/**
 * Инициализация общих функций при загрузке страницы
 */
function initMainFunctions() {
  console.log('🍄 Инициализация общих функций админ-панели');
  
  // Создаем контейнер для уведомлений
  createNotificationContainer();
  
  // Инициализируем общие обработчики
  initCommonEventHandlers();
  
  console.log('🍄 Общие функции инициализированы');
}

// Экспорт функций в глобальную область для совместимости
window.showNotification = showNotification;
window.removeNotification = removeNotification;
window.clearAllNotifications = clearAllNotifications;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.generateId = generateId;
window.copyToClipboard = copyToClipboard;
window.debounce = debounce;
window.loadWithIndicator = loadWithIndicator;
window.isValidJSON = isValidJSON;
window.safeJSONParse = safeJSONParse;
window.formatFileSize = formatFileSize;

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', initMainFunctions);