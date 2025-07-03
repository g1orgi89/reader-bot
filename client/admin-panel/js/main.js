/**
 * Главный JavaScript файл для админ-панели "Читатель"
 * Общие функции и утилиты
 */

/**
 * Конфигурация приложения
 */
const APP_CONFIG = {
    VERSION: '1.0.0',
    API_BASE_URL: '/api',
    REFRESH_INTERVAL: 5 * 60 * 1000, // 5 минут
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

/**
 * Глобальные переменные
 */
let isOnline = navigator.onLine;
let retryCount = 0;

/**
 * Инициализация приложения
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('📖 Инициализация админ-панели "Читатель"');
    
    // Инициализация базовых компонентов
    initializeApp();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Инициализация книжной анимации
    initReaderMatrix();
    
    // Мониторинг состояния сети
    setupNetworkMonitoring();
});

/**
 * Инициализация приложения
 */
function initializeApp() {
    console.log('📖 Инициализация базовых компонентов');
    
    // Настройка глобальных обработчиков ошибок
    setupErrorHandlers();
    
    // Инициализация уведомлений
    initializeNotifications();
    
    // Настройка интерфейса
    setupUI();
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Обработчики навигации
    setupNavigation();
    
    // Обработчики форм
    setupForms();
    
    // Обработчики модальных окон
    setupModals();
    
    // Обработчики горячих клавиш
    setupHotkeys();
}

/**
 * Настройка навигации
 */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.main-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Удаляем активный класс у всех ссылок
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Добавляем активный класс к текущей ссылке
            link.classList.add('active');
            
            // Сохраняем активную страницу
            localStorage.setItem('reader_active_page', link.getAttribute('href'));
        });
    });
}

/**
 * Настройка форм
 */
function setupForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Валидация формы
            if (validateForm(form)) {
                handleFormSubmit(form);
            }
        });
    });
}

/**
 * Валидация формы
 */
function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'Это поле обязательно для заполнения');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });
    
    return isValid;
}

/**
 * Показ ошибки поля
 */
function showFieldError(field, message) {
    field.classList.add('error');
    
    // Удаляем существующее сообщение об ошибке
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Создаем новое сообщение об ошибке
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

/**
 * Очистка ошибки поля
 */
function clearFieldError(field) {
    field.classList.remove('error');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Обработка отправки формы
 */
function handleFormSubmit(form) {
    const formData = new FormData(form);
    const action = form.getAttribute('action');
    const method = form.getAttribute('method') || 'POST';
    
    console.log('📖 Отправка формы:', action, method);
    
    // Показываем индикатор загрузки
    showFormLoading(form);
    
    // Отправляем данные (заглушка)
    setTimeout(() => {
        hideFormLoading(form);
        showNotification('success', 'Форма успешно отправлена');
    }, 1000);
}

/**
 * Показ индикатора загрузки формы
 */
function showFormLoading(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Отправка...';
    }
}

/**
 * Скрытие индикатора загрузки формы
 */
function hideFormLoading(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.originalText || 'Отправить';
    }
}

/**
 * Настройка модальных окон
 */
function setupModals() {
    // Обработчики открытия модальных окон
    document.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-modal')) {
            const modalId = e.target.getAttribute('data-modal');
            openModal(modalId);
        }
        
        // Закрытие модального окна
        if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

/**
 * Открытие модального окна
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('modal-active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Закрытие модального окна
 */
function closeModal() {
    const activeModal = document.querySelector('.modal-active');
    if (activeModal) {
        activeModal.style.display = 'none';
        activeModal.classList.remove('modal-active');
        document.body.style.overflow = '';
    }
}

/**
 * Настройка горячих клавиш
 */
function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K - поиск
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.querySelector('input[type="search"]');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Ctrl+/ - справка
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            showHelp();
        }
    });
}

/**
 * Показ справки
 */
function showHelp() {
    const helpContent = `
        <h3>📖 Горячие клавиши</h3>
        <ul>
            <li><kbd>Ctrl</kbd> + <kbd>K</kbd> - Поиск</li>
            <li><kbd>Ctrl</kbd> + <kbd>/</kbd> - Справка</li>
            <li><kbd>Escape</kbd> - Закрыть модальное окно</li>
        </ul>
        <h3>📊 Навигация</h3>
        <ul>
            <li>Дашборд - главная страница с аналитикой</li>
            <li>Пользователи - управление пользователями</li>
            <li>Цитаты - просмотр и модерация цитат</li>
            <li>Отчеты - генерация отчетов</li>
            <li>Обращения - работа с обращениями пользователей</li>
        </ul>
    `;
    
    showNotification('info', helpContent);
}

/**
 * Настройка UI
 */
function setupUI() {
    // Восстановление активной страницы
    const activePage = localStorage.getItem('reader_active_page');
    if (activePage) {
        const activeLink = document.querySelector(`a[href="${activePage}"]`);
        if (activeLink) {
            document.querySelectorAll('.main-nav a').forEach(l => l.classList.remove('active'));
            activeLink.classList.add('active');
        }
    }
    
    // Настройка tooltips
    setupTooltips();
    
    // Настройка автоматического обновления времени
    setupTimeUpdates();
}

/**
 * Настройка tooltips
 */
function setupTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = e.target.getAttribute('data-tooltip');
            if (tooltip) {
                showTooltip(e.target, tooltip);
            }
        });
        
        element.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    });
}

/**
 * Показ tooltip
 */
function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    
    setTimeout(() => {
        tooltip.classList.add('tooltip-visible');
    }, 10);
}

/**
 * Скрытие tooltip
 */
function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

/**
 * Настройка автоматического обновления времени
 */
function setupTimeUpdates() {
    const timeElements = document.querySelectorAll('[data-time]');
    
    if (timeElements.length > 0) {
        setInterval(() => {
            timeElements.forEach(element => {
                const timestamp = element.getAttribute('data-time');
                if (timestamp) {
                    element.textContent = formatRelativeTime(new Date(timestamp));
                }
            });
        }, 60000); // Обновляем каждую минуту
    }
}

/**
 * Форматирование относительного времени
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} ${getDeclension(days, 'день', 'дня', 'дней')} назад`;
    } else if (hours > 0) {
        return `${hours} ${getDeclension(hours, 'час', 'часа', 'часов')} назад`;
    } else if (minutes > 0) {
        return `${minutes} ${getDeclension(minutes, 'минуту', 'минуты', 'минут')} назад`;
    } else {
        return 'только что';
    }
}

/**
 * Получение правильного склонения слова
 */
function getDeclension(number, one, two, five) {
    const n = Math.abs(number);
    const n10 = n % 10;
    const n100 = n % 100;
    
    if (n10 === 1 && n100 !== 11) {
        return one;
    } else if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
        return two;
    } else {
        return five;
    }
}

/**
 * Настройка глобальных обработчиков ошибок
 */
function setupErrorHandlers() {
    window.addEventListener('error', (e) => {
        console.error('📖 Глобальная ошибка:', e.error);
        showNotification('error', 'Произошла ошибка приложения');
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        console.error('📖 Необработанное отклонение промиса:', e.reason);
        showNotification('error', 'Ошибка выполнения запроса');
    });
}

/**
 * Инициализация системы уведомлений
 */
function initializeNotifications() {
    // Создаем контейнер для уведомлений, если его нет
    if (!document.getElementById('notification-container')) {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
}

/**
 * Показ уведомления
 */
function showNotification(type, message, duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('📖 Контейнер уведомлений не найден');
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    // Обработчик закрытия
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    container.appendChild(notification);
    
    // Автоматическое удаление
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
}

/**
 * Получение иконки для уведомления
 */
function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '📖'
    };
    return icons[type] || '📖';
}

/**
 * Инициализация книжной матрицы (анимация фона)
 */
function initReaderMatrix(subtle = false) {
    const matrix = document.getElementById('reader-matrix');
    if (!matrix) return;
    
    const books = ['📖', '📚', '📝', '✍️', '📄', '📃', '📑', '🔖'];
    const maxBooks = subtle ? 10 : 20;
    
    for (let i = 0; i < maxBooks; i++) {
        const book = document.createElement('div');
        book.className = 'matrix-book';
        book.textContent = books[Math.floor(Math.random() * books.length)];
        book.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            font-size: ${Math.random() * 20 + 10}px;
            opacity: ${subtle ? 0.1 : 0.2};
            animation: readerFloat ${Math.random() * 20 + 10}s linear infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        
        matrix.appendChild(book);
    }
    
    // Добавляем CSS анимацию
    if (!document.getElementById('reader-matrix-styles')) {
        const style = document.createElement('style');
        style.id = 'reader-matrix-styles';
        style.textContent = `
            @keyframes readerFloat {
                0% { transform: translateY(0px) rotate(0deg); }
                25% { transform: translateY(-10px) rotate(1deg); }
                50% { transform: translateY(-5px) rotate(0deg); }
                75% { transform: translateY(-15px) rotate(-1deg); }
                100% { transform: translateY(0px) rotate(0deg); }
            }
            .matrix-book {
                pointer-events: none;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Настройка мониторинга сети
 */
function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
        isOnline = true;
        console.log('📖 Соединение восстановлено');
        showNotification('success', 'Соединение восстановлено');
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        console.log('📖 Соединение потеряно');
        showNotification('warning', 'Соединение потеряно. Работаем в офлайн режиме.');
    });
}

/**
 * Утилитарные функции
 */

/**
 * Форматирование чисел
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

/**
 * Форматирование даты
 */
function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return new Intl.DateTimeFormat('ru-RU', { ...defaultOptions, ...options }).format(new Date(date));
}

/**
 * Дебаунс функций
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Троттлинг функций
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Копирование текста в буфер обмена
 */
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('success', 'Скопировано в буфер обмена');
        }).catch(() => {
            showNotification('error', 'Не удалось скопировать');
        });
    } else {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showNotification('success', 'Скопировано в буфер обмена');
        } catch (err) {
            showNotification('error', 'Не удалось скопировать');
        }
        
        document.body.removeChild(textArea);
    }
}

// Экспорт основных функций для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showNotification,
        formatNumber,
        formatDate,
        debounce,
        throttle,
        copyToClipboard
    };
}