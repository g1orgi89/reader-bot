/**
 * 🎴 QUOTE CARD COMPONENT
 * Карточка отдельной цитаты в стиле Анны Бусел
 * 
 * Функциональность:
 * - Отображение цитаты, автора, AI-анализа
 * - CRUD операции: редактирование, удаление, избранное
 * - Swipe-actions для мобильного UX
 * - Интеграция с API Service и State Management
 * - Telegram haptic feedback
 * 
 * @author Claude
 * @version 2.0.0
 * @since 28.07.2025
 */

class QuoteCard {
    /**
     * @param {Object} quote - Объект цитаты
     * @param {string} quote.id - ID цитаты
     * @param {string} quote.text - Текст цитаты
     * @param {string} quote.author - Автор цитаты
     * @param {Object} quote.aiAnalysis - AI анализ
     * @param {Date} quote.createdAt - Дата создания
     * @param {boolean} quote.isFavorite - Избранная или нет
     * @param {string} quote.source - Источник (book/manual)
     * @param {Object} options - Опции компонента
     */
    constructor(quote, options = {}) {
        this.quote = quote;
        this.options = {
            showActions: true,
            showAiAnalysis: true,
            showDate: true,
            allowSwipe: true,
            compact: false,
            theme: 'auto', // auto, light, dark
            ...options
        };

        // Зависимости
        this.api = window.apiService;
        this.state = window.appState;
        this.storage = window.storageService;
        this.telegram = window.Telegram?.WebApp;

        // DOM элементы
        this.element = null;
        this.container = null;

        // Состояние компонента
        this.isEditing = false;
        this.isDeleting = false;
        this.swipeState = {
            startX: 0,
            currentX: 0,
            isSwiping: false,
            threshold: 80
        };

        // Инициализация
        this.init();
    }

    /**
     * Инициализация компонента
     */
    init() {
        this.createElement();
        this.attachEventListeners();
        this.setupSwipeActions();
        
        // Подписка на изменения состояния
        if (this.state) {
            this.state.subscribe(`quotes.items`, this.handleQuoteUpdate.bind(this));
        }
    }

    /**
     * Создание DOM элемента карточки
     */
    createElement() {
        // Определяем тему
        const theme = this.getTheme();
        const compactClass = this.options.compact ? 'quote-card--compact' : '';
        
        // Создаем основной контейнер
        this.element = document.createElement('div');
        this.element.className = `quote-card ${compactClass} quote-card--${theme}`;
        this.element.setAttribute('data-quote-id', this.quote.id);
        
        // Создаем внутренний контейнер для swipe
        this.container = document.createElement('div');
        this.container.className = 'quote-card__container';
        
        this.container.innerHTML = this.renderContent();
        this.element.appendChild(this.container);

        // Добавляем экшены для swipe
        if (this.options.allowSwipe) {
            this.element.appendChild(this.renderSwipeActions());
        }
    }

    /**
     * Рендер основного содержимого карточки
     */
    renderContent() {
        const aiCategory = this.quote.aiAnalysis?.category || 'wisdom';
        const categoryColor = this.getCategoryColor(aiCategory);
        const formattedDate = this.formatDate(this.quote.createdAt);

        return `
            <div class="quote-card__main">
                <!-- Категория AI-анализа -->
                <div class="quote-card__category" style="--category-color: ${categoryColor}">
                    <span class="quote-card__category-dot"></span>
                    <span class="quote-card__category-text">${this.getCategoryName(aiCategory)}</span>
                </div>

                <!-- Текст цитаты -->
                <div class="quote-card__quote">
                    <div class="quote-card__quote-text">
                        "${this.escapeHtml(this.quote.text)}"
                    </div>
                </div>

                <!-- Автор и метаданные -->
                <div class="quote-card__meta">
                    <div class="quote-card__author">
                        <span class="quote-card__author-icon">✍️</span>
                        <span class="quote-card__author-name">
                            ${this.escapeHtml(this.quote.author || 'Неизвестный автор')}
                        </span>
                    </div>
                    
                    ${this.options.showDate ? `
                        <div class="quote-card__date">
                            <span class="quote-card__date-icon">📅</span>
                            <span class="quote-card__date-text">${formattedDate}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- AI-анализ -->
                ${this.options.showAiAnalysis && this.quote.aiAnalysis ? `
                    <div class="quote-card__ai-analysis">
                        <div class="quote-card__ai-title">
                            <span class="quote-card__ai-icon">✨</span>
                            <span>Анализ от Анны</span>
                        </div>
                        <div class="quote-card__ai-text">
                            ${this.escapeHtml(this.quote.aiAnalysis.insight || this.quote.aiAnalysis.insights || this.quote.aiAnalysis.summary || 'Анализируется...')}
                        </div>
                    </div>
                ` : ''}

                <!-- Действия -->
                ${this.options.showActions ? this.renderActions() : ''}
            </div>
        `;
    }

    /**
     * Рендер действий карточки
     */
    renderActions() {
        const favoriteIcon = this.quote.isFavorite ? '❤️' : '🤍';
        const favoriteClass = this.quote.isFavorite ? 'quote-card__action--active' : '';

        return `
            <div class="quote-card__actions">
                <button class="quote-card__action quote-card__action--favorite ${favoriteClass}" 
                        data-action="favorite" 
                        title="${this.quote.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                    <span class="quote-card__action-icon">${favoriteIcon}</span>
                    <span class="quote-card__action-label">Избранное</span>
                </button>
                
                <button class="quote-card__action" data-action="edit" title="Редактировать">
                    <span class="quote-card__action-icon">✏️</span>
                    <span class="quote-card__action-label">Изменить</span>
                </button>
                
                <button class="quote-card__action" data-action="share" title="Поделиться">
                    <span class="quote-card__action-icon">📤</span>
                    <span class="quote-card__action-label">Поделиться</span>
                </button>
                
                <button class="quote-card__action quote-card__action--more" data-action="more" title="Ещё">
                    <span class="quote-card__action-icon">⋯</span>
                    <span class="quote-card__action-label">Ещё</span>
                </button>
            </div>
        `;
    }

    /**
     * Рендер swipe-действий
     */
    renderSwipeActions() {
        const swipeActions = document.createElement('div');
        swipeActions.className = 'quote-card__swipe-actions';
        
        swipeActions.innerHTML = `
            <div class="quote-card__swipe-actions-left">
                <button class="quote-card__swipe-action quote-card__swipe-action--favorite" data-swipe-action="favorite">
                    <span class="quote-card__swipe-icon">${this.quote.isFavorite ? '❤️' : '🤍'}</span>
                </button>
            </div>
            
            <div class="quote-card__swipe-actions-right">
                <button class="quote-card__swipe-action quote-card__swipe-action--edit" data-swipe-action="edit">
                    <span class="quote-card__swipe-icon">✏️</span>
                </button>
                <button class="quote-card__swipe-action quote-card__swipe-action--delete" data-swipe-action="delete">
                    <span class="quote-card__swipe-icon">🗑️</span>
                </button>
            </div>
        `;

        return swipeActions;
    }

    /**
     * Настройка обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;

        // Клики по действиям
        this.element.addEventListener('click', this.handleActionClick.bind(this));
        
        // Telegram haptic feedback
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
        
        // Long press для контекстного меню
        this.element.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    }

    /**
     * Настройка swipe-действий
     */
    setupSwipeActions() {
        if (!this.options.allowSwipe || !this.container) return;

        let startTime;
        
        // Touch события для swipe
        this.container.addEventListener('touchstart', (e) => {
            startTime = Date.now();
            this.swipeState.startX = e.touches[0].clientX;
            this.swipeState.isSwiping = false;
        });

        this.container.addEventListener('touchmove', (e) => {
            if (!this.swipeState.startX) return;
            
            this.swipeState.currentX = e.touches[0].clientX;
            const diffX = this.swipeState.currentX - this.swipeState.startX;
            
            // Начинаем swipe если прошло достаточно времени и расстояния
            if (Math.abs(diffX) > 10 && Date.now() - startTime > 100) {
                this.swipeState.isSwiping = true;
                e.preventDefault();
                
                this.updateSwipePosition(diffX);
            }
        });

        this.container.addEventListener('touchend', () => {
            if (this.swipeState.isSwiping) {
                this.handleSwipeEnd();
            }
            this.resetSwipeState();
        });
    }

    /**
     * Обновление позиции при swipe
     */
    updateSwipePosition(diffX) {
        const maxDistance = 100;
        const clampedDiff = Math.max(-maxDistance, Math.min(maxDistance, diffX));
        
        this.container.style.transform = `translateX(${clampedDiff}px)`;
        this.container.style.transition = 'none';
        
        // Показываем соответствующие действия
        const swipeActions = this.element.querySelector('.quote-card__swipe-actions');
        if (swipeActions) {
            if (clampedDiff > 0) {
                swipeActions.classList.add('quote-card__swipe-actions--left-visible');
                swipeActions.classList.remove('quote-card__swipe-actions--right-visible');
            } else if (clampedDiff < 0) {
                swipeActions.classList.add('quote-card__swipe-actions--right-visible');
                swipeActions.classList.remove('quote-card__swipe-actions--left-visible');
            }
        }
    }

    /**
     * Обработка завершения swipe
     */
    handleSwipeEnd() {
        const diffX = this.swipeState.currentX - this.swipeState.startX;
        
        this.container.style.transition = 'transform 0.3s ease';
        
        if (Math.abs(diffX) > this.swipeState.threshold) {
            // Выполняем действие
            if (diffX > 0) {
                this.toggleFavorite();
            } else {
                this.showQuickActions();
            }
        }
        
        // Возвращаем в исходное положение
        setTimeout(() => {
            this.container.style.transform = 'translateX(0)';
            const swipeActions = this.element.querySelector('.quote-card__swipe-actions');
            if (swipeActions) {
                swipeActions.classList.remove(
                    'quote-card__swipe-actions--left-visible',
                    'quote-card__swipe-actions--right-visible'
                );
            }
        }, 100);
    }

    /**
     * Сброс состояния swipe
     */
    resetSwipeState() {
        this.swipeState.startX = 0;
        this.swipeState.currentX = 0;
        this.swipeState.isSwiping = false;
    }

    /**
     * Обработка кликов по действиям
     */
    handleActionClick(e) {
        const action = e.target.closest('[data-action], [data-swipe-action]');
        if (!action) return;

        const actionType = action.dataset.action || action.dataset.swipeAction;
        
        // Haptic feedback для Telegram
        this.triggerHapticFeedback('light');
        
        switch (actionType) {
            case 'favorite':
                this.toggleFavorite();
                break;
            case 'edit':
                this.editQuote();
                break;
            case 'share':
                this.shareQuote();
                break;
            case 'delete':
                this.deleteQuote();
                break;
            case 'more':
                this.showMoreActions();
                break;
        }
        
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Переключение избранного
     */
    async toggleFavorite() {
        if (!this.api) return;

        try {
            this.updateLoadingState('favorite', true);
            
            const updatedQuote = await this.api.updateQuote(this.quote.id, {
                text: this.quote.text,
                author: this.quote.author,
                isFavorite: !this.quote.isFavorite,
                source: quote.source
            });
            
            this.quote.isFavorite = updatedQuote.isFavorite;
            this.updateFavoriteUI();
            
            // Обновляем состояние
            if (this.state) {
                this.state.updateQuoteInList(this.quote.id, updatedQuote);
            }
            
            // Haptic feedback
            this.triggerHapticFeedback('success');
            
        } catch (error) {
            console.error('Ошибка при обновлении избранного:', error);
            this.showError('Не удалось обновить избранное');
            this.triggerHapticFeedback('error');
        } finally {
            this.updateLoadingState('favorite', false);
        }
    }

    /**
     * Редактирование цитаты
     */
    editQuote() {
        if (this.isEditing) return;

        this.isEditing = true;
        
        // Создаем inline-редактор
        const quoteText = this.element.querySelector('.quote-card__quote-text');
        const authorName = this.element.querySelector('.quote-card__author-name');
        
        if (quoteText && authorName) {
            this.createInlineEditor(quoteText, authorName);
        }
    }

    /**
     * Создание inline-редактора
     */
    createInlineEditor(quoteElement, authorElement) {
        // Сохраняем оригинальные значения
        const originalQuote = this.quote.text;
        const originalAuthor = this.quote.author;

        // Заменяем на текстовые поля
        quoteElement.innerHTML = `
            <textarea class="quote-card__edit-textarea" rows="3">${this.escapeHtml(originalQuote)}</textarea>
        `;
        
        authorElement.innerHTML = `
            <input class="quote-card__edit-input" type="text" value="${this.escapeHtml(originalAuthor || '')}" placeholder="Автор">
        `;

        // Добавляем кнопки сохранения/отмены
        const actionsContainer = this.element.querySelector('.quote-card__actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <button class="quote-card__action quote-card__action--save" data-action="save-edit">
                    <span class="quote-card__action-icon">✅</span>
                    <span class="quote-card__action-label">Сохранить</span>
                </button>
                <button class="quote-card__action quote-card__action--cancel" data-action="cancel-edit">
                    <span class="quote-card__action-icon">❌</span>
                    <span class="quote-card__action-label">Отмена</span>
                </button>
            `;
        }

        // Фокус на текстовое поле
        const textarea = quoteElement.querySelector('.quote-card__edit-textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }

        // Обработчики для кнопок редактирования
        const saveBtn = this.element.querySelector('[data-action="save-edit"]');
        const cancelBtn = this.element.querySelector('[data-action="cancel-edit"]');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveEdit());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit(originalQuote, originalAuthor));
        }

        // ESC для отмены, Ctrl+Enter для сохранения
        textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelEdit(originalQuote, originalAuthor);
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.saveEdit();
            }
        });
    }

    /**
     * Сохранение изменений
     */
    async saveEdit() {
        const textarea = this.element.querySelector('.quote-card__edit-textarea');
        const input = this.element.querySelector('.quote-card__edit-input');
        
        if (!textarea || !input) return;

        const newText = textarea.value.trim();
        const newAuthor = input.value.trim();

        if (!newText) {
            this.showError('Текст цитаты не может быть пустым');
            return;
        }

        try {
            this.updateLoadingState('edit', true);
            
            const updatedQuote = await this.api.updateQuote(this.quote.id, {
                text: newText,
                author: newAuthor || 'Неизвестный автор'
            });
            
            this.quote = { ...this.quote, ...updatedQuote };
            
            // Обновляем состояние
            if (this.state) {
                this.state.updateQuoteInList(this.quote.id, this.quote);
            }
            
            // Перерендериваем карточку
            this.container.innerHTML = this.renderContent();
            this.isEditing = false;
            
            this.triggerHapticFeedback('success');
            
        } catch (error) {
            console.error('Ошибка при сохранении цитаты:', error);
            this.showError('Не удалось сохранить изменения');
            this.triggerHapticFeedback('error');
        } finally {
            this.updateLoadingState('edit', false);
        }
    }

    /**
     * Отмена редактирования
     */
    cancelEdit(originalQuote, originalAuthor) {
        this.isEditing = false;
        this.container.innerHTML = this.renderContent();
    }

    /**
     * Поделиться цитатой
     */
    shareQuote() {
        const shareText = `"${this.quote.text}"\n\n— ${this.quote.author}\n\n📱 Найдено в приложении Reader Bot`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Цитата от Reader Bot',
                text: shareText,
                url: window.location.href
            }).catch(err => console.log('Ошибка при шеринге:', err));
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.showSuccess('Цитата скопирована в буфер обмена');
            });
        } else {
            // Fallback - показываем модальное окно с текстом
            this.showShareModal(shareText);
        }
    }

    /**
     * Удаление цитаты
     */
    async deleteQuote() {
        if (this.isDeleting) return;

        // Подтверждение удаления
        const confirmed = await this.showConfirmDialog(
            'Удалить цитату?',
            'Это действие нельзя будет отменить.'
        );
        
        if (!confirmed) return;

        try {
            this.isDeleting = true;
            this.updateLoadingState('delete', true);
            
            await this.api.deleteQuote(this.quote.id);
            
            // Обновляем состояние
            if (this.state) {
                this.state.removeQuote(this.quote.id);
            }
            
            // Анимация удаления
            this.animateRemoval();
            
            this.triggerHapticFeedback('success');
            
        } catch (error) {
            console.error('Ошибка при удалении цитаты:', error);
            this.showError('Не удалось удалить цитату');
            this.triggerHapticFeedback('error');
            this.isDeleting = false;
        } finally {
            this.updateLoadingState('delete', false);
        }
    }

    /**
     * Показать дополнительные действия
     */
    showMoreActions() {
        const actions = [
            { label: 'Копировать текст', action: 'copy', icon: '📋' },
            { label: 'Анализировать заново', action: 'reanalyze', icon: '🔄' },
            { label: 'Добавить в отчет', action: 'add-to-report', icon: '📊' },
            { label: 'Пожаловаться', action: 'report', icon: '⚠️' }
        ];

        this.showActionSheet(actions);
    }

    /**
     * Быстрые действия после swipe
     */
    showQuickActions() {
        const actions = [
            { label: 'Редактировать', action: 'edit', icon: '✏️' },
            { label: 'Удалить', action: 'delete', icon: '🗑️' },
        ];

        this.showActionSheet(actions);
    }

    /**
     * Обновление UI для избранного
     */
    updateFavoriteUI() {
        const favoriteBtn = this.element.querySelector('[data-action="favorite"]');
        const swipeFavoriteBtn = this.element.querySelector('[data-swipe-action="favorite"]');
        
        const icon = this.quote.isFavorite ? '❤️' : '🤍';
        const title = this.quote.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное';
        
        [favoriteBtn, swipeFavoriteBtn].forEach(btn => {
            if (btn) {
                const iconElement = btn.querySelector('.quote-card__action-icon, .quote-card__swipe-icon');
                if (iconElement) iconElement.textContent = icon;
                
                btn.title = title;
                btn.classList.toggle('quote-card__action--active', this.quote.isFavorite);
            }
        });
    }

    /**
     * Состояние загрузки для действий
     */
    updateLoadingState(action, isLoading) {
        const button = this.element.querySelector(`[data-action="${action}"]`);
        if (!button) return;

        if (isLoading) {
            button.classList.add('quote-card__action--loading');
            button.disabled = true;
            
            const icon = button.querySelector('.quote-card__action-icon');
            if (icon) {
                icon.dataset.originalIcon = icon.textContent;
                icon.textContent = '⏳';
            }
        } else {
            button.classList.remove('quote-card__action--loading');
            button.disabled = false;
            
            const icon = button.querySelector('.quote-card__action-icon');
            if (icon && icon.dataset.originalIcon) {
                icon.textContent = icon.dataset.originalIcon;
                delete icon.dataset.originalIcon;
            }
        }
    }

    /**
     * Анимация удаления карточки
     */
    animateRemoval() {
        this.element.style.transition = 'all 0.3s ease';
        this.element.style.transform = 'translateX(100%)';
        this.element.style.opacity = '0';
        
        setTimeout(() => {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
        }, 300);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Получение темы оформления
     */
    getTheme() {
        if (this.options.theme !== 'auto') {
            return this.options.theme;
        }
        
        return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    }

    /**
     * Получение цвета категории AI-анализа
     */
    getCategoryColor(category) {
        const colors = {
            wisdom: '#D2452C',
            love: '#E85A42',
            growth: '#B53A23',
            philosophy: '#A0341F',
            inspiration: '#F16B52',
            reflection: '#C73E29'
        };
        
        return colors[category] || colors.wisdom;
    }

    /**
     * Получение названия категории
     */
    getCategoryName(category) {
        const names = {
            wisdom: 'Мудрость',
            love: 'Любовь',
            growth: 'Рост',
            philosophy: 'Философия',
            inspiration: 'Вдохновение',
            reflection: 'Размышления'
        };
        
        return names[category] || names.wisdom;
    }

    /**
     * Форматирование даты
     */
    formatDate(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Сегодня';
        if (diffDays === 2) return 'Вчера';
        if (diffDays <= 7) return `${diffDays} дня назад`;
        
        return d.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    /**
     * Экранирование HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Haptic feedback для Telegram
     */
    triggerHapticFeedback(type = 'light') {
        if (this.telegram?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.telegram.HapticFeedback.impactOccurred('light');
                    break;
                case 'success':
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    break;
            }
        }
    }

    /**
     * Обработка обновления цитаты через состояние
     */
    handleQuoteUpdate(quotes) {
        const updatedQuote = quotes.find(q => q.id === this.quote.id);
        if (updatedQuote && JSON.stringify(updatedQuote) !== JSON.stringify(this.quote)) {
            this.quote = updatedQuote;
            this.container.innerHTML = this.renderContent();
        }
    }

    /**
     * Показать уведомление об ошибке
     */
    showError(message) {
        // TODO: Интеграция с системой уведомлений
        console.error(message);
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        }
    }

    /**
     * Показать уведомление об успехе
     */
    showSuccess(message) {
        // TODO: Интеграция с системой уведомлений
        console.log(message);
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        }
    }

    /**
     * Показать диалог подтверждения
     */
    async showConfirmDialog(title, message) {
        if (this.telegram?.showConfirm) {
            return new Promise((resolve) => {
                this.telegram.showConfirm(message, resolve);
            });
        }
        
        return confirm(`${title}\n\n${message}`);
    }

    /**
     * Показать action sheet
     */
    showActionSheet(actions) {
        // TODO: Реализация красивого action sheet
        const actionLabels = actions.map(a => `${a.icon} ${a.label}`);
        const choice = prompt('Выберите действие:\n' + actionLabels.map((label, i) => `${i + 1}. ${label}`).join('\n'));
        
        const index = parseInt(choice) - 1;
        if (index >= 0 && index < actions.length) {
            const action = actions[index];
            this[action.action]?.() || this.handleActionClick({ target: { dataset: { action: action.action } } });
        }
    }

    /**
     * Показать модальное окно для шеринга
     */
    showShareModal(text) {
        // TODO: Реализация модального окна для шеринга
        prompt('Скопируйте текст:', text);
    }

    /**
     * Обработка касания (для haptic feedback)
     */
    handleTouchStart() {
        this.triggerHapticFeedback('light');
    }

    /**
     * Обработка контекстного меню
     */
    handleContextMenu(e) {
        e.preventDefault();
        this.showMoreActions();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Получить DOM элемент
     */
    getElement() {
        return this.element;
    }

    /**
     * Обновить данные цитаты
     */
    updateQuote(newQuote) {
        this.quote = { ...this.quote, ...newQuote };
        this.container.innerHTML = this.renderContent();
    }

    /**
     * Установить компактный режим
     */
    setCompactMode(compact) {
        this.options.compact = compact;
        this.element.classList.toggle('quote-card--compact', compact);
    }

    /**
     * Уничтожить компонент
     */
    destroy() {
        if (this.state) {
            this.state.unsubscribe(`quotes.items`, this.handleQuoteUpdate);
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.container = null;
    }
}

// ========================================
// CSS STYLES (будут в отдельном файле)
// ========================================

/**
 * Добавляем стили компонента в head
 * В продакшене это будет отдельный CSS файл
 */
if (typeof document !== 'undefined' && !document.getElementById('quote-card-styles')) {
    const styles = document.createElement('style');
    styles.id = 'quote-card-styles';
    styles.textContent = `
        .quote-card {
            position: relative;
            background: var(--surface, #FFFFFF);
            border-radius: var(--border-radius, 12px);
            margin-bottom: 16px;
            border: 1px solid var(--border, #E6E0D6);
            box-shadow: 0 2px 8px var(--shadow-color, rgba(210, 69, 44, 0.08));
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .quote-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px var(--shadow-color-strong, rgba(210, 69, 44, 0.15));
        }

        .quote-card--compact {
            margin-bottom: 8px;
        }

        .quote-card__container {
            position: relative;
            background: var(--surface, #FFFFFF);
            transition: transform 0.3s ease;
        }

        .quote-card__main {
            padding: 16px;
        }

        .quote-card__category {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 12px;
        }

        .quote-card__category-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--category-color, var(--primary-color, #D2452C));
        }

        .quote-card__category-text {
            font-size: 11px;
            font-weight: 600;
            color: var(--category-color, var(--primary-color, #D2452C));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .quote-card__quote {
            margin-bottom: 16px;
        }

        .quote-card__quote-text {
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
            font-size: 15px;
            line-height: 1.5;
            color: var(--text-primary, #2D2D2D);
            position: relative;
            padding-left: 16px;
            border-left: 3px solid var(--primary-color, #D2452C);
        }

        .quote-card__meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .quote-card__author,
        .quote-card__date {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
        }

        .quote-card__author-name {
            font-weight: 600;
            color: var(--text-primary, #2D2D2D);
        }

        .quote-card__date-text {
            color: var(--text-secondary, #666666);
        }

        .quote-card__ai-analysis {
            background: linear-gradient(135deg, var(--primary-color, #D2452C), var(--primary-dark, #B53A23));
            color: white;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .quote-card__ai-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 6px;
            opacity: 0.95;
        }

        .quote-card__ai-text {
            font-size: 12px;
            line-height: 1.4;
            opacity: 0.9;
        }

        .quote-card__actions {
            display: flex;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid var(--border-light, #F0EBE3);
        }

        .quote-card__action {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            background: none;
            border: none;
            padding: 8px 4px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--text-secondary, #666666);
        }

        .quote-card__action:hover {
            background: var(--background-light, #FAF8F3);
            color: var(--primary-color, #D2452C);
            transform: translateY(-1px);
        }

        .quote-card__action--active {
            color: var(--primary-color, #D2452C);
        }

        .quote-card__action--loading {
            opacity: 0.6;
            pointer-events: none;
        }

        .quote-card__action-icon {
            font-size: 14px;
        }

        .quote-card__action-label {
            font-size: 9px;
            font-weight: 500;
        }

        .quote-card__edit-textarea,
        .quote-card__edit-input {
            width: 100%;
            border: 2px solid var(--primary-color, #D2452C);
            border-radius: 6px;
            padding: 8px;
            font-family: inherit;
            font-size: 13px;
            background: var(--surface-warm, #FEFCF8);
            color: var(--text-primary, #2D2D2D);
            resize: vertical;
        }

        .quote-card__edit-textarea {
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
        }

        .quote-card__edit-textarea:focus,
        .quote-card__edit-input:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(210, 69, 44, 0.15);
        }

        .quote-card__swipe-actions {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            justify-content: space-between;
            z-index: -1;
        }

        .quote-card__swipe-actions-left,
        .quote-card__swipe-actions-right {
            display: flex;
            align-items: center;
            height: 100%;
        }

        .quote-card__swipe-actions-left {
            background: var(--success, #28a745);
            padding-left: 16px;
        }

        .quote-card__swipe-actions-right {
            background: var(--error, #dc3545);
            padding-right: 16px;
            gap: 8px;
        }

        .quote-card__swipe-action {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .quote-card__swipe-action:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.1);
        }

        .quote-card__swipe-icon {
            font-size: 18px;
        }

        /* Темная тема */
        .quote-card--dark {
            --surface: #2A2A2A;
            --surface-warm: #2E2824;
            --border: #404040;
            --border-light: #363636;
            --text-primary: #F0F0F0;
            --text-secondary: #B8B8B8;
            --background-light: #242424;
            --shadow-color: rgba(232, 90, 66, 0.12);
            --shadow-color-strong: rgba(232, 90, 66, 0.20);
        }

        /* Адаптивность */
        @media (max-width: 480px) {
            .quote-card__main {
                padding: 12px;
            }
            
            .quote-card__quote-text {
                font-size: 14px;
                padding-left: 12px;
            }
            
            .quote-card__actions {
                gap: 4px;
            }
            
            .quote-card__action {
                padding: 6px 2px;
            }
        }

        /* Анимации */
        @keyframes quote-card-appear {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .quote-card {
            animation: quote-card-appear 0.3s ease;
        }
    `;
    
    document.head.appendChild(styles);
}

// ========================================
// EXPORT
// ========================================

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteCard;
}

// Глобальная доступность
if (typeof window !== 'undefined') {
    window.QuoteCard = QuoteCard;
}
