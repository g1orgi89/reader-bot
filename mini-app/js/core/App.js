/**
 * 🚀 ГЛАВНЫЙ КЛАСС ПРИЛОЖЕНИЯ READER BOT
 * (оптимизирован: устранение двойной навигации / flicker при старте)
 * 
 * UPDATED: Added deeplink support for startapp parameter
 * - handleDeeplink() method for processing Telegram startapp parameter
 * - Supports: reports, reports/weekly, reports/monthly, catalog, diary, etc.
 * 
 * @version 1.0.9
 */
class ReaderApp {
    constructor() {
        console.log('🚀 Reader App: Инициализация начата - VERSION 1.0.9');
        this.router = null;
        this.state = null;
        this.telegram = null;
        this.api = null;
        this.isInitialized = false;
        this.appContainer = document.getElementById('app');
        this.loadingScreen = document.getElementById('loading-screen');
        this.topMenu = null;
        
        // === DEEPLINK SUPPORT ===
        // Store startapp parameter for deferred navigation after init
        this._pendingDeeplink = null;
        
        // === ONBOARDING STABILITY START ===
        // Флаг для предотвращения множественных navigate('/onboarding')
        this._onboardingGateApplied = false;
        // === ONBOARDING STABILITY END ===

        if (!this.appContainer || !this.loadingScreen) {
            throw new Error('❌ Критические элементы DOM не найдены');
        }

        this.handleError = this.handleError.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        // === GLOBAL DEBUG REFERENCES ===
        // Set global window references for manual debugging in console
        window.App = this;
        window.ReaderAppInstance = this;
        console.log('🔍 Global debug references set: window.App and window.ReaderAppInstance');

        console.log('✅ Reader App: Конструктор завершен - ИСПРАВЛЕНА ПЕРЕДАЧА APP В ROUTER!');
        
        // === GLOBAL SAFE IMAGE ERROR HANDLER ===
        // Initialize global safe image error handler to prevent uncaught exceptions
        this.initializeImageErrorHandler();
    }

    /**
     * 🖼️ Initialize global safe image error handler
     * Prevents uncaught TypeError from inline onerror on <img> elements
     * Safely hides failed images and shows fallback initials
     */
    initializeImageErrorHandler() {
        window.RBImageErrorHandler = function(img) {
            try {
                // Validate that img is an HTMLImageElement
                if (!img || !(img instanceof HTMLImageElement)) {
                    console.warn('⚠️ RBImageErrorHandler: Invalid image element', img);
                    return;
                }
                
                // Safely hide the image
                img.style.display = 'none';
                
                // Add fallback class to parent container if it exists
                if (img.parentElement) {
                    img.parentElement.classList.add('fallback');
                    
                    // Show fallback text if it exists
                    const fallbackText = img.parentElement.querySelector('.cover-fallback-text, .profile-avatar-fallback, .user-avatar-fallback');
                    if (fallbackText) {
                        fallbackText.style.display = 'flex';
                    }
                }
                
                console.log('🖼️ Image load failed, fallback applied:', img.src);
            } catch (e) {
                // Catch any errors to prevent them from bubbling up
                console.warn('⚠️ RBImageErrorHandler: Error handling image failure:', e);
            }
        };
        
        console.log('✅ Global image error handler initialized: window.RBImageErrorHandler');
    }

    persistTelegramAuth() {
        try {
            const tg = window.Telegram?.WebApp;
            if (tg?.initData) {
                localStorage.setItem('reader-telegram-initdata', tg.initData);
            }
            const uid = tg?.initDataUnsafe?.user?.id;
            if (uid) {
                localStorage.setItem('reader-user-id', String(uid));
            }
        } catch (e) {
            console.warn('persistTelegramAuth failed:', e);
        }
    }

    /**
     * 📏 Apply saved font size preference before first paint
     * This prevents FOUC (Flash of Unstyled Content) by applying
     * the user's font size preference immediately during initialization.
     */
    applyFontSizePreference() {
        try {
            const savedFontSize = localStorage.getItem('reader-font-size') || 'medium';
            const validSizes = ['small', 'medium', 'large'];
            const fontSize = validSizes.includes(savedFontSize) ? savedFontSize : 'medium';
            
            // Remove any existing font size classes
            document.body.classList.remove('font-small', 'font-medium', 'font-large');
            // Apply the saved font size class
            document.body.classList.add(`font-${fontSize}`);
            
            console.log(`📏 Font size preference applied: ${fontSize}`);
        } catch (e) {
            console.warn('⚠️ Failed to apply font size preference:', e);
            document.body.classList.add('font-medium'); // Fallback to medium
        }
    }    
    
    /**
     * 🔗 NEW: Extract and store deeplink parameter from Telegram
     * Called early in init to capture startapp before any navigation
     */
    extractDeeplink() {
        try {
            const tg = window.Telegram?.WebApp;
            const startParam = tg?.initDataUnsafe?.start_param;
            
            if (startParam) {
                console.log('🔗 Deeplink detected:', startParam);
                this._pendingDeeplink = startParam;
                return startParam;
            }
        } catch (e) {
            console.warn('⚠️ Error extracting deeplink:', e);
        }
        return null;
    }

    /**
     * 🔗 NEW: Convert deeplink parameter to route
     * Maps startapp values to internal routes
     * @param {string} deeplink - The startapp parameter value
     * @returns {string|null} - Route to navigate to, or null if invalid
     */
    deeplinkToRoute(deeplink) {
        if (!deeplink) return null;
        
        // Map of supported deeplinks to routes
        const deeplinkMap = {
            'reports': '/reports',
            'reports/weekly': '/reports',      // Reports page with weekly tab
            'reports/monthly': '/reports',     // Reports page with monthly tab
            'diary': '/diary',
            'catalog': '/catalog',
            'community': '/community',
            'achievements': '/achievements',
            'settings': '/settings',
            'help': '/help',
            'about': '/about',
            'home': '/home'
        };
        
        // Check for exact match
        if (deeplinkMap[deeplink]) {
            console.log(`🔗 Deeplink "${deeplink}" → route "${deeplinkMap[deeplink]}"`);
            return deeplinkMap[deeplink];
        }
        
        // Check for prefix match (e.g., "report_123" → /reports)
        if (deeplink.startsWith('report')) {
            return '/reports';
        }
        
        console.warn(`⚠️ Unknown deeplink: ${deeplink}`);
        return null;
    }

    /**
     * 🔗 NEW: Handle pending deeplink after initialization
     * Called after router is ready and onboarding is complete
     */
    handlePendingDeeplink() {
        if (!this._pendingDeeplink) return;
        
        const route = this.deeplinkToRoute(this._pendingDeeplink);
        if (route && this.router?.navigate) {
            console.log(`🔗 Navigating to deeplink route: ${route}`);
            // Small delay to ensure UI is ready
            setTimeout(() => {
                this.router.navigate(route);
            }, 100);
        }
        
        // Clear pending deeplink
        this._pendingDeeplink = null;
    }
    
    async init() {
        try {
            console.log('🔄 Reader App: Начало инициализации');
            this.persistTelegramAuth();
            this.extractDeeplink(); // NEW: Extract deeplink early
            this.applyFontSizePreference();
            this.showLoadingScreen();
            await this.initializeServices();
            await this.initializeTelegram();
            await this.authenticateUser();
            
            // Warmup statistics before UI to have instant data available
            if (this.statistics?.warmupInitialStats) {
                await this.statistics.warmupInitialStats();
            }
            
            await this.loadUserData();
            await this.initializeUI();
            await this.initializeRouting();
            await this.finalizeInitialization();
            console.log('✅ Reader App: Инициализация завершена успешно');
        } catch (error) {
            console.error('❌ Reader App: Ошибка инициализации:', error);
            this.showErrorMessage(error.message);
        }
    }

   async initializeServices() {
        console.log('🔄 Инициализация сервисов...');
        this.state = new AppState();
        await this.state.init();
        this.api = new ApiService();
        
        // StatisticsService (Iteration 1)
        if (typeof window.StatisticsService !== 'undefined') {
            this.statistics = new window.StatisticsService({ api: this.api, state: this.state });
            window.statisticsService = this.statistics;
            console.log('📊 StatisticsService initialized');
        } else {
            console.warn('⚠️ StatisticsService script not loaded');
        }
        
        // === PARSE INITIAL QUERY PARAMETERS ===
        // Parse query parameters from hash for catalog highlighting etc.
        this.initialState = { query: {} };
        try {
            const rawHash = window.location.hash.slice(1) || '';
            const queryIndex = rawHash.indexOf('?');
            if (queryIndex !== -1) {
                const queryString = rawHash.substring(queryIndex + 1);
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
                this.initialState.query = query;
                console.log('🔍 Parsed initial query parameters:', query);
            }
        } catch (e) {
            console.warn('⚠️ Error parsing initial query parameters:', e);
            this.initialState.query = {};
        }
        
        if (typeof TelegramService !== 'undefined') {
            this.telegram = new TelegramService();
        } else {
            console.warn('⚠️ TelegramService не найден, будет заглушка');
            this.telegram = null;
        }
        if (typeof AppRouter !== 'undefined') {
            this.router = new AppRouter({
                container: document.getElementById('page-content'),
                state: this.state,
                api: this.api,
                telegram: this.telegram,
                app: this
            });
        } else {
            console.warn('⚠️ AppRouter не найден');
            this.router = null;
        }
        // ========== ВОТ ЗДЕСЬ ДОЛЖНО БЫТЬ ==========
        if (typeof CatalogPage !== 'undefined') {
            this.catalogPage = new CatalogPage(this);
            if (typeof this.catalogPage.loadCatalogData === 'function') {
                this.catalogPage.loadCatalogData().catch(console.error);
                console.log('📚 Каталог книг загружается при старте приложения');
            }
        }
        // ===========================================
        console.log('✅ Сервисы инициализированы');
    }

    async initializeTelegram() {
        console.log('🔄 Инициализация Telegram...');
        if (!window.Telegram?.WebApp) {
            console.warn('⚠️ Telegram Web App недоступен, debug режим');
            this.state.set('debugMode', true);
            return;
        }
        try {
            if (this.telegram?.init) {
                await this.telegram.init();
                this.telegram.expand();
                this.telegram.ready();
            }
            this.applyTelegramTheme();
            console.log('✅ Telegram инициализирован');
        } catch (e) {
            console.warn('⚠️ Ошибка Telegram init, debug режим:', e);
            this.state.set('debugMode', true);
        }
    }

    async authenticateUser() {
        console.log('🔄 Аутентификация пользователя...');
        try {
            if (this.state.get('debugMode')) {
                console.log('🧪 Debug режим: создаем тестового пользователя');
                await this.createDebugUser();
                return;
            }
            let telegramUser = null;
            let initData = '';
            if (this.telegram?.getUserWithRetry) {
                try {
                    telegramUser = await this.telegram.getUserWithRetry(5, 1000);
                    initData = this.telegram.getInitData();
                } catch (e) {
                    console.warn('⚠️ retry getUser ошибка:', e);
                }
            } else if (this.telegram?.getUser) {
                telegramUser = this.telegram.getUser();
                initData = this.telegram.getInitData();
            }
            if (!telegramUser || !telegramUser.id || telegramUser.is_debug) {
                const dev = this.isEnvironmentDevelopment();
                if (dev) {
                    this.state.set('debugMode', true);
                    await this.createDebugUser();
                    return;
                } else {
                    throw new Error('Нет Telegram user (production)');
                }
            }
            console.log('📊 Отправляем данные Telegram на backend:', {
                userId: telegramUser.id,
                firstName: telegramUser.first_name,
                username: telegramUser.username
            });

            const initOk = this.state.initializeWithTelegramUser(telegramUser);
            if (!initOk) throw new Error('State init with telegram fail');

            const authResponse = await this.api.authenticateWithTelegram(initData, telegramUser);
            if (!authResponse?.success) throw new Error('Backend не подтвердил аутентификацию');

            console.log('✅ Аутентификация успешна');

            const firstName = authResponse.user.firstName || telegramUser.first_name || '';
            const lastName = authResponse.user.lastName || telegramUser.last_name || '';
            const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName);
            const name = fullName || authResponse.user.username || telegramUser.username || 'Пользователь';

            this.state.update('user', {
                profile: {
                    ...authResponse.user,
                    id: telegramUser.id,
                    telegramId: telegramUser.id,
                    firstName,
                    lastName,
                    fullName,
                    name,
                    username: authResponse.user.username || telegramUser.username || '',
                    isOnboardingComplete: authResponse.user.isOnboardingComplete || authResponse.isOnboardingComplete || false
                },
                isAuthenticated: true
            });

            console.log('✅ Пользователь аутентифицирован:', {
                name: firstName,
                username: authResponse.user.username || telegramUser.username
            });

        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            if (this.isEnvironmentDevelopment()) {
                this.state.set('debugMode', true);
                await this.createDebugUser();
            } else {
                this.showCriticalError('Ошибка аутентификации',
                    `Не удалось войти: ${error.message}`);
                return;
            }
        }
    }

    async loadUserData() {
        console.log('🔄 Загрузка пользовательских данных...');
        if (this.state.get('debugMode')) {
            console.log('🧪 Debug режим: пропускаем загрузку данных с сервера');
            return;
        }
        try {
            let userId = null;
            try {
                userId = this.state.getCurrentUserId();
                if (!userId || userId === 'demo-user') {
                    console.log('⚠️ App: Нет валидного userId для загрузки');
                    return;
                }
            } catch {
                return;
            }
            console.log('📊 App: Загружаем данные для userId:', userId);
            const profile = await this.api.getProfile(userId);
            console.log('[DEBUG] Profile loaded:', profile);
            const stats = await this.api.getStats(userId);
            const recentQuotes = await this.api.getRecentQuotes(5, userId);

            const prevProfile = this.state.get('user.profile') || {};
            const newProfile = { ...prevProfile, ...profile.user };
            if (!newProfile.name) newProfile.name = prevProfile.name || 'Пользователь';
            console.log('[DEBUG] merge profile:', prevProfile, newProfile);
            this.state.update('user', { profile: newProfile });
            console.log('[DEBUG] state updated profile:', this.state.get('user.profile'));

            // Initialize baseline stats for baseline + deltas model
            const flatStats = {
                baselineTotal: stats.totalQuotes || 0,
                pendingAdds: 0,
                pendingDeletes: 0,
                totalQuotes: stats.totalQuotes || 0,
                currentStreak: stats.currentStreak || 0,
                longestStreak: stats.longestStreak || 0,
                weeklyQuotes: stats.weeklyQuotes || stats.thisWeek || 0,
                thisWeek: stats.thisWeek || stats.weeklyQuotes || 0, // Mirror for compatibility
                daysInApp: stats.daysSinceRegistration || stats.daysInApp || 0,
                loading: false,
                loadedAt: Date.now()
            };
            this.state.set('stats', flatStats);
            this.state.setRecentQuotes(recentQuotes.quotes || []);
            
            // Use statistics service for refreshing instead of direct API calls
            if (this.statistics) {
                await this.statistics.refreshMainStatsSilent();
                await this.statistics.refreshDiaryStatsSilent();
            }
            
            console.log('✅ Пользовательские данные загружены');
        } catch (e) {
            console.error('⚠️ Ошибка загрузки пользовательских данных:', e);
        }
    }

    async initializeUI() {
        console.log('🔄 Инициализация UI...');
        if (typeof BottomNavigation !== 'undefined') {
            const bottomNav = new BottomNavigation();
            bottomNav?.init?.();
        }
        this.topMenu = null;
        this.setupEventListeners();
        this.applyThemeStyles();
        
        // Инициализация View компонентов для цитат
        this.initializeQuoteViews();
        
        console.log('✅ UI инициализирован');
    }

    /**
     * Инициализация View для главной и «Моих цитат»
     */
    initializeQuoteViews() {
        try {
            // Импортируем модули динамически когда они доступны
            if (typeof window.HomeView !== 'undefined') {
                const homeRoot = document.body;
                if (document.getElementById('home-latest-quotes')) {
                    this.homeView = new window.HomeView(homeRoot);
                    this.homeView.mount();
                    console.log('✅ HomeView инициализирован');
                }
            }

            if (typeof window.MyQuotesView !== 'undefined') {
                const myQuotesRoot = document.querySelector('.my-quotes') || 
                                   document.querySelector('[data-tab-content="my-quotes"]') ||
                                   document.querySelector('#my-quotes-container');
                if (myQuotesRoot) {
                    this.myQuotesView = new window.MyQuotesView(myQuotesRoot);
                    this.myQuotesView.mount();
                    console.log('✅ MyQuotesView инициализирован');
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации Quote Views:', error);
        }
    }

    async initializeRouting() {
        console.log('🔄 Инициализация роутинга...');
        this.setupHashRouter();
        this.setupTelegramBackButton();

        // === ONBOARDING STABILITY START ===
        // Определяем стартовый маршрут ДО инициализации роутера
        // чтобы избежать гонки /home → /onboarding
        let initialRoute = '/home';
        let onboardingCheckCompleted = false;
        
        try {
            const profile = this.state.get('user.profile');
            let userId = null;
            
            try {
                userId = this.state.getCurrentUserId();
                if (!userId || userId === 'demo-user') {
                    console.log('⚠️ App: Нет валидного userId, fallback профиля');
                }
            } catch {}
            
            if (userId && userId !== 'demo-user') {
                console.log('🔍 Проверяем онбординг для userId:', userId);
                const onboardingStatus = await this.api.checkOnboardingStatus(userId);
                console.log('📊 Статус онбординга:', onboardingStatus);
                onboardingCheckCompleted = true;
                
                if (!onboardingStatus.isOnboardingComplete) {
                    initialRoute = '/onboarding';
                    this._onboardingGateApplied = true;
                    // Clear deeplink if onboarding not complete - user must complete onboarding first
                    this._pendingDeeplink = null;
                    console.log('🎯 STABILITY: API показал онбординг не завершен, стартуем с /onboarding');
                } else {
                    if (onboardingStatus.user) {
                        this.state.update('user.profile', {
                            ...onboardingStatus.user,
                            isOnboardingComplete: true
                        });
                    }
                    console.log('🏠 STABILITY: API показал онбординг завершен, можно /home');
                    
                    // === DEEPLINK ROUTING ===
                    // If we have a pending deeplink and onboarding is complete, use it as initial route
                    if (this._pendingDeeplink) {
                        const deeplinkRoute = this.deeplinkToRoute(this._pendingDeeplink);
                        if (deeplinkRoute) {
                            initialRoute = deeplinkRoute;
                            console.log(`🔗 Using deeplink as initial route: ${initialRoute}`);
                        }
                        // Clear pending deeplink since we're using it as initial route
                        this._pendingDeeplink = null;
                    }
                }
            } else {
                const isDebugMode = this.state.get('debugMode');
                if (!isDebugMode && !profile?.isOnboardingComplete) {
                    initialRoute = '/onboarding';
                    this._onboardingGateApplied = true;
                    this._pendingDeeplink = null; // Clear deeplink
                    console.log('🎯 STABILITY: Fallback - онбординг локально не завершен, стартуем с /onboarding');
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка проверки онбординга:', error);
            const isDebugMode = this.state.get('debugMode');
            const profile = this.state.get('user.profile');
            if (!isDebugMode && !profile?.isOnboardingComplete) {
                initialRoute = '/onboarding';
                this._onboardingGateApplied = true;
                this._pendingDeeplink = null; // Clear deeplink
                console.log('🎯 STABILITY: Ошибка API - fallback к /onboarding');
            }
        }
        // === ONBOARDING STABILITY END ===

        if (this.router?.init) {
            try {
                await this.router.init(initialRoute);
                console.log('✅ Роутинг инициализирован, стартовый маршрут:', initialRoute);

            } catch (error) {
                console.error('❌ Ошибка инициализации роутера:', error);
                this.showBasicContent();
            }
        } else {
            console.warn('⚠️ Router недоступен, fallback страница');
            this.showBasicContent();
        }
    }

    showBasicContent() {
        const mainContent = document.getElementById('page-content') || document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="welcome-screen">
                    <h1>📚 Reader Bot</h1>
                    <p>Добро пожаловать в ваш персональный дневник цитат!</p>
                    <div class="debug-info">
                        <p>🧪 Debug режим активен</p>
                        <p>Приложение работает в тестовом режиме</p>
                    </div>
                </div>
            `;
        }
    }

    async finalizeInitialization() {
        console.log('🔄 Финализация инициализации...');
        
        // ✅ Unified scroll architecture: #page-content is the single scroll container
        // - #page-content defined in index.html with flex: 1, overflow-y: auto
        // - body has overflow: hidden to prevent double scroll
        // - .content class is for padding only, not scroll management
        console.log('[scroll] ✅ Using unified #page-content scroll architecture');
        
        this.hideLoadingScreen();
        this.showApp();
        this.registerLifecycleHandlers();
        this.isInitialized = true;
        this.telegram?.ready?.();
        console.log('✅ Приложение полностью готово к работе');
    }

    setupHashRouter() {
        this.handleHashChange = this.handleHashChange.bind(this);
        window.addEventListener('hashchange', this.handleHashChange);
        console.log('✅ Hash router initialized');
    }

    normalizeRoute(route) {
        if (!route || typeof route !== 'string') return '/home';
        let normalized = route.replace(/^#+/, '');
        if (!normalized.startsWith('/')) normalized = '/' + normalized;
        if (normalized === '/' || normalized === '') normalized = '/home';
        return normalized;
    }

    setupTelegramBackButton() {
        if (!this.telegram || !window.Telegram?.WebApp?.BackButton) {
            console.warn('⚠️ Telegram BackButton not available');
            return;
        }
        window.Telegram.WebApp.BackButton.onClick(() => {
            this.handleBackButtonClick();
        });
        console.log('✅ Telegram BackButton initialized');
    }

    handleHashChange() {
        const rawHash = window.location.hash.slice(1) || '';
        const hash = this.normalizeRoute(rawHash);
        console.log('🧭 Hash changed to:', hash);

        // GUARD 1: Prevent navigation if router is already navigating
        if (this.router?.isNavigating) {
            console.log('⏭️ [NAV-GUARD] HashChange blocked: router.isNavigating=true');
            return;
        }

        // GUARD 2: Query-aware route key comparison
        // Build stable key including query params to prevent duplicate navigation
        // when only query params differ (e.g., /profile?user=123 vs /profile?user=456)
        if (this.router?._buildNavigationKey) {
            const path = this.router.normalizePath(rawHash);
            const query = this.router.parseQuery(rawHash);
            const currentKey = this.router._buildNavigationKey(this.router.currentRoute, this.router.currentQuery);
            const newKey = this.router._buildNavigationKey(path, query);
            
            if (currentKey === newKey) {
                console.log('⏭️ [NAV-GUARD] HashChange blocked: route key unchanged', newKey);
                return;
            }
        } else {
            // Fallback to simple path comparison if _buildNavigationKey not available
            if (this.router?.currentRoute && hash === this.router.currentRoute) {
                console.log('⏭️ [NAV-GUARD] HashChange blocked: already on route', hash);
                return;
            }
        }

        if (hash !== '/home' && this.topMenu) {
            console.log('🧹 Cleaning up TopMenu when leaving HomePage');
            this.topMenu.destroy();
            this.topMenu = null;
        }

        // Only navigate when hash differs from current route
        if (this.router?.navigate) {
            console.log('✅ [NAV-GUARD] Proceeding with navigation to', hash);
            // Use replace: true for hash-triggered navigation to avoid history pollution
            this.router.navigate(rawHash, { replace: true });
        }

        this.updateBackButtonVisibility(hash);
    }

    handleBackButtonClick() {
        console.log('⬅️ BackButton clicked');
        this.telegram?.hapticFeedback?.('light');
        this.navigate('/home');
    }

    navigate(route) {
        const normalizedRoute = this.normalizeRoute(route);
        if (this.router?.navigate) {
            this.router.navigate(normalizedRoute);
        } else {
            window.location.hash = normalizedRoute;
        }
    }

    isHome() {
        const rawHash = window.location.hash.slice(1) || '';
        const hash = this.normalizeRoute(rawHash);
        return hash === '/home';
    }

    updateBackButtonVisibility(route) {
        if (!window.Telegram?.WebApp?.BackButton) return;
        const normalizedRoute = this.normalizeRoute(route);
        if (['/home', '/', ''].includes(normalizedRoute)) {
            window.Telegram.WebApp.BackButton.hide();
        } else {
            window.Telegram.WebApp.BackButton.show();
        }
    }

    showTopMenu() {
        console.log('🔄 Показываем верхнее меню...');
        if (!this.isHome()) {
            console.warn('⚠️ TopMenu доступно только на главной странице');
            return;
        }
        if (!this.topMenu && typeof TopMenu !== 'undefined') {
            this.topMenu = new TopMenu({
                app: this,
                api: this.api,
                state: this.state,
                telegram: this.telegram
            });
            console.log('✅ TopMenu инициализирован для HomePage');
        }
        if (this.topMenu?.open) {
            this.topMenu.open();
            console.log('✅ Верхнее меню показано');
        } else {
            this.telegram?.showAlert?.('Меню пока не доступно');
        }
    }

    hideTopMenu() {
        this.topMenu?.close?.();
        console.log('✅ Верхнее меню скрыто');
    }

    toggleTopMenu() {
        if (!this.isHome()) {
            console.warn('⚠️ TopMenu доступно только на главной странице');
            return;
        }
        if (this.topMenu?.toggle) {
            this.topMenu.toggle();
        } else {
            this.showTopMenu();
        }
    }

    attachTopMenuToButton(buttonEl) {
        if (!this.isHome()) return;
        if (!this.topMenu && typeof TopMenu !== 'undefined') {
            this.topMenu = new TopMenu({
                app: this,
                api: this.api,
                state: this.state,
                telegram: this.telegram
            });
            console.log('✅ TopMenu инициализирован для кнопки');
        }
        this.topMenu?.attachToButton?.(buttonEl);
    }

    applyTelegramTheme() {
        if (!this.telegram) return;
        try {
            const theme = this.telegram.getThemeParams();
            document.body.setAttribute('data-theme', 'telegram');
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
            }
        } catch (e) {
            console.warn('⚠️ Ошибка применения темы Telegram:', e);
        }
    }

    applyThemeStyles() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-theme', isDark);
    }

    setupEventListeners() {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyThemeStyles());
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handleError);
    }

    registerLifecycleHandlers() {
        if (!this.telegram?.onClose) return;
        try {
            this.telegram.onClose(() => {
                console.log('📱 Приложение закрывается');
                this.cleanup();
            });
        } catch (e) {
            console.warn('⚠️ Ошибка регистрации onClose:', e);
        }
    }

    async createDebugUser() {
        const debugUserId = 12345 + Math.floor(Math.random() * 1000);
        const debugTelegramData = {
            id: debugUserId,
            first_name: 'Тестер Debug',
            last_name: 'Режим',
            username: `debug_user_${debugUserId}`,
            language_code: 'ru',
            is_premium: false,
            is_debug: true
        };
        try {
            console.log('🔐 Аутентификация debug пользователя...');
            const authResponse = await this.api.authenticateWithTelegram('debug_init_data', debugTelegramData);
            if (authResponse?.success) {
                this.state.update('user', {
                    profile: {
                        id: debugTelegramData.id,
                        firstName: authResponse.user.firstName || debugTelegramData.first_name,
                        lastName: authResponse.user.lastName || debugTelegramData.last_name,
                        username: authResponse.user.username || debugTelegramData.username,
                        telegramId: debugTelegramData.id,
                        isDebug: true,
                        isOnboardingComplete: authResponse.user.isOnboardingComplete || authResponse.isOnboardingComplete || false
                    },
                    isAuthenticated: true
                });
                console.log('✅ Debug пользователь аутентифицирован');
                return;
            }
        } catch (e) {
            console.warn('⚠️ Не удалось аутентифицировать debug пользователя через API:', e);
        }

        console.log('🧪 Создание локального debug пользователя');
        const initialized = this.state.initializeWithTelegramUser(debugTelegramData);
        if (initialized) {
            this.state.update('user.profile', {
                isDebug: true,
                isOnboardingComplete: false
            });
        } else {
            this.state.update('user', {
                profile: {
                    id: 12345,
                    telegramId: 12345,
                    firstName: 'Тестер Debug',
                    username: 'debug_user',
                    isDebug: true,
                    isOnboardingComplete: false
                },
                isAuthenticated: true
            });
        }
    }

    showLoadingScreen() {
        if (this.loadingScreen) this.loadingScreen.style.display = 'flex';
    }
    hideLoadingScreen() {
        if (this.loadingScreen) this.loadingScreen.style.display = 'none';
    }
    showApp() {
        if (this.appContainer) this.appContainer.style.display = 'block';
    }

    showErrorMessage(message) {
        const mainContent = document.getElementById('page-content') || document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-screen">
                    <h2>⚠️ Ошибка инициализации</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="retry-button">
                        🔄 Попробовать снова
                    </button>
                </div>
            `;
        }
        this.hideLoadingScreen();
        this.showApp();
    }

    handleVisibilityChange() {
        if (document.hidden) {
            console.log('📱 Приложение скрыто');
        } else {
            console.log('📱 Приложение показано');
            this.refreshData();
        }
    }

    async refreshData() {
        if (!this.isInitialized || this.state.get('debugMode')) return;
        try {
            const userId = this.state.getCurrentUserId();
            if (!userId || userId === 'demo-user') {
                console.log('⚠️ App: Нет валидного userId для обновления');
                return;
            }
            console.log('🔄 App: Обновляем данные через StatisticsService для userId:', userId);
            
            // Use statistics service for refreshing instead of direct API calls
            if (this.statistics) {
                await this.statistics.refreshMainStatsSilent();
                await this.statistics.refreshDiaryStatsSilent();
            } else {
                console.warn('⚠️ StatisticsService not available, falling back to direct API');
                const resp = await this.api.getStats(userId);
                
                // Update baseline but preserve deltas
                const currentStats = this.state.get('stats') || {};
                const flatStats = {
                    ...currentStats, // Preserve existing deltas
                    baselineTotal: resp?.stats?.totalQuotes || resp?.totalQuotes || 0,
                    currentStreak: resp?.stats?.currentStreak || resp?.currentStreak || 0,
                    longestStreak: resp?.stats?.longestStreak || resp?.longestStreak || 0,
                    weeklyQuotes: resp?.stats?.weeklyQuotes || resp?.stats?.thisWeek || resp?.weeklyQuotes || resp?.thisWeek || 0,
                    thisWeek: resp?.stats?.thisWeek || resp?.stats?.weeklyQuotes || resp?.thisWeek || resp?.weeklyQuotes || 0, // Mirror
                    daysInApp: resp?.stats?.daysSinceRegistration || resp?.stats?.daysInApp || resp?.daysSinceRegistration || resp?.daysInApp || 0,
                    loading: false,
                    loadedAt: Date.now()
                };
                
                // Calculate totalQuotes from baseline + deltas
                const baselineTotal = flatStats.baselineTotal || 0;
                const pendingAdds = flatStats.pendingAdds || 0;
                const pendingDeletes = flatStats.pendingDeletes || 0;
                flatStats.totalQuotes = baselineTotal + pendingAdds - pendingDeletes;
                
                this.state.set('stats', flatStats);
            }
        } catch (e) {
            console.warn('⚠️ Не удалось обновить данные:', e);
        }
    }

    handleError(error) {
        console.error('❌ Глобальная ошибка:', error);
        if (!this.state?.get('debugMode')) {
            if (window.showNotification) {
                window.showNotification('Произошла ошибка. Попробуйте обновить страницу.', 'error');
            }
        }
        if (this.api && this.isInitialized && !this.state?.get('debugMode')) {
            this.api.post('/errors', {
                message: error.message || 'Unknown error',
                stack: error.stack,
                timestamp: new Date().toISOString()
            }).catch(() => {});
        }
    }

    isEnvironmentDevelopment() {
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('dev') ||
            new URLSearchParams(window.location.search).get('debug') === 'true' ||
            !window.Telegram?.WebApp
        );
    }

    showCriticalError(title, message) {
        console.error('🚨 Критическая ошибка:', title, message);
        this.hideLoadingScreen();
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="critical-error">
                    <div class="error-icon">🚨</div>
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="retry-button">🔄 Перезапустить приложение</button>
                        <button onclick="window.open('https://t.me/annabusel_support', '_blank')" class="support-button">💬 Поддержка</button>
                    </div>
                </div>
            `;
        }
    }

    cleanup() {
        console.log('🧹 Очистка ресурсов приложения');
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handleError);
        if (this.router?.destroy) this.router.destroy();
        if (this.state?.cleanup) this.state.cleanup();
        this.isInitialized = false;
        console.log('✅ Очистка завершена');
    }

    /**
     * 🎭 Get or create ProfileModal singleton instance
     * Ensures only one ProfileModal exists across the app
     * @returns {ProfileModal} Singleton ProfileModal instance
     */
    getProfileModal() {
        try {
            if (this.profileModal && this.profileModal instanceof ProfileModal) {
                return this.profileModal;
            }
            const PMClass = window.ProfileModal || ProfileModal;
            this.profileModal = new PMClass(this);
            console.log('✅ ProfileModal singleton created');
            return this.profileModal;
        } catch (e) {
            console.warn('⚠️ getProfileModal failed:', e);
            return null;
        }
    }

    /**
     * 🧹 Cleanup all Telegram BackButton handlers
     * Removes all registered BackButton handlers from global registry
     */
    _cleanupBackButtonHandlers() {
        try {
            const tgBack = (this.telegram && this.telegram.BackButton) || (window.Telegram?.WebApp?.BackButton);
            const handlers = window.__PM_BACKBTN_HANDLERS;
            if (tgBack && handlers && handlers.size) {
                handlers.forEach(fn => {
                    try {
                        tgBack.offClick(fn);
                    } catch (_) {
                        // Ignore errors
                    }
                });
                handlers.clear();
                console.log('🧹 Telegram BackButton handlers cleared');
            }
        } catch (e) {
            console.warn('⚠️ BackButton cleanup failed:', e);
        }
    }

    /**
     * 🚪 Close all active modals
     * Called before navigation to prevent modals from hanging over new pages
     */
    closeActiveModals() {
        console.log('🚪 Closing all active modals');
        
        // Close ProfileModal singleton if it exists and is open
        if (this.profileModal?.isOpen) {
            this.profileModal.close({ force: true });
            console.log('✅ ProfileModal closed');
        }
        
        // Fallback: Close ProfileModal from CommunityPage if it exists
        if (window.communityPage?.profileModal?.isOpen) {
            window.communityPage.profileModal.close({ force: true });
            console.log('✅ CommunityPage ProfileModal closed');
        }
        
        // Close any other global modals from state/ui if they exist
        // This is extensible for future modals
        if (this.state?.get('ui.activeModal')) {
            this.state.set('ui.activeModal', null);
        }
        
        // Cleanup all BackButton handlers
        this._cleanupBackButtonHandlers();
    }

    /**
     * 🖼️ PATCH: Resolve avatar URL with fallback priority
     * Returns custom avatarUrl -> Telegram photo_url -> null
     */
    resolveAvatar() {
        const profile = this.state?.get('user.profile');
        const avatarUrl = profile?.avatarUrl;
        
        if (avatarUrl) {
            return avatarUrl;
        }
        
        const telegramUser = this.telegram?.getUser();
        const telegramPhotoUrl = telegramUser?.photo_url;
        
        return telegramPhotoUrl || null;
    }

    /**
     * 🔄 PATCH: Placeholder for future backend auto-import of Telegram avatar
     * Not invoked automatically yet - reserved for future backend integration
     */
    async ensureImportedAvatar() {
        // Placeholder for future backend call to import Telegram avatar
        // Example:
        // const profile = this.state?.get('user.profile');
        // if (!profile?.avatarUrl) {
        //     const userId = this.state.getCurrentUserId();
        //     await this.api.importTelegramAvatar(userId);
        // }
        console.log('🔄 ensureImportedAvatar: Placeholder for future backend integration');
    }
}
window.ReaderApp = ReaderApp;
