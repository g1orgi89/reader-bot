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
        const header = this.renderHeader();\n        const body = this.renderBody();\n        const footer = this.renderFooter();\n        \n        return `\n            <div class=\"modal__container\">\n                <div class=\"modal__content\">\n                    ${header}\n                    ${body}\n                    ${footer}\n                </div>\n            </div>\n        `;\n    }\n    \n    /**\n     * 📱 Рендер заголовка\n     */\n    renderHeader() {\n        if (!this.options.title && !this.options.showCloseButton) {\n            return '';\n        }\n        \n        return `\n            <div class=\"modal__header\">\n                ${this.options.title ? `\n                    <h3 class=\"modal__title\" id=\"modal-title\">${this.options.title}</h3>\n                ` : ''}\n                ${this.options.showCloseButton ? `\n                    <button class=\"modal__close\" aria-label=\"Закрыть\">\n                        <svg class=\"modal__close-icon\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n                            <path stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" \n                                  d=\"M18 6L6 18M6 6l12 12\"/>\n                        </svg>\n                    </button>\n                ` : ''}\n            </div>\n        `;\n    }\n    \n    /**\n     * 📄 Рендер тела модального окна\n     */\n    renderBody() {\n        return `\n            <div class=\"modal__body\">\n                ${this.options.content}\n            </div>\n        `;\n    }\n    \n    /**\n     * 🔲 Рендер футера с кнопками\n     */\n    renderFooter() {\n        if (!this.options.buttons || this.options.buttons.length === 0) {\n            return '';\n        }\n        \n        return `\n            <div class=\"modal__footer\">\n                ${this.options.buttons.map((button, index) => `\n                    <button class=\"modal__button modal__button--${button.variant || 'default'}\" \n                            data-button-index=\"${index}\"\n                            ${button.disabled ? 'disabled' : ''}>\n                        ${button.icon ? `<span class=\"modal__button-icon\">${button.icon}</span>` : ''}\n                        <span class=\"modal__button-text\">${button.text}</span>\n                    </button>\n                `).join('')}\n            </div>\n        `;\n    }\n    \n    /**\n     * 📱 Навешивание обработчиков событий\n     */\n    attachEventListeners() {\n        // Кнопка закрытия\n        if (this.options.showCloseButton) {\n            const closeButton = this.element.querySelector('.modal__close');\n            if (closeButton) {\n                closeButton.addEventListener('click', () => this.close());\n            }\n        }\n        \n        // Кнопки в футере\n        const footerButtons = this.element.querySelectorAll('.modal__button');\n        footerButtons.forEach(button => {\n            button.addEventListener('click', (e) => {\n                const buttonIndex = parseInt(button.dataset.buttonIndex);\n                this.handleButtonClick(buttonIndex, e);\n            });\n        });\n        \n        // Backdrop клик\n        if (this.backdrop && this.options.closeOnBackdrop) {\n            this.backdrop.addEventListener('click', (e) => {\n                if (e.target === this.backdrop) {\n                    this.close();\n                }\n            });\n        }\n        \n        // ESC клавиша\n        if (this.options.closeOnEscape) {\n            document.addEventListener('keydown', this.handleKeyDown.bind(this));\n        }\n        \n        // Предотвращение закрытия при клике внутри модального окна\n        this.element.addEventListener('click', (e) => {\n            e.stopPropagation();\n        });\n    }\n    \n    /**\n     * ⌨️ Обработчик нажатий клавиш\n     */\n    handleKeyDown(event) {\n        if (!this.isOpen) return;\n        \n        // ESC для закрытия\n        if (event.key === 'Escape' && this.options.closeOnEscape) {\n            event.preventDefault();\n            this.close();\n            return;\n        }\n        \n        // Tab для навигации по элементам\n        if (event.key === 'Tab') {\n            this.handleTabNavigation(event);\n        }\n    }\n    \n    /**\n     * 🔄 Обработка Tab навигации\n     */\n    handleTabNavigation(event) {\n        const focusableElements = this.element.querySelectorAll(\n            'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])'\n        );\n        \n        const firstElement = focusableElements[0];\n        const lastElement = focusableElements[focusableElements.length - 1];\n        \n        if (event.shiftKey) {\n            // Shift+Tab - назад\n            if (document.activeElement === firstElement) {\n                event.preventDefault();\n                lastElement.focus();\n            }\n        } else {\n            // Tab - вперед\n            if (document.activeElement === lastElement) {\n                event.preventDefault();\n                firstElement.focus();\n            }\n        }\n    }\n    \n    /**\n     * 🔲 Обработчик клика по кнопке\n     */\n    handleButtonClick(buttonIndex, event) {\n        const button = this.options.buttons[buttonIndex];\n        if (!button) return;\n        \n        // Haptic feedback\n        this.triggerHaptic();\n        \n        // Вызов колбэка кнопки\n        if (button.onClick) {\n            const result = button.onClick(event, this, button);\n            \n            // Если колбэк вернул false, не закрываем модальное окно\n            if (result === false) return;\n        }\n        \n        // Автоматическое закрытие если не указано иное\n        if (button.closeOnClick !== false) {\n            this.close();\n        }\n    }\n    \n    /**\n     * 📳 Вибрация через Telegram API\n     */\n    triggerHaptic(type = 'light') {\n        if (this.telegram && this.telegram.HapticFeedback) {\n            this.telegram.HapticFeedback.impactOccurred(type);\n        }\n    }\n    \n    /**\n     * 🔓 Открытие модального окна\n     */\n    open() {\n        if (this.isOpen) return;\n        \n        // Сохраняем активный элемент\n        this.previousActiveElement = document.activeElement;\n        \n        // Добавляем в стек\n        Modal.stack.push(this);\n        \n        // Предотвращаем прокрутку фона\n        if (this.options.preventScroll) {\n            document.body.style.overflow = 'hidden';\n            \n            // iOS viewport fix\n            if (this.telegram) {\n                this.telegram.expand();\n            }\n        }\n        \n        // Добавляем элементы в DOM\n        if (this.backdrop) {\n            document.body.appendChild(this.backdrop);\n        }\n        document.body.appendChild(this.element);\n        \n        // Анимация появления\n        requestAnimationFrame(() => {\n            if (this.backdrop) {\n                this.backdrop.classList.add('modal-backdrop--show');\n            }\n            this.element.classList.add('modal--show');\n        });\n        \n        // Фокус\n        if (this.options.autoFocus) {\n            setTimeout(() => this.focusFirstElement(), 100);\n        }\n        \n        this.isOpen = true;\n        \n        // Колбэк открытия\n        if (this.options.onOpen) {\n            this.options.onOpen(this);\n        }\n        \n        // Haptic feedback\n        this.triggerHaptic('medium');\n    }\n    \n    /**\n     * 🔒 Закрытие модального окна\n     */\n    close() {\n        if (!this.isOpen) return;\n        \n        // Анимация исчезновения\n        if (this.backdrop) {\n            this.backdrop.classList.remove('modal-backdrop--show');\n        }\n        this.element.classList.remove('modal--show');\n        \n        // Удаление из DOM после анимации\n        setTimeout(() => {\n            if (this.backdrop && this.backdrop.parentNode) {\n                this.backdrop.parentNode.removeChild(this.backdrop);\n            }\n            if (this.element && this.element.parentNode) {\n                this.element.parentNode.removeChild(this.element);\n            }\n            \n            // Восстановление прокрутки если это последнее модальное окно\n            Modal.stack = Modal.stack.filter(modal => modal !== this);\n            if (Modal.stack.length === 0 && this.options.preventScroll) {\n                document.body.style.overflow = '';\n            }\n            \n            // Возврат фокуса\n            if (this.previousActiveElement) {\n                this.previousActiveElement.focus();\n            }\n            \n        }, 300); // Время анимации\n        \n        this.isOpen = false;\n        \n        // Колбэк закрытия\n        if (this.options.onClose) {\n            this.options.onClose(this);\n        }\n        \n        // Haptic feedback\n        this.triggerHaptic('light');\n    }\n    \n    /**\n     * 🎯 Фокус на первый элемент\n     */\n    focusFirstElement() {\n        const focusableElements = this.element.querySelectorAll(\n            'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])'\n        );\n        \n        if (focusableElements.length > 0) {\n            focusableElements[0].focus();\n        } else {\n            this.element.focus();\n        }\n    }\n    \n    /**\n     * 📝 Обновление содержимого\n     */\n    setContent(content) {\n        this.options.content = content;\n        const bodyElement = this.element.querySelector('.modal__body');\n        if (bodyElement) {\n            bodyElement.innerHTML = content;\n        }\n    }\n    \n    /**\n     * 📝 Обновление заголовка\n     */\n    setTitle(title) {\n        this.options.title = title;\n        const titleElement = this.element.querySelector('.modal__title');\n        if (titleElement) {\n            titleElement.textContent = title;\n        }\n    }\n    \n    /**\n     * 🔲 Обновление кнопок\n     */\n    setButtons(buttons) {\n        this.options.buttons = buttons;\n        const footerElement = this.element.querySelector('.modal__footer');\n        if (footerElement) {\n            footerElement.innerHTML = this.renderFooter();\n            this.attachEventListeners();\n        }\n    }\n    \n    /**\n     * 🧹 Очистка ресурсов\n     */\n    destroy() {\n        this.close();\n        \n        // Удаление обработчиков\n        document.removeEventListener('keydown', this.handleKeyDown.bind(this));\n        \n        // Очистка элементов\n        this.element = null;\n        this.backdrop = null;\n    }\n    \n    /**\n     * 🏭 Статические методы для быстрого создания модальных окон\n     */\n    \n    /**\n     * Простое диалоговое окно с сообщением\n     */\n    static alert(message, title = 'Уведомление', options = {}) {\n        return new Modal({\n            title,\n            content: `<p class=\"modal__message\">${message}</p>`,\n            size: 'small',\n            buttons: [\n                {\n                    text: 'OK',\n                    variant: 'primary',\n                    onClick: () => true // Закрыть модальное окно\n                }\n            ],\n            ...options\n        });\n    }\n    \n    /**\n     * Диалог подтверждения\n     */\n    static confirm(message, title = 'Подтверждение', options = {}) {\n        return new Promise((resolve) => {\n            const modal = new Modal({\n                title,\n                content: `<p class=\"modal__message\">${message}</p>`,\n                size: 'small',\n                buttons: [\n                    {\n                        text: 'Отмена',\n                        variant: 'secondary',\n                        onClick: () => {\n                            resolve(false);\n                            return true;\n                        }\n                    },\n                    {\n                        text: 'Подтвердить',\n                        variant: 'primary',\n                        onClick: () => {\n                            resolve(true);\n                            return true;\n                        }\n                    }\n                ],\n                onClose: () => resolve(false),\n                ...options\n            });\n            modal.open();\n        });\n    }\n    \n    /**\n     * Модальное окно с формой ввода\n     */\n    static prompt(message, defaultValue = '', title = 'Ввод данных', options = {}) {\n        return new Promise((resolve) => {\n            const inputId = 'modal-prompt-input';\n            const modal = new Modal({\n                title,\n                content: `\n                    <div class=\"modal__prompt\">\n                        <p class=\"modal__message\">${message}</p>\n                        <input type=\"text\" id=\"${inputId}\" class=\"modal__input\" \n                               value=\"${defaultValue}\" placeholder=\"Введите значение...\">\n                    </div>\n                `,\n                size: 'small',\n                buttons: [\n                    {\n                        text: 'Отмена',\n                        variant: 'secondary',\n                        onClick: () => {\n                            resolve(null);\n                            return true;\n                        }\n                    },\n                    {\n                        text: 'OK',\n                        variant: 'primary',\n                        onClick: () => {\n                            const input = document.getElementById(inputId);\n                            resolve(input ? input.value : '');\n                            return true;\n                        }\n                    }\n                ],\n                onClose: () => resolve(null),\n                onOpen: (modal) => {\n                    // Фокус на поле ввода\n                    const input = document.getElementById(inputId);\n                    if (input) {\n                        input.focus();\n                        input.select();\n                    }\n                },\n                ...options\n            });\n            modal.open();\n        });\n    }\n    \n    /**\n     * Loading модальное окно\n     */\n    static loading(message = 'Загрузка...', options = {}) {\n        return new Modal({\n            content: `\n                <div class=\"modal__loading\">\n                    <div class=\"modal__spinner\">\n                        <svg class=\"modal__spinner-icon\" viewBox=\"0 0 24 24\">\n                            <circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" stroke-width=\"2\" \n                                    fill=\"none\" stroke-linecap=\"round\" stroke-dasharray=\"31.416\" \n                                    stroke-dashoffset=\"31.416\">\n                                <animate attributeName=\"stroke-dasharray\" dur=\"2s\" \n                                         values=\"0 31.416;15.708 15.708;0 31.416\" repeatCount=\"indefinite\"/>\n                                <animate attributeName=\"stroke-dashoffset\" dur=\"2s\" \n                                         values=\"0;-15.708;-31.416\" repeatCount=\"indefinite\"/>\n                            </circle>\n                        </svg>\n                    </div>\n                    <p class=\"modal__loading-text\">${message}</p>\n                </div>\n            `,\n            size: 'small',\n            showCloseButton: false,\n            closeOnBackdrop: false,\n            closeOnEscape: false,\n            ...options\n        });\n    }\n    \n    /**\n     * Полноэкранное модальное окно\n     */\n    static fullscreen(content, title = '', options = {}) {\n        return new Modal({\n            title,\n            content,\n            size: 'fullscreen',\n            position: 'center',\n            animation: 'slide',\n            ...options\n        });\n    }\n    \n    /**\n     * Bottom sheet модальное окно\n     */\n    static bottomSheet(content, options = {}) {\n        return new Modal({\n            content,\n            size: 'medium',\n            position: 'bottom',\n            animation: 'slide',\n            ...options\n        });\n    }\n    \n    /**\n     * Закрытие всех модальных окон\n     */\n    static closeAll() {\n        const modals = [...Modal.stack];\n        modals.forEach(modal => modal.close());\n    }\n    \n    /**\n     * Получение верхнего модального окна\n     */\n    static getTop() {\n        return Modal.stack[Modal.stack.length - 1] || null;\n    }\n}\n\n// 📤 Экспорт класса\nwindow.Modal = Modal;