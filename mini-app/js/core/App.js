/**
 * 🚀 ГЛАВНЫЙ КЛАСС ПРИЛОЖЕНИЯ READER BOT
 * 
 * Управляет жизненным циклом Telegram Mini App
 * Инициализация, роутинг, состояние, интеграция с Telegram
 * 
 * @filesize 3 KB - главный класс приложения
 * @author Claude Assistant
 * @version 1.0.0
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
 */
class ReaderApp {
    /**
     * @type {Router} - Экземпляр роутера
     */
    router = null;

    /**
     * @type {State} - Глобальное состояние приложения  
     */
    state = null;

    /**
     * @type {TelegramService} - Сервис Telegram интеграции
     */
    telegram = null;

    /**
     * @type {ApiService} - Сервис для работы с API
     */
    api = null;

    /**
     * @type {boolean} - Флаг инициализации приложения
     */
    isInitialized = false;

    /**
     * @type {HTMLElement} - Контейнер приложения
     */
    appContainer = null;

    /**
     * @type {HTMLElement} - Экран загрузки
     */
    loadingScreen = null;

    /**
     * 🏗️ Конструктор приложения
     */
    constructor() {
        console.log('🚀 Reader App: Инициализация начата');
        
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
        
        console.log('✅ Reader App: Конструктор завершен');
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
            this.handleError(error);
        }
    }

    /**
     * 🔧 Инициализация всех сервисов приложения
     */
    async initializeServices() {
        console.log('🔄 Инициализация сервисов...');
        
        // Создаем глобальное состояние
        this.state = new AppState();
        await this.state.init();
        
        // Создаем API сервис с исправленной ссылкой на AppConfig
        this.api = new ApiService({
            baseUrl: window.AppConfig?.app?.isDevelopment ? 'http://localhost:3000/api' : '/api',
            timeout: 10000 // 10 секунд
        });
        
        // Создаем Telegram сервис
        this.telegram = new TelegramService();
        
        // Создаем роутер
        this.router = new AppRouter({
            container: document.getElementById('page-content'),
            state: this.state
        });
        
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
        
        // Инициализируем Telegram сервис
        await this.telegram.init();
        
        // Настраиваем Telegram интерфейс
        this.telegram.expand();
        this.telegram.ready();
        
        // Применяем тему Telegram
        this.applyTelegramTheme();
        
        console.log('✅ Telegram инициализирован');
    }

    /**
     * 🔐 Аутентификация пользователя через Telegram
     */
    async authenticateUser() {
        console.log('🔄 Аутентификация пользователя...');
        
        try {
            // Получаем данные пользователя из Telegram
            const telegramUser = this.telegram.getUser();
            
            if (!telegramUser && !this.state.get('debugMode')) {
                throw new Error('Данные пользователя Telegram недоступны');
            }
            
            // Отправляем данные на backend для аутентификации
            const authResponse = await this.api.post('/auth/telegram', {
                telegramData: this.telegram.getInitData(),
                user: telegramUser
            });
            
            // Сохраняем токен аутентификации
            this.api.setAuthToken(authResponse.token);
            
            // Сохраняем данные пользователя в состоянии
            this.state.update('user', {
                profile: authResponse.user,
                isAuthenticated: true
            });
            
            console.log('✅ Пользователь аутентифицирован:', authResponse.user.firstName);
            
        } catch (error) {
            console.error('❌ Ошибка аутентификации:', error);
            
            // В debug режиме создаем тестового пользователя
            if (this.state.get('debugMode')) {
                this.createDebugUser();
            } else {
                throw error;
            }
        }
    }

    /**
     * 📊 Загрузка пользовательских данных
     */
    async loadUserData() {
        console.log('🔄 Загрузка пользовательских данных...');
        
        const user = this.state.get('user.profile');
        
        try {
            // Загружаем профиль пользователя
            const profile = await this.api.get('/profile');
            
            // Загружаем статистику
            const stats = await this.api.get('/stats');
            
            // Загружаем последние цитаты
            const recentQuotes = await this.api.get('/quotes/recent', { limit: 5 });
            
            // Обновляем состояние
            this.state.update('user', {
                profile: profile
            });
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
        
        // Инициализируем нижнюю навигацию
        const bottomNav = new BottomNavigation();
        bottomNav.init();
        
        // Инициализируем верхнее меню
        const topMenu = new TopMenu();
        topMenu.init();
        
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
        const user = this.state.get('user.profile');
        const profile = this.state.get('user.profile');
        
        let initialRoute = '/home';
        
        // Если пользователь новый - показываем онбординг
        if (!profile?.isOnboardingCompleted) {
            initialRoute = '/onboarding';
        }
        
        // Инициализируем роутер
        await this.router.init();
        
        // Переходим на начальную страницу
        this.router.navigate(initialRoute);
        
        console.log('✅ Роутинг инициализирован, начальная страница:', initialRoute);
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
        if (this.telegram) {
            this.telegram.ready();
        }
        
        console.log('✅ Приложение полностью готово к работе');
    }

    /**
     * 📱 Применение темы Telegram к приложению
     */
    applyTelegramTheme() {
        if (!this.telegram) return;
        
        const theme = this.telegram.getThemeParams();
        document.body.setAttribute('data-theme', 'telegram');
        
        // Применяем цвета темы через CSS переменные
        if (theme.bg_color) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
        }
        if (theme.text_color) {
            document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
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
        if (!this.telegram) return;
        
        // Обработка закрытия приложения
        this.telegram.onClose(() => {
            console.log('📱 Приложение закрывается');
            this.cleanup();
        });
    }

    /**
     * 🧪 Создание тестового пользователя для debug режима
     */
    createDebugUser() {
        this.state.update('user', {
            profile: {
                id: 12345,
                firstName: 'Тестер',
                username: 'debug_user',
                isDebug: true
            },
            isAuthenticated: true
        });
        console.log('🧪 Создан debug пользователь');
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
        if (!this.isInitialized) return;
        
        try {
            // Обновляем только критичные данные
            const stats = await this.api.get('/stats');
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
        
        // Показываем пользователю уведомление об ошибке
        if (window.showNotification) {
            showNotification('Произошла ошибка. Попробуйте обновить страницу.', 'error');
        }
        
        // Отправляем ошибку в аналитику (если доступна)
        if (this.api && this.isInitialized) {
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
     * 🧹 Очистка ресурсов при закрытии приложения
     */
    cleanup() {
        console.log('🧹 Очистка ресурсов приложения');
        
        // Удаляем обработчики событий
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handleError);
        
        // Очищаем роутер
        if (this.router) {
            this.router.destroy();
        }
        
        // Очищаем состояние
        if (this.state) {
            this.state.cleanup();
        }
        
        this.isInitialized = false;
        console.log('✅ Очистка завершена');
    }
}

// Экспорт для использования в других модулях
window.ReaderApp = ReaderApp;