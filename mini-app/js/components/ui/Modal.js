/**
 * 🪟 БАЗОВЫЕ МОДАЛЬНЫЕ ОКНА - Modal.js
 * 
 * Функциональность:
 * - Backdrop с закрытием по клику и ESC
 * - Анимации появления/скрытия
 * - iOS безопасные зоны
 * - Telegram Web App интеграция
 * - Автофокус и управление клавиатурой
 * - Предотвращение прокрутки фона
 * - Стековое управление модальными окнами
 */

class Modal {
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            size: 'medium',           // small, medium, large, fullscreen
            position: 'center',       // center, bottom, top
            backdrop: true,           // Показывать backdrop
            closeOnBackdrop: true,    // Закрывать по клику на backdrop
            closeOnEscape: true,      // Закрывать по ESC
            autoFocus: true,          // Автофокус
            preventScroll: true,      // Предотвращать прокрутку фона
            animation: 'fade',        // fade, slide, zoom
            showCloseButton: true,    // Показывать кнопку закрытия
            buttons: [],              // Кнопки в футере
            className: '',            // Дополнительные CSS классы
            ...options
        };
        
        this.element = null;
        this.backdrop = null;
        this.isOpen = false;
        this.telegram = window.Telegram?.WebApp;
        this.previousActiveElement = null;
        
        // Статический стек модальных окон
        Modal.stack = Modal.stack || [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация модального окна
     */
    init() {
        this.createElement();
        this.attachEventListeners();
    }
    
    /**
     * 🎨 Создание DOM элементов
     */
    createElement() {
        // Создание backdrop
        if (this.options.backdrop) {
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'modal-backdrop';
        }
        
        // Создание модального окна
        this.element = document.createElement('div');
        this.element.className = this.getClasses();
        this.element.innerHTML = this.getContent();
        
        // Атрибуты доступности
        this.element.setAttribute('role', 'dialog');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('tabindex', '-1');
        
        if (this.options.title) {
            this.element.setAttribute('aria-labelledby', 'modal-title');
        }
    }
    
    /**
     * 🎭 Получение CSS классов
     */
    getClasses() {
        const classes = ['modal'];
        
        // Размер
        classes.push(`modal--${this.options.size}`);
        
        // Позиция
        classes.push(`modal--${this.options.position}`);
        
        // Анимация
        classes.push(`modal--${this.options.animation}`);
        
        // Дополнительные классы
        if (this.options.className) {
            classes.push(this.options.className);
        }
        
        return classes.join(' ');
    }
    
    /**
     * 📄 Получение содержимого модального окна
     */
    getContent() {
        const header = this.renderHeader();
        const body = this.renderBody();
        const footer = this.renderFooter();
        
        return `
            <div class="modal__container">
                <div class="modal__content">
                    ${header}
                    ${body}
                    ${footer}
                </div>
            </div>
        `;
    }
    
    /**
     * 📱 Рендер заголовка
     */
    renderHeader() {
        if (!this.options.title && !this.options.showCloseButton) {
            return '';
        }
        
        return `
            <div class="modal__header">
                ${this.options.title ? `
                    <h3 class="modal__title" id="modal-title">${this.options.title}</h3>
                ` : ''}
                ${this.options.showCloseButton ? `
                    <button class="modal__close" aria-label="Закрыть">
                        <svg class="modal__close-icon" viewBox="0 0 24 24" width="24" height="24">
                            <path stroke="currentColor" stroke-width="2" stroke-linecap="round" 
                                  d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 📄 Рендер тела модального окна
     */
    renderBody() {
        return `
            <div class="modal__body">
                ${this.options.content}
            </div>
        `;
    }
    
    /**
     * 🔲 Рендер футера с кнопками
     */
    renderFooter() {
        if (!this.options.buttons || this.options.buttons.length === 0) {
            return '';
        }
        
        return `
            <div class="modal__footer">
                ${this.options.buttons.map((button, index) => `
                    <button class="modal__button modal__button--${button.variant || 'default'}" 
                            data-button-index="${index}"
                            ${button.disabled ? 'disabled' : ''}>
                        ${button.icon ? `<span class="modal__button-icon">${button.icon}</span>` : ''}
                        <span class="modal__button-text">${button.text}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Кнопка закрытия
        if (this.options.showCloseButton) {
            const closeButton = this.element.querySelector('.modal__close');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.close());
            }
        }
        
        // Кнопки в футере
        const footerButtons = this.element.querySelectorAll('.modal__button');
        footerButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const buttonIndex = parseInt(button.dataset.buttonIndex);
                this.handleButtonClick(buttonIndex, e);
            });
        });
        
        // Backdrop клик
        if (this.backdrop && this.options.closeOnBackdrop) {
            this.backdrop.addEventListener('click', (e) => {
                if (e.target === this.backdrop) {
                    this.close();
                }
            });
        }
        
        // ESC клавиша
        if (this.options.closeOnEscape) {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
        
        // Предотвращение закрытия при клике внутри модального окна
        this.element.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    /**
     * ⌨️ Обработчик нажатий клавиш
     */
    handleKeyDown(event) {
        if (!this.isOpen) return;
        
        // ESC для закрытия
        if (event.key === 'Escape' && this.options.closeOnEscape) {
            event.preventDefault();
            this.close();
            return;
        }
        
        // Tab для навигации по элементам
        if (event.key === 'Tab') {
            this.handleTabNavigation(event);
        }
    }
    
    /**
     * 🔄 Обработка Tab навигации
     */
    handleTabNavigation(event) {
        const focusableElements = this.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey) {
            // Shift+Tab - назад
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab - вперед
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    /**
     * 🔲 Обработчик клика по кнопке
     */
    handleButtonClick(buttonIndex, event) {
        const button = this.options.buttons[buttonIndex];
        if (!button) return;
        
        // Haptic feedback
        this.triggerHaptic();
        
        // Вызов колбэка кнопки
        if (button.onClick) {
            const result = button.onClick(event, this, button);
            
            // Если колбэк вернул false, не закрываем модальное окно
            if (result === false) return;
        }
        
        // Автоматическое закрытие если не указано иное
        if (button.closeOnClick !== false) {
            this.close();
        }
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic(type = 'light') {
        if (this.telegram && this.telegram.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred(type);
        }
    }
    
    /**
     * 🔓 Открытие модального окна
     */
    open() {
        if (this.isOpen) return;
        
        // Сохраняем активный элемент
        this.previousActiveElement = document.activeElement;
        
        // Добавляем в стек
        Modal.stack.push(this);
        
        // Предотвращаем прокрутку фона
        if (this.options.preventScroll) {
            document.body.style.overflow = 'hidden';
            
            // iOS viewport fix
            if (this.telegram) {
                this.telegram.expand();
            }
        }
        
        // Добавляем элементы в DOM
        if (this.backdrop) {
            document.body.appendChild(this.backdrop);
        }
        document.body.appendChild(this.element);
        
        // Анимация появления
        requestAnimationFrame(() => {
            if (this.backdrop) {
                this.backdrop.classList.add('modal-backdrop--show');
            }
            this.element.classList.add('modal--show');
        });
        
        // Фокус
        if (this.options.autoFocus) {
            setTimeout(() => this.focusFirstElement(), 100);
        }
        
        this.isOpen = true;
        
        // Колбэк открытия
        if (this.options.onOpen) {
            this.options.onOpen(this);
        }
        
        // Haptic feedback
        this.triggerHaptic('medium');
    }
    
    /**
     * 🔒 Закрытие модального окна
     */
    close() {
        if (!this.isOpen) return;
        
        // Анимация исчезновения
        if (this.backdrop) {
            this.backdrop.classList.remove('modal-backdrop--show');
        }
        this.element.classList.remove('modal--show');
        
        // Удаление из DOM после анимации
        setTimeout(() => {
            if (this.backdrop && this.backdrop.parentNode) {
                this.backdrop.parentNode.removeChild(this.backdrop);
            }
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            
            // Восстановление прокрутки если это последнее модальное окно
            Modal.stack = Modal.stack.filter(modal => modal !== this);
            if (Modal.stack.length === 0 && this.options.preventScroll) {
                document.body.style.overflow = '';
            }
            
            // Возврат фокуса
            if (this.previousActiveElement) {
                this.previousActiveElement.focus();
            }
            
        }, 300); // Время анимации
        
        this.isOpen = false;
        
        // Колбэк закрытия
        if (this.options.onClose) {
            this.options.onClose(this);
        }
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🎯 Фокус на первый элемент
     */
    focusFirstElement() {
        const focusableElements = this.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        } else {
            this.element.focus();
        }
    }
    
    /**
     * 📝 Обновление содержимого
     */
    setContent(content) {
        this.options.content = content;
        const bodyElement = this.element.querySelector('.modal__body');
        if (bodyElement) {
            bodyElement.innerHTML = content;
        }
    }
    
    /**
     * 📝 Обновление заголовка
     */
    setTitle(title) {
        this.options.title = title;
        const titleElement = this.element.querySelector('.modal__title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    /**
     * 🔲 Обновление кнопок
     */
    setButtons(buttons) {
        this.options.buttons = buttons;
        const footerElement = this.element.querySelector('.modal__footer');
        if (footerElement) {
            footerElement.innerHTML = this.renderFooter();
            this.attachEventListeners();
        }
    }
    
    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        this.close();
        
        // Удаление обработчиков
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Очистка элементов
        this.element = null;
        this.backdrop = null;
    }
    
    /**
     * 🏭 Статические методы для быстрого создания модальных окон
     */
    
    /**
     * Простое диалоговое окно с сообщением
     */
    static alert(message, title = 'Уведомление', options = {}) {
        return new Modal({
            title,
            content: `<p class="modal__message">${message}</p>`,
            size: 'small',
            buttons: [
                {
                    text: 'OK',
                    variant: 'primary',
                    onClick: () => true // Закрыть модальное окно
                }
            ],
            ...options
        });
    }
    
    /**
     * Диалог подтверждения
     */
    static confirm(message, title = 'Подтверждение', options = {}) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title,
                content: `<p class="modal__message">${message}</p>`,
                size: 'small',
                buttons: [
                    {
                        text: 'Отмена',
                        variant: 'secondary',
                        onClick: () => {
                            resolve(false);
                            return true;
                        }
                    },
                    {
                        text: 'Подтвердить',
                        variant: 'primary',
                        onClick: () => {
                            resolve(true);
                            return true;
                        }
                    }
                ],
                onClose: () => resolve(false),
                ...options
            });
            modal.open();
        });
    }
    
    /**
     * Модальное окно с формой ввода
     */
    static prompt(message, defaultValue = '', title = 'Ввод данных', options = {}) {
        return new Promise((resolve) => {
            const inputId = 'modal-prompt-input';
            const modal = new Modal({
                title,
                content: `
                    <div class="modal__prompt">
                        <p class="modal__message">${message}</p>
                        <input type="text" id="${inputId}" class="modal__input" 
                               value="${defaultValue}" placeholder="Введите значение...">
                    </div>
                `,
                size: 'small',
                buttons: [
                    {
                        text: 'Отмена',
                        variant: 'secondary',
                        onClick: () => {
                            resolve(null);
                            return true;
                        }
                    },
                    {
                        text: 'OK',
                        variant: 'primary',
                        onClick: () => {
                            const input = document.getElementById(inputId);
                            resolve(input ? input.value : '');
                            return true;
                        }
                    }
                ],
                onClose: () => resolve(null),
                onOpen: (modal) => {
                    // Фокус на поле ввода
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.focus();
                        input.select();
                    }
                },
                ...options
            });
            modal.open();
        });
    }
    
    /**
     * Loading модальное окно
     */
    static loading(message = 'Загрузка...', options = {}) {
        return new Modal({
            content: `
                <div class="modal__loading">
                    <div class="modal__spinner">
                        <svg class="modal__spinner-icon" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" 
                                    fill="none" stroke-linecap="round" stroke-dasharray="31.416" 
                                    stroke-dashoffset="31.416">
                                <animate attributeName="stroke-dasharray" dur="2s" 
                                         values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                <animate attributeName="stroke-dashoffset" dur="2s" 
                                         values="0;-15.708;-31.416" repeatCount="indefinite"/>
                            </circle>
                        </svg>
                    </div>
                    <p class="modal__loading-text">${message}</p>
                </div>
            `,
            size: 'small',
            showCloseButton: false,
            closeOnBackdrop: false,
            closeOnEscape: false,
            ...options
        });
    }
    
    /**
     * Полноэкранное модальное окно
     */
    static fullscreen(content, title = '', options = {}) {
        return new Modal({
            title,
            content,
            size: 'fullscreen',
            position: 'center',
            animation: 'slide',
            ...options
        });
    }
    
    /**
     * Bottom sheet модальное окно
     */
    static bottomSheet(content, options = {}) {
        return new Modal({
            content,
            size: 'medium',
            position: 'bottom',
            animation: 'slide',
            ...options
        });
    }
    
    /**
     * Закрытие всех модальных окон
     */
    static closeAll() {
        const modals = [...Modal.stack];
        modals.forEach(modal => modal.close());
    }
    
    /**
     * Получение верхнего модального окна
     */
    static getTop() {
        return Modal.stack[Modal.stack.length - 1] || null;
    }
}

// 📤 Экспорт класса
window.Modal = Modal;