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

import { DiaryPage } from '../pages/DiaryPage.js';

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
        
        // Привязываем методы к контексту
        this.handlePopState = this.handlePopState.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        
        console.log('✅ Router: Конструктор инициализирован - VERSION 1.1.0 - БЕЗ ХЕДЕРОВ');
    }

    /**
     * 🚀 Инициализация роутера
     */
    async init() {
        console.log('🔄 Router: Начало инициализации');
        
        // Регистрируем все маршруты
        this.registerRoutes();
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Обрабатываем текущий URL
        this.handleInitialRoute();
        
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
     */
    handleInitialRoute() {
        // В Telegram Mini App используем hash роутинг
        const hash = window.location.hash.slice(1) || '/home';
        this.navigate(hash, { replace: true });
    }

    /**
     * 🧭 Навигация к указанному маршруту
     * @param {string} path - Путь назначения
     * @param {NavigationOptions} options - Опции навигации
     */
    async navigate(path, options = {}) {
        console.log(`🧭 Router: Навигация к ${path}`);
        
        // Предотвращаем дублирование навигации
        if (this.isNavigating) {
            console.log('⚠️ Router: Навигация уже выполняется, игнорируем');
            return;
        }

        // Не переходим на ту же страницу
        if (this.currentRoute === path && !options.replace) {
            console.log('⚠️ Router: Уже на этой странице, игнорируем');
            return;
        }

        // Проверяем существование маршрута
        const route = this.routes.get(path);
        if (!route) {
            console.warn(`⚠️ Router: Маршрут ${path} не найден, редирект на /home`);
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
            this.updateUrl(path, options.replace);
            
            // Обновляем UI
            this.updateUI(route);
            
            // Сохраняем текущий маршрут
            this.currentRoute = path;
            
            // Анимация входа для новой страницы
            await this.animatePageEnter();
            
            // Вызываем onShow для нового компонента
            if (this.currentComponent && typeof this.currentComponent.onShow === 'function') {
                this.currentComponent.onShow();
                console.log(`✅ Router: onShow вызван для ${route.title}`);
            }
            
            console.log(`✅ Router: Навигация к ${path} завершена`);
            
        } catch (error) {
            console.error(`❌ Router: Ошибка навигации к ${path}:`, error);
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

    /**
     * 🔗 Обновление URL в адресной строке
     * @param {string} path - Новый путь
     * @param {boolean} replace - Заменить текущую запись в истории
     */
    updateUrl(path, replace = false) {
        const url = `#${path}`;
        
        if (replace) {
            window.history.replaceState({ path }, '', url);
        } else {
            window.history.pushState({ path }, '', url);
            this.history.push(path);
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
        
        const path = event.state?.path || '/home';
        
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
}

// Экспорт для использования в других модулях
window.AppRouter = AppRouter;
