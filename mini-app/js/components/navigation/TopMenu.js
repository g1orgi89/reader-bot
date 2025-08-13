/**
 * 🔝 TopMenu.js - Верхнее меню с выдвижной панелью Telegram Mini App
 * 
 * Компонент верхнего меню с кнопкой "⋯" и выдвижной панелью справа.
 * Включает: Профиль, Достижения, Настройки, Помощь, О приложении
 * 
 * Дизайн: Соответствует концепту меню модалок app.txt
 * Архитектура: Следует паттернам существующих компонентов
 * 
 * @class TopMenu
 * @author Claude Sonnet 4
 * @created 2025-07-28
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
 * @property {string} role - Роль пользователя
 * @property {string} avatar - Аватар (буква)
 * @property {Object} stats - Статистика пользователя
 */

class TopMenu {
    /**
     * Создает экземпляр верхнего меню
     * @param {Object} app - Основное приложение
     * @param {Object} api - API клиент
     * @param {Object} state - Глобальное состояние
     * @param {Object} telegram - Telegram интеграция
     */
    constructor(app, api, state, telegram) {
        this.app = app;
        this.api = api;
        this.state = state;
        this.telegram = telegram;
        
        this.isOpen = false;
        this.element = null;
        this.overlay = null;
        this.subscriptions = [];
        
        // 👤 Данные пользователя (из состояния или Telegram)
        this.userInfo = this.getUserInfo();
        
        // 📋 Конфигурация меню (из концепта модалок)
        this.menuItems = [
            {
                id: 'profile',
                label: 'Мой профиль',
                icon: this.getProfileIcon(),
                action: 'openProfile'
            },
            {
                id: 'achievements',
                label: 'Мои достижения',
                icon: this.getAchievementsIcon(),
                action: 'openAchievements'
            },
            {
                id: 'divider1',
                isDivider: true
            },
            {
                id: 'settings',
                label: 'Настройки',
                icon: this.getSettingsIcon(),
                action: 'openSettings'
            },
            {
                id: 'help',
                label: 'Помощь',
                icon: this.getHelpIcon(),
                action: 'openHelp'
            },
            {
                id: 'about',
                label: 'О приложении',
                icon: this.getAboutIcon(),
                action: 'openAbout'
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
        this.subscribeToStateChanges();
        
        console.log('TopMenu: Инициализирован с', this.menuItems.length - 1, 'пунктами меню');
    }

    /**
     * 👤 Получение информации о пользователе
     * @returns {UserInfo} Информация о пользователе
     */
    getUserInfo() {
        // Приоритет: состояние приложения > Telegram > заглушка
        if (this.state?.user) {
            const profile = this.state.get('user.profile') || this.state.user;
            return {
                name: profile.name || 'Пользователь',
                role: this.getUserRole(),
                avatar: this.getInitials(profile.name),
                avatarUrl: profile.avatarUrl,
                telegramPhotoUrl: this.telegram?.getUser()?.photo_url || this.telegram?.getUser()?.photoUrl,
                stats: this.state.user.stats || {}
            };
        }
        
        // Из Telegram Web App
        if (this.telegram?.user) {
            const fullName = `${this.telegram.user.first_name} ${this.telegram.user.last_name || ''}`.trim();
            return {
                name: fullName || this.telegram.user.username || 'Пользователь',
                role: 'Читатель',
                avatar: this.getInitials(fullName),
                avatarUrl: null,
                telegramPhotoUrl: this.telegram.user.photo_url || this.telegram.user.photoUrl,
                stats: {}
            };
        }
        
        // Заглушка
        return {
            name: 'Анна М.',
            role: 'Читатель активист',
            avatar: 'А',
            avatarUrl: null,
            telegramPhotoUrl: null,
            stats: {
                quotes: 47,
                streak: 12,
                achievements: 2
            }
        };
    }

    /**
     * 🎭 Получение роли пользователя
     * @returns {string} Роль пользователя
     */
    getUserRole() {
        if (!this.state?.user?.stats) return 'Читатель';
        
        const stats = this.state.user.stats;
        const quotesCount = stats.quotesCount || 0;
        
        if (quotesCount >= 100) return 'Мастер цитат';
        if (quotesCount >= 50) return 'Читатель активист';
        if (quotesCount >= 25) return 'Коллекционер мудрости';
        if (quotesCount >= 10) return 'Начинающий мыслитель';
        
        return 'Читатель';
    }

    /**
     * 🔤 Получение инициалов из имени
     * @param {string} name - Полное имя
     * @returns {string} Инициалы
     */
    getInitials(name) {
        if (!name) return '?';
        
        const words = name.trim().split(' ');
        if (words.length === 1) return words[0][0]?.toUpperCase() || '?';
        
        return `${words[0][0]?.toUpperCase() || ''}${words[1][0]?.toUpperCase() || ''}`;
    }

    /**
     * 🏗️ Создание DOM элемента меню
     */
    createElement() {
        // Кнопка меню (встраивается в header страниц)
        this.element = document.createElement('button');
        this.element.className = 'menu-button';
        this.element.innerHTML = '⋯';
        
        // Overlay с выдвижной панелью
        this.createOverlay();
    }

    /**
     * 🌊 Создание overlay с выдвижной панелью
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'menu-overlay';
        this.overlay.innerHTML = this.renderOverlay();
        
        // Добавляем в body
        document.body.appendChild(this.overlay);
    }

    /**
     * 🎨 Рендер overlay с выдвижной панелью
     * @returns {string} HTML разметка
     */
    renderOverlay() {
        const menuItemsHTML = this.menuItems.map(item => 
            item.isDivider ? this.renderDivider() : this.renderMenuItem(item)
        ).join('');

        return `
            <style>
                .menu-button {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    position: relative;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .menu-button:hover {
                    background: rgba(255,255,255,0.2);
                }
                
                .menu-button.active {
                    background: rgba(255,255,255,0.3);
                }
                
                .menu-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                    z-index: 1000;
                }
                
                .menu-overlay.show {
                    opacity: 1;
                    visibility: visible;
                }
                
                .menu-panel {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 280px;
                    height: 100%;
                    background: var(--surface, #FFFFFF);
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.1);
                    overflow-y: auto;
                }
                
                .menu-overlay.show .menu-panel {
                    transform: translateX(0);
                }
                
                .menu-header {
                    background: linear-gradient(135deg, var(--primary-color, #D2452C), var(--primary-dark, #B53A23));
                    color: white;
                    padding: 20px 16px;
                    position: relative;
                }
                
                .menu-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background 0.3s ease;
                }
                
                .menu-close:hover {
                    background: rgba(255,255,255,0.2);
                }
                
                .menu-user-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }
                
                .menu-user-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 600;
                    border: 2px solid rgba(255,255,255,0.3);
                    position: relative;
                    overflow: hidden;
                }

                /* Изображение аватара в меню */
                .menu-user-avatar-img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                    z-index: 2;
                }

                /* Инициалы аватара в меню */
                .menu-user-avatar-initials {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                }

                /* Состояние когда нужно показать инициалы в меню */
                .menu-user-avatar.show-initials .menu-user-avatar-img {
                    display: none;
                }
                
                .menu-user-details h3 {
                    font-size: 16px;
                    margin: 0 0 2px 0;
                    font-weight: 600;
                }
                
                .menu-user-details p {
                    font-size: 12px;
                    margin: 0;
                    opacity: 0.8;
                }
                
                .menu-stats {
                    font-size: 11px;
                    opacity: 0.9;
                    margin-top: 4px;
                }
                
                .menu-items {
                    padding: 8px 0;
                }
                
                .menu-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 20px;
                    color: var(--text-primary, #2D2D2D);
                    text-decoration: none;
                    transition: all 0.3s ease;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 14px;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .menu-item:hover {
                    background: var(--background-light, #FAF8F3);
                    color: var(--primary-color, #D2452C);
                }
                
                .menu-item:active {
                    transform: scale(0.98);
                }
                
                .menu-icon {
                    width: 20px;
                    height: 20px;
                    color: var(--text-secondary, #666666);
                    transition: color 0.3s ease;
                    flex-shrink: 0;
                }
                
                .menu-item:hover .menu-icon {
                    color: var(--primary-color, #D2452C);
                }
                
                .menu-text {
                    font-weight: 500;
                }
                
                .menu-divider {
                    height: 1px;
                    background: var(--border, #E6E0D6);
                    margin: 8px 20px;
                }
                
                /* 🌙 Темная тема */
                body.dark-theme .menu-panel {
                    background: var(--surface, #2A2A2A);
                }
                
                body.dark-theme .menu-item {
                    color: var(--text-primary, #F0F0F0);
                }
                
                body.dark-theme .menu-item:hover {
                    background: var(--background-light, #242424);
                    color: var(--primary-color, #E85A42);
                }
                
                body.dark-theme .menu-divider {
                    background: var(--border, #404040);
                }
                
                /* 📱 Мобильная адаптация */
                @media (max-width: 480px) {
                    .menu-panel {
                        width: 100%;
                        max-width: 320px;
                    }
                }
            </style>
            
            <div class="menu-panel">
                <div class="menu-header">
                    <button class="menu-close">&times;</button>
                    <div class="menu-user-info">
                        <div class="menu-user-avatar">
                            ${this.userInfo.avatarUrl || this.userInfo.telegramPhotoUrl ? `
                                <img 
                                    src="${this.userInfo.avatarUrl || this.userInfo.telegramPhotoUrl}" 
                                    alt="Аватар ${this.userInfo.name}"
                                    class="menu-user-avatar-img"
                                    onerror="this.style.display='none'; this.parentElement.classList.add('show-initials')"
                                    onload="this.parentElement.classList.remove('show-initials')"
                                >
                                <span class="menu-user-avatar-initials">${this.userInfo.avatar}</span>
                            ` : `
                                <span class="menu-user-avatar-initials">${this.userInfo.avatar}</span>
                            `}
                        </div>
                        <div class="menu-user-details">
                            <h3>${this.userInfo.name}</h3>
                            <p>${this.userInfo.role}</p>
                        </div>
                    </div>
                    <div class="menu-stats">${this.formatUserStats()}</div>
                </div>
                
                <div class="menu-items">
                    ${menuItemsHTML}
                </div>
            </div>
        `;
    }

    /**
     * 📊 Форматирование статистики пользователя
     * @returns {string} Отформатированная статистика
     */
    formatUserStats() {
        const stats = this.userInfo.stats;
        if (!stats || Object.keys(stats).length === 0) {
            return 'Начинающий читатель • Добро пожаловать!';
        }
        
        const parts = [];
        if (stats.quotes) parts.push(`${stats.quotes} цитат`);
        if (stats.streak) parts.push(`${stats.streak} дней подряд`);
        if (stats.achievements) parts.push(`${stats.achievements} достижения`);
        
        return parts.join(' • ') || 'Активный читатель';
    }

    /**
     * 🎯 Рендер пункта меню
     * @param {MenuItem} item - Пункт меню
     * @returns {string} HTML пункта меню
     */
    renderMenuItem(item) {
        return `
            <button class="menu-item" data-action="${item.action}" data-menu-id="${item.id}">
                <div class="menu-icon">
                    ${item.icon}
                </div>
                <span class="menu-text">${item.label}</span>
            </button>
        `;
    }

    /**
     * ➖ Рендер разделителя меню
     * @returns {string} HTML разделителя
     */
    renderDivider() {
        return '<div class="menu-divider"></div>';
    }

    /**
     * 🎧 Подключение обработчиков событий
     */
    attachEventListeners() {
        if (!this.element || !this.overlay) return;

        // 👆 Клик по кнопке меню
        this.element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // 👆 Клик по overlay для закрытия
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // ❌ Кнопка закрытия
        const closeButton = this.overlay.querySelector('.menu-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.close();
            });
        }

        // 📋 Обработка кликов по пунктам меню
        const menuItems = this.overlay.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const menuId = e.currentTarget.dataset.menuId;
                
                this.handleMenuAction(action, menuId);
            });
        });

        // ⌨️ Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * 🎭 Переключение состояния меню
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 📖 Открытие меню
     */
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.element.classList.add('active');
        this.overlay.classList.add('show');
        
        // ⚡ Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // 🔒 Блокируем скролл страницы
        document.body.style.overflow = 'hidden';
        
        console.log('TopMenu: Меню открыто');
    }

    /**
     * 📕 Закрытие меню
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.element.classList.remove('active');
        this.overlay.classList.remove('show');
        
        // 🔓 Разблокируем скролл страницы
        document.body.style.overflow = '';
        
        console.log('TopMenu: Меню закрыто');
    }

    /**
     * 🎯 Обработка действий меню
     * @param {string} action - Действие
     * @param {string} menuId - ID пункта меню
     */
    handleMenuAction(action, menuId) {
        try {
            // ⚡ Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }

            // 📕 Закрываем меню
            this.close();

            // 🎯 Выполняем действие
            switch (action) {
                case 'openProfile':
                    this.openProfileModal();
                    break;
                case 'openAchievements':
                    this.openAchievementsModal();
                    break;
                case 'openSettings':
                    this.openSettingsModal();
                    break;
                case 'openHelp':
                    this.openHelpModal();
                    break;
                case 'openAbout':
                    this.openAboutModal();
                    break;
                default:
                    console.warn('TopMenu: Неизвестное действие', action);
            }

            console.log('TopMenu: Выполнено действие', action);
            
        } catch (error) {
            console.error('TopMenu: Ошибка выполнения действия', error);
            
            // ❌ Haptic feedback при ошибке
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        }
    }

    /**
     * 👤 Открытие модального окна профиля
     */
    openProfileModal() {
        // Интеграция с ProfileModal
        if (this.app && this.app.profileModal) {
            this.app.profileModal.show();
        } else if (window.ProfileModal) {
            // Fallback: создаем ProfileModal напрямую
            const profileModal = new window.ProfileModal(this.app);
            profileModal.show();
        } else {
            console.log('TopMenu: Открытие профиля пользователя', this.userInfo);
            // Временное уведомление
            this.showTemporaryNotification('👤 ProfileModal не найден');
        }
    }

    /**
     * 🏆 Открытие модального окна достижений
     */
    openAchievementsModal() {
        // TODO: Реализовать модальное окно достижений
        if (this.app?.openModal) {
            this.app.openModal('achievements');
        } else {
            console.log('TopMenu: Открытие достижений');
            this.showTemporaryNotification('🏆 Достижения в разработке');
        }
    }

    /**
     * ⚙️ Открытие модального окна настроек
     */
    openSettingsModal() {
        // TODO: Реализовать модальное окно настроек
        if (this.app?.openModal) {
            this.app.openModal('settings');
        } else {
            console.log('TopMenu: Открытие настроек');
            this.showTemporaryNotification('⚙️ Настройки в разработке');
        }
    }

    /**
     * ❓ Открытие модального окна помощи
     */
    openHelpModal() {
        // TODO: Реализовать модальное окно помощи
        if (this.app?.openModal) {
            this.app.openModal('help');
        } else {
            console.log('TopMenu: Открытие помощи');
            this.showTemporaryNotification('❓ Помощь в разработке');
        }
    }

    /**
     * ℹ️ Открытие модального окна "О приложении"
     */
    openAboutModal() {
        // TODO: Реализовать модальное окно "О приложении"
        if (this.app?.openModal) {
            this.app.openModal('about');
        } else {
            console.log('TopMenu: Открытие информации о приложении');
            this.showTemporaryNotification('ℹ️ О приложении в разработке');
        }
    }

    /**
     * 📢 Временное уведомление (заглушка)
     * @param {string} message - Сообщение
     */
    showTemporaryNotification(message) {
        // Простое уведомление до реализации Toast компонента
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color, #D2452C);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * 🔄 Подписка на изменения состояния
     */
    subscribeToStateChanges() {
        // Подписываемся на изменения пользователя
        if (this.state?.subscribe) {
            const subscription = this.state.subscribe('user', (newUser) => {
                this.userInfo = this.getUserInfo();
                this.updateUserInfo();
            });
            this.subscriptions.push(subscription);
        }
    }

    /**
     * 🔄 Обновление информации о пользователе в UI
     */
    updateUserInfo() {
        if (!this.overlay) return;
        
        const avatar = this.overlay.querySelector('.menu-user-avatar');
        const name = this.overlay.querySelector('.menu-user-details h3');
        const role = this.overlay.querySelector('.menu-user-details p');
        const stats = this.overlay.querySelector('.menu-stats');
        
        // Обновляем аватар
        if (avatar) {
            const showImage = this.userInfo.avatarUrl || this.userInfo.telegramPhotoUrl;
            avatar.innerHTML = showImage ? `
                <img 
                    src="${this.userInfo.avatarUrl || this.userInfo.telegramPhotoUrl}" 
                    alt="Аватар ${this.userInfo.name}"
                    class="menu-user-avatar-img"
                    onerror="this.style.display='none'; this.parentElement.classList.add('show-initials')"
                    onload="this.parentElement.classList.remove('show-initials')"
                >
                <span class="menu-user-avatar-initials">${this.userInfo.avatar}</span>
            ` : `
                <span class="menu-user-avatar-initials">${this.userInfo.avatar}</span>
            `;
        }
        
        if (name) name.textContent = this.userInfo.name;
        if (role) role.textContent = this.userInfo.role;
        if (stats) stats.textContent = this.formatUserStats();
    }

    /**
     * 🔄 Lifecycle: Показ компонента
     */
    onShow() {
        // Компонент всегда видим, но может понадобиться для анимаций
    }

    /**
     * 🔄 Lifecycle: Скрытие компонента
     */
    onHide() {
        this.close();
    }

    /**
     * 🧹 Очистка ресурсов
     */
    destroy() {
        // Закрываем меню
        this.close();

        // Отписываемся от событий
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];

        // Удаляем DOM элементы
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.overlay = null;
        
        console.log('TopMenu: Компонент уничтожен');
    }

    // 🎨 SVG ИКОНКИ (из концепта модалок)

    /**
     * 👤 Иконка профиля
     * @returns {string} SVG иконка
     */
    getProfileIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
}// ⬆️ ВЕРХНЕЕ МЕНЮ
// Меню "..." + модалки
