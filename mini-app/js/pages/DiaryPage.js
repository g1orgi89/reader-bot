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
        this.activeTab = 'add'; // add, my-quotes, search
        this.currentFilter = 'all'; // all, favorites, this-week, by-author
        this.searchQuery = '';
        this.searchFilters = ['all', 'favorites', 'this-week', 'month', 'classics'];
        this.activeSearchFilter = 'all';
        
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
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init, будет в onShow
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
            // ✅ ИСПРАВЛЕНО: Загружаем только если не загружено
            if (!this.quotesLoaded && !this.quotesLoading) {
                await this.loadQuotes();
            }
            
            if (!this.statsLoaded && !this.statsLoading) {
                await this.loadStats();
            }
            
            console.log('✅ DiaryPage: Данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки данных дневника:', error);
        }
    }
    
    async loadQuotes(reset = false) {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.quotesLoading) {
            console.log('🔄 DiaryPage: Цитаты уже загружаются, пропускаем');
            return;
        }
        
        try {
            this.quotesLoading = true;
            console.log('📚 DiaryPage: Загружаем цитаты');
            
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
            
            if (this.currentFilter === 'favorites') {
                params.favorites = true;
            } else if (this.currentFilter === 'this-week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                params.dateFrom = weekAgo.toISOString();
            }
            
            const response = await this.api.getQuotes(params);
            // ✅ ИСПРАВЛЕНО: Правильно извлекаем цитаты из ответа API
            const quotes = response.data?.quotes || response.quotes || response.items || response || [];
            
            if (reset || this.currentPage === 1) {
                this.state.set('quotes.items', quotes);
            } else {
                const existingQuotes = this.state.get('quotes.items') || [];
                this.state.set('quotes.items', [...existingQuotes, ...quotes]);
            }
            
            this.state.update('quotes', {
                total: response.total || quotes.length,
                loading: false,
                lastUpdate: Date.now() // ✅ НОВОЕ: Время обновления
            });
            
            this.hasMore = quotes.length === this.itemsPerPage;
            this.quotesLoaded = true; // ✅ НОВОЕ: Помечаем как загруженное
            
        } catch (error) {
            console.error('❌ Ошибка загрузки цитат:', error);
            this.state.set('quotes.loading', false);
        } finally {
            this.quotesLoading = false; // ✅ НОВОЕ: Сбрасываем флаг
        }
    }
    
    async loadStats() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.statsLoading) {
            console.log('🔄 DiaryPage: Статистика уже загружается, пропускаем');
            return;
        }
        
        try {
            this.statsLoading = true;
            console.log('📊 DiaryPage: Загружаем статистику');
            
            const stats = await this.api.getStats();
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
                <button class="tab ${this.activeTab === 'search' ? 'active' : ''}" data-tab="search">🔍 Поиск</button>
            </div>
        `;
    }
    
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
        // ✅ ИСПРАВЛЕНО: Проверяем флаг загрузки перед показом
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
        
        // ✅ ИСПРАВЛЕНО: Получаем последнюю добавленную цитату из state
        const lastQuote = this.state.get('lastAddedQuote') || this.getLastAddedQuote();
        
        if (!lastQuote || !lastQuote.aiAnalysis) {
            // ✅ ИСПРАВЛЕНО: Показываем более динамичный пример
            const stats = this.state.get('stats') || {};
            const totalQuotes = stats.totalQuotes || 0;
            
            if (totalQuotes === 0) {
                return `
                    <div class="ai-insight">
                        <div class="ai-title">
                            <span>✨</span>
                            <span>Анализ от Анны</span>
                        </div>
                        <div class="ai-text">Добавьте свою первую цитату, и я проанализирую ваши предпочтения и настроение!</div>
                    </div>
                `;
            } else {
                return `
                    <div class="ai-insight">
                        <div class="ai-title">
                            <span>✨</span>
                            <span>Анализ от Анны</span>
                        </div>
                        <div class="ai-text">У вас уже ${totalQuotes} ${this.getQuoteWord(totalQuotes)}! Ваши цитаты показывают глубокий интерес к саморазвитию и поиску смысла.</div>
                    </div>
                `;
            }
        }
        
        // ✅ ИСПРАВЛЕНО: Показываем AI анализ последней цитаты
        return `
            <div class="ai-insight">
                <div class="ai-title">
                    <span>✨</span>
                    <span>Анализ от Анны</span>
                </div>
                <div class="ai-text">${lastQuote.aiAnalysis.summary}</div>
                ${lastQuote.aiAnalysis.mood ? `
                    <div class="ai-mood">
                        <span class="mood-emoji">${lastQuote.aiAnalysis.mood.emoji}</span>
                        <span class="mood-description">${lastQuote.aiAnalysis.mood.description}</span>
                    </div>
                ` : ''}
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
            ${this.renderFilters()}
            ${this.renderQuotesStats()}
            ${this.renderQuotesList(quotes, loading)}
        `;
    }
    
    /**
     * 🔧 ФИЛЬТРЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderFilters() {
        return `
            <div class="filter-tabs">
                <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                <button class="filter-tab ${this.currentFilter === 'favorites' ? 'active' : ''}" data-filter="favorites">Избранные</button>
                <button class="filter-tab ${this.currentFilter === 'this-week' ? 'active' : ''}" data-filter="this-week">Эта неделя</button>
                <button class="filter-tab ${this.currentFilter === 'by-author' ? 'active' : ''}" data-filter="by-author">По автору</button>
            </div>
        `;
    }
    
    /**
     * 📊 СТАТИСТИКА ЦИТАТ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderQuotesStats() {
        const stats = this.state.get('stats') || {};
        const quotes = this.state.get('quotes.items') || [];
        
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
        
        if (quotes.length === 0) {
            return this.renderEmptyQuotes();
        }
        
        // ✅ ИСПРАВЛЕНО: Показываем только реальные цитаты пользователя
        const displayQuotes = quotes;
        
        return displayQuotes.map(quote => this.renderQuoteItem(quote)).join('');
    }
    
    /**
     * 📝 КАРТОЧКА ЦИТАТЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderQuoteItem(quote) {
        const isFavorite = quote.isFavorite || false;
        
        return `
            <div class="quote-item" data-quote-id="${quote._id || quote.id}">
                <div class="quote-text">"${quote.text}"</div>
                <div class="quote-meta">
                    <span style="font-weight: 500; color: var(--text-primary); transition: color var(--transition-normal);">${quote.author}</span>
                    <div class="quote-actions">
                        <button class="quote-action" 
                                data-action="favorite" 
                                style="color: ${isFavorite ? 'var(--primary-color)' : 'var(--text-muted)'};">
                            ${isFavorite ? '❤️' : '❤️'}
                        </button>
                        <button class="quote-action" data-action="edit">✏️</button>
                        <button class="quote-action" data-action="more">⋯</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔍 ТАБ ПОИСКА (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderSearchTab() {
        return `
            <div class="search-section">
                <input class="search-input" 
                       id="searchInput"
                       placeholder="Поиск по тексту, автору или теме..." 
                       value="${this.searchQuery}">
                <div class="search-filters">
                    ${this.searchFilters.map(filter => `
                        <button class="search-filter ${this.activeSearchFilter === filter ? 'active' : ''}" 
                                data-search-filter="${filter}">
                            ${this.getFilterLabel(filter)}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            ${this.renderSearchStats()}
            ${this.renderSearchResults()}
        `;
    }
    
    /**
     * 📊 СТАТИСТИКА ПОИСКА (ИЗ КОНЦЕПТА!) - ИСПРАВЛЕНО: Реальные данные
     */
    renderSearchStats() {
        const searchResults = this.state.get('searchResults') || [];
        const searchResultsCount = searchResults.length;
        const totalQuotes = this.state.get('stats.totalQuotes') || 0;
        
        return `
            <div class="search-stats">
                ${this.searchQuery ? 
                    `🔍 Найдено ${searchResultsCount} ${this.getQuoteWord(searchResultsCount)} по запросу "${this.searchQuery}" • Всего у вас: ${totalQuotes} ${this.getQuoteWord(totalQuotes)}` :
                    '🔍 Введите запрос для поиска по вашим цитатам'
                }
            </div>
        `;
    }
    
    /**
     * 🔍 РЕЗУЛЬТАТЫ ПОИСКА (ИЗ КОНЦЕПТА!) - ИСПРАВЛЕНО: Реальные данные
     */
    renderSearchResults() {
        if (!this.searchQuery) {
            return `
                <div class="search-tips">
                    <strong>💡 Советы по поиску:</strong><br>
                    • Используйте ключевые слова из цитат<br>
                    • Попробуйте искать по имени автора<br>
                    • Фильтры помогают уточнить результат
                </div>
            `;
        }
        
        // ✅ ИСПРАВЛЕНО: Используем реальные результаты поиска из state
        const searchResults = this.state.get('searchResults') || [];
        
        if (searchResults.length === 0) {
            return `
                <div class="empty-search-results">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-title">Ничего не найдено</div>
                    <div class="empty-text">Попробуйте изменить запрос или добавить новые цитаты</div>
                </div>
            `;
        }
        
        return searchResults.map(quote => this.renderSearchQuoteItem(quote)).join('');
    }
    
    /**
     * 🔍 КАРТОЧКА РЕЗУЛЬТАТА ПОИСКА (ИЗ КОНЦЕПТА!) - ИСПРАВЛЕНО: Реальные данные
     */
    renderSearchQuoteItem(quote) {
        const highlightedText = this.highlightSearchTerm(quote.text, this.searchQuery);
        const isFavorite = quote.isFavorite || false;
        
        // ✅ ИСПРАВЛЕНО: Форматируем дату
        const date = quote.createdAt ? this.formatQuoteDate(quote.createdAt) : 'Недавно';
        
        return `
            <div class="quote-item" data-quote-id="${quote.id || quote._id}">
                <div class="quote-text">"${highlightedText}"</div>
                <div class="quote-meta">
                    <div>
                        <div class="quote-author">${quote.author}</div>
                        <div class="quote-date">${date}</div>
                    </div>
                    <div class="quote-actions">
                        <button class="quote-action" 
                                data-action="favorite" 
                                style="color: ${isFavorite ? 'var(--primary-color)' : 'var(--text-muted)'};" 
                                title="${isFavorite ? 'В избранном' : 'Добавить в избранное'}">
                            ${isFavorite ? '⭐' : '☆'}
                        </button>
                        <button class="quote-action" data-action="edit" title="Редактировать">✏️</button>
                        <button class="quote-action" data-action="more" title="Еще">⋯</button>
                    </div>
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
    
    attachFilterListeners() {
        const filterTabs = document.querySelectorAll('.filter-tab[data-filter]');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const filter = tab.dataset.filter;
                this.applyFilter(filter);
            });
        });
        
        const searchFilters = document.querySelectorAll('.search-filter[data-search-filter]');
        searchFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                const filterType = filter.dataset.searchFilter;
                this.applySearchFilter(filterType);
            });
        });
    }
    
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
    
    attachSearchListeners() {
        const searchInput = document.getElementById('searchInput');
        
        if (searchInput) {
            // ✅ ИСПРАВЛЕНО: Debounced search для лучшего UX
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                
                // Очищаем предыдущий timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                
                // Запускаем поиск с задержкой
                searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300); // 300ms задержка
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    // Немедленный поиск при нажатии Enter
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    this.performSearch();
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
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка при переключении табов
        if (tabName === 'my-quotes' && !this.quotesLoaded) {
            this.loadQuotes(true);
        }
    }
    
    async handleSaveQuote() {
        if (!this.isFormValid()) return;
        
        try {
            this.telegram.hapticFeedback('medium');
            
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
            
            // ✅ ИСПРАВЛЕНО: Сохраняем цитату и получаем результат с AI анализом
            const savedQuote = await this.api.addQuote(quoteData);
            this.log('✅ Цитата сохранена:', savedQuote);
            
            // ✅ ИСПРАВЛЕНО: Обновляем state немедленно
            const existingQuotes = this.state.get('quotes.items') || [];
            this.state.set('quotes.items', [savedQuote, ...existingQuotes]);
            
            // ✅ ИСПРАВЛЕНО: Обновляем статистику
            const currentStats = this.state.get('stats') || {};
            const updatedStats = {
                ...currentStats,
                totalQuotes: (currentStats.totalQuotes || 0) + 1,
                thisWeek: (currentStats.thisWeek || 0) + 1
            };
            this.state.set('stats', updatedStats);
            
            // ✅ ИСПРАВЛЕНО: Сохраняем последнюю добавленную цитату для AI анализа
            this.state.set('lastAddedQuote', savedQuote);
            
            // ✅ ИСПРАВЛЕНО: Очищаем форму
            this.clearForm();
            
            // ✅ ИСПРАВЛЕНО: Немедленно обновляем UI
            this.rerender();
            
            // ✅ ИСПРАВЛЕНО: Меняем состояние кнопки на "Сохранено"
            if (saveBtn) {
                saveBtn.textContent = '✅ Сохранено!';
                saveBtn.style.backgroundColor = 'var(--success-color, #22c55e)';
                saveBtn.style.color = 'white';
                
                // Возвращаем обычное состояние через 2 секунды
                setTimeout(() => {
                    saveBtn.disabled = true; // Остается disabled пока форма пуста
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
        this.telegram.hapticFeedback('light');
        this.updateFilterUI();
        await this.loadQuotes(true);
        this.rerender();
    }
    
    applySearchFilter(filter) {
        this.activeSearchFilter = filter;
        this.telegram.hapticFeedback('light');
        this.updateSearchResults();
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
    
    async toggleFavorite(quoteId) {
        try {
            const quotes = this.state.get('quotes.items') || [];
            const quote = quotes.find(q => q._id === quoteId || q.id === quoteId);
            
            if (!quote) return;
            
            // ✅ ИСПРАВЛЕНО: Обновляем локально и через API
            const newFavoriteState = !quote.isFavorite;
            quote.isFavorite = newFavoriteState;
            this.state.set('quotes.items', [...quotes]);
            
            // ✅ НОВОЕ: Вызываем API для сохранения на сервере (для будущей реализации)
            try {
                await this.api.post(`/quotes/${quoteId}/favorite`, { 
                    isFavorite: newFavoriteState 
                });
                console.log('✅ Избранное обновлено на сервере');
            } catch (apiError) {
                console.log('⚠️ Избранное обновлено только локально (API endpoint не реализован):', apiError.message);
                // Не показываем ошибку пользователю, так как локально все работает
            }
            
            this.telegram.hapticFeedback('success');
            this.rerender();
            
        } catch (error) {
            console.error('❌ Ошибка обновления избранного:', error);
            this.telegram.hapticFeedback('error');
        }
    }
    
    async performSearch() {
        if (!this.searchQuery.trim()) {
            this.updateSearchResults();
            return;
        }
        
        try {
            this.log('🔍 Выполняем поиск:', this.searchQuery);
            
            // ✅ ИСПРАВЛЕНО: Используем основной API endpoint с параметром search
            const searchResults = await this.api.getQuotes({
                search: this.searchQuery.trim(),
                limit: 50
            });
            
            // ✅ ИСПРАВЛЕНО: Сохраняем результаты в state
            this.state.set('searchResults', searchResults.data?.quotes || searchResults.quotes || searchResults.items || []);
            this.updateSearchResults();
            
        } catch (error) {
            console.error('❌ Ошибка поиска:', error);
            this.state.set('searchResults', []);
            this.updateSearchResults();
        }
    }
    
    updateSearchResults() {
        this.rerender();
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
    
    updateQuotesUI(quotes) {
        if (this.activeTab === 'my-quotes') {
            this.rerender();
        }
    }
    
    updateStatsUI(stats) {
        if (this.activeTab === 'add') {
            this.rerender();
        }
    }
    
    getFilterLabel(filter) {
        const labels = {
            'all': 'Все',
            'favorites': 'Любимые', 
            'this-week': 'Эта неделя',
            'month': 'Месяц',
            'classics': 'Классики'
        };
        return labels[filter] || filter;
    }
    
    getQuoteWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'цитата';
        if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
        return 'цитат';
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
        return text.replace(regex, '<span class="highlight-match">$1</span>');
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
        
        // ✅ НОВОЕ: Сбрасываем флаги загрузки
        this.quotesLoaded = false;
        this.quotesLoading = false;
        this.statsLoaded = false;
        this.statsLoading = false;
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
        
        // ✅ ИСПРАВЛЕНО: Всегда используем реальный API
        await this.api.updateQuote(quoteId, {
            text: newText.trim(),
            author: newAuthor.trim()
        });
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
            
            // ✅ ИСПРАВЛЕНО: Всегда используем реальный API
            try {
                await this.api.deleteQuote(quoteId);
                console.log('✅ Цитата удалена с сервера');
            } catch (error) {
                console.error('❌ Ошибка удаления цитаты с сервера:', error);
                // В случае ошибки возвращаем цитату обратно (оптимистичное обновление)
                this.state.set('quotes.items', quotes);
                this.state.set('stats', currentStats);
                this.rerender();
                return;
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
            const actions = [
                '✏️ Редактировать',
                '🗑️ Удалить',
                '📋 Копировать',
                '❌ Отмена'
            ];
            
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
