/**
 * 🧭 SPA РОУТЕР ДЛЯ READER BOT MINI APP (УБРАНЫ ХЕДЕРЫ)
 * 
 * Управляет клиентским роутингом между страницами
 * Поддерживает анимации переходов и навигацию назад
 * 
 * @filesize 2 KB - SPA роутинг
 * @author Claude Assistant  
 * @version 1.1.0 - УБРАНЫ ХЕДЕРЫ ДЛЯ РЕШЕНИЯ VIEWPORT ПРОБЛЕМЫ
 */

/**
 * @typedef {Object} RouteConfig
 * @property {string} path - Путь маршрута
 * @property {Function} component - Компонент страницы
 * @property {string} title - Заголовок страницы
 * @property {boolean} requiresAuth - Требует аутентификации
 * @property {boolean} showBottomNav - Показывать нижнюю навигацию
 */

/**
 * @typedef {Object} NavigationOptions
 * @property {boolean} replace - Заменить текущую запись в истории
 * @property {string} animation - Тип анимации перехода
 * @property {Object} state - Состояние для передачи в страницу
 */

/**
 * 🧭 Класс роутера для SPA навигации
 * Управляет переходами между страницами Mini App
 */
class AppRouter {
    /**
     * 🏗️ Конструктор роутера
     * @param {Object} options - Опции инициализации
     * @param {HTMLElement} options.container - Контейнер для страниц
     * @param {AppState} options.state - Глобальное состояние
     * @param {ApiService} options.api - API сервис
     * @param {TelegramService} options.telegram - Telegram сервис
     * @param {ReaderApp} options.app - Ссылка на главное приложение
     */
    constructor({ container, state, api = null, telegram = null, app = null }) {
        if (!container) {
            throw new Error('❌ Router: Контейнер не передан');
        }

        // Инициализация свойств
        this.container = container;
        this.state = state;
        this.api = api;
        this.telegram = telegram;
        this.app = app;
        this.routes = new Map();
        this.currentRoute = '';
        this.currentComponent = null;
        this.history = [];
        this.isInitialized = false;
        this.isNavigating = false;

        this.container = container;
        this.state = state;
        this.api = api;
        this.telegram = telegram;
        this.app = app;
        
        // Навигационная защита от дублирования
        this._lastNavigationKey = null;  // Changed from _lastNavigationPath to include query
        this._lastNavigationTime = 0;
        this.currentQuery = {};  // Track current query params
        this.currentRouteKey = null; // Stable key for current route (path + query)
        
        // Привязываем методы к контексту
        this.handlePopState = this.handlePopState.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        
        console.log('✅ Router: Конструктор инициализирован - VERSION 1.1.0 - БЕЗ ХЕДЕРОВ');
    }

    /**
     * 🚀 Инициализация роутера
     * @param {string} initialRoute - Начальный маршрут для перехода
     */
    async init(initialRoute) {
        console.log('🔄 Router: Начало инициализации');
        
        // Регистрируем все маршруты
        this.registerRoutes();
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Обрабатываем текущий URL с возможным переопределением
        this.handleInitialRoute(initialRoute);
        
        this.isInitialized = true;
        console.log('✅ Router: Инициализация завершена');
    }

    /**
     * 🔧 Устанавливает API сервис (для позднего связывания)
     */
    setAPI(api) {
        this.api = api;
        console.log('✅ Router: API сервис установлен');
    }

    /**
     * 🔧 Устанавливает Telegram сервис (для позднего связывания)
     */
    setTelegram(telegram) {
        this.telegram = telegram;
        console.log('✅ Router: Telegram сервис установлен');
    }

    /**
     * 🔧 Устанавливает ссылку на главное приложение
     */
    setApp(app) {
        this.app = app;
        console.log('✅ Router: App установлен');
    }

    /**
     * 📋 Регистрация всех маршрутов приложения
     */
    registerRoutes() {
        console.log('🔄 Router: Регистрация маршрутов');
        
        // ✅ Все страницы БЕЗ ХЕДЕРОВ - контент с самого верха!
        
        // Главная страница
        this.routes.set('/home', {
            path: '/home',
            component: HomePage,
            title: 'Главная',
            requiresAuth: true,
            showBottomNav: true
        });

        // Дневник цитат
        this.routes.set('/diary', {
            path: '/diary', 
            component: DiaryPage,
            title: 'Дневник цитат',
            requiresAuth: true,
            showBottomNav: true
        });

        // Отчеты
        this.routes.set('/reports', {
            path: '/reports',
            component: ReportsPage, 
            title: 'Отчеты',
            requiresAuth: true,
            showBottomNav: true
        });

        // Каталог книг
        this.routes.set('/catalog', {
            path: '/catalog',
            component: CatalogPage,
            title: 'Каталог книг', 
            requiresAuth: true,
            showBottomNav: true
        });

        // Сообщество
        this.routes.set('/community', {
            path: '/community',
            component: CommunityPage,
            title: 'Сообщество',
            requiresAuth: true,
            showBottomNav: true
        });

        // Онбординг - БЕЗ НИЖНЕЙ НАВИГАЦИИ
        this.routes.set('/onboarding', {
            path: '/onboarding',
            component: OnboardingPage,
            title: 'Добро пожаловать',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // ✨ NEW ROUTES: Menu navigation pages
        
        // Achievements page  
        this.routes.set('/achievements', {
            path: '/achievements',
            component: AchievementsPage,
            title: 'Достижения',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Settings page
        this.routes.set('/settings', {
            path: '/settings',
            component: SettingsPage,
            title: 'Настройки', 
            requiresAuth: true,
            showBottomNav: false
        });
        
        // About page
        this.routes.set('/about', {
            path: '/about',
            component: AboutPage,
            title: 'О приложении',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Help page
        this.routes.set('/help', {
            path: '/help',
            component: HelpPage,
            title: 'Помощь',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Profile page
        this.routes.set('/profile', {
            path: '/profile',
            component: ProfilePage,
            title: 'Профиль',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // ✨ NEW ROUTES: Free Audio Pages
        
        // Free audios list
        this.routes.set('/free-audios', {
            path: '/free-audios',
            component: FreeAudiosPage,
            title: 'Аудио',
            requiresAuth: true,
            showBottomNav: true
        });
        
        // Free audio player (dynamic :id route)
        this.routes.set('/free-audios/:id', {
            path: '/free-audios/:id',
            component: FreeAudioPlayerPage,
            title: 'Плеер',
            requiresAuth: true,
            showBottomNav: false
        });

        console.log(`✅ Router: Зарегистрировано ${this.routes.size} маршрутов`);
    }

    /**
     * 📡 Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка кнопки "Назад" браузера
        window.addEventListener('popstate', this.handlePopState);
        
        // Обработка кликов по нижней навигации
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.addEventListener('click', this.handleNavigation);
        }
    }

    /**
     * 🏠 Обработка начального маршрута
     * @param {string} initialOverride - Переопределение начального маршрута из App
     */
    handleInitialRoute(initialOverride) {
        // Если App передал переопределение - используем его
        if (initialOverride) {
            console.log('🎯 Router: Используем переопределение начального маршрута:', initialOverride);
            this.navigate(initialOverride, { replace: true });
            return;
        }

        // В Telegram Mini App используем hash роутинг
        const rawHash = window.location.hash.slice(1);
        if (rawHash) {
            // Pass the full hash including query parameters to navigate
            this.navigate(rawHash, { replace: true });
        } else {
            // Если hash пустой — стартуем с каталога
            this.navigate('/catalog', { replace: true });
        }
    }
    
    /**
     * 🔑 Build stable navigation key from path and query
     * Creates a deterministic key for navigation deduplication and route comparison
     * Query params are sorted alphabetically for consistent key generation
     * @param {string} path - Normalized path
     * @param {Object} query - Query parameters
     * @returns {string} - Stable key for navigation deduplication (e.g., "/profile?tab=followers&user=123")
     * @private
     */
    _buildNavigationKey(path, query) {
        if (!query || Object.keys(query).length === 0) {
            return path;
        }
        
        // Sort query keys for stable comparison
        const sortedKeys = Object.keys(query).sort();
        const queryParts = sortedKeys.map(key => `${key}=${query[key]}`);
        return `${path}?${queryParts.join('&')}`;
    }

    /**
     * 🧭 Навигация к указанному маршруту
     * @param {string} path - Путь назначения
     * @param {NavigationOptions} options - Опции навигации
     */
    async navigate(path, options = {}) {
        const normalizedPath = this.normalizePath(path);
        const query = this.parseQuery(path);
        
        console.log(`🧭 Router: Навигация к ${normalizedPath} (исходный: ${path})`, query);

        // Build stable target key including query params for deduplication
        const targetKey = this._buildNavigationKey(normalizedPath, query);

        // GUARD 1: Усиленная защита от дублирования навигации через isNavigating flag
        if (this.isNavigating && !options.force) {
            console.log('⚠️ [NAV-GUARD] Navigation blocked: isNavigating=true (re-entrant call)');
            return;
        }
        
        // GUARD 2: Расширенное временное окно для защиты от дублирования (1500ms)
        // Увеличено с 500ms до 1500ms для надёжности на медленных соединениях
        // Now includes query params in comparison
        if (this._lastNavigationKey === targetKey && 
            Date.now() - this._lastNavigationTime < 1500 && 
            !options.force) {
            console.log('⚠️ [NAV-GUARD] Navigation blocked: duplicate within 1500ms window');
            return;
        }

        // GUARD 3: Защита от перехода на тот же маршрут (same-route guard)
        // Compare using stable keys that include query params
        if (this.currentRouteKey === targetKey && !options.replace && !options.force) {
            console.log('⚠️ [NAV-GUARD] Navigation blocked: already on route with same query', targetKey);
            return;
        }

        // Сохраняем информацию о последней навигации
        this._lastNavigationKey = targetKey;
        this._lastNavigationTime = Date.now();

        // Проверяем существование маршрута
        const route = this.routes.get(normalizedPath);
        if (!route) {
            console.warn(`⚠️ Router: Маршрут ${normalizedPath} не найден, редирект на /home`);
            return this.navigate('/home', { replace: true });
        }

        // Проверяем аутентификацию
        if (route.requiresAuth && !this.isAuthenticated()) {
            console.warn('⚠️ Router: Требуется аутентификация');
            return this.navigate('/onboarding', { replace: true });
        }

        try {
            // Устанавливаем флаг навигации
            this.isNavigating = true;
            
            // ✅ FIX: Set currentRoute BEFORE rendering to prevent flicker in top tabs
            // This ensures components can read the correct route during render()
            this.currentRoute = normalizedPath;
            this.currentQuery = query;
            this.currentRouteKey = targetKey;
            
            // Close all active modals before navigation to prevent them from hanging
            if (this.app && typeof this.app.closeActiveModals === 'function') {
                this.app.closeActiveModals();
            }
            
            // Создаем новый компонент для проверки prefetch (НЕ рендерим еще!)
            const componentState = {
                ...options.state,
                query: query
            };
            
            // Создаем объект app с правильной структурой для страниц
            const appObject = {
                // Основные сервисы
                state: this.state,
                api: this.api,
                telegram: this.telegram,
                router: this,
                
                // Методы, которые ожидают страницы
                showTopMenu: () => {
                    console.log('📋 App: showTopMenu вызван');
                    if (this.app && typeof this.app.showTopMenu === 'function') {
                        this.app.showTopMenu();
                    } else {
                        console.warn('⚠️ showTopMenu недоступен, показываем заглушку');
                        if (this.telegram && typeof this.telegram.showAlert === 'function') {
                            this.telegram.showAlert('Меню пока не доступно');
                        } else {
                            alert('Меню пока не доступно');
                        }
                    }
                },
                
                hideTopMenu: () => {
                    if (this.app && typeof this.app.hideTopMenu === 'function') {
                        this.app.hideTopMenu();
                    }
                },
                
                // Дополнительное состояние
                initialState: componentState
            };

            // Создаем временный экземпляр компонента для prefetch
            const tempComponent = new route.component(appObject);
            if (route.path === '/community') {
              window.communityPage = tempComponent;
            }
            // 1) Если у страницы есть prefetch() — вызываем и ждём
            if (tempComponent && typeof tempComponent.prefetch === 'function') {
                try {
                    console.log(`🔄 Router: Вызываем prefetch для ${route.title}`);
                    await tempComponent.prefetch(); // до рендера! остаётся старая страница на экране
                    console.log(`✅ Router: Prefetch завершен для ${route.title}`);
                } catch (error) {
                    console.warn(`⚠️ Router: prefetch failed for ${normalizedPath}:`, error);
                    // даже при ошибке продолжаем навигацию — страница покажет свои error-states
                }
            }
            
            // Анимация выхода для текущей страницы
            await this.animatePageExit();
            
            // Уничтожаем предыдущий компонент
            await this.destroyCurrentComponent();
            
            // Показываем состояние загрузки
            this.showPageLoading();
            
            // 2) Теперь монтируем страницу (первый рендер уже с данными)
            this.currentComponent = tempComponent;
            if (route.path === '/community') {
              window.communityPage = this.currentComponent;
              console.log('[DEBUG]: window.communityPage set', window.communityPage);
            }
            
            // Инициализируем компонент
            if (this.currentComponent && typeof this.currentComponent.init === 'function') {
                await this.currentComponent.init();
            }
            
            // Рендерим компонент
            if (this.currentComponent && typeof this.currentComponent.render === 'function') {
                const html = await this.currentComponent.render();
                if (html && this.container) {
                    this.container.innerHTML = html;
                    
                    // ✅ SCROLL TO TOP: Reset scroll position after rendering new page
                    // Ensures profile page opens from the top even when navigating from modals
                    // Use scrollTo with behavior: 'auto' for instant scroll (no animation)
                    if (this.container && typeof this.container.scrollTo === 'function') {
                        this.container.scrollTo({ top: 0, behavior: 'auto' });
                    } else if (this.container) {
                        // Fallback for browsers that don't support scrollTo options
                        this.container.scrollTop = 0;
                    }
                    
                    // Убираем все анимационные классы перед добавлением обработчиков
                    this.container.classList.remove(
                        'page-enter', 'page-enter-active', 
                        'page-exit', 'page-exit-active',
                        'animate-slide-in', 'animate-slide-out'
                    );
                    
                    // Проверяем наличие метода перед вызовом
                    if (this.currentComponent && typeof this.currentComponent.attachEventListeners === 'function') {
                        this.currentComponent.attachEventListeners();
                    } else {
                        console.warn(`⚠️ Router: attachEventListeners не найден у ${route.title}`);
                    }
                }
            }
            
            // Обновляем URL и историю (сохраняя query string)
            this.updateUrl(path, options.replace);
            
            // Обновляем UI
            this.updateUI(route);
            
            // Note: currentRoute, currentQuery, and currentRouteKey are already set earlier
            // before rendering to prevent flicker in top tabs
            
            // Анимация входа для новой страницы
            await this.animatePageEnter();
            
            // 3) Вызываем onShow после монтирования
            if (this.currentComponent && typeof this.currentComponent.onShow === 'function') {
                await this.currentComponent.onShow();
                console.log(`✅ Router: onShow вызван для ${route.title}`);
            }
            
            console.log(`✅ Router: Навигация к ${normalizedPath} завершена`);
            
        } catch (error) {
            console.error(`❌ Router: Ошибка навигации к ${normalizedPath}:`, error);
            this.handleNavigationError(error);
        } finally {
            // Сбрасываем флаг навигации
            this.isNavigating = false;
        }
    }

    /**
     * 🎬 Анимация выхода страницы
     */
    async animatePageExit() {
        if (!this.container) return;
        
        console.log('🎬 Router: Анимация выхода страницы');
        
        return new Promise(resolve => {
            // Добавляем класс выхода
            this.container.classList.add('page-exit');
            this.container.classList.add('page-exit-active');
            
            // Убираем все анимации входа
            this.container.classList.remove('page-enter', 'page-enter-active', 'animate-slide-in');
            
            // Ждем завершения анимации
            const duration = 200; // Быстрая анимация выхода
            setTimeout(() => {
                this.container.classList.remove('page-exit', 'page-exit-active');
                resolve();
            }, duration);
        });
    }

    /**
     * 🎬 Анимация входа страницы
     */
    async animatePageEnter() {
        if (!this.container) return;
        
        console.log('🎬 Router: Анимация входа страницы');
        
        return new Promise(resolve => {
            // Убираем состояние загрузки
            this.hidePageLoading();
            
            // Добавляем классы входа
            this.container.classList.add('page-enter');
            
            // Запускаем анимацию через requestAnimationFrame для гарантии
            requestAnimationFrame(() => {
                this.container.classList.add('page-enter-active');
                this.container.classList.remove('page-enter');
                
                // Ждем завершения анимации
                const duration = 300; // Плавная анимация входа
                setTimeout(() => {
                    this.container.classList.remove('page-enter-active');
                    resolve();
                }, duration);
            });
        });
    }

    /**
     * ⏳ Показ состояния загрузки страницы
     */
    showPageLoading() {
        if (this.container) {
            this.container.classList.add('page-loading');
            console.log('⏳ Router: Показано состояние загрузки');
        }
    }

    /**
     * ✅ Скрытие состояния загрузки страницы
     */
    hidePageLoading() {
        if (this.container) {
            this.container.classList.remove('page-loading');
            console.log('✅ Router: Скрыто состояние загрузки');
        }
    }

    /**
     * 🏗️ Создание компонента страницы
     * @param {RouteConfig} route - Конфигурация маршрута
     * @param {Object} state - Состояние для передачи в компонент
     */
    async createComponent(route, state = {}) {
        console.log(`🏗️ Router: Создание компонента ${route.title}`);
        
        // Создаем объект app с правильной структурой для страниц
        const appObject = {
            // Основные сервисы
            state: this.state,
            api: this.api,
            telegram: this.telegram,
            router: this,
            
            // Методы, которые ожидают страницы
            showTopMenu: () => {
                console.log('📋 App: showTopMenu вызван');
                if (this.app && typeof this.app.showTopMenu === 'function') {
                    this.app.showTopMenu();
                } else {
                    console.warn('⚠️ showTopMenu недоступен, показываем заглушку');
                    if (this.telegram && typeof this.telegram.showAlert === 'function') {
                        this.telegram.showAlert('Меню пока не доступно');
                    } else {
                        alert('Меню пока не доступно');
                    }
                }
            },
            
            hideTopMenu: () => {
                if (this.app && typeof this.app.hideTopMenu === 'function') {
                    this.app.hideTopMenu();
                }
            },
            
            // Дополнительное состояние
            initialState: state
        };

        try {
            // Создаем экземпляр компонента с правильной структурой app
            this.currentComponent = new route.component(appObject);
            
            // Инициализируем компонент
            if (this.currentComponent && typeof this.currentComponent.init === 'function') {
                await this.currentComponent.init();
            }
            
            // Рендерим компонент
            if (this.currentComponent && typeof this.currentComponent.render === 'function') {
                const html = await this.currentComponent.render();
                if (html && this.container) {
                    this.container.innerHTML = html;
                    
                    // Убираем все анимационные классы перед добавлением обработчиков
                    this.container.classList.remove(
                        'page-enter', 'page-enter-active', 
                        'page-exit', 'page-exit-active',
                        'animate-slide-in', 'animate-slide-out'
                    );
                    
                    // Проверяем наличие метода перед вызовом
                    if (this.currentComponent && typeof this.currentComponent.attachEventListeners === 'function') {
                        this.currentComponent.attachEventListeners();
                    } else {
                        console.warn(`⚠️ Router: attachEventListeners не найден у ${route.title}`);
                    }
                }
            }
            
            console.log(`✅ Router: Компонент ${route.title} создан успешно`);
            
        } catch (error) {
            console.error(`❌ Router: Ошибка создания компонента ${route.title}:`, error);
            
            // Показываем ошибку в контейнере
            if (this.container) {
                this.container.innerHTML = `
                    <div class="error-page">
                        <h2>⚠️ Ошибка загрузки страницы</h2>
                        <p>${error.message}</p>
                        <button onclick="window.location.reload()">🔄 Обновить страницу</button>
                    </div>
                `;
            }
            
            throw error;
        }
    }

    /**
     * 💥 Уничтожение текущего компонента
     */
    async destroyCurrentComponent() {
        if (!this.currentComponent) return;
        
        console.log('💥 Router: Уничтожение текущего компонента');
        
        // Вызываем onHide для текущего компонента
        if (this.currentComponent && typeof this.currentComponent.onHide === 'function') {
            this.currentComponent.onHide();
            console.log('✅ Router: onHide вызван для текущего компонента');
        }
        
        // Вызываем метод очистки если он есть
        if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
            await this.currentComponent.destroy();
            console.log('🧹 Router: destroy() вызван для текущего компонента');
        }
        
        // Очищаем контейнер и убираем все анимационные классы
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove(
                'page-enter', 'page-enter-active', 
                'page-exit', 'page-exit-active',
                'page-loading', 'animate-slide-in', 'animate-slide-out'
            );
        }
        
        this.currentComponent = null;
    }

    updateUrl(path, replace = false) {
        // Don't normalize the path here to preserve query string
        const url = `#${path.startsWith('/') ? path : '/' + path}`;
        const normalizedPath = this.normalizePath(path);
        const query = this.parseQuery(path);
        const routeKey = this._buildNavigationKey(normalizedPath, query);
    
        if (replace) {
            window.history.replaceState({ path: normalizedPath }, '', url);
        } else {
            window.history.pushState({ path: normalizedPath }, '', url);
            this.history.push(normalizedPath);
        }

        // Update currentRouteKey when URL changes
        this.currentRouteKey = routeKey;

        // ✅ Обновляем Telegram BackButton (поскольку hashchange не сработает)
        if (this.app && typeof this.app.updateBackButtonVisibility === 'function') {
        try {
            this.app.updateBackButtonVisibility(normalizedPath);
            } catch (e) {
            console.warn('Router: updateBackButtonVisibility failed:', e);
            }
        }
    }

    /**
     * 🎨 Обновление пользовательского интерфейса
     * @param {RouteConfig} route - Конфигурация маршрута
     */
    updateUI(route) {
        // Обновляем заголовок
        document.title = `${route.title} - Читатель`;
        
        // Показываем/скрываем нижнюю навигацию
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = route.showBottomNav ? 'flex' : 'none';
        }
        
        // Обновляем активную кнопку навигации
        this.updateActiveNavigation(route.path);
        
        // Уведомляем Telegram о смене заголовка
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.setHeaderColor('bg_color');
        }
    }

    /**
     * 🎯 Обновление активной кнопки навигации
     * @param {string} path - Активный путь
     */
    updateActiveNavigation(path) {
        const navButtons = document.querySelectorAll('.nav-item');
        
        navButtons.forEach(button => {
            const buttonPath = '/' + button.dataset.page;
            button.classList.toggle('active', buttonPath === path);
        });
    }

    /**
     * ⬅️ Навигация назад
     */
    goBack() {
        console.log('⬅️ Router: Навигация назад');
        
        if (this.history.length > 1) {
            // Удаляем текущую страницу из истории
            this.history.pop();
            // Переходим к предыдущей
            const previousPath = this.history.pop();
            this.navigate(previousPath);
        } else {
            // Если истории нет, идем на главную
            this.navigate('/home', { replace: true });
        }
    }

    /**
     * 🔄 Перезагрузка текущей страницы
     */
    reload() {
        console.log('🔄 Router: Перезагрузка страницы');
        this.navigate(this.currentRoute, { replace: true });
    }

    /**
     * 📡 Обработчик события popstate (кнопка "Назад")
     * @param {PopStateEvent} event - Событие popstate
     */
    handlePopState(_event) {
        console.log('📡 Router: Обработка popstate');
        
        // Use current hash to preserve query parameters
        const rawHash = window.location.hash.slice(1);
        const path = rawHash || '/home';
        
        // Навигируем без добавления в историю
        this.navigate(path, { replace: true });
    }

    /**
     * 🖱️ Обработчик кликов по навигации
     * @param {Event} event - Событие клика
     */
    handleNavigation(event) {
        const navItem = event.target.closest('.nav-item');
        if (!navItem) return;
        
        event.preventDefault();
        
        const page = navItem.dataset.page;
        if (page) {
            this.navigate(`/${page}`);
            
            // Haptic feedback для Telegram
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        }
    }

    /**
     * 🔐 Проверка аутентификации пользователя
     * @returns {boolean} - Аутентифицирован ли пользователь
     */
    isAuthenticated() {
        return this.state?.get('user.isAuthenticated') || false;
    }

    /**
     * ❌ Обработка ошибок навигации
     * @param {Error} error - Ошибка навигации
     */
    handleNavigationError(error) {
        console.error('❌ Router: Ошибка навигации:', error);
        
        // Показываем уведомление пользователю
        if (window.showNotification) {
            showNotification('Ошибка загрузки страницы', 'error');
        }
        
        // Пытаемся вернуться на главную страницу
        setTimeout(() => {
            this.navigate('/home', { replace: true });
        }, 1000);
    }

    /**
     * 📊 Получение информации о текущем маршруте
     * @returns {RouteConfig|null} - Конфигурация текущего маршрута
     */
    getCurrentRoute() {
        return this.routes.get(this.currentRoute) || null;
    }

    /**
     * 📋 Получение всех зарегистрированных маршрутов
     * @returns {Array<RouteConfig>} - Массив всех маршрутов
     */
    getAllRoutes() {
        return Array.from(this.routes.values());
    }

    /**
     * 🧹 Очистка ресурсов роутера
     */
    destroy() {
        console.log('🧹 Router: Очистка ресурсов');
        
        // Удаляем обработчики событий
        window.removeEventListener('popstate', this.handlePopState);
        
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.removeEventListener('click', this.handleNavigation);
        }
        
        // Уничтожаем текущий компонент
        this.destroyCurrentComponent();
        
        // Очищаем данные
        this.routes.clear();
        this.history = [];
        this.currentRoute = '';
        this.isInitialized = false;
        this.isNavigating = false;
        
        console.log('✅ Router: Очистка завершена');
    }

    /**
     * 🔄 Normalize path for consistent routing
     * @param {string} path - Raw path (may include # and query string)
     * @returns {string} - Normalized path with leading / but without query string
     */
    normalizePath(path) {
        if (!path || typeof path !== 'string') {
            return '/home';
        }
        
        // Strip any leading #
        let normalized = path.replace(/^#+/, '');
        
        // Strip query string for route matching
        const queryIndex = normalized.indexOf('?');
        if (queryIndex !== -1) {
            normalized = normalized.substring(0, queryIndex);
        }
        
        // Ensure starts with /
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        
        // Fall back to /home when empty
        if (normalized === '/' || normalized === '') {
            normalized = '/home';
        }
        
        // Check for dynamic routes (e.g., /free-audios/some-id)
        // Match against registered routes with dynamic segments
        const exactMatch = this.routes.get(normalized);
        if (exactMatch) {
            return normalized;
        }
        
        // Try to match dynamic routes (e.g., /free-audios/:id)
        for (const [routePath, _] of this.routes.entries()) {
            if (routePath.includes(':')) {
                const pattern = this.routeToRegex(routePath);
                if (pattern.test(normalized)) {
                    return routePath; // Return the route template
                }
            }
        }
        
        return normalized;
    }
    
    /**
     * Convert route path with :param to regex
     * @param {string} routePath - Route path with dynamic segments
     * @returns {RegExp} Regular expression for matching
     */
    routeToRegex(routePath) {
        // Convert /free-audios/:id to /free-audios/[^/]+
        const pattern = routePath.replace(/:[^/]+/g, '[^/]+');
        return new RegExp(`^${pattern}$`);
    }

    /**
     * 🔍 Parse query string from path
     * @param {string} path - Path that may include query string
     * @returns {Object} - Parsed query parameters
     */
    parseQuery(path) {
        if (!path || typeof path !== 'string') {
            return {};
        }
        
        // Strip any leading #
        const cleanPath = path.replace(/^#+/, '');
        
        const queryIndex = cleanPath.indexOf('?');
        if (queryIndex === -1) {
            return {};
        }
        
        const queryString = cleanPath.substring(queryIndex + 1);
        const query = {};
        
        if (queryString) {
            const pairs = queryString.split('&');
            for (const pair of pairs) {
                const [key, value] = pair.split('=');
                if (key) {
                    query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
                }
            }
        }
        
        return query;
    }

    /**
     * 🔍 Check if there is an explicit route in URL (hash or pathname)
     * @returns {boolean} - True if there's a real route (not empty/root)
     */
    hasExplicitRoute() {
        // Check hash route
        const rawHash = window.location.hash.slice(1);
        if (rawHash && rawHash !== '' && rawHash !== '/') {
            // Extract path without query params
            const hashPath = rawHash.split('?')[0];
            // Valid if it's a non-empty path that starts with /
            if (hashPath && hashPath !== '/' && hashPath.startsWith('/')) {
                return true;
            }
        }
        
        // Check pathname (for non-hash routing scenarios, though we use hash routing)
        const pathname = window.location.pathname;
        if (pathname && pathname !== '/' && pathname !== '') {
            return true;
        }
        
        return false;
    }
}

// Экспорт для использования в других модулях
window.AppRouter = AppRouter;
