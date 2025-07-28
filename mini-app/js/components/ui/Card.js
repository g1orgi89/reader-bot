/**
 * 🃏 КАРТОЧКИ ИНТЕРФЕЙСА - Card.js
 * 
 * Функциональность:
 * - Типы: stat-card, quote-card, book-card, info-card, achievement-card
 * - Анимации и переходы
 * - Hover эффекты для touch
 * - Поддержка действий (клик, свайп)
 * - Адаптивная верстка
 * - Loading и error состояния
 */

class Card {
    constructor(options = {}) {
        this.options = {
            type: 'info',          // stat, quote, book, info, achievement
            variant: 'default',    // default, highlighted, compact, expanded
            data: {},              // Данные для отображения
            clickable: false,      // Можно ли кликать
            swipeable: false,      // Поддержка свайпов
            loading: false,        // Состояние загрузки
            error: null,           // Ошибка
            actions: [],           // Действия (кнопки)
            haptic: 'light',       // Haptic feedback
            ...options
        };
        
        this.element = null;
        this.telegram = window.Telegram?.WebApp;
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация карточки
     */
    init() {
        this.createElement();
        this.attachEventListeners();
    }
    
    /**
     * 🎨 Создание DOM элемента карточки
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = this.getClasses();
        this.element.innerHTML = this.getContent();
        
        // Применение опций
        if (this.options.clickable) {
            this.element.setAttribute('role', 'button');
            this.element.setAttribute('tabindex', '0');
        }
        
        if (this.options.loading) {
            this.element.classList.add('card--loading');
        }
        
        if (this.options.error) {
            this.element.classList.add('card--error');
        }
    }
    
    /**
     * 🎭 Получение CSS классов
     */
    getClasses() {
        const classes = ['card'];
        
        // Тип карточки
        classes.push(`card--${this.options.type}`);
        
        // Вариант
        classes.push(`card--${this.options.variant}`);
        
        // Дополнительные классы
        if (this.options.clickable) classes.push('card--clickable');
        if (this.options.swipeable) classes.push('card--swipeable');
        if (this.options.loading) classes.push('card--loading');
        if (this.options.error) classes.push('card--error');
        
        return classes.join(' ');
    }
    
    /**
     * 📄 Получение содержимого карточки
     */
    getContent() {
        if (this.options.loading) {
            return this.renderLoading();
        }
        
        if (this.options.error) {
            return this.renderError();
        }
        
        switch (this.options.type) {
            case 'stat':
                return this.renderStatCard();
            case 'quote':
                return this.renderQuoteCard();
            case 'book':
                return this.renderBookCard();
            case 'achievement':
                return this.renderAchievementCard();
            case 'info':
            default:
                return this.renderInfoCard();
        }
    }
    
    /**
     * 📊 Рендер статистической карточки
     */
    renderStatCard() {
        const { data } = this.options;
        const value = data.value || 0;
        const label = data.label || 'Статистика';
        const change = data.change || null;
        const icon = data.icon || '📊';
        
        return `
            <div class="card__content">
                <div class="card__icon">${icon}</div>
                <div class="card__body">
                    <div class="card__value">${value}</div>
                    <div class="card__label">${label}</div>
                    ${change ? `
                        <div class="card__change card__change--${change.type}">
                            ${change.type === 'positive' ? '↗' : '↘'} ${change.value}
                        </div>
                    ` : ''}
                </div>
                ${this.renderActions()}
            </div>
        `;
    }
    
    /**
     * 💬 Рендер карточки цитаты
     */
    renderQuoteCard() {
        const { data } = this.options;
        const text = data.text || '';
        const author = data.author || '';
        const date = data.date || '';
        const tags = data.tags || [];
        
        return `
            <div class="card__content">
                <div class="card__quote">
                    <div class="card__quote-text">"${text}"</div>
                    ${author ? `<div class="card__quote-author">— ${author}</div>` : ''}
                </div>
                <div class="card__meta">
                    ${date ? `<span class="card__date">${this.formatDate(date)}</span>` : ''}
                    ${tags.length > 0 ? `
                        <div class="card__tags">
                            ${tags.map(tag => `<span class="card__tag">#${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                ${this.renderActions()}
            </div>
        `;
    }
    
    /**
     * 📚 Рендер карточки книги
     */
    renderBookCard() {
        const { data } = this.options;
        const title = data.title || 'Название книги';
        const author = data.author || 'Автор';
        const cover = data.cover || null;
        const rating = data.rating || null;
        const price = data.price || null;
        const salesCount = data.salesCount || 0;
        
        return `
            <div class="card__content">
                ${cover ? `
                    <div class="card__cover">
                        <img src="${cover}" alt="${title}" class="card__cover-image">
                    </div>
                ` : ''}
                <div class="card__body">
                    <div class="card__title">${title}</div>
                    <div class="card__subtitle">${author}</div>
                    <div class="card__details">
                        ${rating ? `
                            <div class="card__rating">
                                <span class="card__stars">${this.renderStars(rating)}</span>
                                <span class="card__rating-value">${rating}</span>
                            </div>
                        ` : ''}
                        ${price ? `<div class="card__price">${price}</div>` : ''}
                        <div class="card__sales">${salesCount} покупок</div>
                    </div>
                </div>
                ${this.renderActions()}
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер карточки достижения
     */
    renderAchievementCard() {
        const { data } = this.options;
        const title = data.title || 'Достижение';
        const description = data.description || '';
        const icon = data.icon || '🏆';
        const unlocked = data.unlocked || false;
        const progress = data.progress || null;
        
        return `
            <div class="card__content">
                <div class="card__achievement-icon ${unlocked ? 'unlocked' : 'locked'}">
                    ${icon}
                </div>
                <div class="card__body">
                    <div class="card__title">${title}</div>
                    <div class="card__description">${description}</div>
                    ${progress && !unlocked ? `
                        <div class="card__progress">
                            <div class="card__progress-bar">
                                <div class="card__progress-fill" style="width: ${progress.percent}%"></div>
                            </div>
                            <div class="card__progress-text">${progress.current}/${progress.total}</div>
                        </div>
                    ` : ''}
                    ${unlocked ? '<div class="card__unlocked">✓ Получено</div>' : ''}
                </div>
                ${this.renderActions()}
            </div>
        `;
    }
    
    /**
     * ℹ️ Рендер информационной карточки
     */
    renderInfoCard() {
        const { data } = this.options;
        const title = data.title || '';
        const content = data.content || '';
        const icon = data.icon || null;
        
        return `
            <div class="card__content">
                ${icon ? `<div class="card__icon">${icon}</div>` : ''}
                <div class="card__body">
                    ${title ? `<div class="card__title">${title}</div>` : ''}
                    ${content ? `<div class="card__content-text">${content}</div>` : ''}
                </div>
                ${this.renderActions()}
            </div>
        `;
    }
    
    /**
     * ⏳ Рендер состояния загрузки
     */
    renderLoading() {
        return `
            <div class="card__content card__content--loading">
                <div class="card__skeleton">
                    <div class="skeleton skeleton--line skeleton--title"></div>
                    <div class="skeleton skeleton--line skeleton--subtitle"></div>
                    <div class="skeleton skeleton--line skeleton--content"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер состояния ошибки
     */
    renderError() {
        return `
            <div class="card__content card__content--error">
                <div class="card__error">
                    <div class="card__error-icon">⚠️</div>
                    <div class="card__error-text">${this.options.error}</div>
                    <button class="card__retry-button" onclick="this.retry()">Повторить</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔲 Рендер действий карточки
     */
    renderActions() {
        const { actions } = this.options;
        if (!actions || actions.length === 0) return '';
        
        return `
            <div class="card__actions">
                ${actions.map((action, index) => `
                    <button class="card__action card__action--${action.variant || 'default'}" 
                            data-action-index="${index}">
                        ${action.icon ? `<span class="card__action-icon">${action.icon}</span>` : ''}
                        <span class="card__action-text">${action.text}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * ⭐ Рендер звезд рейтинга
     */
    renderStars(rating) {
        const maxStars = 5;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        let stars = '';
        
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        
        if (hasHalfStar) {
            stars += '☆';
        }
        
        const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            stars += '☆';
        }
        
        return stars;
    }
    
    /**
     * 📅 Форматирование даты
     */
    formatDate(date) {
        if (!date) return '';
        
        const dateObj = new Date(date);
        const now = new Date();
        const diffInHours = (now - dateObj) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            return 'Только что';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} ч. назад`;
        } else if (diffInHours < 48) {
            return 'Вчера';
        } else {
            return dateObj.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short'
            });
        }
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;
        
        // Клик по карточке
        if (this.options.clickable) {
            this.element.addEventListener('click', (e) => {
                this.handleClick(e);
            });
        }
        
        // Swipe события
        if (this.options.swipeable) {
            this.attachSwipeListeners();
        }
        
        // Действия карточки
        const actionButtons = this.element.querySelectorAll('.card__action');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionIndex = parseInt(button.dataset.actionIndex);
                this.handleActionClick(actionIndex, e);
            });
        });
        
        // Touch эффекты
        this.element.addEventListener('touchstart', () => {
            if (this.options.clickable) {
                this.element.classList.add('card--pressed');
            }
        });
        
        this.element.addEventListener('touchend', () => {
            this.element.classList.remove('card--pressed');
        });
        
        this.element.addEventListener('touchcancel', () => {
            this.element.classList.remove('card--pressed');
        });
    }
    
    /**
     * 👆 Навешивание swipe обработчиков
     */
    attachSwipeListeners() {
        this.element.addEventListener('touchstart', (e) => {
            this.swipeStartX = e.touches[0].clientX;
            this.swipeStartY = e.touches[0].clientY;
        });
        
        this.element.addEventListener('touchmove', (e) => {
            if (!this.swipeStartX || !this.swipeStartY) return;
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            
            const diffX = this.swipeStartX - currentX;
            const diffY = this.swipeStartY - currentY;
            
            // Определяем направление свайпа
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > 50) { // Минимальное расстояние
                    const direction = diffX > 0 ? 'left' : 'right';
                    this.handleSwipe(direction, e);
                    this.resetSwipe();
                }
            }
        });
        
        this.element.addEventListener('touchend', () => {
            this.resetSwipe();
        });
    }
    
    /**
     * 🎯 Обработчик клика по карточке
     */
    handleClick(event) {
        if (!this.options.clickable) return;
        
        // Haptic feedback
        this.triggerHaptic();
        
        // Вызов колбэка
        if (this.options.onClick) {
            this.options.onClick(event, this);
        }
    }
    
    /**
     * 🔲 Обработчик клика по действию
     */
    handleActionClick(actionIndex, event) {
        const action = this.options.actions[actionIndex];
        if (!action) return;
        
        // Haptic feedback
        this.triggerHaptic();
        
        // Вызов колбэка действия
        if (action.onClick) {
            action.onClick(event, this, action);
        }
    }
    
    /**
     * 👆 Обработчик свайпа
     */
    handleSwipe(direction, event) {
        // Haptic feedback
        this.triggerHaptic('medium');
        
        // Вызов колбэка свайпа
        if (this.options.onSwipe) {
            this.options.onSwipe(direction, event, this);
        }
    }
    
    /**
     * 🔄 Сброс состояния свайпа
     */
    resetSwipe() {
        this.swipeStartX = 0;
        this.swipeStartY = 0;
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic(type = null) {
        const hapticType = type || this.options.haptic;
        if (hapticType === 'none') return;
        
        if (this.telegram && this.telegram.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred(hapticType);
        }
    }
    
    /**
     * 🔄 Обновление данных карточки
     */
    updateData(newData) {
        this.options.data = { ...this.options.data, ...newData };
        this.element.innerHTML = this.getContent();
        this.attachEventListeners();
    }
    
    /**
     * ⏳ Установка состояния загрузки
     */
    setLoading(loading = true) {
        this.options.loading = loading;
        this.options.error = null;
        
        if (loading) {
            this.element.classList.add('card--loading');
            this.element.classList.remove('card--error');
        } else {
            this.element.classList.remove('card--loading');
        }
        
        this.element.innerHTML = this.getContent();
        this.attachEventListeners();
    }
    
    /**
     * ⚠️ Установка состояния ошибки
     */
    setError(error) {
        this.options.error = error;
        this.options.loading = false;
        
        this.element.classList.add('card--error');
        this.element.classList.remove('card--loading');
        
        this.element.innerHTML = this.getContent();
        this.attachEventListeners();
    }
    
    /**
     * 🔄 Повторная попытка (для состояния ошибки)
     */
    retry() {
        if (this.options.onRetry) {
            this.setLoading(true);
            this.options.onRetry(this);
        }
    }
    
    /**
     * 🎪 Анимация привлечения внимания
     */
    highlight(duration = 2000) {
        this.element.classList.add('card--highlighted');
        setTimeout(() => {
            this.element.classList.remove('card--highlighted');
        }, duration);
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
     * Создание карточки статистики
     */
    static stat(value, label, options = {}) {
        return new Card({
            type: 'stat',
            data: { value, label },
            ...options
        });
    }
    
    /**
     * Создание карточки цитаты
     */
    static quote(text, author, options = {}) {
        return new Card({
            type: 'quote',
            data: { text, author },
            ...options
        });
    }
    
    /**
     * Создание карточки книги
     */
    static book(title, author, options = {}) {
        return new Card({
            type: 'book',
            data: { title, author },
            clickable: true,
            ...options
        });
    }
    
    /**
     * Создание карточки достижения
     */
    static achievement(title, description, unlocked, options = {}) {
        return new Card({
            type: 'achievement',
            data: { title, description, unlocked },
            ...options
        });
    }
}

// 📤 Экспорт класса
window.Card = Card;