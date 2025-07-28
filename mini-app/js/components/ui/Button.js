/**
 * 🔲 УНИВЕРСАЛЬНЫЕ КНОПКИ - Button.js
 * 
 * Функциональность:
 * - Разные варианты: primary, secondary, danger, ghost, outline
 * - Состояния: loading, disabled, active
 * - Размеры: small, medium, large
 * - Haptic feedback интеграция с Telegram
 * - Touch-friendly интерфейс
 * - Иконки и текст
 */

class Button {
    constructor(options = {}) {
        this.options = {
            variant: 'primary', // primary, secondary, danger, ghost, outline
            size: 'medium',     // small, medium, large
            disabled: false,
            loading: false,
            icon: null,
            iconPosition: 'left', // left, right, only
            haptic: 'light',    // light, medium, heavy, none
            fullWidth: false,
            ...options
        };
        
        this.element = null;
        this.telegram = window.Telegram?.WebApp;
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация кнопки
     */
    init() {
        this.createElement();
        this.attachEventListeners();
    }
    
    /**
     * 🎨 Создание DOM элемента кнопки
     */
    createElement() {
        this.element = document.createElement('button');
        this.element.className = this.getClasses();
        this.element.innerHTML = this.getContent();
        
        // Применение опций
        if (this.options.disabled) {
            this.element.disabled = true;
        }
        
        if (this.options.loading) {
            this.element.classList.add('loading');
            this.element.disabled = true;
        }
        
        // Атрибуты доступности
        this.element.setAttribute('type', 'button');
        if (this.options.ariaLabel) {
            this.element.setAttribute('aria-label', this.options.ariaLabel);
        }
    }
    
    /**
     * 🎭 Получение CSS классов
     */
    getClasses() {
        const classes = ['btn'];
        
        // Вариант кнопки
        classes.push(`btn--${this.options.variant}`);
        
        // Размер
        classes.push(`btn--${this.options.size}`);
        
        // Дополнительные классы
        if (this.options.fullWidth) classes.push('btn--full-width');
        if (this.options.loading) classes.push('btn--loading');
        if (this.options.disabled) classes.push('btn--disabled');
        if (this.options.icon && this.options.iconPosition === 'only') {
            classes.push('btn--icon-only');
        }
        
        return classes.join(' ');
    }
    
    /**
     * 📄 Получение содержимого кнопки
     */
    getContent() {
        const { text, icon, iconPosition, loading } = this.options;
        
        if (loading) {
            return `
                <span class="btn__spinner">
                    <svg class="btn__spinner-icon" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" 
                                fill="none" stroke-linecap="round" stroke-dasharray="31.416" 
                                stroke-dashoffset="31.416">
                            <animate attributeName="stroke-dasharray" dur="2s" 
                                     values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dashoffset" dur="2s" 
                                     values="0;-15.708;-31.416" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                </span>
                ${text ? `<span class="btn__text btn__text--loading">${text}</span>` : ''}
            `;
        }
        
        if (iconPosition === 'only' && icon) {
            return `<span class="btn__icon">${icon}</span>`;
        }
        
        let content = '';
        
        if (icon && iconPosition === 'left') {
            content += `<span class="btn__icon btn__icon--left">${icon}</span>`;
        }
        
        if (text) {
            content += `<span class="btn__text">${text}</span>`;
        }
        
        if (icon && iconPosition === 'right') {
            content += `<span class="btn__icon btn__icon--right">${icon}</span>`;
        }
        
        return content;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;
        
        // Основной клик
        this.element.addEventListener('click', (e) => {
            this.handleClick(e);
        });
        
        // Touch события для лучшего UX
        this.element.addEventListener('touchstart', () => {
            if (!this.options.disabled && !this.options.loading) {
                this.element.classList.add('btn--pressed');
            }
        });
        
        this.element.addEventListener('touchend', () => {
            this.element.classList.remove('btn--pressed');
        });
        
        this.element.addEventListener('touchcancel', () => {
            this.element.classList.remove('btn--pressed');
        });
    }
    
    /**
     * 🎯 Обработчик клика
     */
    handleClick(event) {
        if (this.options.disabled || this.options.loading) {
            event.preventDefault();
            return;
        }
        
        // Haptic feedback
        this.triggerHaptic();
        
        // Вызов колбэка если есть
        if (this.options.onClick) {
            this.options.onClick(event, this);
        }
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic() {
        if (this.options.haptic === 'none') return;
        
        if (this.telegram && this.telegram.HapticFeedback) {
            switch (this.options.haptic) {
                case 'light':
                    this.telegram.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.telegram.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.telegram.HapticFeedback.impactOccurred('heavy');
                    break;
            }
        }
    }
    
    /**
     * 🔄 Установка состояния загрузки
     */
    setLoading(loading = true) {
        this.options.loading = loading;
        
        if (loading) {
            this.element.classList.add('btn--loading');
            this.element.disabled = true;
        } else {
            this.element.classList.remove('btn--loading');
            this.element.disabled = this.options.disabled;
        }
        
        this.element.innerHTML = this.getContent();
    }
    
    /**
     * 🚫 Установка состояния disabled
     */
    setDisabled(disabled = true) {
        this.options.disabled = disabled;
        this.element.disabled = disabled;
        
        if (disabled) {
            this.element.classList.add('btn--disabled');
        } else {
            this.element.classList.remove('btn--disabled');
        }
    }
    
    /**
     * 📝 Изменение текста кнопки
     */
    setText(text) {
        this.options.text = text;
        this.element.innerHTML = this.getContent();
    }
    
    /**
     * 🎨 Изменение иконки
     */
    setIcon(icon) {
        this.options.icon = icon;
        this.element.innerHTML = this.getContent();
    }
    
    /**
     * 🎭 Изменение варианта кнопки
     */
    setVariant(variant) {
        // Удаляем старый класс варианта
        this.element.classList.remove(`btn--${this.options.variant}`);
        
        // Добавляем новый
        this.options.variant = variant;
        this.element.classList.add(`btn--${variant}`);
    }
    
    /**
     * 🎯 Программный клик
     */
    click() {
        if (!this.options.disabled && !this.options.loading) {
            this.element.click();
        }
    }
    
    /**
     * 🎪 Анимация успеха
     */
    showSuccess(duration = 2000) {
        const originalContent = this.element.innerHTML;
        const originalVariant = this.options.variant;
        
        // Показываем галочку
        this.element.innerHTML = `<span class="btn__icon">✓</span>`;
        this.setVariant('success');
        
        // Возвращаем обратно через duration
        setTimeout(() => {
            this.element.innerHTML = originalContent;
            this.setVariant(originalVariant);
        }, duration);
    }
    
    /**
     * ⚠️ Анимация ошибки
     */
    showError(duration = 2000) {
        const originalContent = this.element.innerHTML;
        const originalVariant = this.options.variant;
        
        // Показываем крестик
        this.element.innerHTML = `<span class="btn__icon">✕</span>`;
        this.setVariant('danger');
        
        // Возвращаем обратно через duration
        setTimeout(() => {
            this.element.innerHTML = originalContent;
            this.setVariant(originalVariant);
        }, duration);
    }
    
    /**
     * 🎪 Pulse анимация для привлечения внимания
     */
    pulse(count = 3) {
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
            this.element.style.transform = 'scale(1.05)';
            setTimeout(() => {
                this.element.style.transform = 'scale(1)';
            }, 150);
            
            pulseCount++;
            if (pulseCount >= count) {
                clearInterval(pulseInterval);
            }
        }, 300);
    }
    
    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
    
    /**
     * 📤 Получение DOM элемента
     */
    getElement() {
        return this.element;
    }
    
    /**
     * 🏭 Статические методы-фабрики для быстрого создания
     */
    
    /**
     * Создание основной кнопки
     */
    static primary(text, onClick, options = {}) {
        return new Button({
            variant: 'primary',
            text,
            onClick,
            ...options
        });
    }
    
    /**
     * Создание вторичной кнопки
     */
    static secondary(text, onClick, options = {}) {
        return new Button({
            variant: 'secondary',
            text,
            onClick,
            ...options
        });
    }
    
    /**
     * Создание кнопки-призрака
     */
    static ghost(text, onClick, options = {}) {
        return new Button({
            variant: 'ghost',
            text,
            onClick,
            ...options
        });
    }
    
    /**
     * Создание кнопки опасного действия
     */
    static danger(text, onClick, options = {}) {
        return new Button({
            variant: 'danger',
            text,
            onClick,
            haptic: 'medium',
            ...options
        });
    }
    
    /**
     * Создание кнопки только с иконкой
     */
    static icon(icon, onClick, options = {}) {
        return new Button({
            variant: 'ghost',
            icon,
            iconPosition: 'only',
            onClick,
            ...options
        });
    }
    
    /**
     * Создание CTA кнопки (большая, яркая)
     */
    static cta(text, onClick, options = {}) {
        return new Button({
            variant: 'primary',
            size: 'large',
            fullWidth: true,
            haptic: 'medium',
            text,
            onClick,
            ...options
        });
    }
}

// 📤 Экспорт класса
window.Button = Button;