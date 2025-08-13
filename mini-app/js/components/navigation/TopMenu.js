/**
 * 🔝 TopMenu.js - Верхнее меню с drawer выдвижной панелью
 * 
 * Компонент верхнего меню использующий drawer pattern из modals.css
 * Включает: Профиль, Достижения, Настройки, Помощь, О приложении
 * 
 * Особенности:
 * - Использует drawer-right + drawer-backdrop из modals.css
 * - Подписывается на изменения состояния пользователя
 * - Автоматическое закрытие при навигации
 * - Haptic feedback через Telegram
 * - Accessibility support
 * 
 * @class TopMenu
 * @author Claude Assistant
 * @version 2.0.0 - Refactored to use drawer pattern
 */

/**
 * @typedef {Object} MenuItem
 * @property {string} id - Уникальный ID пункта меню
 * @property {string} label - Название пункта
 * @property {string} icon - SVG иконка
 * @property {string} [action] - Действие при клике
 * @property {boolean} [isDivider] - Разделитель меню
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} name - Имя пользователя
 * @property {string} initials - Инициалы
 * @property {Object} stats - Статистика пользователя
 */

class TopMenu {
    /**
     * Создает экземпляр верхнего меню
     * @param {Object|App} options - Параметры инициализации или App instance (backward compatible)
     * @param {Object} options.app - Основное приложение
     * @param {Object} options.api - API клиент
     * @param {Object} options.state - Глобальное состояние
     * @param {Object} options.telegram - Telegram интеграция
     */
    constructor(options) {
        // Backward compatibility: support both new TopMenu(app) and new TopMenu({ app })
        let app, api, state, telegram;
        
        if (options && typeof options === 'object' && options.api && options.state) {
            // New style: { app, api, state, telegram }
            ({ app, api, state, telegram } = options);
        } else if (options && typeof options === 'object' && options.router) {
            // Legacy style: direct app object
            app = options;
            api = options.api;
            state = options.state;
            telegram = options.telegram;
        } else {
            throw new Error('TopMenu: Invalid constructor arguments');
        }
        
        this.app = app;
        this.api = api;
        this.state = state;
        this.telegram = telegram;
        
        this.isOpen = false;
        this.drawer = null;
        this.backdrop = null;
        this.triggerButton = null;
        this.subscriptions = [];
        
        // 📋 Конфигурация меню
        this.menuItems = [
            {
                id: 'profile',
                label: 'Профиль',
                icon: this.getProfileIcon(),
                action: 'profile'
            },
            {
                id: 'achievements',
                label: 'Достижения',
                icon: this.getAchievementsIcon(),
                action: 'achievements'
            },
            {
                id: 'divider1',
                isDivider: true
            },
            {
                id: 'settings',
                label: 'Настройки',
                icon: this.getSettingsIcon(),
                action: 'settings'
            },
            {
                id: 'help',
                label: 'Помощь',
                icon: this.getHelpIcon(),
                action: 'help'
            },
            {
                id: 'about',
                label: 'О приложении',
                icon: this.getAboutIcon(),
                action: 'about'
            }
        ];
        
        this.init();
    }

    /**
     * 🚀 Инициализация компонента
     */
    init() {
        this.createDrawerElements();
        this.attachEventListeners();
        this.subscribeToStateChanges();
        
        console.log('✅ TopMenu: Инициализирован с drawer pattern');
    }

    /**
     * 🏗️ Создание элементов drawer согласно modals.css
     */
    createDrawerElements() {
        // Создаем drawer
        this.drawer = document.createElement('div');
        this.drawer.className = 'drawer drawer-right';
        this.drawer.id = 'topMenuDrawer';
        this.drawer.setAttribute('role', 'dialog');
        this.drawer.setAttribute('aria-modal', 'true');
        this.drawer.setAttribute('aria-labelledby', 'topMenuTitle');
        this.drawer.innerHTML = this.renderDrawerContent();

        // Создаем backdrop как sibling элемент для CSS селектора .drawer.active + .drawer-backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'drawer-backdrop';
        this.backdrop.id = 'topMenuBackdrop';

        // Добавляем в DOM в правильном порядке для CSS селектора
        document.body.appendChild(this.drawer);
        document.body.appendChild(this.backdrop);
    }

    /**
     * 🎨 Рендер содержимого drawer
     * @returns {string} HTML разметка
     */
    renderDrawerContent() {
        const userInfo = this.getUserInfo();
        const menuItemsHTML = this.menuItems.map(item => 
            item.isDivider ? '<div class="menu-divider"></div>' : this.renderMenuItem(item)
        ).join('');

        return `
            <div class="drawer-header">
                <button class="drawer-close" aria-label="Закрыть меню">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <h2 id="topMenuTitle" class="drawer-title">Меню</h2>
            </div>
            
            <div class="drawer-body">
                <div class="menu-user-info">
                    ${this.renderUserAvatar()}
                    <div class="user-details">
                        <h3 class="user-name">${userInfo.name}</h3>
                        <p class="user-stats">${this.formatUserStats(userInfo.stats)}</p>
                    </div>
                </div>
                
                <nav class="menu-items" role="navigation">
                    ${menuItemsHTML}
                </nav>
            </div>
        `;
    }

    /**
     * 🎯 Рендер пункта меню
     * @param {MenuItem} item - Пункт меню
     * @returns {string} HTML пункта меню
     */
    renderMenuItem(item) {
        return `
            <button class="menu-item" data-action="${item.action}" data-menu-id="${item.id}">
                <span class="menu-icon">
                    ${item.icon}
                </span>
                <span class="menu-text">${item.label}</span>
            </button>
        `;
    }

    /**
     * 🎧 Подключение обработчиков событий
     */
    attachEventListeners() {
        if (!this.drawer || !this.backdrop) return;

        // ❌ Кнопка закрытия
        const closeButton = this.drawer.querySelector('.drawer-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.close();
            });
        }

        // 👆 Клик по backdrop для закрытия
        this.backdrop.addEventListener('click', () => {
            this.close();
        });

        // 📋 Обработка кликов по пунктам меню
        const menuItems = this.drawer.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const menuId = e.currentTarget.dataset.menuId;
                
                this.handleMenuAction(action, menuId);
            });
        });

        // ⌨️ Закрытие по ESC
        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // 🧭 Закрытие при навигации (если доступен router)
        this.navigationHandler = () => {
            if (this.isOpen) {
                this.close();
            }
        };
        
        // Подписываемся на изменения hash для автозакрытия
        window.addEventListener('hashchange', this.navigationHandler);
    }

    /**
     * 📖 Открытие меню
     */
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.drawer.classList.add('active');
        
        // ⚡ Haptic feedback
        if (this.telegram?.hapticFeedback) {
            try {
                this.telegram.hapticFeedback('light');
            } catch (error) {
                console.warn('TopMenu: Haptic feedback недоступен');
            }
        }
        
        // 🔒 Блокируем скролл страницы
        document.body.classList.add('modal-open');
        
        console.log('✅ TopMenu: Меню открыто');
    }

    /**
     * 📕 Закрытие меню
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.drawer.classList.remove('active');
        
        // 🔓 Разблокируем скролл страницы
        document.body.classList.remove('modal-open');
        
        console.log('✅ TopMenu: Меню закрыто');
    }

    /**
     * 🔄 Переключение состояния меню
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 👁️ Метод onHide для lifecycle управления
     */
    onHide() {
        this.close();
    }

    /**
     * 🔧 Привязка к внешней кнопке (helper для интеграции)
     * @param {HTMLElement} buttonEl - Кнопка-триггер
     */
    attachToButton(buttonEl) {
        if (!buttonEl) return;
        
        this.triggerButton = buttonEl;
        buttonEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        console.log('✅ TopMenu: Привязан к кнопке', buttonEl);
    }

    /**
     * 🎯 Обработка действий меню
     * @param {string} action - Действие
     * @param {string} _menuId - ID пункта меню (не используется)
     */
    handleMenuAction(action, _menuId) {
        try {
            // ⚡ Haptic feedback
            if (this.telegram?.hapticFeedback) {
                try {
                    this.telegram.hapticFeedback('light');
                } catch (error) {
                    console.warn('TopMenu: Haptic feedback недоступен');
                }
            }

            // 📕 Закрываем меню ПЕРЕД выполнением действия
            this.close();

            // 🎯 Выполняем действие - always navigate to routes
            this.navigateToRoute(action);

            console.log('✅ TopMenu: Выполнено действие', action);
            
        } catch (error) {
            console.error('❌ TopMenu: Ошибка выполнения действия', error);
            
            // ❌ Haptic feedback при ошибке
            if (this.telegram?.hapticFeedback) {
                try {
                    this.telegram.hapticFeedback('error');
                } catch (error) {
                    console.warn('TopMenu: Error haptic feedback недоступен');
                }
            }
        }
    }

    /**
     * 🧭 Навигация к маршруту 
     * @param {string} action - Действие для навигации
     */
    navigateToRoute(action) {
        const routes = {
            'profile': '/profile',
            'achievements': '/achievements', 
            'settings': '/settings',
            'help': '/help',
            'about': '/about'
        };

        const route = routes[action];
        if (route) {
            // Prefer app.navigate if available, else use app.router.navigate, else fallback to hash
            if (this.app && typeof this.app.navigate === 'function') {
                this.app.navigate(route);
            } else if (typeof window.appNavigate === 'function') {
                window.appNavigate(route);
            } else if (this.app && this.app.router && typeof this.app.router.navigate === 'function') {
                this.app.router.navigate(route);
            } else {
                // Safe fallback only - update location.hash (no history overwrite)
                window.location.hash = route;
            }
        } else {
            console.warn('TopMenu: Неизвестный маршрут для действия', action);
        }
    }

    /**
     * 🔄 Подписка на изменения состояния
     */
    subscribeToStateChanges() {
        if (!this.state?.subscribe) return;

        // Подписываемся на изменения профиля пользователя
        const profileSubscription = this.state.subscribe('user.profile', () => {
            this.updateUserInfo();
        });
        this.subscriptions.push(profileSubscription);

        // Подписываемся на изменения статистики
        const statsSubscription = this.state.subscribe('stats', () => {
            this.updateUserInfo();
        });
        this.subscriptions.push(statsSubscription);

        // Подписываемся на изменения достижений
        const achievementsSubscription = this.state.subscribe('achievements.items', () => {
            this.updateUserInfo();
        });
        this.subscriptions.push(achievementsSubscription);

        console.log('✅ TopMenu: Подписки на состояние установлены');
    }

    /**
     * 🔄 Обновление информации о пользователе в UI
     */
    updateUserInfo() {
        if (!this.drawer) return;

        const userInfo = this.getUserInfo();
        
        const avatarContainer = this.drawer.querySelector('.user-avatar');
        const name = this.drawer.querySelector('.user-name');
        const stats = this.drawer.querySelector('.user-stats');
        
        // Обновляем аватар
        if (avatarContainer) {
            avatarContainer.outerHTML = this.renderUserAvatar();
        }
        
        if (name) name.textContent = userInfo.name;
        if (stats) stats.textContent = this.formatUserStats(userInfo.stats);

        console.log('🔄 TopMenu: Информация о пользователе обновлена');
    }

    /**
     * 🖼️ Рендер аватара пользователя с поддержкой изображений
     */
    renderUserAvatar() {
        const profile = this.state?.get('user.profile');
        const avatarUrl = profile?.avatarUrl;
        const telegramPhotoUrl = this.telegram?.getUser()?.photo_url;
        const userInfo = this.getUserInfo();
        
        // Определяем источник изображения по приоритету
        const imageUrl = avatarUrl || telegramPhotoUrl;
        
        if (imageUrl) {
            return `
                <div class="user-avatar">
                    <img class="menu-user-avatar-img" src="${imageUrl}" alt="Аватар" 
                         onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                    <div class="user-avatar-fallback">${userInfo.initials}</div>
                </div>
            `;
        } else {
            return `
                <div class="user-avatar fallback">
                    <div class="user-avatar-fallback">${userInfo.initials}</div>
                </div>
            `;
        }
    }

    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        // Закрываем меню
        this.close();

        // Удаляем обработчики событий
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
        if (this.navigationHandler) {
            window.removeEventListener('hashchange', this.navigationHandler);
        }

        // Отписываемся от состояния
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];

        // Удаляем DOM элементы
        if (this.drawer && this.drawer.parentNode) {
            this.drawer.parentNode.removeChild(this.drawer);
        }
        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        
        this.drawer = null;
        this.backdrop = null;
        this.triggerButton = null;
        
        console.log('🧹 TopMenu: Компонент уничтожен');
    }

    /**
     * 👤 Получение информации о пользователе
     * @returns {UserInfo} Информация о пользователе
     */
    getUserInfo() {
        // Получаем данные из состояния
        const userProfile = this.state?.get('user.profile');
        const stats = this.state?.get('stats');
        const achievementsCount = this.state?.get('achievements.items')?.length || 0;
        
        if (userProfile) {
            return {
                name: userProfile.name || userProfile.firstName || 'Пользователь',
                initials: this.getInitials(userProfile.name || userProfile.firstName),
                stats: {
                    totalQuotes: stats?.totalQuotes || 0,
                    currentStreak: stats?.currentStreak || 0,
                    achievementsCount
                }
            };
        }
        
        // Fallback из Telegram данных
        const telegramData = this.state?.get('user.telegramData');
        if (telegramData) {
            const fullName = `${telegramData.first_name} ${telegramData.last_name || ''}`.trim();
            return {
                name: fullName || telegramData.username || 'Пользователь',
                initials: this.getInitials(fullName),
                stats: {
                    totalQuotes: 0,
                    currentStreak: 0,
                    achievementsCount: 0
                }
            };
        }
        
        // Заглушка для отладки
        return {
            name: 'Тестер',
            initials: 'Т',
            stats: {
                totalQuotes: 0,
                currentStreak: 0,
                achievementsCount: 0
            }
        };
    }

    /**
     * 🔤 Получение инициалов из имени (до двух слов)
     * @param {string} name - Полное имя
     * @returns {string} Инициалы
     */
    getInitials(name) {
        if (!name) return '?';
        
        const words = name.trim().split(' ').filter(word => word.length > 0);
        if (words.length === 0) return '?';
        if (words.length === 1) return words[0][0]?.toUpperCase() || '?';
        
        // Берем первые буквы первых двух слов
        return `${words[0][0]?.toUpperCase() || ''}${words[1][0]?.toUpperCase() || ''}`;
    }

    /**
     * 📊 Форматирование статистики пользователя
     * @param {Object} stats - Статистика пользователя
     * @returns {string} Отформатированная статистика
     */
    formatUserStats(stats) {
        if (!stats) return 'Начинающий читатель';
        
        const parts = [];
        if (stats.totalQuotes > 0) parts.push(`${stats.totalQuotes} цитат`);
        if (stats.currentStreak > 0) parts.push(`${stats.currentStreak} дней подряд`);
        if (stats.achievementsCount > 0) parts.push(`${stats.achievementsCount} достижений`);
        
        return parts.length > 0 ? parts.join(' • ') : 'Начинающий читатель';
    }

    // 🎨 SVG ИКОНКИ

    /**
     * 👤 Иконка профиля
     * @returns {string} SVG иконка
     */
    getProfileIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
        `;
    }

    /**
     * 🏆 Иконка достижений
     * @returns {string} SVG иконка
     */
    getAchievementsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
        `;
    }

    /**
     * ⚙️ Иконка настроек
     * @returns {string} SVG иконка
     */
    getSettingsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.79a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `;
    }

    /**
     * ❓ Иконка помощи
     * @returns {string} SVG иконка
     */
    getHelpIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <point cx="12" cy="17" r="1"/>
            </svg>
        `;
    }

    /**
     * ℹ️ Иконка "О приложении"
     * @returns {string} SVG иконка
     */
    getAboutIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
            </svg>
        `;
    }
}

// 🌍 Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TopMenu;
} else {
    window.TopMenu = TopMenu;
}
