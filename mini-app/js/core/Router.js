/**
 * 🧭 SPA РОУТЕР ДЛЯ READER BOT MINI APP (УБРАНЫ ХЕДЕРЫ)
 * 
 * Управляет клиентским роутингом между страницами
 * Поддерживает анимации переходов и навигацию назад
 * 
 * @filesize 2 KB - SPA роутинг
 * @author Claude Assistant  
 * @version 1.1.1 - ИСПРАВЛЕНЫ ССЫЛКИ НА КЛАССЫ СТРАНИЦ
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
     * @type {HTMLElement} - Контейнер для отображения страниц
     */
    container = null;

    /**
     * @type {AppState} - Глобальное состояние приложения
     */
    state = null;

    /**
     * @type {ApiService} - API сервис для HTTP запросов
     */
    api = null;

    /**
     * @type {TelegramService} - Telegram сервис
     */
    telegram = null;

    /**
     * @type {ReaderApp} - Ссылка на главное приложение
     */
    app = null;

    /**
     * @type {Map<string, RouteConfig>} - Карта зарегистрированных маршрутов
     */
    routes = new Map();

    /**
     * @type {string} - Текущий активный маршрут
     */
    currentRoute = '';

    /**
     * @type {Object} - Текущий активный компонент страницы
     */
    currentComponent = null;

    /**
     * @type {Array<string>} - История навигации
     */
    history = [];

    /**
     * @type {boolean} - Флаг инициализации роутера
     */
    isInitialized = false;

    /**
     * @type {boolean} - Флаг выполнения навигации (для предотвращения дублирования)
     */
    isNavigating = false;

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

        this.container = container;
        this.state = state;
        this.api = api;
        this.telegram = telegram;
        this.app = app;
        
        // Навигационная защита от дублирования
        this._lastNavigationPath = null;
        this._lastNavigationTime = 0;
        
        // Привязываем методы к контексту
        this.handlePopState = this.handlePopState.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        
        console.log('✅ Router: Конструктор инициализирован - VERSION 1.1.1 - ИСПРАВЛЕНЫ ССЫЛКИ НА КЛАССЫ');
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
        
        // ✅ ИСПРАВЛЕНО: Используем window.* ссылки вместо прямых ссылок на классы
        
        // Главная страница
        this.routes.set('/home', {
            path: '/home',
            component: () => window.HomePage,
            title: 'Главная',
            requiresAuth: true,
            showBottomNav: true
        });

        // Дневник цитат
        this.routes.set('/diary', {
            path: '/diary', 
            component: () => window.DiaryPage,
            title: 'Дневник цитат',
            requiresAuth: true,
            showBottomNav: true
        });

        // Отчеты
        this.routes.set('/reports', {
            path: '/reports',
            component: () => window.ReportsPage, 
            title: 'Отчеты',
            requiresAuth: true,
            showBottomNav: true
        });

        // Каталог книг
        this.routes.set('/catalog', {
            path: '/catalog',
            component: () => window.CatalogPage,
            title: 'Каталог книг', 
            requiresAuth: true,
            showBottomNav: true
        });

        // Сообщество
        this.routes.set('/community', {
            path: '/community',
            component: () => window.CommunityPage,
            title: 'Сообщество',
            requiresAuth: true,
            showBottomNav: true
        });

        // Онбординг - БЕЗ НИЖНЕЙ НАВИГАЦИИ
        this.routes.set('/onboarding', {
            path: '/onboarding',
            component: () => window.OnboardingPage,
            title: 'Добро пожаловать',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // ✨ NEW ROUTES: Menu navigation pages
        
        // Profile page
        this.routes.set('/profile', {
            path: '/profile',
            component: () => window.ProfilePage,
            title: 'Профиль',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Achievements page  
        this.routes.set('/achievements', {
            path: '/achievements',
            component: () => window.AchievementsPage,
            title: 'Достижения',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Settings page
        this.routes.set('/settings', {
            path: '/settings',
            component: () => window.SettingsPage,
            title: 'Настройки', 
            requiresAuth: true,
            showBottomNav: false
        });
        
        // About page
        this.routes.set('/about', {
            path: '/about',
            component: () => window.AboutPage,
            title: 'О приложении',
            requiresAuth: true,
            showBottomNav: false
        });
        
        // Help page
        this.routes.set('/help', {
            path: '/help',
            component: () => window.HelpPage,
            title: 'Помощь',
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
            const hash = this.normalizePath(rawHash);
            this.navigate(hash, { replace: true });
        } else {
            // Если hash пустой — стартуем с главной
            this.navigate('/home', { replace: true });
        }
    }
    
    /**
     * 🧭 Навигация к указанному маршруту
     * @param {string} path - Путь назначения
     * @param {NavigationOptions} options - Опции навигации
     */
    async navigate(path, options = {}) {
        const normalizedPath = this.normalizePath(path);
        console.log(`🧭 Router: Навигация к ${normalizedPath} (исходный: ${path})`);

        // Усиленная защита от дублирования навигации
        if (this.isNavigating && !options.force) {
            console.log('⚠️ Router: Навигация уже выполняется, игнорируем повторный вызов');
            return;
        }
        
        // Проверяем на избыточные переходы на тот же путь
        if (this._lastNavigationPath === normalizedPath && 
            Date.now() - this._lastNavigationTime < 500 && 
            !options.force) {
            console.log('⚠️ Router: Игнорируем дублированный переход на тот же путь');
            return;
        }

        // Не переходим на ту же страницу (если не force)
        if (this.currentRoute === normalizedPath && !options.replace && !options.force) {
            console.log('⚠️ Router: Уже на этой странице, игнорируем');
            return;
        }

        // Сохраняем информацию о последней навигации
        this._lastNavigationPath = normalizedPath;
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
            
            // Анимация выхода для текущей страницы
            await this.animatePageExit();
            
            // Уничтожаем предыдущий компонент
            await this.destroyCurrentComponent();
            
            // Показываем состояние загрузки
            this.showPageLoading();
            
            // Создаем новый компонент
            await this.createComponent(route, options.state);
            
            // Обновляем URL и историю
            this.updateUrl(normalizedPath, options.replace);
            
            // Обновляем UI
            this.updateUI(route);
            
            // Сохраняем текущий маршрут
            this.currentRoute = normalizedPath;
            
            // Анимация входа для новой страницы
            await this.animatePageEnter();
            
            // Вызываем onShow для нового компонента
            if (this.currentComponent && typeof this.currentComponent.onShow === 'function') {
                this.currentComponent.onShow();
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
            // ✅ ИСПРАВЛЕНО: Получаем класс через функцию и проверяем его доступность
            const ComponentClass = route.component();
            
            if (!ComponentClass) {
                throw new Error(`❌ Router: Класс компонента для ${route.title} не найден в window`);
            }
            
            // Создаем экземпляр компонента с правильной структурой app
            this.currentComponent = new ComponentClass(appObject);
            
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
        const normalizedPath = this.normalizePath(path);
        const url = `#${normalizedPath}`;
    
        if (replace) {
            window.history.replaceState({ path: normalizedPath }, '', url);
        } else {
            window.history.pushState({ path: normalizedPath }, '', url);
            this.history.push(normalizedPath);
        }

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
    handlePopState(event) {
        console.log('📡 Router: Обработка popstate');
        
        const rawPath = event.state?.path || '';
        const path = this.normalizePath(rawPath);
        
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
     * @param {string} path - Raw path (may include #)
     * @returns {string} - Normalized path with leading /
     */
    normalizePath(path) {
        if (!path || typeof path !== 'string') {
            return '/home';
        }
        
        // Strip any leading #
        let normalized = path.replace(/^#+/, '');
        
        // Ensure starts with /
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        
        // Fall back to /home when empty
        if (normalized === '/' || normalized === '') {
            normalized = '/home';
        }
        
        return normalized;
    }
}

// Экспорт для использования в других модулях
window.AppRouter = AppRouter;
