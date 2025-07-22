/**
 * ПРОДВИНУТЫЙ ФИКСЕР НАВИГАЦИИ ДЛЯ iOS TELEGRAM MINI APP
 * Решает проблемы с позиционированием нижней панели при свайпах
 * Версия 3.0 - Комплексный подход
 */

class TelegramIOSNavigationFixer {
    constructor() {
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isTelegram = !!(window.Telegram?.WebApp || navigator.userAgent.includes('Telegram'));
        this.debugMode = false;
        
        // Состояние
        this.isKeyboardVisible = false;
        this.lastViewportHeight = window.innerHeight;
        this.navElement = null;
        this.fixInterval = null;
        
        // Привязка методов
        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.forceNavigationFix = this.forceNavigationFix.bind(this);
        
        this.init();
    }
    
    init() {
        if (!this.isIOS || !this.isTelegram) {
            this.log('❌ Не iOS или не Telegram, фиксер не активен');
            return;
        }
        
        this.log('🚀 Инициализация iOS Navigation Fixer v3.0');
        
        // Добавляем класс для CSS
        document.body.classList.add('telegram-mini-app', 'ios-device');
        
        // Ждем загрузку DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupFixer());
        } else {
            this.setupFixer();
        }
        
        // Настраиваем Telegram WebApp
        this.setupTelegramWebApp();
    }
    
    setupTelegramWebApp() {
        if (window.Telegram?.WebApp) {
            const webApp = window.Telegram.WebApp;
            
            try {
                // Расширяем приложение на полный экран
                webApp.expand();
                
                // Если доступен API 7.7+ - отключаем вертикальные свайпы
                if (webApp.disableVerticalSwipes) {
                    webApp.disableVerticalSwipes();
                    this.log('✅ Отключены вертикальные свайпы');
                }
                
                // Устанавливаем цвета темы
                webApp.setHeaderColor('#ffffff');
                webApp.setBackgroundColor('#ffffff');
                
                this.log('✅ Telegram WebApp настроен');
            } catch (error) {
                this.log('⚠️ Ошибка настройки Telegram WebApp:', error);
            }
        }
    }
    
    setupFixer() {
        // Находим навигационный элемент
        this.navElement = document.querySelector('.bottom-nav');
        
        if (!this.navElement) {
            this.log('⚠️ Навигационный элемент не найден, ждем...');
            setTimeout(() => this.setupFixer(), 500);
            return;
        }
        
        this.log('✅ Навигационный элемент найден');
        
        // Применяем первичный фикс
        this.forceNavigationFix();
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Запускаем периодический фикс
        this.startPeriodicFix();
        
        // Предотвращаем коллапс Mini App
        this.preventMiniAppCollapse();
        
        // Стабилизируем viewport
        this.stabilizeViewport();
    }
    
    setupEventListeners() {
        // Скролл - основная проблема
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        
        // Изменение размера окна
        window.addEventListener('resize', this.handleResize);
        
        // Фокус на полях ввода (клавиатура)
        document.addEventListener('focusin', this.handleFocus);
        document.addEventListener('focusout', this.handleBlur);
        
        // Тач события для iOS
        document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        
        // Переключение страниц
        this.hookPageSwitching();
        
        // Visual Viewport API для iOS 13+
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.handleResize);
        }
        
        this.log('✅ Обработчики событий настроены');
    }
    
    handleScroll() {
        // При каждом скролле принудительно фиксим позицию
        this.forceNavigationFix();
    }
    
    handleResize() {
        const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const heightDiff = this.lastViewportHeight - currentHeight;
        
        // Определяем появление/скрытие клавиатуры
        if (heightDiff > 150) {
            this.isKeyboardVisible = true;
            this.log('⌨️ Клавиатура появилась');
        } else if (heightDiff < -150) {
            this.isKeyboardVisible = false;
            this.log('⌨️ Клавиатура скрылась');
        }
        
        this.lastViewportHeight = currentHeight;
        
        // Фиксим навигацию после изменения viewport
        setTimeout(() => this.forceNavigationFix(), 100);
        setTimeout(() => this.forceNavigationFix(), 300);
    }
    
    handleFocus(e) {\n        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {\n            this.log('🔍 Фокус на поле ввода');\n            \n            // Немедленный фикс\n            this.forceNavigationFix();\n            \n            // Отложенные фиксы для анимации клавиатуры\n            setTimeout(() => this.forceNavigationFix(), 200);\n            setTimeout(() => this.forceNavigationFix(), 500);\n            setTimeout(() => this.forceNavigationFix(), 1000);\n        }\n    }\n    \n    handleBlur(e) {\n        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {\n            this.log('❌ Потеря фокуса поля ввода');\n            \n            // Фиксы после скрытия клавиатуры\n            setTimeout(() => this.forceNavigationFix(), 100);\n            setTimeout(() => this.forceNavigationFix(), 300);\n            setTimeout(() => this.forceNavigationFix(), 600);\n        }\n    }\n    \n    handleTouchStart() {\n        // При любом тач-событии проверяем навигацию\n        setTimeout(() => this.forceNavigationFix(), 10);\n    }\n    \n    hookPageSwitching() {\n        // Перехватываем функцию переключения страниц\n        const originalShowPage = window.showPage;\n        \n        window.showPage = (...args) => {\n            this.log('🔄 Переключение страницы:', args[0]);\n            \n            // Вызываем оригинальную функцию\n            if (originalShowPage) {\n                originalShowPage.apply(this, args);\n            }\n            \n            // Множественные фиксы после переключения\n            setTimeout(() => this.forceNavigationFix(), 10);\n            setTimeout(() => this.forceNavigationFix(), 50);\n            setTimeout(() => this.forceNavigationFix(), 100);\n            setTimeout(() => this.forceNavigationFix(), 200);\n            setTimeout(() => this.forceNavigationFix(), 500);\n        };\n    }\n    \n    forceNavigationFix() {\n        if (!this.navElement) {\n            this.navElement = document.querySelector('.bottom-nav');\n        }\n        \n        if (!this.navElement) return;\n        \n        // Применяем критические стили\n        const criticalStyles = {\n            position: 'fixed',\n            bottom: '0',\n            left: '0',\n            right: '0',\n            zIndex: '999999',\n            transform: 'none',\n            webkitTransform: 'none',\n            margin: '0',\n            width: '100%',\n            maxWidth: 'none'\n        };\n        \n        Object.assign(this.navElement.style, criticalStyles);\n        \n        // Дополнительные стили для стабильности\n        this.navElement.style.setProperty('transform', 'none', 'important');\n        this.navElement.style.setProperty('-webkit-transform', 'none', 'important');\n        this.navElement.style.setProperty('position', 'fixed', 'important');\n        this.navElement.style.setProperty('bottom', '0', 'important');\n        \n        this.debugLog('🔧 Навигация зафиксирована');\n    }\n    \n    startPeriodicFix() {\n        // Периодический фикс каждые 200мс\n        this.fixInterval = setInterval(() => {\n            this.forceNavigationFix();\n        }, 200);\n        \n        this.log('⏰ Запущен периодический фикс (200мс)');\n    }\n    \n    preventMiniAppCollapse() {\n        // Предотвращаем коллапс Mini App при свайпе до верха\n        const preventCollapse = () => {\n            if (window.scrollY === 0) {\n                window.scrollTo(0, 1);\n            }\n        };\n        \n        // Добавляем невидимый элемент для прокрутки\n        const spacer = document.createElement('div');\n        spacer.style.cssText = `\n            position: absolute;\n            top: -1px;\n            width: 100%;\n            height: 1px;\n            opacity: 0;\n            pointer-events: none;\n        `;\n        document.body.prepend(spacer);\n        \n        document.addEventListener('touchstart', preventCollapse, { passive: true });\n        document.addEventListener('scroll', preventCollapse, { passive: true });\n        \n        this.log('✅ Защита от коллапса Mini App активирована');\n    }\n    \n    stabilizeViewport() {\n        // Стабилизируем viewport для iOS\n        const setViewportHeight = () => {\n            const vh = window.innerHeight * 0.01;\n            document.documentElement.style.setProperty('--vh', `${vh}px`);\n            \n            if (window.visualViewport) {\n                const visualVH = window.visualViewport.height * 0.01;\n                document.documentElement.style.setProperty('--visual-vh', `${visualVH}px`);\n            }\n        };\n        \n        setViewportHeight();\n        window.addEventListener('resize', setViewportHeight);\n        \n        if (window.visualViewport) {\n            window.visualViewport.addEventListener('resize', setViewportHeight);\n        }\n        \n        this.log('✅ Viewport стабилизирован');\n    }\n    \n    // Публичные методы\n    enableDebug() {\n        this.debugMode = true;\n        this.log('🐛 Debug режим включен');\n    }\n    \n    disableDebug() {\n        this.debugMode = false;\n    }\n    \n    getStatus() {\n        return {\n            isIOS: this.isIOS,\n            isTelegram: this.isTelegram,\n            isKeyboardVisible: this.isKeyboardVisible,\n            navElementFound: !!this.navElement,\n            fixerActive: !!this.fixInterval,\n            lastViewportHeight: this.lastViewportHeight,\n            debugMode: this.debugMode\n        };\n    }\n    \n    destroy() {\n        if (this.fixInterval) {\n            clearInterval(this.fixInterval);\n            this.fixInterval = null;\n        }\n        \n        // Удаляем обработчики\n        window.removeEventListener('scroll', this.handleScroll);\n        window.removeEventListener('resize', this.handleResize);\n        document.removeEventListener('focusin', this.handleFocus);\n        document.removeEventListener('focusout', this.handleBlur);\n        document.removeEventListener('touchstart', this.handleTouchStart);\n        \n        this.log('🗑️ Фиксер уничтожен');\n    }\n    \n    // Утилиты логирования\n    log(...args) {\n        console.log('📱 [iOS Nav Fixer]', ...args);\n    }\n    \n    debugLog(...args) {\n        if (this.debugMode) {\n            console.log('🐛 [iOS Nav Debug]', ...args);\n        }\n    }\n}\n\n// Автоматическая инициализация\nconst telegramNavFixer = new TelegramIOSNavigationFixer();\n\n// Экспорт в глобальную область\nwindow.telegramNavFixer = telegramNavFixer;\nwindow.forceNavFix = () => telegramNavFixer.forceNavigationFix();\n\n// Legacy совместимость\nif (typeof window.simpleNavFix === 'undefined') {\n    window.simpleNavFix = () => telegramNavFixer.forceNavigationFix();\n}\n\nconsole.log('🚀 iOS Telegram Navigation Fixer v3.0 загружен');