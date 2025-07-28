/**
 * 📖 ДНЕВНИК ЦИТАТ - DiaryPage.js
 * 
 * Функциональность:
 * - 3 таба: ✍️ Добавить, 📚 Мои цитаты, 🔍 Поиск
 * - Форма добавления цитаты с AI анализом
 * - Список цитат с фильтрами и действиями
 * - Поиск по цитатам с расширенными фильтрами
 * - Редактирование и удаление цитат
 * - Интеграция с API и реактивным состоянием
 */

class DiaryPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние страницы
        this.activeTab = 'add'; // add, my-quotes, search
        this.currentFilter = 'all'; // all, favorites, this-week, by-author
        this.searchQuery = '';
        this.searchFilters = {
            author: '',
            category: '',
            dateFrom: '',
            dateTo: ''
        };
        
        // Состояние формы
        this.formData = {
            text: '',
            author: '',
            source: '',
            tags: []
        };
        
        // Пагинация
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.hasMore = true;
        
        // Подписки
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
        this.loadInitialData();
    }
    
    /**
     * 📡 Настройка подписок
     */
    setupSubscriptions() {
        // Подписка на изменения цитат
        const quotesSubscription = this.state.subscribe('quotes', (quotes) => {
            this.updateQuotesUI(quotes);
        });
        
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(quotesSubscription, statsSubscription);
    }
    
    /**
     * 📊 Загрузка начальных данных
     */
    async loadInitialData() {
        try {
            // Загружаем последние цитаты для таба "Мои цитаты"
            await this.loadQuotes();
            
            // Обновляем статистику
            await this.loadStats();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных дневника:', error);
            this.showError('Не удалось загрузить данные');
        }
    }
    
    /**
     * 📝 Загрузка цитат
     */
    async loadQuotes(reset = false) {
        try {
            if (reset) {
                this.currentPage = 1;
                this.hasMore = true;
            }
            
            const params = {
                page: this.currentPage,
                limit: this.itemsPerPage,
                sort: 'createdAt',
                order: 'desc'
            };
            
            // Применяем фильтры
            if (this.currentFilter === 'favorites') {
                params.favorites = true;
            } else if (this.currentFilter === 'this-week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                params.dateFrom = weekAgo.toISOString();
            }
            
            const response = await this.api.getQuotes(params);
            const quotes = response.items || response || [];
            
            // Обновляем состояние
            if (reset || this.currentPage === 1) {
                this.state.set('quotes.items', quotes);
            } else {
                const existingQuotes = this.state.get('quotes.items') || [];
                this.state.set('quotes.items', [...existingQuotes, ...quotes]);
            }
            
            this.state.update('quotes', {
                total: response.total || quotes.length,
                loading: false,
                lastUpdate: Date.now()
            });
            
            this.hasMore = quotes.length === this.itemsPerPage;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки цитат:', error);
            this.state.set('quotes.loading', false);
        }
    }
    
    /**
     * 📈 Загрузка статистики
     */
    async loadStats() {
        try {
            const stats = await this.api.getStats();
            this.state.set('stats', stats);
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки
     */
    render() {
        return `
            <div class="diary-page">
                <div class="page-header">📖 Дневник цитат</div>
                <div class="content">
                    ${this.renderTabs()}
                    ${this.renderTabContent()}
                </div>
            </div>
        `;
    }
    
    /**
     * 📑 Рендер табов
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'add' ? 'active' : ''}" 
                        data-tab="add">✍️ Добавить</button>
                <button class="tab ${this.activeTab === 'my-quotes' ? 'active' : ''}" 
                        data-tab="my-quotes">📚 Мои цитаты</button>
                <button class="tab ${this.activeTab === 'search' ? 'active' : ''}" 
                        data-tab="search">🔍 Поиск</button>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер содержимого активного таба
     */
    renderTabContent() {
        switch (this.activeTab) {
            case 'add':
                return this.renderAddTab();
            case 'my-quotes':
                return this.renderMyQuotesTab();
            case 'search':
                return this.renderSearchTab();
            default:
                return this.renderAddTab();
        }
    }
    
    /**
     * ✍️ Рендер таба добавления цитаты
     */
    renderAddTab() {
        return `
            <div class="tab-content add-tab">
                ${this.renderAddForm()}
                ${this.renderAIInsight()}
                ${this.renderStatsInfo()}
            </div>
        `;
    }
    
    /**
     * 📝 Рендер формы добавления
     */
    renderAddForm() {
        return `
            <div class="form-section">
                <div class="form-group">
                    <label class="form-label">💭 Текст цитаты</label>
                    <textarea class="form-textarea" 
                              id="quoteText" 
                              placeholder="Введите цитату, которая вас вдохновила..."
                              maxlength="1000">${this.formData.text}</textarea>
                    <div class="char-count">
                        <span id="charCount">${this.formData.text.length}</span>/1000
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">✍️ Автор</label>
                    <input class="form-input" 
                           id="quoteAuthor" 
                           placeholder="Кто автор этих слов?"
                           value="${this.formData.author}"
                           maxlength="100">
                </div>
                
                <div class="form-group">
                    <label class="form-label">📖 Источник (необязательно)</label>
                    <input class="form-input" 
                           id="quoteSource" 
                           placeholder="Название книги, статьи или фильма"
                           value="${this.formData.source}"
                           maxlength="200">
                </div>
                
                <button class="save-btn" id="saveQuoteBtn" ${this.isFormValid() ? '' : 'disabled'}>
                    💾 Сохранить в дневник
                </button>
            </div>
        `;
    }
    
    /**
     * ✨ Рендер AI анализа
     */
    renderAIInsight() {
        const lastQuote = this.getLastAddedQuote();
        
        if (!lastQuote || !lastQuote.aiAnalysis) {
            return '';
        }
        
        return `
            <div class="ai-insight">
                <div class="ai-title">
                    <span>✨</span>
                    <span>Анализ от Анны</span>
                </div>
                <div class="ai-text">${lastQuote.aiAnalysis.summary || 'Анализируем вашу цитату...'}</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер информации о статистике
     */
    renderStatsInfo() {
        const stats = this.state.get('stats') || {};
        const quotes = this.state.get('quotes') || {};
        
        return `
            <div class="stats-summary">
                📊 У вас уже ${stats.totalQuotes || 0} цитат • 
                Вы активнее ${this.getActivityComparison()}% читателей сообщества
            </div>
        `;
    }
    
    /**
     * 📚 Рендер таба "Мои цитаты"
     */
    renderMyQuotesTab() {
        const quotes = this.state.get('quotes.items') || [];
        const loading = this.state.get('quotes.loading');
        
        return `
            <div class="tab-content my-quotes-tab">
                ${this.renderFilters()}
                ${this.renderQuotesList(quotes, loading)}
                ${this.hasMore ? this.renderLoadMoreButton() : ''}
            </div>
        `;
    }
    
    /**
     * 🔧 Рендер фильтров
     */
    renderFilters() {
        return `
            <div class="filter-tabs">
                <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" 
                        data-filter="all">Все</button>
                <button class="filter-tab ${this.currentFilter === 'favorites' ? 'active' : ''}" 
                        data-filter="favorites">Избранные</button>
                <button class="filter-tab ${this.currentFilter === 'this-week' ? 'active' : ''}" 
                        data-filter="this-week">Эта неделя</button>
                <button class="filter-tab ${this.currentFilter === 'by-author' ? 'active' : ''}" 
                        data-filter="by-author">По автору</button>
            </div>
        `;
    }
    
    /**
     * 📋 Рендер списка цитат
     */
    renderQuotesList(quotes, loading) {
        if (loading && quotes.length === 0) {
            return `<div class="loading-state">⏳ Загружаем ваши цитаты...</div>`;
        }
        
        if (quotes.length === 0) {
            return this.renderEmptyQuotes();
        }
        
        return `
            <div class="quotes-list" id="quotesList">
                ${quotes.map(quote => this.renderQuoteItem(quote)).join('')}
            </div>
        `;
    }
    
    /**
     * 📝 Рендер элемента цитаты
     */
    renderQuoteItem(quote) {
        const createdAt = new Date(quote.createdAt).toLocaleDateString('ru-RU');
        const isFavorite = quote.isFavorite || false;
        
        return `
            <div class="quote-item" data-quote-id="${quote._id}">
                <div class="quote-text">"${quote.text}"</div>
                <div class="quote-meta">
                    <span class="quote-author">${quote.author || 'Неизвестный автор'}</span>
                    <div class="quote-actions">
                        <button class="quote-action favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-action="favorite" 
                                title="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}">
                            ${isFavorite ? '❤️' : '🤍'}
                        </button>
                        <button class="quote-action" data-action="edit" title="Редактировать">✏️</button>
                        <button class="quote-action" data-action="more" title="Еще">⋯</button>
                    </div>
                </div>
                <div class="quote-date">${createdAt}</div>
                ${quote.source ? `<div class="quote-source">📖 ${quote.source}</div>` : ''}
            </div>
        `;
    }
    
    /**
     * 📭 Рендер пустого состояния
     */
    renderEmptyQuotes() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div class="empty-title">Пока нет цитат</div>
                <div class="empty-text">Начните собирать вдохновляющие мысли!</div>
                <button class="empty-action" onclick="this.switchTab('add')">
                    ✍️ Добавить первую цитату
                </button>
            </div>
        `;
    }
    
    /**
     * ⬇️ Рендер кнопки "Загрузить еще"
     */
    renderLoadMoreButton() {
        return `
            <button class="load-more-btn" id="loadMoreBtn">
                📚 Загрузить еще цитаты
            </button>
        `;
    }
    
    /**
     * 🔍 Рендер таба поиска
     */
    renderSearchTab() {
        return `
            <div class="tab-content search-tab">
                ${this.renderSearchForm()}
                ${this.renderSearchResults()}
            </div>
        `;
    }
    
    /**
     * 🔎 Рендер формы поиска
     */
    renderSearchForm() {
        return `
            <div class="search-form">
                <div class="search-input-group">
                    <input class="search-input" 
                           id="searchInput"
                           placeholder="Поиск по тексту цитаты..."
                           value="${this.searchQuery}">
                    <button class="search-btn" id="searchBtn">🔍</button>
                </div>
                
                <div class="advanced-filters" id="advancedFilters">
                    <div class="filter-row">
                        <input class="filter-input" 
                               id="authorFilter"
                               placeholder="Автор"
                               value="${this.searchFilters.author}">
                        <input class="filter-input" 
                               id="categoryFilter"
                               placeholder="Категория"
                               value="${this.searchFilters.category}">
                    </div>
                    <div class="filter-row">
                        <input class="filter-input" 
                               type="date" 
                               id="dateFromFilter"
                               value="${this.searchFilters.dateFrom}">
                        <input class="filter-input" 
                               type="date" 
                               id="dateToFilter"
                               value="${this.searchFilters.dateTo}">
                    </div>
                </div>
                
                <button class="toggle-filters-btn" id="toggleFiltersBtn">
                    🔧 Расширенные фильтры
                </button>
            </div>
        `;
    }
    
    /**
     * 📋 Рендер результатов поиска
     */
    renderSearchResults() {
        // Здесь будут отображаться результаты поиска
        // Аналогично renderQuotesList, но с подсветкой найденного текста
        return `
            <div class="search-results" id="searchResults">
                <div class="search-placeholder">
                    🔍 Введите запрос для поиска по вашим цитатам
                </div>
            </div>
        `;
    }
    
    /**
     * 🎯 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Переключение табов
        this.attachTabListeners();
        
        // Форма добавления
        this.attachFormListeners();
        
        // Фильтры цитат
        this.attachFilterListeners();
        
        // Действия с цитатами
        this.attachQuoteActionListeners();
        
        // Поиск
        this.attachSearchListeners();
        
        // Загрузка еще
        this.attachLoadMoreListener();
    }
    
    /**
     * 📑 Обработчики табов
     */
    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    /**
     * 📝 Обработчики формы
     */
    attachFormListeners() {
        const quoteText = document.getElementById('quoteText');
        const quoteAuthor = document.getElementById('quoteAuthor');
        const quoteSource = document.getElementById('quoteSource');
        const saveBtn = document.getElementById('saveQuoteBtn');
        const charCount = document.getElementById('charCount');
        
        if (quoteText) {
            quoteText.addEventListener('input', (e) => {
                this.formData.text = e.target.value;
                if (charCount) {
                    charCount.textContent = e.target.value.length;
                }
                this.updateSaveButtonState();
            });
        }
        
        if (quoteAuthor) {
            quoteAuthor.addEventListener('input', (e) => {
                this.formData.author = e.target.value;
                this.updateSaveButtonState();
            });
        }
        
        if (quoteSource) {
            quoteSource.addEventListener('input', (e) => {
                this.formData.source = e.target.value;
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSaveQuote());
        }
    }
    
    /**
     * 🔧 Обработчики фильтров
     */
    attachFilterListeners() {
        const filterTabs = document.querySelectorAll('.filter-tab[data-filter]');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const filter = tab.dataset.filter;
                this.applyFilter(filter);
            });
        });
    }
    
    /**
     * 📝 Обработчики действий с цитатами
     */
    attachQuoteActionListeners() {
        const quoteActions = document.querySelectorAll('.quote-action[data-action]');
        quoteActions.forEach(action => {
            action.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = action.dataset.action;
                const quoteItem = action.closest('.quote-item');
                const quoteId = quoteItem?.dataset.quoteId;
                
                if (quoteId) {
                    this.handleQuoteAction(actionType, quoteId);
                }
            });
        });
    }
    
    /**
     * 🔍 Обработчики поиска
     */
    attachSearchListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', () => this.toggleAdvancedFilters());
        }
    }
    
    /**
     * ⬇️ Обработчик загрузки еще
     */
    attachLoadMoreListener() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreQuotes());
        }
    }
    
    /**
     * 📑 Переключение таба
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        this.telegram.hapticFeedback('light');
        
        // Перерендер страницы
        this.rerender();
        
        // Загрузка данных для нового таба
        if (tabName === 'my-quotes') {
            this.loadQuotes(true);
        }
    }
    
    /**
     * 💾 Сохранение цитаты
     */
    async handleSaveQuote() {
        if (!this.isFormValid()) return;
        
        try {
            this.telegram.hapticFeedback('medium');
            
            const quoteData = {
                text: this.formData.text.trim(),
                author: this.formData.author.trim(),
                source: this.formData.source.trim() || undefined,
                tags: this.formData.tags
            };
            
            // Показать состояние загрузки
            const saveBtn = document.getElementById('saveQuoteBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '💾 Сохраняем...';
            }
            
            const savedQuote = await this.api.addQuote(quoteData);
            
            // Обновить состояние
            const existingQuotes = this.state.get('quotes.items') || [];
            this.state.set('quotes.items', [savedQuote, ...existingQuotes]);
            
            // Обновить статистику
            const stats = this.state.get('stats') || {};
            this.state.update('stats', {
                totalQuotes: (stats.totalQuotes || 0) + 1,
                thisWeek: (stats.thisWeek || 0) + 1
            });
            
            // Очистить форму
            this.clearForm();
            
            // Показать успех
            this.showSuccess('✅ Цитата сохранена в дневник!');
            
            // Haptic feedback успеха
            this.telegram.hapticFeedback('success');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения цитаты:', error);
            this.showError('Не удалось сохранить цитату');
            this.telegram.hapticFeedback('error');
        } finally {
            // Восстановить кнопку
            const saveBtn = document.getElementById('saveQuoteBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Сохранить в дневник';
            }
        }
    }
    
    /**
     * 🔧 Применение фильтра
     */
    async applyFilter(filter) {
        this.currentFilter = filter;
        this.telegram.hapticFeedback('light');
        
        // Обновить UI фильтров
        this.updateFilterUI();
        
        // Загрузить отфильтрованные цитаты
        await this.loadQuotes(true);
    }
    
    /**
     * 📝 Обработка действий с цитатами
     */
    async handleQuoteAction(actionType, quoteId) {
        this.telegram.hapticFeedback('light');
        
        switch (actionType) {
            case 'favorite':
                await this.toggleFavorite(quoteId);
                break;
            case 'edit':
                this.editQuote(quoteId);
                break;
            case 'more':
                this.showQuoteMenu(quoteId);
                break;
        }
    }
    
    /**
     * ❤️ Переключение избранного
     */
    async toggleFavorite(quoteId) {
        try {
            const quotes = this.state.get('quotes.items') || [];
            const quote = quotes.find(q => q._id === quoteId);
            
            if (!quote) return;
            
            const newFavoriteStatus = !quote.isFavorite;
            
            // Обновить на сервере
            await this.api.updateQuote(quoteId, { isFavorite: newFavoriteStatus });
            
            // Обновить локальное состояние
            quote.isFavorite = newFavoriteStatus;
            this.state.set('quotes.items', [...quotes]);
            
            this.telegram.hapticFeedback('success');
            
        } catch (error) {
            console.error('❌ Ошибка обновления избранного:', error);
            this.showError('Не удалось обновить избранное');
        }
    }
    
    /**
     * 🔍 Выполнение поиска
     */
    async performSearch() {
        if (!this.searchQuery.trim()) return;
        
        try {
            this.telegram.hapticFeedback('light');
            
            const searchParams = {
                query: this.searchQuery,
                ...this.searchFilters
            };
            
            const results = await this.api.searchQuotes(searchParams);
            this.updateSearchResults(results);
            
        } catch (error) {
            console.error('❌ Ошибка поиска:', error);
            this.showError('Ошибка поиска');
        }
    }
    
    /**
     * ⬇️ Загрузка дополнительных цитат
     */
    async loadMoreQuotes() {
        if (!this.hasMore) return;
        
        this.currentPage++;
        await this.loadQuotes();
    }
    
    /**
     * 🧹 Вспомогательные методы
     */
    
    isFormValid() {
        return this.formData.text.trim().length > 0 && 
               this.formData.author.trim().length > 0;
    }
    
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveQuoteBtn');
        if (saveBtn) {
            saveBtn.disabled = !this.isFormValid();
        }
    }
    
    clearForm() {
        this.formData = { text: '', author: '', source: '', tags: [] };
        
        const quoteText = document.getElementById('quoteText');
        const quoteAuthor = document.getElementById('quoteAuthor');
        const quoteSource = document.getElementById('quoteSource');
        const charCount = document.getElementById('charCount');
        
        if (quoteText) quoteText.value = '';
        if (quoteAuthor) quoteAuthor.value = '';
        if (quoteSource) quoteSource.value = '';
        if (charCount) charCount.textContent = '0';
    }
    
    getLastAddedQuote() {
        const quotes = this.state.get('quotes.items') || [];
        return quotes[0];
    }
    
    getActivityComparison() {
        // Простая формула для сравнения активности
        const totalQuotes = this.state.get('stats.totalQuotes') || 0;
        return Math.min(Math.round(totalQuotes * 2.5), 95);
    }
    
    updateFilterUI() {
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            const filter = tab.dataset.filter;
            tab.classList.toggle('active', filter === this.currentFilter);
        });
    }
    
    updateQuotesUI(quotes) {
        const quotesList = document.getElementById('quotesList');
        if (quotesList && quotes.items) {
            quotesList.innerHTML = quotes.items
                .map(quote => this.renderQuoteItem(quote))
                .join('');
            this.attachQuoteActionListeners();
        }
    }
    
    updateStatsUI(stats) {
        const statsElement = document.querySelector('.stats-summary');
        if (statsElement && stats) {
            statsElement.innerHTML = `
                📊 У вас уже ${stats.totalQuotes || 0} цитат • 
                Вы активнее ${this.getActivityComparison()}% читателей сообщества
            `;
        }
    }
    
    updateSearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;
        
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="no-results">
                    🔍 По запросу "${this.searchQuery}" ничего не найдено
                </div>
            `;
        } else {
            searchResults.innerHTML = results
                .map(quote => this.renderQuoteItem(quote))
                .join('');
            this.attachQuoteActionListeners();
        }
    }
    
    toggleAdvancedFilters() {
        const filters = document.getElementById('advancedFilters');
        if (filters) {
            filters.classList.toggle('visible');
        }
    }
    
    showSuccess(message) {
        // Можно добавить toast уведомление
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    showError(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    rerender() {
        const container = document.querySelector('.diary-page .content');
        if (container) {
            container.innerHTML = `
                ${this.renderTabs()}
                ${this.renderTabContent()}
            `;
            this.attachEventListeners();
        }
    }
    
    /**
     * 🧹 Очистка при уничтожении
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
    }
}

// 📤 Экспорт класса
window.DiaryPage = DiaryPage;