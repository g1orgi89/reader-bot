/**
 * 🔧 КРИТИЧЕСКИЙ iOS NAVIGATION STABILIZER
 * 
 * Принудительно стабилизирует навигацию на iOS через inline стили
 * Это последний уровень защиты, если CSS не справляется
 */

class IOSNavigationStabilizer {
    constructor() {
        this.isIOS = this.detectIOS();
        this.stabilizationInterval = null;
        this.isActive = false;
        this.bottomNav = null;
        
        if (this.isIOS) {
            this.init();
        }
    }

    /**
     * Определение iOS устройства
     */
    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Инициализация стабилизатора
     */
    init() {
        console.log('🍎 iOS Navigation Stabilizer: Инициализация...');
        
        // Добавляем CSS класс
        document.documentElement.classList.add('ios-device');
        
        // Ждем загрузки DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
        
        // Также запускаем при изменении размера экрана
        window.addEventListener('resize', () => this.stabilize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.stabilize(), 300);
        });
    }

    /**
     * Запуск стабилизации
     */
    start() {
        this.bottomNav = document.querySelector('.bottom-nav');
        
        if (!this.bottomNav) {
            console.warn('🍎 Bottom navigation не найдена, повторная попытка через 1 сек...');
            setTimeout(() => this.start(), 1000);
            return;
        }

        console.log('🍎 iOS Navigation Stabilizer: Активация фиксов...');
        
        // Немедленная стабилизация
        this.stabilize();
        
        // Активируем Telegram API фиксы
        this.applyTelegramFixes();
        
        // Запускаем непрерывную стабилизацию
        this.startContinuousStabilization();
        
        // Обработчики событий
        this.setupEventHandlers();
        
        this.isActive = true;
        console.log('✅ iOS Navigation Stabilizer: Активирован');
    }

    /**
     * Основная функция стабилизации
     */
    stabilize() {
        if (!this.bottomNav) return;

        // 🔧 КРИТИЧЕСКИЕ INLINE СТИЛИ - максимальный приоритет
        const criticalStyles = {
            'position': 'fixed',
            'bottom': '0',
            'left': '0',
            'right': '0',
            'width': '100vw',
            'z-index': '999999',
            'transform': 'translateZ(0)',
            '-webkit-transform': 'translateZ(0)',
            'will-change': 'auto',
            'transition': 'none',
            '-webkit-transition': 'none',
            'animation': 'none',
            '-webkit-animation': 'none',
            'height': '64px',
            'min-height': '64px',
            'max-height': '64px',
            '-webkit-backface-visibility': 'hidden',
            'backface-visibility': 'hidden',
            'contain': 'layout style paint',
            'isolation': 'isolate',
            'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
            'box-sizing': 'border-box',
            'overscroll-behavior': 'none',
            '-webkit-overscroll-behavior': 'none',
            '-webkit-overflow-scrolling': 'auto'
        };

        // Применяем критические стили к навигации
        Object.entries(criticalStyles).forEach(([property, value]) => {
            this.bottomNav.style.setProperty(property, value, 'important');
        });

        // 🔧 СТАБИЛИЗАЦИЯ НАВИГАЦИОННЫХ ЭЛЕМЕНТОВ
        const navItems = this.bottomNav.querySelectorAll('.nav-item');
        navItems.forEach((item, index) => {
            const itemStyles = {
                'position': 'relative',
                'transform': 'none',
                '-webkit-transform': 'none',
                'transition': 'none',
                'width': 'calc(20% - 4px)',
                'height': '56px',
                'flex': 'none',
                'display': 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                'justify-content': 'center',
                'gap': '4px',
                'padding': '4px',
                'box-sizing': 'border-box'
            };

            Object.entries(itemStyles).forEach(([property, value]) => {
                item.style.setProperty(property, value, 'important');
            });

            // Стабилизация иконок
            const icon = item.querySelector('.nav-icon');
            if (icon) {
                const iconStyles = {
                    'width': '24px',
                    'height': '24px',
                    'transform': 'none',
                    '-webkit-transform': 'none',
                    'transition': 'none',
                    'flex-shrink': '0',
                    'display': 'block',
                    'margin': '0 auto'
                };

                Object.entries(iconStyles).forEach(([property, value]) => {
                    icon.style.setProperty(property, value, 'important');
                });
            }

            // Стабилизация текста
            const label = item.querySelector('.nav-label');
            if (label) {
                const labelStyles = {
                    'font-size': '10px',
                    'line-height': '12px',
                    'height': '12px',
                    'transform': 'none',
                    '-webkit-transform': 'none',
                    'transition': 'none',
                    'text-align': 'center',
                    'white-space': 'nowrap',
                    'overflow': 'hidden',
                    'margin': '0',
                    'padding': '0'
                };

                Object.entries(labelStyles).forEach(([property, value]) => {
                    label.style.setProperty(property, value, 'important');
                });
            }
        });

        console.log('🔧 iOS Navigation: Стабилизация применена');
    }

    /**
     * Применение Telegram API фиксов
     */
    applyTelegramFixes() {
        if (!window.Telegram?.WebApp) return;

        const tg = window.Telegram.WebApp;

        try {
            // Отключаем вертикальные свайпы (Bot API 7.7+)
            if (tg.disableVerticalSwipes && typeof tg.disableVerticalSwipes === 'function') {
                tg.disableVerticalSwipes();
                console.log('🔧 Telegram: Вертикальные свайпы отключены');
            }

            // Разворачиваем приложение
            if (tg.expand && typeof tg.expand === 'function') {
                tg.expand();
                console.log('🔧 Telegram: Приложение развернуто');
            }

            // Настраиваем Safe Area
            if (tg.safeAreaInset) {
                const safeArea = tg.safeAreaInset;
                document.documentElement.style.setProperty('--tg-safe-area-top', `${safeArea.top}px`);
                document.documentElement.style.setProperty('--tg-safe-area-bottom', `${safeArea.bottom}px`);
                document.documentElement.style.setProperty('--tg-safe-area-left', `${safeArea.left}px`);
                document.documentElement.style.setProperty('--tg-safe-area-right', `${safeArea.right}px`);
                console.log('🔧 Telegram: Safe Area настроена', safeArea);
            }

            // Обеспечиваем прокручиваемость документа
            this.ensureScrollable();

        } catch (error) {
            console.warn('⚠️ Ошибка применения Telegram API фиксов:', error);
        }
    }

    /**
     * Обеспечение прокручиваемости документа
     */
    ensureScrollable() {
        const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
        
        if (!isScrollable) {
            document.documentElement.style.height = 'calc(100vh + 1px)';
            document.body.style.minHeight = 'calc(100vh + 1px)';
            console.log('🔧 iOS: Документ сделан прокручиваемым');
        }

        // Принудительная прокрутка для активации
        window.setTimeout(() => {
            window.scrollTo(0, 1);
            window.setTimeout(() => window.scrollTo(0, 0), 10);
        }, 100);
    }

    /**
     * Запуск непрерывной стабилизации
     */
    startContinuousStabilization() {
        // Проверяем стабильность каждые 500ms
        this.stabilizationInterval = setInterval(() => {
            this.checkAndRestabilize();
        }, 500);
    }

    /**
     * Проверка и повторная стабилизация при необходимости
     */
    checkAndRestabilize() {
        if (!this.bottomNav) return;

        // Проверяем ключевые стили
        const currentPosition = getComputedStyle(this.bottomNav).position;
        const currentBottom = getComputedStyle(this.bottomNav).bottom;
        const currentZIndex = getComputedStyle(this.bottomNav).zIndex;

        if (currentPosition !== 'fixed' || currentBottom !== '0px' || parseInt(currentZIndex) < 999999) {
            console.log('⚠️ iOS Navigation: Обнаружены нарушения, повторная стабилизация...');
            this.stabilize();
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventHandlers() {
        // Предотвращение bounce эффекта
        document.body.addEventListener('touchmove', (e) => {
            const scrollableParent = e.target.closest('.scrollable, .modal-content, .page-content');
            if (!scrollableParent) {
                e.preventDefault();
            }
        }, { passive: false });

        // Обработка скролла
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.stabilize();
            }, 100);
        }, { passive: true });

        // Обработка изменения DOM
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                let needsRestabilization = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.target === this.bottomNav || 
                        (mutation.target.contains && mutation.target.contains(this.bottomNav))) {
                        needsRestabilization = true;
                    }
                });
                
                if (needsRestabilization) {
                    setTimeout(() => this.stabilize(), 50);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }

    /**
     * Включение debug режима
     */
    enableDebug() {
        document.documentElement.classList.add('debug-navigation');
        console.log('🔍 iOS Navigation Debug: Включен');
    }

    /**
     * Отключение debug режима
     */
    disableDebug() {
        document.documentElement.classList.remove('debug-navigation');
        console.log('🔍 iOS Navigation Debug: Отключен');
    }

    /**
     * Остановка стабилизации
     */
    stop() {
        if (this.stabilizationInterval) {
            clearInterval(this.stabilizationInterval);
            this.stabilizationInterval = null;
        }
        this.isActive = false;
        console.log('⏹️ iOS Navigation Stabilizer: Остановлен');
    }

    /**
     * Получение статуса
     */
    getStatus() {
        return {
            isIOS: this.isIOS,
            isActive: this.isActive,
            hasBottomNav: !!this.bottomNav,
            telegramAPIAvailable: !!window.Telegram?.WebApp,
            verticalSwipesDisabled: window.Telegram?.WebApp?.isVerticalSwipesEnabled === false,
            documentScrollable: document.documentElement.scrollHeight > window.innerHeight
        };
    }
}

// 🚀 АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ
let iosNavigationStabilizer = null;

function initIOSNavigationStabilizer() {
    if (!iosNavigationStabilizer) {
        iosNavigationStabilizer = new IOSNavigationStabilizer();
        
        // Делаем доступным глобально для отладки
        window.iosNavigationStabilizer = iosNavigationStabilizer;
        
        // Debug команды
        window.debugNavigation = {
            stabilize: () => iosNavigationStabilizer.stabilize(),
            status: () => iosNavigationStabilizer.getStatus(),
            enableDebug: () => iosNavigationStabilizer.enableDebug(),
            disableDebug: () => iosNavigationStabilizer.disableDebug(),
            restart: () => {
                iosNavigationStabilizer.stop();
                setTimeout(() => {
                    iosNavigationStabilizer = new IOSNavigationStabilizer();
                    window.iosNavigationStabilizer = iosNavigationStabilizer;
                }, 100);
            }
        };
    }
}

// Инициализация
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIOSNavigationStabilizer);
} else {
    initIOSNavigationStabilizer();
}

// Экспорт для глобального доступа
window.IOSNavigationStabilizer = IOSNavigationStabilizer;
window.initIOSNavigationStabilizer = initIOSNavigationStabilizer;
