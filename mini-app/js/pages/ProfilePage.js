/**
 * 👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ - ProfilePage.js
 * 
 * Полноэкранная страница профиля пользователя
 * Функциональность:
 * - Отображение данных профиля (имя, email, статистика)
 * - Редактирование основных данных
 * - Статистика достижений пользователя
 * - Интеграция с API и State Management
 * - Использует существующий дизайн-систему
 */

class ProfilePage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        this.profileData = {};
        this.editing = false;
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
        this.loadProfileData();
    }
    
    /**
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения профиля пользователя
        const profileSubscription = this.state.subscribe('user.profile', (profile) => {
            this.profileData = { ...this.profileData, ...profile };
            this.updateProfileUI();
        });
        
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(profileSubscription, statsSubscription);
    }
    
    /**
     * 📊 Загрузка данных профиля
     */
    async loadProfileData() {
        if (this.loading) return;
        
        try {
            this.loading = true;
            
            // Get userId with fallback methods
            let userId = null;
            if (this.state && typeof this.state.getCurrentUserId === 'function') {
                userId = this.state.getCurrentUserId();
            } else if (this.state && this.state.get) {
                userId = this.state.get('user.profile.id') || this.state.get('user.telegramData.id');
            }
            
            if (!userId || userId === 'demo-user') {
                // Use local data
                this.profileData = this.state?.get('user.profile') || {};
                return;
            }
            
            // Load from API if available
            try {
                const profile = await this.api.getProfile(userId);
                if (profile) {
                    this.profileData = profile.user || profile;
                    this.state?.update('user.profile', this.profileData);
                }
            } catch (apiError) {
                console.warn('⚠️ API недоступен, используем локальные данные');
                this.profileData = this.state?.get('user.profile') || {};
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            this.error = error.message;
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        const profile = this.profileData;
        const stats = this.state.get('stats') || {};
        
        return `
            <div class="content">
                ${this.renderHeader()}
                ${this.renderProfileCard(profile)}
                ${this.renderStatsSection(stats)}
                ${this.renderActionsSection()}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка страницы
     */
    renderHeader() {
        return `
            <div class="page-header">
                <h1>👤 Профиль</h1>
                <p>Управление вашими данными</p>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер карточки профиля
     */
    renderProfileCard(profile) {
        const name = profile.name || 
                    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
                    profile.username || 'Пользователь';
        const initials = this.getInitials(name);
        
        return `
            <div class="profile-card">
                <div class="profile-avatar-large">${initials}</div>
                <div class="profile-info">
                    <h2 class="profile-name">${name}</h2>
                    <p class="profile-username">@${profile.username || 'user'}</p>
                    ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" id="editProfileBtn">
                    ✏️ Редактировать
                </button>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер секции статистики
     */
    renderStatsSection(stats) {
        return `
            <div class="stats-section">
                <h3>📈 Ваша статистика</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${stats.totalQuotes || 0}</div>
                        <div class="stat-label">Цитат собрано</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.currentStreak || 0}</div>
                        <div class="stat-label">Дней подряд</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.longestStreak || 0}</div>
                        <div class="stat-label">Лучшая серия</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${stats.favoriteAuthors?.length || 0}</div>
                        <div class="stat-label">Любимых авторов</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * ⚡ Рендер секции действий
     */
    renderActionsSection() {
        return `
            <div class="actions-section">
                <h3>⚡ Действия</h3>
                <button class="btn btn-primary btn-block" id="viewAchievementsBtn">
                    🏆 Посмотреть достижения
                </button>
                <button class="btn btn-secondary btn-block" id="exportDataBtn">
                    📤 Экспорт данных
                </button>
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер ошибки
     */
    renderError() {
        if (!this.error) return '';
        
        return `
            <div class="error-message" id="errorMessage">
                <span>⚠️ ${this.error}</span>
                <button onclick="this.parentElement.style.display='none'">✕</button>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Кнопка редактирования профиля
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.handleEditProfile());
        }
        
        // Кнопка просмотра достижений
        const achievementsBtn = document.getElementById('viewAchievementsBtn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => this.handleViewAchievements());
        }
        
        // Кнопка экспорта данных
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExportData());
        }
    }
    
    /**
     * ✏️ Обработчик редактирования профиля
     */
    handleEditProfile() {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // TODO: Implement edit functionality or navigate to edit page
        console.log('Edit profile clicked');
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert('Редактирование профиля будет доступно в следующих версиях');
        }
    }
    
    /**
     * 🏆 Обработчик просмотра достижений
     */
    handleViewAchievements() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // Navigate to achievements page
        window.location.hash = '/achievements';
    }
    
    /**
     * 📤 Обработчик экспорта данных
     */
    handleExportData() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // TODO: Implement data export functionality
        console.log('Export data clicked');
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert('Экспорт данных будет доступен в следующих версиях');
        }
    }
    
    /**
     * 🔄 Обновление UI профиля
     */
    updateProfileUI() {
        // Update profile info if page is rendered
        const nameEl = document.querySelector('.profile-name');
        const usernameEl = document.querySelector('.profile-username');
        const avatarEl = document.querySelector('.profile-avatar-large');
        
        if (nameEl && this.profileData.name) {
            nameEl.textContent = this.profileData.name;
        }
        
        if (usernameEl && this.profileData.username) {
            usernameEl.textContent = '@' + this.profileData.username;
        }
        
        if (avatarEl && this.profileData.name) {
            avatarEl.textContent = this.getInitials(this.profileData.name);
        }
    }
    
    /**
     * 📊 Обновление UI статистики
     */
    updateStatsUI(stats) {
        // Update stats if page is rendered
        const statItems = document.querySelectorAll('.stat-number');
        if (statItems.length >= 4) {
            statItems[0].textContent = stats.totalQuotes || 0;
            statItems[1].textContent = stats.currentStreak || 0;
            statItems[2].textContent = stats.longestStreak || 0;
            statItems[3].textContent = stats.favoriteAuthors?.length || 0;
        }
    }
    
    /**
     * 🔤 Получение инициалов из имени
     */
    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
    
    /**
     * 🧹 Очистка подписок при уничтожении
     */
    destroy() {
        // Отписка от всех подписок
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.editing = false;
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('👤 ProfilePage: onShow');
        // Refresh data if needed
        if (!this.profileData.name) {
            this.loadProfileData();
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('👤 ProfilePage: onHide');
    }
}

// 📤 Экспорт класса
window.ProfilePage = ProfilePage;