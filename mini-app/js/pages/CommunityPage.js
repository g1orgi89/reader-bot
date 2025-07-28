/**
 * 👥 СООБЩЕСТВО ЧИТАТЕЛЕЙ - CommunityPage.js
 * 
 * Функциональность:
 * - 3 таба: 📰 Лента, 🏆 Топ недели, 📊 Статистика
 * - MVP версия сообщества с основным контентом
 * - Лента: цитата дня, популярные разборы, достижения, сообщения от Анны
 * - Топ недели: лидеры читателей, популярные цитаты, популярные разборы
 * - Статистика: общая статистика сообщества, рейтинг пользователя
 * - Интеграция с API и State Management
 */

class CommunityPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние страницы
        this.activeTab = 'feed'; // feed, top, stats
        this.loading = false;
        this.error = null;
        
        // Данные сообщества
        this.communityData = {
            stats: {
                activeReaders: 127,
                newQuotes: 89,
                totalReaders: 1247,
                totalQuotes: 8156,
                totalAuthors: 342,
                daysActive: 67
            },
            leaderboard: [],
            popularQuotes: [],
            popularBooks: [],
            userRank: null
        };
        
        // Подписки на изменения состояния
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
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения данных сообщества
        const communitySubscription = this.state.subscribe('community', (data) => {
            this.updateCommunityUI(data);
        });
        
        // Подписка на изменения профиля пользователя
        const userSubscription = this.state.subscribe('user.profile', (profile) => {
            this.updateUserRankUI(profile);
        });
        
        this.subscriptions.push(communitySubscription, userSubscription);
    }
    
    /**
     * 📊 Загрузка начальных данных
     */
    async loadInitialData() {
        try {
            this.loading = true;
            this.state.set('ui.loading', true);
            
            // Параллельная загрузка данных сообщества 
            const [stats, leaderboard, popularContent] = await Promise.all([
                this.loadCommunityStats(),
                this.loadLeaderboard(),
                this.loadPopularContent()
            ]);
            
            // Обновление состояния
            if (stats) this.communityData.stats = { ...this.communityData.stats, ...stats };
            if (leaderboard) this.communityData.leaderboard = leaderboard;
            if (popularContent) {
                this.communityData.popularQuotes = popularContent.quotes || [];
                this.communityData.popularBooks = popularContent.books || [];
            }
            
            this.state.set('community', this.communityData);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных сообщества:', error);
            this.error = error.message;
            this.showError('Не удалось загрузить данные сообщества');
        } finally {
            this.loading = false;
            this.state.set('ui.loading', false);
        }
    }
    
    /**
     * 📈 Загрузка статистики сообщества
     */
    async loadCommunityStats() {
        try {
            const stats = await this.api.getCommunityStats();
            return stats;
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики сообщества:', error);
            // Возвращаем моковые данные как fallback
            return this.communityData.stats;
        }
    }
    
    /**
     * 🏆 Загрузка рейтинга пользователей
     */
    async loadLeaderboard() {
        try {
            const leaderboard = await this.api.getLeaderboard({ limit: 10 });
            return leaderboard;
        } catch (error) {
            console.error('❌ Ошибка загрузки рейтинга:', error);
            // Возвращаем моковые данные
            return [
                { id: '1', name: 'Мария К.', quotesThisWeek: 23, achievement: '🔥 "Коллекционер мудрости"' },
                { id: '2', name: 'Анна М.', quotesThisWeek: 18, achievement: '📚 "Философ недели"', isCurrentUser: true },
                { id: '3', name: 'Елена В.', quotesThisWeek: 15, achievement: '💎 "Мыслитель"' }
            ];
        }
    }
    
    /**
     * 📚 Загрузка популярного контента
     */
    async loadPopularContent() {
        try {
            const [quotes, books] = await Promise.all([
                this.api.getPopularQuotes({ limit: 3 }),
                this.api.getPopularBooks({ limit: 3 })
            ]);
            
            return { quotes, books };
        } catch (error) {
            console.error('❌ Ошибка загрузки популярного контента:', error);
            // Возвращаем моковые данные
            return {
                quotes: [
                    { text: 'Любовь — это решение любить', author: 'Эрих Фромм', addedBy: 23 },
                    { text: 'В каждом слове — целая жизнь', author: 'Марина Цветаева', addedBy: 18 },
                    { text: 'Хорошая жизнь строится, а не дается', author: 'Анна Бусел', addedBy: 15 }
                ],
                books: [
                    { title: 'Искусство любить', author: 'Эрих Фромм', interested: 47 },
                    { title: 'Быть собой', author: 'Анна Бусел', interested: 31 },
                    { title: 'Письма поэту', author: 'Рильке', interested: 23 }
                ]
            };
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        return `
            <div class="community-page">
                <div class="page-header">👥 Сообщество читателей</div>
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
                <button class="tab ${this.activeTab === 'feed' ? 'active' : ''}" 
                        data-tab="feed">📰 Лента</button>
                <button class="tab ${this.activeTab === 'top' ? 'active' : ''}" 
                        data-tab="top">🏆 Топ недели</button>
                <button class="tab ${this.activeTab === 'stats' ? 'active' : ''}" 
                        data-tab="stats">📊 Статистика</button>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер содержимого активного таба
     */
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
     * 📰 Рендер таба "Лента"
     */
    renderFeedTab() {
        return `
            <div class="tab-content feed-tab">
                ${this.renderCommunityStats()}
                ${this.renderQuoteOfTheDay()}
                ${this.renderPopularBooks()}
                ${this.renderAchievements()}
                ${this.renderAnnaMessage()}
                ${this.renderTrendOfWeek()}
            </div>
        `;
    }
    
    /**
     * 📊 Рендер статистики сообщества (краткой для ленты)
     */
    renderCommunityStats() {
        const stats = this.communityData.stats;
        
        return `
            <div class="stats-summary">
                📊 Сегодня: ${stats.activeReaders} активных читателей • ${stats.newQuotes} новых цитат
            </div>
        `;
    }
    
    /**
     * 💫 Рендер цитаты дня
     */
    renderQuoteOfTheDay() {
        const popularQuotes = this.communityData.popularQuotes;
        const quoteOfDay = popularQuotes[0];
        
        if (!quoteOfDay) return '';
        
        return `
            <div class="mvp-community-item">
                <div class="mvp-community-title">💫 Цитата дня от сообщества</div>
                <div class="mvp-community-text">"${quoteOfDay.text}"</div>
                <div class="mvp-community-author">— ${quoteOfDay.author}</div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер популярных разборов
     */
    renderPopularBooks() {
        const books = this.communityData.popularBooks;
        
        if (!books.length) return '';
        
        const topBook = books[0];
        
        return `
            <div class="mvp-community-item">
                <div class="mvp-community-title">📚 Популярные разборы</div>
                <div class="mvp-community-text">"${topBook.title}" — ${topBook.interested} покупок на этой неделе</div>
                <div class="mvp-community-author">Читатели с похожими интересами активно изучают эту тему</div>
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер достижений недели
     */
    renderAchievements() {
        return `
            <div class="mvp-community-item">
                <div class="mvp-community-title">🏆 Достижения недели</div>
                <div class="mvp-community-text">23 читателя получили значок "Коллекционер мудрости"</div>
                <div class="mvp-community-author">А вы уже собрали 50 цитат?</div>
            </div>
        `;
    }
    
    /**
     * 💬 Рендер сообщения от Анны
     */
    renderAnnaMessage() {
        return `
            <div class="anna-message">
                <div class="anna-message-header">💬 Сообщение от Анны</div>
                <div class="anna-message-text">"Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!"</div>
                <div class="anna-message-time">2 часа назад</div>
            </div>
        `;
    }
    
    /**
     * 🎯 Рендер тренда недели
     */
    renderTrendOfWeek() {
        return `
            <div class="promo-section">
                <div class="promo-title">🎯 Тренд недели</div>
                <div class="promo-text">Тема "Психология отношений" набирает популярность</div>
                <button class="promo-btn" id="exploreBtn">Изучить разборы</button>
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер таба "Топ недели"
     */
    renderTopTab() {
        return `
            <div class="tab-content top-tab">
                ${this.renderTopStats()}
                ${this.renderLeaderboardSection()}
                ${this.renderPopularQuotesSection()}
                ${this.renderPopularBooksSection()}
                ${this.renderUserProgress()}
            </div>
        `;
    }
    
    /**
     * 📊 Рендер статистики для топа
     */
    renderTopStats() {
        const stats = this.communityData.stats;
        
        return `
            <div class="community-stats-grid">
                <div class="community-stat-card">
                    <div class="community-stat-number">${stats.activeReaders}</div>
                    <div class="community-stat-label">Активных читателей</div>
                </div>
                <div class="community-stat-card">
                    <div class="community-stat-number">${stats.newQuotes}</div>
                    <div class="community-stat-label">Новых цитат</div>
                </div>
            </div>
        `;
    }
    
    /**
     * 👑 Рендер секции лидеров
     */
    renderLeaderboardSection() {
        const leaderboard = this.communityData.leaderboard;
        
        return `
            <div class="leaderboard-section">
                <div class="section-header">
                    <div class="section-title">🏆 Лидеры недели</div>
                    <div class="section-subtitle">Самые активные читатели сообщества</div>
                </div>
                
                <div class="leaderboard-list">
                    ${leaderboard.slice(0, 3).map((user, index) => this.renderLeaderboardItem(user, index + 1)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер элемента лидербоарда
     */
    renderLeaderboardItem(user, rank) {
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const currentUserClass = user.isCurrentUser ? 'current-user' : '';
        
        return `
            <div class="leaderboard-item ${currentUserClass}">
                <div class="rank-badge ${rankClass}">${rank}</div>
                <div class="user-info">
                    <div class="user-name">${user.name}${user.isCurrentUser ? ' (вы)' : ''}</div>
                    <div class="user-stats">${user.quotesThisWeek} цитат за неделю</div>
                    <div class="user-achievement">${user.achievement}</div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⭐ Рендер популярных цитат недели
     */
    renderPopularQuotesSection() {
        const quotes = this.communityData.popularQuotes;
        
        return `
            <div class="popular-section">
                <div class="popular-header">⭐ Популярные цитаты недели</div>
                <div class="popular-list">
                    ${quotes.map(quote => this.renderPopularQuote(quote)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 💫 Рендер популярной цитаты
     */
    renderPopularQuote(quote) {
        return `
            <div class="popular-item">
                <div class="popular-text">"${quote.text}"</div>
                <div class="popular-meta">${quote.author} • добавили ${quote.addedBy} человек</div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер популярных разборов недели
     */
    renderPopularBooksSection() {
        const books = this.communityData.popularBooks;
        
        return `
            <div class="popular-section">
                <div class="popular-header">📚 Популярные разборы недели</div>
                <div class="popular-list">
                    ${books.map((book, index) => this.renderPopularBook(book, index + 1)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер популярной книги
     */
    renderPopularBook(book, rank) {
        return `
            <div class="popular-item">
                <div class="popular-title">${rank}. "${book.title}" ${book.author}</div>
                <div class="popular-meta">💫 ${book.interested} человек заинтересовалось</div>
            </div>
        `;
    }
    
    /**
     * 📈 Рендер прогресса пользователя
     */
    renderUserProgress() {
        const userStats = this.state.get('stats') || {};
        const progressPercent = Math.min((userStats.thisWeek || 0) * 4, 100); // 25% за каждую цитату
        
        return `
            <div class="user-progress-section">
                <div class="progress-title">🎯 Ваш прогресс в топах</div>
                <div class="progress-text">👑 Читатели: #2 место • ⭐ Цитаты: топ-5 • 📚 Интерес к разборам: активный</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-hint">Добавьте еще 5 цитат до лидерства!</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер таба "Статистика"
     */
    renderStatsTab() {
        return `
            <div class="tab-content stats-tab">
                ${this.renderOverallStats()}
                ${this.renderBookAnalytics()}
                ${this.renderPopularAuthors()}
                ${this.renderAchievementsStats()}
                ${this.renderUserRating()}
                ${this.renderInterestingFact()}
            </div>
        `;
    }
    
    /**
     * 📈 Рендер общей статистики
     */
    renderOverallStats() {
        const stats = this.communityData.stats;
        
        return `
            <div class="overall-stats-section">
                <div class="stats-header">📈 Общая статистика сообщества</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${stats.totalReaders.toLocaleString()}</div>
                        <div class="stat-label">Всего читателей</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.totalQuotes.toLocaleString()}</div>
                        <div class="stat-label">Цитат собрано</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.totalAuthors}</div>
                        <div class="stat-label">Авторов</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.daysActive}</div>
                        <div class="stat-label">Дней работы</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер аналитики по разборам
     */
    renderBookAnalytics() {
        return `
            <div class="analytics-section">
                <div class="analytics-title">📚 Интерес к разборам</div>
                <div class="analytics-item">🔥 Лидер недели: "Искусство любить"</div>
                <div class="analytics-item">📈 Рост интереса: +23% к прошлой неделе</div>
                <div class="analytics-item">📖 Активно изучают 12 разборов</div>
            </div>
        `;
    }
    
    /**
     * ✍️ Рендер популярных авторов
     */
    renderPopularAuthors() {
        const authors = [
            { name: 'Эрих Фромм', count: 89 },
            { name: 'Анна Бусел', count: 67 },
            { name: 'Марина Цветаева', count: 45 },
            { name: 'Будда', count: 34 },
            { name: 'Ошо', count: 29 }
        ];
        
        return `
            <div class="analytics-section">
                <div class="analytics-title">✍️ Популярные авторы в цитатах</div>
                ${authors.map((author, index) => `
                    <div class="analytics-item">${index + 1}. ${author.name} — ${author.count} цитат</div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер статистики достижений
     */
    renderAchievementsStats() {
        const achievements = [
            { name: '🔥 "Коллекционер мудрости"', count: 23 },
            { name: '📚 "Философ недели"', count: 15 },
            { name: '💎 "Мыслитель"', count: 11 },
            { name: '📖 "Любитель классики"', count: 8 },
            { name: '⭐ "Вдохновитель"', count: 3 }
        ];
        
        return `
            <div class="analytics-section">
                <div class="analytics-title">🏆 Достижения сообщества</div>
                ${achievements.map(achievement => `
                    <div class="analytics-item">${achievement.name} — ${achievement.count} человек</div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 📊 Рендер рейтинга пользователя
     */
    renderUserRating() {
        const userStats = this.state.get('stats') || {};
        const rank = 2; // Можно получить из API
        const percentile = 78; // Можно рассчитать
        
        return `
            <div class="user-rating-section">
                <div class="rating-title">📊 Ваш рейтинг</div>
                <div class="rating-grid">
                    <div class="rating-item">
                        <div class="rating-number">#${rank}</div>
                        <div class="rating-label">Место в топе</div>
                    </div>
                    <div class="rating-item">
                        <div class="rating-number">${percentile}%</div>
                        <div class="rating-label">Активнее других</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ✨ Рендер интересного факта
     */
    renderInterestingFact() {
        return `
            <div class="interesting-fact">
                <div class="fact-title">✨ Интересный факт</div>
                <div class="fact-text">Цитаты Эриха Фромма чаще всего добавляют в избранное в сообществе!</div>
            </div>
        `;
    }
    
    /**
     * 🎯 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Переключение табов
        this.attachTabListeners();
        
        // Кнопка "Изучить разборы"
        this.attachExploreButton();
        
        // Клики по элементам лидербоарда и популярному контенту
        this.attachInteractionListeners();
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
     * 🎯 Обработчик кнопки изучения разборов
     */
    attachExploreButton() {
        const exploreBtn = document.getElementById('exploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.telegram.hapticFeedback('light');
                this.app.router.navigate('/catalog');
            });
        }
    }
    
    /**
     * 🎯 Обработчики интерактивных элементов
     */
    attachInteractionListeners() {
        // Клики по элементам лидербоарда
        const leaderboardItems = document.querySelectorAll('.leaderboard-item');
        leaderboardItems.forEach(item => {
            item.addEventListener('click', () => {
                this.telegram.hapticFeedback('light');
                // Можно показать профиль пользователя
            });
        });
        
        // Клики по популярным элементам
        const popularItems = document.querySelectorAll('.popular-item');
        popularItems.forEach(item => {
            item.addEventListener('click', () => {
                this.telegram.hapticFeedback('light');
                // Можно перейти к деталям элемента
            });
        });
    }
    
    /**
     * 📑 Переключение таба
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        this.telegram.hapticFeedback('light');
        
        // Перерендер страницы
        this.rerender();
        
        // Загрузка данных для нового таба при необходимости
        if (tabName === 'top' || tabName === 'stats') {
            this.loadTabData(tabName);
        }
    }
    
    /**
     * 📊 Загрузка данных для конкретного таба
     */
    async loadTabData(tabName) {
        if (tabName === 'top') {
            // Обновить лидербоард
            const leaderboard = await this.loadLeaderboard();
            if (leaderboard) {
                this.communityData.leaderboard = leaderboard;
                this.state.set('community.leaderboard', leaderboard);
            }
        } else if (tabName === 'stats') {
            // Обновить статистику
            const stats = await this.loadCommunityStats();
            if (stats) {
                this.communityData.stats = { ...this.communityData.stats, ...stats };
                this.state.set('community.stats', this.communityData.stats);
            }
        }
    }
    
    /**
     * 🔄 Обновление UI данных сообщества
     */
    updateCommunityUI(data) {
        if (!data) return;
        
        // Обновляем локальные данные
        this.communityData = { ...this.communityData, ...data };
        
        // Перерендер активного таба
        this.rerenderTabContent();
    }
    
    /**
     * 👤 Обновление UI рейтинга пользователя
     */
    updateUserRankUI(profile) {
        if (!profile) return;
        
        // Обновляем элементы с рейтингом пользователя
        const userProgressElements = document.querySelectorAll('.user-progress-section, .user-rating-section');
        userProgressElements.forEach(element => {
            // Можно обновить отдельные элементы без полного перерендера
        });
    }
    
    /**
     * ⚠️ Показать ошибку
     */
    showError(message) {
        this.error = message;
        
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * 🔄 Перерендер страницы
     */
    rerender() {
        const container = document.querySelector('.community-page .content');
        if (container) {
            container.innerHTML = `
                ${this.renderTabs()}
                ${this.renderTabContent()}
            `;
            this.attachEventListeners();
        }
    }
    
    /**
     * 🔄 Перерендер только содержимого таба
     */
    rerenderTabContent() {
        const tabContent = document.querySelector('.tab-content');
        if (tabContent) {
            tabContent.outerHTML = this.renderTabContent();
            this.attachEventListeners();
        }
    }
    
    /**
     * 🔄 Обновление данных страницы
     */
    async refresh() {
        await this.loadInitialData();
    }
    
    /**
     * 📱 Lifecycle методы
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        // Обновляем данные если страница была неактивна долго
        const lastUpdate = this.state.get('community.lastUpdate');
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        
        if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
            this.refresh();
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        // Сохраняем текущее состояние
        this.state.set('community.lastUpdate', Date.now());
    }
    
    /**
     * 🧹 Очистка подписок при уничтожении
     */
    destroy() {
        // Отписка от всех подписок
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.communityData = null;
    }
}

// 📤 Экспорт класса
window.CommunityPage = CommunityPage;