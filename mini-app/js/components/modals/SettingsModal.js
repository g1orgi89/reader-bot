/**
 * ⚙️ НАСТРОЙКИ ПРИЛОЖЕНИЯ - SettingsModal.js
 * 
 * Функциональность:
 * - Управление уведомлениями и напоминаниями
 * - Переключение темной/светлой темы
 * - Экспорт данных пользователя
 * - Управление аккаунтом и конфиденциальностью
 * - Настройки персонализации
 * - Помощь и поддержка
 * - Информация о приложении
 */

class SettingsModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние модального окна
        this.modal = null;
        this.isVisible = false;
        this.settings = {};
        this.saving = false;
        
        // Конфигурация настроек по умолчанию
        this.defaultSettings = this.getDefaultSettings();
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация модального окна настроек
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
            this.settings = { ...this.defaultSettings, ...settings };
            this.updateUI();
        });
        
        // Подписка на изменения темы
        const themeSubscription = this.state.subscribe('theme', (theme) => {
            this.settings.theme = theme;
            this.updateThemeUI();
        });
        
        this.subscriptions.push(settingsSubscription, themeSubscription);
    }
    
    /**
     * ⚙️ Загрузка настроек пользователя
     */
    async loadSettings() {
        try {
            // Загружаем настройки с сервера
            const serverSettings = await this.api.getSettings();
            
            // Загружаем локальные настройки
            const localSettings = this.loadLocalSettings();
            
            // Объединяем с настройками по умолчанию
            this.settings = {
                ...this.defaultSettings,
                ...serverSettings,
                ...localSettings
            };
            
            // Обновляем состояние приложения
            this.state.set('settings', this.settings);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            
            // Используем настройки по умолчанию
            this.settings = { ...this.defaultSettings };
        }
    }
    
    /**
     * 🔓 Открытие модального окна настроек
     */
    show() {
        if (this.isVisible) return;
        
        // Создаем модальное окно
        this.modal = new Modal({
            title: 'Настройки',
            content: this.renderContent(),
            size: 'medium',
            showCloseButton: true,
            onOpen: () => {
                this.isVisible = true;
                this.attachEventListeners();
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
            <div class="settings-modal">
                ${this.renderNotificationsGroup()}
                ${this.renderAppearanceGroup()}
                ${this.renderDataGroup()}
                ${this.renderAccountGroup()}
                ${this.renderSupportGroup()}
                ${this.renderAboutGroup()}
            </div>
        `;
    }
    
    /**
     * 🔔 Рендер группы настроек уведомлений
     */
    renderNotificationsGroup() {
        const { notifications } = this.settings;
        
        return `
            <div class="settings-group">
                <div class="settings-group-title">🔔 Уведомления</div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">🔔</span>
                        <div class="settings-text">
                            <div class="settings-label">Ежедневные напоминания</div>
                            <div class="settings-description">Напоминания добавить цитату</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="dailyReminders" ${notifications.daily ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">📊</span>
                        <div class="settings-text">
                            <div class="settings-label">Еженедельные отчеты</div>
                            <div class="settings-description">Получать анализ от Анны</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="weeklyReports" ${notifications.weekly ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">🏆</span>
                        <div class="settings-text">
                            <div class="settings-label">Достижения</div>
                            <div class="settings-description">Уведомления о новых наградах</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="achievements" ${notifications.achievements ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">📚</span>
                        <div class="settings-text">
                            <div class="settings-label">Рекомендации книг</div>
                            <div class="settings-description">Персональные советы от Анны</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="bookRecommendations" ${notifications.books ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎨 Рендер группы настроек внешнего вида
     */
    renderAppearanceGroup() {
        const { theme, fontSize, compactMode } = this.settings;
        
        return `
            <div class="settings-group">
                <div class="settings-group-title">🎨 Внешний вид</div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">${theme === 'dark' ? '🌙' : '☀️'}</span>
                        <div class="settings-text">
                            <div class="settings-label">Темная тема</div>
                            <div class="settings-description">Темное оформление интерфейса</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="darkTheme" ${theme === 'dark' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">📏</span>
                        <div class="settings-text">
                            <div class="settings-label">Размер шрифта</div>
                            <div class="settings-description">Комфортный размер текста</div>
                        </div>
                    </div>
                    <div class="font-size-controls">
                        <button class="font-size-btn ${fontSize === 'small' ? 'active' : ''}" data-size="small">А</button>
                        <button class="font-size-btn ${fontSize === 'medium' ? 'active' : ''}" data-size="medium">А</button>
                        <button class="font-size-btn ${fontSize === 'large' ? 'active' : ''}" data-size="large">А</button>
                    </div>
                </div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">📱</span>
                        <div class="settings-text">
                            <div class="settings-label">Компактный режим</div>
                            <div class="settings-description">Больше информации на экране</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="compactMode" ${compactMode ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер группы настроек данных
     */
    renderDataGroup() {
        return `
            <div class="settings-group">
                <div class="settings-group-title">📊 Данные</div>
                
                <div class="settings-item clickable" id="exportData">
                    <div class="settings-item-info">
                        <span class="settings-icon">📤</span>
                        <div class="settings-text">
                            <div class="settings-label">Экспорт данных</div>
                            <div class="settings-description">Скачать все ваши цитаты</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="importData">
                    <div class="settings-item-info">
                        <span class="settings-icon">📥</span>
                        <div class="settings-text">
                            <div class="settings-label">Импорт данных</div>
                            <div class="settings-description">Загрузить цитаты из файла</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="dataUsage">
                    <div class="settings-item-info">
                        <span class="settings-icon">📈</span>
                        <div class="settings-text">
                            <div class="settings-label">Использование данных</div>
                            <div class="settings-description">Статистика хранилища</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер группы настроек аккаунта
     */
    renderAccountGroup() {
        return `
            <div class="settings-group">
                <div class="settings-group-title">👤 Аккаунт</div>
                
                <div class="settings-item clickable" id="privacy">
                    <div class="settings-item-info">
                        <span class="settings-icon">🔒</span>
                        <div class="settings-text">
                            <div class="settings-label">Конфиденциальность</div>
                            <div class="settings-description">Управление приватностью</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="resetData">
                    <div class="settings-item-info">
                        <span class="settings-icon">🔄</span>
                        <div class="settings-text">
                            <div class="settings-label">Сбросить прогресс</div>
                            <div class="settings-description">Начать с чистого листа</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable danger" id="deleteAccount">
                    <div class="settings-item-info">
                        <span class="settings-icon">🗑️</span>
                        <div class="settings-text">
                            <div class="settings-label">Удалить аккаунт</div>
                            <div class="settings-description">Полное удаление всех данных</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 💬 Рендер группы поддержки
     */
    renderSupportGroup() {
        return `
            <div class="settings-group">
                <div class="settings-group-title">💬 Поддержка</div>
                
                <div class="settings-item clickable" id="help">
                    <div class="settings-item-info">
                        <span class="settings-icon">❓</span>
                        <div class="settings-text">
                            <div class="settings-label">Помощь</div>
                            <div class="settings-description">FAQ и инструкции</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="contact">
                    <div class="settings-item-info">
                        <span class="settings-icon">📧</span>
                        <div class="settings-text">
                            <div class="settings-label">Связаться с нами</div>
                            <div class="settings-description">Написать в поддержку</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="feedback">
                    <div class="settings-item-info">
                        <span class="settings-icon">⭐</span>
                        <div class="settings-text">
                            <div class="settings-label">Оценить приложение</div>
                            <div class="settings-description">Поделиться мнением</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
            </div>
        `;
    }
    
    /**
     * ℹ️ Рендер группы информации о приложении
     */
    renderAboutGroup() {
        return `
            <div class="settings-group">
                <div class="settings-group-title">ℹ️ О приложении</div>
                
                <div class="settings-item">
                    <div class="settings-item-info">
                        <span class="settings-icon">📱</span>
                        <div class="settings-text">
                            <div class="settings-label">Версия приложения</div>
                            <div class="settings-description">1.0.2</div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-item clickable" id="about">
                    <div class="settings-item-info">
                        <span class="settings-icon">👩‍💼</span>
                        <div class="settings-text">
                            <div class="settings-label">Об Анне Бусел</div>
                            <div class="settings-description">Автор и психолог</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
                
                <div class="settings-item clickable" id="terms">
                    <div class="settings-item-info">
                        <span class="settings-icon">📄</span>
                        <div class="settings-text">
                            <div class="settings-label">Условия использования</div>
                            <div class="settings-description">Правила и политика</div>
                        </div>
                    </div>
                    <span class="chevron-icon">›</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Переключатели (toggle switches)
        this.attachToggleListeners();
        
        // Кнопки размера шрифта
        this.attachFontSizeListeners();
        
        // Кликабельные элементы
        this.attachClickableListeners();
    }
    
    /**
     * 🔄 Навешивание обработчиков переключателей
     */
    attachToggleListeners() {
        const toggles = [
            { id: 'dailyReminders', setting: 'notifications.daily' },
            { id: 'weeklyReports', setting: 'notifications.weekly' },
            { id: 'achievements', setting: 'notifications.achievements' },
            { id: 'bookRecommendations', setting: 'notifications.books' },
            { id: 'darkTheme', setting: 'theme', handler: this.handleThemeToggle.bind(this) },
            { id: 'compactMode', setting: 'compactMode' }
        ];
        
        toggles.forEach(toggle => {
            const element = document.getElementById(toggle.id);
            if (element) {
                element.addEventListener('change', (e) => {
                    if (toggle.handler) {
                        toggle.handler(e.target.checked);
                    } else {
                        this.updateSetting(toggle.setting, e.target.checked);
                    }
                });
            }
        });
    }
    
    /**
     * 📏 Навешивание обработчиков размера шрифта
     */
    attachFontSizeListeners() {
        const fontSizeButtons = document.querySelectorAll('.font-size-btn');
        fontSizeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const size = e.target.dataset.size;
                this.handleFontSizeChange(size);
            });
        });
    }
    
    /**
     * 🖱️ Навешивание обработчиков кликабельных элементов
     */
    attachClickableListeners() {
        const clickableItems = [
            { id: 'exportData', handler: this.handleExportData.bind(this) },
            { id: 'importData', handler: this.handleImportData.bind(this) },
            { id: 'dataUsage', handler: this.handleDataUsage.bind(this) },
            { id: 'privacy', handler: this.handlePrivacy.bind(this) },
            { id: 'resetData', handler: this.handleResetData.bind(this) },
            { id: 'deleteAccount', handler: this.handleDeleteAccount.bind(this) },
            { id: 'help', handler: this.handleHelp.bind(this) },
            { id: 'contact', handler: this.handleContact.bind(this) },
            { id: 'feedback', handler: this.handleFeedback.bind(this) },
            { id: 'about', handler: this.handleAbout.bind(this) },
            { id: 'terms', handler: this.handleTerms.bind(this) }
        ];
        
        clickableItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (element) {
                element.addEventListener('click', item.handler);
            }
        });
    }
    
    /**
     * 🌙 Обработчик переключения темы
     */
    handleThemeToggle(isDark) {
        const newTheme = isDark ? 'dark' : 'light';
        this.updateSetting('theme', newTheme);
        
        // Применяем тему немедленно
        this.applyTheme(newTheme);
        
        // Haptic feedback
        this.triggerHaptic('medium');
    }
    
    /**
     * 📏 Обработчик изменения размера шрифта
     */
    handleFontSizeChange(size) {
        this.updateSetting('fontSize', size);
        
        // Обновляем активную кнопку
        document.querySelectorAll('.font-size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-size="${size}"]`).classList.add('active');
        
        // Применяем размер шрифта
        this.applyFontSize(size);
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 📤 Обработчик экспорта данных
     */
    async handleExportData() {
        try {
            // Haptic feedback
            this.triggerHaptic('medium');
            
            // Показываем индикатор загрузки
            this.showExportLoading(true);
            
            // Получаем данные для экспорта
            const exportData = await this.api.exportUserData();
            
            // Создаем и скачиваем файл
            this.downloadExportFile(exportData);
            
            // Показываем успех
            this.showMessage('Данные успешно экспортированы!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка экспорта данных:', error);
            this.showMessage('Не удалось экспортировать данные', 'error');
        } finally {
            this.showExportLoading(false);
        }
    }
    
    /**
     * 📥 Обработчик импорта данных
     */
    handleImportData() {
        // Создаем скрытый input для выбора файла
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.csv,.txt';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.processImportFile(file);
            }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
        
        // Haptic feedback
        this.triggerHaptic('medium');
    }
    
    /**
     * 📊 Обработчик просмотра использования данных
     */
    async handleDataUsage() {
        try {
            const usage = await this.api.getDataUsage();
            
            const usageModal = new Modal({
                title: 'Использование данных',
                content: `
                    <div class="data-usage">
                        <div class="usage-item">
                            <span class="usage-label">Цитат сохранено:</span>
                            <span class="usage-value">${usage.quotesCount}</span>
                        </div>
                        <div class="usage-item">
                            <span class="usage-label">Размер данных:</span>
                            <span class="usage-value">${this.formatBytes(usage.dataSize)}</span>
                        </div>
                        <div class="usage-item">
                            <span class="usage-label">Дата регистрации:</span>
                            <span class="usage-value">${this.formatDate(usage.registrationDate)}</span>
                        </div>
                        <div class="usage-item">
                            <span class="usage-label">Последняя активность:</span>
                            <span class="usage-value">${this.formatDate(usage.lastActivity)}</span>
                        </div>
                    </div>
                `,
                size: 'small',
                buttons: [{ text: 'Закрыть', variant: 'primary' }]
            });
            
            usageModal.open();
            
        } catch (error) {
            console.error('❌ Ошибка получения данных об использовании:', error);
            this.showMessage('Не удалось получить информацию', 'error');
        }
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🔒 Обработчик настроек конфиденциальности
     */
    handlePrivacy() {
        const privacyModal = new Modal({
            title: 'Конфиденциальность',
            content: `
                <div class="privacy-settings">
                    <div class="privacy-section">
                        <h4>📊 Сбор данных</h4>
                        <p>Мы собираем только необходимые для работы приложения данные: ваши цитаты, статистику использования и настройки.</p>
                    </div>
                    
                    <div class="privacy-section">
                        <h4>🔐 Безопасность</h4>
                        <p>Все данные передаются по защищенному соединению и хранятся в зашифрованном виде.</p>
                    </div>
                    
                    <div class="privacy-section">
                        <h4>📧 Связь с вами</h4>
                        <p>Мы используем ваш email только для отправки еженедельных отчетов и важных уведомлений.</p>
                    </div>
                    
                    <div class="privacy-controls">
                        <div class="privacy-item">
                            <span>Аналитика использования</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="analyticsConsent" ${this.settings.privacy?.analytics !== false ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            `,
            size: 'medium',
            buttons: [
                { text: 'Сохранить', variant: 'primary', onClick: () => this.savePrivacySettings() }
            ]
        });
        
        privacyModal.open();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🔄 Обработчик сброса данных
     */
    async handleResetData() {
        const confirmed = await Modal.confirm(
            'Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.',
            'Сброс прогресса'
        );
        
        if (confirmed) {
            try {
                await this.api.resetUserData();
                
                // Очищаем локальное состояние
                this.app.state.clear();
                
                // Показываем успех
                this.showMessage('Прогресс успешно сброшен', 'success');
                
                // Закрываем настройки и перезагружаем приложение
                this.hide();
                this.app.router.navigate('/onboarding');
                
            } catch (error) {
                console.error('❌ Ошибка сброса данных:', error);
                this.showMessage('Не удалось сбросить данные', 'error');
            }
        }
        
        // Haptic feedback
        this.triggerHaptic('heavy');
    }
    
    /**
     * 🗑️ Обработчик удаления аккаунта
     */
    async handleDeleteAccount() {
        const confirmed = await Modal.confirm(
            'Вы уверены, что хотите полностью удалить аккаунт? Все ваши данные будут безвозвратно утеряны.',
            'Удаление аккаунта'
        );
        
        if (confirmed) {
            const doubleConfirmed = await Modal.confirm(
                'Последнее предупреждение! Это действие нельзя отменить. Удалить аккаунт?',
                'Подтвердите удаление'
            );
            
            if (doubleConfirmed) {
                try {
                    await this.api.deleteAccount();
                    
                    // Показываем прощальное сообщение
                    Modal.alert('Ваш аккаунт был удален. Спасибо, что были с нами!', 'До свидания');
                    
                    // Закрываем приложение через 3 секунды
                    setTimeout(() => {
                        if (this.telegram) {
                            this.telegram.close();
                        } else {
                            window.close();
                        }
                    }, 3000);
                    
                } catch (error) {
                    console.error('❌ Ошибка удаления аккаунта:', error);
                    this.showMessage('Не удалось удалить аккаунт', 'error');
                }
            }
        }
        
        // Haptic feedback
        this.triggerHaptic('heavy');
    }
    
    /**
     * ❓ Обработчик помощи
     */
    handleHelp() {
        const helpModal = new Modal({
            title: 'Помощь',
            content: `
                <div class="help-content">
                    <div class="help-section">
                        <h4>❓ Как добавлять цитаты?</h4>
                        <p>Просто отправьте текст цитаты боту. Если есть автор - укажите в скобках или через тире.</p>
                    </div>
                    
                    <div class="help-section">
                        <h4>📊 Когда приходят отчеты?</h4>
                        <p>Еженедельные отчеты приходят в воскресенье в 11:00. Месячные - в первых числах месяца.</p>
                    </div>
                    
                    <div class="help-section">
                        <h4>🤖 Как работает анализ Анны?</h4>
                        <p>ИИ анализирует ваши цитаты и на основе вашего теста подбирает персональные рекомендации книг.</p>
                    </div>
                    
                    <div class="help-section">
                        <h4>📱 Можно ли удалить цитату?</h4>
                        <p>Да! Нажмите на "⋯" рядом с цитатой и выберите "Удалить" или напишите боту.</p>
                    </div>
                    
                    <div class="help-section">
                        <h4>🎁 Как получить промокод?</h4>
                        <p>Промокоды приходят в еженедельных отчетах. Активные пользователи получают дополнительные скидки.</p>
                    </div>
                    
                    <div class="help-contact">
                        <h4>📞 Связаться с нами</h4>
                        <p>• Telegram: @annabusel_support<br>
                        • Email: help@annabusel.org<br>
                        • Время ответа: до 24 часов</p>
                    </div>
                </div>
            `,
            size: 'medium',
            buttons: [{ text: 'Понятно', variant: 'primary' }]
        });
        
        helpModal.open();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 📧 Обработчик связи с поддержкой
     */
    handleContact() {
        const contactModal = new Modal({
            title: 'Связаться с нами',
            content: `
                <div class="contact-content">
                    <div class="contact-option" onclick="window.open('https://t.me/annabusel_support')">
                        <span class="contact-icon">💬</span>
                        <div class="contact-info">
                            <div class="contact-title">Telegram</div>
                            <div class="contact-description">@annabusel_support</div>
                        </div>
                    </div>
                    
                    <div class="contact-option" onclick="window.open('mailto:help@annabusel.org')">
                        <span class="contact-icon">📧</span>
                        <div class="contact-info">
                            <div class="contact-title">Email</div>
                            <div class="contact-description">help@annabusel.org</div>
                        </div>
                    </div>
                    
                    <div class="contact-info-block">
                        <p>⏰ <strong>Время ответа:</strong> до 24 часов</p>
                        <p>🌍 <strong>Язык поддержки:</strong> русский</p>
                    </div>
                </div>
            `,
            size: 'small',
            buttons: [{ text: 'Закрыть', variant: 'primary' }]
        });
        
        contactModal.open();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * ⭐ Обработчик оценки приложения
     */
    handleFeedback() {
        // В реальном приложении здесь будет интеграция с системой отзывов
        Modal.alert('Спасибо за желание оценить приложение! Функция будет доступна в следующем обновлении.', 'Оценка приложения');
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 👩‍💼 Обработчик информации об Анне
     */
    handleAbout() {
        const aboutModal = new Modal({
            title: 'Об Анне Бусел',
            content: `
                <div class="about-content">
                    <div class="anna-card">
                        <div class="anna-photo">👩‍💼</div>
                        <div class="anna-name">Анна Бусел</div>
                        <div class="anna-role">Психолог • Основатель "Книжного клуба"</div>
                        <div class="anna-quote">"Хорошая жизнь строится, а не дается по умолчанию. Давайте строить вашу вместе!"</div>
                    </div>
                    
                    <div class="about-text">
                        <p>"Читатель" — это персональный дневник цитат с AI-анализом от Анны Бусел. Собирайте мудрость, получайте персональные рекомендации книг и развивайтесь вместе с сообществом единомышленников.</p>
                    </div>
                    
                    <div class="app-stats">
                        <div class="stat-item">
                            <span class="stat-label">Пользователей:</span>
                            <span class="stat-value">2,847</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Цитат собрано:</span>
                            <span class="stat-value">15,392</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Версия:</span>
                            <span class="stat-value">1.0.2</span>
                        </div>
                    </div>
                    
                    <div class="social-links">
                        <a href="#" class="social-link">📷 Instagram</a>
                        <a href="#" class="social-link">💬 Telegram</a>
                        <a href="#" class="social-link">🌐 Сайт</a>
                    </div>
                </div>
            `,
            size: 'medium',
            buttons: [{ text: 'Закрыть', variant: 'primary' }]
        });
        
        aboutModal.open();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 📄 Обработчик условий использования
     */
    handleTerms() {
        const termsModal = new Modal({
            title: 'Условия использования',
            content: `
                <div class="terms-content">
                    <div class="terms-section">
                        <h4>📱 Использование приложения</h4>
                        <p>Приложение "Читатель" предназначено для личного использования. Вы можете сохранять цитаты, получать персональные рекомендации и анализ.</p>
                    </div>
                    
                    <div class="terms-section">
                        <h4>📊 Данные пользователя</h4>
                        <p>Мы обрабатываем ваши данные согласно политике конфиденциальности. Ваши цитаты используются только для персонального анализа.</p>
                    </div>
                    
                    <div class="terms-section">
                        <h4>💰 Коммерческие услуги</h4>
                        <p>Приложение бесплатно. Дополнительные услуги (разборы книг, персональные консультации) предоставляются отдельно.</p>
                    </div>
                    
                    <div class="terms-section">
                        <h4>⚖️ Ответственность</h4>
                        <p>Мы не несем ответственности за точность цитат или их влияние на ваши решения. Используйте здравый смысл.</p>
                    </div>
                </div>
            `,
            size: 'medium',
            buttons: [{ text: 'Понятно', variant: 'primary' }]
        });
        
        termsModal.open();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🔄 Обновление настройки
     */
    async updateSetting(path, value) {
        // Обновляем локальные настройки
        this.setNestedValue(this.settings, path, value);
        
        // Сохраняем локально
        this.saveLocalSettings();
        
        // Обновляем состояние приложения
        this.state.set('settings', this.settings);
        
        // Сохраняем на сервере (с дебаунсом)
        this.debouncedSaveSettings();
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🌙 Применение темы
     */
    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        
        // Сохраняем в localStorage для немедленного применения
        localStorage.setItem('reader-theme', theme);
        
        // Обновляем состояние
        this.state.set('theme', theme);
    }
    
    /**
     * 📏 Применение размера шрифта
     */
    applyFontSize(size) {
        document.body.classList.remove('font-small', 'font-medium', 'font-large');
        document.body.classList.add(`font-${size}`);
        
        // Сохраняем в localStorage
        localStorage.setItem('reader-font-size', size);
    }
    
    /**
     * 💾 Сохранение настроек конфиденциальности
     */
    savePrivacySettings() {
        const analyticsConsent = document.getElementById('analyticsConsent')?.checked;
        
        this.updateSetting('privacy.analytics', analyticsConsent);
        
        return true; // Закрыть модальное окно
    }
    
    /**
     * 📤 Создание и скачивание файла экспорта
     */
    downloadExportFile(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `reader-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * 📥 Обработка импорта файла
     */
    async processImportFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Валидация данных
            if (!this.validateImportData(data)) {
                throw new Error('Неверный формат файла');
            }
            
            // Подтверждение импорта
            const confirmed = await Modal.confirm(
                `Найдено ${data.quotes?.length || 0} цитат. Импортировать данные? Существующие данные будут объединены.`,
                'Импорт данных'
            );
            
            if (confirmed) {
                await this.api.importUserData(data);
                this.showMessage('Данные успешно импортированы!', 'success');
                
                // Обновляем данные в приложении
                this.app.loadData();
            }
            
        } catch (error) {
            console.error('❌ Ошибка импорта:', error);
            this.showMessage('Не удалось импортировать данные: ' + error.message, 'error');
        }
    }
    
    /**
     * ✅ Валидация данных импорта
     */
    validateImportData(data) {
        return data && typeof data === 'object' && Array.isArray(data.quotes);
    }
    
    /**
     * 🔄 Показать/скрыть индикатор экспорта
     */
    showExportLoading(show) {
        const exportItem = document.getElementById('exportData');
        if (exportItem) {
            if (show) {
                exportItem.classList.add('loading');
                exportItem.querySelector('.settings-description').textContent = 'Подготовка данных...';
            } else {
                exportItem.classList.remove('loading');
                exportItem.querySelector('.settings-description').textContent = 'Скачать все ваши цитаты';
            }
        }
    }
    
    /**
     * 📱 Обновление UI
     */
    updateUI() {
        if (!this.isVisible) return;
        
        // Обновляем переключатели
        this.updateToggleStates();
        
        // Обновляем размер шрифта
        this.updateFontSizeButtons();
    }
    
    /**
     * 🔄 Обновление состояния переключателей
     */
    updateToggleStates() {
        const toggles = [
            { id: 'dailyReminders', value: this.settings.notifications?.daily },
            { id: 'weeklyReports', value: this.settings.notifications?.weekly },
            { id: 'achievements', value: this.settings.notifications?.achievements },
            { id: 'bookRecommendations', value: this.settings.notifications?.books },
            { id: 'compactMode', value: this.settings.compactMode }
        ];
        
        toggles.forEach(toggle => {
            const element = document.getElementById(toggle.id);
            if (element) {
                element.checked = toggle.value;
            }
        });
    }
    
    /**
     * 📏 Обновление кнопок размера шрифта
     */
    updateFontSizeButtons() {
        const currentSize = this.settings.fontSize || 'medium';
        
        document.querySelectorAll('.font-size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-size="${currentSize}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    /**
     * 🎨 Обновление UI темы
     */
    updateThemeUI() {
        const darkThemeToggle = document.getElementById('darkTheme');
        if (darkThemeToggle) {
            darkThemeToggle.checked = this.settings.theme === 'dark';
        }
        
        // Обновляем иконку темы
        const themeIcon = document.querySelector('#darkTheme').closest('.settings-item').querySelector('.settings-icon');
        if (themeIcon) {
            themeIcon.textContent = this.settings.theme === 'dark' ? '🌙' : '☀️';
        }
    }
    
    /**
     * 💾 Сохранение настроек на сервере (с дебаунсом)
     */
    debouncedSaveSettings() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                await this.api.updateSettings(this.settings);
            } catch (error) {
                console.error('❌ Ошибка сохранения настроек:', error);
            }
        }, 1000);
    }
    
    /**
     * 💾 Сохранение настроек локально
     */
    saveLocalSettings() {
        try {
            localStorage.setItem('reader-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ Ошибка сохранения в localStorage:', error);
        }
    }
    
    /**
     * 📥 Загрузка настроек локально
     */
    loadLocalSettings() {
        try {
            const saved = localStorage.getItem('reader-settings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('❌ Ошибка загрузки из localStorage:', error);
            return {};
        }
    }
    
    /**
     * ⚙️ Настройки по умолчанию
     */
    getDefaultSettings() {
        return {
            notifications: {
                daily: true,
                weekly: true,
                achievements: true,
                books: true
            },
            theme: 'light',
            fontSize: 'medium',
            compactMode: false,
            privacy: {
                analytics: true
            }
        };
    }
    
    /**
     * 🧮 Вспомогательные методы
     */
    
    /**
     * Установка вложенного значения по пути
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    /**
     * Форматирование размера в байтах
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Форматирование даты
     */
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    /**
     * 💬 Показать сообщение
     */
    showMessage(message, type = 'info') {
        if (this.telegram) {
            this.telegram.showAlert(message);
        } else {
            alert(message);
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
     * 🧹 Очистка ресурсов
     */
    cleanup() {
        // Очищаем таймеры
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
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
        this.settings = {};
        this.modal = null;
        
        // Очищаем таймеры
        this.cleanup();
    }
}

// 📤 Экспорт класса
window.SettingsModal = SettingsModal;