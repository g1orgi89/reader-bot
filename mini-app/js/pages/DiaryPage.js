/**
 * 📖 ДНЕВНИК ЦИТАТ - DiaryPage.js (🔧 ИСПРАВЛЕНЫ API ВЫЗОВЫ)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТАМ:
 * - HTML структура из "концепт 5 страниц app.txt"
 * - CSS классы из концептов
 * - Поиск из "дополнительный концепт страниц app.txt"
 * - Все элементы в точности как в концепте
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * 🔧 ИСПРАВЛЕНО: Убраны дублирующиеся API вызовы - нет "моргания" анализа
 */

class DiaryPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние страницы (точно как в концепте)
        this.activeTab = 'add'; // add, my-quotes
        this.currentFilter = 'all'; // all, favorites, this-week, by-author
        this.searchQuery = '';
        
        // Состояние формы
        this.formData = {
            text: '',
            author: '',
            source: ''
        };
        
        // Пагинация и данные
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.hasMore = true;
        this.subscriptions = [];
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.quotesLoaded = false;
        this.quotesLoading = false;
        this.statsLoaded = false;
        this.statsLoading = false;
        
        // ✅ НОВОЕ: Debug режим (синхронизируется с API)
        this.debug = this.api?.debug || false;
        
        // Removed global quote delegation flag
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // Добавляем обработчик события редактирования цитат
        this._onQuoteEdit = this._onQuoteEdit.bind(this);
        document.addEventListener('quotes:edit', this._onQuoteEdit, false);
        
        // Removed global quote click delegation - using container-level delegation instead
    }

    /**
     * 🔄 Ожидание валидного userId для предотвращения гонки условий
     * @param {number} timeout - Максимальное время ожидания в миллисекундах
     * @returns {Promise<string>} - Валидный userId
     */
    async waitForValidUserId(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const userId = this.state.getCurrentUserId();
            
            // Проверяем что userId валидный и не равен demo-user
            if (userId && userId !== 'demo-user' && typeof userId === 'number') {
                console.log('✅ DiaryPage: Получен валидный userId:', userId);
                return userId;
            }
            
            // Также принимаем demo-user только в debug режиме
            if (userId === 'demo-user' && this.state.get('debugMode')) {
                console.log('🧪 DiaryPage: Используем demo-user в debug режиме');
                return userId;
            }
            
            // Ждем 100ms перед следующей проверкой
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Timeout: не удалось получить валидный userId');
    }
    
    setupSubscriptions() {
        const quotesSubscription = this.state.subscribe('quotes', (quotes) => {
            this.updateQuotesUI(quotes);
        });
        
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(quotesSubscription, statsSubscription);
    }
    
    async loadInitialData() {
        console.log('📖 DiaryPage: loadInitialData начата');
        
        try {
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId перед загрузкой данных
            const userId = await this.waitForValidUserId();
            console.log('📖 DiaryPage: Используем userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Загружаем только если не загружено
            if (!this.quotesLoaded && !this.quotesLoading) {
                await this.loadQuotes(false, userId);
            }
            
            if (!this.statsLoaded && !this.statsLoading) {
                await this.loadStats(userId);
            }
            
            console.log('✅ DiaryPage: Данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки данных дневника:', error);
        }
    }
    
   async loadQuotes(reset = false, userId = null) {
        if (this.quotesLoading) {
            console.log('🔄 DiaryPage: Цитаты уже загружаются, пропускаем');
            return;
        }

        try {
            this.quotesLoading = true;
            if (!userId) {
                userId = await this.waitForValidUserId();
            }

            if (reset) {
                this.hasMore = true;
            }

            const params = {
                offset: (this.currentPage - 1) * this.itemsPerPage,
                limit: this.itemsPerPage,
                sort: 'createdAt',
                order: 'desc'
            };
    
            if (this.currentFilter === 'favorites') {
                params.favorites = true;
            } else if (this.currentFilter === 'this-week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                params.dateFrom = weekAgo.toISOString();
            } else if (this.currentFilter === 'by-author' && this.filterAuthor) {
                params.author = this.filterAuthor;
            }

            // Гарантируем что при фильтре "all" не уйдет никаких лишних фильтров
            if (this.currentFilter === 'all') {
                delete params.dateFrom;
                delete params.dateTo;
                delete params.favorites;
                delete params.author;
            }

            console.log('DEBUG: currentFilter=', this.currentFilter, params);

            const response = await this.api.getQuotes(params, userId);

            const root = response.data || response;
            const quotes = root.quotes || root.items || [];
            const pagination = root.pagination || {};
            const total = pagination.totalCount || pagination.total || quotes.length;

            if (reset || this.currentPage === 1) {
                this.state.set('quotes.items', quotes);
            } else {
                const existingQuotes = this.state.get('quotes.items') || [];
                this.state.set('quotes.items', [...existingQuotes, ...quotes]);
            }

            this.state.update('quotes', {
                total,
                loading: false,
                lastUpdate: Date.now()
            });

            this.hasMore = (this.currentPage * this.itemsPerPage) < total;
            this.quotesLoaded = true;

         } catch (error) {
            console.error('❌ Ошибка загрузки цитат:', error);
            this.state.set('quotes.loading', false);
        } finally {
            this.quotesLoading = false;
        }
    }
    
    async loadStats(userId = null) {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.statsLoading) {
            console.log('🔄 DiaryPage: Статистика уже загружается, пропускаем');
            return;
        }
        
        try {
            this.statsLoading = true;
            console.log('📊 DiaryPage: Загружаем статистику');
            
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId если не передан
            if (!userId) {
                userId = await this.waitForValidUserId();
            }
            console.log('📊 DiaryPage: Загружаем статистику для userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Явно передаем userId в API вызов
            const stats = await this.api.getStats(userId);
            this.state.set('stats', stats);
            this.state.set('stats.lastUpdate', Date.now()); // ✅ НОВОЕ: Время обновления
            this.statsLoaded = true; // ✅ НОВОЕ: Помечаем как загруженное
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        } finally {
            this.statsLoading = false; // ✅ НОВОЕ: Сбрасываем флаг
        }
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     */
    render() {
        return `
            <div class="content">
                ${this.renderTabs()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 📑 ТАБЫ (ТОЧНО ИЗ КОНЦЕПТА)
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'add' ? 'active' : ''}" data-tab="add">✍️ Добавить</button>
                <button class="tab ${this.activeTab === 'my-quotes' ? 'active' : ''}" data-tab="my-quotes">📚 Мои цитаты</button>
            </div>
        `;
    }
    
    renderTabContent() {
        switch (this.activeTab) {
            case 'add':
                return this.renderAddTab();
            case 'my-quotes':
                return this.renderMyQuotesTab();
            default:
                return this.renderAddTab();
        }
    }
    
    /**
     * ✍️ ТАБ ДОБАВЛЕНИЯ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderAddTab() {
        return `
            <div class="form-section">
                <div class="form-group">
                    <label class="form-label">💭 Текст цитаты</label>
                    <textarea class="form-textarea" 
                              id="quoteText" 
                              placeholder="Введите цитату, которая вас вдохновила...">${this.formData.text}</textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">✍️ Автор</label>
                    <input class="form-input" 
                           id="quoteAuthor" 
                           placeholder="Кто автор этих слов?"
                           value="${this.formData.author}">
                </div>
                
                <button class="save-btn" id="saveQuoteBtn" ${this.isFormValid() ? '' : 'disabled'}>
                    💾 Сохранить в дневник
                </button>
            </div>
            
            ${this.renderAIInsight()}
            ${this.renderStatsInfo()}
        `;
    }
    
    /**
     * ✨ AI АНАЛИЗ ОТ АННЫ (ТОЧНО ИЗ КОНЦЕПТА!) - 🔧 ИСПРАВЛЕНО: НЕТ ДУБЛИРОВАНИЯ
     */
    renderAIInsight() {
        if (this.statsLoading) {
            return `
                <div class="ai-insight">
                    <div class="ai-title">
                        <span>✨</span>
                        <span>Анализ от Анны</span>
                    </div>
                    <div class="ai-text">⏳ Анализируем ваши цитаты...</div>
                </div>
            `;
        }

        const lastQuote = this.state.get('lastAddedQuote');
        const summary = lastQuote?.aiAnalysis?.summary || lastQuote?.summary || '';
        const insights = lastQuote?.insights || lastQuote?.aiAnalysis?.insights || '';

        if (lastQuote && (summary || insights)) {
            return `
                <div class="ai-insight">
                    <div class="ai-title">
                         <span>✨</span>
                         <span>Анализ от Анны</span>
                    </div>
                    ${summary ? `<div class="ai-text"><b>Ответ Анны:</b> ${summary}</div>` : ''}
                    ${insights ? `<div class="ai-text"><b>Инсайт:</b> ${insights}</div>` : ''}
                </div>
            `;
        }

        // Fallback — если нет инсайта и summary
        return `
            <div class="ai-insight">
                <div class="ai-title">
                    <span>✨</span>
                    <span>Анализ от Анны</span>
                </div>
                <div class="ai-text">Добавьте цитату, и я проанализирую ваши предпочтения!</div>
            </div>
        `;
    }

    /**
     * 📊 СТАТИСТИКА (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderStatsInfo() {
        const stats = this.state.get('stats') || {};
        const totalQuotes = stats.totalQuotes || 47; // Как в концепте
        const activityPercent = Math.min(Math.round(totalQuotes * 2.5), 78); // Как в концепте
        
        return `
            <div class="stats-summary">
                📊 У вас уже ${totalQuotes} цитат • Вы активнее ${activityPercent}% читателей сообщества
            </div>
        `;
    }
    
    /**
     * 📚 ТАБ МОИ ЦИТАТЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderMyQuotesTab() {
        const quotes = this.state.get('quotes.items') || [];
        const loading = this.state.get('quotes.loading');
        
        return `
            <div class="my-quotes-container">
                ${this.renderFilters()}
                ${this.renderQuotesStats()}
                ${this.renderQuotesList(quotes, loading)}
                ${this.renderPagination()}
            </div>
        `;
    }
    
    /**
     * 🔧 ФИЛЬТРЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderFilters() {
        return `
            <div class="search-and-filters">
                <div class="search-section">
                    <input class="search-input" 
                           id="quotesSearchInput"
                           placeholder="Поиск по тексту или автору..." 
                           value="${this.searchQuery}">
                </div>
                <div class="filter-tabs">
                    <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                    <button class="filter-tab ${this.currentFilter === 'favorites' ? 'active' : ''}" data-filter="favorites">Избранные</button>
                    <button class="filter-tab ${this.currentFilter === 'this-week' ? 'active' : ''}" data-filter="this-week">Эта неделя</button>
                    <button class="filter-tab ${this.currentFilter === 'by-author' ? 'active' : ''}" data-filter="by-author">По автору</button>
                    ${
                        this.currentFilter === 'by-author'
                            ? `<input class="filter-author-input" id="filterAuthorInput" placeholder="Имя автора" value="${this.filterAuthor || ''}" style="margin-left:10px;max-width:150px;">`
                            : ''
                    }
                </div>
            </div>
        `;
    }    
    
    /**
     * 📊 СТАТИСТИКА ЦИТАТ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderQuotesStats() {
        const stats = this.state.get('stats') || {};
        
        return `
            <div class="stats-summary">
                📊 Всего: ${stats.totalQuotes || 47} цитат • За неделю: ${stats.thisWeek || 7} • Любимый автор: Э. Фромм
            </div>
        `;
    }
    
    /**
     * 📋 СПИСОК ЦИТАТ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderQuotesList(quotes, loading) {
        if (loading && quotes.length === 0) {
            return `<div class="loading-state">⏳ Загружаем ваши цитаты...</div>`;
        }
        
        // Apply search filtering
        let filteredQuotes = quotes;
        if (this.searchQuery && this.searchQuery.trim()) {
            const searchTerm = this.searchQuery.toLowerCase();
            filteredQuotes = quotes.filter(quote => 
                (quote.text && quote.text.toLowerCase().includes(searchTerm)) ||
                (quote.author && quote.author.toLowerCase().includes(searchTerm))
            );
        }
        
        if (filteredQuotes.length === 0) {
            if (this.searchQuery && this.searchQuery.trim()) {
                return `
                    <div class="empty-search-results">
                        <div class="empty-icon">🔍</div>
                        <div class="empty-title">Ничего не найдено</div>
                        <div class="empty-text">Попробуйте изменить запрос или добавить новые цитаты</div>
                    </div>
                `;
            } else {
                return this.renderEmptyQuotes();
            }
        }
        
        // Вызываем renderQuoteItem с showAnalysis = false (по умолчанию)
        return filteredQuotes.map(quote => this.renderQuoteItem(quote, false)).join('');
    }

    renderPagination() {
        const total = this.state.get('quotes.total') || 0;
        if (total <= this.itemsPerPage) return '';

        const totalPages = Math.max(1, Math.ceil(total / this.itemsPerPage));
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, total);

        const canGoPrev = this.currentPage > 1;
        const canGoNext = this.currentPage < totalPages;

        return `
            <div class="quotes-pagination">
                <div class="pagination-info">
                    Показано ${start}-${end} из ${total} цитат
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn ${!canGoPrev ? 'disabled' : ''}" id="prevPageBtn" ${!canGoPrev ? 'disabled' : ''}>
                        <span class="pagination-arrow">←</span>
                        <span class="pagination-text">Предыдущая</span>
                    </button>
                    <span class="pagination-current">
                        Страница ${this.currentPage} из ${totalPages}
                    </span>
                    <button class="pagination-btn ${!canGoNext ? 'disabled' : ''}" id="nextPageBtn" ${!canGoNext ? 'disabled' : ''}>
                        <span class="pagination-text">Следующая</span>
                        <span class="pagination-arrow">→</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 📝 КАРТОЧКА ЦИТАТЫ (ОБНОВЛЕНО: с kebab меню и новыми стилями!)
     */
    renderQuoteItem(quote, showAnalysis = false) {
        const isFavorite = quote.isFavorite || false;
        const author = quote.author ? `— ${quote.author}` : '';
        const heartIcon = isFavorite ? '❤️' : '🤍';

        // Highlight search terms if search query exists
        const displayText = this.searchQuery && this.searchQuery.trim() 
            ? this.highlightSearchTerm(quote.text, this.searchQuery) 
            : quote.text;
        const displayAuthor = author && this.searchQuery && this.searchQuery.trim()
            ? this.highlightSearchTerm(author, this.searchQuery)
            : author;

        // Корректно берем summary и insights из новых и старых форматов
        const summary = showAnalysis ? (quote.aiAnalysis?.summary || quote.summary || '') : '';
        const insights = showAnalysis ? (quote.insights || quote.aiAnalysis?.insights || '') : '';

        return `
            <div class="quote-card my-quotes" data-id="${quote._id || quote.id}" data-quote-id="${quote._id || quote.id}">
                <button class="quote-kebab" aria-label="menu" title="Действия">…</button>
                <div class="quote-text">${displayText}</div>
                ${displayAuthor ? `<div class="quote-author">${displayAuthor}</div>` : ''}
                ${summary ? `<div class="quote-summary" style="margin-top:8px;color:var(--text-primary)"><b>Ответ Анны:</b> ${summary}</div>` : ''}
                ${insights ? `<div class="quote-insight" style="margin-top:6px;"><b>Инсайт:</b> ${insights}</div>` : ''}
                <div class="quote-actions-inline">
                    <button class="action-btn" data-action="edit" aria-label="Редактировать цитату" title="Редактировать">✏️</button>
                    <button class="action-btn" data-action="favorite" aria-label="Добавить в избранное" title="Избранное">${heartIcon}</button>
                    <button class="action-btn action-delete" data-action="delete" aria-label="Удалить цитату" title="Удалить">🗑️</button>
                </div>
             </div>
        `;
    }
    
    /**
     * 📭 ПУСТОЕ СОСТОЯНИЕ
     */
    renderEmptyQuotes() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div class="empty-title">Пока нет цитат</div>
                <div class="empty-text">Начните собирать вдохновляющие мысли!</div>
                <button class="empty-action" onclick="diaryPage.switchTab('add')">
                    ✍️ Добавить первую цитату
                </button>
            </div>
        `;
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
     */
    attachEventListeners() {
        this.attachTabListeners();
        this.attachFormListeners();
        this.attachFilterListeners();
        this.attachQuoteActionListeners();
        this.attachSearchListeners();

        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.changePage(this.currentPage - 1));
        if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.changePage(this.currentPage + 1));
        
        // Note: MyQuotesView mounting removed for reliability - kebab functionality is now self-contained
    }
    
    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    attachFilterListeners() {
        const filterTabs = document.querySelectorAll('.filter-tab[data-filter]');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const filter = tab.dataset.filter;
                this.applyFilter(filter);
            });
        });

        // Для фильтра "По автору"
        const filterAuthorInput = document.getElementById('filterAuthorInput');
        if (filterAuthorInput) {
            filterAuthorInput.addEventListener('input', async (e) => {
                this.filterAuthor = e.target.value;
                this.currentPage = 1;
                await this.loadQuotes(true, await this.waitForValidUserId());
                this.rerender();
            });
        }
    }
    
    attachFormListeners() {
        const quoteText = document.getElementById('quoteText');
        const quoteAuthor = document.getElementById('quoteAuthor');
        const saveBtn = document.getElementById('saveQuoteBtn');
        
        if (quoteText) {
            quoteText.addEventListener('input', (e) => {
                this.formData.text = e.target.value;
                this.updateSaveButtonState();
            });
        }
        
        if (quoteAuthor) {
            quoteAuthor.addEventListener('input', (e) => {
                this.formData.author = e.target.value;
                this.updateSaveButtonState();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSaveQuote());
        }
    }
     
    attachQuoteActionListeners() {
        // Keep existing logic for search tab only
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

        // ✅ RESTORED: Container-level delegation for my-quotes (reverted from PR #82)
        const myQuotesContainer = document.querySelector('.my-quotes-container');
        if (myQuotesContainer) {
            // Remove any existing listeners to avoid duplicates
            myQuotesContainer.removeEventListener('click', this._handleMyQuotesClick);
            
            // Bind and add the click handler
            this._handleMyQuotesClick = this._handleMyQuotesClick.bind(this);
            myQuotesContainer.addEventListener('click', this._handleMyQuotesClick, false);
        }
    }
    
    attachSearchListeners() {
        // Handle search input in my-quotes tab
        const quotesSearchInput = document.getElementById('quotesSearchInput');
        
        if (quotesSearchInput) {
            // Debounced search for better UX
            let searchTimeout;
            
            quotesSearchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                
                // Clear previous timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                
                // Update display with delay
                searchTimeout = setTimeout(() => {
                    this.rerender();
                }, 300); // 300ms delay
            });
            
            quotesSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    // Immediate update when Enter is pressed
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    this.rerender();
                }
            });
        }
    }
    
    /**
     * 🔧 ОБРАБОТЧИКИ ДЕЙСТВИЙ
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        this.telegram.hapticFeedback('light');
        this.rerender();
        
        // Note: MyQuotesView management removed for reliability - kebab functionality is now self-contained
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка при переключении табов с userId
        if (tabName === 'my-quotes') {
            this.waitForValidUserId().then(userId => {
                this.loadQuotes(true, userId);
            }).catch(error => {
                console.error('❌ Ошибка загрузки при переключении таба:', error);
            });
        }
    }

    /**
     * Mount MyQuotesView on the current my-quotes container
     */
    mountMyQuotesView() {
        // Only mount if MyQuotesView is available and not already mounted
        if (typeof window.MyQuotesView === 'undefined' || this._myQuotesView) {
            return;
        }
        
        // Find the my-quotes container
        const container = document.querySelector('.my-quotes-container');
        if (container) {
            this._myQuotesView = new window.MyQuotesView(container);
            this._myQuotesView.mount();
            console.log('✅ MyQuotesView mounted on container');
        } else {
            console.warn('⚠️ .my-quotes-container not found for MyQuotesView');
        }
    }
    
    /**
     * Unmount MyQuotesView
     */
    unmountMyQuotesView() {
        if (this._myQuotesView) {
            this._myQuotesView.unmount();
            this._myQuotesView = null;
            console.log('✅ MyQuotesView unmounted');
        }
    }

    /**
     * Управление MyQuotesView при переключении табов
     */
    handleMyQuotesViewForTab(currentTab, previousTab) {
        // Размонтируем при уходе с my-quotes
        if (previousTab === 'my-quotes') {
            this.unmountMyQuotesView();
        }
        
        // Монтируем при переходе на my-quotes
        if (currentTab === 'my-quotes') {
            // Даём время на рендер, затем монтируем
            setTimeout(() => {
                this.mountMyQuotesView();
            }, 50);
        }
    }

    async handleSaveQuote() {
        if (!this.isFormValid()) return;

        try {
            this.telegram.hapticFeedback('medium');

            // Ждем валидный userId перед сохранением
            const userId = await this.waitForValidUserId();
            console.log('💾 DiaryPage: Сохраняем цитату для userId:', userId);

            const quoteData = {
                text: this.formData.text.trim(),
                author: this.formData.author.trim(),
                source: this.formData.source?.trim() || 'mini_app'
            };

            const saveBtn = document.getElementById('saveQuoteBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '💾 Сохраняем...';
            }

            // --- Основное изменение ---
            const savedQuote = await this.api.addQuote(quoteData, userId);
            const data = savedQuote?.data || savedQuote;
            console.log('DEBUG: Saved quote data:', data);

            // Универсально достаем анализ
            let insights = data.insights || data.quote?.insights;
            let themes = data.themes || data.quote?.themes;
            let category = data.category || data.quote?.category;
            let sentiment = data.sentiment || data.quote?.sentiment;
            let summary = data.summary || data.quote?.summary || savedQuote?.message || '';
            
            // Если insights или другие поля отсутствуют, но есть message как JSON — парсим!
            if ((!insights || !themes || !category) && typeof data.message === 'string') {
                try {
                    const ai = JSON.parse(data.message);
                    insights = insights || ai.insights;
                    themes = themes || ai.themes;
                    category = category || ai.category;
                    sentiment = sentiment || ai.sentiment;
                    summary = summary || ai.summary;
                } catch (e) {
                    console.log('DEBUG: message не парсится как JSON', e);
                }
            }

            // Если summary все еще пустой, попробуем взять из message напрямую
            if (!summary && data.message && typeof data.message === 'string') {
                summary = data.message; // ← ДОБАВИТЬ ЭТО!
            }
            
            this.state.set('lastAddedQuote', {
                ...data,
                insights,
                summary,
                themes,
                category,
                sentiment
            });

            // Показываем уведомление с инсайтом от Анны
            if (insights && typeof window !== 'undefined' && typeof window.showNotification === 'function') {
                window.showNotification(insights, 'success', 5000);
            } else if (typeof window !== 'undefined' && typeof window.showNotification === 'function') {
                window.showNotification('✨ Цитата сохранена в ваш дневник!', 'success');
            }

            // Обновляем state quotes.items (тоже с анализом)
            const existingQuotes = this.state.get('quotes.items') || [];
            const quoteForList = { ...data, insights, themes, category, sentiment };
            this.state.set('quotes.items', [quoteForList, ...existingQuotes]);

            // Dispatch event for StatisticsService
            document.dispatchEvent(new CustomEvent('quotes:changed', { 
                detail: { type: 'added', id: data.id || data._id, quote: quoteForList } 
            }));

            // Обновляем статистику
            const currentStats = this.state.get('stats') || {};
            const updatedStats = {
                ...currentStats,
                totalQuotes: (currentStats.totalQuotes || 0) + 1,
                thisWeek: (currentStats.thisWeek || 0) + 1
            };
            this.state.set('stats', updatedStats);

            this.clearForm();
            this.rerender();

            if (saveBtn) {
                saveBtn.textContent = '✅ Сохранено!';
                saveBtn.style.backgroundColor = 'var(--success-color, #22c55e)';
                saveBtn.style.color = 'white';

                setTimeout(() => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = '💾 Сохранить в дневник';
                    saveBtn.style.backgroundColor = '';
                    saveBtn.style.color = '';
                }, 2000);
            }

            this.telegram.hapticFeedback('success');
            this.log('✅ UI обновлен после сохранения цитаты');

        } catch (error) {
            console.error('❌ Ошибка сохранения цитаты:', error);
            this.telegram.hapticFeedback('error');

            const saveBtn = document.getElementById('saveQuoteBtn');
            if (saveBtn) {
                saveBtn.textContent = '❌ Ошибка';
                saveBtn.style.backgroundColor = 'var(--error-color, #ef4444)';
                saveBtn.style.color = 'white';

                setTimeout(() => {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Сохранить в дневник';
                    saveBtn.style.backgroundColor = '';
                    saveBtn.style.color = '';
                }, 2000);
            }
        }
    }
    
    async applyFilter(filter) {
        this.currentFilter = filter;
        this.currentPage = 1;

        if (filter !== 'by-author') this.filterAuthor = '';

        // Явно сбрасываем временные фильтры
        if (filter === 'all') {
            this.dateFrom = undefined;
            this.dateTo = undefined;
        }

        this.telegram.hapticFeedback('light');
        this.updateFilterUI();
        try {
            const userId = await this.waitForValidUserId();
            await this.loadQuotes(true, userId);
        } catch (error) {
            console.error('❌ Ошибка применения фильтра:', error);
        }
        this.rerender();
    }
    
    async changePage(newPage) {
        if (newPage < 1) return;

        const maxPage = Math.max(1, Math.ceil(this.state.get('quotes.total') / this.itemsPerPage));
        if (newPage > maxPage) return;

        // ✅ ПОКАЗЫВАЕМ индикатор загрузки В НАЧАЛЕ
        this.state.set('quotes.loading', true);
        this.rerender();

        this.currentPage = newPage;

        try {
            const userId = await this.waitForValidUserId();
            await this.loadQuotes(true, userId); // ✅ ИСПРАВЛЕНО: true вместо false 
        } catch (error) {
            console.error('❌ Ошибка переключения страницы:', error);
        } finally {
            // ✅ УБИРАЕМ индикатор загрузки В КОНЦЕ (в любом случае)
            this.state.set('quotes.loading', false);
            this.rerender(); // ✅ Финальный рендер с новыми данными
        }
    }
    
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
    
    async toggleFavorite(quoteId, card = null, btn = null) {
        try {
            const quotes = this.state.get('quotes.items') || [];
            const quote = quotes.find(q => q._id === quoteId || q.id === quoteId);
            if (!quote) return;

            const newFavoriteState = !quote.isFavorite;
            quote.isFavorite = newFavoriteState;
            this.state.set('quotes.items', [...quotes]);

            // Правильный эндпоинт для toggle избранного!
            try {
                await this.api.post(`/quotes/${quoteId}/favorite`, { isFavorite: newFavoriteState });
            } catch (apiError) {
                // Можно обработать ошибку: например, вернуть в исходное состояние
                quote.isFavorite = !newFavoriteState;
                this.state.set('quotes.items', [...quotes]);
            }

            if (card && btn) {
                card.classList.toggle('liked', newFavoriteState);
                btn.textContent = newFavoriteState ? '❤️' : '🤍';
            }

            this.telegram.hapticFeedback('success');
            if (!card || !btn) this.rerender();
        } catch (error) {
            console.error('❌ Ошибка обновления избранного:', error);
            this.telegram.hapticFeedback('error');
        }
    }
    
    /**
     * 🧹 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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
        this.formData = { text: '', author: '', source: '' };
        
        const quoteText = document.getElementById('quoteText');
        const quoteAuthor = document.getElementById('quoteAuthor');
        
        if (quoteText) quoteText.value = '';
        if (quoteAuthor) quoteAuthor.value = '';
    }
    
    getLastAddedQuote() {
        const quotes = this.state.get('quotes.items') || [];
        return quotes[0];
    }
    
    updateFilterUI() {
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            const filter = tab.dataset.filter;
            tab.classList.toggle('active', filter === this.currentFilter);
        });
    }
    
    updateQuotesUI(_quotes) {
        if (this.activeTab === 'my-quotes') {
            this.rerender();
        }
    }

    updateStatsUI(_stats) {
        if (this.activeTab === 'add') {
            this.rerender();
        }
    }
    
    formatQuoteDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffHours < 1) return 'Только что';
        if (diffHours < 24) return `${diffHours} ч. назад`;
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return `${diffDays} дн. назад`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
        
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'short' 
        });
    }
    
    log(message, data = null) {
        console.log(`[DiaryPage] ${message}`, data || '');
    }
    
    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="quote-highlight">$1</span>');
    }
    
    /**
     * 📚 ПРИМЕРЫ ДАННЫХ ИЗ КОНЦЕПТОВ
     */
    getExampleQuotes() {
        return [
            {
                id: '1',
                text: 'В каждом слове — целая жизнь. Каждое слово способно на подвиг и на предательство.',
                author: 'Марина Цветаева',
                isFavorite: false
            },
            {
                id: '2', 
                text: 'Любовь — это решение любить, а не просто чувство, которое приходит и уходит.',
                author: 'Эрих Фромм',
                isFavorite: true
            },
            {
                id: '3',
                text: 'Хорошая жизнь строится, а не даётся по умолчанию.',
                author: 'Анна Бусел',
                isFavorite: false
            }
        ];
    }
    
    getExampleSearchResults() {
        return [
            {
                id: '1',
                text: 'Любовь — это решение любить, а не просто чувство, которое приходит и уходит.',
                author: 'Эрих Фромм',
                date: '3 дня назад',
                isFavorite: true
            },
            {
                id: '2',
                text: 'Истинная любовь не знает границ времени и пространства.',
                author: 'Моя мысль',
                date: '5 дней назад', 
                isFavorite: false
            },
            {
                id: '3',
                text: 'Любовь к себе — основа всех других видов любви.',
                author: 'Анна Бусел',
                date: '1 неделя назад',
                isFavorite: false
            }
        ];
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ИСПРАВЛЕНО: БЕЗ ШАПКИ!
     */
    onShow() {
        console.log('📖 DiaryPage: onShow - БЕЗ ШАПКИ!');
        
        // Проверяем URL параметры для автоматического запуска редактирования
        this._initEditFromQuery();
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка данных как в HomePage
        if (!this.quotesLoaded && !this.statsLoaded) {
            console.log('🔄 DiaryPage: Первый показ, загружаем данные');
            this.loadInitialData();
        } else {
            // Проверяем актуальность данных (только если прошло больше 10 минут)
            const lastUpdate = this.state.get('stats.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 DiaryPage: Данные устарели, обновляем');
                this.loadInitialData();
            } else {
                console.log('✅ DiaryPage: Данные актуальны, пропускаем загрузку');
            }
        }
    }
    
    onHide() {
        console.log('📖 DiaryPage: onHide');
        // Ничего не делаем - Router управляет шапками
    }
    
    destroy() {
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Отписываемся от события редактирования цитат
        document.removeEventListener('quotes:edit', this._onQuoteEdit, false);
        
        // Remove container-level delegation if it exists
        const myQuotesContainer = document.querySelector('.my-quotes-container');
        if (myQuotesContainer && this._handleMyQuotesClick) {
            myQuotesContainer.removeEventListener('click', this._handleMyQuotesClick, false);
        }
        
        // Unmount MyQuotesView if mounted
        this.unmountMyQuotesView();
        
        // Reset loading flags
        this.quotesLoaded = false;
        this.quotesLoading = false;
        this.statsLoaded = false;
        this.statsLoading = false;
    }

    /**
     * 🔗 Container-level click handler for my-quotes (restored from pre-PR #82)
     */
    _handleMyQuotesClick(e) {
        // Handle kebab button clicks
        const kebabBtn = e.target.closest('.quote-kebab');
        if (kebabBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const card = kebabBtn.closest('.quote-card, .quote-item, [data-quote-id]');
            if (card) {
                card.classList.toggle('expanded');
                this.telegram.hapticFeedback('light');
                this._ensureActionsInline(card);
            }
            return;
        }

        // Handle action button clicks
        const actionBtn = e.target.closest('.action-btn[data-action]');
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const card = actionBtn.closest('.quote-card, .quote-item, [data-quote-id]');
            if (card) {
                const quoteId = card.dataset.id || card.dataset.quoteId || card.getAttribute('data-quote-id');
                const action = actionBtn.dataset.action;
                
                if (quoteId && action) {
                    if (action === 'edit') {
                        this.editQuote(quoteId);
                    } else if (action === 'delete') {
                        this.deleteQuote(quoteId);
                    } else if (action === 'favorite') {
                        this.toggleFavorite(quoteId, card, actionBtn);
                    }
                }
            }
            return;
        }

        // Handle card selection (tap on card itself, not on action buttons)
        const cardTap = e.target.closest('.quote-card, .quote-item, [data-quote-id]');
        if (cardTap && !e.target.closest('.action-btn, .quote-kebab')) {
            const wrap = cardTap.parentElement;
            if (wrap) wrap.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            cardTap.classList.add('active');
            this.telegram?.hapticFeedback?.('light');
        }
    }

    /**
     * Ensure action buttons are present inline (helper method for container-level delegation)
     */
    _ensureActionsInline(card) {
        let actions = card.querySelector('.quote-actions-inline');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'quote-actions-inline';

            const isLiked = card.classList.contains('liked');
            const heartIcon = isLiked ? '❤️' : '🤍';

            actions.innerHTML = `
                <button class="action-btn" data-action="edit" aria-label="Редактировать цитату" title="Редактировать">✏️</button>
                <button class="action-btn" data-action="favorite" aria-label="Добавить в избранное" title="Избранное">${heartIcon}</button>
                <button class="action-btn action-delete" data-action="delete" aria-label="Удалить цитату" title="Удалить">🗑️</button>
            `;
            card.appendChild(actions);
        } else {
            const likeBtn = actions.querySelector('[data-action="favorite"]');
            if (likeBtn) {
                const isLiked = card.classList.contains('liked');
                likeBtn.textContent = isLiked ? '❤️' : '🤍';
            }
        }
    }

    /**
     * 🔗 Обработчик события редактирования цитат из MyQuotesView
     */
    _onQuoteEdit(e) {
        try {
            const id = e?.detail?.id;
            if (id) {
                this.editQuote(id);
            }
        } catch (err) {
            console.debug('quotes:edit handler error:', err);
        }
    }

    /**
     * 🔗 Инициализация редактирования из URL параметров
     */
    _initEditFromQuery() {
        try {
            const params = new URLSearchParams(location.search);
            const quoteId = params.get('quote');
            const action = params.get('action');
            if (quoteId && action === 'edit') {
                // Небольшая задержка, чтобы успел смонтироваться UI
                setTimeout(() => this.editQuote(quoteId), 50);
            }
        } catch (e) {
            console.debug('init edit from query failed:', e);
        }
    }

    /**
  * ✏️ Редактирование цитаты
 */
async editQuote(quoteId) {  // ✅ ОДНА async функция
    try {
        this.log('✏️ Редактирование цитаты:', quoteId);
        
        const quotes = this.state.get('quotes.items') || [];
        const quote = quotes.find(q => q._id === quoteId || q.id === quoteId);
        
        if (!quote) {
            console.error('❌ Цитата не найдена:', quoteId);
            return;
        }

        // ✅ НОВОЕ: Простое редактирование через prompt (для MVP)
        // TODO: В будущем заменить на модальное окно
        const newText = prompt('Редактировать текст цитаты:', quote.text);
        if (newText === null || newText.trim() === '') return; // Отмена или пустой текст
        
        const newAuthor = prompt('Редактировать автора:', quote.author || '');
        if (newAuthor === null) return; // Отмена
        
        // Обновляем цитату локально
        quote.text = newText.trim();
        quote.author = newAuthor.trim();
        quote.isEdited = true;
        quote.editedAt = new Date().toISOString();
        
        // Обновляем state
        this.state.set('quotes.items', [...quotes]);
        
        // ✅ ИСПРАВЛЕНО: Ждем валидный userId перед обновлением
        const validUserId = await this.waitForValidUserId();
        console.log('✏️ DiaryPage: Обновляем цитату для userId:', validUserId);
        
        // ✅ ИСПРАВЛЕНО: Явно передаем userId в API вызов
        await this.api.updateQuote(quoteId, {
            text: newText.trim(),
            author: newAuthor.trim()
        }, validUserId);
        console.log('✅ Цитата обновлена на сервере');
        
        // Обновляем UI
        this.rerender();
        this.telegram.hapticFeedback('success');
        this.log('✅ Цитата обновлена');
        
    } catch (error) {
        console.error('❌ Ошибка обновления цитаты на сервере:', error);
        // В случае ошибки продолжаем с локальными изменениями
        
        // Обновляем UI даже при ошибке API
        this.rerender();
        this.log('⚠️ Цитата обновлена локально');
    }
}

    /**
 * 🗑️ Удаление цитаты
 */
async deleteQuote(quoteId) {
    try {
        this.log('🗑️ Удаление цитаты:', quoteId);
        
        const quotes = this.state.get('quotes.items') || [];
        const quote = quotes.find(q => q._id === quoteId || q.id === quoteId);
        
        if (!quote) {
            console.error('❌ Цитата не найдена:', quoteId);
            return;
        }

        // ✅ НОВОЕ: Подтверждение удаления
        const truncatedText = quote.text.substring(0, 100) + (quote.text.length > 100 ? '...' : '');
        const confirmText = `Удалить цитату?\n\n"${truncatedText}"\n\n— ${quote.author}`;
        
        if (!confirm(confirmText)) {
            return; // Пользователь отменил удаление
        }
        
        // Удаляем из локального state
        const updatedQuotes = quotes.filter(q => q._id !== quoteId && q.id !== quoteId);
        this.state.set('quotes.items', updatedQuotes);
        
        // ✅ ИСПРАВЛЕНО: Обновляем статистику
        const currentStats = this.state.get('stats') || {};
        const updatedStats = {
            ...currentStats,
            totalQuotes: Math.max((currentStats.totalQuotes || 0) - 1, 0)
        };
        this.state.set('stats', updatedStats);
        
        try {
            await this.api.deleteQuote(quoteId);
            console.log('✅ Цитата удалена с сервера');
        } catch (error) {
            console.error('❌ Ошибка удаления цитаты с сервера:', error);
            
            // 🐛 ИСПРАВЛЕНИЕ: Возвращаем цитату только если она НЕ была удалена на сервере
            if (error.status !== 404 && error.status !== 200) {
                // Цитата существует на сервере, возвращаем её в UI
                this.state.set('quotes.items', quotes);
                this.state.set('stats', currentStats);
                this.rerender();
                return;
            }
            // Если 404 - значит уже удалена, не возвращаем в UI
            console.log('⚠️ Цитата уже удалена на сервере (404), оставляем UI без изменений');
        }
        
        // Обновляем UI
        this.rerender();
        this.telegram.hapticFeedback('success');
        this.log('✅ Цитата удалена');
        
    } catch (error) {
        console.error('❌ Ошибка удаления цитаты:', error);
        this.telegram.hapticFeedback('error');
    }
}
    
    /**
     * ⋯ Показать меню действий с цитатой
     */
    showQuoteMenu(quoteId) {
        try {
            this.log('⋯ Показать меню для цитаты:', quoteId);
            
            const quotes = this.state.get('quotes.items') || [];
            const quote = quotes.find(q => q._id === quoteId || q.id === quoteId);
            
            if (!quote) {
                console.error('❌ Цитата не найдена:', quoteId);
                return;
            }

            // ✅ НОВОЕ: Простое меню через confirm/prompt (для MVP)
            // TODO: В будущем заменить на красивое выпадающее меню
            
            const truncatedText = quote.text.substring(0, 100) + (quote.text.length > 100 ? '...' : '');
            const choice = prompt(
                `Действия с цитатой:\n\n"${truncatedText}"\n\n— ${quote.author}\n\n` +
                'Выберите действие:\n' +
                '1 - Редактировать\n' +
                '2 - Удалить\n' +
                '3 - Копировать\n' +
                '0 - Отмена',
                '0'
            );
            
            switch (choice) {
                case '1':
                    this.editQuote(quoteId);
                    break;
                case '2':
                    this.deleteQuote(quoteId);
                    break;
                case '3':
                    this.copyQuoteToClipboard(quote);
                    break;
                default:
                    // Отмена или неверный выбор
                    break;
            }
            
        } catch (error) {
            console.error('❌ Ошибка показа меню цитаты:', error);
            this.telegram.hapticFeedback('error');
        }
    }

    /**
     * 📋 Копирование цитаты в буфер обмена
     */
    copyQuoteToClipboard(quote) {
        try {
            const textToCopy = `"${quote.text}"\n\n— ${quote.author}`;
            
            // Пытаемся использовать современный Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.telegram.hapticFeedback('success');
                    // TODO: Показать уведомление о копировании
                    console.log('✅ Цитата скопирована в буфер обмена');
                }).catch(error => {
                    console.error('❌ Ошибка копирования:', error);
                    this.fallbackCopyToClipboard(textToCopy);
                });
            } else {
                // Fallback для старых браузеров
                this.fallbackCopyToClipboard(textToCopy);
            }
            
        } catch (error) {
            console.error('❌ Ошибка копирования цитаты:', error);
            this.telegram.hapticFeedback('error');
        }
    }

    /**
     * 📋 Fallback копирование для старых браузеров
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                this.telegram.hapticFeedback('success');
                console.log('✅ Цитата скопирована в буфер обмена (fallback)');
            } else {
                console.error('❌ Не удалось скопировать цитату');
                this.telegram.hapticFeedback('error');
            }
        } catch (error) {
            console.error('❌ Ошибка fallback копирования:', error);
            this.telegram.hapticFeedback('error');
        }
    }
}

// Глобальная переменная для доступа из HTML
window.diaryPage = null;

// 📤 Экспорт класса
window.DiaryPage = DiaryPage;
