/**
 * TELEGRAM.JS - Интеграция с Telegram Web App SDK v2.0
 * ИСПРАВЛЕНО: Автоматическое чтение темы от Telegram без mock режима
 * Полная поддержка всех themeParams из Telegram Mini Apps API
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
        
        // Полная поддержка всех Telegram themeParams
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
        
        console.log('TelegramManager v2.1: Constructor initialized with auto theme detection');
    }
    
    /**
     * Инициализация Telegram Web App
     */
    init() {
        console.log('TelegramManager v2.1: Starting initialization...');
        
        try {
            // ИСПРАВЛЕНО: Всегда пытаемся подключиться к Telegram
            if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
                this.tg = window.Telegram.WebApp;
                this.mockMode = false;
                console.log('✅ TelegramManager: Real Telegram Web App detected');
                this.initTelegramApp();
            } else {
                console.warn('⚠️ TelegramManager: Telegram Web App not available, fallback mode');
                this.mockMode = true;
                this.initFallbackMode();
            }
            
            this.setupUser();
            this.setupThemes(); // ← КЛЮЧЕВОЙ МЕТОД ДЛЯ ТЕМ
            this.setupUI();
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ TelegramManager v2.1: Initialization completed');
            
            return this.getUserData();
            
        } catch (error) {
            console.error('❌ TelegramManager: Initialization failed:', error);
            this.mockMode = true;
            this.initFallbackMode();
            this.isInitialized = true;
            return this.getUserData();
        }
    }
    
    /**
     * Инициализация реального Telegram Web App
     */
    initTelegramApp() {
        try {
            // Готовим приложение
            this.tg.ready();
            
            // Расширяем viewport
            this.tg.expand();
            
            // Настраиваем кнопки
            this.tg.MainButton.setText('Готово');
            this.tg.MainButton.hide();
            
            if (this.tg.BackButton) {
                this.tg.BackButton.hide();
            }
            
            // Включаем закрытие при свайпе
            if (this.tg.enableClosingConfirmation) {
                this.tg.enableClosingConfirmation();
            }
            
            console.log('✅ Telegram app initialized:', {
                version: this.tg.version,
                platform: this.tg.platform,
                colorScheme: this.tg.colorScheme,
                themeParams: Object.keys(this.tg.themeParams || {}).length
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Telegram app:', error);
        }
    }
    
    /**
     * НОВОЕ: Fallback режим для тестирования
     */
    initFallbackMode() {
        // Создаем минимальный mock объект
        this.tg = {
            ready: () => {},
            expand: () => {},
            close: () => console.log('Mock: App closed'),
            MainButton: {
                setText: (text) => console.log('Mock MainButton text:', text),
                show: () => {},
                hide: () => {},
                onClick: () => {},
                offClick: () => {}
            },
            BackButton: {
                show: () => {},
                hide: () => {},
                onClick: () => {},
                offClick: () => {}
            },
            HapticFeedback: {
                impactOccurred: (style) => console.log('Mock haptic:', style),
                notificationOccurred: (type) => console.log('Mock notification:', type),
                selectionChanged: () => console.log('Mock selection changed')
            },
            initData: 'fallback_mode',
            initDataUnsafe: {
                user: {
                    id: 999999,
                    first_name: 'Читатель',
                    last_name: '',
                    username: 'reader_user',
                    language_code: 'ru',
                    is_premium: false
                }
            },
            version: '6.0',
            platform: 'web',
            // ВАЖНО: Пустые значения для автоопределения
            colorScheme: 'light', 
            themeParams: {},
            isExpanded: true,
            viewportHeight: 600,
            viewportStableHeight: 600
        };
        
        console.log('⚠️ Fallback mode initialized');
    }
    
    /**
     * Настройка пользователя
     */
    setupUser() {
        this.user = this.tg.initDataUnsafe?.user || null;
        
        if (this.user) {
            console.log('✅ User data loaded:', {
                id: this.user.id,
                name: `${this.user.first_name} ${this.user.last_name || ''}`.trim(),
                username: this.user.username
            });
        } else {
            console.warn('⚠️ No user data available');
        }
        
        // Уведомляем подписчиков
        this.callbacks.onUserChange.forEach(callback => {
            try {
                callback(this.user);
            } catch (error) {
                console.error('❌ User callback error:', error);
            }
        });
    }
    
    /**
     * ИСПРАВЛЕНО: Автоматическая настройка тем
     */
    setupThemes() {
        console.log('🎨 Setting up themes...');
        
        // АВТООПРЕДЕЛЕНИЕ ТЕМЫ
        let themeParams = {};
        let colorScheme = 'light';
        
        if (!this.mockMode && this.tg.themeParams) {
            // Реальные данные от Telegram
            themeParams = this.tg.themeParams;
            colorScheme = this.tg.colorScheme || 'light';
            console.log('✅ Using real Telegram theme:', colorScheme, themeParams);
        } else {
            // Определяем тему из системы браузера
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            colorScheme = prefersDark ? 'dark' : 'light';
            
            // Устанавливаем базовые цвета
            themeParams = this.getDefaultThemeParams(colorScheme);
            console.log('🔧 Using auto-detected theme:', colorScheme);
        }
        
        // ПРИМЕНЯЕМ ТЕМУ
        this.applyTelegramTheme(themeParams, colorScheme);
        this.showThemeIndicator(colorScheme);
        
        console.log('✅ Theme applied successfully:', colorScheme);
        
        // Уведомляем подписчиков
        this.callbacks.onThemeChange.forEach(callback => {
            try {
                callback(themeParams, colorScheme);
            } catch (error) {
                console.error('❌ Theme callback error:', error);
            }
        });
    }
    
    /**
     * НОВОЕ: Получение дефолтных параметров темы
     */
    getDefaultThemeParams(colorScheme) {
        const defaultThemes = {
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
            }
        };
        
        return defaultThemes[colorScheme] || defaultThemes.light;
    }
    
    /**
     * Применение темы к CSS
     */
    applyTelegramTheme(themeParams, colorScheme) {
        const root = document.documentElement;
        
        // Устанавливаем атрибут темы
        root.setAttribute('data-theme', colorScheme);
        
        // Применяем все themeParams как CSS переменные
        this.supportedThemeParams.forEach(param => {
            const cssVar = `--tg-${param.replace(/_/g, '-')}`;
            if (themeParams[param]) {
                root.style.setProperty(cssVar, themeParams[param]);
            }
        });
        
        // ДОПОЛНИТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ СОВМЕСТИМОСТИ
        if (themeParams.bg_color) {
            root.style.setProperty('--bg-primary', themeParams.bg_color);
            document.body.style.backgroundColor = themeParams.bg_color;
        }
        
        if (themeParams.text_color) {
            root.style.setProperty('--text-primary', themeParams.text_color);
            document.body.style.color = themeParams.text_color;
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
        
        console.log('🎨 CSS variables applied:', {
            bgColor: themeParams.bg_color,
            textColor: themeParams.text_color,
            colorScheme: colorScheme
        });
        
        this.animateThemeTransition();
    }
    
    /**
     * Анимация перехода между темами
     */
    animateThemeTransition() {
        let overlay = document.querySelector('.theme-transition-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'theme-transition-overlay';
            document.body.appendChild(overlay);
        }
        
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 300);
    }
    
    /**
     * Показ индикатора смены темы
     */
    showThemeIndicator(colorScheme) {
        let indicator = document.querySelector('.theme-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'theme-indicator';
            document.body.appendChild(indicator);
        }
        
        const themeNames = {
            light: '☀️ Светлая тема',
            dark: '🌙 Темная тема'
        };
        
        indicator.textContent = themeNames[colorScheme] || `🎨 Тема: ${colorScheme}`;
        indicator.classList.add('show');
        
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }
    
    /**
     * Настройка UI элементов
     */
    setupUI() {
        this.updateViewport();
        
        if (!this.mockMode) {
            // Слушаем изменения viewport
            if (this.tg.onEvent) {
                this.tg.onEvent('viewportChanged', () => {
                    this.updateViewport();
                    this.callbacks.onViewportChange.forEach(callback => {
                        try {
                            callback(this.tg.viewportHeight, this.tg.viewportStableHeight);
                        } catch (error) {
                            console.error('❌ Viewport callback error:', error);
                        }
                    });
                });
                
                // ВАЖНО: Слушаем изменения темы
                this.tg.onEvent('themeChanged', () => {
                    console.log('🎨 Telegram theme change event received');
                    this.setupThemes(); // Перенастраиваем темы
                });
            }
        }
        
        // Добавляем debug панель в fallback режиме
        if (this.mockMode) {
            this.addDebugThemeInfo();
        }
    }
    
    /**
     * Добавление debug панели
     */
    addDebugThemeInfo() {
        let debugInfo = document.querySelector('.debug-theme-info');
        if (!debugInfo) {
            debugInfo = document.createElement('div');
            debugInfo.className = 'debug-theme-info';
            document.body.appendChild(debugInfo);
        }
        
        const colorScheme = this.getCurrentTheme().colorScheme;
        
        debugInfo.innerHTML = `
            <div>Mode: ${this.mockMode ? 'Fallback' : 'Telegram'}</div>
            <div>Theme: ${colorScheme}</div>
            <div>Auto-detect: ${window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'}</div>
            <div style="margin-top: 4px; font-size: 0.6rem;">
                ${this.mockMode ? 'Click to toggle theme' : 'Theme from Telegram'}
            </div>
        `;
        
        if (this.mockMode) {
            debugInfo.style.cursor = 'pointer';
            debugInfo.onclick = () => this.toggleMockTheme();
        }
    }
    
    /**
     * Переключение темы в fallback режиме
     */
    toggleMockTheme() {
        if (!this.mockMode) return;
        
        const currentScheme = this.getCurrentTheme().colorScheme;
        const newScheme = currentScheme === 'light' ? 'dark' : 'light';
        
        // Обновляем тему
        this.tg.colorScheme = newScheme;
        this.tg.themeParams = this.getDefaultThemeParams(newScheme);
        
        console.log(`🔄 Mock theme switched to: ${newScheme}`);
        this.setupThemes();
        this.addDebugThemeInfo();
    }
    
    /**
     * Обновление viewport
     */
    updateViewport() {
        const height = this.tg.viewportHeight || window.innerHeight;
        const stableHeight = this.tg.viewportStableHeight || window.innerHeight;
        
        document.documentElement.style.setProperty('--viewport-height', `${height}px`);
        document.documentElement.style.setProperty('--viewport-stable-height', `${stableHeight}px`);
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка главной кнопки
        if (this.tg.MainButton && !this.mockMode) {
            this.tg.MainButton.onClick(() => {
                this.hapticFeedback('light');
            });
        }
        
        // Обработка кнопки назад
        if (this.tg.BackButton && !this.mockMode) {
            this.tg.BackButton.onClick(() => {
                this.hapticFeedback('light');
                if (window.app && window.app.showPage) {
                    window.app.showPage('home');
                }
            });
        }
        
        // НОВОЕ: Слушаем изменения системной темы браузера
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                if (this.mockMode) {
                    console.log('🔄 System theme changed:', e.matches ? 'dark' : 'light');
                    // В fallback режиме реагируем на системную тему
                    const newScheme = e.matches ? 'dark' : 'light';
                    this.tg.colorScheme = newScheme;
                    this.tg.themeParams = this.getDefaultThemeParams(newScheme);
                    this.setupThemes();
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
            firstName: this.user?.first_name || 'Читатель',
            lastName: this.user?.last_name || '',
            username: this.user?.username || null,
            languageCode: this.user?.language_code || 'ru',
            isPremium: this.user?.is_premium || false,
            initData: this.tg.initData || '',
            startParam: this.tg.initDataUnsafe?.start_param || null,
            colorScheme: this.tg.colorScheme || 'light',
            themeParams: this.tg.themeParams || {}
        };
    }
    
    /**
     * Получение текущей темы
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
                console.error('❌ Haptic feedback error:', error);
            }
        }
    }
    
    /**
     * Вибрация - алиас для hapticFeedback для совместимости
     */
    vibrate(style = 'light') {
        return this.hapticFeedback(style);
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
        }
    }
    
    /**
     * Скрытие главной кнопки
     */
    hideMainButton() {
        if (this.tg.MainButton) {
            this.tg.MainButton.hide();
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
        }
    }
    
    /**
     * Скрытие кнопки назад
     */
    hideBackButton() {
        if (this.tg.BackButton) {
            this.tg.BackButton.hide();
        }
    }
    
    /**
     * Закрытие приложения
     */
    close() {
        if (this.tg.close) {
            this.tg.close();
        }
    }
    
    /**
     * Подписка на события
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
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
            themeParams: !!this.tg.themeParams,
            themeEvents: !this.mockMode && !!this.tg.onEvent
        };
        
        return features[feature] || false;
    }
    
    /**
     * Получение конкретного параметра темы
     */
    getThemeParam(paramName) {
        return this.tg.themeParams?.[paramName] || null;
    }
    
    /**
     * Проверка поддержки параметра темы
     */
    isThemeParamSupported(paramName) {
        return this.supportedThemeParams.includes(paramName);
    }
    
    /**
     * Получение CSS переменной для параметра темы
     */
    getThemeParamCSSVar(paramName) {
        if (this.isThemeParamSupported(paramName)) {
            return `--tg-${paramName.replace(/_/g, '-')}`;
        }
        return null;
    }
    
    /**
     * Форсированное обновление темы
     */
    forceThemeUpdate() {
        console.log('🔄 Force theme update requested');
        this.setupThemes();
    }
    
    /**
     * Экспорт текущей темы
     */
    exportCurrentTheme() {
        return {
            colorScheme: this.tg.colorScheme,
            themeParams: { ...this.tg.themeParams },
            timestamp: Date.now(),
            version: '2.1'
        };
    }
}

// Создаем глобальный экземпляр
window.TelegramManager = new TelegramManager();

console.log('✅ TelegramManager v2.1: Module loaded with automatic theme detection');
