/**
 * 👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ - ProfileModal.js
 * 
 * Функциональность:
 * - Редактирование данных профиля (имя, email, о себе)
 * - Статистика достижений пользователя
 * - Настройки персонализации
 * - Возможность пересдать тест (7 вопросов)
 * - Интеграция с Telegram Web App
 * - Автосохранение изменений
 */

class ProfileModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние модального окна
        this.modal = null;
        this.isVisible = false;
        this.profileData = {};
        this.stats = {};
        this.saving = false;
        
        // Состояние загрузки аватара
        this.uploadingAvatar = false;
        this.currentPreviewUrl = null;
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация модального окна профиля
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
            this.stats = stats;
            this.updateStatsUI();
        });
        
        this.subscriptions.push(profileSubscription, statsSubscription);
    }
    
    /**
     * 📊 Загрузка данных профиля
     */
    async loadProfileData() {
        try {
            // Загружаем данные профиля и статистику параллельно
            const [profile, stats] = await Promise.all([
                this.loadUserProfile(),
                this.loadUserStats()
            ]);
            
            this.profileData = profile;
            this.stats = stats;
            
            // Обновляем состояние приложения
            this.state.set('user.profile', profile);
            this.state.set('stats', stats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных профиля:', error);
        }
    }
    
    /**
     * 👤 Загрузка профиля пользователя
     */
    async loadUserProfile() {
        try {
            const profile = await this.api.getProfile();
            return profile;
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            
            // Fallback к данным Telegram
            const telegramUser = this.telegram.getUser();
            return {
                name: telegramUser?.first_name || 'Пользователь',
                email: '',
                username: telegramUser?.username || null,
                about: '',
                telegramId: telegramUser?.id,
                initials: this.getInitials(telegramUser?.first_name),
                registrationDate: new Date().toISOString()
            };
        }
    }
    
    /**
     * 📈 Загрузка статистики пользователя
     */
    async loadUserStats() {
        try {
            const stats = await this.api.getStats();
            return {
                totalQuotes: stats.totalQuotes || 0,
                thisWeek: stats.thisWeek || 0,
                currentStreak: stats.currentStreak || 0,
                longestStreak: stats.longestStreak || 0,
                achievements: stats.achievements || 0,
                favoriteAuthors: stats.favoriteAuthors || [],
                registrationDays: this.calculateRegistrationDays(stats.registrationDate)
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            return {
                totalQuotes: 0,
                thisWeek: 0,
                currentStreak: 0,
                longestStreak: 0,
                achievements: 0,
                favoriteAuthors: [],
                registrationDays: 0
            };
        }
    }
    
    /**
     * 🔓 Открытие модального окна профиля
     */
    show() {
        if (this.isVisible) return;
        
        // Создаем модальное окно
        this.modal = new Modal({
            title: 'Мой профиль',
            content: this.renderContent(),
            size: 'medium',
            showCloseButton: true,
            onOpen: () => {
                this.isVisible = true;
                this.attachEventListeners();
                this.focusFirstField();
            },
            onClose: () => {
                this.isVisible = false;
                this.cleanup();
            }
        });
        
        this.modal.open();
        
        // Haptic feedback
        this.triggerHaptic('medium');
    }
    
    /**
     * 🔒 Закрытие модального окна
     */
    hide() {
        if (this.modal && this.isVisible) {
            this.modal.close();
        }
    }
    
    /**
     * 🎨 Рендер содержимого модального окна
     */
    renderContent() {
        return `
            <div class="profile-modal">
                ${this.renderProfileHeader()}
                ${this.renderStatsSection()}
                ${this.renderEditForm()}
                ${this.renderPersonalizationSection()}
                ${this.renderActionButtons()}
            </div>
        `;
    }
    
    /**
     * 👤 Рендер шапки профиля с аватаром
     */
    renderProfileHeader() {
        const { name, initials, avatarUrl } = this.profileData;
        const { totalQuotes, currentStreak, achievements } = this.stats;
        const telegramPhotoUrl = this.telegram.getUser()?.photo_url;
        
        return `
            <div class="profile-header">
                ${this.renderAvatarBlock(avatarUrl, telegramPhotoUrl, initials || this.getInitials(name))}
                <div class="profile-name">${name || 'Пользователь'}</div>
                <div class="profile-role">
                    ${this.getUserRole(totalQuotes, currentStreak)}
                </div>
                
                <div class="profile-stats-grid">
                    <div class="profile-stat">
                        <div class="profile-stat-number">${totalQuotes}</div>
                        <div class="profile-stat-label">Цитат</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-number">${currentStreak}</div>
                        <div class="profile-stat-label">Дней</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-number">${achievements}</div>
                        <div class="profile-stat-label">Награды</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 🖼️ Рендер блока аватара с поддержкой изображений
     */
    renderAvatarBlock(avatarUrl, telegramPhotoUrl, initials) {
        // Определяем источник аватара по приоритету
        let imageUrl = avatarUrl || telegramPhotoUrl;
        let showImage = !!imageUrl;
        
        return `
            <div class="profile-avatar-container">
                <div class="profile-avatar" id="profileAvatar">
                    ${showImage ? 
                        `<img class="profile-avatar-img" src="${imageUrl}" alt="Аватар" onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                         <div class="profile-avatar-fallback">${initials || '👤'}</div>` :
                        `<div class="profile-avatar-fallback">${initials || '👤'}</div>`
                    }
                </div>
                <button class="change-avatar-btn" id="changeAvatarBtn">
                    <span class="btn-icon">📷</span>
                    <span class="btn-text">Изменить фото</span>
                </button>
                <input type="file" id="avatarFileInput" class="avatar-file-input" accept="image/*" style="display: none;">
            </div>
        `;
    }
    
    /**
     * 📊 Рендер секции статистики
     */
    renderStatsSection() {
        const { longestStreak, favoriteAuthors, registrationDays } = this.stats;
        
        return `
            <div class="profile-section">
                <div class="section-title">📊 Подробная статистика</div>
                
                <div class="stats-details">
                    <div class="stat-item">
                        <span class="stat-label">Лучшая серия:</span>
                        <span class="stat-value">${longestStreak} дней подряд</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">С нами:</span>
                        <span class="stat-value">${registrationDays} дней</span>
                    </div>
                    ${favoriteAuthors.length > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">Любимые авторы:</span>
                            <span class="stat-value">${favoriteAuthors.slice(0, 3).join(', ')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * 📝 Рендер формы редактирования
     */
    renderEditForm() {
        const { name, email, about } = this.profileData;
        
        return `
            <div class="profile-section">
                <div class="section-title">✏️ Редактировать профиль</div>
                
                <form id="profileForm" class="profile-form">
                    <div class="form-group">
                        <label class="form-label" for="profileName">Имя</label>
                        <input 
                            type="text" 
                            id="profileName" 
                            name="name"
                            class="form-input" 
                            value="${name || ''}" 
                            placeholder="Ваше имя"
                            maxlength="50"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="profileEmail">Email</label>
                        <input 
                            type="email" 
                            id="profileEmail" 
                            name="email"
                            class="form-input" 
                            value="${email || ''}" 
                            placeholder="Ваш email для отчетов"
                            maxlength="100"
                        >
                        <div class="form-hint">
                            Для получения еженедельных отчетов от Анны
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="profileAbout">О себе</label>
                        <textarea 
                            id="profileAbout" 
                            name="about"
                            class="form-textarea" 
                            placeholder="Расскажите о себе (необязательно)"
                            maxlength="200"
                            rows="3"
                        >${about || ''}</textarea>
                        <div class="form-hint">
                            Помогает Анне давать более персональные рекомендации
                        </div>
                    </div>
                </form>
            </div>
        `;
    }
    
    /**
     * 🎯 Рендер секции персонализации
     */
    renderPersonalizationSection() {
        return `
            <div class="profile-section">
                <div class="section-title">🎯 Персонализация</div>
                <div class="section-description">
                    Ваши ответы на вопросы влияют на рекомендации книг и анализ цитат от Анны
                </div>
                
                <button class="retake-test-button" id="retakeTestBtn">
                    <span class="button-icon">🔄</span>
                    <span class="button-text">Пересдать тест (7 вопросов)</span>
                </button>
                
                <div class="personalization-info">
                    <div class="info-item">
                        <span class="info-icon">📚</span>
                        <span class="info-text">Рекомендации книг подстраиваются под ваш профиль</span>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">🤖</span>
                        <span class="info-text">ИИ анализ учитывает ваши предпочтения</span>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">📈</span>
                        <span class="info-text">Отчеты становятся более точными</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔲 Рендер кнопок действий
     */
    renderActionButtons() {
        return `
            <div class="profile-actions">
                <button class="save-profile-button" id="saveProfileBtn" ${this.saving ? 'disabled' : ''}>
                    ${this.saving ? 
                        '<span class="button-spinner">⏳</span> Сохранение...' : 
                        '<span class="button-icon">💾</span> Сохранить изменения'
                    }
                </button>
                
                <button class="cancel-profile-button" id="cancelProfileBtn">
                    Отмена
                </button>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Сохранение профиля
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSaveProfile());
        }
        
        // Отмена
        const cancelBtn = document.getElementById('cancelProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }
        
        // Пересдача теста
        const retakeTestBtn = document.getElementById('retakeTestBtn');
        if (retakeTestBtn) {
            retakeTestBtn.addEventListener('click', () => this.handleRetakeTest());
        }

        // Изменение аватара
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', () => this.handleChangeAvatarClick());
        }

        // Выбор файла аватара
        const avatarFileInput = document.getElementById('avatarFileInput');
        if (avatarFileInput) {
            avatarFileInput.addEventListener('change', (e) => this.handleAvatarFileSelect(e));
        }
        
        // Автосохранение при вводе
        const form = document.getElementById('profileForm');
        if (form) {
            form.addEventListener('input', (e) => this.handleFormInput(e));
        }
        
        // Сохранение по Enter в полях ввода
        const inputs = document.querySelectorAll('#profileForm input');
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSaveProfile();
                }
            });
        });
    }
    
    /**
     * 💾 Обработчик сохранения профиля
     */
    async handleSaveProfile() {
        if (this.saving) return;
        
        try {
            this.saving = true;
            this.updateSaveButtonState();
            
            // Haptic feedback
            this.triggerHaptic('medium');
            
            // Собираем данные из формы
            const formData = this.getFormData();
            
            // Валидация
            const validation = this.validateFormData(formData);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }
            
            // Сохраняем на сервере
            const updatedProfile = await this.api.updateProfile(formData);
            
            // Обновляем состояние
            this.profileData = { ...this.profileData, ...updatedProfile };
            this.state.set('user.profile', this.profileData);
            
            // Показываем успех
            this.showSuccessMessage('Профиль успешно сохранен!');
            
            // Haptic feedback успеха
            this.triggerHaptic('light');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            this.showErrorMessage(error.message || 'Не удалось сохранить профиль');
            
            // Haptic feedback ошибки
            this.triggerHaptic('heavy');
            
        } finally {
            this.saving = false;
            this.updateSaveButtonState();
        }
    }
    
    /**
     * 🔄 Обработчик пересдачи теста
     */
    handleRetakeTest() {
        // Haptic feedback
        this.triggerHaptic('medium');
        
        // Закрываем профиль и открываем онбординг
        this.hide();
        
        setTimeout(() => {
            if (this.app.onboardingPage) {
                this.app.onboardingPage.show(true); // true = режим пересдачи
            } else {
                // Fallback - переход через роутер
                this.app.router.navigate('/onboarding?retake=true');
            }
        }, 300);
    }

    /**
     * 📷 Обработчик клика на кнопку изменения аватара
     */
    handleChangeAvatarClick() {
        try {
            // Haptic feedback
            this.triggerHaptic('light');

            // Открываем файловый диалог
            const fileInput = document.getElementById('avatarFileInput');
            if (fileInput) {
                fileInput.click();
            } else {
                throw new Error('Элемент выбора файла не найден');
            }

        } catch (error) {
            console.error('❌ Ошибка открытия диалога выбора файла:', error);
            this.showErrorMessage('Не удалось открыть диалог выбора файла');
        }
    }

    /**
     * 📁 Обработчик выбора файла аватара
     */
    async handleAvatarFileSelect(event) {
        try {
            const file = event.target.files[0];
            if (!file) {
                return; // Пользователь отменил выбор
            }

            console.log('📁 Выбран файл аватара:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Haptic feedback
            this.triggerHaptic('medium');

            // Загружаем ImageUtils если еще не загружен
            if (typeof ImageUtils === 'undefined') {
                throw new Error('ImageUtils не загружен');
            }

            // Валидация файла
            const validation = ImageUtils.validateImage(file);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Показываем состояние загрузки
            this.setAvatarUploadingState(true);

            // Обрабатываем изображение
            const { blob, preview } = await ImageUtils.processImage(file);

            // Загружаем аватар на сервер
            const userId = this.state.getCurrentUserId();
            const result = await this.api.uploadAvatar(blob, userId);

            // Очищаем предыдущий preview URL
            if (this.currentPreviewUrl) {
                ImageUtils.cleanupUrls(this.currentPreviewUrl);
            }

            // Сохраняем новый preview URL
            this.currentPreviewUrl = preview;

            // Обновляем локальные данные профиля
            this.profileData.avatarUrl = result.avatarUrl || result.url || preview;

            // Обновляем состояние приложения
            this.state.set('user.profile', { 
                ...this.state.get('user.profile'),
                avatarUrl: this.profileData.avatarUrl 
            });

            // Обновляем UI
            this.updateAvatarDisplay();

            // Показываем успех
            this.showSuccessMessage('Аватар успешно обновлен!');

            // Haptic feedback успеха
            this.triggerHaptic('light');

        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            this.showErrorMessage(error.message || 'Не удалось загрузить аватар');

            // Haptic feedback ошибки
            this.triggerHaptic('heavy');

        } finally {
            // Сбрасываем состояние загрузки
            this.setAvatarUploadingState(false);

            // Очищаем input для возможности повторного выбора того же файла
            const fileInput = document.getElementById('avatarFileInput');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }

    /**
     * ⏳ Установка состояния загрузки аватара
     */
    setAvatarUploadingState(uploading) {
        this.uploadingAvatar = uploading;

        const changeBtn = document.getElementById('changeAvatarBtn');
        if (changeBtn) {
            if (uploading) {
                changeBtn.disabled = true;
                changeBtn.innerHTML = `
                    <span class="btn-icon">⏳</span>
                    <span class="btn-text">Загрузка...</span>
                `;
            } else {
                changeBtn.disabled = false;
                changeBtn.innerHTML = `
                    <span class="btn-icon">📷</span>
                    <span class="btn-text">Изменить фото</span>
                `;
            }
        }
    }

    /**
     * 🔄 Обновление отображения аватара
     */
    updateAvatarDisplay() {
        const avatarContainer = document.getElementById('profileAvatar');
        if (!avatarContainer) return;

        const { avatarUrl, initials, name } = this.profileData;
        const telegramPhotoUrl = this.telegram.getUser()?.photo_url;
        
        // Определяем источник изображения по приоритету
        const imageUrl = avatarUrl || telegramPhotoUrl;
        const fallbackInitials = initials || this.getInitials(name) || '👤';

        if (imageUrl) {
            avatarContainer.innerHTML = `
                <img class="profile-avatar-img" src="${imageUrl}" alt="Аватар" 
                     onerror="this.style.display='none'; this.parentElement.classList.add('fallback')" />
                <div class="profile-avatar-fallback">${fallbackInitials}</div>
            `;
            avatarContainer.classList.remove('fallback');
        } else {
            avatarContainer.innerHTML = `
                <div class="profile-avatar-fallback">${fallbackInitials}</div>
            `;
            avatarContainer.classList.add('fallback');
        }
    }
    
    /**
     * ✍️ Обработчик ввода в форму
     */
    handleFormInput(event) {
        const { name, value } = event.target;
        
        // Обновляем локальные данные
        this.profileData[name] = value;
        
        // Автосохранение с задержкой
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveProfile();
        }, 2000);
    }
    
    /**
     * 💾 Автосохранение профиля
     */
    async autoSaveProfile() {
        try {
            const formData = this.getFormData();
            await this.api.updateProfile(formData, { silent: true });
            
            // Обновляем состояние без уведомлений
            this.state.set('user.profile', { ...this.profileData, ...formData });
            
        } catch (error) {
            console.error('❌ Ошибка автосохранения:', error);
            // Не показываем ошибку пользователю при автосохранении
        }
    }
    
    /**
     * 📋 Получение данных из формы
     */
    getFormData() {
        const form = document.getElementById('profileForm');
        if (!form) return {};
        
        return {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            about: form.about.value.trim()
        };
    }
    
    /**
     * ✅ Валидация данных формы
     */
    validateFormData(data) {
        // Проверка имени
        if (!data.name || data.name.length < 2) {
            return {
                isValid: false,
                error: 'Имя должно содержать минимум 2 символа'
            };
        }
        
        if (data.name.length > 50) {
            return {
                isValid: false,
                error: 'Имя не должно превышать 50 символов'
            };
        }
        
        // Проверка email (если указан)
        if (data.email && !this.isValidEmail(data.email)) {
            return {
                isValid: false,
                error: 'Введите корректный email адрес'
            };
        }
        
        // Проверка длины описания
        if (data.about && data.about.length > 200) {
            return {
                isValid: false,
                error: 'Описание не должно превышать 200 символов'
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * 📧 Проверка корректности email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * 🔄 Обновление состояния кнопки сохранения
     */
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveProfileBtn');
        if (!saveBtn) return;
        
        if (this.saving) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="button-spinner">⏳</span> Сохранение...';
        } else {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="button-icon">💾</span> Сохранить изменения';
        }
    }
    
    /**
     * 🔄 Обновление UI профиля
     */
    updateProfileUI() {
        if (!this.isVisible) return;
        
        // Обновляем имя
        const nameInput = document.getElementById('profileName');
        if (nameInput && nameInput.value !== this.profileData.name) {
            nameInput.value = this.profileData.name || '';
        }
        
        // Обновляем email
        const emailInput = document.getElementById('profileEmail');
        if (emailInput && emailInput.value !== this.profileData.email) {
            emailInput.value = this.profileData.email || '';
        }
        
        // Обновляем описание
        const aboutInput = document.getElementById('profileAbout');
        if (aboutInput && aboutInput.value !== this.profileData.about) {
            aboutInput.value = this.profileData.about || '';
        }
    }
    
    /**
     * 📊 Обновление UI статистики
     */
    updateStatsUI() {
        if (!this.isVisible) return;
        
        // Обновляем статистику в шапке профиля
        const statNumbers = document.querySelectorAll('.profile-stat-number');
        if (statNumbers.length >= 3) {
            statNumbers[0].textContent = this.stats.totalQuotes || 0;
            statNumbers[1].textContent = this.stats.currentStreak || 0;
            statNumbers[2].textContent = this.stats.achievements || 0;
        }
    }
    
    /**
     * 🎯 Фокус на первое поле
     */
    focusFirstField() {
        setTimeout(() => {
            const nameInput = document.getElementById('profileName');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 100);
    }
    
    /**
     * ✅ Показать сообщение об успехе
     */
    showSuccessMessage(message) {
        // Можно использовать toast или временное уведомление
        if (this.telegram) {
            this.telegram.showAlert(message);
        } else {
            // Fallback - простой alert
            alert(message);
        }
    }
    
    /**
     * ⚠️ Показать сообщение об ошибке
     */
    showErrorMessage(message) {
        if (this.telegram) {
            this.telegram.showAlert(`Ошибка: ${message}`);
        } else {
            alert(`Ошибка: ${message}`);
        }
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic(type = 'light') {
        if (this.telegram && this.telegram.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred(type);
        }
    }
    
    /**
     * 🧮 Вспомогательные методы
     */
    
    /**
     * Получение инициалов из имени
     */
    getInitials(name) {
        if (!name) return '👤';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
    
    /**
     * Получение роли пользователя на основе активности
     */
    getUserRole(totalQuotes, currentStreak) {
        if (totalQuotes >= 100 && currentStreak >= 30) return 'Мастер мудрости 🎓';
        if (totalQuotes >= 50 && currentStreak >= 14) return 'Активный читатель 📚';
        if (totalQuotes >= 20 && currentStreak >= 7) return 'Читатель практик 💡';
        if (totalQuotes >= 10) return 'Начинающий коллекционер 🌱';
        return 'Новичок 👋';
    }
    
    /**
     * Расчет дней с регистрации
     */
    calculateRegistrationDays(registrationDate) {
        if (!registrationDate) return 0;
        
        const regDate = new Date(registrationDate);
        const now = new Date();
        const diffTime = Math.abs(now - regDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    /**
     * 🧹 Очистка ресурсов
     */
    cleanup() {
        // Очищаем таймеры
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Очищаем preview URLs для освобождения памяти
        if (this.currentPreviewUrl) {
            if (typeof ImageUtils !== 'undefined') {
                ImageUtils.cleanupUrls(this.currentPreviewUrl);
            } else {
                URL.revokeObjectURL(this.currentPreviewUrl);
            }
            this.currentPreviewUrl = null;
        }
        
        // Сбрасываем состояние
        this.saving = false;
        this.uploadingAvatar = false;
    }
    
    /**
     * 🧹 Полная очистка при уничтожении
     */
    destroy() {
        // Закрываем модальное окно
        this.hide();
        
        // Отписываемся от событий
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Очищаем данные
        this.profileData = {};
        this.stats = {};
        this.modal = null;
        
        // Очищаем таймеры
        this.cleanup();
    }
}

// 📤 Экспорт класса
window.ProfileModal = ProfileModal;