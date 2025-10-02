/**
 * 👤 ПРОФИЛЬ - ProfilePage.js
 * 
 * Страница профиля пользователя
 * Функциональность:
 * - Отображение и редактирование аватара
 * - Редактирование email
 * - Сброс теста/онбординга
 * - Отображение статистики пользователя
 * 
 * TODO: This page temporarily coexists with SettingsPage during migration.
 * TODO: After user verification, remove this page and redirect /profile to /settings.
 * TODO: Refactor shared handlers (avatar upload, email edit, reset test) into shared helper module.
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
        this.uploadingAvatar = false;
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
    }
    
    /**
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения профиля
        const profileSubscription = this.state.subscribe('user.profile', (profile) => {
            this.updateProfileUI(profile);
        });
        
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(profileSubscription, statsSubscription);
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        const profile = this.state.get('user.profile') || {};
        const stats = this.state.get('stats') || {};
        const telegramData = this.state.get('user.telegramData') || {};
        
        return `
            <div class="content profile-page">
                ${this.renderHeader()}
                ${this.renderProfileCard(profile, telegramData)}
                ${this.renderStatsSection(stats)}
                ${this.renderEmailSection(profile)}
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
                <p>Управление вашим профилем и персонализация</p>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер карточки профиля с аватаром
     */
    renderProfileCard(profile, telegramData) {
        const name = profile.name || profile.firstName || telegramData.first_name || 'Читатель';
        const username = profile.username || telegramData.username || '';
        const avatarUrl = profile.avatarUrl || telegramData.photo_url;
        const initials = this.getInitials(name);
        
        return `
            <div class="profile-card">
                <div class="profile-avatar-container">
                    ${this.renderAvatar(avatarUrl, initials)}
                    <button class="avatar-upload-btn" id="avatarUploadBtn" title="Изменить аватар">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </button>
                    <input type="file" id="avatarInput" accept="image/jpeg,image/png,image/webp" style="display: none;">
                </div>
                
                <h2 class="profile-name">${name}</h2>
                ${username ? `<p class="profile-username">@${username}</p>` : ''}
            </div>
        `;
    }
    
    /**
     * 🖼️ Рендер аватара
     */
    renderAvatar(avatarUrl, initials) {
        if (avatarUrl) {
            return `
                <div class="profile-avatar-large">
                    <img src="${avatarUrl}" alt="Аватар" class="profile-avatar-img" 
                         onerror="this.style.display='none'; this.parentElement.classList.add('fallback')">
                    <div class="profile-avatar-fallback">${initials}</div>
                </div>
            `;
        }
        
        return `
            <div class="profile-avatar-large fallback">
                <div class="profile-avatar-fallback">${initials}</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер секции статистики
     */
    renderStatsSection(stats) {
        return `
            <div class="profile-section">
                <h3>📊 Ваша статистика</h3>
                <div class="profile-stats-grid">
                    <div class="profile-stat-item">
                        <div class="profile-stat-value">${stats.totalQuotes || 0}</div>
                        <div class="profile-stat-label">Цитат</div>
                    </div>
                    <div class="profile-stat-item">
                        <div class="profile-stat-value">${stats.currentStreak || 0}</div>
                        <div class="profile-stat-label">Дней подряд</div>
                    </div>
                    <div class="profile-stat-item">
                        <div class="profile-stat-value">${stats.achievementsCount || 0}</div>
                        <div class="profile-stat-label">Достижений</div>
                    </div>
                    <div class="profile-stat-item">
                        <div class="profile-stat-value">${stats.totalBooks || 0}</div>
                        <div class="profile-stat-label">Книг</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📧 Рендер секции email
     */
    renderEmailSection(profile) {
        const email = profile.email || '';
        
        return `
            <div class="profile-section">
                <h3>📧 Email</h3>
                <div class="profile-email-container">
                    <input 
                        type="email" 
                        id="profileEmail" 
                        class="form-input" 
                        placeholder="email@example.com"
                        value="${email}"
                    >
                    <button class="btn btn-primary" id="saveEmailBtn">
                        💾 Сохранить
                    </button>
                </div>
                <p class="profile-hint">Email используется для восстановления доступа и уведомлений</p>
            </div>
        `;
    }
    
    /**
     * ⚙️ Рендер секции действий
     */
    renderActionsSection() {
        return `
            <div class="profile-section">
                <h3>⚙️ Действия</h3>
                
                <button class="btn btn-secondary btn-block" id="resetTestBtn">
                    🔄 Пройти тест заново
                </button>
                
                <p class="profile-hint">
                    Вы можете пройти персонализацию заново, чтобы обновить рекомендации
                </p>
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
        // Avatar upload button
        const avatarUploadBtn = document.getElementById('avatarUploadBtn');
        const avatarInput = document.getElementById('avatarInput');
        
        if (avatarUploadBtn && avatarInput) {
            avatarUploadBtn.addEventListener('click', () => {
                avatarInput.click();
            });
            
            avatarInput.addEventListener('change', (e) => {
                this.handleAvatarUpload(e);
            });
        }
        
        // Save email button
        const saveEmailBtn = document.getElementById('saveEmailBtn');
        if (saveEmailBtn) {
            saveEmailBtn.addEventListener('click', () => {
                this.handleEmailSave();
            });
        }
        
        // Reset test button
        const resetTestBtn = document.getElementById('resetTestBtn');
        if (resetTestBtn) {
            resetTestBtn.addEventListener('click', () => {
                this.handleResetTest();
            });
        }
    }
    
    /**
     * 🖼️ TODO: Refactor into shared helper module
     * Обработчик загрузки аватара
     */
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showError('Неподдерживаемый формат файла. Используйте JPG, PNG или WebP');
            return;
        }
        
        // Validate file size (max 3MB)
        const maxSize = 3 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('Файл слишком большой. Максимальный размер: 3MB');
            return;
        }
        
        try {
            this.uploadingAvatar = true;
            this.updateUploadButtonState(true);
            
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Get userId
            const userId = this.getUserId();
            
            // Upload avatar
            const result = await this.api.uploadAvatar(file, userId);
            
            if (result && result.avatarUrl) {
                // Update state
                const currentProfile = this.state.get('user.profile') || {};
                this.state.set('user.profile', {
                    ...currentProfile,
                    avatarUrl: result.avatarUrl
                });
                
                console.log('✅ Avatar uploaded successfully:', result.avatarUrl);
                
                // Haptic success feedback
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('success');
                }
            }
            
        } catch (error) {
            console.error('❌ Error uploading avatar:', error);
            this.showError(error.message || 'Не удалось загрузить аватар');
            
            // Haptic error feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        } finally {
            this.uploadingAvatar = false;
            this.updateUploadButtonState(false);
            
            // Clear input
            event.target.value = '';
        }
    }
    
    /**
     * 📧 TODO: Refactor into shared helper module
     * Обработчик сохранения email
     */
    async handleEmailSave() {
        const emailInput = document.getElementById('profileEmail');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        
        // Basic email validation
        if (email && !this.isValidEmail(email)) {
            this.showError('Неверный формат email');
            return;
        }
        
        try {
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Get userId
            const userId = this.getUserId();
            
            // Update profile
            const result = await this.api.updateProfile({ email }, userId);
            
            if (result) {
                // Update state
                const currentProfile = this.state.get('user.profile') || {};
                this.state.set('user.profile', {
                    ...currentProfile,
                    email: email
                });
                
                console.log('✅ Email updated successfully');
                
                // Show success message
                if (this.telegram?.showAlert) {
                    this.telegram.showAlert('Email успешно сохранен');
                } else {
                    alert('Email успешно сохранен');
                }
                
                // Haptic success feedback
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('success');
                }
            }
            
        } catch (error) {
            console.error('❌ Error saving email:', error);
            this.showError(error.message || 'Не удалось сохранить email');
            
            // Haptic error feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        }
    }
    
    /**
     * 🔄 TODO: Refactor into shared helper module
     * Обработчик сброса теста
     */
    async handleResetTest() {
        // Confirm action
        const confirmed = this.telegram?.showConfirm ?
            await new Promise(resolve => {
                this.telegram.showConfirm(
                    'Вы уверены, что хотите пройти персонализацию заново? Текущие рекомендации будут сброшены.',
                    resolve
                );
            }) :
            confirm('Вы уверены, что хотите пройти персонализацию заново? Текущие рекомендации будут сброшены.');
        
        if (!confirmed) return;
        
        try {
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('medium');
            }
            
            // Get userId
            const userId = this.getUserId();
            
            // Reset onboarding
            await this.api.resetOnboarding(userId);
            
            // Update state
            this.state.set('user.onboardingCompleted', false);
            this.state.set('user.testCompleted', false);
            
            console.log('✅ Test reset successfully');
            
            // Haptic success feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('success');
            }
            
            // Navigate to onboarding
            if (this.app?.router) {
                this.app.router.navigate('/onboarding', { replace: true });
            } else {
                window.location.hash = '#/onboarding';
            }
            
        } catch (error) {
            console.error('❌ Error resetting test:', error);
            this.showError(error.message || 'Не удалось сбросить тест');
            
            // Haptic error feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('error');
            }
        }
    }
    
    /**
     * 🔄 Обновление UI профиля
     */
    updateProfileUI(profile) {
        if (!profile) return;
        
        // Update avatar
        const avatarContainer = document.querySelector('.profile-avatar-large');
        if (avatarContainer && profile.avatarUrl) {
            const name = profile.name || profile.firstName || 'Читатель';
            const initials = this.getInitials(name);
            avatarContainer.outerHTML = this.renderAvatar(profile.avatarUrl, initials);
        }
        
        // Update name
        const nameElement = document.querySelector('.profile-name');
        if (nameElement && profile.name) {
            nameElement.textContent = profile.name;
        }
        
        // Update username
        const usernameElement = document.querySelector('.profile-username');
        if (usernameElement && profile.username) {
            usernameElement.textContent = `@${profile.username}`;
        }
        
        // Update email
        const emailInput = document.getElementById('profileEmail');
        if (emailInput && profile.email) {
            emailInput.value = profile.email;
        }
    }
    
    /**
     * 📊 Обновление UI статистики
     */
    updateStatsUI(stats) {
        if (!stats) return;
        
        const statValues = document.querySelectorAll('.profile-stat-value');
        if (statValues.length >= 4) {
            statValues[0].textContent = stats.totalQuotes || 0;
            statValues[1].textContent = stats.currentStreak || 0;
            statValues[2].textContent = stats.achievementsCount || 0;
            statValues[3].textContent = stats.totalBooks || 0;
        }
    }
    
    /**
     * 🔄 Обновление состояния кнопки загрузки
     */
    updateUploadButtonState(uploading) {
        const avatarUploadBtn = document.getElementById('avatarUploadBtn');
        if (avatarUploadBtn) {
            avatarUploadBtn.disabled = uploading;
            if (uploading) {
                avatarUploadBtn.classList.add('uploading');
            } else {
                avatarUploadBtn.classList.remove('uploading');
            }
        }
    }
    
    /**
     * 🆔 Получить userId
     */
    getUserId() {
        let userId = null;
        
        if (this.state && typeof this.state.getCurrentUserId === 'function') {
            userId = this.state.getCurrentUserId();
        } else if (this.state && this.state.get) {
            userId = this.state.get('user.profile.id') || 
                     this.state.get('user.profile.userId') ||
                     this.state.get('user.telegramData.id');
        }
        
        return userId || 'demo-user';
    }
    
    /**
     * 🔤 Получить инициалы из имени
     */
    getInitials(name) {
        if (!name) return '?';
        
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    /**
     * ✉️ Валидация email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * ⚠️ Показать ошибку
     */
    showError(message) {
        this.error = message;
        
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.style.display = 'flex';
            errorElement.querySelector('span').textContent = `⚠️ ${message}`;
        }
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(message);
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorElement) {
                errorElement.style.display = 'none';
            }
            this.error = null;
        }, 5000);
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
        this.uploadingAvatar = false;
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('👤 ProfilePage: onShow');
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
