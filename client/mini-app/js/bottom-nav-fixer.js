/**
 * BOTTOM NAVIGATION FIXER v2.0
 * ОКОНЧАТЕЛЬНОЕ РЕШЕНИЕ проблемы с нижней панелью навигации
 * 
 * Принудительно фиксирует позицию нижней панели и предотвращает любые
 * сбои позиционирования, особенно на iOS и при свайпах в Telegram Mini Apps.
 */

class BottomNavFixer {
    constructor() {
        this.panel = null;
        this.originalStyles = {};
        this.isFixerActive = false;
        this.updateInterval = null;
        this.observers = [];
        
        console.log('🔧 BottomNavFixer v2.0: Starting initialization...');
        this.init();
    }
    
    /**
     * Инициализация фиксера
     */
    init() {
        // Ждем загрузки DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    /**
     * Настройка фиксера
     */
    setup() {
        this.panel = document.querySelector('.bottom-nav');
        
        if (!this.panel) {
            console.warn('⚠️ BottomNavFixer: .bottom-nav element not found');
            return;
        }
        
        console.log('✅ BottomNavFixer: Navigation panel found');
        
        // Сохраняем оригинальные стили
        this.saveOriginalStyles();
        
        // Запускаем фиксер
        this.startFixer();
        
        // Настраиваем обсерверы
        this.setupObservers();
        
        // Слушаем события
        this.setupEventListeners();
        
        console.log('✅ BottomNavFixer: Setup completed');
    }
    
    /**
     * Сохранение оригинальных стилей
     */
    saveOriginalStyles() {
        const computedStyle = window.getComputedStyle(this.panel);
        this.originalStyles = {
            position: this.panel.style.position || computedStyle.position,
            bottom: this.panel.style.bottom || computedStyle.bottom,
            left: this.panel.style.left || computedStyle.left,
            right: this.panel.style.right || computedStyle.right,
            transform: this.panel.style.transform || computedStyle.transform,
            zIndex: this.panel.style.zIndex || computedStyle.zIndex
        };
        
        console.log('💾 Original styles saved:', this.originalStyles);
    }
    
    /**
     * Запуск фиксера
     */
    startFixer() {
        this.isFixerActive = true;
        
        // Немедленно фиксируем позицию
        this.forceCorrectPosition();
        
        // Запускаем постоянный мониторинг
        this.updateInterval = setInterval(() => {
            this.forceCorrectPosition();
        }, 100); // Проверяем каждые 100мс
        
        console.log('🚀 BottomNavFixer: Active monitoring started');
    }
    
    /**
     * ПРИНУДИТЕЛЬНОЕ исправление позиции
     */
    forceCorrectPosition() {
        if (!this.panel || !this.isFixerActive) return;
        
        const currentStyles = {
            position: this.panel.style.position,
            bottom: this.panel.style.bottom,
            left: this.panel.style.left,
            right: this.panel.style.right,
            transform: this.panel.style.transform
        };
        
        // КРИТИЧЕСКИЕ СТИЛИ - должны быть именно такими
        const correctStyles = {
            position: 'fixed',
            bottom: '0px',
            left: '50%',
            right: 'auto',
            transform: 'translateX(-50%)',
            zIndex: '1000',
            width: '100%',
            maxWidth: '430px'
        };
        
        // Проверяем, нужно ли обновление
        let needsUpdate = false;
        for (const [key, value] of Object.entries(correctStyles)) {
            if (this.panel.style[key] !== value) {
                needsUpdate = true;
                break;
            }
        }
        
        // Применяем исправления если нужно
        if (needsUpdate) {
            Object.assign(this.panel.style, correctStyles);
            
            // Дополнительные iOS-специфичные фиксы
            if (this.isIOS()) {
                this.panel.style.webkitBackfaceVisibility = 'hidden';
                this.panel.style.backfaceVisibility = 'hidden';
                this.panel.style.webkitTransform = 'translateX(-50%) translateZ(0)';
                this.panel.style.willChange = 'auto';
            }
            
            console.log('🔧 Position corrected');
        }
    }
    
    /**
     * Настройка наблюдателей за изменениями
     */
    setupObservers() {
        // MutationObserver для отслеживания изменений стилей
        const styleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // Кто-то изменил стили - исправляем немедленно
                    setTimeout(() => this.forceCorrectPosition(), 10);
                }
            });
        });
        
        styleObserver.observe(this.panel, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        
        this.observers.push(styleObserver);
        
        // ResizeObserver для отслеживания изменений размеров viewport
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                setTimeout(() => this.forceCorrectPosition(), 50);
            });
            
            resizeObserver.observe(document.body);
            this.observers.push(resizeObserver);
        }
    }
    
    /**
     * Настройка слушателей событий
     */
    setupEventListeners() {
        // Telegram события
        if (window.Telegram?.WebApp?.onEvent) {
            window.Telegram.WebApp.onEvent('viewportChanged', () => {
                console.log('📱 Telegram viewport changed - fixing position');
                setTimeout(() => this.forceCorrectPosition(), 10);
            });
        }
        
        // Стандартные события браузера
        ['resize', 'orientationchange', 'scroll'].forEach(eventName => {
            window.addEventListener(eventName, () => {
                setTimeout(() => this.forceCorrectPosition(), 50);
            });
        });
        
        // Фокус/потеря фокуса input элементов (iOS keyboard)
        document.addEventListener('focusin', () => {
            setTimeout(() => this.forceCorrectPosition(), 300);
        });
        
        document.addEventListener('focusout', () => {
            setTimeout(() => this.forceCorrectPosition(), 100);
        });
        
        // Защита от случайного сброса стилей
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => this.forceCorrectPosition(), 500);
        });
        
        // Дополнительная защита при загрузке страницы
        window.addEventListener('load', () => {
            setTimeout(() => this.forceCorrectPosition(), 100);
        });
    }
    
    /**
     * Определение iOS устройства
     */
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    
    /**
     * Принудительное обновление (публичный метод)
     */
    forceUpdate() {
        console.log('🔄 Force update requested');
        this.forceCorrectPosition();
    }
    
    /**
     * Остановка фиксера
     */
    stop() {
        this.isFixerActive = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Останавливаем всех наблюдателей
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        console.log('⏹️ BottomNavFixer: Stopped');
    }
    
    /**
     * Перезапуск фиксера
     */
    restart() {
        console.log('🔄 BottomNavFixer: Restarting...');
        this.stop();
        setTimeout(() => this.startFixer(), 100);
    }
    
    /**
     * Получение статуса фиксера
     */
    getStatus() {
        return {
            isActive: this.isFixerActive,
            hasPanel: !!this.panel,
            isIOS: this.isIOS(),
            currentStyles: this.panel ? {
                position: this.panel.style.position,
                bottom: this.panel.style.bottom,
                left: this.panel.style.left,
                transform: this.panel.style.transform
            } : null
        };
    }
}

// Автоматический запуск при загрузке
let bottomNavFixer = null;

// Запускаем фиксер
function initBottomNavFixer() {
    if (!bottomNavFixer) {
        bottomNavFixer = new BottomNavFixer();
        
        // Добавляем в window для отладки
        window.bottomNavFixer = bottomNavFixer;
    }
}

// Запуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBottomNavFixer);
} else {
    initBottomNavFixer();
}

// Дополнительный запуск через Telegram события
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready(() => {
        setTimeout(initBottomNavFixer, 200);
    });
}

console.log('✅ BottomNavFixer v2.0: Module loaded and ready');
