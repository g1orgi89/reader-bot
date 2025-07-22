/**
 * TELEGRAM MINI APP DETECTOR & NAVIGATION FIXER
 * 
 * Определяет Telegram окружение и применяет специальные CSS классы
 * для исправления проблем с нижней навигацией
 */

class TelegramNavigationFixer {
    constructor() {
        this.isTelegram = false;
        this.isDarkTheme = false;
        this.debugMode = false;
        
        this.init();
    }
    
    /**
     * Инициализация детектора
     */
    init() {
        // Проверяем Telegram окружение
        this.detectTelegramEnvironment();
        
        // Применяем CSS классы
        this.applyCSSClasses();
        
        // Настраиваем слушатели
        this.setupEventListeners();
        
        // Запускаем принудительный фиксер
        this.startNavigationWatcher();
        
        console.log('🔧 TelegramNavigationFixer:', {
            isTelegram: this.isTelegram,
            isDarkTheme: this.isDarkTheme,
            userAgent: navigator.userAgent,
            tgWebApp: !!window.Telegram?.WebApp
        });
    }
    
    /**
     * Определяем Telegram окружение
     */
    detectTelegramEnvironment() {
        // Метод 1: Проверка Telegram WebApp API
        if (window.Telegram?.WebApp) {
            this.isTelegram = true;
            console.log('✅ Detected via Telegram.WebApp API');
        }
        
        // Метод 2: Проверка User Agent
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('telegram')) {
            this.isTelegram = true;
            console.log('✅ Detected via User Agent');
        }
        
        // Метод 3: Проверка параметров URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tgWebAppPlatform') || urlParams.get('tgWebAppVersion')) {
            this.isTelegram = true;
            console.log('✅ Detected via URL params');
        }
        
        // Метод 4: Проверка referrer
        if (document.referrer.includes('telegram.org') || document.referrer.includes('t.me')) {
            this.isTelegram = true;
            console.log('✅ Detected via referrer');
        }
        
        // Метод 5: Проверка window размеров (Telegram имеет специфичные размеры)
        const isTelegramSize = window.innerWidth <= 430 && window.innerHeight >= 600;
        if (isTelegramSize && (window.Telegram || userAgent.includes('mobile'))) {
            this.isTelegram = true;
            console.log('✅ Detected via window size');
        }
        
        // Определяем тему
        this.detectTheme();
    }
    
    /**
     * Определяем тему Telegram
     */
    detectTheme() {
        if (window.Telegram?.WebApp?.colorScheme) {
            this.isDarkTheme = window.Telegram.WebApp.colorScheme === 'dark';
        } else {
            // Fallback на системную тему
            this.isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        console.log('🎨 Theme detected:', this.isDarkTheme ? 'dark' : 'light');
    }
    
    /**
     * Применяем CSS классы
     */
    applyCSSClasses() {
        const body = document.body;
        
        if (this.isTelegram) {
            body.classList.add('telegram-mini-app');
            console.log('✅ Applied .telegram-mini-app class');
        }
        
        if (this.isDarkTheme) {
            body.classList.add('dark-theme');
            console.log('✅ Applied .dark-theme class');
        } else {
            body.classList.add('light-theme');
            console.log('✅ Applied .light-theme class');
        }
        
        // Debug режим (можно включить через localStorage)
        if (localStorage.getItem('telegram-debug') === 'true') {
            body.classList.add('debug');
            this.debugMode = true;
            console.log('✅ Debug mode enabled');
        }
    }
    
    /**
     * Настройка слушателей событий
     */
    setupEventListeners() {
        if (!this.isTelegram) return;
        
        // Слушаем изменения темы в Telegram
        if (window.Telegram?.WebApp?.onEvent) {\n            window.Telegram.WebApp.onEvent('themeChanged', () => {\n                console.log('🎨 Telegram theme changed');\n                this.detectTheme();\n                this.updateThemeClass();\n            });\n        }\n        \n        // Слушаем изменения viewport в Telegram\n        if (window.Telegram?.WebApp?.onEvent) {\n            window.Telegram.WebApp.onEvent('viewportChanged', () => {\n                console.log('📱 Telegram viewport changed');\n                this.forceNavigationFix();\n            });\n        }\n        \n        // Слушаем стандартные события браузера\n        window.addEventListener('resize', () => {\n            if (this.isTelegram) {\n                setTimeout(() => this.forceNavigationFix(), 100);\n            }\n        });\n        \n        window.addEventListener('orientationchange', () => {\n            if (this.isTelegram) {\n                setTimeout(() => this.forceNavigationFix(), 300);\n            }\n        });\n        \n        // Слушаем scroll события\n        let scrollTimeout;\n        window.addEventListener('scroll', () => {\n            if (!this.isTelegram) return;\n            \n            clearTimeout(scrollTimeout);\n            scrollTimeout = setTimeout(() => {\n                this.forceNavigationFix();\n            }, 50);\n        }, { passive: true });\n    }\n    \n    /**\n     * Обновляем класс темы\n     */\n    updateThemeClass() {\n        const body = document.body;\n        \n        if (this.isDarkTheme) {\n            body.classList.remove('light-theme');\n            body.classList.add('dark-theme');\n        } else {\n            body.classList.remove('dark-theme');\n            body.classList.add('light-theme');\n        }\n    }\n    \n    /**\n     * Принудительное исправление навигации\n     */\n    forceNavigationFix() {\n        if (!this.isTelegram) return;\n        \n        const nav = document.querySelector('.bottom-nav');\n        if (!nav) return;\n        \n        // Сбрасываем все возможные стили которые могли быть добавлены\n        nav.style.transform = '';\n        nav.style.webkitTransform = '';\n        nav.style.translate = '';\n        nav.style.bottom = '';\n        nav.style.position = '';\n        nav.style.left = '';\n        nav.style.right = '';\n        nav.style.margin = '';\n        nav.style.marginLeft = '';\n        nav.style.marginRight = '';\n        \n        // Принудительно применяем правильные стили\n        nav.style.cssText = `\n            position: fixed !important;\n            bottom: 0 !important;\n            left: 0 !important;\n            right: 0 !important;\n            transform: none !important;\n            -webkit-transform: none !important;\n            margin: 0 !important;\n            width: 100% !important;\n            z-index: 999999 !important;\n        `;\n        \n        if (this.debugMode) {\n            console.log('🔧 Navigation position forced:', {\n                bottom: nav.getBoundingClientRect().bottom,\n                windowHeight: window.innerHeight\n            });\n        }\n    }\n    \n    /**\n     * Запускаем наблюдатель за навигацией\n     */\n    startNavigationWatcher() {\n        if (!this.isTelegram) return;\n        \n        // Немедленно исправляем позицию\n        setTimeout(() => this.forceNavigationFix(), 100);\n        \n        // Создаем MutationObserver для отслеживания изменений\n        const observer = new MutationObserver((mutations) => {\n            mutations.forEach((mutation) => {\n                if (mutation.type === 'attributes' && \n                    mutation.target.classList.contains('bottom-nav') &&\n                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {\n                    \n                    // Кто-то изменил стили навигации - исправляем\n                    setTimeout(() => this.forceNavigationFix(), 10);\n                }\n            });\n        });\n        \n        // Наблюдаем за изменениями в навигации\n        const nav = document.querySelector('.bottom-nav');\n        if (nav) {\n            observer.observe(nav, {\n                attributes: true,\n                attributeFilter: ['style', 'class']\n            });\n        }\n        \n        // Периодическая проверка позиции (каждые 2 секунды)\n        setInterval(() => {\n            if (this.isTelegram) {\n                this.checkNavigationPosition();\n            }\n        }, 2000);\n    }\n    \n    /**\n     * Проверяем позицию навигации\n     */\n    checkNavigationPosition() {\n        const nav = document.querySelector('.bottom-nav');\n        if (!nav) return;\n        \n        const rect = nav.getBoundingClientRect();\n        const windowHeight = window.innerHeight;\n        \n        // Если навигация не внизу экрана - исправляем\n        if (Math.abs(rect.bottom - windowHeight) > 5) {\n            if (this.debugMode) {\n                console.warn('⚠️ Navigation position drift detected:', {\n                    navBottom: rect.bottom,\n                    windowHeight: windowHeight,\n                    difference: rect.bottom - windowHeight\n                });\n            }\n            \n            this.forceNavigationFix();\n        }\n    }\n    \n    /**\n     * Публичные методы для отладки\n     */\n    enableDebug() {\n        localStorage.setItem('telegram-debug', 'true');\n        document.body.classList.add('debug');\n        this.debugMode = true;\n        console.log('✅ Debug mode enabled');\n    }\n    \n    disableDebug() {\n        localStorage.removeItem('telegram-debug');\n        document.body.classList.remove('debug');\n        this.debugMode = false;\n        console.log('❌ Debug mode disabled');\n    }\n    \n    getStatus() {\n        return {\n            isTelegram: this.isTelegram,\n            isDarkTheme: this.isDarkTheme,\n            debugMode: this.debugMode,\n            userAgent: navigator.userAgent,\n            windowSize: {\n                width: window.innerWidth,\n                height: window.innerHeight\n            },\n            telegramAPI: !!window.Telegram?.WebApp,\n            appliedClasses: Array.from(document.body.classList)\n        };\n    }\n}\n\n// Автоматический запуск при загрузке\nlet telegramNavFixer = null;\n\nfunction initTelegramFixer() {\n    if (!telegramNavFixer) {\n        telegramNavFixer = new TelegramNavigationFixer();\n        \n        // Добавляем в window для отладки\n        window.telegramNavFixer = telegramNavFixer;\n    }\n}\n\n// Запуск при готовности DOM\nif (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', initTelegramFixer);\n} else {\n    initTelegramFixer();\n}\n\n// Дополнительный запуск через Telegram события\nif (window.Telegram?.WebApp) {\n    window.Telegram.WebApp.ready(() => {\n        setTimeout(initTelegramFixer, 100);\n    });\n}\n\nconsole.log('✅ TelegramNavigationFixer: Module loaded');