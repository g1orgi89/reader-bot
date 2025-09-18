/**
 * 🚀 ГЛАВНЫЙ КЛАСС ПРИЛОЖЕНИЯ READER BOT
 * (оптимизирован: устранение двойной навигации / flicker при старте)
 * @version 1.0.8
 */
class ReaderApp {
    constructor() {
        console.log('🚀 Reader App: Инициализация начата - VERSION 1.0.8');
        this.router = null;
        this.state = null;
        this.telegram = null;
        this.api = null;
        this.isInitialized = false;
        this.appContainer = document.getElementById('app');
        this.loadingScreen = document.getElementById('loading-screen');
        this.topMenu = null;
        
        // === ONBOARDING STABILITY START ===
        // Флаг для предотвращения множественных navigate('/onboarding')
        this._onboardingGateApplied = false;
        // === ONBOARDING STABILITY END ===

        if (!this.appContainer || !this.loadingScreen) {
            throw new Error('❌ Критические элементы DOM не найдены');
        }

        this.handleError = this.handleError.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        console.log('✅ Reader App: Конструктор завершен - ИСПРАВЛЕНА ПЕРЕДАЧА APP В ROUTER!');
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
    
    async init() {
        try {
            console.log('🔄 Reader App: Начало инициализации');
            this.persistTelegramAuth();
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

            // Store stats as flat fields with proper weeklyQuotes/thisWeek mirroring
            const flatStats = {
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
                    console.log('🎯 STABILITY: API показал онбординг не завершен, стартуем с /onboarding');
                } else {
                    if (onboardingStatus.user) {
                        this.state.update('user.profile', {
                            ...onboardingStatus.user,
                            isOnboardingComplete: true
                        });
                    }
                    console.log('🏠 STABILITY: API показал онбординг завершен, можно /home');
                }
            } else {
                const isDebugMode = this.state.get('debugMode');
                if (!isDebugMode && !profile?.isOnboardingComplete) {
                    initialRoute = '/onboarding';
                    this._onboardingGateApplied = true;
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

        if (this.router?.isNavigating) {
            console.log('⏭️ HashChange пропущен (router.isNavigating=true)');
            return;
        }

        if (hash !== '/home' && this.topMenu) {
            console.log('🧹 Cleaning up TopMenu when leaving HomePage');
            this.topMenu.destroy();
            this.topMenu = null;
        }

        if (this.router?.navigate) {
            this.router.navigate(hash);
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
            console.log('🔄 App: Обновляем данные для userId:', userId);
            const resp = await this.api.getStats(userId);
            
            // Store only flat fields from resp.stats with proper mirroring
            const flatStats = {
                totalQuotes: resp?.stats?.totalQuotes || resp?.totalQuotes || 0,
                currentStreak: resp?.stats?.currentStreak || resp?.currentStreak || 0,
                longestStreak: resp?.stats?.longestStreak || resp?.longestStreak || 0,
                weeklyQuotes: resp?.stats?.weeklyQuotes || resp?.stats?.thisWeek || resp?.weeklyQuotes || resp?.thisWeek || 0,
                thisWeek: resp?.stats?.thisWeek || resp?.stats?.weeklyQuotes || resp?.thisWeek || resp?.weeklyQuotes || 0, // Mirror
                daysInApp: resp?.stats?.daysSinceRegistration || resp?.stats?.daysInApp || resp?.daysSinceRegistration || resp?.daysInApp || 0,
                loading: false,
                loadedAt: Date.now()
            };
            this.state.set('stats', flatStats);
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
}
window.ReaderApp = ReaderApp;
