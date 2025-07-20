/**
 * TELEGRAM.JS - Интеграция с Telegram Web App SDK v2.0
 * НОВОЕ: Полная поддержка всех themeParams из Telegram Mini Apps API
 * Плавные переходы между темами, автоматическая адаптация, расширенный mock режим
 */

class TelegramManager {
    constructor() {
        this.tg = null;
        this.user = null;
        this.isInitialized = false;
        this.mockMode = false;
        this.currentTheme = 'light';
        this.callbacks = {
            onUserChange: [],
            onThemeChange: [],
            onViewportChange: []
        };
        
        // НОВОЕ: Полная поддержка всех Telegram themeParams
        this.supportedThemeParams = [
            'accent_text_color',
            'bg_color', 
            'button_color',
            'button_text_color',
            'bottom_bar_bg_color',
            'destructive_text_color',
            'header_bg_color',
            'hint_color',
            'link_color',
            'secondary_bg_color',
            'section_bg_color',
            'section_header_text_color',
            'subtitle_text_color',
            'text_color',
            'section_separator_color'
        ];
        
        console.log('TelegramManager v2.0: Constructor initialized with full theme support');
    }
    
    /**
     * Инициализация Telegram Web App
     */
    init() {
        console.log('TelegramManager v2.0: Starting initialization...');
        
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
            console.log('TelegramManager v2.0: Initialization completed');
            
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
     * НОВОЕ: Расширенная инициализация mock данных с поддержкой всех тем
     */
    initMockData() {
        // Определяем случайную тему для тестирования
        const themes = ['light', 'dark', 'custom'];
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        
        this.currentTheme = randomTheme;
        
        // НОВОЕ: Расширенные mock themeParams для всех типов тем
        const mockThemes = {
            light: {
                accent_text_color: '#6ab2f2',
                bg_color: '#ffffff',
                button_color: '#5288c1',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#ffffff',
                destructive_text_color: '#ec3942',
                header_bg_color: '#ffffff',
                hint_color: '#999999',
                link_color: '#6ab3f3',
                secondary_bg_color: '#f4f4f5',
                section_bg_color: '#ffffff',
                section_header_text_color: '#6ab3f3',
                subtitle_text_color: '#999999',
                text_color: '#000000',
                section_separator_color: '#e7e8ea'
            },
            dark: {
                accent_text_color: '#6ab2f2',
                bg_color: '#17212b',
                button_color: '#5288c1',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#17212b',
                destructive_text_color: '#ec3942',
                header_bg_color: '#17212b',
                hint_color: '#708499',
                link_color: '#6ab3f3',
                secondary_bg_color: '#232e3c',
                section_bg_color: '#17212b',
                section_header_text_color: '#6ab3f3',
                subtitle_text_color: '#708499',
                text_color: '#f5f5f5',
                section_separator_color: '#2a3441'
            },
            custom: {
                accent_text_color: '#d4af37', // Золотистый как у Анны
                bg_color: '#1a1a1a',
                button_color: '#d4af37',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#1a1a1a',
                destructive_text_color: '#ff4757',
                header_bg_color: '#1a1a1a',
                hint_color: '#888888',
                link_color: '#d4af37',
                secondary_bg_color: '#2c2c2c',
                section_bg_color: '#1a1a1a',
                section_header_text_color: '#d4af37',
                subtitle_text_color: '#888888',
                text_color: '#ffffff',
                section_separator_color: '#444444'
            }
        };
        
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
            colorScheme: randomTheme === 'light' ? 'light' : 'dark',
            themeParams: mockThemes[randomTheme],
            isExpanded: true,
            viewportHeight: 600,
            viewportStableHeight: 600,
            // НОВОЕ: Mock методы для работы с темами
            onEvent: (eventName, callback) => {
                console.log(`Mock: Event listener set for ${eventName}`);
                // Симулируем смену темы через 5 секунд для тестирования
                if (eventName === 'themeChanged') {
                    setTimeout(() => {
                        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                        this.currentTheme = newTheme;
                        this.tg.colorScheme = newTheme;
                        this.tg.themeParams = mockThemes[newTheme];
                        console.log(`Mock: Theme changed to ${newTheme}`);
                        callback();
                    }, 5000);
                }
            }
        };
        
        console.log(`TelegramManager: Mock data initialized with ${randomTheme} theme`);
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
     * НОВОЕ: Расширенная настройка тем с поддержкой всех themeParams
     */
    setupThemes() {
        const themeParams = this.tg.themeParams || {};
        const colorScheme = this.tg.colorScheme || 'light';
        
        // Применяем CSS переменные Telegram
        this.applyTelegramTheme(themeParams, colorScheme);
        
        // НОВОЕ: Показываем индикатор смены темы
        this.showThemeIndicator(colorScheme);
        
        console.log('TelegramManager v2.0: Theme applied:', colorScheme, themeParams);
        
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
     * НОВОЕ: Полное применение всех Telegram themeParams к CSS
     */
    applyTelegramTheme(themeParams, colorScheme) {
        const root = document.documentElement;
        
        // Устанавливаем атрибут темы
        root.setAttribute('data-theme', colorScheme);
        
        // НОВОЕ: Применяем все поддерживаемые themeParams
        this.supportedThemeParams.forEach(param => {
            const cssVar = `--tg-${param.replace(/_/g, '-')}`;
            if (themeParams[param]) {
                root.style.setProperty(cssVar, themeParams[param]);
                console.log(`Applied ${cssVar}: ${themeParams[param]}`);
            }
        });
        
        // Устанавливаем основные переменные для совместимости
        if (themeParams.bg_color) {
            root.style.setProperty('--bg-primary', themeParams.bg_color);
        }
        
        if (themeParams.text_color) {
            root.style.setProperty('--text-primary', themeParams.text_color);
        }
        
        if (themeParams.hint_color) {
            root.style.setProperty('--text-muted', themeParams.hint_color);
        }
        
        if (themeParams.link_color) {
            root.style.setProperty('--primary-color', themeParams.link_color);
        }
        
        if (themeParams.secondary_bg_color) {
            root.style.setProperty('--bg-secondary', themeParams.secondary_bg_color);
        }
        
        // НОВОЕ: Добавляем плавную анимацию перехода
        this.animateThemeTransition();
    }
    
    /**
     * НОВОЕ: Анимация перехода между темами
     */
    animateThemeTransition() {
        // Создаем overlay для плавного перехода
        let overlay = document.querySelector('.theme-transition-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'theme-transition-overlay';
            document.body.appendChild(overlay);
        }
        
        // Показываем overlay
        overlay.classList.add('active');
        
        // Скрываем через короткое время
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 300);
    }
    
    /**
     * НОВОЕ: Показ индикатора смены темы
     */
    showThemeIndicator(colorScheme) {
        // Создаем или находим индикатор
        let indicator = document.querySelector('.theme-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'theme-indicator';
            document.body.appendChild(indicator);
        }
        
        // Устанавливаем текст
        const themeNames = {
            light: '☀️ Светлая тема',
            dark: '🌙 Темная тема'
        };
        
        indicator.textContent = themeNames[colorScheme] || `🎨 ${colorScheme.charAt(0).toUpperCase() + colorScheme.slice(1)} тема`;
        
        // Показываем индикатор
        indicator.classList.add('show');
        
        // Скрываем через 2 секунды
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
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
                
                // НОВОЕ: Слушаем изменения темы
                this.tg.onEvent('themeChanged', () => {
                    console.log('TelegramManager: Theme change event received');
                    this.setupThemes();
                });
            }
        }
        
        // НОВОЕ: Добавляем отладочную информацию о теме
        if (this.mockMode) {
            this.addDebugThemeInfo();
        }
    }
    
    /**
     * НОВОЕ: Добавление отладочной информации о теме
     */
    addDebugThemeInfo() {
        let debugInfo = document.querySelector('.debug-theme-info');
        if (!debugInfo) {
            debugInfo = document.createElement('div');
            debugInfo.className = 'debug-theme-info';
            document.body.appendChild(debugInfo);
        }
        
        const themeParams = this.tg.themeParams || {};
        const colorScheme = this.tg.colorScheme || 'unknown';
        
        debugInfo.innerHTML = `
            <div>Theme: ${colorScheme}</div>
            <div>Params: ${Object.keys(themeParams).length}</div>
            <div>Mock: ${this.mockMode ? 'Yes' : 'No'}</div>
            <div style="margin-top: 4px; font-size: 0.6rem;">
                Click to toggle theme (mock)
            </div>
        `;
        
        // В mock режиме позволяем переключать тему кликом
        if (this.mockMode) {
            debugInfo.style.cursor = 'pointer';
            debugInfo.onclick = () => {
                this.toggleMockTheme();
            };
        }
    }
    
    /**
     * НОВОЕ: Переключение темы в mock режиме для тестирования
     */
    toggleMockTheme() {
        if (!this.mockMode) return;
        
        const themes = ['light', 'dark', 'custom'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const newTheme = themes[nextIndex];
        
        this.currentTheme = newTheme;
        this.tg.colorScheme = newTheme === 'light' ? 'light' : 'dark';
        
        // Обновляем mock themeParams
        const mockThemes = {
            light: {
                accent_text_color: '#6ab2f2',
                bg_color: '#ffffff',
                button_color: '#5288c1',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#ffffff',
                destructive_text_color: '#ec3942',
                header_bg_color: '#ffffff',
                hint_color: '#999999',
                link_color: '#6ab3f3',
                secondary_bg_color: '#f4f4f5',
                section_bg_color: '#ffffff',
                section_header_text_color: '#6ab3f3',
                subtitle_text_color: '#999999',
                text_color: '#000000',
                section_separator_color: '#e7e8ea'
            },
            dark: {
                accent_text_color: '#6ab2f2',
                bg_color: '#17212b',
                button_color: '#5288c1',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#17212b',
                destructive_text_color: '#ec3942',
                header_bg_color: '#17212b',
                hint_color: '#708499',
                link_color: '#6ab3f3',
                secondary_bg_color: '#232e3c',
                section_bg_color: '#17212b',
                section_header_text_color: '#6ab3f3',
                subtitle_text_color: '#708499',
                text_color: '#f5f5f5',
                section_separator_color: '#2a3441'
            },
            custom: {
                accent_text_color: '#d4af37',
                bg_color: '#1a1a1a',
                button_color: '#d4af37',
                button_text_color: '#ffffff',
                bottom_bar_bg_color: '#1a1a1a',
                destructive_text_color: '#ff4757',
                header_bg_color: '#1a1a1a',
                hint_color: '#888888',
                link_color: '#d4af37',
                secondary_bg_color: '#2c2c2c',
                section_bg_color: '#1a1a1a',
                section_header_text_color: '#d4af37',
                subtitle_text_color: '#888888',
                text_color: '#ffffff',
                section_separator_color: '#444444'
            }
        };
        
        this.tg.themeParams = mockThemes[newTheme];
        
        console.log(`Mock: Theme switched to ${newTheme}`);
        this.setupThemes();
        this.addDebugThemeInfo(); // Обновляем отладочную информацию
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
            startParam: this.tg.initDataUnsafe?.start_param || null,
            // НОВОЕ: Информация о теме
            colorScheme: this.tg.colorScheme || 'light',
            themeParams: this.tg.themeParams || {}
        };
    }
    
    /**
     * НОВОЕ: Получение текущей темы
     */
    getCurrentTheme() {
        return {
            colorScheme: this.tg.colorScheme || 'light',
            themeParams: this.tg.themeParams || {},
            isDark: this.tg.colorScheme === 'dark',
            isLight: this.tg.colorScheme === 'light'
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
            isMock: this.mockMode,
            // НОВОЕ: Информация о поддерживаемых параметрах темы
            supportedThemeParams: this.supportedThemeParams,
            activeThemeParams: Object.keys(this.tg.themeParams || {})
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
            biometricAuth: !!this.tg.BiometricManager,
            // НОВОЕ: Проверка поддержки тем
            themeParams: !!this.tg.themeParams,
            themeEvents: !this.mockMode && !!this.tg.onEvent
        };
        
        return features[feature] || false;
    }
    
    /**
     * НОВОЕ: Получение конкретного параметра темы
     */
    getThemeParam(paramName) {
        return this.tg.themeParams?.[paramName] || null;
    }
    
    /**
     * НОВОЕ: Проверка поддержки параметра темы
     */
    isThemeParamSupported(paramName) {
        return this.supportedThemeParams.includes(paramName);
    }
    
    /**
     * НОВОЕ: Получение CSS переменной для параметра темы
     */
    getThemeParamCSSVar(paramName) {
        if (this.isThemeParamSupported(paramName)) {
            return `--tg-${paramName.replace(/_/g, '-')}`;
        }
        return null;
    }
    
    /**
     * НОВОЕ: Форсированное обновление темы (для отладки)
     */
    forceThemeUpdate() {
        console.log('TelegramManager: Force theme update requested');
        this.setupThemes();
    }
    
    /**
     * НОВОЕ: Экспорт текущей темы
     */
    exportCurrentTheme() {
        return {
            colorScheme: this.tg.colorScheme,
            themeParams: { ...this.tg.themeParams },
            timestamp: Date.now(),
            version: '2.0'
        };
    }
}

// Создаем глобальный экземпляр
window.TelegramManager = new TelegramManager();

// Экспортируем для совместимости
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramManager;
}

console.log('TelegramManager v2.0: Module loaded with full theme support');