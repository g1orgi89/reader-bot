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
        this.app = app;
        this.router = router;
        this.telegram = telegram;
        
        this.currentRoute = '/';
        this.element = null;
        this.subscriptions = [];
        
        // 🎨 Конфигурация навигации (из концепта 5 страниц)
        this.navItems = [
            {
                id: 'home',
                label: 'Главная',
                icon: this.getHomeIcon(),
                route: '/'
            },
            {
                id: 'diary',
                label: 'Дневник',
                icon: this.getDiaryIcon(),
                route: '/diary'
            },
            {
                id: 'reports',
                label: 'Отчеты',
                icon: this.getReportsIcon(),
                route: '/reports'
            },
            {
                id: 'catalog',
                label: 'Каталог',
                icon: this.getCatalogIcon(),
                route: '/catalog'
            },
            {
                id: 'community',
                label: 'Сообщество',
                icon: this.getCommunityIcon(),
                route: '/community'
            }
        ];
        
        this.init();
    }

    /**
     * Инициализация компонента
     */
    init() {
        this.createElement();
        this.attachEventListeners();
        this.subscribeToRouteChanges();
        
        console.log('BottomNav: Инициализирован с', this.navItems.length, 'страницами');
    }

    /**
     * 🏗️ Создание DOM элемента навигации
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'bottom-nav';
        this.element.innerHTML = this.render();
        
        // 📱 Добавляем в конец body для фиксированного позиционирования
        document.body.appendChild(this.element);
    }

    /**
     * 🎨 Рендер компонента (HTML + инлайн стили)
     * @returns {string} HTML разметка
     */
    render() {
        const navItemsHTML = this.navItems.map(item => 
            this.renderNavItem(item)
        ).join('');

        return `
            <style>
                .bottom-nav {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: var(--surface, #FFFFFF);
                    display: flex;
                    border-top: 1px solid var(--border, #E6E0D6);
                    height: 60px;
                    z-index: 100;
                    transition: all 0.3s ease;
                    box-shadow: 0 -2px 12px rgba(210, 69, 44, 0.08);
                }
                
                .nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    padding: 8px 4px;
                    color: var(--text-muted, #999999);
                    position: relative;
                    text-decoration: none;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .nav-item.active {
                    color: var(--primary-color, #D2452C);
                }
                
                .nav-item.active::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 30px;
                    height: 3px;
                    background: var(--primary-color, #D2452C);
                    border-radius: 0 0 3px 3px;
                    transition: all 0.3s ease;
                }
                
                .nav-item:hover:not(.active) {
                    color: var(--text-secondary, #666666);
                    background: var(--background-light, #FAF8F3);
                }
                
                .nav-item:active {
                    transform: scale(0.95);
                }
                
                .nav-icon {
                    width: 18px;
                    height: 18px;
                    margin-bottom: 2px;
                    stroke-width: 2;
                    transition: all 0.3s ease;
                }
                
                .nav-label {
                    font-size: 9px;
                    font-weight: 500;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    transition: all 0.3s ease;
                }
                
                /* 📱 iOS стили для Telegram Mini App */
                @media (max-width: 480px) {
                    .bottom-nav {
                        padding-bottom: env(safe-area-inset-bottom, 0);
                    }
                }
                
                /* 🌙 Темная тема */
                body.dark-theme .bottom-nav {
                    background: var(--surface, #2A2A2A);
                    border-top-color: var(--border, #404040);
                }
                
                body.dark-theme .nav-item.active {
                    color: var(--primary-color, #E85A42);
                }
                
                body.dark-theme .nav-item.active::before {
                    background: var(--primary-color, #E85A42);
                }
            </style>
            
            ${navItemsHTML}
        `;
    }

    /**
     * 🎯 Рендер отдельного элемента навигации
     * @param {NavItem} item - Элемент навигации
     * @returns {string} HTML элемента
     */
    renderNavItem(item) {
        const isActive = this.currentRoute === item.route;
        
        return `
            <div class="nav-item ${isActive ? 'active' : ''}" 
                 data-route="${item.route}" 
                 data-nav-id="${item.id}">
                <div class="nav-icon">
                    ${item.icon}
                </div>
                <div class="nav-label">${item.label}</div>
            </div>
        `;
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
            
            this.navigateToPage(route, navId);
        });

        // 📱 Touch события для мобильных устройств
        this.element.addEventListener('touchstart', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                navItem.style.transform = 'scale(0.95)';
            }
        });

        this.element.addEventListener('touchend', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                setTimeout(() => {
                    navItem.style.transform = '';
                }, 150);
            }
        });
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
        
        this.element.style.transform = visible ? 'translateY(0)' : 'translateY(100%)';
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

        // Удаляем DOM элемент
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        console.log('BottomNav: Компонент уничтожен');
    }

    // 🎨 SVG ИКОНКИ (из концепта 5 страниц)

    /**
     * 🏠 Иконка главной страницы
     * @returns {string} SVG иконка
     */
    getHomeIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
        `;
    }

    /**
     * 📖 Иконка дневника
     * @returns {string} SVG иконка
     */
    getDiaryIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
            </svg>
        `;
    }

    /**
     * 📊 Иконка отчетов
     * @returns {string} SVG иконка
     */
    getReportsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <path d="M8 14h.01"/>
                <path d="M12 14h.01"/>
                <path d="M16 14h.01"/>
                <path d="M8 18h.01"/>
                <path d="M12 18h.01"/>
                <path d="M16 18h.01"/>
            </svg>
        `;
    }

    /**
     * 📚 Иконка каталога
     * @returns {string} SVG иконка
     */
    getCatalogIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <path d="M8 7h8"/>
                <path d="M8 11h8"/>
                <path d="M8 15h5"/>
            </svg>
        `;
    }

    /**
     * 👥 Иконка сообщества
     * @returns {string} SVG иконка  
     */
    getCommunityIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        `;
    }
}

// 🌍 Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomNav;
} else {
    window.BottomNav = BottomNav;
}
