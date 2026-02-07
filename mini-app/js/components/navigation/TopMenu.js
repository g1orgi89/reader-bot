/**
 * 🔝 TopMenu.js - Верхнее меню с drawer выдвижной панелью
 * (оптимизировано: устранение двойной навигации и лишних hash изменений)
 */
class TopMenu {
    constructor(options) {
        let app, api, state, telegram;
        if (options && typeof options === 'object' && options.api && options.state) {
            ({ app, api, state, telegram } = options);
        } else if (options && typeof options === 'object' && options.router) {
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
        this._navBusy = false; // защита от повторного быстрого клика

        this.menuItems = [
            { id: 'profile',       label: 'Мой профиль', icon: this.getProfileIcon(),      action: 'profile' },
            { id: 'achievements',  label: 'Мои достижения', icon: this.getAchievementsIcon(), action: 'achievements' },
            { id: 'settings',      label: 'Настройки',    icon: this.getSettingsIcon(),      action: 'settings' },
            { id: 'divider1',      isDivider: true },
            { id: 'help',          label: 'Помощь',       icon: this.getHelpIcon(),          action: 'help' },
            { id: 'about',         label: 'О приложении', icon: this.getAboutIcon(),         action: 'about' }
        ];

        this.init();
    }

    init() {
        this.createDrawerElements();
        this.attachEventListeners();
        this.subscribeToStateChanges();
        console.log('✅ TopMenu: Инициализирован с drawer pattern');
    }

    createDrawerElements() {
        this.drawer = document.createElement('div');
        this.drawer.className = 'drawer drawer-right';
        this.drawer.id = 'topMenuDrawer';
        this.drawer.setAttribute('role', 'dialog');
        this.drawer.setAttribute('aria-modal', 'true');
        this.drawer.setAttribute('aria-labelledby', 'topMenuTitle');
        this.drawer.innerHTML = this.renderDrawerContent();

        this.backdrop = document.createElement('div');
        this.backdrop.className = 'drawer-backdrop';
        this.backdrop.id = 'topMenuBackdrop';

        document.body.appendChild(this.drawer);
        document.body.appendChild(this.backdrop);
    }

    renderDrawerContent() {
        const userInfo = this.getUserInfo();
        const menuItemsHTML = this.menuItems.map(item =>
            item.isDivider ? '<div class="menu-divider"></div>' : this.renderMenuItem(item)
        ).join('');

        return `
            <div class="drawer-header">
                <div class="menu-user-info">
                    ${this.renderUserAvatar()}
                    <div class="user-details">
                        <h3 class="user-name">${userInfo.name}</h3>
                        <p class="user-stats">${this.formatUserStats(userInfo.stats)}</p>
                    </div>
                </div>
                <button class="drawer-close" aria-label="Закрыть меню">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="drawer-body">
                <nav class="menu-items" role="navigation">
                    ${menuItemsHTML}
                </nav>
            </div>
        `;
    }

    renderMenuItem(item) {
        return `
            <button class="menu-item" data-action="${item.action}" data-menu-id="${item.id}">
                <span class="menu-icon">${item.icon}</span>
                <span class="menu-text">${item.label}</span>
            </button>
        `;
    }

    attachEventListeners() {
        if (!this.drawer || !this.backdrop) return;
        const closeButton = this.drawer.querySelector('.drawer-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }
        this.backdrop.addEventListener('click', () => this.close());

        const menuItems = this.drawer.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const menuId = e.currentTarget.dataset.menuId;
                if (this._navBusy) {
                    console.log('[TopMenuNav] Игнор клика — навигация занята');
                    return;
                }
                this._navBusy = true;
                // небольшой таймаут для снятия блокировки
                setTimeout(() => { this._navBusy = false; }, 400);
                this.handleMenuAction(action, menuId);
            });
        });

        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        };
        document.addEventListener('keydown', this.escHandler);

        this.navigationHandler = () => {
            if (this.isOpen) this.close();
        };
        window.addEventListener('hashchange', this.navigationHandler);
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.drawer.classList.add('active');
        if (this.telegram?.hapticFeedback) {
            try { this.telegram.hapticFeedback('light'); } catch {}
        }
        document.body.classList.add('modal-open');
        console.log('✅ TopMenu: Меню открыто');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.drawer.classList.remove('active');
        document.body.classList.remove('modal-open');
        console.log('✅ TopMenu: Меню закрыто');
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    onHide() {
        this.close();
    }

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

    handleMenuAction(action, _menuId) {
        try {
            if (this.telegram?.hapticFeedback) {
                try { this.telegram.hapticFeedback('light'); } catch {}
            }
            this.close();
            this.navigateToRoute(action);
            console.log('✅ TopMenu: Выполнено действие', action);
        } catch (error) {
            console.error('❌ TopMenu: Ошибка выполнения действия', error);
            if (this.telegram?.hapticFeedback) {
                try { this.telegram.hapticFeedback('error'); } catch {}
            }
        }
    }

    /**
     * Навигация без лишнего изменения hash, если есть router
     */
    navigateToRoute(action) {
        const routes = {
            profile: '/profile?user=me',
            achievements: '/achievements',
            settings: '/settings',
            help: '/help',
            about: '/about'
        };
        const route = routes[action];
        if (!route) {
            console.warn('TopMenu: Неизвестный маршрут для действия', action);
            return;
        }

        // Если мы уже на этой странице — не дергаем навигацию
        const currentHash = window.location.hash.replace(/^#/, '');
        if (currentHash === route.replace(/^\//, '')) {
            console.log('[TopMenuNav] Уже на маршруте', route);
            return;
        }

        console.log('[TopMenuNav] Переход к', route);

        // 1. Router приоритет
        if (this.app?.router?.navigate) {
            this.app.router.navigate(route);
            return;
        }

        // 2. Прямой метод приложения (если внутри он уже дергает router)
        if (typeof this.app?.navigate === 'function') {
            this.app.navigate(route);
            return;
        }

        // 3. Глобальная вспомогательная
        if (typeof window.appNavigate === 'function') {
            window.appNavigate(route);
            return;
        }

        // 4. Fallback
        window.location.hash = route;
    }

    subscribeToStateChanges() {
        if (!this.state?.subscribe) return;
        const profileSubscription = this.state.subscribe('user.profile', () => this.updateUserInfo());
        const statsSubscription = this.state.subscribe('stats', () => this.updateUserInfo());
        const achievementsSubscription = this.state.subscribe('achievements.items', () => this.updateUserInfo());
        this.subscriptions.push(profileSubscription, statsSubscription, achievementsSubscription);
        console.log('✅ TopMenu: Подписки на состояние установлены');
    }

    updateUserInfo() {
        if (!this.drawer) return;
        const userInfo = this.getUserInfo();
        const avatarContainer = this.drawer.querySelector('.user-avatar');
        const name = this.drawer.querySelector('.user-name');
        const stats = this.drawer.querySelector('.user-stats');
        if (avatarContainer) avatarContainer.outerHTML = this.renderUserAvatar();
        if (name) name.textContent = userInfo.name;
        if (stats) stats.textContent = this.formatUserStats(userInfo.stats);
        console.log('🔄 TopMenu: Информация о пользователе обновлена');
    }

    /**
     * 🔧 PATCH: Use app.resolveAvatar() for unified avatar handling
     */
    renderUserAvatar() {
        const userInfo = this.getUserInfo();
        const imageUrl = this.app?.resolveAvatar?.() || null;
        
        if (imageUrl) {
            return `
                <div class="user-avatar">
                    <img class="menu-user-avatar-img" src="${imageUrl}" alt="Аватар"
                         onerror="window.RBImageErrorHandler && window.RBImageErrorHandler(this)" />
                    <div class="user-avatar-fallback fallback">${userInfo.initials}</div>
                </div>
            `;
        }
        return `
            <div class="user-avatar fallback">
                <div class="user-avatar-fallback">${userInfo.initials}</div>
            </div>
        `;
    }

    destroy() {
        this.close();
        if (this.escHandler) document.removeEventListener('keydown', this.escHandler);
        if (this.navigationHandler) window.removeEventListener('hashchange', this.navigationHandler);
        this.subscriptions.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
        this.subscriptions = [];
        if (this.drawer?.parentNode) this.drawer.parentNode.removeChild(this.drawer);
        if (this.backdrop?.parentNode) this.backdrop.parentNode.removeChild(this.backdrop);
        this.drawer = null;
        this.backdrop = null;
        this.triggerButton = null;
        console.log('🧹 TopMenu: Компонент уничтожен');
    }

    getUserInfo() {
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
        const telegramData = this.state?.get('user.telegramData');
        if (telegramData) {
            const fullName = `${telegramData.first_name} ${telegramData.last_name || ''}`.trim();
            return {
                name: fullName || telegramData.username || 'Пользователь',
                initials: this.getInitials(fullName),
                stats: { totalQuotes: 0, currentStreak: 0, achievementsCount: 0 }
            };
        }
        return {
            name: 'Тестер',
            initials: 'Т',
            stats: { totalQuotes: 0, currentStreak: 0, achievementsCount: 0 }
        };
    }

    getInitials(name) {
        if (!name) return '?';
        const words = name.trim().split(' ').filter(w => w.length > 0);
        if (words.length === 0) return '?';
        if (words.length === 1) return (words[0][0] || '?').toUpperCase();
        return `${(words[0][0] || '').toUpperCase()}${(words[1][0] || '').toUpperCase()}`;
    }

    formatUserStats(stats) {
        if (!stats) return 'Начинающий читатель';
        const parts = [];
        if (stats.totalQuotes > 0) parts.push(`${stats.totalQuotes} цитат`);
        if (stats.currentStreak > 0) parts.push(`${stats.currentStreak} дней подряд`);
        if (stats.achievementsCount > 0) parts.push(`${stats.achievementsCount} достижений`);
        return parts.length > 0 ? parts.join(' • ') : 'Начинающий читатель';
    }

    // SVG иконки (оставлены без изменений кроме укороченных комментариев)

    getProfileIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
        `;
    }
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
    getSettingsIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        `;
    }
    getHelpIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <circle cx="12" cy="17" r="1"/>
            </svg>
        `;
    }
    getAboutIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="8"/>
            </svg>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TopMenu;
} else {
    window.TopMenu = TopMenu;
}
