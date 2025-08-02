/**
 * 🔧 VIEWPORT HEIGHT CALCULATOR
 * 
 * Динамически вычисляет правильную высоту контента на основе 
 * РЕАЛЬНЫХ размеров header и navigation элементов
 * 
 * Решает проблему: CSS переменные не совпадают с реальными размерами элементов
 * 
 * @version 1.0.0
 */

class ViewportHeightCalculator {
    constructor() {
        this.isActive = false;
        
        // Привязываем методы к контексту
        this.updateViewportHeight = this.updateViewportHeight.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        console.log('🔧 ViewportHeightCalculator initialized');
    }

    /**
     * 🚀 Запуск калькулятора
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        
        // Обновляем сразу
        this.updateViewportHeight();
        
        // Обновляем при изменении размеров
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        
        // Обновляем при изменениях DOM (появление/исчезновение header)
        if (window.MutationObserver) {
            this.observer = new MutationObserver(() => {
                setTimeout(this.updateViewportHeight, 100); // Небольшая задержка для DOM
            });
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // Telegram специфичные события
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.onEvent('viewportChanged', this.handleResize);
        }
        
        console.log('✅ ViewportHeightCalculator started');
    }

    /**
     * ⏹️ Остановка калькулятора
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        console.log('⏹️ ViewportHeightCalculator stopped');
    }

    /**
     * 📏 Основная функция - обновление viewport высоты
     */
    updateViewportHeight() {
        try {
            // Измеряем реальные размеры элементов
            const realSizes = this.measureRealElementSizes();
            
            // Получаем viewport размеры
            const viewportHeight = window.innerHeight;
            const telegramHeight = window.Telegram?.WebApp?.viewportHeight || viewportHeight;
            
            // Рассчитываем доступную высоту для контента
            const availableHeight = telegramHeight - realSizes.headerHeight - realSizes.bottomNavHeight;
            
            // Устанавливаем CSS переменные на основе РЕАЛЬНЫХ размеров
            document.documentElement.style.setProperty('--real-header-height', `${realSizes.headerHeight}px`);
            document.documentElement.style.setProperty('--real-bottom-nav-height', `${realSizes.bottomNavHeight}px`);
            document.documentElement.style.setProperty('--real-available-height', `${availableHeight}px`);
            document.documentElement.style.setProperty('--real-viewport-height', `${telegramHeight}px`);
            
            console.log('🔧 Viewport heights updated:', {
                viewport: telegramHeight,
                realHeader: realSizes.headerHeight,
                realNav: realSizes.bottomNavHeight,
                available: availableHeight,
                page: this.getCurrentPage()
            });
            
        } catch (error) {
            console.error('❌ ViewportHeightCalculator error:', error);
        }
    }

    /**
     * 📏 Измерение реальных размеров элементов
     */
    measureRealElementSizes() {
        let headerHeight = 0;
        let bottomNavHeight = 0;

        // Ищем header элемент (может не быть на некоторых страницах!)
        const headerSelectors = ['.header', '#header', 'header', '.top-nav', '.app-header', '.home-header', '.page-header'];
        for (const selector of headerSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                headerHeight = element.getBoundingClientRect().height;
                break;
            }
        }

        // Ищем bottom navigation (должен быть всегда)
        const navSelectors = ['.bottom-nav', '#bottom-nav', '.navigation', '.nav-bottom', '.footer-nav'];
        for (const selector of navSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                bottomNavHeight = element.getBoundingClientRect().height;
                break;
            }
        }

        return {
            headerHeight,
            bottomNavHeight
        };
    }

    /**
     * 👁️ Проверка видимости элемента
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.height > 0 &&
            rect.width > 0
        );
    }

    /**
     * 📱 Определение текущей страницы
     */
    getCurrentPage() {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            return activeNav.getAttribute('data-page') || 'unknown';
        }
        return 'unknown';
    }

    /**
     * 📡 Обработчик изменения размеров
     */
    handleResize() {
        // Задержка для стабилизации после resize
        setTimeout(() => {
            if (this.isActive) {
                this.updateViewportHeight();
            }
        }, 300);
    }
}

// Экспорт и глобальная доступность
window.ViewportHeightCalculator = ViewportHeightCalculator;

// 🚀 Автоматический запуск
if (typeof window !== 'undefined') {
    // Запускаем калькулятор после полной загрузки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                window.viewportCalculator = new ViewportHeightCalculator();
                window.viewportCalculator.start();
            }, 1000); // Даем время другим скриптам инициализироваться
        });
    } else {
        setTimeout(() => {
            window.viewportCalculator = new ViewportHeightCalculator();
            window.viewportCalculator.start();
        }, 1000);
    }
}

console.log('🔧 ViewportHeightCalculator module loaded');