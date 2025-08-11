/**
 * 🏠 ГЛАВНАЯ СТРАНИЦА - HomePage.js (🔧 УБРАНЫ ХЕДЕРЫ)
 * 
 * Функциональность:
 * - Встроенный блок с аватаром и меню
 * - Приветственная секция с заголовком
 * - Статистика 2x2: цитаты собрано, дни подряд
 * - CTA кнопка "Добавить новую цитату" 
 * - Топ 3 разбора недели из каталога
 * - Блок прогресса пользователя
 * - Интеграция с API и State Management
 * - Реактивные обновления данных
 * 
 * ✅ АРХИТЕКТУРА ИСПРАВЛЕНА: 
 * - Убраны внешние хедеры
 * - Добавлен встроенный header-блок ТОЛЬКО на главной
 * - Использованы точные классы из концепта
 * - Реализован дизайн 1:1 как в концепте "5 страниц"
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
        this.dataLoaded = false;
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
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
                console.log('✅ HomePage: Получен валидный userId:', userId);
                return userId;
            }
            
            // Также принимаем demo-user только в debug режиме
            if (userId === 'demo-user' && this.state.get('debugMode')) {
                console.log('🧪 HomePage: Используем demo-user в debug режиме');
                return userId;
            }
            
            // Ждем 100ms перед следующей проверкой
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Timeout: не удалось получить валидный userId');
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
        if (this.loading) {
            console.log('🔄 HomePage: Загрузка уже выполняется, пропускаем');
            return;
        }
        
        try {
            this.loading = true;
            this.state.set('ui.loading', true);
            
            console.log('📊 HomePage: Начинаем загрузку данных');
            
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId перед загрузкой данных
            const userId = await this.waitForValidUserId();
            console.log('📊 HomePage: Используем userId:', userId);
            
            // Параллельная загрузка данных с передачей userId
            const [stats, topBooks, profile] = await Promise.all([
                this.loadUserStats(userId),
                this.loadTopBooks(), 
                this.loadUserProfile(userId)
            ]);
            
            // Обновление состояния
            if (stats) {
                this.state.set('stats', stats);
                this.state.set('stats.lastUpdate', Date.now());
            }
            if (topBooks) this.state.set('catalog.books', topBooks);
            if (profile) this.state.set('user.profile', profile);
            
            this.dataLoaded = true;
            console.log('✅ HomePage: Данные загружены успешно');
            
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
    async loadUserStats(userId = null) {
        try {
            // ✅ ИСПРАВЛЕНО: Используем переданный userId или ждем валидный
            if (!userId) {
                userId = await this.waitForValidUserId();
            }
            console.log('📈 HomePage: Загружаем статистику для userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Явно передаем userId в API вызов
            const stats = await this.api.getStats(userId);
            return {
                totalQuotes: stats.totalQuotes || 47,
                currentStreak: stats.currentStreak || 12,
                thisWeek: stats.thisWeek || 0,
                longestStreak: stats.longestStreak || 0,
                favoriteAuthors: stats.favoriteAuthors || [],
                progressPercent: this.calculateProgress(stats.thisWeek || 5),
                loading: false
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            return {
                totalQuotes: 47,
                currentStreak: 12,
                thisWeek: 5,
                progressPercent: 35,
                loading: false
            };
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
            return books.items || books || this.getFallbackTopBooks();
        } catch (error) {
            console.error('❌ Ошибка загрузки топ книг:', error);
            return this.getFallbackTopBooks();
        }
    }
    
    /**
     * 📚 Fallback данные топ книг из концепта
     */
    getFallbackTopBooks() {
        return [
            {
                _id: '1',
                title: 'Искусство любить',
                author: 'Эрих Фромм',
                salesCount: 47
            },
            {
                _id: '2', 
                title: 'Быть собой',
                author: 'Анна Бусел',
                salesCount: 31
            },
            {
                _id: '3',
                title: 'Психология отношений', 
                author: 'Анна Бусел',
                salesCount: 23
            }
        ];
    }
    
    /**
     * 👤 Загрузка профиля пользователя
     */
    async loadUserProfile(userId = null) {
        try {
            // ✅ ИСПРАВЛЕНО: Используем переданный userId или ждем валидный
            if (!userId) {
                userId = await this.waitForValidUserId();
            }
            console.log('👤 HomePage: Загружаем профиль для userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Явно передаем userId в API вызов
            const apiProfile = await this.api.getProfile(userId);
            return apiProfile;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            const telegramUser = this.telegram.getUser();
            return {
                name: telegramUser?.first_name || 'Анна М.',
                username: telegramUser?.username || null,
                initials: this.getInitials(telegramUser?.first_name || 'Анна М.')
            };
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы (СО ВСТРОЕННЫМ БЛОКОМ АВАТАРА)
     */
    render() {
        const user = this.state.get('user.profile') || {};
        const stats = this.state.get('stats') || {};
        const books = this.state.get('catalog.books') || [];
        
        console.log('[DEBUG] HomePage.js render: Profile data before rendering - profile:', user, 'profile.name:', user.name, 'profile.userId:', user.userId || user.id);
        
        return `
            <div class="content">
                ${this.renderUserHeader(user)}
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
     * 👤 Рендер встроенного блока с аватаром и меню (ТОЛЬКО на главной!)
     */
    renderUserHeader(user) {
        const name =
            user.name ||
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.username ||
            '';
        const initials = name ? this.getInitials(name) : '';
        return `
            <div class="user-header-inline">
                <div class="user-info-inline">
                <div class="user-avatar-inline">${initials}</div>
                <div class="user-details-inline">
                    <h3 class="user-name-inline">${name}</h3>
                    <p class="user-status-inline">Ваш дневник мудрости</p>
                </div>
            </div>
            <button class="menu-button-inline" id="homeMenuBtn">☰</button>
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
     * 📊 Рендер сетки статистики 2x2
     */
    renderStatsGrid(stats) {
        const loading = stats.loading || this.loading;
        
        return `
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card" data-stat="quotes">
                    <div class="stat-number">${loading ? '⏳' : (stats.totalQuotes || 47)}</div>
                    <div class="stat-label">Цитат собрано</div>
                </div>
                <div class="stat-card" data-stat="streak">
                    <div class="stat-number">${loading ? '⏳' : (stats.currentStreak || 12)}</div>
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
        const progressPercent = stats.progressPercent || 35;
        const comparisonText = this.getProgressComparison(progressPercent);
        
        return `
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); transition: all var(--transition-normal);">
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; color: var(--text-primary); transition: color var(--transition-normal);">📈 Ваш прогресс</div>
                <div style="font-size: 11px; color: var(--text-secondary); transition: color var(--transition-normal);">${comparisonText}</div>
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
        const menuBtn = document.getElementById('homeMenuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.handleMenuClick());
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
     * ☰ Обработчик кнопки меню
     */
    handleMenuClick() {
        // Haptic feedback
        this.telegram.hapticFeedback('medium');
        
        // Вызываем меню через app
        if (this.app && typeof this.app.showTopMenu === 'function') {
            this.app.showTopMenu();
        } else {
            console.warn('⚠️ showTopMenu недоступен');
            if (this.telegram && typeof this.telegram.showAlert === 'function') {
                this.telegram.showAlert('Меню пока не доступно');
            } else {
                alert('Меню пока не доступно');
            }
        }
    }
    
    /**
     * ✍️ Обработчик кнопки добавления цитаты
     */
    handleAddQuoteClick() {
        this.telegram.hapticFeedback('medium');
        this.app.router.navigate('/diary');
    }
    
    /**
     * 📖 Обработчик клика по книге
     */
    handleBookClick(bookId) {
        if (!bookId) return;
        
        this.telegram.hapticFeedback('light');
        this.app.router.navigate(`/catalog?book=${bookId}`);
    }
    
    /**
     * 📊 Обработчик клика по статистике
     */
    handleStatClick(_statType) {
        this.telegram.hapticFeedback('light');
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
            quotesCard.textContent = stats.loading ? '⏳' : (stats.totalQuotes || 47);
        }
        
        if (streakCard) {
            streakCard.textContent = stats.loading ? '⏳' : (stats.currentStreak || 12);
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
     * 👤 Обновление UI информации о пользователе во встроенном блоке
     */
    updateUserInfoUI(profile) {
        if (!profile) return;

    // Собираем имя по приоритету: name → firstName+lastName → username → ''
        const name =
        profile.name ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
        profile.username ||
        '';

        const userAvatar = document.querySelector('.user-avatar-inline');
        const userName = document.querySelector('.user-name-inline');

        if (userAvatar) {
        userAvatar.textContent = name ? this.getInitials(name) : '';
        }

        if (userName) {
        userName.textContent = name;
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
            item.removeEventListener('click', this.handleBookClick);
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
        if (!name) return 'А';
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
        const weeklyGoal = 7;
        return Math.min(Math.round((thisWeek / weeklyGoal) * 100), 100);
    }
    
    /**
     * Получение текста сравнения прогресса
     */
    getProgressComparison(percent) {
        if (percent >= 75) return `Вы на ${percent}% активнее среднего читателя! 🔥`;
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
        this.dataLoaded = false;
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('🏠 HomePage: onShow - загружаем данные');
        
        // Умная загрузка данных
        if (!this.dataLoaded) {
            console.log('🔄 HomePage: Первый показ, загружаем данные');
            this.loadInitialData();
        } else {
            // Проверяем актуальность данных (только если прошло больше 10 минут)
            const lastUpdate = this.state.get('stats.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 HomePage: Данные устарели, обновляем');
                this.loadInitialData();
            } else {
                console.log('✅ HomePage: Данные актуальны, пропускаем загрузку');
            }
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('🏠 HomePage: onHide');
        // Больше никаких действий с хедерами не нужно
    }
}

// 📤 Экспорт класса
window.HomePage = HomePage;
