/**
 * Reader Bot Mini App - Основной модуль приложения v2.1
 * ОБНОВЛЕНО: Интеграция с ReaderAPI через api-integration.js
 * 
 * @version 2.1
 * @author Reader Bot Team
 */

class ReaderApp {
    constructor() {
        this.currentPage = 'home';
        this.currentUser = null;
        this.apiClient = null;
        this.telegramManager = null;
        
        // Состояние приложения
        this.state = {
            quotes: [],
            stats: { totalQuotes: 0, streakDays: 0 },
            loading: false,
            searchQuery: '',
            activeFilter: 'all',
            activeCategory: 'all'
        };

        this.init();
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('🚀 Инициализация Reader Bot Mini App v2.1');
        
        try {
            // Инициализация Telegram WebApp
            await this.initTelegram();
            
            // Инициализация API клиента (ждем готовности)
            await this.initAPI();
            
            // Настройка обработчиков событий
            this.setupEventListeners();
            
            // Настройка счетчика символов
            this.setupCharCounter();
            
            // Загрузка начальных данных
            await this.loadInitialData();
            
            console.log('✅ Приложение успешно инициализировано');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Ошибка загрузки приложения');
        }
    }

    /**
     * Инициализация Telegram WebApp
     */
    async initTelegram() {
        // Ждем загрузки TelegramManager
        await this.waitForTelegramManager();
        
        if (window.TelegramManager) {
            // Инициализируем TelegramManager
            const userData = window.TelegramManager.init();
            this.telegramManager = window.TelegramManager;
            this.currentUser = userData;
            
            // Настройка событий Telegram
            this.telegramManager.on('userChange', (user) => {
                this.currentUser = user;
                this.updateUserInfo(user);
                console.log('👤 Пользователь Telegram обновлен:', user);
            });

            this.telegramManager.on('themeChange', (themeParams, colorScheme) => {
                console.log('🎨 Тема изменена:', colorScheme);
            });

            // Настройка основной кнопки
            this.setupMainButton();
            
            // Обновление UI с данными пользователя
            this.updateUserInfo(userData);
        }
    }

    /**
     * Ожидание загрузки TelegramManager
     */
    async waitForTelegramManager() {
        return new Promise((resolve) => {
            if (window.TelegramManager) {
                resolve();
                return;
            }
            
            // Ждем событие загрузки или таймаут
            const checkTelegram = () => {
                if (window.TelegramManager) {
                    resolve();
                } else {
                    setTimeout(checkTelegram, 100);
                }
            };
            
            checkTelegram();
        });
    }

    /**
     * Инициализация API клиента - ОБНОВЛЕНО
     */
    async initAPI() {
        console.log('🔗 Инициализация API клиента...');
        
        return new Promise((resolve, reject) => {
            const initWithReaderAPI = () => {
                if (window.readerAPI) {
                    this.apiClient = window.readerAPI;
                    console.log('✅ ReaderAPI подключен:', this.apiClient.getConnectionInfo());
                    resolve();
                } else if (window.ReaderAPI) {
                    // Fallback - создаем экземпляр вручную
                    try {
                        this.apiClient = new window.ReaderAPI();
                        console.log('✅ ReaderAPI создан вручную');
                        resolve();
                    } catch (error) {
                        console.error('❌ Ошибка создания ReaderAPI:', error);
                        reject(error);
                    }
                } else {
                    console.warn('⏳ Ожидание готовности ReaderAPI...');
                    setTimeout(initWithReaderAPI, 100);
                }
            };
            
            // Слушаем событие готовности API
            window.addEventListener('readerAPIReady', (event) => {
                this.apiClient = event.detail.readerAPI;
                console.log('✅ ReaderAPI готов через событие');
                resolve();
            });
            
            // Запускаем инициализацию
            initWithReaderAPI();
            
            // Таймаут безопасности
            setTimeout(() => {
                if (!this.apiClient) {
                    console.warn('⚠️ API клиент не готов, продолжаем без него');
                    resolve();
                }
            }, 3000);
        });
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка фильтров дневника
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setActiveFilter(filter);
            });
        });

        // Обработка категорий каталога
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.setActiveCategory(category);
            });
        });

        // Поиск в дневнике
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Обработка форм
        const quoteText = document.getElementById('quoteText');
        if (quoteText) {
            quoteText.addEventListener('input', () => {
                this.handleQuoteInput();
            });
        }

        // Закрытие меню по клику вне области
        document.addEventListener('click', (e) => {
            const menuOverlay = document.getElementById('menuOverlay');
            if (e.target === menuOverlay) {
                this.closeMenu();
            }
        });

        // Обработка клавиш
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMenu();
            }
        });
    }

    /**
     * Настройка счетчика символов
     */
    setupCharCounter() {
        const textarea = document.getElementById('quoteText');
        const counter = document.querySelector('.char-counter');
        
        if (textarea && counter) {
            textarea.addEventListener('input', function() {
                const length = this.value.length;
                counter.textContent = `${length}/500`;
                
                // Изменение цвета при приближении к лимиту
                if (length > 450) {
                    counter.style.color = 'var(--text-danger)';
                } else if (length > 400) {
                    counter.style.color = 'var(--text-accent)';
                } else {
                    counter.style.color = 'var(--text-secondary)';
                }
            });
        }
    }

    /**
     * Настройка основной кнопки Telegram
     */
    setupMainButton() {
        if (this.telegramManager && this.telegramManager.tg.MainButton) {
            const mainButton = this.telegramManager.tg.MainButton;
            
            // Скрываем кнопку по умолчанию
            mainButton.hide();
            
            // Показываем кнопку только на странице добавления цитаты
            this.on('pageChanged', (page) => {
                if (page === 'add') {
                    mainButton.setText('Сохранить цитату');
                    mainButton.show();
                    mainButton.onClick(() => this.saveQuote());
                } else {
                    mainButton.hide();
                }
            });
        }
    }

    /**
     * Загрузка начальных данных
     */
    async loadInitialData() {
        this.showLoading(true);

        try {
            // Аутентификация с Telegram (если доступна)
            if (this.apiClient && this.currentUser) {
                try {
                    await this.apiClient.authenticateWithTelegram(
                        this.telegramManager?.tg?.initData || '',
                        this.currentUser
                    );
                    console.log('✅ Аутентификация прошла успешно');
                } catch (authError) {
                    console.warn('⚠️ Ошибка аутентификации, продолжаем без нее:', authError);
                }
            }

            // Загрузка данных параллельно
            await Promise.allSettled([
                this.loadUserStats(),
                this.loadRecentQuotes(),
                this.loadBookCatalog()
            ]);

        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Загрузка статистики пользователя
     */
    async loadUserStats() {
        try {
            if (!this.apiClient) return;

            console.log('📊 Загрузка статистики...');
            const stats = await this.apiClient.getUserStats();
            this.state.stats = stats;
            
            // Обновление UI
            const totalQuotesEl = document.getElementById('totalQuotes');
            const streakDaysEl = document.getElementById('streakDays');
            const weekQuotesEl = document.getElementById('weekQuotes');
            
            if (totalQuotesEl) totalQuotesEl.textContent = stats.totalQuotes || 0;
            if (streakDaysEl) streakDaysEl.textContent = stats.streakDays || 0;
            if (weekQuotesEl) weekQuotesEl.textContent = stats.weekQuotes || 0;
            
            console.log('✅ Статистика загружена:', stats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }

    /**
     * Загрузка последних цитат
     */
    async loadRecentQuotes() {
        try {
            if (!this.apiClient) return;

            console.log('📝 Загрузка недавних цитат...');
            const quotes = await this.apiClient.getRecentQuotes(3);
            this.renderRecentQuotes(quotes);
            
            console.log('✅ Недавние цитаты загружены:', quotes.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки цитат:', error);
        }
    }

    /**
     * Загрузка каталога книг
     */
    async loadBookCatalog() {
        try {
            if (!this.apiClient) return;

            console.log('📚 Загрузка каталога...');
            const books = await this.apiClient.getBookCatalog();
            this.renderBooks(books);
            
            console.log('✅ Каталог загружен:', books.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки каталога:', error);
        }
    }

    /**
     * Отображение недавних цитат
     */
    renderRecentQuotes(quotes) {
        const container = document.getElementById('recentQuotes');
        if (!container) return;

        if (!quotes || quotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📖</div>
                    <div class="empty-state-title">Пока нет цитат</div>
                    <div class="empty-state-text">Добавьте первую цитату, чтобы начать свой дневник мудрости</div>
                </div>
            `;
            return;
        }

        container.innerHTML = quotes.map(quote => `
            <div class="quote-preview" onclick="showPage('diary')">
                <div class="quote-text-short">${this.escapeHtml(quote.text)}</div>
                <div class="quote-meta-short">
                    <span class="quote-author-short">${this.escapeHtml(quote.author || 'Неизвестный автор')}</span>
                    <span class="quote-date-short">${this.formatDate(quote.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * Отображение каталога книг
     */
    renderBooks(books) {
        const container = document.getElementById('booksGrid');
        if (!container) return;

        if (!books || books.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-title">Каталог обновляется</div>
                    <div class="empty-state-text">Скоро здесь появятся персональные рекомендации от Анны</div>
                </div>
            `;
            return;
        }

        container.innerHTML = books.map(book => `
            <div class="book-card" onclick="this.openBookLink('${book.link}')">
                <div class="book-header">
                    <div class="book-cover ${book.category}">
                        ${this.getBookIcon(book.category)}
                    </div>
                    <div class="book-info">
                        <h3 class="book-title">${this.escapeHtml(book.title)}</h3>
                        <p class="book-author">${this.escapeHtml(book.author)}</p>
                        <div class="book-rating">
                            ${book.rating ? `⭐⭐⭐⭐⭐ ${book.rating}` : ''}
                        </div>
                    </div>
                </div>
                <p class="book-description">
                    ${this.escapeHtml(book.description || '')}
                </p>
                ${book.recommendation ? `
                    <div class="book-recommendation">
                        💡 ${this.escapeHtml(book.recommendation)}
                    </div>
                ` : ''}
                <div class="book-footer">
                    <div class="book-price">${book.price || 'Цена уточняется'}</div>
                    <button class="buy-btn" onclick="event.stopPropagation(); this.trackBookClick('${book.id}', '${book.title}')">
                        Купить
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Получение иконки для категории книги
     */
    getBookIcon(category) {
        const icons = {
            psychology: '🧠',
            philosophy: '🤔',
            selfdevelopment: '🚀',
            classic: '📖',
            relationship: '❤️'
        };
        return icons[category] || '📚';
    }

    /**
     * Открытие ссылки на книгу
     */
    openBookLink(link) {
        if (this.telegramManager?.tg?.openLink) {
            this.telegramManager.tg.openLink(link);
        } else {
            window.open(link, '_blank');
        }
        
        // Haptic feedback
        this.triggerHaptic('light');
    }

    /**
     * Трекинг клика по книге
     */
    async trackBookClick(bookId, bookTitle) {
        try {
            if (this.apiClient && this.apiClient.trackEvent) {
                await this.apiClient.trackEvent('book_click', {
                    bookId: bookId,
                    bookTitle: bookTitle,
                    source: 'mini_app_catalog',
                    userId: this.currentUser?.id
                });
            }
        } catch (error) {
            console.warn('⚠️ Не удалось отследить клик:', error);
        }
    }

    /**
     * Обновление информации о пользователе
     */
    updateUserInfo(user) {
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        
        if (avatarEl && user.firstName) {
            avatarEl.textContent = user.firstName.charAt(0).toUpperCase();
        }
        
        if (nameEl) {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Читатель';
            nameEl.textContent = fullName;
        }
    }

    /**
     * Переключение страниц
     */
    showPage(pageId) {
        // Скрытие всех страниц
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Показ выбранной страницы
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // Обновление навигации
            this.updateNavigation(pageId);
            
            // Загрузка данных для страницы
            this.loadPageData(pageId);
            
            // Haptic feedback
            this.triggerHaptic('light');
            
            // Уведомление о смене страницы
            this.emit('pageChanged', pageId);
        }
    }

    /**
     * Обновление активной навигации
     */
    updateNavigation(pageId) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-page=\"${pageId}\"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
    }

    /**
     * Загрузка данных для конкретной страницы
     */
    async loadPageData(pageId) {
        switch (pageId) {
            case 'diary':
                await this.loadAllQuotes();
                break;
            case 'reports':
                await this.loadReports();
                break;
            case 'catalog':
                await this.loadBookCatalog();
                break;
            case 'achievements':
                await this.loadAchievements();
                break;
        }
    }

    /**
     * Загрузка всех цитат для дневника
     */
    async loadAllQuotes() {
        try {
            if (!this.apiClient) return;

            console.log('📖 Загрузка всех цитат...');
            const quotes = await this.apiClient.getAllQuotes();
            this.state.quotes = quotes;
            this.renderQuotesList(quotes);
            
            // Обновление счетчика
            const subtitle = document.getElementById('diarySubtitle');
            if (subtitle) {
                subtitle.textContent = `${quotes.length} записей о мудрости`;
            }
            
            console.log('✅ Все цитаты загружены:', quotes.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки цитат:', error);
        }
    }

    /**
     * Загрузка отчетов
     */
    async loadReports() {
        try {
            if (!this.apiClient) return;

            console.log('📊 Загрузка отчетов...');
            const reports = await this.apiClient.getReports();
            this.renderReports(reports);
            
            console.log('✅ Отчеты загружены:', reports.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
        }
    }

    /**
     * Загрузка достижений
     */
    async loadAchievements() {
        try {
            if (!this.apiClient) return;

            console.log('🏆 Загрузка достижений...');
            const achievements = await this.apiClient.getAchievements();
            this.renderAchievements(achievements);
            
            console.log('✅ Достижения загружены:', achievements.length);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
        }
    }

    /**
     * Отображение списка цитат
     */
    renderQuotesList(quotes) {
        const container = document.getElementById('quotesList');
        if (!container) return;

        if (!quotes || quotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-title">Дневник пуст</div>
                    <div class="empty-state-text">Добавьте первую цитату, чтобы начать собирать мудрость</div>
                </div>
            `;
            return;
        }

        container.innerHTML = quotes.map(quote => `
            <div class="quote-card">
                <div class="quote-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); app.showQuoteActions('${quote._id || quote.id}')">⋯</button>
                </div>
                <div class="quote-full-text">${this.escapeHtml(quote.text)}</div>
                <div class="quote-author">— ${this.escapeHtml(quote.author || 'Неизвестный автор')}</div>
                <div class="quote-meta">
                    <span>${this.formatDate(quote.createdAt)}</span>
                    <span>${quote.isFavorite ? '❤️ Избранное' : ''}</span>
                </div>
                ${quote.analysis ? `
                    <div class="quote-analysis">
                        <div class="analysis-tags">
                            <span class="mood-tag">${quote.analysis.mood}</span>
                            <span class="category-tag">${quote.analysis.category}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Сохранение цитаты - ОБНОВЛЕНО
     */
    async saveQuote() {
        const textEl = document.getElementById('quoteText');
        const authorEl = document.getElementById('quoteAuthor');
        const sourceEl = document.getElementById('quoteSource');
        const saveBtn = document.getElementById('saveButton');
        
        if (!textEl || !textEl.value.trim()) {
            this.showError('Введите текст цитаты');
            return;
        }

        // Валидация через API
        if (this.apiClient?.validateQuote) {
            const validation = this.apiClient.validateQuote({
                text: textEl.value,
                author: authorEl?.value || ''
            });
            
            if (!validation.isValid) {
                this.showError(validation.errors.join('\n'));
                return;
            }
        }

        try {
            // Блокировка кнопки
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Анализ AI...';
            }

            const quoteData = {
                text: textEl.value.trim(),
                author: authorEl?.value.trim() || '',
                source: sourceEl?.value.trim() || ''
            };

            if (this.apiClient) {
                console.log('💾 Сохранение цитаты:', quoteData);
                
                const result = await this.apiClient.saveQuote(quoteData);
                
                if (result.success) {
                    // Показ AI анализа
                    if (result.aiAnalysis) {
                        this.showAIInsight(result.aiAnalysis);
                    }
                    
                    // Очистка формы
                    textEl.value = '';
                    if (authorEl) authorEl.value = '';
                    if (sourceEl) sourceEl.value = '';
                    
                    // Обновление счетчика
                    const counter = document.querySelector('.char-counter');
                    if (counter) {
                        counter.textContent = '0/500';
                        counter.style.color = 'var(--text-secondary)';
                    }
                    
                    this.showSuccess('Цитата сохранена!');
                    
                    // Обновление статистики
                    await this.loadUserStats();
                    
                    // Haptic feedback
                    this.triggerHaptic('success');
                    
                    // Трекинг события
                    if (this.apiClient.trackEvent) {
                        await this.apiClient.trackEvent('quote_added', {
                            hasAuthor: !!quoteData.author,
                            textLength: quoteData.text.length,
                            source: 'mini_app'
                        });
                    }
                    
                    console.log('✅ Цитата успешно сохранена');
                    
                } else {
                    throw new Error(result.error || 'Ошибка сохранения');
                }
                
            } else {
                // Fallback для демо режима
                this.showAIInsight('Демо режим: цитата сохранена локально');
                console.log('⚠️ Демо режим - цитата не сохранена на сервере');
            }
            
        } catch (error) {
            console.error('❌ Ошибка сохранения цитаты:', error);
            this.showError('Не удалось сохранить цитату: ' + error.message);
        } finally {
            // Разблокировка кнопки
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Сохранить в дневник';
            }
        }
    }

    /**
     * Показ AI анализа
     */
    showAIInsight(analysis) {
        const aiInsight = document.getElementById('aiInsight');
        const aiAnalysis = document.getElementById('aiAnalysis');
        
        if (aiInsight && aiAnalysis) {
            aiAnalysis.innerHTML = this.escapeHtml(analysis).replace(/\n/g, '<br>');
            aiInsight.style.display = 'block';
            
            // Анимация появления
            aiInsight.style.opacity = '0';
            aiInsight.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                aiInsight.style.transition = 'all 0.3s ease';
                aiInsight.style.opacity = '1';
                aiInsight.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    /**
     * Обработка ввода в поле цитаты - ОБНОВЛЕНО
     */
    async handleQuoteInput() {
        const textEl = document.getElementById('quoteText');
        const authorEl = document.getElementById('quoteAuthor');
        
        if (!textEl || !this.apiClient?.getLiveAnalysis) return;
        
        const text = textEl.value.trim();
        const author = authorEl?.value.trim() || '';
        
        // Дебаунс для избежания частых запросов
        clearTimeout(this.inputTimeout);
        this.inputTimeout = setTimeout(async () => {
            try {
                const liveAnalysis = await this.apiClient.getLiveAnalysis(text, author);
                
                if (liveAnalysis) {
                    this.showLivePreview(liveAnalysis);
                }
            } catch (error) {
                console.warn('Live analysis failed:', error);
            }
        }, 1000);
    }

    /**
     * Показ превью анализа в реальном времени
     */
    showLivePreview(analysis) {
        let preview = document.getElementById('livePreview');
        if (!preview) {
            preview = document.createElement('div');
            preview.id = 'livePreview';
            preview.className = 'live-preview';
            
            const quoteForm = document.querySelector('.quote-form');
            if (quoteForm) {
                quoteForm.appendChild(preview);
            }
        }
        
        preview.innerHTML = `
            <div class="preview-hint">
                ${analysis.mood} • ${analysis.category}
                <br><small>${analysis.hint}</small>
            </div>
        `;
        
        preview.style.opacity = '1';
        
        // Автоскрытие через 5 секунд
        clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(() => {
            preview.style.opacity = '0';
        }, 5000);
    }

    /**
     * Поиск по цитатам - ОБНОВЛЕНО
     */
    async handleSearch(query) {
        this.state.searchQuery = query.toLowerCase();
        
        if (this.apiClient?.searchQuotes && query.length > 2) {
            try {
                const searchResults = await this.apiClient.searchQuotes(query);
                this.renderQuotesList(searchResults);
                return;
            } catch (error) {
                console.warn('Search API failed, using local filter:', error);
            }
        }
        
        // Fallback к локальной фильтрации
        this.filterQuotes();
    }

    /**
     * Установка активного фильтра
     */
    setActiveFilter(filter) {
        // Обновление UI
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-filter=\"${filter}\"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.state.activeFilter = filter;
        this.filterQuotes();
    }

    /**
     * Фильтрация цитат
     */
    filterQuotes() {
        let filteredQuotes = [...this.state.quotes];
        
        // Фильтр по поиску
        if (this.state.searchQuery) {
            filteredQuotes = filteredQuotes.filter(quote => 
                quote.text.toLowerCase().includes(this.state.searchQuery) ||
                (quote.author && quote.author.toLowerCase().includes(this.state.searchQuery))
            );
        }
        
        // Фильтр по категориям
        switch (this.state.activeFilter) {
            case 'favorites':
                filteredQuotes = filteredQuotes.filter(quote => quote.isFavorite);
                break;
            case 'week':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredQuotes = filteredQuotes.filter(quote => 
                    new Date(quote.createdAt) >= weekAgo
                );
                break;
        }
        
        this.renderQuotesList(filteredQuotes);
    }

    /**
     * Установка активной категории
     */
    setActiveCategory(category) {
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-category=\"${category}\"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.state.activeCategory = category;
        // Здесь можно добавить фильтрацию книг по категориям
    }

    /**
     * Управление меню
     */
    openMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.classList.add('show');
            this.triggerHaptic('light');
        }
    }

    closeMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.classList.remove('show');
        }
    }

    /**
     * Обработка пунктов меню
     */
    handleMenuItem(action) {
        this.closeMenu();
        
        switch (action) {
            case 'profile':
                this.showPage('profile');
                break;
            case 'achievements':
                this.showPage('achievements');
                break;
            case 'settings':
                this.showInfo('⚙️ Настройки\n\n• Уведомления\n• Тема приложения\n• Приватность');
                break;
            case 'contact':
                this.showInfo('📞 Связь с Анной\n\n• Telegram: @anna_busel\n• Email: support@annabusel.org\n• Сайт: annabusel.org');
                break;
            case 'help':
                this.showInfo('❓ Помощь\n\n• Как пользоваться\n• Частые вопросы\n• Руководство');
                break;
            case 'about':
                this.showInfo('ℹ️ Reader Bot\n\n• Персональный дневник цитат\n• Создано для Анны Бусел\n• © 2025');
                break;
            case 'logout':
                if (confirm('🚪 Выйти из аккаунта?\n\nВы уверены?')) {
                    this.logout();
                }
                break;
        }
    }

    /**
     * Выход из системы
     */
    logout() {
        if (this.apiClient && this.apiClient.logout) {
            this.apiClient.logout();
        }
        
        this.currentUser = null;
        this.showInfo('Выход выполнен');
        
        // Перезагрузка через 1 секунду
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    /**
     * Утилиты
     */
    
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        console.error(message);
        if (this.telegramManager?.tg) {
            this.telegramManager.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        console.log(message);
        if (this.telegramManager?.tg) {
            this.telegramManager.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    showInfo(message) {
        if (this.telegramManager?.tg) {
            this.telegramManager.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    triggerHaptic(type = 'light') {
        if (this.telegramManager?.hapticFeedback) {
            this.telegramManager.hapticFeedback(type);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Сегодня';
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return `${diffDays} дня назад`;
        
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Простая система событий
    on(event, callback) {
        if (!this.events) this.events = {};
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    emit(event, data) {
        if (!this.events || !this.events[event]) return;
        this.events[event].forEach(callback => callback(data));
    }

    /**
     * API для отладки
     */
    getDebugInfo() {
        return {
            version: '2.1',
            currentPage: this.currentPage,
            currentUser: this.currentUser,
            apiClient: !!this.apiClient,
            telegramManager: !!this.telegramManager,
            state: this.state,
            apiConnection: this.apiClient?.getConnectionInfo?.() || null
        };
    }
}

// Глобальные функции для HTML - остаются без изменений
let app;

function showPage(pageId) {
    if (app) app.showPage(pageId);
}

function openMenu() {
    if (app) app.openMenu();
}

function closeMenu() {
    if (app) app.closeMenu();
}

function handleMenuItem(action) {
    if (app) app.handleMenuItem(action);
}

function saveQuote() {
    if (app) app.saveQuote();
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    app = new ReaderApp();
    window.app = app; // Для отладки
});

console.log('📱 Reader Bot Mini App v2.1 скрипт загружен');