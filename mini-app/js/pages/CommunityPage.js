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
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.communityLoaded = false;
        this.communityLoading = false;
        
        // Данные для "Сейчас изучают" из StatisticsService
        this.topAnalyses = [];
        
        // Состояние (точно как в концепте)
        this.activeTab = 'feed'; // feed, top, stats
        
        // ✅ НОВОЕ: Реальные данные из API (PR-3)
        this.communityData = {
            activeReaders: 127,
            newQuotes: 89,
            totalReaders: 1247,
            totalQuotes: 8156,
            totalAuthors: 342,
            daysActive: 67
        };

        // ✅ НОВОЕ: Данные для различных секций (PR-3)
        this.latestQuotes = [];
        this.popularQuotes = [];
        this.popularBooks = [];
        this.recentClicks = [];
        this.leaderboard = [];

        // ✅ НОВОЕ: Состояния загрузки для каждой секции (PR-3)
        this.loadingStates = {
            latestQuotes: false,
            popularQuotes: false,
            popularBooks: false,
            recentClicks: false,
            leaderboard: false,
            stats: false
        };

        // ✅ НОВОЕ: Состояния ошибок для каждой секции (PR-3)
        this.errorStates = {
            latestQuotes: null,
            popularQuotes: null,
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
                this.latestQuotes = response.quotes || [];
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
     * 📚 ЗАГРУЗКА ПОПУЛЯРНЫХ КНИГ СООБЩЕСТВА (PR-3)
     */
    async loadPopularBooks(period = '7d', limit = 10) {
        if (this.loadingStates.popularBooks) return;
        
        try {
            this.loadingStates.popularBooks = true;
            this.errorStates.popularBooks = null;
            console.log('📚 CommunityPage: Загружаем популярные книги...');
            
            const response = await this.api.getCommunityPopularBooks({ period, limit });
            if (response && response.success) {
                this.popularBooks = response.data || [];
                console.log('✅ CommunityPage: Популярные книги загружены:', this.popularBooks.length);
            } else {
                this.popularBooks = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки популярных книг:', error);
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
                this.recentClicks = response.data || [];
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
     * 🏆 ЗАГРУЗКА ТАБЛИЦЫ ЛИДЕРОВ (PR-3)
     */
    async loadLeaderboard(limit = 10) {
        if (this.loadingStates.leaderboard) return;
        
        try {
            this.loadingStates.leaderboard = true;
            this.errorStates.leaderboard = null;
            console.log('🏆 CommunityPage: Загружаем таблицу лидеров...');
            
            const response = await this.api.getLeaderboard({ limit });
            if (response && response.success) {
                this.leaderboard = response.data || [];
                console.log('✅ CommunityPage: Таблица лидеров загружена:', this.leaderboard.length);
            } else {
                this.leaderboard = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки таблицы лидеров:', error);
            this.errorStates.leaderboard = error.message || 'Ошибка загрузки лидеров';
            this.leaderboard = [];
        } finally {
            this.loadingStates.leaderboard = false;
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
        // "Сейчас изучают" секция с данными из StatisticsService
        const currentlyStudyingSection = this.renderCurrentlyStudyingSection();
        
        // ✅ НОВОЕ: Секция последних цитат сообщества (PR-3)
        const latestQuotesSection = this.renderLatestQuotesSection();
        
        return `
            <div class="stats-summary">
                📊 Сегодня: ${this.communityData.activeReaders} активных читателей • ${this.communityData.newQuotes} новых цитат
            </div>
            
            ${currentlyStudyingSection}
            
            ${latestQuotesSection}
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                <div style="font-size: 11px; margin-bottom: 6px;">💬 Сообщение от Анны</div>
                <div style="font-size: 12px; margin-bottom: 6px;">"Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!"</div>
                <div style="font-size: 10px; opacity: 0.8;">2 часа назад</div>
            </div>
            
            <div class="promo-section">
                <div class="promo-title">🎯 Тренд недели</div>
                <div class="promo-text">Тема "Психология отношений" набирает популярность</div>
                <button class="promo-btn" id="exploreBtn">Изучить разборы</button>
            </div>
        `;
    }

    /**
     * 📰 СЕКЦИЯ ПОСЛЕДНИХ ЦИТАТ СООБЩЕСТВА (НОВАЯ ДЛЯ PR-3)
     */
    renderLatestQuotesSection() {
        if (this.loadingStates.latestQuotes) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">💫 Последние цитаты сообщества</div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Загружаем цитаты...</div>
                    </div>
                </div>
            `;
        }

        if (this.errorStates.latestQuotes) {
            return `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">Ошибка загрузки</div>
                    <div class="error-description">${this.errorStates.latestQuotes}</div>
                    <button class="error-retry-btn" onclick="this.retryLoadLatestQuotes()">Повторить</button>
                </div>
            `;
        }

        if (!this.latestQuotes || this.latestQuotes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">Пока нет цитат</div>
                    <div class="empty-description">Станьте первым, кто поделится мудростью!</div>
                </div>
            `;
        }

        // Показываем только первую цитату как "Цитата дня"
        const latestQuote = this.latestQuotes[0];
        
        return `
            <div class="mvp-community-item">
                <div class="mvp-community-title">💫 Цитата дня от сообщества</div>
                <div class="mvp-community-text">"${latestQuote.text}"</div>
                <div class="mvp-community-author">— ${latestQuote.author}</div>
            </div>
        `;
    }
    
    /**
     * 📚 СЕКЦИЯ "СЕЙЧАС ИЗУЧАЮТ" (ИНТЕГРАЦИЯ СО STATISTICSSERVICE)
     */
    renderCurrentlyStudyingSection() {
        if (!this.topAnalyses || this.topAnalyses.length === 0) {
            return `
                <div class="mvp-community-item">
                    <div class="mvp-community-title">📚 Сейчас изучают</div>
                    <div class="mvp-community-text">Загружаем популярные разборы...</div>
                    <div class="mvp-community-author">Данные обновляются</div>
                </div>
            `;
        }
        
        const topAnalysesCards = this.topAnalyses.map((analysis, index) => `
            <div class="currently-studying-item" data-book-id="${analysis.id}">
                <div class="studying-rank">${index + 1}</div>
                <div class="studying-content">
                    <div class="studying-title">${analysis.title}</div>
                    <div class="studying-author">${analysis.author}</div>
                    <div class="studying-stats">${analysis.clicks || 0} читателей изучают</div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="currently-studying-section">
                <div class="mvp-community-title">📚 Сейчас изучают</div>
                <div class="currently-studying-list">
                    ${topAnalysesCards}
                </div>
            </div>
        `;
    }
    
    /**
     * 🏆 ТАБ ТОП НЕДЕЛИ (ОБНОВЛЕН ДЛЯ PR-3 - РЕАЛЬНЫЕ ДАННЫЕ ИЗ API!)
     */
    renderTopTab() {
        const leaderboardSection = this.renderLeaderboardSection();
        const popularQuotesSection = this.renderPopularQuotesSection();
        const popularBooksSection = this.renderPopularBooksSection();

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
            
            ${leaderboardSection}
            ${popularQuotesSection}
            ${popularBooksSection}
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px; margin-top: 16px;">
                <div style="font-size: 11px; margin-bottom: 6px; font-weight: 600;">🎯 Ваш прогресс в топах</div>
                <div style="font-size: 10px; opacity: 0.9; margin-bottom: 8px;">👑 Читатели: #2 место • ⭐ Цитаты: топ-5 • 📚 Интерес к разборам: активный</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 78%; background: white;"></div>
                </div>
                <div style="font-size: 10px; opacity: 0.9;">Добавьте еще 5 цитат до лидерства!</div>
            </div>
        `;
    }

    /**
     * 🏆 СЕКЦИЯ ЛИДЕРБОРДА (НОВАЯ ДЛЯ PR-3)
     */
    renderLeaderboardSection() {
        if (this.loadingStates.leaderboard) {
            return `
                <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin-bottom: 16px; text-align: center; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                    <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 6px;">🏆 Лидеры недели</div>
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
                    <button class="error-retry-btn" onclick="this.retryLoadLeaderboard()">Повторить</button>
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
            return `
                <div class="leaderboard-item">
                    <div class="rank-badge ${rankClass}">${index + 1}</div>
                    <div class="user-info">
                        <div class="user-name">${leader.name || 'Анонимный читатель'}</div>
                        <div class="user-stats">${leader.quotesCount || 0} цитат за неделю</div>
                        <div class="user-achievement">${leader.achievement || '📚 "Активный читатель"'}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin-bottom: 16px; text-align: center; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 6px;">🏆 Лидеры недели</div>
                <div style="font-size: 10px; color: var(--text-secondary);">Самые активные читатели сообщества</div>
            </div>
            ${leaderboardItems}
        `;
    }

    /**
     * ⭐ СЕКЦИЯ ПОПУЛЯРНЫХ ЦИТАТ (НОВАЯ ДЛЯ PR-3)
     */
    renderPopularQuotesSection() {
        if (this.loadingStates.popularQuotes) {
            return `
                <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                    <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">⭐ Популярные цитаты недели</div>
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
                    <button class="error-retry-btn" onclick="this.retryLoadPopularQuotes()">Повторить</button>
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
            <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                <div style="font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 4px;">"${quote.text}"</div>
                <div style="font-size: 10px; color: var(--text-primary); font-weight: 500;">${quote.author} • добавили ${quote.count || 0} человек</div>
            </div>
        `).join('');

        return `
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">⭐ Популярные цитаты недели</div>
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
                <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                    <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">📚 Популярные разборы недели</div>
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
                    <button class="error-retry-btn" onclick="this.retryLoadPopularBooks()">Повторить</button>
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
            <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                <div style="font-size: 11px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${index + 1}. "${book.title}" ${book.author}</div>
                <div style="font-size: 10px; color: var(--text-secondary);">💫 ${book.clicksCount || 0} человек заинтересовалось</div>
            </div>
        `).join('');

        return `
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">📚 Популярные разборы недели</div>
                ${booksItems}
            </div>
        `;
    }
    
    /**
     * 📊 ТАБ СТАТИСТИКА (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderStatsTab() {
        return `
            <div style="background: var(--surface); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-weight: 600; margin-bottom: 12px; font-size: 13px; color: var(--text-primary); text-align: center;">📈 Общая статистика сообщества</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalReaders.toLocaleString()}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Всего читателей</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalQuotes.toLocaleString()}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Цитат собрано</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalAuthors}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Авторов</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.daysActive}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Дней работы</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">📚 Интерес к разборам</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">🔥 Лидер недели: "Искусство любить"</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📈 Рост интереса: +23% к прошлой неделе</div>
                <div style="font-size: 11px; color: var(--text-secondary);">📖 Активно изучают 12 разборов</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">✍️ Популярные авторы в цитатах</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">1. Эрих Фромм — 89 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">2. Анна Бусел — 67 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">3. Марина Цветаева — 45 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">4. Будда — 34 цитаты</div>
                <div style="font-size: 11px; color: var(--text-secondary);">5. Ошо — 29 цитат</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">🏆 Достижения сообщества</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">🔥 "Коллекционер мудрости" — 23 человека</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📚 "Философ недели" — 15 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">💎 "Мыслитель" — 11 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📖 "Любитель классики" — 8 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary);">⭐ "Вдохновитель" — 3 человека</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">📊 Ваш рейтинг</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">#2</div>
                        <div style="font-size: 9px; color: var(--text-secondary);">Место в топе</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">78%</div>
                        <div style="font-size: 9px; color: var(--text-secondary);">Активнее других</div>
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px;">
                <div style="font-size: 11px; margin-bottom: 6px; font-weight: 600; text-align: center;">✨ Интересный факт</div>
                <div style="font-size: 10px; opacity: 0.9; text-align: center; line-height: 1.3;">Цитаты Эриха Фромма чаще всего добавляют в избранное в сообществе!</div>
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
        this.setupQuoteChangeListeners();
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
                this.app.router.navigate('/catalog');
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
        // Создаем единый обработчик для всех кнопок повтора
        const retryButtons = document.querySelectorAll('.error-retry-btn');
        retryButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.triggerHapticFeedback('medium');
                
                // Определяем какую секцию нужно перезагрузить на основе контекста
                const errorState = button.closest('.error-state');
                if (!errorState) return;

                const errorTitle = errorState.querySelector('.error-title')?.textContent || '';
                
                if (errorTitle.includes('цитат') && errorTitle.includes('лидерборд')) {
                    this.retryLoadLeaderboard();
                } else if (errorTitle.includes('цитат')) {
                    // Проверяем контекст - популярные или последние
                    if (errorState.previousElementSibling?.textContent?.includes('Популярные')) {
                        this.retryLoadPopularQuotes();
                    } else {
                        this.retryLoadLatestQuotes();
                    }
                } else if (errorTitle.includes('книг')) {
                    this.retryLoadPopularBooks();
                } else if (errorTitle.includes('лидерборд')) {
                    this.retryLoadLeaderboard();
                } else {
                    // Fallback - перезагружаем все
                    this.loadAllSections();
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
    
    switchTab(tabName) {
        this.activeTab = tabName;
        this.triggerHapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ОБНОВЛЕН ДЛЯ PR-3!
     */
    async onShow() {
        console.log('👥 CommunityPage: onShow - БЕЗ ШАПКИ!');
        
        // ✅ НОВОЕ: Вызов warmupInitialStats при входе на экран
        if (this.statisticsService && typeof this.statisticsService.warmupInitialStats === 'function') {
            try {
                await this.statisticsService.warmupInitialStats();
                console.log('✅ CommunityPage: warmupInitialStats completed');
            } catch (error) {
                console.warn('⚠️ CommunityPage: warmupInitialStats failed:', error);
            }
        }
        
        // Загружаем топ-анализы для секции "Сейчас изучают"
        await this.loadTopAnalyses();
        
        // ✅ НОВОЕ PR-3: Загружаем данные для всех секций
        await this.loadAllSections();
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка как в HomePage
        if (!this.communityLoaded) {
            console.log('🔄 CommunityPage: Первый показ, загружаем данные');
            this.loadCommunityData().then(() => {
                this.rerender();
            });
        } else {
            // Проверяем актуальность данных (10 минут)
            const lastUpdate = this.state.get('community.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 CommunityPage: Данные устарели, обновляем');
                this.loadCommunityData().then(() => {
                    this.rerender();
                });
            } else {
                console.log('✅ CommunityPage: Данные актуальны');
                this.rerender(); // Rerender to show loaded data
            }
        }
    }

    /**
     * 🔄 ЗАГРУЗКА ВСЕХ СЕКЦИЙ (НОВАЯ ДЛЯ PR-3)
     */
    async loadAllSections() {
        console.log('🔄 CommunityPage: Загружаем все секции...');
        
        // Загружаем параллельно для лучшей производительности
        const loadPromises = [
            this.loadLatestQuotes(5),
            this.loadPopularQuotes('7d', 10),
            this.loadPopularBooks('7d', 10),
            this.loadLeaderboard(10),
            this.loadRecentClicks(5)
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

    retryLoadPopularBooks() {
        this.triggerHapticFeedback('medium');
        this.loadPopularBooks('7d', 10).then(() => this.rerender());
    }

    retryLoadLeaderboard() {
        this.triggerHapticFeedback('medium');
        this.loadLeaderboard(10).then(() => this.rerender());
    }

    retryLoadRecentClicks() {
        this.triggerHapticFeedback('medium');
        this.loadRecentClicks(5).then(() => this.rerender());
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