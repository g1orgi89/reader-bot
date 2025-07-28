/**
 * 🏠 ГЛАВНАЯ СТРАНИЦА - HomePage.js
 * 
 * Функциональность:
 * - Шапка с профилем пользователя и кнопкой меню
 * - Статистика: цитаты собрано, дни подряд
 * - CTA кнопка "Добавить цитату" 
 * - Топ 3 разбора недели из каталога
 * - Блок прогресса пользователя
 * - Интеграция с API и State Management
 * - Реактивные обновления данных
 */

class HomePage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        
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
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        // Подписка на изменения каталога книг  
        const catalogSubscription = this.state.subscribe('catalog.books', (books) => {
            this.updateTopBooksUI(books);
        });
        
        // Подписка на изменения профиля пользователя
        const userSubscription = this.state.subscribe('user.profile', (profile) => {
            this.updateUserInfoUI(profile);
        });
        
        // Подписка на изменения состояния загрузки
        const loadingSubscription = this.state.subscribe('ui.loading', (loading) => {
            this.updateLoadingState(loading);
        });
        
        this.subscriptions.push(
            statsSubscription,
            catalogSubscription, 
            userSubscription,
            loadingSubscription
        );
    }
    
    /**
     * 📊 Загрузка начальных данных
     */
    async loadInitialData() {
        try {
            this.loading = true;
            this.state.set('ui.loading', true);
            
            // Параллельная загрузка данных
            const [stats, topBooks, profile] = await Promise.all([
                this.loadUserStats(),
                this.loadTopBooks(), 
                this.loadUserProfile()
            ]);
            
            // Обновление состояния
            if (stats) this.state.set('stats', stats);
            if (topBooks) this.state.set('catalog.books', topBooks);
            if (profile) this.state.set('user.profile', profile);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных главной страницы:', error);
            this.error = error.message;
            this.showError('Не удалось загрузить данные. Попробуйте обновить.');
        } finally {
            this.loading = false;
            this.state.set('ui.loading', false);
        }
    }
    
    /**
     * 📈 Загрузка статистики пользователя
     */
    async loadUserStats() {
        try {
            const stats = await this.api.getStats();
            return {
                totalQuotes: stats.totalQuotes || 0,
                thisWeek: stats.thisWeek || 0,
                currentStreak: stats.currentStreak || 0,
                longestStreak: stats.longestStreak || 0,
                favoriteAuthors: stats.favoriteAuthors || [],
                progressPercent: this.calculateProgress(stats.thisWeek),
                loading: false
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            return null;
        }
    }
    
    /**
     * 📚 Загрузка топ книг из каталога
     */
    async loadTopBooks() {
        try {
            const books = await this.api.getCatalog({ 
                limit: 3, 
                sort: 'popular',
                featured: true 
            });
            return books.items || books || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки топ книг:', error);
            return [];
        }
    }
    
    /**
     * 👤 Загрузка профиля пользователя
     */
    async loadUserProfile() {
        try {
            const profile = await this.api.getProfile();
            return profile;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            // Возвращаем данные из Telegram как fallback
            const telegramUser = this.telegram.getUser();
            return {
                name: telegramUser?.first_name || 'Пользователь',
                username: telegramUser?.username || null,
                initials: this.getInitials(telegramUser?.first_name)
            };
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        const user = this.state.get('user.profile') || {};
        const stats = this.state.get('stats') || {};
        const books = this.state.get('catalog.books') || [];
        
        return `
            <div class="home-page">
                ${this.renderHeader(user)}
                ${this.renderContent(stats, books)}
            </div>
        `;
    }
    
    /**
     * 📱 Рендер шапки страницы
     */
    renderHeader(user) {
        const initials = user.initials || this.getInitials(user.name);
        const displayName = user.name || 'Пользователь';
        
        return `
            <div class="home-header">
                <div class="user-info">
                    <div class="user-avatar">${initials}</div>
                    <div class="user-details">
                        <h3>${displayName}</h3>
                        <p>Читатель</p>
                    </div>
                </div>
                <button class="menu-button" id="menuButton">⋯</button>
            </div>
        `;
    }
    
    /**
     * 📄 Рендер основного контента
     */
    renderContent(stats, books) {
        return `
            <div class="content">
                ${this.renderWelcomeSection()}
                ${this.renderStatsGrid(stats)}
                ${this.renderMainCTA()}
                ${this.renderTopBooks(books)}
                ${this.renderProgressSection(stats)}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 👋 Рендер приветственной секции
     */
    renderWelcomeSection() {
        return `
            <div class="page-title">
                <h2>Добро пожаловать! 👋</h2>
                <p>Ваш персональный дневник мудрости</p>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер сетки статистики
     */
    renderStatsGrid(stats) {
        const loading = stats.loading || this.loading;
        
        return `
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card" data-stat="quotes">
                    <div class="stat-number">${loading ? '⏳' : (stats.totalQuotes || 0)}</div>
                    <div class="stat-label">Цитат собрано</div>
                </div>
                <div class="stat-card" data-stat="streak">
                    <div class="stat-number">${loading ? '⏳' : (stats.currentStreak || 0)}</div>
                    <div class="stat-label">Дней подряд</div>
                </div>
            </div>
        `;
    }
    
    /**
     * ✍️ Рендер главной CTA кнопки
     */
    renderMainCTA() {
        return `
            <button class="main-cta" id="addQuoteBtn">
                ✍️ Добавить новую цитату
            </button>
        `;
    }
    
    /**
     * 🔥 Рендер топ книг недели
     */
    renderTopBooks(books) {
        const topBooks = books.slice(0, 3);
        
        return `
            <div class="top-books-section">
                <div class="section-title">🔥 Топ 3 разбора недели</div>
                <div id="top-books-list">
                    ${topBooks.length > 0 ? 
                        topBooks.map((book, index) => this.renderBookItem(book, index + 1)).join('') :
                        this.renderEmptyBooks()
                    }
                </div>
            </div>
        `;
    }
    
    /**
     * 📖 Рендер элемента книги
     */
    renderBookItem(book, rank) {
        return `
            <div class="book-item" data-book-id="${book._id || book.id}">
                <div class="book-rank">${rank}</div>
                <div class="book-info">
                    <div class="book-title">${book.title || 'Название книги'}</div>
                    <div class="book-author">${book.author || 'Автор'}</div>
                </div>
                <div class="book-sales">${book.salesCount || 0} покупок</div>
            </div>
        `;
    }
    
    /**
     * 📚 Рендер пустого состояния книг
     */
    renderEmptyBooks() {
        return `
            <div class="empty-books">
                <p>📚 Загружаем топ разборы...</p>
            </div>
        `;
    }
    
    /**
     * 📈 Рендер секции прогресса
     */
    renderProgressSection(stats) {
        const progressPercent = stats.progressPercent || 0;
        const comparisonText = this.getProgressComparison(progressPercent);
        
        return `
            <div class="progress-section">
                <div class="progress-title">📈 Ваш прогресс</div>
                <div class="progress-text">${comparisonText}</div>
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер ошибки
     */
    renderError() {
        if (!this.error) return '';
        
        return `
            <div class="error-message" id="errorMessage">
                <span>⚠️ ${this.error}</span>
                <button onclick="this.parentElement.style.display='none'">✕</button>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Кнопка меню
        const menuButton = document.getElementById('menuButton');
        if (menuButton) {
            menuButton.addEventListener('click', () => this.handleMenuClick());
        }
        
        // Кнопка добавления цитаты
        const addQuoteBtn = document.getElementById('addQuoteBtn');
        if (addQuoteBtn) {
            addQuoteBtn.addEventListener('click', () => this.handleAddQuoteClick());
        }
        
        // Клики по книгам
        const bookItems = document.querySelectorAll('.book-item');
        bookItems.forEach(item => {
            item.addEventListener('click', () => {
                const bookId = item.dataset.bookId;
                this.handleBookClick(bookId);
            });
        });
        
        // Клики по статистике
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.dataset.stat;
                this.handleStatClick(statType);
            });
        });
    }
    
    /**
     * 🎯 Обработчик клика по меню
     */
    handleMenuClick() {
        // Haptic feedback
        this.telegram.hapticFeedback('light');
        
        // Показать меню (будет реализовано в компонентах)
        this.app.showTopMenu();
    }
    
    /**
     * ✍️ Обработчик кнопки добавления цитаты
     */
    handleAddQuoteClick() {
        // Haptic feedback
        this.telegram.hapticFeedback('medium');
        
        // Переход на страницу дневника
        this.app.router.navigate('/diary');
    }
    
    /**
     * 📖 Обработчик клика по книге
     */
    handleBookClick(bookId) {
        if (!bookId) return;
        
        // Haptic feedback
        this.telegram.hapticFeedback('light');
        
        // Переход в каталог с выбранной книгой
        this.app.router.navigate(`/catalog?book=${bookId}`);
    }
    
    /**
     * 📊 Обработчик клика по статистике
     */
    handleStatClick(statType) {
        // Haptic feedback
        this.telegram.hapticFeedback('light');
        
        // Переход на страницу отчетов
        this.app.router.navigate('/reports');
    }
    
    /**
     * 🔄 Обновление UI статистики
     */
    updateStatsUI(stats) {
        if (!stats) return;
        
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        const quotesCard = statsGrid.querySelector('[data-stat="quotes"] .stat-number');
        const streakCard = statsGrid.querySelector('[data-stat="streak"] .stat-number');
        
        if (quotesCard) {
            quotesCard.textContent = stats.loading ? '⏳' : (stats.totalQuotes || 0);
        }
        
        if (streakCard) {
            streakCard.textContent = stats.loading ? '⏳' : (stats.currentStreak || 0);
        }
    }
    
    /**
     * 📚 Обновление UI топ книг
     */
    updateTopBooksUI(books) {
        const topBooksList = document.getElementById('top-books-list');
        if (!topBooksList || !books) return;
        
        const topBooks = books.slice(0, 3);
        topBooksList.innerHTML = topBooks.length > 0 ? 
            topBooks.map((book, index) => this.renderBookItem(book, index + 1)).join('') :
            this.renderEmptyBooks();
        
        // Перенавешивание обработчиков для новых элементов
        this.attachBookEventListeners();
    }
    
    /**
     * 👤 Обновление UI информации о пользователе
     */
    updateUserInfoUI(profile) {
        if (!profile) return;
        
        const userAvatar = document.querySelector('.user-avatar');
        const userNameEl = document.querySelector('.user-details h3');
        
        if (userAvatar) {
            userAvatar.textContent = profile.initials || this.getInitials(profile.name);
        }
        
        if (userNameEl) {
            userNameEl.textContent = profile.name || 'Пользователь';
        }
    }
    
    /**
     * ⏳ Обновление состояния загрузки
     */
    updateLoadingState(loading) {
        // Можно добавить спиннер или skeleton loading
        if (loading) {
            document.body.classList.add('loading');
        } else {
            document.body.classList.remove('loading');
        }
    }
    
    /**
     * 🔄 Перенавешивание обработчиков для книг
     */
    attachBookEventListeners() {
        const bookItems = document.querySelectorAll('.book-item');
        bookItems.forEach(item => {
            item.removeEventListener('click', this.handleBookClick); // Удаляем старые
            item.addEventListener('click', () => {
                const bookId = item.dataset.bookId;
                this.handleBookClick(bookId);
            });
        });
    }
    
    /**
     * ⚠️ Показать ошибку
     */
    showError(message) {
        this.error = message;
        
        // Можно показать toast уведомление
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * 🧮 Вспомогательные методы
     */
    
    /**
     * Получение инициалов из имени
     */
    getInitials(name) {
        if (!name) return '👤';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
    
    /**
     * Расчет прогресса (% от недельной цели)
     */
    calculateProgress(thisWeek) {
        const weeklyGoal = 7; // 1 цитата в день
        return Math.min(Math.round((thisWeek / weeklyGoal) * 100), 100);
    }
    
    /**
     * Получение текста сравнения прогресса
     */
    getProgressComparison(percent) {
        if (percent >= 100) return 'Превосходно! Вы выполнили недельную цель! 🔥';
        if (percent >= 75) return `Отлично! Вы на ${percent}% активнее среднего читателя! 💪`;
        if (percent >= 50) return `Хорошо! Вы на ${percent}% пути к цели! 📈`;
        if (percent >= 25) return `Неплохое начало! Вы на ${percent}% к цели! 🌱`;
        return 'Время начать собирать мудрость! 📚';
    }
    
    /**
     * 🔄 Обновление данных страницы
     */
    async refresh() {
        await this.loadInitialData();
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
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        // Обновляем данные если страница была неактивна долго
        const lastUpdate = this.state.get('stats.lastUpdate');
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (!lastUpdate || (now - lastUpdate) > fiveMinutes) {
            this.refresh();
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        // Можно сохранить текущее состояние
    }
}

// 📤 Экспорт класса
window.HomePage = HomePage;