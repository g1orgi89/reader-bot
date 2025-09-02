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
        this.statistics = app.statistics || window.statisticsService || null;
        
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
        this.setupStatsEventListener();
    }

    /**
     * 📊 Настройка слушателя события обновления статистики
     */
    setupStatsEventListener() {
        // Add listener for stats:updated event from StatisticsService
        document.addEventListener('stats:updated', (e) => {
            if (e.detail) {
                this.updateStatsUI(e.detail);
            }
        });
    }

    /**
     * 🔄 Ожидание валидного userId для предотвращения гонки условий
     * @param {number} timeout - Максимальное время ожидания в миллисекундах
     * @returns {Promise<string>} - Валидный userId
     */
    async waitForValidUserId(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            let userId = this.state.getCurrentUserId();
            
            // ✅ FIX: Accept numeric string userId and coerce to number
            if (typeof userId === 'string' && /^\d+$/.test(userId)) {
                userId = parseInt(userId, 10);
            }
            
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
        
        // Подписка на изменения последних цитат
        const recentQuotesSubscription = this.state.subscribe('quotes.recent', () => {
            this.updateRecentQuotesUI();
        });
        
        // Подписка на изменения всех цитат (для обновления последних)
        const quotesSubscription = this.state.subscribe('quotes.items', (quotes) => {
            // Если новая цитата добавлена, обновляем последние цитаты
            if (quotes && quotes.length > 0) {
                const lastAddedQuote = this.state.get('quotes.lastAdded');
                if (lastAddedQuote) {
                    this.loadRecentQuotes();
                }
            }
        });
        
        this.subscriptions.push(
            statsSubscription,
            catalogSubscription, 
            userSubscription,
            loadingSubscription,
            recentQuotesSubscription,
            quotesSubscription
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
                this.loadUserProfile(userId),
                this.loadRecentQuotes(userId)
            ]);
            
            // Обновление состояния
            if (stats) {
                this.state.set('stats', stats);
                this.state.set('stats.lastUpdate', Date.now());
            }
            if (topBooks) this.state.set('catalog.books', topBooks);
            
            // ✅ FIX: Merge profile data instead of overwriting to avoid clobbering existing valid data
            if (profile) {
                const prev = this.state.get('user.profile') || {};
                const pick = (oldVal, newVal) => (newVal !== undefined && newVal !== null && String(newVal).trim() !== '' ? newVal : oldVal);
                
                // Compute name from new profile, but only use it if it's explicitly provided or computed from non-empty firstName/lastName
                let computedName = '';
                if (profile.name) {
                    computedName = profile.name;
                } else if (profile.firstName || profile.lastName) {
                    computedName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
                } else if (profile.username && !prev.name) {
                    // Only use username as fallback if there's no existing name
                    computedName = profile.username;
                }
                
                const merged = {
                    ...prev,
                    ...profile,
                    id: profile.id || prev.id || userId,
                    name: pick(prev?.name, computedName),
                    firstName: pick(prev?.firstName, profile.firstName),
                    lastName: pick(prev?.lastName, profile.lastName),
                    username: pick(prev?.username, profile.username)
                };
                
                if (merged.name) {
                    merged.initials = this.getInitials(merged.name);
                }
                
                this.state.set('user.profile', merged);
            }
            
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
    
    async loadFromStatistics() {
        if (!this.statistics) return this.loadInitialData();
        if (this.loading) return;
        try {
            this.loading = true;
            this.state.set('ui.loading', true);
            await this.waitForValidUserId(); // Ensure userId is ready
            const [mainStats, latestQuotes, topAnalyses, progress] = await Promise.all([
                this.statistics.getMainStats(),
                this.statistics.getLatestQuotes(3),
                this.statistics.getTopAnalyses(3),
                this.statistics.getUserProgress()
            ]);
            if (progress && progress.currentStreak > mainStats.currentStreak) {
                mainStats.currentStreak = progress.currentStreak;
            }
            this.state.update('stats', {
                totalQuotes: mainStats.totalQuotes,
                currentStreak: mainStats.currentStreak,
                daysInApp: mainStats.daysInApp,
                loading: false,
                loadedAt: Date.now()
            });
            this.state.setRecentQuotes(latestQuotes);
            const mapped = topAnalyses.map(a => ({ _id: a.id, title: a.title, author: a.author, salesCount: a.clicks }));
            this.state.set('catalog.books', mapped);
            this.state.set('stats.progressTemp', progress);
            this.dataLoaded = true;
            this.updateHeaderStats();
            this.updateProgressUI();
        } catch (e) {
            console.error('HomePage statistics load error', e);
            this.error = 'Не удалось загрузить данные';
        } finally {
            this.loading = false;
            this.state.set('ui.loading', false);
        }
    }

    updateProgressUI() {
        const wrap = document.querySelector('.progress-block');
        if (!wrap) return;
        const p = this.state.get('stats.progressTemp');
        if (!p) return;
        const grid = wrap.querySelector('.progress-grid');
        const activityNode = wrap.querySelector('.progress-activity');
        if (grid) {
            grid.innerHTML = [
                { label: 'За 7 дней', value: p.weeklyQuotes ?? '—' },
                { label: 'Серия (дней подряд)', value: p.currentStreak ?? '—' },
                { label: 'Любимый автор', value: p.favoriteAuthor || '—' }
            ].map(item => `
                <div class="stat-card" style="min-height:74px;display:flex;flex-direction:column;justify-content:space-between;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${item.label}</div>
                    <div style="font-size:20px;font-weight:600;">${item.value}</div>
                </div>
            `).join('');
        }
        if (activityNode) {
            activityNode.textContent = 'Активность: ' + (p.activityLevel === 'high' ? 'Высокая 🔥' : p.activityLevel === 'medium' ? 'Средняя 📈' : 'Низкая 🌱');
        }
        console.debug('[Progress] backendStreak:', p.backendStreak, 'computedStreak:', p.computedStreak, 'used:', p.currentStreak);
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
                totalQuotes: stats.totalQuotes != null ? stats.totalQuotes : null,
                currentStreak: stats.currentStreak != null ? stats.currentStreak : null,
                thisWeek: stats.thisWeek || 0,
                longestStreak: stats.longestStreak || 0,
                favoriteAuthors: stats.favoriteAuthors || [],
                progressPercent: this.calculateProgress(stats.thisWeek || 5),
                loading: false
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            return {
                totalQuotes: null,
                currentStreak: null,
                thisWeek: 5,
                progressPercent: 35,
                loading: false
            };
        }
    }
    
    /**
     * 🕐 Загрузка последних цитат
     */
    async loadRecentQuotes(userId = null) {
        try {
            // ✅ ИСПРАВЛЕНО: Используем переданный userId или ждем валидный
            if (!userId) {
                userId = await this.waitForValidUserId();
            }
            console.log('🕐 HomePage: Загружаем последние цитаты для userId:', userId);
            
            this.state.set('quotes.recentLoading', true);
            
            // Пытаемся загрузить через API
            const result = await this.api.getRecentQuotes(3, userId);
            const quotes = result.data?.quotes || result.quotes || result.items || result.data || result;
            
            // Ensure we only treat arrays as quotes
            if (!Array.isArray(quotes)) {
                throw new Error('API response does not contain valid quotes array');
            }
            
            this.state.setRecentQuotes(quotes);
            this.state.set('quotes.recentLoading', false);
            
            return quotes;
        } catch (error) {
            console.error('❌ Ошибка загрузки последних цитат:', error);
            
            // Fallback: берем из state.get('quotes.items') и сортируем по дате
            const allQuotes = this.state.get('quotes.items') || [];
            const sortedQuotes = allQuotes
                .filter(quote => quote.createdAt || quote.dateAdded)
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.dateAdded);
                    const dateB = new Date(b.createdAt || b.dateAdded);
                    return dateB - dateA; // По убыванию (новые сначала)
                })
                .slice(0, 3);
            
            this.state.setRecentQuotes(sortedQuotes);
            this.state.set('quotes.recentLoading', false);
            
            return sortedQuotes;
        }
    }
    
    /**
     * 🔄 Обновление UI последних цитат без перестройки страницы
     */
    updateRecentQuotesUI() {
        const recentQuotesList = document.getElementById('recent-quotes-list');
        if (!recentQuotesList) return;
        
        const recentQuotes = this.state.get('quotes.recent') || [];
        const isLoading = this.state.get('quotes.recentLoading') || false;
        
        recentQuotesList.innerHTML = isLoading ? 
            this.renderRecentQuotesLoading() : 
            this.renderRecentQuotesList(recentQuotes);
            
        // Перенавешиваем обработчики
        this.attachRecentQuoteEvents();
    }
    
    /**
     * 📱 Навешивание обработчиков для последних цитат
     */
    attachRecentQuoteEvents() {
        const quoteItems = document.querySelectorAll('.recent-quote-item');
        quoteItems.forEach(item => {
            if (!item.classList.contains('skeleton')) {
                item.addEventListener('click', () => {
                    const quoteId = item.dataset.quoteId;
                    this.handleRecentQuoteClick(quoteId);
                });
            }
        });
    }
    
    /**
     * 📝 Обработчик клика по последней цитате
     */
    handleRecentQuoteClick(quoteId) {
        if (!quoteId) return;
        
        this.telegram.hapticFeedback('light');
        // Переходим на страницу дневника с фокусом на цитате
        this.app.router.navigate(`/diary?quote=${quoteId}`);
    }
    
    /**
     * 🔄 Инициализация последних цитат (вызывается после первого mount)
     */
    async initRecentQuotes() {
        try {
            await this.loadRecentQuotes();
            this.updateRecentQuotesUI();
        } catch (error) {
            console.error('❌ Ошибка инициализации последних цитат:', error);
        }
    }
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
            
            // ✅ FIX: Unpack API response to return flat profile object, not wrapper
            const profile = apiProfile?.user || apiProfile?.result?.user || apiProfile || {};
            if (!profile.id) profile.id = userId;
            return profile;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            const telegramUser = this.telegram.getUser();
            return {
                id: userId,
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
                <!-- ${this.renderWelcomeSection()}  УДАЛЕНО -->
                ${this.renderStatsInline(stats)}
                ${this.renderMainCTA()}
                ${this.renderRecentQuotesSection()}
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
                    ${this.renderUserAvatar(user.avatarUrl, initials)}
                    <div class="user-details-inline">
                        <h3 class="user-name-inline">${name}</h3>
                    </div>
                </div>
                <button class="menu-button-inline" id="homeMenuBtn">☰</button>
            </div>
        `;
    }

    /**
     * 🖼️ Рендер аватара с поддержкой изображений
     */
    renderUserAvatar(avatarUrl, initials) {
        const telegramPhotoUrl = this.telegram.getUser()?.photo_url;
        
        // Определяем источник изображения по приоритету
        const imageUrl = avatarUrl || telegramPhotoUrl;
        
        if (imageUrl) {
            return `
                <div class="user-avatar-inline">
                    <img class="user-avatar-img" src="${imageUrl}" alt="Аватар" 
                         onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                    <div class="user-avatar-fallback">${initials || 'А'}</div>
                </div>
            `;
        } else {
            return `
                <div class="user-avatar-inline fallback">
                    <div class="user-avatar-fallback">${initials || 'А'}</div>
                </div>
            `;
        }
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
     * 📊 Рендер инлайн статистики (заменяет сетку)
     */
    renderStatsInline(stats) {
        const loading = stats.loading || this.loading;
        const totalQuotes = loading ? '⏳' : (stats.totalQuotes != null ? stats.totalQuotes : '—');
        const currentStreak = loading ? '⏳' : (stats.currentStreak != null ? stats.currentStreak : '—');
        
        if (loading) {
            return `
                <div class="stats-inline" id="statsInline">
                    <span class="stat-summary">⏳ Загружаем статистику...</span>
                </div>
            `;
        }
        
        const quotesWord = totalQuotes !== '—' ? this.getQuoteWord(totalQuotes) : '';
        const daysWord = currentStreak !== '—' ? this.getDayWord(currentStreak) : '';
        
        return `
            <div class="stats-inline" id="statsInline">
                <span class="stat-summary">${totalQuotes} ${quotesWord}${totalQuotes !== '—' && currentStreak !== '—' ? ' • ' : ''}${currentStreak !== '—' ? currentStreak + ' ' + daysWord + ' подряд' : ''}</span>
            </div>
        `;
    }
    
    /**
     * 🕐 Рендер секции "Ваши последние цитаты"
     */
    renderRecentQuotesSection() {
        const recentQuotes = this.state.get('quotes.recent') || [];
        const isLoading = this.state.get('quotes.recentLoading') || false;
        
        return `
            <div class="recent-quotes-section" id="recentQuotesSection">
                <div class="section-title">💫 Ваши последние цитаты</div>
                <div id="recent-quotes-list">
                    ${isLoading ? this.renderRecentQuotesLoading() : this.renderRecentQuotesList(recentQuotes)}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔄 Рендер списка последних цитат
     */
    renderRecentQuotesList(quotes) {
        if (!Array.isArray(quotes) || quotes.length === 0) {
            return this.renderEmptyRecentQuotes();
        }
        
        const recentQuotes = quotes.slice(0, 3);
        return recentQuotes.map(quote => this.renderRecentQuoteItem(quote)).join('');
    }
    
    /**
     * 📝 Рендер элемента последней цитаты
     */
    renderRecentQuoteItem(quote) {
        const text = quote.text || '';
        const author = quote.author || '';
        const truncatedText = text.length > 120 ? text.substring(0, 120) + '...' : text;
        
        return `
            <div class="recent-quote-item" data-quote-id="${quote._id || quote.id}">
                <div class="quote-text">"${truncatedText}"</div>
                ${author ? `<div class="quote-author">— ${author}</div>` : ''}
            </div>
        `;
    }
    
    /**
     * ⏳ Рендер загрузки последних цитат (скелетон)
     */
    renderRecentQuotesLoading() {
        return `
            <div class="recent-quote-item skeleton">
                <div class="quote-text skeleton-line"></div>
                <div class="quote-author skeleton-line-short"></div>
            </div>
            <div class="recent-quote-item skeleton">
                <div class="quote-text skeleton-line"></div>
                <div class="quote-author skeleton-line-short"></div>
            </div>
            <div class="recent-quote-item skeleton">
                <div class="quote-text skeleton-line"></div>
                <div class="quote-author skeleton-line-short"></div>
            </div>
        `;
    }
    
    /**
     * 📭 Рендер пустого состояния последних цитат
     */
    renderEmptyRecentQuotes() {
        return `
            <div class="empty-recent-quotes">
                <p>✍️ Добавьте первую цитату, чтобы она появилась здесь</p>
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
        if (!Array.isArray(books)) books = [];
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
    renderProgressSection(_stats) {
        return `
        <div class="progress-block" style="margin:16px 0;">
          <div style="font-weight:600;font-size:13px;margin:0 0 10px;color:var(--text-primary);">📈 Ваш прогресс</div>
          <div class="progress-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${[1,2,3].map(()=>`<div class="stat-card" style="min-height:74px;opacity:.45;display:flex;flex-direction:column;justify-content:space-between;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;">…</div><div style="font-size:20px;font-weight:600;">—</div></div>`).join('')}
          </div>
          <div class="progress-activity" style="margin-top:10px;font-size:11px;color:var(--text-secondary);">Загрузка…</div>
        </div>`;
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
        
        // Клик по инлайн статистике
        const statsInline = document.getElementById('statsInline');
        if (statsInline) {
            statsInline.addEventListener('click', () => this.handleStatClick('inline'));
        }
        
        // Клики по старой статистике (обратная совместимость)
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.dataset.stat;
                this.handleStatClick(statType);
            });
        });
        
        // Обработчики для последних цитат
        this.attachRecentQuoteEvents();
    }
    
    /**
     * ☰ Обработчик кнопки меню
     */
    handleMenuClick() {
        // Haptic feedback
        this.telegram.hapticFeedback('medium');
        
        // We're on HomePage, so TopMenu should be available
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
     * 📊 Обновление заголовочной статистики (предотвращение мерцания)
     */
    updateHeaderStats() {
        const statsInline = document.getElementById('statsInline');
        if (!statsInline) return;
        const stats = this.state.get('stats') || {};
        if (!stats.loadedAt) {
            statsInline.innerHTML = '';
            return;
        }
        const totalQuotes = stats.totalQuotes ?? 0;
        const daysInApp = stats.daysInApp ?? 0;
        const quotesWord = this.getQuoteWord(totalQuotes);
        const daysWord = this.getDayWord(daysInApp);
        statsInline.innerHTML = `
            <span class="stat-summary">${totalQuotes} ${quotesWord} • ${daysInApp} ${daysWord} в приложении</span>
        `;
    }

    /**
     * 🔄 Обновление UI статистики
     */
    updateStatsUI(stats) {
        if (!stats) return;
        
        // Поддержка нового инлайн формата
        const statsInline = document.getElementById('statsInline');
        if (statsInline) {
            const loading = stats.loading || this.loading;
            const totalQuotes = loading ? '⏳' : (stats.totalQuotes != null ? stats.totalQuotes : '—');
            const currentStreak = loading ? '⏳' : (stats.currentStreak != null ? stats.currentStreak : '—');
            
            if (loading) {
                statsInline.innerHTML = '<span class="stat-summary">⏳ Загружаем статистику...</span>';
            } else {
                const quotesWord = totalQuotes !== '—' ? this.getQuoteWord(totalQuotes) : '';
                const daysWord = currentStreak !== '—' ? this.getDayWord(currentStreak) : '';
                const separator = totalQuotes !== '—' && currentStreak !== '—' ? ' • ' : '';
                const streakPart = currentStreak !== '—' ? currentStreak + ' ' + daysWord + ' подряд' : '';
                statsInline.innerHTML = `<span class="stat-summary">${totalQuotes} ${quotesWord}${separator}${streakPart}</span>`;
            }
            return;
        }
        
        // Поддержка старого формата сетки (обратная совместимость)
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        const quotesCard = statsGrid.querySelector('[data-stat="quotes"] .stat-number');
        const streakCard = statsGrid.querySelector('[data-stat="streak"] .stat-number');
        
        if (quotesCard) {
            quotesCard.textContent = stats.loading ? '⏳' : (stats.totalQuotes != null ? stats.totalQuotes : '—');
        }
        
        if (streakCard) {
            streakCard.textContent = stats.loading ? '⏳' : (stats.currentStreak != null ? stats.currentStreak : '—');
        }
    }
    
    /**
     * 📚 Обновление UI топ книг
     */
    updateTopBooksUI(books) {
        const topBooksList = document.getElementById('top-books-list');
        if (!topBooksList || !books) return;
        if (!Array.isArray(books)) books = [];
        const topBooks = books.slice(0, 3);
        topBooksList.innerHTML = topBooks.length > 0 ? 
            topBooks.map((book, index) => this.renderBookItem(book, index + 1)).join('') :
            this.renderEmptyBooks();
        this.attachBookEventListeners();
    }   
    
    /**
     * 👤 Обновление UI информации о пользователе во встроенном блоке
     */
    updateUserInfoUI(profile) {
        if (!profile) return;

        // Собираем имя по приоритету: name → firstName+lastName → username → ''
        const computed = profile.name ||
            [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
            profile.username ||
            '';

        const userAvatarContainer = document.querySelector('.user-avatar-inline');
        const userName = document.querySelector('.user-name-inline');

        // ✅ FIX: Do not overwrite DOM with empty values
        if (userName) {
            const currentName = userName.textContent || '';
            const nameToShow = computed || currentName;
            
            // Only update if we have a meaningful name to show
            if (nameToShow.trim()) {
                userName.textContent = nameToShow;
                
                // Update avatar based on the name and new avatar URL
                if (userAvatarContainer) {
                    const initials = this.getInitials(nameToShow);
                    userAvatarContainer.outerHTML = this.renderUserAvatar(profile.avatarUrl, initials);
                }
            }
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
     * Получение правильной формы слова "цитата" в зависимости от числа
     */
    getQuoteWord(count) {
        const num = Math.abs(count);
        const lastDigit = num % 10;
        const lastTwoDigits = num % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return 'цитат';
        }
        
        if (lastDigit === 1) {
            return 'цитата';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            return 'цитаты';
        } else {
            return 'цитат';
        }
    }
    
    /**
     * Получение правильной формы слова "день" в зависимости от числа
     */
    getDayWord(count) {
        const num = Math.abs(count);
        const lastDigit = num % 10;
        const lastTwoDigits = num % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return 'дней';
        }
        
        if (lastDigit === 1) {
            return 'день';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            return 'дня';
        } else {
            return 'дней';
        }
    }
    
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
        if (!this.dataLoaded) {
            this.loadFromStatistics();
        } else {
            const stats = this.state.get('stats');
            if (!stats?.loadedAt || (Date.now() - stats.loadedAt) > 60_000) {
                this.loadFromStatistics();
            } else {
                this.updateHeaderStats();
                this.updateProgressUI();
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
