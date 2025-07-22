/**
 * TELEGRAM MINI APP NAVIGATION FIXER
 * 
 * Определяет Telegram окружение и применяет специальные CSS классы
 * для исправления проблем с нижней навигацией
 * 
 * ДОБАВЛЕНЫ ВИДИМЫЕ ИНДИКАТОРЫ ДЛЯ ОТЛАДКИ
 */

class TelegramNavigationFixer {
    constructor() {
        this.isTelegram = false;
        this.isDarkTheme = false;
        this.debugMode = false;
        this.statusIndicator = null;
        
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
        
        // Создаем видимый индикатор статуса
        this.createStatusIndicator();
        
        // Настраиваем слушатели
        this.setupEventListeners();
        
        // Запускаем принудительный фиксер
        this.startNavigationWatcher();
        
        this.showStatus(`🔧 TG Fixer: ${this.isTelegram ? 'ACTIVE' : 'INACTIVE'}`);
    }
    
    /**
     * Создаем видимый индикатор статуса
     */
    createStatusIndicator() {
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.id = 'tg-status';
        this.statusIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: ${this.isTelegram ? '#00ff00' : '#ff6600'};
            color: black;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 999999;
            font-family: monospace;
            max-width: 200px;
            word-wrap: break-word;
            pointer-events: none;
        `;
        
        document.body.appendChild(this.statusIndicator);
        
        // Автоматически скрываем через 5 секунд если не debug режим
        if (!this.debugMode) {
            setTimeout(() => {
                if (this.statusIndicator) {
                    this.statusIndicator.style.display = 'none';
                }
            }, 5000);
        }
    }
    
    /**
     * Показываем статус в индикаторе
     */
    showStatus(message) {
        if (this.statusIndicator) {
            this.statusIndicator.textContent = message;
            this.statusIndicator.style.display = 'block';
            
            // Обновляем цвет в зависимости от статуса
            if (message.includes('ERROR') || message.includes('FAIL')) {
                this.statusIndicator.style.background = '#ff4444';
                this.statusIndicator.style.color = 'white';
            } else if (message.includes('SUCCESS') || message.includes('FIXED')) {
                this.statusIndicator.style.background = '#00ff00';
                this.statusIndicator.style.color = 'black';
            } else if (message.includes('WARNING')) {
                this.statusIndicator.style.background = '#ffaa00';
                this.statusIndicator.style.color = 'black';
            }
        }
    }
    
    /**
     * Определяем Telegram окружение
     */
    detectTelegramEnvironment() {
        let detectionMethods = [];
        
        // Метод 1: Проверка Telegram WebApp API
        if (window.Telegram?.WebApp) {
            this.isTelegram = true;
            detectionMethods.push('WebApp API');
        }
        
        // Метод 2: Проверка User Agent
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('telegram')) {
            this.isTelegram = true;
            detectionMethods.push('User Agent');
        }
        
        // Метод 3: Проверка параметров URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tgWebAppPlatform') || urlParams.get('tgWebAppVersion')) {
            this.isTelegram = true;
            detectionMethods.push('URL params');
        }
        
        // Метод 4: Проверка referrer
        if (document.referrer.includes('telegram.org') || document.referrer.includes('t.me')) {
            this.isTelegram = true;
            detectionMethods.push('Referrer');
        }
        
        // Метод 5: Проверка window размеров (Telegram имеет специфичные размеры)
        const isTelegramSize = window.innerWidth <= 430 && window.innerHeight >= 600;
        if (isTelegramSize && (window.Telegram || userAgent.includes('mobile'))) {
            this.isTelegram = true;
            detectionMethods.push('Window size');
        }
        
        // Определяем тему
        this.detectTheme();
        
        // Показываем результат детекции
        this.showStatus(`🔍 DETECTED: ${this.isTelegram ? 'TELEGRAM' : 'BROWSER'} (${detectionMethods.join(', ') || 'none'})`);
        setTimeout(() => {
            this.showStatus(`📱 UA: ${userAgent.substring(0, 50)}...`);
        }, 2000);
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
    }
    
    /**
     * Применяем CSS классы
     */
    applyCSSClasses() {
        const body = document.body;
        
        if (this.isTelegram) {
            body.classList.add('telegram-mini-app');
            this.showStatus('✅ Applied telegram-mini-app class');
        }
        
        if (this.isDarkTheme) {
            body.classList.add('dark-theme');
        } else {
            body.classList.add('light-theme');
        }
        
        // Debug режим (можно включить нажатием на индикатор)
        if (localStorage.getItem('telegram-debug') === 'true') {
            body.classList.add('debug');
            this.debugMode = true;
            this.showStatus('🐛 DEBUG MODE ON');
        }
    }
    
    /**
     * Настройка слушателей событий
     */
    setupEventListeners() {
        if (!this.isTelegram) return;
        
        // Слушаем изменения темы в Telegram
        if (window.Telegram?.WebApp?.onEvent) {
            window.Telegram.WebApp.onEvent('themeChanged', () => {
                this.showStatus('🎨 Theme changed');
                this.detectTheme();
                this.updateThemeClass();
            });
        }
        
        // Слушаем изменения viewport в Telegram
        if (window.Telegram?.WebApp?.onEvent) {
            window.Telegram.WebApp.onEvent('viewportChanged', () => {
                this.showStatus('📱 Viewport changed');
                this.forceNavigationFix();
            });
        }
        
        // Слушаем стандартные события браузера
        window.addEventListener('resize', () => {
            if (this.isTelegram) {
                this.showStatus('📐 Window resized');
                setTimeout(() => this.forceNavigationFix(), 100);
            }
        });
        
        window.addEventListener('orientationchange', () => {
            if (this.isTelegram) {
                this.showStatus('🔄 Orientation changed');
                setTimeout(() => this.forceNavigationFix(), 300);
            }
        });
        
        // Слушаем scroll события
        let scrollTimeout;
        let scrollCount = 0;
        window.addEventListener('scroll', () => {
            if (!this.isTelegram) return;
            
            scrollCount++;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.showStatus(`📜 Scrolled ${scrollCount} times - fixing nav`);
                scrollCount = 0;
                this.forceNavigationFix();
            }, 50);
        }, { passive: true });
        
        // Клик по индикатору для включения debug режима
        if (this.statusIndicator) {
            this.statusIndicator.style.pointerEvents = 'auto';
            this.statusIndicator.style.cursor = 'pointer';
            this.statusIndicator.addEventListener('click', () => {
                this.toggleDebugMode();
            });
        }
    }
    
    /**
     * Переключаем debug режим
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode) {
            localStorage.setItem('telegram-debug', 'true');
            document.body.classList.add('debug');
            this.statusIndicator.style.display = 'block';
            this.showStatus('🐛 DEBUG MODE ON - Tap to turn off');
        } else {
            localStorage.removeItem('telegram-debug');
            document.body.classList.remove('debug');
            this.showStatus('❌ DEBUG MODE OFF');
            
            // Скрываем индикатор через 3 секунды
            setTimeout(() => {
                if (!this.debugMode && this.statusIndicator) {
                    this.statusIndicator.style.display = 'none';
                }
            }, 3000);
        }
    }
    
    /**
     * Обновляем класс темы
     */
    updateThemeClass() {
        const body = document.body;
        
        if (this.isDarkTheme) {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
        }
    }
    
    /**
     * Принудительное исправление навигации
     */
    forceNavigationFix() {
        if (!this.isTelegram) return;
        
        const nav = document.querySelector('.bottom-nav');
        if (!nav) {
            this.showStatus('❌ ERROR: .bottom-nav not found!');
            return;
        }
        
        // Получаем текущую позицию навигации
        const rect = nav.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const navBottom = rect.bottom;
        const diff = Math.abs(navBottom - windowHeight);
        
        // Показываем текущую позицию
        this.showStatus(`📍 Nav pos: bottom=${navBottom.toFixed(0)}, win=${windowHeight}, diff=${diff.toFixed(0)}`);
        
        // Если навигация не на своем месте - исправляем
        if (diff > 5) {
            // Сбрасываем все возможные стили
            nav.style.transform = '';
            nav.style.webkitTransform = '';
            nav.style.translate = '';
            nav.style.bottom = '';
            nav.style.position = '';
            nav.style.left = '';
            nav.style.right = '';
            nav.style.margin = '';
            nav.style.marginLeft = '';
            nav.style.marginRight = '';
            
            // Принудительно применяем правильные стили
            nav.style.cssText = `
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                transform: none !important;
                -webkit-transform: none !important;
                margin: 0 !important;
                width: 100% !important;
                z-index: 999999 !important;
            `;
            
            this.showStatus('🔧 NAVIGATION FIXED!');
            
            // Проверяем результат через 100мс
            setTimeout(() => {
                const newRect = nav.getBoundingClientRect();
                const newDiff = Math.abs(newRect.bottom - window.innerHeight);
                this.showStatus(`✅ Result: diff=${newDiff.toFixed(0)} ${newDiff < 5 ? 'SUCCESS' : 'FAIL'}`);
            }, 100);
        } else {
            this.showStatus('✅ Navigation position OK');
        }
    }
    
    /**
     * Запускаем наблюдатель за навигацией
     */
    startNavigationWatcher() {
        if (!this.isTelegram) return;
        
        // Немедленно исправляем позицию
        setTimeout(() => {
            this.showStatus('🚀 Starting navigation watcher...');
            this.forceNavigationFix();
        }, 100);
        
        // Создаем MutationObserver для отслеживания изменений
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.target.classList.contains('bottom-nav') &&
                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    
                    this.showStatus('⚠️ Navigation styles changed - fixing...');
                    setTimeout(() => this.forceNavigationFix(), 10);
                }
            });
        });
        
        // Наблюдаем за изменениями в навигации
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            observer.observe(nav, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            this.showStatus('👁️ MutationObserver attached to navigation');
        } else {
            this.showStatus('❌ ERROR: Cannot attach observer - nav not found');
        }
        
        // Периодическая проверка позиции (каждые 3 секунды)
        setInterval(() => {
            if (this.isTelegram && this.debugMode) {
                this.checkNavigationPosition();
            }
        }, 3000);
    }
    
    /**
     * Проверяем позицию навигации
     */
    checkNavigationPosition() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        
        const rect = nav.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const diff = Math.abs(rect.bottom - windowHeight);
        
        // Если навигация сдвинулась - исправляем
        if (diff > 5) {
            this.showStatus(`⚠️ Navigation drift detected: ${diff.toFixed(0)}px`);
            this.forceNavigationFix();
        }
    }
    
    /**
     * Публичные методы для отладки
     */
    enableDebug() {
        localStorage.setItem('telegram-debug', 'true');
        document.body.classList.add('debug');
        this.debugMode = true;
        this.statusIndicator.style.display = 'block';
        this.showStatus('🐛 Debug mode enabled');
    }
    
    disableDebug() {
        localStorage.removeItem('telegram-debug');
        document.body.classList.remove('debug');
        this.debugMode = false;
        this.showStatus('❌ Debug mode disabled');
    }
    
    getStatus() {
        const nav = document.querySelector('.bottom-nav');
        const navRect = nav ? nav.getBoundingClientRect() : null;
        
        return {
            isTelegram: this.isTelegram,
            isDarkTheme: this.isDarkTheme,
            debugMode: this.debugMode,
            userAgent: navigator.userAgent,
            windowSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            telegramAPI: !!window.Telegram?.WebApp,
            appliedClasses: Array.from(document.body.classList),
            navigationPosition: navRect ? {
                bottom: navRect.bottom,
                windowHeight: window.innerHeight,
                difference: Math.abs(navRect.bottom - window.innerHeight)
            } : 'not found'
        };
    }
}

// Автоматический запуск при загрузке
let telegramNavFixer = null;

function initTelegramFixer() {
    if (!telegramNavFixer) {
        telegramNavFixer = new TelegramNavigationFixer();
        
        // Добавляем в window для отладки
        window.telegramNavFixer = telegramNavFixer;
    }
}

// Запуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTelegramFixer);
} else {
    initTelegramFixer();
}

// Дополнительный запуск через Telegram события
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready(() => {
        setTimeout(initTelegramFixer, 100);
    });
}