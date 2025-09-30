/**
 * 🧭 BottomNav.js - Нижняя панель навигации Telegram Mini App
 * 
 * Компонент нижней навигации с 5 страницами:
 * 🏠 Главная, 📖 Дневник, 📊 Отчеты, 📚 Каталог, 👥 Сообщество
 * 
 * Дизайн: Соответствует концепту 5 страниц app.txt и цветовой схеме Анны Бусел
 * Архитектура: Следует паттернам HomePage.js и DiaryPage.js
 * 
 * @class BottomNav
 * @author Claude Sonnet 4
 * @created 2025-07-28
 */

/**
 * @typedef {Object} NavItem
 * @property {string} id - Уникальный ID страницы
 * @property {string} label - Название страницы
 * @property {string} icon - SVG иконка
 * @property {string} route - Маршрут страницы
 * @property {boolean} [isActive] - Активная страница
 */

class BottomNav {
    /**
     * Создает экземпляр нижней навигации
     * @param {Object} app - Основное приложение
     * @param {Object} router - Роутер приложения
     * @param {Object} telegram - Telegram интеграция
     */
    constructor(app, router, telegram) {
        // 🔧 FIX: Implement singleton pattern
        if (window.__BottomNavInstance) {
            console.log('BottomNav: Singleton already exists, returning existing instance');
            return window.__BottomNavInstance;
        }
        
        this.app = app;
        this.router = router;
        this.telegram = telegram;
        
        this.currentRoute = '/home';
        this.element = null;
        this.subscriptions = [];
        
        // 🔧 FIX: Store singleton instance
        window.__BottomNavInstance = this;
        
        this.init();
    }

    /**
     * Инициализация компонента
     */
    init() {
        // 🔧 FIX: Просто находим существующий элемент, НЕ создаем новый
        this.element = document.getElementById('bottom-nav');
        
        if (!this.element) {
            console.error('❌ BottomNav: #bottom-nav не найден в DOM!');
            return;
        }
        
        console.log('✅ BottomNav: Найден существующий элемент навигации');
        
        // Прикрепляем обработчики событий к существующему элементу
        this.attachEventListeners();
        
        // Подписываемся на изменения маршрута
        this.subscribeToRouteChanges();
        
        // 🔧 ИСПРАВЛЕНО: Экспортируем глобальный экземпляр для ios-fix.js
        window.bottomNavInstance = this;
        
        console.log('✅ BottomNav: Инициализирован с существующей статической разметкой');
    }

    /**
     * 🎧 Подключение обработчиков событий
     */
    attachEventListeners() {
        if (!this.element) return;

        // 👆 Обработка кликов по навигации
        this.element.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;

            const route = navItem.dataset.route;
            const navId = navItem.dataset.navId;
            
            if (!route) {
                console.warn('⚠️ BottomNav: nav-item без data-route:', navItem);
                return;
            }
            
            this.navigateToPage(route, navId);
        });

        // Touch feedback is handled by CSS :active pseudo-class
        console.log('✅ BottomNav: Обработчики событий подключены');
    }

    /**
     * 🧭 Навигация на страницу
     * @param {string} route - Маршрут
     * @param {string} navId - ID навигации
     */
    navigateToPage(route, navId) {
        try {
            // ⚡ Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }

            // 🔄 Обновляем активную страницу
            this.setActiveRoute(route);

            // 📍 Навигация через роутер
            if (this.router?.navigate) {
                this.router.navigate(route);
            } else {
                // Fallback для прямой навигации
                this.handleDirectNavigation(route, navId);
            }

            console.log('BottomNav: Переход на', route, '(' + navId + ')');
            
        } catch (error) {
            console.error('BottomNav: Ошибка навигации', error);
            
            // ❌ Haptic feedback при ошибке
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        }
    }

    /**
     * 🎯 Установка активного маршрута
     * @param {string} route - Активный маршрут
     */
    setActiveRoute(route) {
        if (this.currentRoute === route) return;
        
        this.currentRoute = route;
        this.updateActiveState();
    }

    /**
     * 🔄 Обновление активного состояния в UI
     */
    updateActiveState() {
        if (!this.element) return;

        // Убираем активность со всех элементов
        const allItems = this.element.querySelectorAll('.nav-item');
        allItems.forEach(item => item.classList.remove('active'));

        // Добавляем активность к текущему
        const activeItem = this.element.querySelector(`[data-route="${this.currentRoute}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            console.log(`✅ BottomNav: Активен маршрут ${this.currentRoute}`);
        } else {
            console.warn(`⚠️ BottomNav: Не найден элемент с data-route="${this.currentRoute}"`);
        }
    }

    /**
     * 🔄 Подписка на изменения маршрута
     */
    subscribeToRouteChanges() {
        // Если есть глобальный роутер
        if (window.AppRouter) {
            const subscription = window.AppRouter.subscribe((newRoute) => {
                this.setActiveRoute(newRoute);
            });
            this.subscriptions.push(subscription);
        }

        // Если есть история браузера
        window.addEventListener('popstate', () => {
            this.setActiveRoute(window.location.pathname);
        });
    }

    /**
     * 🔗 Прямая навигация (fallback)
     * @param {string} route - Маршрут
     * @param {string} navId - ID навигации
     */
    handleDirectNavigation(route, navId) {
        // Уведомляем приложение о смене маршрута
        if (this.app?.onRouteChange) {
            this.app.onRouteChange(route, navId);
        }

        // Событие для других компонентов
        window.dispatchEvent(new CustomEvent('routeChange', {
            detail: { route, navId, source: 'bottomNav' }
        }));
    }

    /**
     * 🎭 Показать/скрыть навигацию
     * @param {boolean} visible - Показать навигацию
     */
    setVisible(visible) {
        if (!this.element) return;
        
        // 🔧 ИСПРАВЛЕНО: Применяем класс nav-hidden к ОБОИМ html и body
        const html = document.documentElement;
        const body = document.body;
        
        if (visible) {
            html.classList.remove('nav-hidden');
            body.classList.remove('nav-hidden');
        } else {
            html.classList.add('nav-hidden');
            body.classList.add('nav-hidden');
        }
        
        console.log(`🎭 Navigation ${visible ? 'shown' : 'hidden'} (classes applied to both html and body)`);
    }

    /**
     * 🔄 Lifecycle: Показ компонента
     */
    onShow() {
        this.setVisible(true);
    }

    /**
     * 🔄 Lifecycle: Скрытие компонента  
     */
    onHide() {
        this.setVisible(false);
    }

    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        // Отписываемся от событий
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];

        // НЕ удаляем DOM элемент, т.к. он статический в index.html!
        // Только отвязываем ссылку
        this.element = null;
        console.log('BottomNav: Компонент уничтожен');
    }
}

// 🌍 Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomNav;
} else {
    window.BottomNav = BottomNav;
}
