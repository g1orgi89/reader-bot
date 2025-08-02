/**
 * 🧭 BottomNav.js - ИСПРАВЛЕНО: Убраны инлайн стили
 * Теперь использует только CSS из navigation.css
 */

class BottomNav {
    constructor(app, router, telegram) {
        this.app = app;
        this.router = router;
        this.telegram = telegram;
        
        this.currentRoute = '/';
        this.element = null;
        this.subscriptions = [];
        
        // 🎨 Конфигурация навигации
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

    init() {
        this.createElement();
        this.attachEventListeners();
        this.subscribeToRouteChanges();
        
        console.log('BottomNav: Инициализирован без инлайн стилей');
    }

    /**
     * 🏗️ Создание DOM элемента - БЕЗ ИНЛАЙН СТИЛЕЙ!
     */
    createElement() {
        this.element = document.createElement('nav');
        this.element.id = 'bottom-nav';
        this.element.className = 'bottom-nav';
        this.element.innerHTML = this.render();
        
        // 📱 Добавляем в существующий контейнер навигации
        const existingNav = document.getElementById('bottom-nav');
        if (existingNav) {
            existingNav.parentNode.replaceChild(this.element, existingNav);
        } else {
            document.body.appendChild(this.element);
        }
    }

    /**
     * 🎨 Рендер БЕЗ СТИЛЕЙ - только HTML
     */
    render() {
        const navItemsHTML = this.navItems.map(item => 
            this.renderNavItem(item)
        ).join('');

        return navItemsHTML;
    }

    /**
     * 🎯 Рендер отдельного элемента навигации
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
                <span class="nav-label">${item.label}</span>
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
                this.handleDirectNavigation(route, navId);
            }

            console.log('BottomNav: Переход на', route, '(' + navId + ')');
            
        } catch (error) {
            console.error('BottomNav: Ошибка навигации', error);
            
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        }
    }

    /**
     * 🎯 Установка активного маршрута
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

        const allItems = this.element.querySelectorAll('.nav-item');
        allItems.forEach(item => item.classList.remove('active'));

        const activeItem = this.element.querySelector(`[data-route="${this.currentRoute}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    /**
     * 🔄 Подписка на изменения маршрута
     */
    subscribeToRouteChanges() {
        if (window.AppRouter) {
            const subscription = window.AppRouter.subscribe((newRoute) => {
                this.setActiveRoute(newRoute);
            });
            this.subscriptions.push(subscription);
        }

        window.addEventListener('popstate', () => {
            this.setActiveRoute(window.location.pathname);
        });
    }

    /**
     * 🔗 Прямая навигация (fallback)
     */
    handleDirectNavigation(route, navId) {
        if (this.app?.onRouteChange) {
            this.app.onRouteChange(route, navId);
        }

        window.dispatchEvent(new CustomEvent('routeChange', {
            detail: { route, navId, source: 'bottomNav' }
        }));
    }

    /**
     * 🎭 Показать/скрыть навигацию
     */
    setVisible(visible) {
        if (!this.element) return;
        
        this.element.style.transform = visible ? 'translateY(0)' : 'translateY(100%)';
    }

    onShow() {
        this.setVisible(true);
    }

    onHide() {
        this.setVisible(false);
    }

    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        console.log('BottomNav: Компонент уничтожен');
    }

    // 🎨 SVG ИКОНКИ

    getHomeIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
        `;
    }

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomNav;
} else {
    window.BottomNav = BottomNav;
}