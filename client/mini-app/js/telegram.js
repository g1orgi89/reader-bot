/**
 * TELEGRAM.JS - Интеграция с Telegram Web App SDK
 * Управление всеми аспектами взаимодействия с Telegram Mini App
 */

class TelegramManager {
    constructor() {
        this.tg = null;
        this.user = null;
        this.isInitialized = false;
        this.mockMode = false;
        this.callbacks = {
            onUserChange: [],
            onThemeChange: [],
            onViewportChange: []
        };
        
        console.log('TelegramManager: Constructor initialized');
    }
    
    /**
     * Инициализация Telegram Web App
     */
    init() {
        console.log('TelegramManager: Starting initialization...');
        
        try {
            // Проверяем доступность Telegram Web App
            if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
                this.tg = window.Telegram.WebApp;
                this.mockMode = false;
                console.log('TelegramManager: Telegram Web App detected');
            } else {
                console.warn('TelegramManager: Telegram Web App not detected, using mock mode');
                this.mockMode = true;
                this.initMockData();
            }
            
            if (!this.mockMode) {
                this.initTelegramApp();
            }
            
            this.setupUser();
            this.setupThemes();
            this.setupUI();
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('TelegramManager: Initialization completed');
            
            return this.getUserData();
            
        } catch (error) {
            console.error('TelegramManager: Initialization failed:', error);
            this.mockMode = true;
            this.initMockData();
            this.isInitialized = true;
            return this.getUserData();
        }
    }
    
    /**
     * Инициализация Telegram Web App
     */
    initTelegramApp() {
        try {
            // Готовим приложение
            this.tg.ready();
            
            // Расширяем viewport
            this.tg.expand();
            
            // Настраиваем главную кнопку
            this.tg.MainButton.setText('Готово');
            this.tg.MainButton.hide();
            
            // Показываем кнопку назад если нужно
            if (this.tg.BackButton) {
                this.tg.BackButton.hide();
            }
            
            // Включаем закрытие при свайпе вниз
            this.tg.enableClosingConfirmation();
            
            console.log('TelegramManager: Telegram app initialized');
            
        } catch (error) {
            console.error('TelegramManager: Failed to initialize Telegram app:', error);
        }
    }
    
    /**
     * Инициализация mock данных для разработки
     */
    initMockData() {
        this.tg = {
            ready: () => {},
            expand: () => {},
            close: () => console.log('Mock: App closed'),
            MainButton: {
                setText: (text) => console.log('Mock MainButton text:', text),
                show: () => console.log('Mock MainButton shown'),
                hide: () => console.log('Mock MainButton hidden'),
                onClick: (callback) => console.log('Mock MainButton callback set'),
                offClick: (callback) => console.log('Mock MainButton callback removed')
            },
            BackButton: {
                show: () => console.log('Mock BackButton shown'),
                hide: () => console.log('Mock BackButton hidden'),
                onClick: (callback) => console.log('Mock BackButton callback set'),
                offClick: (callback) => console.log('Mock BackButton callback removed')
            },
            HapticFeedback: {
                impactOccurred: (style) => console.log('Mock haptic:', style),
                notificationOccurred: (type) => console.log('Mock notification:', type),
                selectionChanged: () => console.log('Mock selection changed')
            },
            initData: 'mock_init_data',
            initDataUnsafe: {
                user: {
                    id: 12345,
                    first_name: 'Тестовый',
                    last_name: 'Пользователь',
                    username: 'test_user',
                    language_code: 'ru',
                    is_premium: false
                },
                chat_type: 'private',
                start_param: null
            },
            version: '6.0',
            platform: 'web',
            colorScheme: 'light',
            themeParams: {
                bg_color: '#ffffff',
                text_color: '#000000',
                hint_color: '#999999',
                link_color: '#6366f1',
                button_color: '#6366f1',
                button_text_color: '#ffffff',
                secondary_bg_color: '#f9fafb'
            },
            isExpanded: true,
            viewportHeight: 600,
            viewportStableHeight: 600
        };
        
        console.log('TelegramManager: Mock data initialized');
    }
    
    /**
     * Настройка пользователя
     */
    setupUser() {
        if (this.mockMode) {
            this.user = this.tg.initDataUnsafe.user;
        } else {
            this.user = this.tg.initDataUnsafe?.user || null;
        }
        
        if (this.user) {
            console.log('TelegramManager: User data loaded:', {
                id: this.user.id,
                name: `${this.user.first_name} ${this.user.last_name || ''}`.trim(),
                username: this.user.username
            });
        } else {
            console.warn('TelegramManager: No user data available');
        }
        
        // Уведомляем подписчиков
        this.callbacks.onUserChange.forEach(callback => {
            try {
                callback(this.user);
            } catch (error) {
                console.error('TelegramManager: User callback error:', error);
            }
        });
    }
    
    /**
     * Настройка тем
     */
    setupThemes() {
        const themeParams = this.tg.themeParams || {};
        const colorScheme = this.tg.colorScheme || 'light';
        
        // Применяем CSS переменные Telegram
        this.applyTelegramTheme(themeParams, colorScheme);
        
        console.log('TelegramManager: Theme applied:', colorScheme);
        
        // Уведомляем подписчиков
        this.callbacks.onThemeChange.forEach(callback => {
            try {
                callback(themeParams, colorScheme);
            } catch (error) {
                console.error('TelegramManager: Theme callback error:', error);
            }
        });
    }
    
    /**
     * Применение темы Telegram к CSS
     */
    applyTelegramTheme(themeParams, colorScheme) {
        const root = document.documentElement;
        
        // Устанавливаем атрибут темы
        root.setAttribute('data-theme', colorScheme);
        
        // Применяем цвета Telegram
        if (themeParams.bg_color) {
            root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
            root.style.setProperty('--bg-primary', themeParams.bg_color);
        }
        
        if (themeParams.text_color) {
            root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
            root.style.setProperty('--text-primary', themeParams.text_color);
        }
        
        if (themeParams.hint_color) {
            root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
            root.style.setProperty('--text-muted', themeParams.hint_color);
        }
        
        if (themeParams.link_color) {
            root.style.setProperty('--tg-theme-link-color', themeParams.link_color);
            root.style.setProperty('--primary-color', themeParams.link_color);
        }
        
        if (themeParams.button_color) {
            root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
        }
        
        if (themeParams.button_text_color) {
            root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
        }
        
        if (themeParams.secondary_bg_color) {
            root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
            root.style.setProperty('--bg-secondary', themeParams.secondary_bg_color);
        }
    }
    
    /**
     * Настройка UI элементов
     */
    setupUI() {
        // Настраиваем viewport
        this.updateViewport();
        
        // Настраиваем кнопки если не в mock режиме
        if (!this.mockMode) {
            // Слушаем изменения viewport
            if (this.tg.onEvent) {
                this.tg.onEvent('viewportChanged', () => {
                    this.updateViewport();
                    this.callbacks.onViewportChange.forEach(callback => {
                        try {
                            callback(this.tg.viewportHeight, this.tg.viewportStableHeight);
                        } catch (error) {
                            console.error('TelegramManager: Viewport callback error:', error);
                        }
                    });
                });
                
                this.tg.onEvent('themeChanged', () => {
                    this.setupThemes();
                });
            }
        }
    }
    
    /**
     * Обновление viewport
     */
    updateViewport() {
        const height = this.tg.viewportHeight || window.innerHeight;
        const stableHeight = this.tg.viewportStableHeight || window.innerHeight;
        
        document.documentElement.style.setProperty('--viewport-height', `${height}px`);
        document.documentElement.style.setProperty('--viewport-stable-height', `${stableHeight}px`);
        
        console.log('TelegramManager: Viewport updated:', { height, stableHeight });
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка главной кнопки
        if (this.tg.MainButton && !this.mockMode) {
            this.tg.MainButton.onClick(() => {
                this.hapticFeedback('light');
                console.log('TelegramManager: Main button clicked');
            });
        }
        
        // Обработка кнопки назад
        if (this.tg.BackButton && !this.mockMode) {
            this.tg.BackButton.onClick(() => {
                this.hapticFeedback('light');
                console.log('TelegramManager: Back button clicked');
                // По умолчанию переходим на главную страницу
                if (window.app && window.app.showPage) {
                    window.app.showPage('home');
                }
            });
        }
    }
    
    /**
     * Получение данных пользователя
     */
    getUserData() {
        return {
            id: this.user?.id || null,
            firstName: this.user?.first_name || 'Пользователь',
            lastName: this.user?.last_name || '',
            username: this.user?.username || null,
            languageCode: this.user?.language_code || 'ru',
            isPremium: this.user?.is_premium || false,
            initData: this.tg.initData || '',
            startParam: this.tg.initDataUnsafe?.start_param || null
        };
    }
    
    /**
     * Haptic feedback
     */
    hapticFeedback(style = 'light') {
        if (this.tg.HapticFeedback) {
            try {
                if (style === 'selection') {
                    this.tg.HapticFeedback.selectionChanged();
                } else if (['error', 'success', 'warning'].includes(style)) {
                    this.tg.HapticFeedback.notificationOccurred(style);
                } else {
                    this.tg.HapticFeedback.impactOccurred(style);
                }
            } catch (error) {
                console.error('TelegramManager: Haptic feedback error:', error);
            }
        }
    }
    
    /**
     * Показ главной кнопки
     */
    showMainButton(text, callback) {
        if (this.tg.MainButton) {
            this.tg.MainButton.setText(text);
            this.tg.MainButton.show();
            
            if (callback && !this.mockMode) {
                this.tg.MainButton.onClick(callback);
            }
            
            console.log('TelegramManager: Main button shown:', text);
        }
    }
    
    /**
     * Скрытие главной кнопки
     */
    hideMainButton() {
        if (this.tg.MainButton) {
            this.tg.MainButton.hide();
            console.log('TelegramManager: Main button hidden');
        }
    }
    
    /**
     * Показ кнопки назад
     */
    showBackButton(callback) {
        if (this.tg.BackButton) {
            this.tg.BackButton.show();
            
            if (callback && !this.mockMode) {
                this.tg.BackButton.onClick(callback);
            }
            
            console.log('TelegramManager: Back button shown');
        }
    }
    
    /**
     * Скрытие кнопки назад
     */
    hideBackButton() {
        if (this.tg.BackButton) {
            this.tg.BackButton.hide();
            console.log('TelegramManager: Back button hidden');
        }
    }
    
    /**
     * Закрытие приложения
     */
    close() {
        if (this.tg.close) {
            this.tg.close();
        } else {
            console.log('TelegramManager: Close requested but not available');
        }
    }
    
    /**
     * Подписка на события
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            console.warn('TelegramManager: Unknown event:', event);
        }
    }
    
    /**
     * Отписка от событий
     */
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }
    
    /**
     * Получение информации о платформе
     */
    getPlatformInfo() {
        return {
            platform: this.tg.platform || 'unknown',
            version: this.tg.version || 'unknown',
            colorScheme: this.tg.colorScheme || 'light',
            isExpanded: this.tg.isExpanded || false,
            viewportHeight: this.tg.viewportHeight || window.innerHeight,
            isMock: this.mockMode
        };
    }
    
    /**
     * Проверка доступности функций
     */
    hasFeature(feature) {
        const features = {
            mainButton: !!this.tg.MainButton,
            backButton: !!this.tg.BackButton,
            hapticFeedback: !!this.tg.HapticFeedback,
            cloudStorage: !!this.tg.CloudStorage,
            biometricAuth: !!this.tg.BiometricManager
        };
        
        return features[feature] || false;
    }
}

// Создаем глобальный экземпляр
window.TelegramManager = new TelegramManager();

// Экспортируем для совместимости
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramManager;
}

console.log('TelegramManager: Module loaded');