/**
 * TELEGRAM MINI APP NAVIGATION FIXER
 * С АБСОЛЮТНО СТАТИЧНЫМ ИНДИКАТОРОМ ОТЛАДКИ
 */

class TelegramNavigationFixer {
    constructor() {
        this.isTelegram = false;
        this.isDarkTheme = false;
        this.debugMode = false;
        this.statusIndicator = null;
        
        this.init();
    }
    
    init() {
        // Проверяем Telegram окружение
        this.detectTelegramEnvironment();
        
        // Применяем CSS классы
        this.applyCSSClasses();
        
        // Создаем АБСОЛЮТНО СТАТИЧНЫЙ индикатор
        this.createStaticIndicator();
        
        // Настраиваем слушатели
        this.setupEventListeners();
        
        // Запускаем принудительный фиксер
        this.startNavigationWatcher();
        
        this.showStatus(`TG: ${this.isTelegram ? 'YES' : 'NO'}`);
    }
    
    /**
     * Создаем СТАТИЧНЫЙ индикатор который НЕ ДВИГАЕТСЯ
     */
    createStaticIndicator() {
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.id = 'tg-static-status';
        this.statusIndicator.style.cssText = `
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            background: ${this.isTelegram ? '#00ff00' : '#ff6600'} !important;
            color: black !important;
            padding: 3px 6px !important;
            border-radius: 3px !important;
            font-size: 9px !important;
            font-weight: bold !important;
            z-index: 2147483647 !important;
            font-family: monospace !important;
            max-width: 150px !important;
            word-wrap: break-word !important;
            line-height: 1.1 !important;
            pointer-events: auto !important;
            cursor: pointer !important;
            
            /* КРИТИЧНО: Блокируем любое движение */
            transform: none !important;
            -webkit-transform: none !important;
            translate: none !important;
            margin: 0px !important;
            
            /* Блокируем изменения через viewport */
            width: auto !important;
            height: auto !important;
            min-width: 60px !important;
            min-height: 15px !important;
            
            /* Дополнительная защита */
            transition: none !important;
            animation: none !important;
            will-change: auto !important;
            contain: none !important;
            
            /* Блокируем скрытие */
            visibility: visible !important;
            opacity: 1 !important;
            display: block !important;
        `;
        
        document.body.appendChild(this.statusIndicator);
        
        // Событие клика для переключения debug
        this.statusIndicator.addEventListener('click', () => {
            this.toggleDebugMode();
        });
        
        // Принудительно держим статичную позицию
        setInterval(() => {
            if (this.statusIndicator) {
                this.statusIndicator.style.position = 'fixed';
                this.statusIndicator.style.top = '10px';
                this.statusIndicator.style.left = '10px';
                this.statusIndicator.style.zIndex = '2147483647';
                this.statusIndicator.style.visibility = 'visible';
                this.statusIndicator.style.display = 'block';
                this.statusIndicator.style.transform = 'none';
            }
        }, 500);
        
        // Автоматически скрываем через 3 секунды если не debug
        if (!this.debugMode) {
            setTimeout(() => {
                if (this.statusIndicator && !this.debugMode) {
                    this.statusIndicator.style.display = 'none';
                }
            }, 3000);
        }
    }
    
    /**
     * Показываем статус в статичном индикаторе
     */
    showStatus(message) {
        if (this.statusIndicator) {
            // Обрезаем длинные сообщения
            const shortMessage = message.length > 25 ? message.substring(0, 25) + '...' : message;
            this.statusIndicator.textContent = shortMessage;
            this.statusIndicator.style.display = 'block';
            
            // Обновляем цвет
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
            
            // В debug режиме показываем постоянно
            if (this.debugMode) {
                this.statusIndicator.style.display = 'block';
            }
        }
    }
    
    detectTelegramEnvironment() {
        let methods = [];
        
        // Метод 1: Telegram WebApp API
        if (window.Telegram?.WebApp) {
            this.isTelegram = true;
            methods.push('API');
        }
        
        // Метод 2: User Agent
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('telegram')) {
            this.isTelegram = true;
            methods.push('UA');
        }
        
        // Метод 3: URL параметры
        const url = new URLSearchParams(window.location.search);
        if (url.get('tgWebAppPlatform') || url.get('tgWebAppVersion')) {
            this.isTelegram = true;
            methods.push('URL');
        }
        
        // Метод 4: Referrer
        if (document.referrer.includes('telegram.org') || document.referrer.includes('t.me')) {
            this.isTelegram = true;
            methods.push('REF');
        }
        
        this.detectTheme();
        
        // Показываем результат коротко
        setTimeout(() => {
            this.showStatus(`DET: ${methods.join(',') || 'NONE'}`);
        }, 1000);
    }
    
    detectTheme() {
        if (window.Telegram?.WebApp?.colorScheme) {
            this.isDarkTheme = window.Telegram.WebApp.colorScheme === 'dark';
        } else {
            this.isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    }
    
    applyCSSClasses() {
        const body = document.body;
        
        if (this.isTelegram) {
            body.classList.add('telegram-mini-app');
        }
        
        if (this.isDarkTheme) {
            body.classList.add('dark-theme');
        } else {
            body.classList.add('light-theme');
        }
        
        if (localStorage.getItem('telegram-debug') === 'true') {
            body.classList.add('debug');
            this.debugMode = true;
        }
    }
    
    setupEventListeners() {
        if (!this.isTelegram) return;
        
        // Telegram события
        if (window.Telegram?.WebApp?.onEvent) {
            window.Telegram.WebApp.onEvent('viewportChanged', () => {
                this.showStatus('VP CHANGE');
                this.forceNavigationFix();
            });
            
            window.Telegram.WebApp.onEvent('themeChanged', () => {
                this.showStatus('THEME CHG');
                this.detectTheme();
                this.updateThemeClass();
            });
        }
        
        // Стандартные события
        window.addEventListener('resize', () => {
            if (this.isTelegram) {
                this.showStatus('RESIZE');
                setTimeout(() => this.forceNavigationFix(), 50);
            }
        });
        
        // Счетчик скроллов
        let scrollCount = 0;
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (!this.isTelegram) return;
            
            scrollCount++;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.showStatus(`SCR: ${scrollCount}`);
                scrollCount = 0;
                this.forceNavigationFix();
            }, 100);
        }, { passive: true });
    }
    
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode) {
            localStorage.setItem('telegram-debug', 'true');
            document.body.classList.add('debug');
            this.statusIndicator.style.display = 'block';
            this.statusIndicator.style.background = '#0099ff';
            this.showStatus('DEBUG ON');
        } else {
            localStorage.removeItem('telegram-debug');
            document.body.classList.remove('debug');
            this.statusIndicator.style.background = this.isTelegram ? '#00ff00' : '#ff6600';
            this.showStatus('DEBUG OFF');
            
            setTimeout(() => {
                if (!this.debugMode && this.statusIndicator) {
                    this.statusIndicator.style.display = 'none';
                }
            }, 2000);
        }
    }
    
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
    
    forceNavigationFix() {
        if (!this.isTelegram) return;
        
        const nav = document.querySelector('.bottom-nav');
        if (!nav) {
            this.showStatus('NAV 404');
            return;
        }
        
        // Получаем позицию
        const rect = nav.getBoundingClientRect();
        const winHeight = window.innerHeight;
        const diff = Math.abs(rect.bottom - winHeight);
        
        if (diff > 5) {
            // Сбрасываем все стили
            nav.style.cssText = `
                position: fixed !important;
                bottom: 0px !important;
                left: 0px !important;
                right: 0px !important;
                top: auto !important;
                width: 100vw !important;
                transform: none !important;
                margin: 0px !important;
                z-index: 2147483647 !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
            `;
            
            this.showStatus(`FIX: ${diff.toFixed(0)}px`);
            
            // Проверяем результат
            setTimeout(() => {
                const newRect = nav.getBoundingClientRect();
                const newDiff = Math.abs(newRect.bottom - window.innerHeight);
                this.showStatus(`OK: ${newDiff.toFixed(0)}px`);
            }, 50);
        } else {
            this.showStatus(`POS: OK`);
        }
    }
    
    startNavigationWatcher() {
        if (!this.isTelegram) return;
        
        // Немедленное исправление
        setTimeout(() => {
            this.showStatus('FIXING...');
            this.forceNavigationFix();
        }, 100);
        
        // MutationObserver
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.target.classList.contains('bottom-nav') &&
                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    
                    this.showStatus('MUT CHG');
                    setTimeout(() => this.forceNavigationFix(), 10);
                }
            });
        });
        
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            observer.observe(nav, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            this.showStatus('OBS SET');
        }
        
        // Периодическая проверка каждые 2 секунды в debug режиме
        setInterval(() => {
            if (this.isTelegram && this.debugMode) {
                this.checkNavigationPosition();
            }
        }, 2000);
        
        // Экстремальная защита - проверяем каждые 500мс
        setInterval(() => {
            if (this.isTelegram) {
                this.ensureNavigationStatic();
            }
        }, 500);
    }
    
    ensureNavigationStatic() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        
        // Проверяем критические стили
        const computed = window.getComputedStyle(nav);
        if (computed.position !== 'fixed' || 
            computed.bottom !== '0px' || 
            computed.zIndex < '100') {
            
            this.showStatus('DRIFT!');
            this.forceNavigationFix();
        }
    }
    
    checkNavigationPosition() {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        
        const rect = nav.getBoundingClientRect();
        const diff = Math.abs(rect.bottom - window.innerHeight);
        
        if (diff > 5) {
            this.showStatus(`DRIFT ${diff.toFixed(0)}`);
            this.forceNavigationFix();
        }
    }
    
    // Публичные методы
    enableDebug() {
        this.debugMode = true;
        localStorage.setItem('telegram-debug', 'true');
        document.body.classList.add('debug');
        this.statusIndicator.style.display = 'block';
        this.showStatus('DEBUG ON');
    }
    
    disableDebug() {
        this.debugMode = false;
        localStorage.removeItem('telegram-debug');
        document.body.classList.remove('debug');
        this.showStatus('DEBUG OFF');
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

// Автоматический запуск
let telegramNavFixer = null;

function initTelegramFixer() {
    if (!telegramNavFixer) {
        telegramNavFixer = new TelegramNavigationFixer();
        window.telegramNavFixer = telegramNavFixer;
    }
}

// Запуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTelegramFixer);
} else {
    initTelegramFixer();
}

// Дополнительный запуск через Telegram
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready(() => {
        setTimeout(initTelegramFixer, 100);
    });
}