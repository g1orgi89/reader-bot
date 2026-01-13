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
        // Add listener for main stats updates from StatisticsService
        document.addEventListener('stats:updated', (e) => {
            console.log('📊 HomePage: Received stats:updated event', e.detail);
            if (e.detail) {
                this.applyTopStats(e.detail);
                this.updateProgressUI();
            }
        });

        // Add listener for recent quotes updates
        document.addEventListener('quotes:changed', (e) => {
            console.log('📊 HomePage: Received quotes:changed event', e.detail);
            // Refresh recent quotes display
            setTimeout(() => {
                this.updateRecentQuotesUI();
            }, 100);
        });

        // Add listener for state changes to quotes.recent
        this.state.subscribe('quotes.recent', (quotes) => {
            console.log('📊 HomePage: Recent quotes state changed', quotes);
            this.updateRecentQuotesUI();
        });

        // Add listener for state changes to stats
        this.state.subscribe('stats', (stats) => {
            console.log('📊 HomePage: Stats state changed', stats);
            this.applyTopStats(stats);
            this.updateProgressUI();
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
            this.updateStatsUI(stats); // Legacy grid support
            this.applyTopStats(stats); // Inline stats block
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
     * 📊 Загрузка начальных данных - PRODUCTION REFACTOR: Используем только StatisticsService
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
            
            // PRODUCTION REFACTOR: Используем только StatisticsService для статистики
            let stats = null;
            if (this.statistics) {
                await this.statistics.warmupInitialStats();
                stats = this.state.get('stats'); // Получаем из state после warmup
            }
            
            // Параллельная загрузка данных (без прямых API вызовов статистики)
            const [topBooks, profile] = await Promise.all([
                this.loadTopBooks(), 
                this.loadUserProfile(userId),
                this.loadRecentQuotes(userId)
            ]);
            
            // Обновление состояния (статистика уже обновлена через StatisticsService)
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
    
    /**
     * PRODUCTION REFACTOR: Используем только StatisticsService для загрузки статистики
     */
    async loadFromStatistics() {
        if (!this.statistics) return this.loadInitialData();
        if (this.loading) return;
        try {
            this.loading = true;
            // NO loading flags for state to prevent skeletons
            await this.waitForValidUserId(); // Ensure userId is ready
            
            // PRODUCTION REFACTOR: Используем централизованный сервис статистики
            await this.statistics.warmupInitialStats();
            
            // Получаем данные из state (уже обновленные через StatisticsService)
            const stats = this.state.get('stats');
            
            // Загружаем остальные данные через сервис
            const [latestQuotes, topAnalyses] = await Promise.all([
                this.statistics.getLatestQuotes(3),
                this.statistics.getTopAnalyses(3)
            ]);
            
            this.state.setRecentQuotes(latestQuotes);
            const mapped = topAnalyses.map(a => ({ _id: a.id, title: a.title, author: a.author, salesCount: a.clicks }));
            this.state.set('catalog.books', mapped);
            
            this.dataLoaded = true;
            
            // Apply UI updates immediately after state update
            this.applyTopStats(stats);
            this.updateProgressUI();
        } catch (e) {
            console.error('HomePage statistics load error', e);
            this.error = 'Не удалось загрузить данные';
        } finally {
            this.loading = false;
            // NO state loading flag changes
        }
    }

    updateProgressUI() {
        const wrap = document.querySelector('.progress-block');
        if (!wrap) return;
        
        const stats = this.state.get('stats') || {};
        // Check loading state from state.loading property, not local loading flag
        const isLoading = this.state.get('stats.loading') || false;
        
        const grid = wrap.querySelector('.progress-grid');
        const activityNode = wrap.querySelector('.progress-activity');
        
        if (grid) {
            if (isLoading) {
                // Show skeleton loading state
                grid.innerHTML = Array(3).fill(0).map(() => `
                    <div class="stat-card skeleton-stat-block" style="min-height:var(--touch-target-min);min-width:var(--touch-target-min);">
                        <div class="skeleton-stat-label"></div>
                        <div class="skeleton-stat-number"></div>
                    </div>
                `).join('');
            } else {
                // Show actual data with smooth transition - ensure touch-friendly sizes
                const newContent = [
                    { label: 'За неделю', value: stats.weeklyQuotes ?? '—' },
                    { label: 'Серия <span class="progress-streak-suffix">(дней подряд)</span>', value: stats.currentStreak ?? '—' },
                    { label: 'Любимый автор', value: stats.favoriteAuthor || '—' }
                ].map(item => `
                    <div class="stat-card fade-in" style="min-height:var(--touch-target-min);min-width:var(--touch-target-min);display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;">
                        <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">${item.label}</div>
                        <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);color:var(--text-primary);">${item.value}</div>
                    </div>
                `).join('');
                
                if (grid.innerHTML !== newContent) {
                    grid.innerHTML = newContent;
                    // Remove fade-in class after animation
                    setTimeout(() => {
                        grid.querySelectorAll('.fade-in').forEach(el => {
                            el.classList.remove('fade-in');
                        });
                    }, 300);
                }
            }
        }
        
        if (activityNode) {
            if (isLoading) {
                activityNode.innerHTML = '<div class="skeleton-line" style="width: 60%; height: 16px; margin: 0 auto;"></div>';
            } else {
                // Always get activityPercent from API data
                const activityPercent = stats.activityPercent ?? 1;
                const activityLevel = stats.activityLevel || 'low';
                let emoji = '🔍';
                if (activityLevel === 'high') emoji = '🔥';
                else if (activityLevel === 'medium') emoji = '💪';
                
                const newText = `Активность: ${activityLevel === 'high' ? 'Высокая' : activityLevel === 'medium' ? 'Средняя' : 'Начинающий'} ${emoji}`;
                if (activityNode.textContent !== newText) {
                    activityNode.textContent = newText;
                    activityNode.classList.add('fade-in');
                    setTimeout(() => activityNode.classList.remove('fade-in'), 300);
                }
            }
        }
    }
            
    /**
     * 📈 Загрузка статистики пользователя - УДАЛЕНО: теперь используем только StatisticsService
     */
    // PRODUCTION REFACTOR: Removed direct API calls, now using StatisticsService only
    
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
        const quoteItems = document.querySelectorAll('.quote-card.recent');
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
        const res = await this.api.getTopBooks({ scope: 'week' });
        const items = res?.data || res || [];
        const topBooks = items.map(i => ({
          _id: i.id || i._id,
          title: i.title,
          author: i.author,
          salesCount: (typeof i.salesCount === 'number' && i.salesCount > 0) ? i.salesCount : (i.clicksCount || 0)
        }));
        
        // Save top week IDs to state for catalog page
        if (topBooks && topBooks.length > 0) {
          const existingTopWeekIds = this.state.get('catalog.topWeekIds') || {};
          const tenMinutes = 10 * 60 * 1000;
          const now = Date.now();
          
          // Only update if we don't have fresh data (< 10 minutes)
          if (!existingTopWeekIds.timestamp || (now - existingTopWeekIds.timestamp) > tenMinutes) {
            const topWeekIds = topBooks.map(b => b._id || b.id).filter(Boolean);
            this.state.set('catalog.topWeekIds', {
              ids: topWeekIds,
              timestamp: now
            });
            console.log('✅ HomePage: Saved top week IDs to state:', topWeekIds);
          }
        }
        
        return topBooks;
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
                ${this.renderHomeStatusCard(user)}
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
     * 🔧 PATCH: Redesigned header with larger avatar, name, username, and status
     */
    renderUserHeader(user) {
        const name =
            user.name ||
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.username ||
            '';
        const initials = name ? this.getInitials(name) : '';
        const username = user.username ? `@${user.username}` : '';
        
        return `
            <div class="home-header">
                <button class="home-header-avatar-large" id="homeHeaderAvatar" aria-label="Профиль">
                    ${this.renderUserAvatar(user.avatarUrl, initials)}
                </button>
                <div class="home-header-info">
                    <div class="home-header-name">${name || 'Пользователь'}</div>
                    ${username ? `<div class="home-header-username">${username}</div>` : ''}
                </div>
                <div class="home-header-spacer"></div>
                <button class="home-header-menu-btn" id="homeHeaderMenuBtn" aria-label="Меню">Меню</button>
            </div>
        `;
    }

    /**
     * 💭 Рендер карточки статуса (#МЫСЛЬДНЯ)
     * Отдельная карточка под аватаром с возможностью редактирования
     */
    renderHomeStatusCard(user) {
        const status = user.status || '';
        const displayText = status || 'Мысль дня';
        const isPlaceholder = !status;
        
        return `
            <div class="home-status-card">
                <div class="home-status-card-header">
                    <div class="home-status-card-title">#МЫСЛЬДНЯ</div>
                    <button class="home-status-card-edit-btn" id="statusEditBtn" aria-label="Редактировать статус">✏️</button>
                </div>
                <div id="statusContainer">
                    <div class="${isPlaceholder ? 'home-status-placeholder' : 'home-status-text'}" id="statusDisplay">
                        ${displayText}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 💾 Рендер инлайн-редактора статуса
     * Показывается вместо текста статуса при нажатии на кнопку редактирования
     */
    renderStatusEditor(currentStatus = '') {
        return `
            <div class="home-status-editor" id="statusEditor">
                <input 
                    type="text" 
                    class="home-status-input" 
                    id="statusInput"
                    maxlength="80"
                    value="${currentStatus}"
                    placeholder="Мысль дня"
                    autocomplete="off"
                />
                <div class="home-status-actions">
                    <button class="home-status-editor-btn home-status-save" id="statusSaveBtn" aria-label="Сохранить">
                        ✔
                    </button>
                    <button class="home-status-editor-btn home-status-cancel" id="statusCancelBtn" aria-label="Отмена">
                        ✖
                    </button>
                </div>
            </div>
        `;
    }


    /**
     * 🖼️ Рендер аватара с поддержкой изображений
     * 🔧 PATCH: Use app.resolveAvatar() for unified avatar handling
     */
    renderUserAvatar(avatarUrl, initials) {
        // Use app.resolveAvatar() if available, otherwise fallback to direct check
        const imageUrl = this.app?.resolveAvatar?.() || avatarUrl || this.telegram?.getUser()?.photo_url;
        
        if (imageUrl) {
            return `
                <img src="${imageUrl}" alt="Аватар" 
                     onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                <div class="home-header-avatar-fallback fallback" style="display:none">${initials || 'А'}</div>
            `;
        } else {
            return `<div class="home-header-avatar-fallback">${initials || 'А'}</div>`;
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
     * 📊 Рендер инлайн статистики (только цитаты и дни в приложении)
     */
    renderStatsInline(stats) {
        const loading = stats?.loading || this.loading;

        if (loading) {
            return `
                <div class="stats-inline skeleton-stat-block" id="statsInline">
                    <div class="skeleton-line" style="width: 80%; height: 18px;"></div>
                </div>
            `;
        }

        let content = '—';
        const hasValid =
            !loading &&
            stats &&
            stats.totalQuotes != null &&
            stats.totalQuotes >= 0;

        if (hasValid) {
            const totalQuotes = stats.totalQuotes ?? 0;
            const daysInApp = stats.daysInApp ?? 0;
            const quotesWord = this.getQuoteWord(totalQuotes);
            const daysWord = this.getDayWord(daysInApp);

            content = `${totalQuotes} ${quotesWord}`;
            if (daysInApp > 0) {
                content += ` • ${daysInApp} ${daysWord} в приложении`;
            }
        }
    
        return `
            <div class="stats-inline" id="statsInline">
                <span class="stat-summary">${content}</span>
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
            <div class="quote-card recent" data-quote-id="${quote._id || quote.id}">
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
            <div class="quote-card recent skeleton">
                <div class="quote-text skeleton-line"></div>
                <div class="quote-author skeleton-line-short"></div>
            </div>
            <div class="quote-card recent skeleton">
                <div class="quote-text skeleton-line"></div>
                <div class="quote-author skeleton-line-short"></div>
            </div>
            <div class="quote-card recent skeleton">
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
        <div class="progress-block" style="margin:var(--spacing-md) 0;">
          <div style="font-weight:var(--font-weight-semibold);font-size:var(--font-size-sm);margin:0 0 var(--spacing-sm);color:var(--text-primary);">📈 Ваш прогресс</div>
          <div class="progress-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--spacing-sm);">
            ${[1,2,3].map(()=>`<div class="stat-card" style="min-height:var(--touch-target-min);min-width:var(--touch-target-min);opacity:.45;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;"><div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">…</div><div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);color:var(--text-primary);">—</div></div>`).join('')}
          </div>
          <div class="progress-activity" style="margin-top:var(--spacing-sm);font-size:var(--font-size-xs);color:var(--text-secondary);">Загрузка…</div>
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
        // 🔧 NEW: Home header avatar button (navigate to profile)
        const avatarBtn = document.getElementById('homeHeaderAvatar');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', () => this.handleProfileNavigation());
        }
        
        // 🔧 NEW: Home header name (navigate to profile)
        const headerName = document.querySelector('.home-header-name');
        if (headerName) {
            headerName.style.cursor = 'pointer';
            headerName.addEventListener('click', () => this.handleProfileNavigation());
            headerName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleProfileNavigation();
                }
            });
            headerName.setAttribute('tabindex', '0');
            headerName.setAttribute('role', 'button');
        }
        
        // 🔧 NEW: Home header username (navigate to profile)
        const headerUsername = document.querySelector('.home-header-username');
        if (headerUsername) {
            headerUsername.style.cursor = 'pointer';
            headerUsername.addEventListener('click', () => this.handleProfileNavigation());
            headerUsername.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleProfileNavigation();
                }
            });
            headerUsername.setAttribute('tabindex', '0');
            headerUsername.setAttribute('role', 'button');
        }
        
        // 🔧 NEW: Home header menu button (open TopMenu)
        const menuBtn = document.getElementById('homeHeaderMenuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.handleMenuClick());
        }
        
        // 💭 NEW: Status edit button
        const statusEditBtn = document.getElementById('statusEditBtn');
        if (statusEditBtn) {
            statusEditBtn.addEventListener('click', () => this.handleStatusEditClick());
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
        
        // NOTE: Removed click handler for statsInline to prevent navigation to /reports
        
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
     * 💭 Обработчик клика по кнопке редактирования статуса
     * Переключает отображение на инлайн-редактор
     */
    handleStatusEditClick() {
        this.telegram.hapticFeedback('light');
        
        const statusContainer = document.getElementById('statusContainer');
        if (!statusContainer) return;
        
        // Get current status from profile
        const profile = this.state.get('user.profile') || {};
        const currentStatus = profile.status || '';
        
        // Replace status display with editor
        statusContainer.innerHTML = this.renderStatusEditor(currentStatus);
        
        // Attach editor event listeners
        const statusInput = document.getElementById('statusInput');
        const saveBtn = document.getElementById('statusSaveBtn');
        const cancelBtn = document.getElementById('statusCancelBtn');
        
        if (statusInput) {
            // Focus input
            statusInput.focus();
            statusInput.select();
            
            // Handle Enter key to save
            statusInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleStatusSave(statusInput.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.handleStatusCancel();
                }
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.handleStatusSave(statusInput?.value || '');
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.handleStatusCancel();
            });
        }
    }
    
    /**
     * 💾 Сохранение нового статуса
     */
    async handleStatusSave(newStatus) {
        this.telegram.hapticFeedback('success');
        
        try {
            // Trim and limit to 80 chars
            const trimmedStatus = newStatus.trim().substring(0, 80);
            
            // Update via API
            const response = await this.api.updateProfile({
                status: trimmedStatus
            });
            
            if (response.success) {
                // Update state
                const profile = this.state.get('user.profile') || {};
                const updatedStatus = response.user?.status || null;
                profile.status = updatedStatus;
                this.state.set('user.profile', profile);
                
                // Refresh status display
                this.refreshStatusDisplay();
                
                // ✨ Мгновенное обновление Профиля и Модалки через событие
                const statusUpdatedEvent = new CustomEvent('status:updated', {
                    detail: { status: updatedStatus }
                });
                window.dispatchEvent(statusUpdatedEvent);
                
                console.log('✅ Status updated and broadcast to Profile and Modal');
            } else {
                throw new Error(response.error || 'Не удалось обновить статус');
            }
        } catch (error) {
            console.error('❌ Error saving status:', error);
            this.telegram.showAlert('Не удалось сохранить статус. Попробуйте позже.');
            this.handleStatusCancel();
        }
    }
    
    /**
     * ❌ Отмена редактирования статуса
     */
    handleStatusCancel() {
        this.telegram.hapticFeedback('light');
        this.refreshStatusDisplay();
    }
    
    /**
     * 🔄 Обновление отображения статуса
     */
    refreshStatusDisplay() {
        const statusContainer = document.getElementById('statusContainer');
        if (!statusContainer) return;
        
        const profile = this.state.get('user.profile') || {};
        const status = profile.status || '';
        const displayText = status || 'Мысль дня';
        const isPlaceholder = !status;
        
        statusContainer.innerHTML = `
            <div class="${isPlaceholder ? 'home-status-placeholder' : 'home-status-text'}" id="statusDisplay">
                ${displayText}
            </div>
        `;
        
        // Note: The edit button (✏️) is rendered outside the statusContainer in renderHomeStatusCard(),
        // so it remains functional during status updates without needing to re-attach event listeners
    }

    
    /**
     * 👤 Обработчик навигации в профиль (заменяет старый handleAvatarClick)
     * 🔧 NEW: Navigate to /profile?user=me when avatar, name, or username is clicked
     */
    handleProfileNavigation() {
        if (this.telegram && typeof this.telegram.hapticFeedback === 'function') {
            this.telegram.hapticFeedback('light');
        }
        if (this.app && this.app.router) {
            this.app.router.navigate('/profile?user=me');
        }
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
     * 📊 Применение статистики к верхнему блоку (без streak)
     */
    applyTopStats(stats) {
        const statsInline = document.getElementById('statsInline');
        if (!statsInline) return;

        // Check loading state from stats.loading property
        const isLoading = stats?.loading || this.state.get('stats.loading') || false;

        // Show loading state if stats are being loaded
        if (isLoading) {
            statsInline.className = 'stats-inline skeleton-stat-block';
            statsInline.innerHTML = '<div class="skeleton-line" style="width: 80%; height: 18px;"></div>';
            return;
        }

        // Remove skeleton class if it exists
        statsInline.classList.remove('skeleton-stat-block');

        // По ТЗ: если нет валидных данных — показываем "—"
        let content = '—';

        // Валидные данные: должны быть totalQuotes >= 0
        const hasValid =
            stats &&
            typeof stats.totalQuotes === 'number' &&
            stats.totalQuotes >= 0;

        if (hasValid) {
            const totalQuotes = stats.totalQuotes ?? 0;
            const daysInApp = stats.daysInApp ?? 0;
            const quotesWord = this.getQuoteWord(totalQuotes);
            const daysWord = this.getDayWord(daysInApp);

            content = `${totalQuotes} ${quotesWord}`;
            if (daysInApp > 0) {
                content += ` • ${daysInApp} ${daysWord} в приложении`;
            }
        }

        // Обновляем DOM только если контент реально поменялся
        const currentContent = statsInline.querySelector('.stat-summary')?.textContent || '';
        if (currentContent === content) {
            return;
        }

        const shouldAnimate = currentContent && currentContent !== content && currentContent !== '—';
        
        // Ensure we have proper class structure
        statsInline.className = 'stats-inline';
        statsInline.innerHTML = `<span class="stat-summary">${content}</span>`;

        if (shouldAnimate) {
            statsInline.classList.add('fade-in');
            setTimeout(() => statsInline.classList.remove('fade-in'), 300);
        }
    }

    /**
     * 🔄 Обновление UI статистики (только поддержка старого формата сетки)
     */
    updateStatsUI(stats) {
        if (!stats) return;
        
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
     * 🔧 PATCH: Updated to support new home header with name and username
     */
    updateUserInfoUI(profile) {
        if (!profile) return;

        // Собираем имя по приоритету: name → firstName+lastName → username → ''
        const computed = profile.name ||
            [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
            profile.username ||
            '';

        // Update new header structure
        const homeHeaderAvatar = document.querySelector('.home-header-avatar-large');
        const homeHeaderName = document.querySelector('.home-header-name');
        const homeHeaderUsername = document.querySelector('.home-header-username');

        // Update name
        if (homeHeaderName) {
            const currentName = homeHeaderName.textContent || '';
            const nameToShow = computed || currentName;
            
            if (nameToShow.trim()) {
                homeHeaderName.textContent = nameToShow;
            }
        }

        // Update username
        const username = profile.telegramUsername ? `@${profile.telegramUsername}` : '';
        if (homeHeaderUsername) {
            homeHeaderUsername.textContent = username;
        } else if (username) {
            // Add username element if it doesn't exist
            const homeHeaderInfo = document.querySelector('.home-header-info');
            if (homeHeaderInfo && homeHeaderName) {
                const usernameEl = document.createElement('div');
                usernameEl.className = 'home-header-username';
                usernameEl.textContent = username;
                homeHeaderInfo.appendChild(usernameEl);
            }
        }

        // Update avatar
        if (homeHeaderAvatar && computed) {
            const initials = this.getInitials(computed);
            homeHeaderAvatar.innerHTML = this.renderUserAvatar(profile.avatarUrl, initials);
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
     * Вызывается при показе страницы - PRODUCTION REFACTOR: Только StatisticsService
     */
    onShow() {
        // PRODUCTION REFACTOR: Проверяем свежесть данных через state, а не локальные переменные
        const stats = this.state.get('stats');
        if (stats?.lastUpdate && (Date.now() - stats.lastUpdate) < 5000) {
            this.applyTopStats(stats);
            this.updateProgressUI();
            return;
        }
        if (!this.dataLoaded) {
            this.loadFromStatistics();
        } else {
            const stats = this.state.get('stats');
            if (!stats?.loadedAt || (Date.now() - stats.loadedAt) > 60_000) {
                this.loadFromStatistics();
            } else {
                this.applyTopStats(stats);
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
