/**
 * 📱 iOS ФИКСЫ ДЛЯ TELEGRAM MINI APP
 * Размер: ~1 KB - критические фиксы для iOS Safari WebView
 * 
 * Решает только актуальные проблемы iOS в Telegram Mini Apps:
 * - Фикс viewport height для модальных окон
 * - Обработка safe-area для iPhone с выемкой
 * - Предотвращение bounce эффекта при скролле
 * - Фикс позиционирования при появлении клавиатуры
 * 
 * Использует современные CSS и Telegram WebApp API вместо старых хаков
 */

// 🍎 ОПРЕДЕЛЕНИЕ iOS УСТРОЙСТВА
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// 📱 КЛАСС iOS ФИКСОВ
class IOSFixes {
    constructor() {
        this.isIOSDevice = isIOS();
        this.keyboardVisible = false;
        this.originalViewportHeight = window.innerHeight;
        
        if (this.isIOSDevice) {
            this.init();
        }
    }

    /**
     * Инициализация iOS фиксов
     */
    init() {
        this.setupViewportFix();
        this.setupSafeAreaSupport();
        this.setupScrollFixes();
        this.setupKeyboardHandling();
        this.setupTelegramSpecificFixes();
        
        console.log('🍎 iOS фиксы активированы');
    }

    /**
     * Фикс viewport height для модальных окон
     * Использует современный dvh (dynamic viewport height)
     */
    setupViewportFix() {
        // Добавляем CSS переменную для актуальной высоты viewport
        const updateViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Определяем видимость клавиатуры
            const heightDiff = this.originalViewportHeight - window.innerHeight;
            this.keyboardVisible = heightDiff > 150; // Клавиатура занимает обычно >150px
            
            document.documentElement.classList.toggle('keyboard-visible', this.keyboardVisible);
        };

        // Обновляем при изменении размера окна
        window.addEventListener('resize', updateViewportHeight);
        window.addEventListener('orientationchange', () => {
            setTimeout(updateViewportHeight, 100);
        });
        
        // Инициализация
        updateViewportHeight();
    }

    /**
     * Поддержка safe-area для iPhone с выемкой
     */
    setupSafeAreaSupport() {
        // Проверяем поддержку safe-area
        const supportsSafeArea = CSS.supports('top: env(safe-area-inset-top)');
        
        if (supportsSafeArea) {
            document.documentElement.classList.add('supports-safe-area');
            
            // Добавляем CSS переменные для safe-area
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --safe-area-top: env(safe-area-inset-top, 0px);
                    --safe-area-bottom: env(safe-area-inset-bottom, 0px);
                    --safe-area-left: env(safe-area-inset-left, 0px);
                    --safe-area-right: env(safe-area-inset-right, 0px);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Фиксы скролла для iOS
     */
    setupScrollFixes() {
        // Предотвращение bounce эффекта на body
        document.body.addEventListener('touchmove', (e) => {
            // Разрешаем скролл только внутри скроллируемых контейнеров
            const scrollableParent = e.target.closest('.scrollable, .modal-content, .content');
            if (!scrollableParent) {
                e.preventDefault();
            }
        }, { passive: false });

        // Фикс скролла в модальных окнах
        document.addEventListener('touchstart', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    // Включаем momentum scrolling для модальных окон
                    modalContent.style.webkitOverflowScrolling = 'touch';
                    modalContent.style.overflowY = 'auto';
                }
            }
        });
    }

    /**
     * Обработка появления/скрытия клавиатуры
     */
    setupKeyboardHandling() {
        // Слушаем изменения viewport для определения клавиатуры
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleKeyboardToggle();
            }, 100);
        });

        // Обработка фокуса на инпутах
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea')) {
                this.handleInputFocus(e.target);
            }
        });

        document.addEventListener('focusout', (e) => {
            if (e.target.matches('input, textarea')) {
                this.handleInputBlur(e.target);
            }
        });
    }

    /**
     * Обработка переключения клавиатуры
     */
    handleKeyboardToggle() {
        const bottomNav = document.querySelector('.bottom-nav');
        const header = document.querySelector('.header, .home-header, .page-header');
        
        if (this.keyboardVisible) {
            // Клавиатура появилась - скрываем нижнюю навигацию
            if (bottomNav) {
                bottomNav.style.transform = 'translateY(100%)';
            }
            
            // Уведомляем Telegram о изменении высоты
            if (window.Telegram?.WebApp?.expand) {
                window.Telegram.WebApp.expand();
            }
        } else {
            // Клавиатура скрылась - показываем навигацию
            if (bottomNav) {
                bottomNav.style.transform = 'translateY(0)';
            }
        }
    }

    /**
     * Обработка фокуса на инпуте
     * @param {HTMLElement} input - Элемент инпута
     */
    handleInputFocus(input) {
        // Скроллим к инпуту с небольшой задержкой
        setTimeout(() => {
            const rect = input.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            // Если инпут скрыт клавиатурой, скроллим к нему
            if (rect.bottom > viewportHeight * 0.5) {
                input.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 300);
        
        // Добавляем класс для стилизации
        input.classList.add('input-focused');
    }

    /**
     * Обработка потери фокуса инпута
     * @param {HTMLElement} input - Элемент инпута
     */
    handleInputBlur(input) {
        input.classList.remove('input-focused');
        
        // Возвращаем scroll в исходное положение
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    }

    /**
     * Специфические фиксы для Telegram WebApp
     */
    setupTelegramSpecificFixes() {
        // Проверяем, что мы в Telegram
        if (!window.Telegram?.WebApp) return;

        // Настраиваем Telegram WebApp для iOS
        const tg = window.Telegram.WebApp;
        
        // Разворачиваем приложение на полный экран
        if (tg.expand) {
            tg.expand();
        }
        
        // Настраиваем цвет статус-бара для iOS
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#D2452C'); // Основной цвет приложения
        }
        
        // Настраиваем цвет фона для iOS
        if (tg.setBackgroundColor) {
            tg.setBackgroundColor('#F5F2EC'); // Фон приложения
        }
        
        // Обрабатываем изменение темы в Telegram
        tg.onEvent('themeChanged', () => {
            this.updateThemeColors();
        });
        
        // Настраиваем кнопку "Назад" для iOS
        if (tg.BackButton) {
            tg.BackButton.onClick(() => {
                // Закрываем модальные окна или меню
                if (window.menuHandler) {
                    if (window.menuHandler.activeModals.size > 0) {
                        window.menuHandler.closeAllModals();
                    } else if (window.menuHandler.isMenuOpen) {
                        window.menuHandler.toggleMenu(false);
                    }
                }
            });
        }
    }

    /**
     * Обновление цветов темы
     */
    updateThemeColors() {
        const tg = window.Telegram.WebApp;
        const isDark = tg.colorScheme === 'dark';
        
        // Переключаем тему приложения
        document.body.classList.toggle('dark-theme', isDark);
        
        // Обновляем цвета в Telegram
        if (tg.setHeaderColor) {
            tg.setHeaderColor(isDark ? '#E85A42' : '#D2452C');
        }
        
        if (tg.setBackgroundColor) {
            tg.setBackgroundColor(isDark ? '#1A1A1A' : '#F5F2EC');
        }
    }

    /**
     * Утилитарный метод для создания дополнительных CSS стилей
     */
    addIOSStyles() {
        const style = document.createElement('style');
        style.id = 'ios-fixes-styles';
        style.textContent = `
            /* iOS специфичные стили */
            .ios-device {
                /* Используем современные CSS свойства */
                height: 100dvh; /* Dynamic viewport height */
                overflow-x: hidden;
            }
            
            /* Фикс для модальных окон */
            .modal-overlay {
                height: 100dvh;
                height: calc(var(--vh, 1vh) * 100);
            }
            
            /* Фикс для клавиатуры */
            .keyboard-visible .bottom-nav {
                transition: transform 0.3s ease;
            }
            
            /* Safe area поддержка */
            .supports-safe-area .header,
            .supports-safe-area .home-header,
            .supports-safe-area .page-header {
                padding-top: calc(16px + var(--safe-area-top));
            }
            
            .supports-safe-area .bottom-nav {
                padding-bottom: calc(8px + var(--safe-area-bottom));
            }
            
            /* Фикс для инпутов */
            .input-focused {
                position: relative;
                z-index: 1000;
            }
            
            /* Momentum scrolling для всех скроллируемых областей */
            .scrollable,
            .modal-content,
            .content {
                -webkit-overflow-scrolling: touch;
                overflow-y: auto;
            }
        `;
        
        document.head.appendChild(style);
        
        // Добавляем класс iOS устройства
        if (this.isIOSDevice) {
            document.documentElement.classList.add('ios-device');
        }
    }
}

// 🚀 ИНИЦИАЛИЗАЦИЯ iOS ФИКСОВ
let iosFixes = null;

/**
 * Инициализация iOS фиксов
 */
export function initIOSFixes() {
    if (isIOS() && !iosFixes) {
        iosFixes = new IOSFixes();
        iosFixes.addIOSStyles();
        
        // Делаем доступным глобально для отладки
        window.iosFixes = iosFixes;
    }
}

/**
 * Проверка активности iOS фиксов
 * @returns {boolean} - Активны ли iOS фиксы
 */
export function isIOSFixesActive() {
    return iosFixes !== null;
}

// 🌐 АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIOSFixes);
} else {
    initIOSFixes();
}

// 🌐 ЭКСПОРТ
export default {
    IOSFixes,
    initIOSFixes,
    isIOSFixesActive,
    isIOS
};