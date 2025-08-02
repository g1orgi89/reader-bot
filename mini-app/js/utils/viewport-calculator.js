/**
 * 🔧 VIEWPORT HEIGHT CALCULATOR (ИСПРАВЛЕН)
 * 
 * Динамически вычисляет правильную высоту контента на основе 
 * РЕАЛЬНЫХ размеров header и navigation элементов
 * 
 * 🔧 ИСПРАВЛЕНО: Обновляет ОСНОВНЫЕ CSS переменные после удаления хедеров
 * 
 * @version 1.1.0
 */

class ViewportHeightCalculator {
    constructor() {
        this.isActive = false;
        
        // Привязываем методы к контексту
        this.updateViewportHeight = this.updateViewportHeight.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        console.log('🔧 ViewportHeightCalculator initialized v1.1.0');
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
            
            // 🔧 ИСПРАВЛЕНО: Обновляем ОСНОВНЫЕ CSS переменные
            // Эти переменные используются в base.css для расчета высоты контента
            document.documentElement.style.setProperty('--header-height', `${realSizes.headerHeight}px`);
            document.documentElement.style.setProperty('--bottom-nav-height', `${realSizes.bottomNavHeight}px`);
            
            // Дополнительные переменные для отладки
            document.documentElement.style.setProperty('--real-header-height', `${realSizes.headerHeight}px`);
            document.documentElement.style.setProperty('--real-bottom-nav-height', `${realSizes.bottomNavHeight}px`);
            document.documentElement.style.setProperty('--real-available-height', `${availableHeight}px`);
            document.documentElement.style.setProperty('--real-viewport-height', `${telegramHeight}px`);
            
            console.log('🔧 Viewport heights updated:', {
                viewport: telegramHeight,
                realHeader: realSizes.headerHeight,
                realNav: realSizes.bottomNavHeight,
                available: availableHeight,
                page: this.getCurrentPage(),
                updated: {
                    '--header-height': `${realSizes.headerHeight}px`,
                    '--bottom-nav-height': `${realSizes.bottomNavHeight}px`
                }
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

        // 🔧 НОВОЕ: Поиск встроенного блока аватара на главной странице
        const inlineHeaderSelectors = ['.user-header-inline', '.home-header-inline'];
        for (const selector of inlineHeaderSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                headerHeight = element.getBoundingClientRect().height;
                console.log(`📏 Found inline header: ${selector} = ${headerHeight}px`);
                break;
            }
        }

        // Ищем обычные header элементы (не должны быть после удаления хедеров!)
        if (headerHeight === 0) {
            const headerSelectors = ['.header', '#header', 'header', '.top-nav', '.app-header', '.page-header'];
            for (const selector of headerSelectors) {
                const element = document.querySelector(selector);
                if (element && this.isElementVisible(element)) {
                    headerHeight = element.getBoundingClientRect().height;
                    console.log(`⚠️ Found external header: ${selector} = ${headerHeight}px (should be removed!)`);
                    break;
                }
            }
        }

        // Ищем bottom navigation (должен быть всегда)
        const navSelectors = ['.bottom-nav', '#bottom-nav', '.navigation', '.nav-bottom', '.footer-nav'];
        for (const selector of navSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                bottomNavHeight = element.getBoundingClientRect().height;
                console.log(`📏 Found bottom nav: ${selector} = ${bottomNavHeight}px`);
                break;
            }
        }

        // 🔧 НОВОЕ: Логирование для отладки
        console.log('📏 Real element sizes measured:', {
            headerHeight,
            bottomNavHeight,
            currentPage: this.getCurrentPage()
        });

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
                console.log('🔧 ViewportCalculator auto-started after DOMContentLoaded');
            }, 1000); // Даем время другим скриптам инициализироваться
        });
    } else {
        setTimeout(() => {
            window.viewportCalculator = new ViewportHeightCalculator();
            window.viewportCalculator.start();
            console.log('🔧 ViewportCalculator auto-started immediately');
        }, 1000);
    }
}

console.log('🔧 ViewportHeightCalculator module loaded v1.1.0');