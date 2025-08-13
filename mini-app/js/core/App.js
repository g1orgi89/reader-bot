/**
 * 🚀 ГЛАВНЫЙ КЛАСС ПРИЛОЖЕНИЯ READER BOT
 * 
 * Управляет жизненным циклом Telegram Mini App
 * Инициализация, роутинг, состояние, интеграция с Telegram
 * 
 * @filesize 3 KB - главный класс приложения
 * @author Claude Assistant
 * @version 1.0.7 - ИСПРАВЛЕНА ПЕРЕДАЧА APP В ROUTER
 */

/**
 * @typedef {Object} AppConfig
 * @property {string} apiBaseUrl - Базовый URL API
 * @property {boolean} debugMode - Режим отладки
 * @property {string} version - Версия приложения
 */

/**
 * @typedef {Object} UserData
 * @property {number} id - Telegram ID пользователя
 * @property {string} firstName - Имя пользователя
 * @property {string} username - Username пользователя
 * @property {boolean} isCompleted - Прошел ли онбординг
 */

/**
 * 🏗️ Главный класс приложения Reader Bot
 * Управляет инициализацией, состоянием и жизненным циклом приложения
 * ИСПРАВЛЕНО: Передача ссылки на App в Router для корректной работы showTopMenu
 */
class ReaderApp {
    /**
     * 🏗️ Конструктор приложения
     */
    constructor() {
        console.log('🚀 Reader App: Инициализация начата - VERSION 1.0.7');
        
        // Инициализация свойств класса
        this.router = null;
        this.state = null;
        this.telegram = null;
        this.api = null;
        this.isInitialized = false;
        this.appContainer = null;
        this.loadingScreen = null;
        this.topMenu = null;
        
        // Получаем основные элементы DOM
        this.appContainer = document.getElementById('app');
        this.loadingScreen = document.getElementById('loading-screen');
        
        // Проверяем доступность элементов
        if (!this.appContainer || !this.loadingScreen) {
            throw new Error('❌ Критические элементы DOM не найдены');
        }

        // Привязываем методы к контексту
        this.handleError = this.handleError.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        console.log('✅ Reader App: Конструктор завершен - ИСПРАВЛЕНА ПЕРЕДАЧА APP В ROUTER!');
    }

    /**
     * 🚀 Главный метод инициализации приложения
     * Вызывается после загрузки DOM
     */
    async init() {
        try {
            console.log('🔄 Reader App: Начало инициализации');
            
            // Показываем экран загрузки
            this.showLoadingScreen();
            
            // Этап 1: Инициализация сервисов
            await this.initializeServices();
            
            // Этап 2: Проверка Telegram окружения
            await this.initializeTelegram();
            
            // Этап 3: Аутентификация пользователя
            await this.authenticateUser();
            
            // Этап 4: Загрузка пользовательских данных
            await this.loadUserData();
            
            // Этап 5: Инициализация UI
            await this.initializeUI();
            
            // Этап 6: Настройка роутинга
            await this.initializeRouting();
            
            // Этап 7: Финальная настройка
            await this.finalizeInitialization();
            
            console.log('✅ Reader App: Инициализация завершена успешно');
            
        } catch (error) {
            console.error('❌ Reader App: Ошибка инициализации:', error);
            this.showErrorMessage(error.message);
        }
    }

    /**
     * 🔧 Инициализация всех сервисов приложения
     */
    async initializeServices() {
        console.log('🔄 Инициализация сервисов...');
        
        // Создаем состояние приложения
        this.state = new AppState();
        await this.state.init();
        
        // Создаем API сервис
        this.api = new ApiService();
        
        // Создаем Telegram сервис
        if (typeof TelegramService !== 'undefined') {
            this.telegram = new TelegramService();
        } else {
            console.warn('⚠️ TelegramService не найден, будет создан заглушка');
            this.telegram = null;
        }
        
        // ИСПРАВЛЕНО: Создаем роутер с передачей ссылки на App
        if (typeof AppRouter !== 'undefined') {
            this.router = new AppRouter({
                container: document.getElementById('page-content'),
                state: this.state,
                api: this.api,
                telegram: this.telegram,
                app: this // ИСПРАВЛЕНИЕ: Передаем ссылку на себя
            });
        } else {
            console.warn('⚠️ AppRouter не найден');
            this.router = null;
        }
        
        console.log('✅ Сервисы инициализированы');
    }

    /**
     * 📱 Инициализация Telegram Web App
     */
    async initializeTelegram() {
        console.log('🔄 Инициализация Telegram...');
        
        if (!window.Telegram?.WebApp) {
            console.warn('⚠️ Telegram Web App недоступен, запуск в debug режиме');
            this.state.set('debugMode', true);
            return;
        }
        
        try {
            if (this.telegram && typeof this.telegram.init === 'function') {
                await this.telegram.init();
                
                // Настраиваем Telegram интерфейс
                this.telegram.expand();
                this.telegram.ready();
            } else {
                console.warn('⚠️ Telegram сервис недоступен');
            }
            
            // Применяем тему Telegram
            this.applyTelegramTheme();
            
            console.log('✅ Telegram инициализирован');
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации Telegram, переход в debug режим:', error);
            this.state.set('debugMode', true);
        }
    }

    /**
     * 🔐 Аутентификация пользователя через Telegram
     */
    async authenticateUser() {
        console.log('🔄 Аутентификация пользователя...');
        
        try {
            const isDebugMode = this.state.get('debugMode');
            
            if (isDebugMode) {
                console.log('🧪 Debug режим активен, создаем тестового пользователя');
                await this.createDebugUser();
                return;
            }
            
            let telegramUser = null;
            let initData = '';
            
            if (this.telegram && typeof this.telegram.getUserWithRetry === 'function') {
                console.log('🔄 Получаем данные пользователя с retry логикой...');
                
                try {
                    telegramUser = await this.telegram.getUserWithRetry(5, 1000);
                    initData = this.telegram.getInitData();
                } catch (error) {
                    console.warn('⚠️ Ошибка при получении пользователя через retry:', error);
                }
            } else if (this.telegram && typeof this.telegram.getUser === 'function') {
                telegramUser = this.telegram.getUser();
                initData = this.telegram.getInitData();
            }
            
            if (!telegramUser || !telegramUser.id || telegramUser.is_debug) {
                console.warn('⚠️ Данные пользователя Telegram недоступны или это debug пользователь');
                
                const isDevelopment = this.isEnvironmentDevelopment();
                
                if (window.Telegram?.WebApp && isDevelopment) {
                    console.log('🧪 Development режим: переходим в debug режим для тестирования.');
                    this.state.set('debugMode', true);
                    await this.createDebugUser();
                    return;
                } else if (!window.Telegram?.WebApp && isDevelopment) {
                    console.log('🧪 Development режим: Telegram WebApp недоступен, переходим в debug режим');
                    this.state.set('debugMode', true);
                    await this.createDebugUser();
                    return;
                } else {
                    throw new Error('Данные пользователя Telegram недоступны. Перезапустите приложение в Telegram.');
                }
            }
            
            console.log('📊 Отправляем данные Telegram на backend для аутентификации:', {
                userId: telegramUser.id,
                firstName: telegramUser.first_name,
                username: telegramUser.username
            });
            
            const stateInitialized = this.state.initializeWithTelegramUser(telegramUser);
            if (!stateInitialized) {
                throw new Error('Не удалось инициализировать состояние с данными Telegram');
            }
            
            const authResponse = await this.api.authenticateWithTelegram(initData, telegramUser);
            
            if (!authResponse || !authResponse.success) {
                throw new Error('Backend не подтвердил аутентификацию');
            }
            
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
                    name, // <-- добавь это поле!
                    username: authResponse.user.username || telegramUser.username || '',
                    isOnboardingCompleted: authResponse.isOnboardingCompleted || false
                },
                isAuthenticated: true
            });
            
            console.log('✅ Пользователь аутентифицирован:', {
                name: authResponse.user.firstName || telegramUser.first_name,
                username: authResponse.user.username || telegramUser.username
            });
            
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            
            const isDevelopment = this.isEnvironmentDevelopment();
            
            if (isDevelopment) {
                console.log('🧪 Development режим: ошибка аутентификации, переходим в debug режим');
                this.state.set('debugMode', true);
                await this.createDebugUser();
                this.showErrorMessage(`Development режим: Ошибка аутентификации (${error.message}). Приложение работает в режиме тестирования.`);
            } else {
                console.error('🚨 Production режим: критическая ошибка аутентификации:', error);
                this.showCriticalError('Ошибка аутентификации', 
                    `Не удалось войти в систему: ${error.message}). Попробуйте перезапустить приложение или обратитесь в поддержку.`);
                return;
            }
        }
    }

    /**
     * 📊 Загрузка пользовательских данных
     */
    async loadUserData() {
        console.log('🔄 Загрузка пользовательских данных...');
        
        const isDebugMode = this.state.get('debugMode');
        
        // В debug режиме не загружаем данные с сервера
        if (isDebugMode) {
            console.log('🧪 Debug режим: пропускаем загрузку данных с сервера');
            return;
        }
        
        try {
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId для загрузки данных
            let userId = null;
            try {
                userId = this.state.getCurrentUserId();
                if (!userId || userId === 'demo-user') {
                    console.log('⚠️ App: Нет валидного userId для загрузки данных');
                    return; // Не загружаем данные без валидного userId
                }
            } catch (error) {
                console.log('⚠️ App: Не удалось получить userId из состояния:', error);
                return;
            }
            
            console.log('📊 App: Загружаем данные для userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Явно передаем userId во все API вызовы
            // Загружаем профиль пользователя
            const profile = await this.api.getProfile(userId);
            console.log('[DEBUG] App.js loadUserData: Profile loaded from backend:', profile);
            
            // Загружаем статистику
            const stats = await this.api.getStats(userId);
            
            // Загружаем последние цитаты
            const recentQuotes = await this.api.getRecentQuotes(5, userId);
            
            // Обновляем состояние
            const prevProfile = this.state.get('user.profile') || {};
            const newProfile = { ...prevProfile, ...profile.user };
            if (!newProfile.name) {
            newProfile.name = prevProfile.name || 'Пользователь';
            }
            console.log('[DEBUG] App.js loadUserData: Profile merged - prevProfile:', prevProfile, 'newProfile:', newProfile);
            this.state.update('user', { profile: newProfile });
            console.log('[DEBUG] App.js loadUserData: State updated with profile:', this.state.get('user.profile'));
            
            this.state.setStats(stats);
            this.state.setRecentQuotes(recentQuotes.quotes || []);
            
            console.log('✅ Пользовательские данные загружены');
            
        } catch (error) {
            console.error('⚠️ Ошибка загрузки данных пользователя:', error);
            // Продолжаем работу с базовыми данными
        }
    }

    /**
     * 🎨 Инициализация пользовательского интерфейса
     */
    async initializeUI() {
        console.log('🔄 Инициализация UI...');
        
        // Инициализация нижней навигации
        if (typeof BottomNavigation !== 'undefined') {
            const bottomNav = new BottomNavigation();
            if (typeof bottomNav.init === 'function') {
                bottomNav.init();
            }
        } else {
            console.warn('⚠️ BottomNavigation класс не найден');
        }
        
        // Инициализация верхнего меню
        if (typeof TopMenu !== 'undefined') {
            this.topMenu = new TopMenu({
                app: this,
                api: this.api,
                state: this.state,
                telegram: this.telegram
            });
            console.log('✅ TopMenu инициализирован с drawer pattern');
        } else {
            console.warn('⚠️ TopMenu класс не найден');
        }
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Применяем стили в зависимости от темы
        this.applyThemeStyles();
        
        console.log('✅ UI инициализирован');
    }

    /**
     * 🧭 Инициализация роутинга
     */
    async initializeRouting() {
        console.log('🔄 Инициализация роутинга...');
        
        // Определяем начальную страницу
        const profile = this.state.get('user.profile');
        let initialRoute = '/home';
        
        try {
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId для проверки онбординга
            const profile = this.state.get('user.profile');
            let userId = null;
            
            // Пытаемся получить userId, но не блокируем если его нет
            try {
                userId = this.state.getCurrentUserId();
                if (!userId || userId === 'demo-user') {
                    console.log('⚠️ App: Нет валидного userId, используем состояние профиля');
                }
            } catch (error) {
                console.log('⚠️ App: Не удалось получить userId из состояния:', error);
            }
            
            // Если есть валидный userId, проверяем через API
            if (userId && userId !== 'demo-user') {
                console.log('🔍 Используем userId для проверки онбординга:', userId);
                
                // Проверяем статус онбординга через API
                const onboardingStatus = await this.api.checkOnboardingStatus(userId);
                console.log('📊 Статус онбординга от API:', onboardingStatus);
                
                // Если онбординг не завершен - показываем онбординг
                if (!onboardingStatus.completed) {
                    initialRoute = '/onboarding';
                    console.log('🎯 API: Перенаправляем на онбординг');
                } else {
                    // Обновляем состояние пользователя с данными от API
                    if (onboardingStatus.user) {
                        this.state.update('user.profile', {
                            ...onboardingStatus.user,
                            isOnboardingCompleted: true
                        });
                    }
                    console.log('🏠 API: Перенаправляем на главную страницу');
                }
            } else {
                // Fallback: используем локальную проверку только в debug режиме
                const isDebugMode = this.state.get('debugMode');
                if (isDebugMode && profile?.isOnboardingCompleted) {
                    console.log('🏠 Debug Fallback: Пользователь завершил онбординг локально');
                } else if (!profile?.isOnboardingCompleted) {
                    initialRoute = '/onboarding';
                    console.log('🎯 Fallback: Перенаправляем на онбординг');
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка проверки статуса онбординга через API:', error);
            // Fallback: используем локальную проверку только в debug режиме
            const isDebugMode = this.state.get('debugMode');
            if (isDebugMode && profile?.isOnboardingCompleted) {
                console.log('🏠 Debug Fallback: Пользователь завершил онбординг локально');
            } else if (!profile?.isOnboardingCompleted) {
                initialRoute = '/onboarding';
                console.log('🎯 Fallback: Перенаправляем на онбординг');
            }
        }
        
        // Устанавливаем нужный hash ПЕРЕД инициализацией роутера
        window.location.hash = initialRoute;
        
        if (this.router && typeof this.router.init === 'function') {
            try {
                await this.router.init();
                console.log('✅ Роутинг инициализирован, начальная страница:', initialRoute);
            } catch (error) {
                console.error('❌ Ошибка инициализации роутера:', error);
                this.showBasicContent();
            }
        } else {
            console.warn('⚠️ Router недоступен, показываем базовую страницу');
            this.showBasicContent();
        }
    }

    /**
     * 📄 Показать базовое содержимое (fallback)
     */
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

    /**
     * 🏁 Финальная настройка приложения
     */
    async finalizeInitialization() {
        console.log('🔄 Финализация инициализации...');
        
        // Скрываем экран загрузки
        this.hideLoadingScreen();
        
        // Показываем основное приложение
        this.showApp();
        
        // Регистрируем обработчики жизненного цикла
        this.registerLifecycleHandlers();
        
        // Отмечаем приложение как инициализированное
        this.isInitialized = true;
        
        // Уведомляем Telegram о готовности
        if (this.telegram && typeof this.telegram.ready === 'function') {
            this.telegram.ready();
        }
        
        console.log('✅ Приложение полностью готово к работе');
    }

    // ===========================================
    // 🔧 UI МЕТОДЫ
    // ===========================================

    /**
     * 📋 Показать верхнее меню
     */
    showTopMenu() {
        console.log('🔄 Показываем верхнее меню...');
        
        if (this.topMenu && typeof this.topMenu.open === 'function') {
            this.topMenu.open();
            console.log('✅ Верхнее меню показано');
        } else {
            console.warn('⚠️ TopMenu не инициализирован или не имеет метода open()');
            
            // Fallback: простое уведомление
            if (this.telegram && typeof this.telegram.showAlert === 'function') {
                this.telegram.showAlert('Меню пока не доступно');
            } else {
                console.log('Меню пока не доступно');
            }
        }
    }

    /**
     * 📋 Скрыть верхнее меню
     */
    hideTopMenu() {
        if (this.topMenu && typeof this.topMenu.close === 'function') {
            this.topMenu.close();
            console.log('✅ Верхнее меню скрыто');
        }
    }

    /**
     * 🔄 Переключить состояние верхнего меню
     */
    toggleTopMenu() {
        if (this.topMenu && typeof this.topMenu.toggle === 'function') {
            this.topMenu.toggle();
        } else {
            // Если нет метода toggle, используем open
            this.showTopMenu();
        }
    }

    /**
     * 🔧 Привязать верхнее меню к кнопке
     * @param {HTMLElement} buttonEl - Кнопка для привязки
     */
    attachTopMenuToButton(buttonEl) {
        if (this.topMenu && typeof this.topMenu.attachToButton === 'function') {
            this.topMenu.attachToButton(buttonEl);
        }
    }

    /**
     * 📱 Применение темы Telegram к приложению
     */
    applyTelegramTheme() {
        if (!this.telegram) return;
        
        try {
            const theme = this.telegram.getThemeParams();
            document.body.setAttribute('data-theme', 'telegram');
            
            // Применяем цвета темы через CSS переменные
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
            }
        } catch (error) {
            console.warn('⚠️ Ошибка применения темы Telegram:', error);
        }
    }

    /**
     * 🎨 Применение стилей темы
     */
    applyThemeStyles() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-theme', isDark);
    }

    /**
     * 📡 Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка изменения видимости приложения
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Обработка изменения темы
        window.matchMedia('(prefers-color-scheme: dark)')
              .addEventListener('change', () => this.applyThemeStyles());
        
        // Глобальный обработчик ошибок
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handleError);
    }

    /**
     * 🔄 Регистрация обработчиков жизненного цикла
     */
    registerLifecycleHandlers() {
        if (!this.telegram || typeof this.telegram.onClose !== 'function') return;
        
        try {
            // Обработка закрытия приложения
            this.telegram.onClose(() => {
                console.log('📱 Приложение закрывается');
                this.cleanup();
            });
        } catch (error) {
            console.warn('⚠️ Ошибка регистрации обработчиков Telegram:', error);
        }
    }

    /**
     * 🧪 Создание тестового пользователя для debug режима
     */
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
            // Пытаемся аутентифицировать debug пользователя
            console.log('🔐 Аутентификация debug пользователя...');
            
            const authResponse = await this.api.authenticateWithTelegram('debug_init_data', debugTelegramData);
            
            if (authResponse && authResponse.success) {
                console.log('✅ Debug пользователь аутентифицирован');
                
                // Инициализируем состояние с данными от сервера
                this.state.update('user', {
                    profile: {
                        id: debugTelegramData.id,
                        firstName: authResponse.user.firstName || debugTelegramData.first_name,
                        lastName: authResponse.user.lastName || debugTelegramData.last_name,
                        username: authResponse.user.username || debugTelegramData.username,
                        telegramId: debugTelegramData.id,
                        isDebug: true,
                        isOnboardingCompleted: authResponse.isOnboardingCompleted || false
                    },
                    isAuthenticated: true
                });
                
                console.log('🧪 Debug пользователь аутентифицирован:', {
                    name: authResponse.user.firstName,
                    username: authResponse.user.username
                });
                
                return;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось аутентифицировать debug пользователя через API:', error);
        }

        // Fallback: создаем локального debug пользователя
        console.log('🧪 Создание локального debug пользователя');
        
        const initialized = this.state.initializeWithTelegramUser(debugTelegramData);
        
        if (initialized) {
            this.state.update('user.profile', {
                isDebug: true,
                isOnboardingCompleted: false // ✅ ИСПРАВЛЕНО: Возвращаем правильное поведение
            });
            
            console.log('🧪 Создан локальный debug пользователь:', {
                name: debugTelegramData.first_name,
                username: debugTelegramData.username
            });
        } else {
            // Fallback на старый метод
            this.state.update('user', {
                profile: {
                    id: 12345,
                    telegramId: 12345, // ✅ ИСПРАВЛЕНО: Добавляем telegramId для совместимости
                    firstName: 'Тестер Debug',
                    username: 'debug_user',
                    isDebug: true,
                    isOnboardingCompleted: false // ✅ ИСПРАВЛЕНО: Возвращаем правильное поведение
                },
                isAuthenticated: true
            });
            console.log('🧪 Создан debug пользователь (fallback)');
        }
    }

    /**
     * 📺 Управление экраном загрузки
     */
    showLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
    }

    /**
     * 📱 Управление основным приложением
     */
    showApp() {
        if (this.appContainer) {
            this.appContainer.style.display = 'block';
        }
    }

    /**
     * ⚠️ Показать сообщение об ошибке
     */
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
        
        // Все равно показываем приложение
        this.hideLoadingScreen();
        this.showApp();
    }

    /**
     * 👁️ Обработчик изменения видимости приложения
     */
    handleVisibilityChange() {
        if (document.hidden) {
            console.log('📱 Приложение скрыто');
        } else {
            console.log('📱 Приложение показано');
            // Обновляем данные при возвращении в приложение
            this.refreshData();
        }
    }

    /**
     * 🔄 Обновление данных приложения
     */
    async refreshData() {
        if (!this.isInitialized || this.state.get('debugMode')) return;
        
        try {
            // ✅ ИСПРАВЛЕНО: Ждем валидный userId перед обновлением
            const userId = this.state.getCurrentUserId();
            
            if (!userId || userId === 'demo-user') {
                console.log('⚠️ App: Нет валидного userId для обновления данных');
                return;
            }
            
            console.log('🔄 App: Обновляем данные для userId:', userId);
            
            // ✅ ИСПРАВЛЕНО: Явно передаем userId в API вызов
            const stats = await this.api.getStats(userId);
            this.state.setStats(stats);
        } catch (error) {
            console.warn('⚠️ Не удалось обновить данные:', error);
        }
    }

    /**
     * ❌ Глобальный обработчик ошибок
     * @param {Error|Event} error - Ошибка для обработки
     */
    handleError(error) {
        console.error('❌ Глобальная ошибка:', error);
        
        // Не показываем уведомление в debug режиме
        if (!this.state?.get('debugMode')) {
            // Показываем пользователю уведомление об ошибке
            if (window.showNotification) {
                window.showNotification('Произошла ошибка. Попробуйте обновить страницу.', 'error');
            } else {
                console.warn('⚠️ Произошла ошибка. Попробуйте обновить страницу.');
            }
        }
        
        // Отправляем ошибку в аналитику (если доступна)
        if (this.api && this.isInitialized && !this.state?.get('debugMode')) {
            this.api.post('/errors', {
                message: error.message || 'Unknown error',
                stack: error.stack,
                timestamp: new Date().toISOString()
            }).catch(() => {
                // Игнорируем ошибки отправки ошибок
            });
        }
    }

    /**
     * 🌍 Определение окружения (development/production)
     */
    isEnvironmentDevelopment() {
        // Проверяем различные индикаторы development окружения
        return (
            // 1. Явная переменная окружения
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('dev') ||
            // 2. URL параметр для тестирования
            new URLSearchParams(window.location.search).get('debug') === 'true' ||
            // 3. Отсутствие Telegram WebApp (обычно указывает на разработку)
            !window.Telegram?.WebApp
        );
    }

    /**
     * 🚨 Показ критической ошибки (для production)
     */
    showCriticalError(title, message) {
        console.error('🚨 Критическая ошибка:', title, message);
        
        // Скрываем загрузочный экран
        this.hideLoadingScreen();
        
        // Показываем критическую ошибку
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div class="critical-error">
                    <div class="error-icon">🚨</div>
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="retry-button">
                            🔄 Перезапустить приложение
                        </button>
                        <button onclick="window.open('https://t.me/annabusel_support', '_blank')" class="support-button">
                            💬 Обратиться в поддержку
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 🧹 Очистка ресурсов при закрытии приложения
     */
    cleanup() {
        console.log('🧹 Очистка ресурсов приложения');
        
        // Удаляем обработчики событий
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handleError);
        
        // Очищаем роутер
        if (this.router && typeof this.router.destroy === 'function') {
            this.router.destroy();
        }
        
        // Очищаем состояние
        if (this.state && typeof this.state.cleanup === 'function') {
            this.state.cleanup();
        }
        
        this.isInitialized = false;
        console.log('✅ Очистка завершена');
    }
}

// Экспорт для использования в других модулях
window.ReaderApp = ReaderApp;
