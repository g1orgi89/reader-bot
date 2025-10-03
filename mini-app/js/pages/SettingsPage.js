/**
 * ⚙️ НАСТРОЙКИ - SettingsPage.js
 * 
 * Полноэкранная страница настроек приложения
 * Функциональность:
 * - Профиль пользователя (аватар, email, статистика)
 * - Настройки уведомлений
 * - Персонализация интерфейса
 * - Параметры конфиденциальности
 * - Управление данными
 * - Интеграция с API и State Management
 * - Использует существующий дизайн-систему
 */

class SettingsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        this.settings = {};
        this.saving = false;
        this.uploadingAvatar = false;
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        // 🎯 Feature flags for soft hiding sections
        this.settingsFeatureFlags = {
            notifications: true,
            personalization: false,
            privacy: false,
            dataExport: false,
            cacheClear: false
        };
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
        this.loadSettings();
    }
    
    /**
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения настроек
        const settingsSubscription = this.state.subscribe('settings', (settings) => {
            this.settings = { ...this.settings, ...settings };
            this.updateSettingsUI();
        });
        
        // Подписка на изменения профиля
        const profileSubscription = this.state.subscribe('user.profile', (profile) => {
            this.updateProfileUI(profile);
        });
        
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.updateStatsUI(stats);
        });
        
        this.subscriptions.push(settingsSubscription, profileSubscription, statsSubscription);
    }
    
    /**
     * 📊 Загрузка настроек
     */
    async loadSettings() {
        if (this.loading) return;
        
        try {
            this.loading = true;
            
            // Load from local state first
            const localSettings = this.state.get('settings') || this.getDefaultSettings();
            
            // Get userId with fallback methods
            let userId = null;
            if (this.state && typeof this.state.getCurrentUserId === 'function') {
                userId = this.state.getCurrentUserId();
            } else if (this.state && this.state.get) {
                userId = this.state.get('user.profile.id') || this.state.get('user.telegramData.id');
            }
            
            if (!userId || userId === 'demo-user') {
                this.settings = this.adaptLegacySettings(localSettings);
                return;
            }
            
            // Load from API if available
            try {
                const serverResponse = await this.api.getSettings(userId);
                const serverSettings = serverResponse?.settings || serverResponse || {};
                
                if (serverSettings) {
                    const combinedSettings = { ...localSettings, ...serverSettings };
                    this.settings = this.adaptLegacySettings(combinedSettings);
                    this.state.set('settings', this.settings);
                }
            } catch (apiError) {
                console.warn('⚠️ Не удалось загрузить настройки с сервера');
                this.settings = this.adaptLegacySettings(localSettings);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            this.error = error.message;
            this.settings = this.getDefaultSettings();
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        const profile = this.state.get('user.profile') || {};
        const stats = this.state.get('stats') || {};
        const telegramData = this.state.get('user.telegramData') || {};
        
        return `
            <div class="content">
                ${this.renderHeader()}
                ${this.renderProfileSection(profile, stats, telegramData)}
                ${this.settingsFeatureFlags.notifications ? this.renderNotificationSettings() : ''}
                ${this.settingsFeatureFlags.personalization ? this.renderPersonalizationSettings() : ''}
                ${this.settingsFeatureFlags.privacy ? this.renderPrivacySettings() : ''}
                ${this.renderDataSettings()}
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
                <h1>⚙️ Настройки</h1>
                <p>Персонализируйте ваш опыт использования</p>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер секции профиля
     */
    renderProfileSection(profile, stats, telegramData) {
        const name = profile.name || profile.firstName || telegramData.first_name || 'Читатель';
        const username = profile.username || telegramData.username || '';
        const avatarUrl = profile.avatarUrl || telegramData.photo_url;
        const initials = this.getInitials(name);
        const email = profile.email || '';
        
        return `
            <div class="settings-section profile-header-section">
                <div class="profile-header-card">
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
                    
                    <div class="profile-info">
                        <h2 class="profile-name">${name}</h2>
                        ${username ? `<p class="profile-username">@${username}</p>` : ''}
                        
                        <div class="profile-mini-stats">
                            <span class="mini-stat">${stats.totalQuotes || 0} цитат</span>
                            <span class="mini-stat">${stats.currentStreak || 0} дней</span>
                            <span class="mini-stat">${stats.achievementsCount || 0} наград</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-email-section">
                    <label class="settings-label">📧 Email</label>
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
                    <p class="settings-hint">Email используется для восстановления доступа и уведомлений</p>
                </div>
                
                <div class="profile-actions-section">
                    <button class="btn btn-secondary btn-block" id="resetTestBtn">
                        🔄 Пройти тест заново
                    </button>
                    <p class="settings-hint">Вы можете пройти персонализацию заново, чтобы обновить рекомендации</p>
                </div>
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
     * 🔔 Рендер настроек уведомлений
     */
    renderNotificationSettings() {
        const settings = this.settings;
        const reminders = settings.reminders || {};
        const achievements = settings.achievements || {};
        const weeklyReports = settings.weeklyReports || {};
        const announcements = settings.announcements || {};

        return `
            <div class="settings-section">
                <h3>🔔 Уведомления</h3>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Напоминания</h4>
                        <p>Получать напоминания о добавлении цитат</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="remindersEnabled" ${reminders.enabled !== false ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Частота напоминаний</h4>
                        <p>Как часто получать напоминания</p>
                    </div>
                    <select class="form-select" id="reminderFrequency">
                        <option value="often" ${reminders.frequency === 'often' ? 'selected' : ''}>Часто (3 раза / день)</option>
                        <option value="standard" ${reminders.frequency === 'standard' ? 'selected' : ''}>Стандартно (утром)</option>
                        <option value="rare" ${reminders.frequency === 'rare' ? 'selected' : ''}>Редко (2 раза в неделю)</option>
                        <option value="off" ${reminders.frequency === 'off' ? 'selected' : ''}>Выключено</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Уведомления о достижениях</h4>
                        <p>Получать уведомления о новых наградах</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="achievementsEnabled" ${achievements.enabled !== false ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Еженедельные отчёты</h4>
                        <p>Получать уведомления о готовых отчётах</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="weeklyReportsEnabled" ${weeklyReports.enabled !== false ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Анонсы</h4>
                        <p>Получать уведомления о новых возможностях</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="announcementsEnabled" ${announcements.enabled !== false ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎨 Рендер настроек персонализации
     */
    renderPersonalizationSettings() {
        return `
            <div class="settings-section">
                <h3>🎨 Персонализация</h3>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Тема оформления</h4>
                        <p>Выберите предпочитаемую тему</p>
                    </div>
                    <select class="form-select" id="theme">
                        <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>Как в системе</option>
                        <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Светлая</option>
                        <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Темная</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Размер шрифта</h4>
                        <p>Настройте удобный размер текста</p>
                    </div>
                    <select class="form-select" id="fontSize">
                        <option value="small" ${this.settings.fontSize === 'small' ? 'selected' : ''}>Маленький</option>
                        <option value="medium" ${this.settings.fontSize === 'medium' ? 'selected' : ''}>Средний</option>
                        <option value="large" ${this.settings.fontSize === 'large' ? 'selected' : ''}>Большой</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Анимации</h4>
                        <p>Включить плавные переходы и анимации</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="animations" ${this.settings.animations ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔒 Рендер настроек конфиденциальности
     */
    renderPrivacySettings() {
        return `
            <div class="settings-section">
                <h3>🔒 Конфиденциальность</h3>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Аналитика использования</h4>
                        <p>Помогать улучшать приложение анонимными данными</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="analytics" ${this.settings.analytics ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Публичный профиль</h4>
                        <p>Разрешить другим пользователям видеть ваш профиль</p>
                    </div>
                    <div class="form-toggle">
                        <input type="checkbox" id="publicProfile" ${this.settings.publicProfile ? 'checked' : ''}>
                        <div class="toggle-switch"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер настроек данных
     */
    renderDataSettings() {
        return `
            <div class="settings-section">
                <h3>📊 Управление данными</h3>
                
                ${this.settingsFeatureFlags.dataExport ? `
                <button class="btn btn-secondary btn-block" id="exportDataBtn">
                    📤 Экспорт данных
                </button>
                ` : ''}
                
                ${this.settingsFeatureFlags.cacheClear ? `
                <button class="btn btn-secondary btn-block" id="clearCacheBtn">
                    🗑️ Очистить кэш
                </button>
                ` : ''}
                
                <button class="btn btn-error btn-block" id="deleteAccountBtn">
                    ⚠️ Удалить аккаунт
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
        // Profile section
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
        
        const saveEmailBtn = document.getElementById('saveEmailBtn');
        if (saveEmailBtn) {
            saveEmailBtn.addEventListener('click', () => {
                this.handleEmailSave();
            });
        }
        
        const resetTestBtn = document.getElementById('resetTestBtn');
        if (resetTestBtn) {
            resetTestBtn.addEventListener('click', () => {
                this.handleResetTest();
            });
        }
        
        // Toggle switches
        const toggles = document.querySelectorAll('.form-toggle input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => this.handleToggleChange(e));
        });
        
        // Select dropdowns
        const selects = document.querySelectorAll('.form-select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => this.handleSelectChange(e));
        });
        
        // Action buttons (guard with feature flags)
        if (this.settingsFeatureFlags.dataExport) {
            const exportBtn = document.getElementById('exportDataBtn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.handleExportData());
            }
        }
        
        if (this.settingsFeatureFlags.cacheClear) {
            const clearCacheBtn = document.getElementById('clearCacheBtn');
            if (clearCacheBtn) {
                clearCacheBtn.addEventListener('click', () => this.handleClearCache());
            }
        }
        
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => this.handleDeleteAccount());
        }
    }
    
    /**
     * 🖼️ Обработчик загрузки аватара
     * 🔧 PATCH: Increased limit to 5MB + client-side compression
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
        
        // 🔧 PATCH: Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('Файл слишком большой. Максимальный размер: 5MB');
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
            
            // 🔧 PATCH: Compress image if >1.5MB
            let fileToUpload = file;
            const compressionThreshold = 1.5 * 1024 * 1024;
            
            if (file.size > compressionThreshold) {
                console.log(`🔄 Image size ${(file.size / 1024 / 1024).toFixed(2)}MB, compressing...`);
                fileToUpload = await this.compressImage(file);
                console.log(`✅ Image compressed to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
            }
            
            // Upload avatar
            const result = await this.api.uploadAvatar(fileToUpload, userId);
            
            // 🔧 PATCH: Prevent overwriting existing avatarUrl when server returns null
            if (result && result.avatarUrl) {
                this.state.update('user.profile', { avatarUrl: result.avatarUrl });
                
                console.log('✅ Avatar uploaded successfully:', result.avatarUrl);
                
                // Haptic success feedback
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('success');
                }
            } else if (result && result.success && !result.avatarUrl) {
                // Server returned success but no avatarUrl - don't overwrite existing
                console.warn('⚠️ Server returned success without avatarUrl, keeping existing avatar');
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
     * 🗜️ PATCH: Compress image using canvas (resize to max 1024px, WebP quality ~0.82)
     */
    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions (max 1024px)
                    const maxSize = 1024;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height && width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw image
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob (WebP, quality 0.82)
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                // Create a new File object
                                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                                    type: 'image/webp',
                                    lastModified: Date.now()
                                });
                                resolve(compressedFile);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/webp',
                        0.82
                    );
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 📧 Обработчик сохранения email
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
     * 🔄 Обработчик сброса теста
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
            
            // Navigate to onboarding with retake flag
            if (this.app?.router) {
                this.app.router.navigate('/onboarding?retake=1', { replace: true });
            } else {
                window.location.hash = '#/onboarding?retake=1';
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
     * 🔄 Обработчик изменения переключателей
     */
    handleToggleChange(event) {
        const { id, checked } = event.target;
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        this.updateSetting(id, checked);
    }
    
    /**
     * 📝 Обработчик изменения выпадающих списков
     */
    handleSelectChange(event) {
        const { id, value } = event.target;
        
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        this.updateSetting(id, value);
    }
    
    /**
     * 💾 Обновление настройки
     */
    async updateSetting(key, value) {
        // Create deep clone for rollback
        const previousSettings = JSON.parse(JSON.stringify(this.settings));
        
        try {
            // Disable all inputs while saving
            this.setSavingState(true);
            
            // Handle structured settings based on the field ID
            switch (key) {
                case 'remindersEnabled':
                    if (!this.settings.reminders) this.settings.reminders = {};
                    this.settings.reminders.enabled = value;
                    break;
                case 'reminderFrequency':
                    if (!this.settings.reminders) this.settings.reminders = {};
                    this.settings.reminders.frequency = value;
                    break;
                case 'achievementsEnabled':
                    if (!this.settings.achievements) this.settings.achievements = {};
                    this.settings.achievements.enabled = value;
                    break;
                case 'weeklyReportsEnabled':
                    if (!this.settings.weeklyReports) this.settings.weeklyReports = {};
                    this.settings.weeklyReports.enabled = value;
                    break;
                case 'announcementsEnabled':
                    if (!this.settings.announcements) this.settings.announcements = {};
                    this.settings.announcements.enabled = value;
                    break;
                default:
                    // Handle legacy or other settings
                    this.settings[key] = value;
                    break;
            }
            
            // Update local state
            this.state.set('settings', this.settings);
            
            // Save to server if possible
            await this.saveSettings();
            
            // Update UI to reflect changes
            this.updateSettingsUI();
            
        } catch (error) {
            console.error('❌ Ошибка сохранения настройки:', error);
            
            // Rollback to previous state
            this.settings = previousSettings;
            this.state.set('settings', this.settings);
            this.updateSettingsUI();
            
            this.showError('Не удалось сохранить настройку');
        } finally {
            // Re-enable all inputs
            this.setSavingState(false);
        }
    }
    
    /**
     * 🔒 Set saving state for UI elements
     */
    setSavingState(saving) {
        this.saving = saving;
        
        // Disable/enable all input elements
        const inputs = document.querySelectorAll('.settings-page input, .settings-page select');
        inputs.forEach(input => {
            input.disabled = saving;
        });
    }
    
    /**
     * 💾 Сохранение настроек на сервер
     */
    async saveSettings() {
        if (this.saving) return;
        
        try {
            this.saving = true;
            
            // Get userId with fallback methods
            let userId = null;
            if (this.state && typeof this.state.getCurrentUserId === 'function') {
                userId = this.state.getCurrentUserId();
            } else if (this.state && this.state.get) {
                userId = this.state.get('user.profile.id') || this.state.get('user.telegramData.id');
            }
            
            if (!userId || userId === 'demo-user') {
                return; // Only save locally for demo users
            }
            
            // Convert to canonical structure before saving
            const canonicalSettings = this.toCanonicalSettings(this.settings);
            await this.api.saveSettings(userId, canonicalSettings);
            
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить настройки на сервер:', error);
        } finally {
            this.saving = false;
        }
    }
    
    /**
     * 📤 Обработчик экспорта данных
     */
    handleExportData() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        // TODO: Implement data export
        if (this.telegram?.showAlert) {
            this.telegram.showAlert('Экспорт данных будет реализован в следующих версиях');
        }
    }
    
    /**
     * 🗑️ Обработчик очистки кэша
     */
    async handleClearCache() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        try {
            // Clear local storage cache
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('reader-bot-')) {
                    localStorage.removeItem(key);
                }
            });
            
            if (this.telegram?.showAlert) {
                this.telegram.showAlert('Кэш успешно очищен');
            }
            
        } catch (error) {
            console.error('❌ Ошибка очистки кэша:', error);
            this.showError('Не удалось очистить кэш');
        }
    }
    
    /**
     * ⚠️ Обработчик удаления аккаунта
     */
    handleDeleteAccount() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('error');
        }
        
        if (this.telegram?.showConfirm) {
            this.telegram.showConfirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.', (confirmed) => {
                if (confirmed) {
                    // TODO: Implement account deletion
                    this.telegram.showAlert('Удаление аккаунта будет реализовано в следующих версиях');
                }
            });
        } else {
            const confirmed = confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.');
            if (confirmed) {
                // TODO: Implement account deletion
                alert('Удаление аккаунта будет реализовано в следующих версиях');
            }
        }
    }
    
    /**
     * 🔄 Обновление UI настроек
     */
    updateSettingsUI() {
        // Handle nested settings objects
        const settingsMap = {
            'remindersEnabled': this.settings.reminders?.enabled,
            'reminderFrequency': this.settings.reminders?.frequency,
            'achievementsEnabled': this.settings.achievements?.enabled,
            'weeklyReportsEnabled': this.settings.weeklyReports?.enabled,
            'announcementsEnabled': this.settings.announcements?.enabled,
            'theme': this.settings.theme,
            'fontSize': this.settings.fontSize,
            'animations': this.settings.animations,
            'analytics': this.settings.analytics,
            'publicProfile': this.settings.publicProfile
        };

        Object.entries(settingsMap).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element && value !== undefined) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
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
        
        const miniStats = document.querySelectorAll('.mini-stat');
        if (miniStats.length >= 3) {
            miniStats[0].textContent = `${stats.totalQuotes || 0} цитат`;
            miniStats[1].textContent = `${stats.currentStreak || 0} дней`;
            miniStats[2].textContent = `${stats.achievementsCount || 0} наград`;
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
     * 🔧 Получить настройки по умолчанию (canonical structure)
     */
    getDefaultSettings() {
        return {
            reminders: {
                enabled: true,
                frequency: 'often'
            },
            achievements: {
                enabled: true
            },
            weeklyReports: {
                enabled: true
            },
            announcements: {
                enabled: true
            },
            theme: 'auto',
            fontSize: 'medium',
            animations: true,
            analytics: true,
            publicProfile: false
        };
    }
    
    /**
     * 🔄 Convert legacy structure to canonical
     * @param {Object} settings - Settings with possible legacy structure
     * @returns {Object} Settings with canonical structure
     */
    adaptLegacySettings(settings) {
        if (!settings) return this.getDefaultSettings();
        
        const adapted = { ...settings };
        
        // Handle legacy notifications structure
        if (settings.notifications) {
            if (!adapted.reminders) adapted.reminders = {};
            if (!adapted.achievements) adapted.achievements = {};
            if (!adapted.weeklyReports) adapted.weeklyReports = {};
            if (!adapted.announcements) adapted.announcements = {};
            
            if (settings.notifications.daily !== undefined) {
                adapted.reminders.enabled = settings.notifications.daily;
            }
            if (settings.notifications.weekly !== undefined) {
                adapted.weeklyReports.enabled = settings.notifications.weekly;
            }
            if (settings.notifications.achievements !== undefined) {
                adapted.achievements.enabled = settings.notifications.achievements;
            }
        }
        
        // Handle other legacy keys
        if (settings.dailyReminders !== undefined && !adapted.reminders?.enabled) {
            if (!adapted.reminders) adapted.reminders = {};
            adapted.reminders.enabled = settings.dailyReminders;
        }
        if (settings.achievementNotifications !== undefined && !adapted.achievements?.enabled) {
            if (!adapted.achievements) adapted.achievements = {};
            adapted.achievements.enabled = settings.achievementNotifications;
        }
        
        // Ensure canonical structure with defaults
        if (!adapted.reminders) {
            adapted.reminders = { enabled: true, frequency: 'often' };
        } else {
            if (adapted.reminders.enabled === undefined) adapted.reminders.enabled = true;
            if (!adapted.reminders.frequency) adapted.reminders.frequency = 'often';
        }
        
        if (!adapted.achievements) adapted.achievements = { enabled: true };
        if (adapted.achievements.enabled === undefined) adapted.achievements.enabled = true;
        
        if (!adapted.weeklyReports) adapted.weeklyReports = { enabled: true };
        if (adapted.weeklyReports.enabled === undefined) adapted.weeklyReports.enabled = true;
        
        if (!adapted.announcements) adapted.announcements = { enabled: true };
        if (adapted.announcements.enabled === undefined) adapted.announcements.enabled = true;
        
        return adapted;
    }
    
    /**
     * 📤 Convert settings to canonical structure for server
     * @param {Object} settings - Current settings
     * @returns {Object} Canonical settings structure
     */
    toCanonicalSettings(settings) {
        return {
            reminders: {
                enabled: settings.reminders?.enabled ?? true,
                frequency: settings.reminders?.frequency ?? 'often'
            },
            achievements: {
                enabled: settings.achievements?.enabled ?? true
            },
            weeklyReports: {
                enabled: settings.weeklyReports?.enabled ?? true
            },
            announcements: {
                enabled: settings.announcements?.enabled ?? true
            },
            theme: settings.theme,
            fontSize: settings.fontSize,
            animations: settings.animations,
            analytics: settings.analytics,
            publicProfile: settings.publicProfile
        };
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
        this.saving = false;
        this.uploadingAvatar = false;
        this.settings = {};
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('⚙️ SettingsPage: onShow');
        // Refresh settings if needed
        if (Object.keys(this.settings).length === 0) {
            this.loadSettings();
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('⚙️ SettingsPage: onHide');
    }
}

// 📤 Экспорт класса
window.SettingsPage = SettingsPage;