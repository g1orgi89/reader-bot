/**
 * 👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ - ProfilePage.js
 * 
 * Переработанная страница профиля согласно новым требованиям:
 * - Загрузка/смена аватара
 * - Просмотр и изменение email
 * - Перезапуск теста (сброс только ответов)
 * - Только кнопка достижений и перезапуска теста
 * - Убрана лишняя статистика и действия
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
        
        return `
            <div class="content">
                ${this.renderHeader()}
                ${this.renderProfileCard(profile)}
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
                <h1>👤 Мой профиль</h1>
                <p>Управление аватаром, email и тестом</p>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер компактной карточки профиля
     */
    renderProfileCard(profile) {
        const name = profile.name || 
                    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
                    profile.username || 'Пользователь';
        const email = profile.email || 'Не указан';
        const initials = this.getInitials(name);
        const avatarUrl = profile.avatarUrl;
        
        return `
            <div class="profile-compact">
                <div class="profile-top-inline">
                    <div class="profile-avatar-inline ${!avatarUrl ? 'fallback' : ''}" id="profileAvatar">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="Аватар" onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />` : ''
                        }
                        <div class="avatar-fallback">${initials}</div>
                    </div>
                    
                    <div class="profile-name-row">
                        <div class="profile-name">${name}</div>
                    </div>
                    
                    <button class="profile-change-photo-btn" id="uploadAvatarBtn" ${this.uploadingAvatar ? 'disabled' : ''}>
                        ${this.uploadingAvatar ? '⏳ Загрузка...' : '📷 Изменить фото'}
                    </button>
                    <input type="file" id="avatarInput" accept="image/*" style="display: none;">
                </div>
                
                <div class="profile-email-row" id="emailRow">
                    <span class="email-text" id="emailDisplay">${email}</span>
                    <button class="email-edit-icon" id="editEmailBtn">✏️</button>
                    
                    <input type="email" class="profile-email-input" id="emailInput" value="${email}" style="display: none;">
                    <div class="profile-email-actions" id="emailActions" style="display: none;">
                        <button class="btn-icon btn-save" id="saveEmailBtn">💾</button>
                        <button class="btn-icon btn-cancel" id="cancelEmailBtn">❌</button>
                    </div>
                </div>
                
                <div class="profile-actions-compact">
                    <button class="btn btn-primary" id="viewAchievementsBtn">
                        🏆 Мои достижения
                    </button>
                    <button class="btn btn-warning" id="resetTestBtn">
                        🔄 Перезапустить тест
                    </button>
                </div>
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
        // Кнопка загрузки аватара
        const uploadBtn = document.getElementById('uploadAvatarBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.handleUploadAvatar());
        }
        
        // Скрытый input для файла аватара
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => this.handleAvatarFileSelect(e));
        }
        
        // Кнопка редактирования email
        const editEmailBtn = document.getElementById('editEmailBtn');
        if (editEmailBtn) {
            editEmailBtn.addEventListener('click', () => this.handleEditEmail());
        }
        
        // Кнопки сохранения/отмены email
        const saveEmailBtn = document.getElementById('saveEmailBtn');
        const cancelEmailBtn = document.getElementById('cancelEmailBtn');
        if (saveEmailBtn) {
            saveEmailBtn.addEventListener('click', () => this.handleSaveEmail());
        }
        if (cancelEmailBtn) {
            cancelEmailBtn.addEventListener('click', () => this.handleCancelEmail());
        }
        
        // Enter на поле email
        const emailInput = document.getElementById('emailInput');
        if (emailInput) {
            emailInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleSaveEmail();
                } else if (e.key === 'Escape') {
                    this.handleCancelEmail();
                }
            });
        }
        
        // Кнопка просмотра достижений
        const achievementsBtn = document.getElementById('viewAchievementsBtn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => this.handleViewAchievements());
        }
        
        // Кнопка сброса теста
        const resetTestBtn = document.getElementById('resetTestBtn');
        if (resetTestBtn) {
            resetTestBtn.addEventListener('click', () => this.handleResetTest());
        }
    }
    
    /**
     * 📷 Обработчик загрузки аватара
     */
    handleUploadAvatar() {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        // Открываем диалог выбора файла
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.click();
        }
    }
    
    /**
     * 📁 Обработчик выбора файла аватара с мгновенным превью
     */
    async handleAvatarFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            this.showError('Пожалуйста, выберите изображение');
            return;
        }
        
        // Проверяем размер файла (макс 3MB)
        if (file.size > 3 * 1024 * 1024) {
            this.showError('Файл слишком большой. Максимальный размер: 3MB');
            return;
        }
        
        // Создаем мгновенное превью
        const previewUrl = URL.createObjectURL(file);
        this.showAvatarPreview(previewUrl);
        
        try {
            this.uploadingAvatar = true;
            this.updateUploadButtonState();
            
            const userId = this.state.getCurrentUserId();
            const result = await this.api.uploadAvatar(file, userId);
            
            if (result.success) {
                // Обновляем данные профиля с окончательной URL от сервера
                this.profileData.avatarUrl = result.avatarUrl;
                this.state?.update('user.profile.avatarUrl', result.avatarUrl);
                
                // Очищаем превью и обновляем UI с финальным аватаром
                this.clearAvatarPreview();
                this.updateAvatarDisplay();
                
                // Haptic feedback успеха
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('light');
                }
                
                console.log('✅ Аватар обновлен');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            this.showError(error.message || 'Не удалось загрузить аватар');
            
            // В случае ошибки удаляем превью
            this.clearAvatarPreview();
            
            // Haptic feedback ошибки
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('heavy');
            }
        } finally {
            this.uploadingAvatar = false;
            this.updateUploadButtonState();
            
            // Освобождаем память
            URL.revokeObjectURL(previewUrl);
            
            // Очищаем input для возможности повторной загрузки того же файла
            event.target.value = '';
        }
    }
    
    /**
     * 🖼️ Показать мгновенное превью аватара
     */
    showAvatarPreview(previewUrl) {
        const avatarContainer = document.getElementById('profileAvatar');
        if (!avatarContainer) return;
        
        // Удаляем существующий превью если есть
        this.clearAvatarPreview();
        
        // Создаем элемент превью
        const previewOverlay = document.createElement('div');
        previewOverlay.className = 'avatar-preview-overlay';
        previewOverlay.style.backgroundImage = `url(${previewUrl})`;
        previewOverlay.id = 'avatarPreview';
        
        avatarContainer.appendChild(previewOverlay);
    }
    
    /**
     * 🧹 Очистить превью аватара
     */
    clearAvatarPreview() {
        const previewOverlay = document.getElementById('avatarPreview');
        if (previewOverlay) {
            previewOverlay.remove();
        }
    }
    
    /**
     * ✏️ Обработчик редактирования email
     */
    handleEditEmail() {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const emailDisplay = document.getElementById('emailDisplay');
        const emailInput = document.getElementById('emailInput');
        const emailActions = document.getElementById('emailActions');
        const editBtn = document.getElementById('editEmailBtn');
        
        // Переключаем в режим редактирования
        if (emailDisplay) emailDisplay.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        if (emailInput) {
            emailInput.style.display = 'inline-block';
            emailInput.focus();
            emailInput.select();
        }
        if (emailActions) emailActions.style.display = 'block';
    }
    
    /**
     * 💾 Обработчик сохранения email
     */
    async handleSaveEmail() {
        const emailInput = document.getElementById('emailInput');
        if (!emailInput) return;
        
        const newEmail = emailInput.value.trim();
        
        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            this.showError('Введите корректный email адрес');
            emailInput.focus();
            return;
        }
        
        try {
            const userId = this.state.getCurrentUserId();
            const result = await this.api.updateProfile({ email: newEmail }, userId);
            
            if (result.success) {
                // Обновляем данные профиля
                this.profileData.email = newEmail;
                this.state?.update('user.profile.email', newEmail);
                
                // Обновляем UI
                this.updateEmailDisplay(newEmail);
                this.handleCancelEmail(); // Выходим из режима редактирования
                
                // Haptic feedback успеха
                if (this.telegram?.hapticFeedback) {
                    this.telegram.hapticFeedback('light');
                }
                
                console.log('✅ Email обновлен');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления email:', error);
            this.showError(error.message || 'Не удалось обновить email');
            
            // Haptic feedback ошибки
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('heavy');
            }
        }
    }
    
    /**
     * ❌ Обработчик отмены редактирования email
     */
    handleCancelEmail() {
        const emailDisplay = document.getElementById('emailDisplay');
        const emailInput = document.getElementById('emailInput');
        const emailActions = document.getElementById('emailActions');
        const editBtn = document.getElementById('editEmailBtn');
        
        // Возвращаем исходное значение
        if (emailInput) {
            emailInput.value = this.profileData.email || '';
        }
        
        // Переключаем обратно в режим просмотра
        if (emailDisplay) emailDisplay.style.display = 'inline';
        if (editBtn) editBtn.style.display = 'inline';
        if (emailInput) emailInput.style.display = 'none';
        if (emailActions) emailActions.style.display = 'none';
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
     * 🔄 Обработчик сброса теста
     */
    async handleResetTest() {
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('medium');
        }
        
        // Подтверждение от пользователя
        const confirmed = confirm('Вы уверены, что хотите перезапустить тест? Все ваши ответы будут удалены, но профиль и статистика сохранятся.');
        
        if (!confirmed) return;
        
        try {
            const userId = this.state.getCurrentUserId();
            
            // RETAKE: Опциональный вызов backend reset (если API доступен)
            try {
                const result = await this.api.resetTest(userId);
                if (result.success) {
                    console.log('✅ Backend reset выполнен успешно');
                }
            } catch (apiError) {
                console.warn('⚠️ Backend reset недоступен, продолжаем с локальным сбросом:', apiError.message);
            }
            
            // RETAKE: Обновляем локальное состояние приложения
            this.state?.set('user.profile.isOnboardingCompleted', false);
            this.state?.set('user.testResults', null);
            
            // RETAKE: Устанавливаем флаг принудительного повторного прохождения
            this.state?.set('onboarding.forceRetake', true);
            
            // RETAKE: Очищаем только специфичные ключи localStorage
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('onboardingComplete');
                localStorage.removeItem('testResults');
            }
            
            // Haptic feedback успеха
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('light');
            }
            
            // Показываем сообщение
            if (this.telegram?.showAlert) {
                this.telegram.showAlert('Тест сброшен! Перенаправляем на прохождение...');
            }
            
            // RETAKE: Перенаправляем на онбординг в режиме повторного прохождения немедленно
            // Используем минимальную задержку для обеспечения стабильности UI (100-150ms)
            setTimeout(() => {
                // Навигация с query параметром retake=1 и флагом force для немедленного перехода
                if (this.app.router && typeof this.app.router.navigate === 'function') {
                    this.app.router.navigate('/onboarding?retake=1', { force: true });
                } else {
                    // Fallback через hash
                    window.location.hash = '#/onboarding?retake=1';
                }
            }, 150);
            
            console.log('✅ Тест сброшен успешно, режим повторного прохождения активирован');
            
        } catch (error) {
            console.error('❌ Ошибка сброса теста:', error);
            this.showError(error.message || 'Не удалось сбросить тест');
            
            // Haptic feedback ошибки
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('heavy');
            }
        }
    }
    
    /**
     * 🔄 Обновление UI профиля
     */
    updateProfileUI() {
        // Update profile info if page is rendered
        const emailDisplay = document.getElementById('emailDisplay');
        
        if (emailDisplay && this.profileData.email) {
            emailDisplay.textContent = this.profileData.email;
        }
        
        // Обновляем аватар
        this.updateAvatarDisplay();
    }
    
    /**
     * 🖼️ Обновление отображения аватара
     */
    updateAvatarDisplay() {
        const avatarContainer = document.getElementById('profileAvatar');
        if (!avatarContainer) return;
        
        const { avatarUrl, name } = this.profileData;
        const initials = this.getInitials(name) || '👤';
        
        if (avatarUrl) {
            avatarContainer.innerHTML = `
                <img src="${avatarUrl}" alt="Аватар" onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                <div class="avatar-fallback">${initials}</div>
            `;
            avatarContainer.classList.remove('fallback');
        } else {
            avatarContainer.innerHTML = `
                <div class="avatar-fallback">${initials}</div>
            `;
            avatarContainer.classList.add('fallback');
        }
    }
    
    /**
     * 📧 Обновление отображения email
     */
    updateEmailDisplay(newEmail) {
        const emailDisplay = document.getElementById('emailDisplay');
        if (emailDisplay) {
            emailDisplay.textContent = newEmail;
        }
    }
    
    /**
     * ⏳ Обновление состояния кнопки загрузки
     */
    updateUploadButtonState() {
        const uploadBtn = document.getElementById('uploadAvatarBtn');
        if (!uploadBtn) return;
        
        if (this.uploadingAvatar) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = '⏳ Загрузка...';
        } else {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📷 Изменить фото';
        }
    }
    
    /**
     * ⚠️ Показать ошибку
     */
    showError(message) {
        this.error = message;
        
        // Обновляем UI ошибки если элемент существует
        const errorEl = document.getElementById('errorMessage');
        if (errorEl) {
            errorEl.innerHTML = `
                <span>⚠️ ${message}</span>
                <button onclick="this.parentElement.style.display='none'">✕</button>
            `;
            errorEl.style.display = 'block';
            
            // Автоматически скрываем через 5 секунд
            setTimeout(() => {
                if (errorEl.style.display !== 'none') {
                    errorEl.style.display = 'none';
                }
            }, 5000);
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