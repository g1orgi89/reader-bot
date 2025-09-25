/**
 * 👥 СООБЩЕСТВО ЧИТАТЕЛЕЙ - CommunityPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - 3 таба: 📰 Лента, 🏆 Топ недели, 📊 Статистика
 * - MVP версия сообщества
 * - Точная HTML структура из концепта
 * - Все элементы как в макете
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

class CommunityPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.statisticsService = app.statistics || window.statisticsService;
        
        // Стейт
        this.activeTab = 'feed';
        this.isHydrated = false; // ← первый показ только после префетча
        this.communityData = { activeReaders: 0, newQuotes: 0, totalReaders: 0, totalQuotes: 0, totalAuthors: 0, daysActive: 0 };
        this.latestQuotes = [];
        this.popularQuotes = [];
        this.popularBooks = [];
        this.recentClicks = [];
        this.leaderboard = [];
        this.userProgress = null;
        this.communityMessage = null;
        this.communityTrend = null;
        this.communityInsights = null;
        this.funFact = null;

        // Флаги "данные загружены"
        this.loaded = {
            latestQuotes: false,
            popularQuotes: false,
            popularBooks: false,
            recentClicks: false,
            leaderboard: false,
            stats: false,
            insights: false,
            funFact: false,
            message: false,
            trend: false
        };
        
        // ✅ LEGACY: Старые флаги для совместимости
        this.communityLoaded = false;
        this.communityLoading = false;
        
        // Данные для "Сейчас изучают" из StatisticsService
        this.topAnalyses = [];

        // ✅ LEGACY: Состояния загрузки для каждой секции (PR-3)
        this.loadingStates = {
            latestQuotes: false,
            popularQuotes: false,
            popularFavorites: false,
            popularBooks: false,
            recentClicks: false,
            leaderboard: false,
            stats: false
        };

        // ✅ LEGACY: Состояния ошибок для каждой секции (PR-3)
        this.errorStates = {
            latestQuotes: null,
            popularQuotes: null,
            popularFavorites: null,
            popularBooks: null,
            recentClicks: null,
            leaderboard: null,
            stats: null
        };
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }

    // PREFETCH: вызывается Router перед первым render — грузим всё параллельно
    async prefetch() {
        if (this.isHydrated) return; // уже есть готовые данные

        console.log('🔄 CommunityPage: Запуск prefetch - загружаем данные до рендера');

        // Параллельная загрузка без ререндера
        await Promise.allSettled([
            this._safe(async () => { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityLatestQuotes({ limit: 3 }); if (r?.success) { this.latestQuotes = r.data || []; this.loaded.latestQuotes = true; } }),
            this._safe(async () => { const r = await this.api.getTopBooks({ period: '7d', limit: 10 }); if (r?.success) { this.popularBooks = r.data || []; this.loaded.popularBooks = true; } }),
            this._safe(async () => { const r = await this.api.getCatalogRecentClicks({ limit: 3 }); if (r?.success) { this.recentClicks = r.clicks || r.data || []; this.loaded.recentClicks = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityMessage(); if (r?.success) { this.communityMessage = r.data; this.loaded.message = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; this.loaded.trend = true; } }),
            this._safe(async () => { // Популярные цитаты по лайкам с fallback
                let r = await this.api.getCommunityPopularFavorites({ period: '7d', limit: 10 }).catch(() => null);
                if (!(r && r.success)) r = await this.api.getCommunityPopularQuotes({ period: '7d', limit: 10 }).catch(() => null);
                if (r?.success) {
                    const arr = r.data || r.quotes || [];
                    this.popularQuotes = arr.map(q => ({ text: q.text, author: q.author, favorites: (typeof q.favorites === 'number') ? q.favorites : (q.count || 0) }));
                    this.loaded.popularQuotes = true;
                }
            }),
            this._safe(async () => { // лидерборд + me
                const r = await this.api.getLeaderboard({ period: '7d', limit: 10 });
                if (r?.success) { this.leaderboard = r.data || []; this.userProgress = r.me || null; this.loaded.leaderboard = true; }
            }),
            this._safe(async () => { const r = await this.api.getCommunityInsights?.({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } }),
            this._safe(async () => { const r = await this.api.getCommunityFunFact?.({ period: '7d' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } })
        ]);

        this.isHydrated = true; // теперь можно первый раз рендерить
        console.log('✅ CommunityPage: Prefetch завершен - данные готовы');
    }

    // Вспомогательный безопасный запуск
    async _safe(fn) { try { await fn(); } catch (_) { /* ignore errors */ } }
    
    /**
     * Склонение слова "цитата" для корректного отображения
     * @param {number} count - Количество цитат
     * @returns {string} Правильное склонение
     */
    pluralQuotes(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'цитату';
        if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'цитаты';
        return 'цитат';
    }
    
    setupSubscriptions() {
        // Подписки на изменения состояния, если необходимо
    }
    
    async loadCommunityData() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.communityLoading) {
            console.log('🔄 CommunityPage: Сообщество уже загружается, пропускаем');
            return;
        }
        
        try {
            this.communityLoading = true;
            console.log('👥 CommunityPage: Загружаем данные сообщества...');
            
            const stats = await this.api.getCommunityStats();
            if (stats && stats.success) {
                this.communityData = { ...this.communityData, ...stats.data };
                this.errorStates.stats = null;
            }
            
            this.communityLoaded = true;
            this.state.set('community.lastUpdate', Date.now());
            console.log('✅ CommunityPage: Данные сообщества загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных сообщества:', error);
            this.errorStates.stats = error.message || 'Ошибка загрузки статистики';
            // Используем данные из концепта как fallback
        } finally {
            this.communityLoading = false;
        }
    }

    /**
     * 📰 ЗАГРУЗКА ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (PR-3)
     */
    async loadLatestQuotes(limit = 5) {
        if (this.loadingStates.latestQuotes) return;
        
        try {
            this.loadingStates.latestQuotes = true;
            this.errorStates.latestQuotes = null;
            console.log('📰 CommunityPage: Загружаем последние цитаты...');
            
            const response = await this.api.getCommunityLatestQuotes({ limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.data, если нет - из resp.quotes/resp.data.quotes/resp
                this.latestQuotes = response.data || response.quotes || response.data?.quotes || [];
                console.log('✅ CommunityPage: Последние цитаты загружены:', this.latestQuotes.length);
            } else {
                this.latestQuotes = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки последних цитат:', error);
            this.errorStates.latestQuotes = error.message || 'Ошибка загрузки цитат';
            this.latestQuotes = [];
        } finally {
            this.loadingStates.latestQuotes = false;
        }
    }

    /**
     * 🔥 ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ СООБЩЕСТВА (PR-3)
     */
    async loadPopularQuotes(period = '7d', limit = 10) {
        if (this.loadingStates.popularQuotes) return;
        
        try {
            this.loadingStates.popularQuotes = true;
            this.errorStates.popularQuotes = null;
            console.log('🔥 CommunityPage: Загружаем популярные цитаты...');
            
            const response = await this.api.getCommunityPopularQuotes({ period, limit });
            if (response && response.success) {
                this.popularQuotes = response.quotes || [];
                console.log('✅ CommunityPage: Популярные цитаты загружены:', this.popularQuotes.length);
            } else {
                this.popularQuotes = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных цитат:', error);
            this.errorStates.popularQuotes = error.message || 'Ошибка загрузки популярных цитат';
            this.popularQuotes = [];
        } finally {
            this.loadingStates.popularQuotes = false;
        }
    }

    /**
     * ❤️ ЗАГРУЗКА ПОПУЛЯРНЫХ ЦИТАТ ПО ЛАЙКАМ (НОВОЕ)
     */
    async loadPopularFavorites(period = '7d', limit = 10) {
        if (this.loadingStates.popularFavorites) return;
        
        try {
            this.loadingStates.popularFavorites = true;
            this.errorStates.popularFavorites = null;
            console.log('❤️ CommunityPage: Загружаем популярные избранные цитаты...');
            
            const response = await this.api.getCommunityPopularFavorites({ period, limit });
            if (response && response.success) {
                this.popularFavorites = response.data || [];
                console.log('✅ CommunityPage: Популярные избранные цитаты загружены:', this.popularFavorites.length);
            } else {
                throw new Error('Не удалось загрузить популярные избранные цитаты');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных избранных цитат:', error);
            this.errorStates.popularFavorites = error.message || 'Ошибка загрузки избранных цитат';
            this.popularFavorites = [];
            
            // Fallback - загружаем обычные популярные цитаты
            try {
                console.log('🔄 Fallback: загружаем обычные популярные цитаты...');
                await this.loadPopularQuotes(period, limit);
            } catch (fallbackError) {
                console.error('❌ Fallback тоже не сработал:', fallbackError);
            }
        } finally {
            this.loadingStates.popularFavorites = false;
        }
    }

    /**
     * 📚 ЗАГРУЗКА ПОПУЛЯРНЫХ КНИГ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ ТОПА НЕДЕЛИ)
     */
    async loadPopularBooks(period = '7d', limit = 10) {
        if (this.loadingStates.popularBooks) return;
        
        try {
            this.loadingStates.popularBooks = true;
            this.errorStates.popularBooks = null;
            console.log('📚 CommunityPage: Загружаем популярные книги недели...');
            
            // Используем getTopBooks для получения популярных разборов недели
            const response = await this.api.getTopBooks({ period, limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.data или resp.books
                this.popularBooks = response.data || response.books || [];
                console.log('✅ CommunityPage: Популярные книги недели загружены:', this.popularBooks.length);
            } else {
                this.popularBooks = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных книг недели:', error);
            this.errorStates.popularBooks = error.message || 'Ошибка загрузки популярных книг';
            this.popularBooks = [];
        } finally {
            this.loadingStates.popularBooks = false;
        }
    }

    /**
     * 👆 ЗАГРУЗКА ПОСЛЕДНИХ КЛИКОВ ПО КАТАЛОГУ (PR-3)
     */
    async loadRecentClicks(limit = 5) {
        if (this.loadingStates.recentClicks) return;
        
        try {
            this.loadingStates.recentClicks = true;
            this.errorStates.recentClicks = null;
            console.log('👆 CommunityPage: Загружаем последние клики...');
            
            const response = await this.api.getCatalogRecentClicks({ limit });
            if (response && response.success) {
                // Нормализация: читаем из resp.clicks, если нет - из resp.data/items
                this.recentClicks = response.clicks || response.data || response.items || [];
                console.log('✅ CommunityPage: Последние клики загружены:', this.recentClicks.length);
            } else {
                this.recentClicks = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки последних кликов:', error);
            this.errorStates.recentClicks = error.message || 'Ошибка загрузки кликов';
            this.recentClicks = [];
        } finally {
            this.loadingStates.recentClicks = false;
        }
    }

    /**
     * 📚 ЗАГРУЗКА ТОПОВЫХ АНАЛИЗОВ ИЗ STATISTICSSERVICE
     */
    async loadTopAnalyses() {
        if (!this.statisticsService || typeof this.statisticsService.getTopAnalyses !== 'function') {
            console.warn('⚠️ CommunityPage: StatisticsService или getTopAnalyses недоступен');
            return;
        }
        
        try {
            console.log('📚 CommunityPage: Загружаем топовые анализы через StatisticsService...');
            this.topAnalyses = await this.statisticsService.getTopAnalyses(3);
            console.log('✅ CommunityPage: Топовые анализы загружены:', this.topAnalyses);
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки топовых анализов:', error);
            this.topAnalyses = []; // Fallback to empty array
        }
    }

    /**
     * 💬 ЗАГРУЗКА СООБЩЕНИЯ ОТ АННЫ (НОВОЕ)
     */
    async loadCommunityMessage() {
        try {
            console.log('💬 CommunityPage: Загружаем сообщение от Анны...');
            const response = await this.api.getCommunityMessage();
            if (response && response.success && response.data) {
                this.communityMessage = response.data;
                console.log('✅ CommunityPage: Сообщение от Анны загружено');
                return response.data;
            } else {
                // Fallback to static message
                this.communityMessage = {
                    text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
                    time: "2 часа назад"
                };
                return this.communityMessage;
            }
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки сообщения от Анны:', error);
            // Fallback to static message
            this.communityMessage = {
                text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
                time: "2 часа назад"
            };
            return this.communityMessage;
        }
    }

    /**
     * 📈 ЗАГРУЗКА ТРЕНДА НЕДЕЛИ (НОВОЕ)
     */
    async loadCommunityTrend() {
        try {
            console.log('📈 CommunityPage: Загружаем тренд недели...');
            const response = await this.api.getCommunityTrend();
            if (response && response.success && response.data) {
                this.communityTrend = response.data;
                console.log('✅ CommunityPage: Тренд недели загружен');
                return response.data;
            } else {
                // Fallback to static trend
                this.communityTrend = {
                    title: "Тренд недели",
                    text: 'Тема "Психология отношений" набирает популярность',
                    buttonText: "Изучить разборы"
                };
                return this.communityTrend;
            }
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки тренда недели:', error);
            // Fallback to static trend
            this.communityTrend = {
                title: "Тренд недели",
                text: 'Тема "Психология отношений" набирает популярность',
                buttonText: "Изучить разборы"
            };
            return this.communityTrend;
        }
    }
    
    /**
     * 🏆 ЗАГРУЗКА ЛИДЕРБОРДА ЗА ПЕРИОД (НОВОЕ)
     */
    async loadLeaderboard(limit = 10, period = '7d') {
        if (this.loadingStates.leaderboard) return;
        try {
            this.loadingStates.leaderboard = true;
            this.errorStates.leaderboard = null;
            console.log('🏆 CommunityPage: Загружаем лидерборд за', period);
            const resp = await this.api.getLeaderboard({ period, limit });
            if (resp && resp.success) {
                this.leaderboard = resp.data || [];
                this.userProgress = resp.me || null;
                console.log('✅ CommunityPage: Лидерборд загружен:', this.leaderboard.length, 'пользователей');
            } else {
                this.leaderboard = [];
                this.userProgress = null;
                console.warn('⚠️ CommunityPage: Некорректный ответ лидерборда');
            }
        } catch (e) {
            this.errorStates.leaderboard = e.message || 'Ошибка загрузки лидеров';
            this.leaderboard = [];
            this.userProgress = null;
            console.error('❌ CommunityPage: Ошибка загрузки лидерборда:', e);
        } finally {
            this.loadingStates.leaderboard = false;
        }
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     */
    render() {
        if (!this.isHydrated) {
            // Возвращаем пустую строку, Router удерживает предыдущую страницу на экране до готовности
            return '';
        }

        return `
            <div class="content">
                ${this.renderTabs()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 📑 ТАБЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'feed' ? 'active' : ''}" data-tab="feed">📰 Лента</button>
                <button class="tab ${this.activeTab === 'top' ? 'active' : ''}" data-tab="top">🏆 Топ недели</button>
                <button class="tab ${this.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">📊 Статистика</button>
            </div>
        `;
    }
    
    renderTabContent() {
        switch (this.activeTab) {
            case 'feed':
                return this.renderFeedTab();
            case 'top':
                return this.renderTopTab();
            case 'stats':
                return this.renderStatsTab();
            default:
                return this.renderFeedTab();
        }
    }
    
    /**
     * 📰 ТАБ ЛЕНТА (ОБНОВЛЕН ДЛЯ PR-3 - РЕАЛЬНЫЕ ДАННЫЕ ИЗ API!)
     */
    renderFeedTab() {
        // "Сейчас изучают" секция с последними кликами по каталогу
        const currentlyStudyingSection = this.renderCurrentlyStudyingSection();
        
        // ✅ НОВОЕ: Секция последних цитат сообщества (PR-3)
        const latestQuotesSection = this.renderLatestQuotesSection();
        
        // Сообщение от Анны с fallback
        const annaMessageSection = this.renderAnnaMessageSection();
        
        // Тренд недели с fallback
        const trendSection = this.renderTrendSection();
        
        return `
            <div class="stats-summary">
                📊 Сегодня: ${this.communityData.activeReaders} активных читателей • ${this.communityData.newQuotes} новых цитат
            </div>
            
            ${currentlyStudyingSection}
            
            ${latestQuotesSection}
            
            ${annaMessageSection}
            
            ${trendSection}
        `;
    }

    /**
     * 📰 СЕКЦИЯ ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (ОБНОВЛЕНО ДЛЯ PR-3)
     */
    renderLatestQuotesSection() {
        // Если данные загружены, но список пуст - показываем empty state
        if (this.loaded.latestQuotes && (!this.latestQuotes || this.latestQuotes.length === 0)) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">Пока нет цитат</div>
                    <div class="empty-description">Станьте первым, кто поделится мудростью!</div>
                </div>
            `;
        }

        // Если данные ещё не загружены — ничего не показываем (без заглушек)
        if (!this.latestQuotes || this.latestQuotes.length === 0) {
            return '';
        }

        const quotesCards = this.latestQuotes.slice(0, 3).map((quote, index) => {
            return `
                <div class="quote-card" data-quote-id="${quote.id || index}">
                    <div class="quote-card__content">
                        <div class="quote-card__text">"${quote.text || quote.content || ''}"</div>
                        <div class="quote-card__author">— ${quote.author || 'Неизвестный автор'}</div>
                        <div class="quote-card__meta">
                            <span class="quote-card__date">${this.formatDate(quote.createdAt || quote.date)}</span>
                            <div class="quote-card__actions">
                                <button class="quote-card__fav-btn" data-quote-id="${quote.id || index}"
                                        data-quote-text="${(quote.text || quote.content || '').replace(/"/g, '&quot;')}"
                                        data-quote-author="${(quote.author || 'Неизвестный автор').replace(/"/g, '&quot;')}"
                                        style="min-height: var(--touch-target-min);" aria-label="Добавить в избранное">❤</button>
                                <button class="quote-card__add-btn" data-quote-id="${quote.id || index}"
                                        data-quote-text="${(quote.text || quote.content || '').replace(/"/g, '&quot;')}"
                                        data-quote-author="${(quote.author || 'Неизвестный автор').replace(/"/g, '&quot;')}"
                                        style="min-height: var(--touch-target-min);" aria-label="Добавить цитату в дневник">
                                  <span class="add-icon">+</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="latest-quotes-section">
                <div class="mvp-community-title">💫 Последние цитаты сообщества</div>
                <div class="quotes-grid">
                    ${quotesCards}
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 СЕКЦИЯ "СЕЙЧАС ИЗУЧАЮТ" (ОБНОВЛЕНО: ПОКАЗЫВАЕТ ПОСЛЕДНИЕ КЛИКИ ПО КАТАЛОГУ)
     */
    renderCurrentlyStudyingSection() {
        if (this.loadingStates.recentClicks) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">📚 Сейчас изучают</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем последние разборы...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.recentClicks) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки</div>
                    <div class="error-description">${this.errorStates.recentClicks}</div>
                    <button class="error-retry-btn" data-retry="recent-clicks" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.recentClicks || this.recentClicks.length === 0) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">📚 Сейчас изучают</div>
                    <div class="mvp-community-text">Пока нет активности</div>
                    <div class="mvp-community-author">Данные обновляются</div>
                </div>
            `;
        }
        
        const recentClicksCards = this.recentClicks.slice(0, 3).map((click, _index) => `
            <div class="currently-studying-item" data-book-id="${click.book?.id || click.bookId || click.id}" style="margin-bottom: var(--spacing-sm); min-height: var(--touch-target-min);">
                <div class="studying-rank">${_index + 1}</div>
                <div class="studying-content">
                    <div class="studying-title">${click.book?.title || click.bookTitle || click.title || 'Неизвестная книга'}</div>
                    <div class="studying-author">${click.book?.author || click.bookAuthor || click.author || 'Неизвестный автор'}</div>
                    <div class="studying-stats">${this.formatClickTime(click.timestamp || click.clickTime || click.createdAt)}</div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="currently-studying-section">
                <div class="mvp-community-title">📚 Сейчас изучают</div>
                <div class="currently-studying-list">
                    ${recentClicksCards}
                </div>
            </div>
        `;
    }
    
    /**
     * 💬 СЕКЦИЯ СООБЩЕНИЯ ОТ АННЫ (НОВАЯ С API И FALLBACK)
     */
    renderAnnaMessageSection() {
        const message = this.communityMessage || {
            text: "Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!",
            time: "2 часа назад"
        };

        return `
            <div class="anna-message-block">
                <div class="anna-message-header">💬 Сообщение от Анны</div>
                <div class="anna-message-text">"${message.text}"</div>
                <div class="anna-message-time">${message.time}</div>
            </div>
        `;
    }

    /**
     * 📈 СЕКЦИЯ ТРЕНДА НЕДЕЛИ (НОВАЯ С API И FALLBACK)
     */
    renderTrendSection() {
        const trend = this.communityTrend || {
            title: "Тренд недели",
            text: 'Тема "Психология отношений" набирает популярность',
            buttonText: "Изучить разборы"
        };

        return `
            <div class="promo-section">
                <div class="promo-title">🎯 ${trend.title}</div>
                <div class="promo-text">${trend.text}</div>
                <button class="promo-btn" 
                        id="exploreBtn"
                        style="min-height: var(--touch-target-min);">
                    ${trend.buttonText}
                </button>
            </div>
        `;
    }
    
    /**
     * 🏆 ТАБ ТОП НЕДЕЛИ (ОБНОВЛЕН ДЛЯ PR-3 - ТОЛЬКО ПОПУЛЯРНЫЕ РАЗБОРЫ НЕДЕЛИ!)
     */
    renderTopTab() {
        const popularFavoritesSection = this.renderPopularFavoritesSection();
        const leaderboardSection = this.renderLeaderboardSection();
        const popularBooksSection = this.renderPopularBooksSection();
        const userProgressSection = this.renderUserProgressSection();

        return `
            <div class="community-stats-grid">
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.activeReaders}</div>
                    <div class="community-stat-label">Активных читателей</div>
                </div>
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.newQuotes}</div>
                    <div class="community-stat-label">Новых цитат</div>
                </div>
            </div>
            
            ${popularFavoritesSection}
            ${leaderboardSection}
            ${popularBooksSection}
            ${userProgressSection}
        `;
    }

    /**
     * ⭐ СЕКЦИЯ ПОПУЛЯРНЫХ ЦИТАТ ПО ЛАЙКАМ (НОВАЯ)
     */
    renderPopularFavoritesSection() {
        if (this.loadingStates.popularFavorites) {
            return `
                <div class="popular-favorites-section">
                    <div class="mvp-community-title">⭐ Популярные цитаты недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем топ цитат...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularFavorites) {
            // Fallback to regular popular quotes on error
            if (this.popularQuotes && this.popularQuotes.length > 0) {
                const quotesCards = this.popularQuotes.slice(0, 5).map((quote, _index) => {
                    const favorites = quote.count || 0; // Fallback to count field
                    return `
                        <div class="favorite-quote-card">
                            <div class="quote-content">
                                <div class="quote-text">"${quote.text || ''}"</div>
                                <div class="quote-author">— ${quote.author || 'Неизвестный автор'}</div>
                            </div>
                            <div class="quote-stats">
                                <span class="heart-count">❤ ${favorites}</span>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="popular-favorites-section">
                        <div class="mvp-community-title">⭐ Популярные цитаты недели</div>
                        <div class="favorites-grid">
                            ${quotesCards}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="error-state">
                        <div class="error-icon">❌</div>
                        <div class="error-title">Ошибка загрузки</div>
                        <div class="error-description">${this.errorStates.popularFavorites}</div>
                        <button class="error-retry-btn" data-retry="popular-favorites" style="min-height: var(--touch-target-min);">Повторить</button>
                    </div>
                `;
            }
        }

        if (!this.popularFavorites || this.popularFavorites.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <div class="empty-title">Пока нет избранных цитат</div>
                    <div class="empty-description">Станьте первым, кто добавит цитату в избранное!</div>
                </div>
            `;
        }

        const quotesCards = this.popularFavorites.slice(0, 5).map((quote, _index) => {
            const favorites = quote.favorites || 0;
            return `
                <div class="favorite-quote-card">
                    <div class="quote-content">
                        <div class="quote-text">"${quote.text || ''}"</div>
                        <div class="quote-author">— ${quote.author || 'Неизвестный автор'}</div>
                    </div>
                    <div class="quote-stats">
                        <span class="heart-count">❤ ${favorites}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="popular-favorites-section">
                <div class="mvp-community-title">⭐ Популярные цитаты недели</div>
                <div class="favorites-grid">
                    ${quotesCards}
                </div>
            </div>
        `;
    }

    /**
     * 🏆 СЕКЦИЯ ЛИДЕРБОРДА (НОВАЯ ДЛЯ PR-3)
     */
    renderLeaderboardSection() {
        if (this.loadingStates.leaderboard) {
            return `
                <div class="leaders-week-section">
                    <div class="leaders-week-title">🏆 Лидеры недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем лидерборд...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.leaderboard) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки лидерборда</div>
                    <div class="error-description">${this.errorStates.leaderboard}</div>
                    <button class="error-retry-btn" data-retry="leaderboard" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.leaderboard || this.leaderboard.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🏆</div>
                    <div class="empty-title">Пока нет лидеров</div>
                    <div class="empty-description">Станьте первым в топе читателей!</div>
                </div>
            `;
        }

        const leaderboardItems = this.leaderboard.slice(0, 3).map((leader, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';
            const count = leader.quotesWeek ?? leader.quotes ?? 0;
            return `
                <div class="leaderboard-item">
                    <div class="rank-badge ${rankClass}">${index + 1}</div>
                    <div class="user-info">
                        <div class="user-name">${leader.name || 'Анонимный читатель'}</div>
                        <div class="user-stats">${count} цитат за неделю</div>
                        <div class="user-achievement">📚 "Активный читатель"</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="leaders-week-section">
                <div class="leaders-week-title">🏆 Лидеры недели</div>
                <div class="leaders-week-subtitle">Самые активные читатели сообщества</div>
            </div>
            ${leaderboardItems}
        `;
    }

    /**
     * 🎯 СЕКЦИЯ ПРОГРЕССА ПОЛЬЗОВАТЕЛЯ (НОВАЯ)
     */
    renderUserProgressSection() {
        if (!this.userProgress) {
            return `
                <div class="user-progress-section">
                    <div class="progress-header">🎯 Ваш прогресс в топах</div>
                    <div class="progress-stats">Загрузка данных о прогрессе...</div>
                    <div class="progress-bar-white">
                        <div class="progress-fill-white" style="width: 0%;"></div>
                    </div>
                    <div class="progress-description">Ваша позиция обновляется...</div>
                </div>
            `;
        }

        const { position, quotesWeek, percentile, deltaToNext } = this.userProgress;
        
        // Рассчитываем прогресс-бар относительно лидера
        const leaderCount = this.leaderboard.length > 0 ? (this.leaderboard[0].quotesWeek ?? this.leaderboard[0].quotes ?? 0) : 1;
        const progressPercent = Math.min(100, Math.round((quotesWeek / Math.max(1, leaderCount)) * 100));
        
        // Формируем текст прогресса
        let progressText;
        if (position === 1) {
            progressText = "Вы лидер недели! Поздравляем! 🎉";
        } else {
            const quotesNeeded = deltaToNext;
            const quotesWord = this.pluralQuotes(quotesNeeded);
            progressText = `Добавьте ещё ${quotesNeeded} ${quotesWord} до следующего места`;
        }

        return `
            <div class="user-progress-section">
                <div class="progress-header">🎯 Ваш прогресс в топах</div>
                <div class="progress-stats">Место: #${position} • За неделю: ${quotesWeek} • Активнее ${percentile}% участников</div>
                <div class="progress-bar-white">
                    <div class="progress-fill-white" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-description">${progressText}</div>
            </div>
        `;
    }

    /**
     * ⭐ СЕКЦИЯ ПОПУЛЯРНЫХ ЦИТАТ (НОВАЯ ДЛЯ PR-3)
     */
    renderPopularQuotesSection() {
        if (this.loadingStates.popularQuotes) {
            return `
                <div class="popular-quotes-section">
                    <div class="popular-quotes-title">⭐ Популярные цитаты недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем популярные цитаты...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularQuotes) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки цитат</div>
                    <div class="error-description">${this.errorStates.popularQuotes}</div>
                    <button class="error-retry-btn" data-retry="popular-quotes" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.popularQuotes || this.popularQuotes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <div class="empty-title">Пока нет популярных цитат</div>
                    <div class="empty-description">Добавляйте цитаты чтобы увидеть популярные!</div>
                </div>
            `;
        }

        const quotesItems = this.popularQuotes.slice(0, 3).map(quote => `
            <div class="quote-item">
                <div class="quote-text">"${quote.text}"</div>
                <div class="quote-meta">${quote.author} • добавили ${quote.count || 0} человек</div>
            </div>
        `).join('');

        return `
            <div class="popular-quotes-section">
                <div class="popular-quotes-title">⭐ Популярные цитаты недели</div>
                ${quotesItems}
            </div>
        `;
    }

    /**
     * 📚 СЕКЦИЯ ПОПУЛЯРНЫХ КНИГ (НОВАЯ ДЛЯ PR-3)
     */
    renderPopularBooksSection() {
        if (this.loadingStates.popularBooks) {
            return `
                <div class="popular-books-section">
                    <div class="popular-books-title">📚 Популярные разборы недели</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем популярные книги...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.popularBooks) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки книг</div>
                    <div class="error-description">${this.errorStates.popularBooks}</div>
                    <button class="error-retry-btn" data-retry="popular-books" style="min-height: var(--touch-target-min);">Повторить</button>
                </div>
            `;
        }

        if (!this.popularBooks || this.popularBooks.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <div class="empty-title">Пока нет популярных книг</div>
                    <div class="empty-description">Изучайте разборы чтобы увидеть популярные!</div>
                </div>
            `;
        }

        const booksItems = this.popularBooks.slice(0, 3).map((book, index) => `
            <div class="book-item">
                <div class="book-title-line">${index + 1}. "${book.title}" ${book.author}</div>
                <div class="book-interest-line">💫 ${book.clicksCount || 0} человек заинтересовалось</div>
            </div>
        `).join('');

        return `
            <div class="popular-books-section">
                <div class="popular-books-title">📚 Популярные разборы недели</div>
                ${booksItems}
            </div>
        `;
    }
    
    /**
     * 📊 ТАБ СТАТИСТИКА (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderStatsTab() {
        return `
            <div class="community-stats-overview">
                <div class="community-stats-title">📈 Общая статистика сообщества</div>
                <div class="community-stats-2x2-grid">
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalReaders.toLocaleString()}</div>
                        <div class="community-stat-small-label">Всего читателей</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalQuotes.toLocaleString()}</div>
                        <div class="community-stat-small-label">Цитат собрано</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.totalAuthors}</div>
                        <div class="community-stat-small-label">Авторов</div>
                    </div>
                    <div class="community-stat-big">
                        <div class="community-stat-value">${this.communityData.daysActive}</div>
                        <div class="community-stat-small-label">Дней работы</div>
                    </div>
                </div>
            </div>
            
            <div class="stats-detail-section">
                <div class="stats-detail-title">📚 Интерес к разборам</div>
                <div class="stats-detail-item">🔥 Лидер недели: "Искусство любить"</div>
                <div class="stats-detail-item">📈 Рост интереса: +23% к прошлой неделе</div>
                <div class="stats-detail-item">📖 Активно изучают 12 разборов</div>
            </div>
            
            <div class="stats-detail-section">
                <div class="stats-detail-title">✍️ Популярные авторы в цитатах</div>
                <div class="stats-detail-item">1. Эрих Фромм — 89 цитат</div>
                <div class="stats-detail-item">2. Анна Бусел — 67 цитат</div>
                <div class="stats-detail-item">3. Марина Цветаева — 45 цитат</div>
                <div class="stats-detail-item">4. Будда — 34 цитаты</div>
                <div class="stats-detail-item">5. Ошо — 29 цитат</div>
            </div>
            
            <div class="stats-detail-section">
                <div class="stats-detail-title">🏆 Достижения сообщества</div>
                <div class="stats-detail-item">🔥 "Коллекционер мудрости" — 23 человека</div>
                <div class="stats-detail-item">📚 "Философ недели" — 15 человек</div>
                <div class="stats-detail-item">💎 "Мыслитель" — 11 человек</div>
                <div class="stats-detail-item">📖 "Любитель классики" — 8 человек</div>
                <div class="stats-detail-item">⭐ "Вдохновитель" — 3 человека</div>
            </div>
            
            <div class="user-rating-section">
                <div class="user-rating-title">📊 Ваш рейтинг</div>
                <div class="user-rating-grid">
                    <div class="user-rating-item">
                        <div class="user-rating-value">#2</div>
                        <div class="user-rating-label">Место в топе</div>
                    </div>
                    <div class="user-rating-item">
                        <div class="user-rating-value">78%</div>
                        <div class="user-rating-label">Активнее других</div>
                    </div>
                </div>
            </div>
            
            <div class="fact-section">
                <div class="fact-title">✨ Интересный факт</div>
                <div class="fact-text">Цитаты Эриха Фромма чаще всего добавляют в избранное в сообществе!</div>
            </div>
        `;
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ (ОБНОВЛЕН ДЛЯ PR-3)
     */
    attachEventListeners() {
        this.attachTabListeners();
        this.attachExploreButton();
        this.attachCurrentlyStudyingListeners();
        this.attachCommunityCardListeners(); // ✅ НОВОЕ: Haptic feedback для карточек
        this.attachRetryButtons(); // ✅ НОВОЕ PR-3
        this.attachQuoteCardListeners(); // ✅ НОВОЕ: Обработчики для карточек цитат
        this.setupQuoteChangeListeners();
    }

    /**
     * 💬 ОБРАБОТЧИКИ ДЛЯ КАРТОЧЕК ЦИТАТ (НОВОЕ ДЛЯ PR-3)
     */
    attachQuoteCardListeners() {
        // Обработчики для кнопок добавления цитат
        const addButtons = document.querySelectorAll('.quote-card__add-btn');
        addButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.addQuoteToJournal(event);
            });
        });

        // Обработчики для кнопок сердечка (избранное)
        const heartButtons = document.querySelectorAll('.quote-card__heart-btn');
        heartButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.addQuoteToFavorites(event);
            });
        });
    }
    
    /**
     * 📳 ЕДИНЫЙ МЕТОД ДЛЯ HAPTIC FEEDBACK
     * @param {string} type - Тип обратной связи: 'light', 'medium', 'heavy', 'success', 'error'
     */
    triggerHapticFeedback(type = 'light') {
        if (this.telegram?.HapticFeedback) {
            switch (type) {
                case 'light':
                    this.telegram.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.telegram.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.telegram.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    this.telegram.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    this.telegram.HapticFeedback.notificationOccurred('error');
                    break;
                case 'warning':
                    this.telegram.HapticFeedback.notificationOccurred('warning');
                    break;
            }
        }
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

    attachExploreButton() {
        const exploreBtn = document.getElementById('exploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                const link = this.communityTrend?.link || '/catalog';
                this.app.router.navigate(link);
            });
        }
    }

    /**
     * 📚 ОБРАБОТЧИКИ СЕКЦИИ "СЕЙЧАС ИЗУЧАЮТ" С HAPTIC FEEDBACK
     */
    attachCurrentlyStudyingListeners() {
        const studyingItems = document.querySelectorAll('.currently-studying-item');
        studyingItems.forEach(item => {
            // Добавляем haptic feedback на касание
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                const bookId = item.dataset.bookId;
                if (bookId) {
                    // Navigate to catalog with selected book
                    this.app.router.navigate(`/catalog?book=${bookId}`);
                }
            });
        });
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ COMMUNITY КАРТОЧЕК С УЛУЧШЕННЫМ HAPTIC FEEDBACK
     */
    attachCommunityCardListeners() {
        // Карточки цитат сообщества
        const communityItems = document.querySelectorAll('.mvp-community-item');
        communityItems.forEach(item => {
            // Haptic feedback на касание
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            // Действие при клике (если нужно)
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                // Здесь можно добавить действия для карточек
            });
        });
        
        // Карточки статистики
        const statCards = document.querySelectorAll('.community-stat-card');
        statCards.forEach(card => {
            card.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
        });
        
        // Элементы лидерборда
        const leaderboardItems = document.querySelectorAll('.leaderboard-item');
        leaderboardItems.forEach(item => {
            item.addEventListener('touchstart', () => {
                this.triggerHapticFeedback('light');
            }, { passive: true });
            
            item.addEventListener('click', () => {
                this.triggerHapticFeedback('medium');
                // Действия для элементов лидерборда
            });
        });
    }

    /**
     * 🔄 ОБРАБОТЧИКИ КНОПОК ПОВТОРА (НОВОЕ ДЛЯ PR-3)
     */
    attachRetryButtons() {
        // Единый обработчик для всех кнопок повтора с data-retry атрибутами
        const retryButtons = document.querySelectorAll('[data-retry]');
        retryButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.triggerHapticFeedback('medium');
                
                const retryType = button.dataset.retry;
                switch (retryType) {
                    case 'latest-quotes':
                        this.retryLoadLatestQuotes();
                        break;
                    case 'recent-clicks':
                        this.retryLoadRecentClicks();
                        break;
                    case 'popular-books':
                        this.retryLoadPopularBooks();
                        break;
                    case 'popular-quotes':
                        this.retryLoadPopularQuotes();
                        break;
                    case 'popular-favorites':
                        this.retryLoadPopularFavorites();
                        break;
                    case 'leaderboard':
                        this.retryLoadLeaderboard();
                        break;
                    default:
                        // Fallback - перезагружаем все
                        this.loadAllSections();
                        break;
                }
            });
        });
    }
    
    /**
     * 🔄 НАСТРОЙКА СЛУШАТЕЛЕЙ ИЗМЕНЕНИЙ ЦИТАТ
     */
    setupQuoteChangeListeners() {
        // Listen for quote changes to refresh community data
        if (typeof document !== 'undefined') {
            const handleQuoteChange = (event) => {
                console.log('👥 CommunityPage: Получено событие quotes:changed:', event.detail);
                // Refresh top analyses when quotes change
                this.loadTopAnalyses().then(() => {
                    this.rerender();
                });
            };
            
            // Remove existing listener to avoid duplicates
            document.removeEventListener('quotes:changed', handleQuoteChange);
            document.addEventListener('quotes:changed', handleQuoteChange);
            
            // Store reference for cleanup
            this._quoteChangeHandler = handleQuoteChange;
        }
    }
    
    // Переключение вкладок — без промежуточных лоадеров
    switchTab(tabName) {
        this.activeTab = tabName;
        this.triggerHapticFeedback('light');
        this.rerender();
        // Предзагрузка данных для вкладки в фоне (без изменения UI)
        if (tabName === 'top') {
            Promise.allSettled([
                this._safe(async () => { if (!this.loaded.leaderboard) { const r = await this.api.getLeaderboard({ period: '7d', limit: 10 }); if (r?.success) { this.leaderboard = r.data || []; this.userProgress = r.me || null; this.loaded.leaderboard = true; } } }),
                this._safe(async () => { if (!this.loaded.popularQuotes) { let r = await this.api.getCommunityPopularFavorites({ period: '7d', limit: 10 }).catch(() => null); if (!(r && r.success)) r = await this.api.getCommunityPopularQuotes({ period: '7d', limit: 10 }).catch(() => null); if (r?.success) { const arr = r.data || r.quotes || []; this.popularQuotes = arr.map(q => ({ text: q.text, author: q.author, favorites: (typeof q.favorites === 'number') ? q.favorites : (q.count || 0) })); this.loaded.popularQuotes = true; } } })
            ]).then(() => this.rerender());
        } else if (tabName === 'stats') {
            Promise.allSettled([
                this._safe(async () => { if (!this.loaded.stats) { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; this.loaded.stats = true; } } }),
                this._safe(async () => { if (!this.loaded.insights && this.api.getCommunityInsights) { const r = await this.api.getCommunityInsights({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; this.loaded.insights = true; } } }),
                this._safe(async () => { if (!this.loaded.funFact && this.api.getCommunityFunFact) { const r = await this.api.getCommunityFunFact({ period: '7d' }); if (r?.success) { this.funFact = r.data; this.loaded.funFact = true; } } })
            ]).then(() => this.rerender());
        }
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ОБНОВЛЕН ДЛЯ PR-3!
     */
    // onShow больше НЕ делает первоначальных загрузок/лоадеров — только фоновые обновления при необходимости
    async onShow() {
        console.log('👥 CommunityPage: onShow - реализация SWR для фоновых обновлений');
        
        // ✅ НОВОЕ: Вызов warmupInitialStats при входе на экран
        if (this.statisticsService && typeof this.statisticsService.warmupInitialStats === 'function') {
            try {
                await this.statisticsService.warmupInitialStats();
                console.log('✅ CommunityPage: warmupInitialStats completed');
            } catch (error) {
                console.warn('⚠️ CommunityPage: warmupInitialStats failed:', error);
            }
        }
        
        // SWR: можно тихо перезагрузить что-то в фоне (не меняя UI) по таймауту/критерию устаревания
        // Например, раз в 10 минут:
        const last = this.state.get('community.lastUpdate') || 0;
        if (Date.now() - last > 10 * 60 * 1000) {
            this.state.set('community.lastUpdate', Date.now());
            console.log('🔄 CommunityPage: Данные устарели - запускаем фоновое обновление');
            // В фоне обновляем ключевые секции, но НЕ трогаем разметку до завершения, затем один общий rerender
            Promise.allSettled([
                this._safe(async () => { const r = await this.api.getCommunityStats(); if (r?.success) { this.communityData = { ...this.communityData, ...r.data }; } }),
                this._safe(async () => { const r = await this.api.getCommunityTrend(); if (r?.success) { this.communityTrend = r.data; } }),
                this._safe(async () => { const r = await this.api.getCommunityInsights?.({ period: '7d' }); if (r?.success) { this.communityInsights = r.insights; } })
            ]).then(() => {
                console.log('✅ CommunityPage: Фоновое обновление завершено');
                this.rerender();
            });
        } else {
            console.log('✅ CommunityPage: Данные актуальны, фоновое обновление не требуется');
        }
    }

    /**
     * 🔄 ЗАГРУЗКА ВСЕХ СЕКЦИЙ (ОБНОВЛЕНА ДЛЯ PR-3)
     */
    async loadAllSections() {
        console.log('🔄 CommunityPage: Загружаем все секции...');
        
        // Загружаем параллельно для лучшей производительности
        const loadPromises = [
            this.loadLatestQuotes(3), // Только 3 цитаты согласно требованиям
            this.loadPopularFavorites('7d', 10), // Популярные избранные цитаты для топа недели
            this.loadPopularBooks('7d', 10), // Популярные разборы недели для "Топ недели"
            this.loadRecentClicks(3), // Последние 3 клика для "Сейчас изучают"
            this.loadCommunityMessage(), // Сообщение от Анны
            this.loadCommunityTrend(), // Тренд недели
            this.loadLeaderboard(10, '7d') // Лидерборд за неделю
        ];

        try {
            await Promise.allSettled(loadPromises);
            console.log('✅ CommunityPage: Все секции загружены');
            this.rerender();
        } catch (error) {
            console.error('❌ CommunityPage: Ошибка загрузки секций:', error);
            this.rerender(); // Показываем что загружено
        }
    }

    /**
     * 🔄 МЕТОДЫ ПОВТОРА ЗАГРУЗКИ ДЛЯ ОБРАБОТКИ ОШИБОК (PR-3)
     */
    retryLoadLatestQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadLatestQuotes(5).then(() => this.rerender());
    }

    retryLoadPopularQuotes() {
        this.triggerHapticFeedback('medium');
        this.loadPopularQuotes('7d', 10).then(() => this.rerender());
    }

    retryLoadPopularFavorites() {
        this.triggerHapticFeedback('medium');
        this.loadPopularFavorites('7d', 10).then(() => this.rerender());
    }

    retryLoadPopularBooks() {
        this.triggerHapticFeedback('medium');
        this.loadPopularBooks('7d', 10).then(() => this.rerender());
    }

    retryLoadLeaderboard() {
        this.triggerHapticFeedback('medium');
        this.loadLeaderboard(10, '7d').then(() => this.rerender());
    }

    retryLoadRecentClicks() {
        this.triggerHapticFeedback('medium');
        this.loadRecentClicks(5).then(() => this.rerender());
    }

    /**
     * ➕ ДОБАВИТЬ ЦИТАТУ В ДНЕВНИК (НОВОЕ ДЛЯ PR-3)
     */
    async addQuoteToJournal(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.quote-card__add-btn');
        if (!button) return;
        
        const quoteCard = button.closest('.quote-card');
        
        if (!quoteCard) return;
        
        try {
            // Haptic feedback
            this.triggerHapticFeedback('medium');
            
            // Получаем данные цитаты из data-атрибутов или из DOM
            const quoteText = button.dataset.quoteText || quoteCard.querySelector('.quote-card__text')?.textContent?.replace(/"/g, '') || '';
            const quoteAuthor = button.dataset.quoteAuthor || quoteCard.querySelector('.quote-card__author')?.textContent?.replace('— ', '') || '';
            
            // Показываем loading состояние
            button.innerHTML = '<span class="loading-spinner-small"></span>';
            button.disabled = true;
            
            // Добавляем цитату через API
            const response = await this.api.addQuote({
                text: quoteText,
                author: quoteAuthor,
                source: 'community'
            });
            
            if (response && response.success) {
                // Успех - показываем галочку
                button.innerHTML = '<span class="add-icon">✓</span>';
                button.classList.add('added');
                this.triggerHapticFeedback('success');
                
                // Показываем уведомление
                this.showNotification('Цитата добавлена в ваш дневник!', 'success');
                
                // Возвращаем кнопку в исходное состояние через 2 секунды
                setTimeout(() => {
                    button.innerHTML = '<span class="add-icon">+</span>';
                    button.classList.remove('added');
                    button.disabled = false;
                }, 2000);
            } else {
                throw new Error(response?.message || 'Ошибка добавления цитаты');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            
            // Возвращаем кнопку в исходное состояние
            button.innerHTML = '<span class="add-icon">+</span>';
            button.disabled = false;
            
            // Показываем ошибку
            this.showNotification('Ошибка при добавлении цитаты', 'error');
            this.triggerHapticFeedback('error');
        }
    }

    /**
     * ❤️ ДОБАВИТЬ ЦИТАТУ В ИЗБРАННОЕ (НОВОЕ)
     */
    async addQuoteToFavorites(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.quote-card__heart-btn');
        if (!button) return;
        
        const quoteCard = button.closest('.quote-card');
        
        if (!quoteCard) return;
        
        try {
            // Haptic feedback
            this.triggerHapticFeedback('medium');
            
            // Получаем данные цитаты из data-атрибутов или из DOM
            const quoteText = button.dataset.quoteText || quoteCard.querySelector('.quote-card__text')?.textContent?.replace(/"/g, '') || '';
            const quoteAuthor = button.dataset.quoteAuthor || quoteCard.querySelector('.quote-card__author')?.textContent?.replace('— ', '') || '';
            
            // Показываем loading состояние
            button.innerHTML = '<span class="loading-spinner-small"></span>';
            button.disabled = true;
            
            // Добавляем цитату в избранное через API
            const response = await this.api.addQuote({
                text: quoteText,
                author: quoteAuthor,
                source: 'community',
                isFavorite: true
            });
            
            if (response && response.success) {
                // Успех - показываем заполненное сердце
                button.innerHTML = '<span class="heart-icon">💖</span>';
                button.classList.add('favorited');
                this.triggerHapticFeedback('success');
                
                // Показываем уведомление
                this.showNotification('Добавлено в избранное!', 'success');
                
                // Возвращаем кнопку в исходное состояние через 2 секунды
                setTimeout(() => {
                    button.innerHTML = '<span class="heart-icon">❤</span>';
                    button.classList.remove('favorited');
                    button.disabled = false;
                }, 2000);
            } else {
                throw new Error(response?.message || 'Ошибка добавления в избранное');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления в избранное:', error);
            
            // Возвращаем кнопку в исходное состояние
            button.innerHTML = '<span class="heart-icon">❤</span>';
            button.disabled = false;
            
            // Показываем ошибку
            this.showNotification('Ошибка при добавлении в избранное', 'error');
            this.triggerHapticFeedback('error');
        }
    }

    /**
     * 🎯 ИЗУЧИТЬ ТРЕНД (НОВОЕ ДЛЯ PR-3)
     */
    exploreTrend(event) {
        event.preventDefault();
        this.triggerHapticFeedback('medium');
        
        // Здесь можно добавить логику перехода к изучению тренда
        console.log('🎯 Изучение тренда недели');
        this.showNotification('Функция в разработке', 'info');
    }

    /**
     * 🔔 ПОКАЗАТЬ УВЕДОМЛЕНИЕ
     */
    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        // Добавляем на страницу
        document.body.appendChild(notification);
        
        // Показываем
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Убираем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 🕒 ФОРМАТИРОВАНИЕ ВРЕМЕНИ КЛИКА
     */
    formatClickTime(clickTime) {
        if (!clickTime) return 'недавно';
        
        try {
            const now = new Date();
            const clickDate = new Date(clickTime);
            const diffMs = now - clickDate;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMins < 60) {
                return `${diffMins} мин назад`;
            } else if (diffHours < 24) {
                return `${diffHours} ч назад`;
            } else if (diffDays < 7) {
                return `${diffDays} дн назад`;
            } else {
                return clickDate.toLocaleDateString('ru-RU');
            }
        } catch (error) {
            return 'недавно';
        }
    }

    /**
     * 📅 ФОРМАТИРОВАНИЕ ДАТЫ
     */
    formatDate(date) {
        if (!date) return '';
        
        try {
            const dateObj = new Date(date);
            const now = new Date();
            const diffMs = now - dateObj;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return 'сегодня';
            } else if (diffDays === 1) {
                return 'вчера';
            } else if (diffDays < 7) {
                return `${diffDays} дн назад`;
            } else {
                return dateObj.toLocaleDateString('ru-RU');
            }
        } catch (error) {
            return '';
        }
    }
    
    onHide() {
        console.log('👥 CommunityPage: onHide');
        // Cleanup event listeners
        if (this._quoteChangeHandler) {
            document.removeEventListener('quotes:changed', this._quoteChangeHandler);
        }
    }

    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
            
            // ✅ НОВОЕ: Добавляем плавные анимации через CSS классы
            this.triggerContentAnimations();
        }
    }
    
    /**
     * 🎬 ПЛАВНЫЕ АНИМАЦИИ ПОЯВЛЕНИЯ ЧЕРЕЗ CSS КЛАССЫ
     */
    triggerContentAnimations() {
        // Получаем контейнер контента для анимаций
        const contentContainer = document.querySelector('.content');
        if (!contentContainer) return;
        
        // Добавляем класс для запуска анимаций
        setTimeout(() => {
            contentContainer.classList.add('animate-content');
        }, 50); // Небольшая задержка для плавности
        
        // Убираем класс после завершения анимаций
        setTimeout(() => {
            contentContainer.classList.remove('animate-content');
        }, 1000);
    }

    /**
     * 🧹 ОЧИСТКА РЕСУРСОВ
     */
    destroy() {
        console.log('🧹 CommunityPage: Очистка ресурсов');
        // Remove event listeners
        if (this._quoteChangeHandler) {
            document.removeEventListener('quotes:changed', this._quoteChangeHandler);
            this._quoteChangeHandler = null;
        }

        // ✅ НОВОЕ: Сброс флагов
        this.communityLoaded = false;
        this.communityLoading = false;

        // Сброс состояний загрузки
        Object.keys(this.loadingStates).forEach(key => {
            this.loadingStates[key] = false;
        });

        // Сброс состояний ошибок
        Object.keys(this.errorStates).forEach(key => {
            this.errorStates[key] = null;
        });
    }
}

// 📤 Экспорт класса
window.CommunityPage = CommunityPage;